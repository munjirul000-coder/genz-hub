'use strict';
// This catalog is shared by the server and the Windows agent. The agent never
// receives a shell command, executable path, or arbitrary URL from a browser.
const CATALOG = Object.freeze({
  open_google: { label: 'Open Google', detail: 'Opens Google Search in your default browser.', icon: 'globe', group: 'Web' },
  open_google_maps: { label: 'Open Google Maps', detail: 'Opens Google Maps in your default browser.', icon: 'globe', group: 'Web' },
  open_gmail: { label: 'Open Gmail', detail: 'Opens Gmail; NOVA does not read or send mail.', icon: 'message', group: 'Web' },
  open_google_calendar: { label: 'Open Google Calendar', detail: 'Opens Google Calendar; NOVA does not read or edit events.', icon: 'calendar', group: 'Web' },
  open_github: { label: 'Open GitHub', detail: 'Opens GitHub in your default browser.', icon: 'link', group: 'Web' },
  open_wikipedia: { label: 'Open Wikipedia', detail: 'Opens Wikipedia in your default browser.', icon: 'globe', group: 'Web' },
  open_paint: { label: 'Open Paint', detail: 'Launches Windows Paint.', icon: 'edit', group: 'Apps' },
  open_task_manager: { label: 'Open Task Manager', detail: 'Launches Windows Task Manager; NOVA will not stop processes.', icon: 'activity', group: 'Apps' },
  open_onscreen_keyboard: { label: 'Open On-Screen Keyboard', detail: 'Launches Windows On-Screen Keyboard.', icon: 'grid', group: 'Apps' },
  open_youtube: { label: 'Open YouTube', detail: 'Opens youtube.com in your default browser.', icon: 'play', group: 'Web' },
  open_spotify: { label: 'Open Spotify', detail: 'Opens the Spotify web player. Playback stays in your control.', icon: 'music', group: 'Web' },
  open_whatsapp: { label: 'Open WhatsApp', detail: 'Opens WhatsApp Web. NOVA never sends a message automatically.', icon: 'message', group: 'Web' },
  open_notepad: { label: 'Open Notepad', detail: 'Launches a new, empty Windows Notepad window.', icon: 'note', group: 'Apps' },
  open_calculator: { label: 'Open Calculator', detail: 'Launches the Windows Calculator app.', icon: 'grid', group: 'Apps' },
  open_explorer: { label: 'Open Downloads', detail: 'Opens your Windows Downloads folder. Read-only navigation.', icon: 'folder', group: 'Apps' },
  system_info: { label: 'System information', detail: 'Reads OS, CPU, memory and uptime from the connected agent.', icon: 'cpu', group: 'System' },
  keyboard_type: { label: 'Type in Notepad', detail: 'Types the approved text only when Notepad is the active window. Text is stored in action history.', icon: 'note', group: 'Keyboard' },
  mouse_move: { label: 'Move mouse pointer', detail: 'Moves the pointer to the specified screen coordinates. This action does not use the screen viewer.', icon: 'monitor', group: 'Mouse' },
  mouse_click: { label: 'Left click mouse', detail: 'Moves and clicks the specified screen coordinates. A click may trigger a destructive action: check your screen first.', icon: 'monitor', group: 'Mouse' },
  whatsapp_draft: { label: 'Open WhatsApp draft', detail: 'Opens a draft in WhatsApp. You must press Send yourself.', icon: 'message', group: 'Web' },
});

function validateAction(kind, params = {}) {
  if (!Object.prototype.hasOwnProperty.call(CATALOG, kind)) return { error: 'This action is not in the safety allowlist.' };
  if (!params || typeof params !== 'object' || Array.isArray(params)) return { error: 'Invalid action parameters.' };
  if (kind === 'keyboard_type') {
    const text = params.text;
    if (Object.keys(params).join(',') !== 'text' || typeof text !== 'string' || !text.trim() || text.length > 300 || /[\x00-\x1f\x7f]/.test(text) || /(?:gsk_[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})/.test(text)) return { error: 'Use 1–300 characters of single-line text. Never type passwords or API keys.' };
    return { params: { text } };
  }
  if (kind === 'mouse_move' || kind === 'mouse_click') {
    if (Object.keys(params).sort().join(',') !== 'x,y' || !Number.isInteger(params.x) || !Number.isInteger(params.y) || params.x < -32768 || params.x > 32767 || params.y < -32768 || params.y > 32767) return { error: 'Mouse coordinates must be whole numbers between -32768 and 32767.' };
    return { params: { x: params.x, y: params.y } };
  }
  if (kind === 'whatsapp_draft') {
    const phone = String(params.phone || '').replace(/[\s()-]/g, '');
    const text = String(params.text || '').trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) return { error: 'Use an international phone number, for example +8801XXXXXXXXX.' };
    if (!text || text.length > 500) return { error: 'Draft text must contain 1–500 characters.' };
    return { params: { phone, text } };
  }
  if (Object.keys(params).length) return { error: 'This action does not accept custom parameters.' };
  return { params: {} };
}
module.exports = { CATALOG, validateAction };
