'use strict';
// Project outputs are always created as new files in a workspace-specific folder.
// There is deliberately no overwriting, deleting, package installation or shell.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rootFor(dataDir, workspaceId) {
  if (!UUID.test(workspaceId)) throw new Error('Invalid workspace.');
  return path.join(dataDir, 'projects', workspaceId);
}
async function saveWebsite(dataDir, workspaceId, brief, html) {
  const root = rootFor(dataDir, workspaceId);
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const id = crypto.randomUUID();
  const folder = path.join(root, id);
  await fs.mkdir(folder, { mode: 0o700 });
  const metadata = { id, name: brief.replace(/\s+/g, ' ').trim().slice(0, 80), createdAt: Date.now() };
  // A partially written project is not returned in the listing (metadata is last).
  await fs.writeFile(path.join(folder, 'index.html'), html, { flag: 'wx', mode: 0o600 });
  await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(metadata), { flag: 'wx', mode: 0o600 });
  return metadata;
}
async function listWebsites(dataDir, workspaceId) {
  const root = rootFor(dataDir, workspaceId);
  let entries; try { entries = await fs.readdir(root, { withFileTypes: true }); } catch (err) { if (err.code === 'ENOENT') return []; throw err; }
  const projects = await Promise.all(entries.filter(e => e.isDirectory() && UUID.test(e.name)).map(async e => {
    try {
      const p = JSON.parse(await fs.readFile(path.join(root, e.name, 'project.json'), 'utf8'));
      return p.id === e.name && typeof p.name === 'string' && Number.isFinite(p.createdAt) ? { id: p.id, name: p.name.slice(0, 80), createdAt: p.createdAt } : null;
    } catch { return null; }
  }));
  return projects.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
}
async function readWebsite(dataDir, workspaceId, projectId) {
  if (!UUID.test(projectId)) return null;
  const root = rootFor(dataDir, workspaceId);
  try {
    // Refuse directory/file symlinks rather than following them outside the workspace.
    const folder = path.join(root, projectId), file = path.join(folder, 'index.html');
    if (!(await fs.lstat(folder)).isDirectory() || !(await fs.lstat(file)).isFile()) return null;
    const [metadata, html] = await Promise.all([fs.readFile(path.join(folder, 'project.json'), 'utf8'), fs.readFile(file, 'utf8')]);
    const project = JSON.parse(metadata);
    if (project.id !== projectId || typeof project.name !== 'string' || !Number.isFinite(project.createdAt) || html.length > 200000) return null;
    return { project: { id: project.id, name: project.name.slice(0, 80), createdAt: project.createdAt }, html };
  } catch (err) { if (['ENOENT', 'ENOTDIR'].includes(err.code) || err instanceof SyntaxError) return null; throw err; }
}
module.exports = { saveWebsite, listWebsites, readWebsite };
