'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Local encryption key for API credentials saved through the NOVA UI.
// This protects credentials at rest in SQLite; it is not a substitute for
// securing the server itself. The key file lives in DATA_DIR and is git-ignored.
class Vault {
  constructor(dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'nova-vault.key');
    if (!fs.existsSync(this.file)) {
      fs.writeFileSync(this.file, crypto.randomBytes(32), { mode: 0o600 });
      try { fs.chmodSync(this.file, 0o600); } catch {}
    }
    this.key = fs.readFileSync(this.file);
    if (this.key.length !== 32) throw new Error('NOVA vault key is corrupt. Remove nova-vault.key and reconnect your AI provider.');
  }
  encrypt(text, aad = '') {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(String(aad)));
    const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    return { cipher: enc.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
  }
  decrypt(row, aad = '') {
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(row.iv, 'base64'));
    decipher.setAAD(Buffer.from(String(aad)));
    decipher.setAuthTag(Buffer.from(row.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(row.cipher, 'base64')), decipher.final()]).toString('utf8');
  }
}
module.exports = { Vault };
