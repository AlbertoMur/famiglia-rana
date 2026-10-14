// Avvia l'admin su http://127.0.0.1:5179 invece di aprirlo come file dal disco.
// Serve perché le mappe OpenStreetMap ("Dove eravamo?") rifiutano le pagine aperte come file.
// Funziona solo su questo computer (non è raggiungibile da fuori).
//
// Uso: doppio clic su admin.bat (la finestra va lasciata aperta mentre usi l'admin)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 5179;
const DIR = __dirname;
const URL_ADMIN = `http://127.0.0.1:${PORT}/admin.html`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// File che non devono mai essere serviti, nemmeno in locale
const BLOCKED = ['password.txt', '.deploy-hash'];

function openBrowser() {
  exec(`start "" "${URL_ADMIN}"`);
}

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch (e) { res.writeHead(400); return res.end(); }
  if (pathname === '/') pathname = '/admin.html';

  const file = path.normalize(path.join(DIR, pathname));
  const rel = path.relative(DIR, file);
  if (rel.startsWith('..') || path.isAbsolute(rel) || rel.split(path.sep)[0] === '.git' || BLOCKED.includes(rel)) {
    res.writeHead(403);
    return res.end('Vietato');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Non trovato');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store', // sempre l'ultima versione dei file
    });
    res.end(data);
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('L\'admin è già avviato: apro il browser.');
    openBrowser();
    setTimeout(() => process.exit(0), 500);
  } else {
    console.error(e);
    process.exit(1);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('── Bad News Quiz: admin ──\n');
  console.log('Admin:  ' + URL_ADMIN);
  console.log('Gioco:  http://127.0.0.1:' + PORT + '/index.html');
  console.log('\nLascia aperta questa finestra mentre usi l\'admin. Chiudila per spegnerlo.');
  if (!process.env.NO_BROWSER) openBrowser();
});
