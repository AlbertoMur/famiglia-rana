// Pubblica il gioco su GitHub Pages in un colpo solo:
//   1. prende l'export più recente delle domande (questions*.js qui o in Download)
//   2. lo cifra con la password di password.txt → questions.enc.js
//   3. controlla che non stia per finire online niente in chiaro
//   4. commit + push su GitHub
//
// Uso: doppio clic su deploy.bat   (oppure: node deploy.js ["messaggio commit"])

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { encryptQuestions, normalizePassword } = require('./encrypt.js');

const DIR           = __dirname;
const QFILE         = path.join(DIR, 'questions.js');
const ENC_FILE      = path.join(DIR, 'questions.enc.js');
const PASSWORD_FILE = path.join(DIR, 'password.txt');
const HASH_FILE     = path.join(DIR, '.deploy-hash');
const EXPORT_NAME   = /^questions( \(\d+\))?\.js$/i;   // questions.js, questions (5).js, ...

function git(args, inherit = false) {
  return execFileSync('git', args, {
    cwd: DIR,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
}

function fail(msg) {
  console.error('\n✘ ' + msg);
  process.exit(1);
}

// ── 1. Export più recente ─────────────────────────────────────────────────────

function findLatestExport() {
  const dirs = [DIR, path.join(os.homedir(), 'Downloads')];
  const found = [];
  for (const d of dirs) {
    let files = [];
    try { files = fs.readdirSync(d); } catch (e) { continue; }
    for (const f of files) {
      if (!EXPORT_NAME.test(f)) continue;
      const full = path.join(d, f);
      found.push({ full, mtime: fs.statSync(full).mtimeMs });
    }
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found[0] || null;
}

function describeQuestions(file) {
  const code = fs.readFileSync(file, 'utf8');
  let data;
  try {
    data = new Function(code + '\nreturn { QUESTIONS, START_QUESTION };')();
  } catch (e) {
    fail(`${path.basename(file)} non è un file domande valido (${e.message}).`);
  }
  const ids = Object.keys(data.QUESTIONS || {});
  if (ids.length === 0) fail(`${path.basename(file)} non contiene domande.`);
  const header = (code.match(/Generato da admin\.html — (.+)/) || [])[1] || 'data non indicata';
  const first = data.QUESTIONS[data.START_QUESTION] || data.QUESTIONS[ids[0]];
  return { count: ids.length, header, first: first.text };
}

// GitHub Pages fa tenere i file in cache per 10 minuti: se index.html è nuovo ma
// style.css è ancora quello vecchio la pagina si rompe. Aggiungo ?v=<hash del contenuto>
// ai link dei file pubblicati, così un file cambiato ha sempre un indirizzo nuovo.
const VERSIONED = ['style.css', 'game.js', 'snowball.js', 'order.js', 'map.js', 'yatzy.js', 'questions.enc.js',
                   'admin.css', 'admin.js', 'chess-puzzles.js', 'order-presets.js'];

function bustCache() {
  const changed = [];
  for (const page of ['index.html', 'admin.html']) {
    const pagePath = path.join(DIR, page);
    if (!fs.existsSync(pagePath)) continue;
    let html = fs.readFileSync(pagePath, 'utf8');
    const before = html;
    for (const file of VERSIONED) {
      const filePath = path.join(DIR, file);
      if (!fs.existsSync(filePath)) continue;
      const v = crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex').slice(0, 8);
      const escaped = file.replace(/\./g, '\\.');
      html = html.replace(new RegExp(`((?:src|href)=")${escaped}(\\?v=[0-9a-f]*)?"`, 'g'), `$1${file}?v=${v}"`);
    }
    if (html !== before) {
      fs.writeFileSync(pagePath, html);
      changed.push(page);
    }
  }
  return changed;
}

async function main() {
  console.log('── Bad News Quiz: pubblicazione ──\n');

  if (!fs.existsSync(path.join(DIR, '.git'))) fail('Questa cartella non è ancora un repository Git.');
  let remote = '';
  try { remote = git(['remote', 'get-url', 'origin']).trim(); } catch (e) {}
  if (!remote) fail('Nessun repository GitHub collegato (remote "origin" mancante).');

  const latest = findLatestExport();
  if (!latest) fail('Nessun questions.js trovato. Esporta le domande dall\'admin.');
  if (path.resolve(latest.full) !== path.resolve(QFILE)) {
    fs.copyFileSync(latest.full, QFILE);
    fs.utimesSync(QFILE, new Date(), new Date()); // Windows copia anche la data: la aggiorno
    console.log(`• Uso l'export più recente: ${latest.full}`);
  } else {
    console.log('• Uso questions.js della cartella');
  }

  const info = describeQuestions(QFILE);
  console.log(`  ${info.count} domande — export del ${info.header}`);
  console.log(`  Prima domanda: "${info.first}"\n`);

  // ── 2. Cifratura ──────────────────────────────────────────────────────────

  if (!fs.existsSync(PASSWORD_FILE)) fail('Manca password.txt (una riga con la password).');
  const password = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
  if (!password) fail('password.txt è vuoto.');

  // Ricifra solo se domande o password sono cambiate (ogni cifratura produce un file diverso)
  const hash = crypto.createHash('sha256')
    .update(fs.readFileSync(QFILE)).update('\0').update(normalizePassword(password))
    .digest('hex');
  let lastHash = '';
  try { lastHash = fs.readFileSync(HASH_FILE, 'utf8').trim(); } catch (e) {}

  if (hash !== lastHash || !fs.existsSync(ENC_FILE)) {
    await encryptQuestions(password, 'Password');
    fs.writeFileSync(HASH_FILE, hash);
    console.log('• Domande cifrate → questions.enc.js');
  } else {
    console.log('• Domande invariate, niente da cifrare');
  }

  // ── Versione nei link (evita che il browser usi CSS/JS vecchi dalla cache) ──

  const changedPages = bustCache();
  if (changedPages.length) console.log('• Aggiornate le versioni dei file in ' + changedPages.join(', '));

  // ── 3. Controllo di sicurezza + commit ────────────────────────────────────

  git(['add', '-A']);
  const staged = git(['diff', '--cached', '--name-only']).split('\n').map(s => s.trim()).filter(Boolean);
  const leaked = staged.filter(f => EXPORT_NAME.test(path.basename(f)) || path.basename(f) === 'password.txt');
  if (leaked.length) {
    git(['reset', '-q']);
    fail('Bloccato: stavano per essere pubblicati file in chiaro: ' + leaked.join(', '));
  }

  if (staged.length) {
    const msg = process.argv[2] || 'Aggiorna gioco — ' + new Date().toLocaleString('it-IT');
    git(['commit', '-q', '-m', msg]);
    console.log(`• Commit: ${staged.length} file (${staged.join(', ')})`);
  } else {
    console.log('• Nessuna modifica da salvare');
  }

  // ── 4. Push ───────────────────────────────────────────────────────────────

  console.log('• Invio a GitHub…\n');
  try {
    git(['push', '-u', 'origin', 'main'], true);
  } catch (e) {
    fail('Push non riuscito (vedi messaggio sopra).');
  }

  const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/i);
  console.log('\n✔ Fatto!');
  if (m) console.log(`  Il sito si aggiorna in 1-2 minuti: https://${m[1].toLowerCase()}.github.io/${m[2]}/`);
}

main().catch((e) => fail(e.message || String(e)));
