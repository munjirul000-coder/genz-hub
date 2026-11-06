'use strict';
// Windows tray is a visible lifecycle controller, not a microphone or screen
// listener. The existing browser voice window still requires explicit consent.
const path = require('node:path');
const { spawn } = require('node:child_process');

const TRAY_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$context = New-Object System.Windows.Forms.ApplicationContext
$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = [System.Drawing.SystemIcons]::Application
$icon.Text = 'NOVA running - voice controlled in browser window'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$open = $menu.Items.Add('Open NOVA')
$voice = $menu.Items.Add('Open voice page')
$exit = $menu.Items.Add('Stop NOVA')
$open.Add_Click({ [Console]::Out.WriteLine('OPEN_MAIN'); [Console]::Out.Flush() })
$voice.Add_Click({ [Console]::Out.WriteLine('OPEN_VOICE'); [Console]::Out.Flush() })
$exit.Add_Click({ [Console]::Out.WriteLine('STOP'); [Console]::Out.Flush(); $icon.Visible = $false; $context.ExitThread() })
$icon.Add_DoubleClick({ [Console]::Out.WriteLine('OPEN_MAIN'); [Console]::Out.Flush() })
$icon.ContextMenuStrip = $menu
$icon.Visible = $true
# Hold a handle to the exact parent process. If the launcher is killed, do not
# leave an orphaned icon implying NOVA is still controlled.
$owner = [System.Diagnostics.Process]::GetProcessById(__PARENT_PID__)
$watch = New-Object System.Windows.Forms.Timer
$watch.Interval = 3000
$watch.Add_Tick({ try { if ($owner.HasExited) { $icon.Visible = $false; $context.ExitThread() } } catch { $icon.Visible = $false; $context.ExitThread() } })
$watch.Start()
[Console]::Out.WriteLine('READY'); [Console]::Out.Flush()
try { [System.Windows.Forms.Application]::Run($context) } finally { $watch.Stop(); $watch.Dispose(); $owner.Dispose(); $icon.Visible = $false; $icon.Dispose(); $menu.Dispose() }
`;
function trayArgs(ownerPid = process.pid) {
  if (!Number.isSafeInteger(ownerPid) || ownerPid <= 0) throw new Error('Invalid owner process.');
  return ['-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(TRAY_SCRIPT.replace('__PARENT_PID__', String(ownerPid)), 'utf16le').toString('base64')];
}
function localUrl(port, view) {
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !['main', 'voice'].includes(view)) throw new Error('Invalid local NOVA window.');
  return `http://localhost:${port}/nova${view === 'voice' ? '?voice=1#conversation' : ''}`;
}
function openWindow(port, view, { spawnChild = spawn, systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT } = {}) {
  const url = localUrl(port, view);
  if (!systemRoot) throw new Error('Windows system folder unavailable.');
  const child = spawnChild(path.join(systemRoot, 'System32', 'rundll32.exe'), ['url.dll,FileProtocolHandler', url], { detached: true, windowsHide: true, stdio: 'ignore', shell: false });
  child.on('error', () => console.error('Could not open NOVA window. Open ' + url + ' in your browser.'));
  child.unref();
}
function createCompanion({ root = path.resolve(__dirname, '../..'), spawnChild = spawn, platform = process.platform, systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT, port = Number(process.env.PORT || 3000), log = console, open = null, readyMs = 20000, trayMs = 12000, stopMs = 10000 } = {}) {
  if (platform !== 'win32') throw new Error('The NOVA desktop companion requires Windows.');
  localUrl(port, 'main');
  const show = open || (view => openWindow(port, view, { spawnChild, systemRoot }));
  let server, tray, stopping = false, trayReady = false, trayUnavailable = false, serverReady = false, exited = false, failure = false;
  let readyTimer, trayTimer, stopTimer;
  let resolveDone; const done = new Promise(resolve => { resolveDone = resolve; });
  const finish = code => {
    if (exited) return; exited = true; clearTimeout(readyTimer); clearTimeout(trayTimer); clearTimeout(stopTimer);
    if (tray && !tray.killed) { try { tray.kill(); } catch {} }
    resolveDone(code);
  };
  const openSafely = view => { try { show(view); } catch (err) { log.error('Could not open NOVA window:', err.message); } };
  function stop(failed = false) {
    if (stopping || exited) return; failure = failed; stopping = true; clearTimeout(readyTimer); clearTimeout(trayTimer);
    if (tray && !tray.killed) { try { tray.kill(); } catch {} }
    if (!server) return finish(0);
    try { if (server.connected) server.send({ type: 'nova-companion-stop' }, err => { if (err && !exited) try { server.kill(); } catch {} }); else server.kill(); } catch { try { server.kill(); } catch {} }
    stopTimer = setTimeout(() => { if (!exited) { try { server.kill(); } catch {} finish(1); } }, stopMs); stopTimer.unref?.();
  }
  function fallbackTray(reason) {
    if (stopping || exited || trayReady || trayUnavailable) return;
    trayUnavailable = true; clearTimeout(trayTimer); if (tray && !tray.killed) { try { tray.kill(); } catch {} }
    log.error('NOVA tray unavailable. Keep this window open; use Ctrl+C to stop. ' + reason);
    openSafely('main');
  }
  function startTray() {
    if (!systemRoot) return fallbackTray('Windows system folder not found.');
    try {
      tray = spawnChild(path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), trayArgs(), { cwd: root, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { return fallbackTray('Could not start tray.'); }
    let buffer = '';
    tray.stdout.once('error', () => { if (trayReady) { log.error('NOVA tray stopped unexpectedly; stopping NOVA.'); stop(true); } else fallbackTray('Tray communication failed.'); });
    tray.stdout.on('data', data => {
      buffer += data.toString(); if (buffer.length > 8192) { buffer = ''; return; }
      let nl; while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim(); buffer = buffer.slice(nl + 1);
        if (line === 'READY' && !trayReady && !trayUnavailable && !stopping) { trayReady = true; clearTimeout(trayTimer); log.log('NOVA tray ready. The tray does not use the microphone; voice pages require consent.'); openSafely('main'); }
        else if (line === 'OPEN_MAIN' && trayReady && !stopping) openSafely('main');
        else if (line === 'OPEN_VOICE' && trayReady && !stopping) openSafely('voice');
        else if (line === 'STOP' && trayReady) stop();
      }
    });
    tray.once('error', () => { if (trayReady) { log.error('NOVA tray stopped unexpectedly; stopping NOVA.'); stop(true); } else fallbackTray('Could not start tray.'); });
    tray.once('exit', () => { if (stopping || exited) return; if (trayReady) { log.error('NOVA tray stopped unexpectedly; stopping NOVA.'); stop(true); } else fallbackTray('Tray could not start.'); });
    trayTimer = setTimeout(() => fallbackTray('Tray did not respond.'), trayMs); trayTimer.unref?.();
  }
  function start() {
    try { server = spawnChild(process.execPath, [path.join(root, 'src/server.js'), '--nova-home', '--desktop-companion'], { cwd: root, env: { ...process.env, PORT: String(port) }, shell: false, windowsHide: false, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] }); }
    catch (err) { log.error('NOVA server could not start:', err.message); finish(1); return done; }
    server.once('error', err => { log.error('NOVA server could not start:', err.message); finish(1); });
    server.once('exit', code => { if (!stopping && code !== 0) log.error('NOVA server stopped unexpectedly.'); finish(stopping && code === 0 ? (failure ? 1 : 0) : (code || 1)); });
    server.on('message', message => { if (!serverReady && message?.type === 'nova-server-ready' && message.port === port && !stopping && !exited) { serverReady = true; clearTimeout(readyTimer); startTray(); } });
    readyTimer = setTimeout(() => { if (!serverReady && !exited) { log.error('NOVA server did not start in time.'); stop(true); } }, readyMs); readyTimer.unref?.();
    return done;
  }
  return { start, stop };
}
if (require.main === module) {
  try {
    const companion = createCompanion();
    ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => companion.stop()));
    companion.start().then(code => { process.exitCode = code; }, err => { console.error('NOVA companion error:', err.message); process.exitCode = 1; });
  } catch (err) { console.error('NOVA companion error:', err.message); process.exitCode = 1; }
}
module.exports = { createCompanion, openWindow, localUrl, trayArgs };
