// Password-protect the project .env so it can be shared as one file.
// Usage:
//   node tools/env-crypt.mjs encrypt <password>   -> writes .env.enc from .env
//   node tools/env-crypt.mjs decrypt <password>   -> writes .env from .env.enc
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const encPath = path.join(root, '.env.enc');
const [mode, password] = process.argv.slice(2);

if (!['encrypt', 'decrypt'].includes(mode) || !password) {
  console.error('Usage: node tools/env-crypt.mjs <encrypt|decrypt> <password>');
  process.exit(1);
}

const deriveKey = (salt) => scryptSync(password, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

if (mode === 'encrypt') {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(readFileSync(envPath)), cipher.final()]);
  const out = Buffer.concat([Buffer.from('ENVENC1'), salt, iv, cipher.getAuthTag(), data]);
  writeFileSync(encPath, out.toString('base64') + '\n');
  console.log('Wrote .env.enc');
} else {
  const buf = Buffer.from(readFileSync(encPath, 'utf8').trim(), 'base64');
  if (buf.subarray(0, 7).toString() !== 'ENVENC1') throw new Error('Not a .env.enc file.');
  const salt = buf.subarray(7, 23);
  const iv = buf.subarray(23, 35);
  const tag = buf.subarray(35, 51);
  const data = buf.subarray(51);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(salt), iv);
  decipher.setAuthTag(tag);
  let plain;
  try {
    plain = Buffer.concat([decipher.update(data), decipher.final()]);
  } catch {
    throw new Error('Wrong password or corrupted file.');
  }
  writeFileSync(envPath, plain);
  console.log('Wrote .env');
}
