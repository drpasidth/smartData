// Make sure .env has every secret the server needs. Missing or placeholder
// values are generated randomly and appended to .env.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

if (!existsSync(envPath)) {
  console.error('.env not found.');
  process.exit(1);
}

const required = ['SESSION_SECRET', 'ENCRYPTION_KEY', 'ADMIN_SETUP_KEY'];
let text = readFileSync(envPath, 'utf8');
const added = [];

for (const key of required) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  const value = match ? match[1].trim() : '';
  if (value && !value.startsWith('replace-with')) continue;
  const secret = randomBytes(48).toString('base64url');
  if (match) text = text.replace(match[0], `${key}=${secret}`);
  else text = text.replace(/\s*$/, '\n') + `${key}=${secret}\n`;
  added.push(key);
}

if (added.length) {
  writeFileSync(envPath, text);
  console.log(`Generated missing values: ${added.join(', ')}`);
  if (added.includes('ENCRYPTION_KEY')) {
    console.warn('WARNING: a new ENCRYPTION_KEY was generated. Saved database credentials in data\\ cannot be decrypted with it.');
  }
} else {
  console.log('.env already has all required values.');
}
