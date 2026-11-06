'use strict';
// Loaded only by the isolated voice integration test server. No network or keys.
const realFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  if (!String(url).startsWith('https://api.groq.com/openai/v1/chat/completions')) return realFetch(url, options);
  const messages = JSON.parse(options.body).messages;
  if (messages.length === 1) return Response.json({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] });
  const all = JSON.stringify(messages);
  if (all.includes('SLOW_FIXTURE')) await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 20000);
    options.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
  });
  const revision = all.includes('This is a revision');
  const instruction = messages[1].content;
  let content;
  if (instruction.includes('Return a complete HTML')) content = '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1>' + (revision ? 'Revised bakery' : 'Original bakery') + '</h1><script src="app.js" defer></script></body></html>';
  else if (instruction.includes('styles.css')) content = 'body { color: blue; }';
  else content = 'document.body.dataset.ready = "yes";';
  return Response.json({ choices: [{ message: { content }, finish_reason: 'stop' }] });
};
