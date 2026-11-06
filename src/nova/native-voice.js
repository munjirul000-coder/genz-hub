'use strict';
// Explicitly enabled, single-session Windows background speech. No raw audio,
// keys, session tokens, shell commands or model-chosen operations are sent to
// the worker. The worker is restricted to microphone, local recognition and TTS.
const path = require('node:path');
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { nativeVoiceArgs } = require('./native-voice-script');
const errors = {
  NO_RECOGNIZER: 'This Windows language recognizer is not installed. Native Bengali may be unavailable; try English or use the browser voice window.',
  NO_VOICE: 'A Windows text-to-speech voice for this language is not installed. Try another supported language or the browser voice window.',
  MIC_FAILED: 'The microphone could not be opened. Check Windows microphone permissions and whether another app is using it.',
  UNAVAILABLE: 'Windows background voice could not start. Use the browser voice window instead.',
};
function wakeText(value) {
  const match = String(value || '').trim().match(/^(?:(?:hey|হেই|আচ্ছা)\s+)?(?:nova\b|নোভা|নভা)(?=$|[\s,।.!?:-])[\s,।.!?:-]*([\s\S]*)$/i);
  return match ? match[1].trim() : null;
}
function speechText(value, language) {
  let text = String(value || '').replace(/https?:\/\/\S+/gi, '').replace(/\[(?:N|Q)\d+\]/gi, '').replace(/[|*#•]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length > 650) { const part = text.slice(0, 650), end = Math.max(part.lastIndexOf('।'), part.lastIndexOf('.'), part.lastIndexOf('?'), part.lastIndexOf('!')); text = end > 200 ? part.slice(0, end + 1) : part.slice(0, Math.max(1, part.lastIndexOf(' '))) + '…'; }
  return text || (language === 'bn-BD' ? 'উত্তর বলা সম্ভব হয়নি।' : 'I could not read that reply aloud.');
}
function createNativeVoice({ onUtterance, sessionActive, spawnChild = spawn, platform = process.platform, systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT, readyMs = 15000, stopMs = 7000, sessionCheckMs = 10000 } = {}) {
  if (typeof onUtterance !== 'function' || typeof sessionActive !== 'function') throw new Error('Native voice requires owner session checks.');
  let current = null, lastError = null;
  const supported = () => platform === 'win32';
  const status = workspace => {
    if (current && current.workspace === workspace) return { state: current.phase, language: current.language };
    return { state: 'off', language: null, ...(lastError?.workspace === workspace ? { error: lastError.message } : {}) };
  };
  const stillValid = entry => { try { return current === entry && !entry.stopped && sessionActive(entry.workspace, entry.sessionHash); } catch { return false; } };
  function finish(entry) {
    if (entry.finished) return; entry.finished = true; clearTimeout(entry.startTimer); clearTimeout(entry.killTimer); clearInterval(entry.checkTimer);
    if (current === entry) current = null;
    if (!entry.started && entry.resolveStart) { entry.resolveStart({ ok: false, error: entry.error || errors.UNAVAILABLE }); entry.resolveStart = null; }
  }
  function stop(workspace) {
    const entry = current;
    if (!entry || (workspace && entry.workspace !== workspace) || entry.stopped) return false;
    entry.stopped = true; entry.phase = 'stopping';
    try { entry.child.stdin.write(JSON.stringify({ type: 'stop' }) + '\n'); entry.child.stdin.end(); } catch { try { entry.child.kill(); } catch {} }
    entry.killTimer = setTimeout(() => { try { entry.child.kill(); } catch {} }, stopMs); entry.killTimer.unref?.();
    return true;
  }
  function fail(entry, message) {
    if (current !== entry || entry.stopped) return;
    entry.error = message; lastError = { workspace: entry.workspace, message }; stop(entry.workspace);
    if (!entry.started && entry.resolveStart) { entry.resolveStart({ ok: false, error: message }); entry.resolveStart = null; }
  }
  function say(entry, value) {
    if (!stillValid(entry)) { stop(entry.workspace); return; }
    entry.phase = 'speaking';
    const text = speechText(value, entry.language);
    try { entry.child.stdin.write(JSON.stringify({ type: 'say', text64: Buffer.from(text, 'utf8').toString('base64') }) + '\n'); }
    catch { fail(entry, errors.UNAVAILABLE); }
  }
  async function heard(entry, event) {
    if (!stillValid(entry)) { stop(entry.workspace); return; }
    if (entry.phase !== 'listening') return;
    if (typeof event.text !== 'string' || event.text.length > 2000 || typeof event.confidence !== 'number' || !Number.isFinite(event.confidence) || event.confidence < 0.55 || event.confidence > 1) return say(entry, entry.language === 'bn-BD' ? 'অনুরোধটি বুঝতে পারিনি।' : 'I did not understand that request.');
    const text = wakeText(event.text);
    // The worker waits for a response after any wake; always release it even
    // if its transcript is rejected by this independent server-side filter.
    if (text === null || text.length > 1000) return say(entry, entry.language === 'bn-BD' ? 'অনুরোধটি বুঝতে পারিনি।' : 'I did not understand that request.');
    if (/^(?:stop listening|stop voice|শোনা বন্ধ করো|শোনা বন্ধ)[।.!]?$/i.test(text)) { stop(entry.workspace); return; }
    if (!text) return say(entry, entry.language === 'bn-BD' ? 'বলতে পারো, প্রতিবার নোভা বলে ডাকবে।' : 'I am listening. Say Nova before your request.');
    if (/(?:gsk_[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|\b(?:password|api[ -]?key|secret|token)\b|পাসওয়ার্ড|পাসওয়ার্ড)/i.test(text)) return say(entry, entry.language === 'bn-BD' ? 'অনুগ্রহ করে গোপন তথ্য বলে বা লিখে পাঠিও না।' : 'Please do not say passwords or secret keys aloud.');
    entry.recent = entry.recent.filter(t => Date.now() - t < 60000);
    if (entry.recent.length >= 10) return say(entry, entry.language === 'bn-BD' ? 'একটু পরে আবার বলো।' : 'Please wait a little before asking again.');
    entry.recent.push(Date.now()); entry.phase = 'thinking';
    try {
      const reply = await onUtterance({ workspace: entry.workspace, sessionHash: entry.sessionHash, language: entry.language, text, isActive: () => stillValid(entry) });
      if (stillValid(entry)) say(entry, reply);
    } catch {
      if (stillValid(entry)) say(entry, entry.language === 'bn-BD' ? 'এখন উত্তর দিতে পারছি না। পরে আবার চেষ্টা করো।' : 'I cannot answer right now. Please try again.');
    }
  }
  function onLine(entry, line) {
    let event; try { event = JSON.parse(line); } catch { return fail(entry, errors.UNAVAILABLE); }
    if (!event || typeof event !== 'object' || current !== entry || entry.stopped) return;
    if (event.type === 'ready' && !entry.started && event.language === entry.language) {
      if (!stillValid(entry)) return stop(entry.workspace);
      entry.started = true; entry.phase = 'listening'; clearTimeout(entry.startTimer);
      if (entry.resolveStart) { entry.resolveStart({ ok: true, state: 'listening', language: entry.language }); entry.resolveStart = null; }
    } else if (event.type === 'error') fail(entry, errors[event.code] || errors.UNAVAILABLE);
    else if (event.type === 'heard' && entry.started) void heard(entry, event);
    else if (event.type === 'turn-ready' && entry.started && entry.phase === 'speaking') entry.phase = 'listening';
    else if (event.type === 'stopped') stop(entry.workspace);
  }
  function start(workspace, sessionHash, language) {
    if (!supported() || !systemRoot) return Promise.resolve({ ok: false, error: 'Windows background voice is available only on this Windows PC.' });
    if (!['en-US', 'bn-BD'].includes(language)) return Promise.resolve({ ok: false, error: 'Choose a supported language.' });
    if (current) return Promise.resolve({ ok: false, error: 'A background voice session is already starting or running.' });
    if (!sessionActive(workspace, sessionHash)) return Promise.resolve({ ok: false, error: 'Owner session expired.' });
    let child;
    const env = {}; for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'PATH', 'Path', 'PATHEXT', 'COMSPEC', 'TEMP', 'TMP', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'LOCALAPPDATA', 'APPDATA']) if (process.env[key]) env[key] = process.env[key];
    try { child = spawnChild(path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), nativeVoiceArgs(language), { env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] }); }
    catch { return Promise.resolve({ ok: false, error: errors.UNAVAILABLE }); }
    const entry = { child, workspace, sessionHash, language, phase: 'starting', started: false, stopped: false, finished: false, recent: [], error: null };
    current = entry; lastError = null;
    const ready = new Promise(resolve => { entry.resolveStart = resolve; });
    const decoder = new StringDecoder('utf8'); let buffer = '';
    child.stdout.on('data', chunk => {
      buffer += decoder.write(chunk); if (buffer.length > 8192) { fail(entry, errors.UNAVAILABLE); return; }
      let at; while ((at = buffer.indexOf('\n')) !== -1) { const line = buffer.slice(0, at).trim(); buffer = buffer.slice(at + 1); if (line) onLine(entry, line); }
    });
    child.stdout.once('error', () => fail(entry, errors.UNAVAILABLE));
    child.stdin.on('error', () => { if (current === entry && !entry.stopped) fail(entry, errors.UNAVAILABLE); });
    child.once('error', () => { if (!entry.stopped) { entry.error = errors.UNAVAILABLE; lastError = { workspace, message: entry.error }; } finish(entry); });
    child.once('exit', () => { if (!entry.stopped && !entry.finished) { entry.error = entry.error || errors.UNAVAILABLE; lastError = { workspace, message: entry.error }; } finish(entry); });
    entry.startTimer = setTimeout(() => fail(entry, 'Windows background voice did not start in time.'), readyMs); entry.startTimer.unref?.();
    entry.checkTimer = setInterval(() => { if (!stillValid(entry)) stop(entry.workspace); }, sessionCheckMs); entry.checkTimer.unref?.();
    return ready;
  }
  return { start, stop, status, supported, close: () => stop() };
}
module.exports = { createNativeVoice, wakeText, speechText };
