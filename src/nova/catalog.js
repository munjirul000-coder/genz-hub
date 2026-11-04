'use strict';
// This catalog is shared by the server and the Windows agent. The agent never
// receives a shell command, executable path, or arbitrary URL from a browser.
const CATALOG = Object.freeze({
  open_youtube: { label: 'Open YouTube', detail: 'Opens youtube.com in your default browser.', icon: 'play', group: 'Web' },
  open_spotify: { label: 'Open Spotify', detail: 'Opens the Spotify web player. Playback stays in your control.', icon: 'music', group: 'Web' },
  open_whatsapp: { label: 'Open WhatsApp', detail: 'Opens WhatsApp Web. NOVA never sends a message automatically.', icon: 'message', group: 'Web' },
  open_notepad: { label: 'Open Notepad', detail: 'Launches a new, empty Windows Notepad window.', icon: 'note', group: 'Apps' },
  open_calculator: { label: 'Open Calculator', detail: 'Launches the Windows Calculator app.', icon: 'grid', group: 'Apps' },
  open_explorer: { label: 'Open Downloads', detail: 'Opens your Windows Downloads folder. Read-only navigation.', icon: 'folder', group: 'Apps' },
  system_info: { label: 'System information', detail: 'Reads OS, CPU, memory and uptime from the connected agent.', icon: 'cpu', group: 'System' },
  whatsapp_draft: { label: 'Open WhatsApp draft', detail: 'Opens a draft in WhatsApp. You must press Send yourself.', icon: 'message', group: 'Web' },
});

function validateAction(kind, params = {}) {
  if (!Object.prototype.hasOwnProperty.call(CATALOG, kind)) return { error: 'This action is not in the safety allowlist.' };
  if (!params || typeof params !== 'object' || Array.isArray(params)) return { error: 'Invalid action parameters.' };
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
