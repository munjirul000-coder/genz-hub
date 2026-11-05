#!/usr/bin/env node
'use strict';
/**
 * NOVA Windows bridge — explicit, allowlisted, one action at a time.
 * Run: node nova-agent.js --server https://your-nova-host --token-file nova-bridge.token
 * --dry-run is for development/tests and NEVER executes desktop actions.
 * No shell interpolation, arbitrary commands, direct delete command, or screen capture.
 * Approved mouse clicks can trigger actions in other applications, including deletion.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

const ACTIONS = Object.freeze({
  open_youtube: { label: 'Open YouTube', url: 'https://www.youtube.com' },
  open_spotify: { label: 'Open Spotify', url: 'https://open.spotify.com' },
  open_whatsapp: { label: 'Open WhatsApp', url: 'https://web.whatsapp.com' },
  open_notepad: { label: 'Open Notepad' },
  open_calculator: { label: 'Open Calculator' },
  open_explorer: { label: 'Open Downloads' },
  system_info: { label: 'System information' },
  whatsapp_draft: { label: 'Open WhatsApp draft' },
  keyboard_type: { label: 'Type in Notepad' },
  mouse_move: { label: 'Move mouse pointer' },
  mouse_click: { label: 'Left click mouse' },
});
const VERSION = '0.3.0';
function argsOf(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (['dry-run', 'self-test', 'help'].includes(key)) args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}
function validate(kind, params = {}) {
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, kind)) throw new Error('Action is not allowlisted.');
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw new Error('Invalid parameters.');
  if (kind === 'keyboard_type') {
    const text = params.text;
    if (Object.keys(params).join(',') !== 'text' || typeof text !== 'string' || !text.trim() || text.length > 300 || /[\x00-\x1f\x7f]/.test(text) || /(?:gsk_[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})/.test(text)) throw new Error('Invalid keyboard text.');
    return { text };
  }
  if (kind === 'mouse_move' || kind === 'mouse_click') {
    if (Object.keys(params).sort().join(',') !== 'x,y' || !Number.isInteger(params.x) || !Number.isInteger(params.y) || params.x < -32768 || params.x > 32767 || params.y < -32768 || params.y > 32767) throw new Error('Invalid mouse coordinates.');
    return { x: params.x, y: params.y };
  }
  if (kind === 'whatsapp_draft') {
    const phone = String(params.phone || '').replace(/[\s()-]/g, '');
    const text = String(params.text || '').trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone) || !text || text.length > 500) throw new Error('Invalid WhatsApp draft.');
    return { phone, text };
  }
  if (Object.keys(params).length) throw new Error('This action accepts no parameters.');
  return {};
}
function systemInfo() {
  return { hostname: os.hostname(), os: `${os.platform()} ${os.release()}`, arch: os.arch(), cpu: os.cpus()[0]?.model || 'Unknown', cores: os.cpus().length, memoryGB: +(os.totalmem() / 1073741824).toFixed(1), freeMemoryGB: +(os.freemem() / 1073741824).toFixed(1), uptimeHours: +(os.uptime() / 3600).toFixed(1), agentVersion: VERSION };
}
function launch(exe, args = []) {
  return new Promise((resolve, reject) => {
    // shell is deliberately false. Arguments are never interpreted as a command line.
    const child = spawn(exe, args, { shell: false, windowsHide: false, stdio: 'ignore', detached: true });
    const timer = setTimeout(() => { child.removeAllListeners(); reject(new Error(`${exe} did not start within 10 seconds.`)); }, 10000);
    child.once('error', (err) => { clearTimeout(timer); reject(err); });
    child.once('spawn', () => { clearTimeout(timer); child.unref(); resolve(); });
  });
}
// Fixed, locally defined PowerShell only. Coordinates are validated independently
// above and passed in the environment, never interpolated into executable code.
const MOUSE_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NovaMouse {
    [DllImport("user32.dll", SetLastError=true)] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
'@
$x = [int]$env:NOVA_MOUSE_X; $y = [int]$env:NOVA_MOUSE_Y
$left = [NovaMouse]::GetSystemMetrics(76); $top = [NovaMouse]::GetSystemMetrics(77)
$width = [NovaMouse]::GetSystemMetrics(78); $height = [NovaMouse]::GetSystemMetrics(79)
if ($width -le 0 -or $height -le 0 -or $x -lt $left -or $y -lt $top -or $x -ge ($left + $width) -or $y -ge ($top + $height)) { throw 'Coordinates are outside the virtual screen.' }
if (-not [NovaMouse]::SetCursorPos($x, $y)) { throw 'Windows could not move the mouse pointer.' }
if ($env:NOVA_MOUSE_CLICK -eq '1') {
    [NovaMouse]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
    [NovaMouse]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
}
`;
function sendMouse(kind, params) {
  const encoded = Buffer.from(MOUSE_SCRIPT, 'utf16le').toString('base64');
  const env = { ...process.env, NOVA_MOUSE_X: String(params.x), NOVA_MOUSE_Y: String(params.y), NOVA_MOUSE_CLICK: kind === 'mouse_click' ? '1' : '0' };
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { shell: false, windowsHide: true, timeout: 15000, maxBuffer: 65536, env }, (err) => {
      if (err) return reject(new Error('Windows mouse operation failed. Check the coordinates and that the desktop is unlocked.'));
      resolve();
    });
  });
}
// Only send single-line Unicode text to the foreground Notepad process. No
// arbitrary keystrokes, shortcuts or shell commands are accepted.
const KEYBOARD_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
public static class NovaKeyboard {
    [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx, dy; public uint mouseData, flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort vk, scan; public uint flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] public struct HARDWAREINPUT { public uint message; public ushort low, high; }
    [StructLayout(LayoutKind.Explicit)] public struct UNION { [FieldOffset(0)] public MOUSEINPUT mouse; [FieldOffset(0)] public KEYBDINPUT key; [FieldOffset(0)] public HARDWAREINPUT hardware; }
    [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public UNION data; }
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint id);
    [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
    public static void TypeText(string text) {
        IntPtr target = GetForegroundWindow(); uint pid;
        GetWindowThreadProcessId(target, out pid);
        if (target == IntPtr.Zero || pid == 0 || !string.Equals(Process.GetProcessById((int)pid).ProcessName, "notepad", StringComparison.OrdinalIgnoreCase)) throw new Exception("Activate Notepad before typing.");
        foreach (char c in text) {
            if (GetForegroundWindow() != target) throw new Exception("Focus changed while typing; stopped.");
            INPUT[] events = new INPUT[2];
            events[0].type = 1; events[0].data.key.scan = c; events[0].data.key.flags = 4;
            events[1].type = 1; events[1].data.key.scan = c; events[1].data.key.flags = 6;
            if (SendInput(2, events, Marshal.SizeOf(typeof(INPUT))) != 2) throw new Exception("Windows rejected keyboard input.");
        }
    }
}
'@
Start-Sleep -Seconds 5
[NovaKeyboard]::TypeText($env:NOVA_KEYBOARD_TEXT)
`;
function sendKeyboard(params) {
  const encoded = Buffer.from(KEYBOARD_SCRIPT, 'utf16le').toString('base64');
  const env = { ...process.env, NOVA_KEYBOARD_TEXT: params.text };
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { shell: false, windowsHide: true, timeout: 20000, maxBuffer: 65536, env }, err => {
      if (err) return reject(new Error('Keyboard action failed or stopped. Open and focus Notepad within 5 seconds; some text may already have been typed.'));
      resolve();
    });
  });
}
async function execute(action, dryRun = false) {
  const params = validate(action.kind, action.params);
  const item = ACTIONS[action.kind];
  if (dryRun) return `[DRY RUN] ${item.label}: no desktop operation was performed.`;
  if (process.platform !== 'win32') throw new Error('The NOVA bridge executes actions on Windows only. Use --dry-run for protocol tests.');
  if (action.kind === 'keyboard_type') {
    await sendKeyboard(params);
    return 'Text was sent to the focused Notepad window.';
  }
  if (action.kind === 'mouse_move' || action.kind === 'mouse_click') {
    await sendMouse(action.kind, params);
    return `${item.label} sent at (${params.x}, ${params.y}). NOVA cannot see what was clicked.`;
  }
  if (item.url) await launch('rundll32.exe', ['url.dll,FileProtocolHandler', item.url]);
  else if (action.kind === 'open_notepad') await launch('notepad.exe');
  else if (action.kind === 'open_calculator') await launch('calc.exe');
  else if (action.kind === 'open_explorer') await launch('explorer.exe', [path.join(os.homedir(), 'Downloads')]);
  else if (action.kind === 'system_info') { const s = systemInfo(); return `${s.hostname} · ${s.os} (${s.arch})\n${s.cpu} · ${s.cores} logical cores\nMemory: ${s.freeMemoryGB} GB free / ${s.memoryGB} GB\nUptime: ${s.uptimeHours} hours`; }
  else if (action.kind === 'whatsapp_draft') await launch('rundll32.exe', ['url.dll,FileProtocolHandler', `https://wa.me/${params.phone.slice(1)}?text=${encodeURIComponent(params.text)}`]);
  return `${item.label} was launched on your desktop.${action.kind === 'whatsapp_draft' ? ' The draft was not sent. Press Send in WhatsApp yourself.' : ''}`;
}
async function request(base, route, token, body) {
  const res = await fetch(base + '/api/nova/bridge/' + route, {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(data.error || `Server returned HTTP ${res.status}`); err.status = res.status; throw err; }
  return data;
}
async function main() {
  const args = argsOf(process.argv.slice(2));
  if (args.help) { console.log('NOVA bridge\n  --server URL          HTTPS server (or http://localhost for development)\n  --token-file PATH     File containing your one-time bridge token\n  --dry-run             Poll and report without executing anything\n  --self-test           Validate the safety allowlist and exit'); return; }
  if (args['self-test']) {
    const invalid = [{ kind: 'shell', params: {} }, { kind: 'open_youtube', params: { url: 'https://evil.example' } }, { kind: 'whatsapp_draft', params: { phone: '123', text: 'hi' } }, { kind: '__proto__', params: {} }];
    for (const a of invalid) { let rejected = false; try { validate(a.kind, a.params); } catch { rejected = true; } if (!rejected) throw new Error('Safety self-test failed: ' + a.kind); }
    for (const kind of Object.keys(ACTIONS)) validate(kind, kind === 'whatsapp_draft' ? { phone: '+8801712345678', text: 'Hello' } : kind.startsWith('mouse_') ? { x: 10, y: 10 } : kind === 'keyboard_type' ? { text: 'Hello' } : {});
    console.log('PASS: allowlist, parameter validation and dangerous-action rejection.'); return;
  }
  const base = (args.server || process.env.NOVA_SERVER || 'http://localhost:3000').replace(/\/$/, '');
  let url; try { url = new URL(base); } catch { throw new Error('Invalid --server URL.'); }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Use HTTPS for a remote server. Plain HTTP is allowed only on localhost.');
  const tokenFile = args['token-file'] || process.env.NOVA_BRIDGE_TOKEN_FILE || path.join(process.cwd(), 'nova-bridge.token');
  let token = process.env.NOVA_BRIDGE_TOKEN || '';
  if (!token) { try { token = fs.readFileSync(tokenFile, 'utf8').trim(); } catch { throw new Error(`No bridge token. Save the token from NOVA → Desktop control in ${tokenFile}, or set NOVA_BRIDGE_TOKEN.`); } }
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new Error('The bridge token is malformed. Generate a fresh token in NOVA.');
  const dryRun = !!args['dry-run'];
  if (!dryRun && process.platform !== 'win32') throw new Error('Desktop execution requires Windows 10/11. This platform can only use --dry-run or --self-test.');
  console.log(`NOVA bridge ${VERSION} → ${base}${dryRun ? ' [DRY RUN — nothing will execute]' : ''}`);
  console.log('Only approved, allowlisted actions run. Press Ctrl+C to disconnect.');
  let failures = 0; let stopping = false;
  process.on('SIGINT', () => { stopping = true; console.log('\nDisconnecting…'); });
  process.on('SIGTERM', () => { stopping = true; });
  while (!stopping) {
    try {
      const { action } = await request(base, 'poll', token, { system: systemInfo() });
      failures = 0;
      if (action) {
        console.log(`Running approved action: ${action.label}`);
        let ok = true, result;
        try { result = await execute(action, dryRun); } catch (err) { ok = false; result = err.message; }
        await request(base, 'result', token, { id: action.id, ok, result });
        console.log(`${ok ? 'Completed' : 'Failed'}: ${result}`);
      }
    } catch (err) {
      if (err.status === 401) throw new Error('Bridge token was revoked or replaced. Generate a new token and restart the agent.');
      failures++; console.error(`Connection issue (${failures}): ${err.message}`);
    }
    if (!stopping) await new Promise(r => setTimeout(r, Math.min(15000, 2000 * Math.max(1, failures))));
  }
}
if (require.main === module) main().catch(err => { console.error('NOVA bridge:', err.message); process.exitCode = 1; });
module.exports = { ACTIONS, validate, execute, systemInfo, argsOf };
