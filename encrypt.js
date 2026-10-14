// Cifra questions.js con una password → questions.enc.js
// È questo il file da pubblicare: senza password le domande non sono leggibili.
//
// Di solito non serve lanciarlo a mano: lo usa deploy.js.
// Uso manuale:  node encrypt.js
//
// La password non distingue maiuscole/minuscole, accenti e spazi doppi.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ITERATIONS = 250000;
const SRC = path.join(__dirname, 'questions.js');
const OUT = path.join(__dirname, 'questions.enc.js');

// Deve restare identica a normalizePassword() in game.js
function normalizePassword(p) {
  return String(p)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function encryptQuestions(password, hint = 'Password') {
  const pass = normalizePassword(password);
  if (!pass) throw new Error('La password non può essere vuota.');
  if (!fs.existsSync(SRC)) throw new Error('questions.js non trovato.');

  const { subtle } = globalThis.crypto;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));

  const baseKey = await subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const plain = new TextEncoder().encode(fs.readFileSync(SRC, 'utf8'));
  const data = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));

  const b64 = (u) => Buffer.from(u).toString('base64');
  const payload = { v: 1, hint, iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data) };

  fs.writeFileSync(OUT,
    '// Generato da encrypt.js — contenuto cifrato, non modificare a mano\n' +
    'const ENCRYPTED_DATA = ' + JSON.stringify(payload, null, 2) + ';\n'
  );
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (q) => { process.stdout.write(q); return ((await lines.next()).value || ''); };

  const hint = (await ask('Testo da mostrare all\'avvio (invio = "Password"): ')).trim() || 'Password';
  const pass = await ask('Password: ');
  rl.close();

  await encryptQuestions(pass, hint);
  console.log('\n✔ Creato questions.enc.js — pubblica questo, NON questions.js.');
}

module.exports = { encryptQuestions, normalizePassword };

if (require.main === module) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
