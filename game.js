// Logica di gioco — The Impossible Quiz Anniversary Edition

// ─── Audio (Web Audio API) ──────────────────────────────────────────────────

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type, startTime, duration, gainVal = 0.3) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(gainVal, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playCorrect() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  playTone(523, 'sine', t, 0.15, 0.3);
  playTone(784, 'sine', t + 0.15, 0.25, 0.3);
}

function playWrong() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  playTone(300, 'sawtooth', t, 0.15, 0.25);
  playTone(200, 'sawtooth', t + 0.15, 0.25, 0.25);
}

function playGameOver() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  playTone(392, 'sine', t, 0.3, 0.3);
  playTone(349, 'sine', t + 0.3, 0.3, 0.3);
  playTone(294, 'sine', t + 0.6, 0.5, 0.3);
}

function playVictory() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  const notes = [523, 659, 784, 1047, 1318];
  notes.forEach((freq, i) => {
    playTone(freq, 'sine', t + i * 0.18, 0.3, 0.35);
  });
}

function playTick() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  playTone(880, 'square', t, 0.05, 0.1);
}

function playItemPickup() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  playTone(880, 'sine', t,       0.08, 0.2);
  playTone(1108,'sine', t + 0.09, 0.08, 0.2);
  playTone(1318,'sine', t + 0.18, 0.15, 0.25);
}

function playLocked() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  playTone(220, 'square', t, 0.1, 0.15);
}

// ─── Dati domande (localStorage ha priorità sul file statico) ────────────────

// Se c'è solo questions.enc.js questi restano vuoti finché non si sblocca con la password
let gameQuestions     = typeof QUESTIONS      !== 'undefined' ? QUESTIONS      : null;
let gameStartQuestion = typeof START_QUESTION !== 'undefined' ? START_QUESTION : null;
let gameItems         = typeof ITEMS          !== 'undefined' ? ITEMS          : {};

(function loadGameData() {
  try {
    const raw   = localStorage.getItem('badnews_admin_questions');
    const start = localStorage.getItem('badnews_admin_start');
    const items = localStorage.getItem('badnews_admin_items');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        gameQuestions     = parsed;
        gameStartQuestion = start || gameStartQuestion || Object.keys(parsed)[0];
      }
    }
    if (items) {
      const parsedItems = JSON.parse(items);
      if (parsedItems && typeof parsedItems === 'object') {
        gameItems = parsedItems;
      }
    }
  } catch (e) { /* fallback silenzioso */ }
})();

// Modalità test: index.html?test (pannello per saltare tra le domande)
// oppure index.html?test=q5 (parte subito da q5). Durante i test non si salva niente.
const TEST_PARAM = new URLSearchParams(location.search).get('test');
const testMode   = TEST_PARAM !== null;

// ─── Sblocco con password (questions.enc.js) ─────────────────────────────────

const UNLOCK_KEY = 'badnews_unlock';

function needsUnlock() {
  return !gameQuestions && typeof ENCRYPTED_DATA !== 'undefined';
}

// Deve restare identica a normalizePassword() in encrypt.js
function normalizePassword(p) {
  return String(p)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function b64ToBytes(s) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function decryptGameData(password) {
  const enc = ENCRYPTED_DATA;
  const { subtle } = window.crypto;
  const baseKey = await subtle.importKey('raw', new TextEncoder().encode(normalizePassword(password)), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBytes(enc.salt), iterations: enc.iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  // Con la password sbagliata AES-GCM lancia un errore
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(enc.iv) }, key, b64ToBytes(enc.data));
  const code = new TextDecoder().decode(plain);
  const data = new Function(code + '\nreturn { QUESTIONS, START_QUESTION, ITEMS: typeof ITEMS !== "undefined" ? ITEMS : {} };')();
  gameQuestions     = data.QUESTIONS;
  gameStartQuestion = data.START_QUESTION || Object.keys(data.QUESTIONS)[0];
  gameItems         = data.ITEMS;
}

function initLockScreen() {
  showScreen('screen-lock');
  document.getElementById('lock-hint').textContent = ENCRYPTED_DATA.hint || 'Password';

  const form  = document.getElementById('lock-form');
  const input = document.getElementById('lock-input');
  const error = document.getElementById('lock-error');
  const btn   = form.querySelector('button');

  // Se su questo telefono è già stato sbloccato, entra direttamente
  let saved = null;
  try { saved = localStorage.getItem(UNLOCK_KEY); } catch (e) {}
  if (saved) {
    decryptGameData(saved)
      .then(onGameDataReady)
      .catch(() => { try { localStorage.removeItem(UNLOCK_KEY); } catch (e) {} });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    error.textContent = '';
    try {
      await decryptGameData(input.value);
      try { localStorage.setItem(UNLOCK_KEY, input.value); } catch (e) {}
      playCorrect();
      onGameDataReady();
    } catch (err) {
      playWrong();
      error.textContent = 'Nope. Riprova 😏';
      form.classList.remove('animate-shake');
      void form.offsetWidth;
      form.classList.add('animate-shake');
      input.select();
    }
    btn.disabled = false;
  });
}

// ─── Collezione persistente (localStorage) ───────────────────────────────────

const COLLECTION_KEY = 'badnews_collection';

// { itemId: { id, name, emoji } } — sopravvive alle run e ai refresh
let persistentCollection = {};

function loadCollection() {
  if (testMode) return; // in test si parte puliti
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    if (raw) persistentCollection = JSON.parse(raw);
  } catch (e) { persistentCollection = {}; }
}

function saveCollection() {
  if (testMode) return;
  try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(persistentCollection)); } catch (e) {}
}

function resetCollection() {
  persistentCollection = {};
  if (!testMode) { try { localStorage.removeItem(COLLECTION_KEY); } catch (e) {} }
  renderTitleCollection();
}

function renderTitleCollection() {
  const el = document.getElementById('collection-display');
  if (!el) return;
  const found = Object.values(persistentCollection);
  if (found.length === 0) {
    el.innerHTML = '<span class="coll-empty">Nessun oggetto trovato ancora.</span>';
    return;
  }
  el.innerHTML = found.map(item =>
    `<span class="coll-item" title="${item.name}">${item.emoji}</span>`
  ).join('');
}

loadCollection();

// ─── State ──────────────────────────────────────────────────────────────────

let currentQuestionId = null;
let timerInterval     = null;
let timeLeft          = 0;
let gameActive        = false;
let inventory         = []; // oggetti disponibili in questa run
let questionCount     = 0;  // domande viste in questa run

function hasItem(itemId) {
  return inventory.some(i => i.id === itemId);
}

function grantItem(itemId, customMsg = null) {
  if (!itemId || hasItem(itemId)) return;
  const def = gameItems[itemId] || { id: itemId, name: itemId, emoji: '🎁' };

  // Gli occhiali aggiustati sostituiscono quelli rotti silenziosamente
  if (itemId === 'occhiali_aggiustati' && hasItem('occhiali_rotti')) {
    inventory = inventory.filter(i => i.id !== 'occhiali_rotti');
    delete persistentCollection['occhiali_rotti'];
    saveCollection();
  }

  // Aggiungi all'inventario della run corrente
  inventory.push(def);

  // Salva nella collezione persistente se è nuovo
  const isNew = !persistentCollection[itemId];
  persistentCollection[itemId] = def;
  saveCollection();

  playItemPickup();
  updateInventoryUI();
  showItemNotification(def, isNew, customMsg);

  const bar = document.getElementById('inventory-bar');
  if (bar) {
    bar.classList.add('inv-flash');
    setTimeout(() => bar.classList.remove('inv-flash'), 900);
  }
}

function useItem(itemId) {
  // Il jolly sparisce dall'inventario della run ma rimane nella collezione
  inventory = inventory.filter(i => i.id !== itemId);
  updateInventoryUI();
}

function consumeItem(itemId, message) {
  if (!hasItem(itemId)) return;
  const def = inventory.find(i => i.id === itemId);
  // Rimuovi da inventario run E dalla collezione persistente
  inventory = inventory.filter(i => i.id !== itemId);
  delete persistentCollection[itemId];
  saveCollection();
  updateInventoryUI();
  // Mostra il messaggio personalizzato (o uno di default)
  const msg = message || (def ? `${def.emoji} ${def.name} rimosso` : `${itemId} rimosso`);
  showItemConsumed(msg);
}

function showItemConsumed(msg) {
  const notif = document.getElementById('item-notification');
  if (!notif) return;
  notif.textContent = msg;
  notif.classList.add('show', 'consumed');
  setTimeout(() => notif.classList.remove('show', 'consumed'), 2800);
}

// ─── Screens ────────────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-title') updateCheckpointButtons();
}

// ─── Falò (checkpoint) ───────────────────────────────────────────────────────
// Una domanda con bonfire: true accende il falò. Se il giocatore perde riparte da
// lì con l'inventario che aveva in quel momento. Il falò resta salvato anche se
// si chiude la pagina, e si spegne quando si vince o si ricomincia da capo.

const CHECKPOINT_KEY = 'badnews_checkpoint';
let checkpoint = null;

if (!testMode) {
  try { checkpoint = JSON.parse(localStorage.getItem(CHECKPOINT_KEY)); } catch (e) { checkpoint = null; }
}

function validCheckpoint() {
  // Le domande potrebbero essere cambiate dopo un aggiornamento
  return checkpoint && gameQuestions && gameQuestions[checkpoint.questionId] ? checkpoint : null;
}

function saveCheckpoint(questionId) {
  checkpoint = {
    questionId,
    inventory: inventory.map(i => ({ ...i })),
    questionCount: questionCount - 1 // loadQuestion lo incrementa di nuovo
  };
  if (!testMode) { try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint)); } catch (e) {} }
}

function clearCheckpoint() {
  checkpoint = null;
  if (!testMode) { try { localStorage.removeItem(CHECKPOINT_KEY); } catch (e) {} }
}

// ─── Modalità test ───────────────────────────────────────────────────────────

// Domande pronte (subito, oppure dopo la password)
function onGameDataReady() {
  showScreen('screen-title');
  if (testMode) initTestMode();
}

function initTestMode() {
  if (document.getElementById('test-toggle')) return;

  const toggle = document.createElement('button');
  toggle.id = 'test-toggle';
  toggle.type = 'button';
  toggle.textContent = '🧪 TEST';

  const panel = document.createElement('div');
  panel.id = 'test-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <p class="test-title">🧪 Modalità test <small>— non viene salvato niente</small></p>
    <label class="test-label" for="test-question">Vai alla domanda</label>
    <select id="test-question"></select>
    <button type="button" class="test-go" id="test-go">▶ Vai</button>
    <p class="test-label">Oggetti in tasca</p>
    <div id="test-items"></div>
  `;
  document.body.append(toggle, panel);

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) refreshTestPanel();
  });
  document.getElementById('test-go').addEventListener('click', () => {
    panel.hidden = true;
    startTestAt(document.getElementById('test-question').value);
  });

  if (TEST_PARAM && gameQuestions && gameQuestions[TEST_PARAM]) startTestAt(TEST_PARAM);
}

function refreshTestPanel() {
  const sel = document.getElementById('test-question');
  sel.innerHTML = '';
  Object.entries(gameQuestions || {}).forEach(([id, q]) => {
    const tags = (q.bonfire ? '🔥' : '') + (q.chess ? '♟' : '') + (q.snowball ? '⛄' : '');
    const label = `${id} ${tags} — ${q.text.length > 38 ? q.text.slice(0, 36) + '…' : q.text}`;
    sel.appendChild(new Option(label, id, false, id === currentQuestionId));
  });

  const box = document.getElementById('test-items');
  box.innerHTML = '';
  Object.values(gameItems || {}).forEach(item => {
    const row = document.createElement('label');
    row.className = 'test-item';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = hasItem(item.id);
    check.addEventListener('change', () => {
      // Aggiunge/toglie in silenzio: vale dalla prossima domanda caricata (o con "Vai")
      if (check.checked) { if (!hasItem(item.id)) inventory.push({ ...item }); }
      else inventory = inventory.filter(i => i.id !== item.id);
      updateInventoryUI();
    });
    row.append(check, ` ${item.emoji} ${item.name}`);
    box.appendChild(row);
  });
}

function startTestAt(id) {
  if (!gameQuestions || !gameQuestions[id]) return;
  getAudioCtx();
  clearTimer();
  questionCount = 0;
  currentQuestionId = id; // serve a timer, jolly e pannello
  gameActive = true;
  loadQuestion(id);
}

function updateCheckpointButtons() {
  const has = !!validCheckpoint();
  document.getElementById('btn-start').textContent          = has ? 'CONTINUA 🔥' : 'INIZIA';
  document.getElementById('btn-gameover-retry').textContent = has ? 'RIPARTI DAL FALÒ 🔥' : 'RIPROVA';
  document.querySelectorAll('.btn-from-scratch').forEach(b => { b.style.display = has ? '' : 'none'; });
}

function playBonfire() {
  const t = getAudioCtx().currentTime;
  [196, 247, 294, 392].forEach((f, i) => playTone(f, 'triangle', t + i * 0.12, 1.2, 0.18));
}

function showBonfireLit(onDone) {
  const overlay = document.getElementById('bonfire-overlay');
  playBonfire();
  overlay.classList.add('show');
  setTimeout(() => {
    overlay.classList.remove('show');
    onDone();
  }, 2300);
}

function showNotice(msg) {
  const notif = document.getElementById('item-notification');
  if (!notif) return;
  notif.textContent = msg;
  notif.classList.remove('consumed');
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 2200);
}

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (needsUnlock()) initLockScreen();
  else if (testMode) initTestMode();
  renderTitleCollection();
  updateCheckpointButtons();

  // INIZIA / CONTINUA e RIPROVA / RIPARTI DAL FALÒ: dal falò se c'è
  document.getElementById('btn-start').addEventListener('click', () => {
    getAudioCtx();
    startGame(true);
  });
  document.getElementById('btn-gameover-retry').addEventListener('click', () => startGame(true));
  document.querySelectorAll('.btn-from-scratch').forEach(b => {
    b.addEventListener('click', () => { getAudioCtx(); startGame(false); });
  });
  document.getElementById('btn-win-restart').addEventListener('click', () => {
    renderTitleCollection(); // aggiorna collezione prima di tornare al titolo
    startGame(false);
  });
  document.getElementById('btn-reset-collection').addEventListener('click', () => {
    if (confirm('Sei sicuro? Verranno cancellati gli oggetti trovati e il falò: si ricomincia da zero.')) {
      resetCollection();
      clearCheckpoint();
      updateCheckpointButtons();
    }
  });
});

// ─── Game Flow ───────────────────────────────────────────────────────────────

function startGame(fromCheckpoint = false) {
  clearTimer();
  const cp = fromCheckpoint ? validCheckpoint() : null;

  if (cp) {
    // Si riparte dal falò con l'inventario di quel momento
    inventory = cp.inventory.map(item => ({ ...item }));
    questionCount = cp.questionCount;
    currentQuestionId = cp.questionId;
  } else {
    clearCheckpoint();
    // Ogni run parte con tutti gli oggetti già trovati in passato
    inventory = Object.values(persistentCollection).map(item => ({ ...item }));
    questionCount = 0;
    currentQuestionId = gameStartQuestion;
  }

  updateInventoryUI();
  gameActive = true;
  loadQuestion(currentQuestionId);
  if (cp) showNotice('🔥 Riparti dal falò');
}

function loadQuestion(id) {
  const q = gameQuestions[id];
  if (!q) { console.error('Domanda non trovata:', id); return; }
  if (typeof stopSnowball === 'function') stopSnowball();
  if (typeof destroyMapGame === 'function') destroyMapGame();
  if (typeof destroyYatzy === 'function') destroyYatzy();
  showScreen('screen-game');
  questionCount++;

  // Falò: si accende la prima volta che ci si arriva (snapshot prima di eventuali rimozioni)
  const newlyLit = q.bonfire && (!checkpoint || checkpoint.questionId !== id);
  if (q.bonfire) saveCheckpoint(id);

  const counter = document.getElementById('q-counter');
  if (counter) counter.textContent = 'Domanda ' + questionCount + (checkpoint ? ' · 🔥' : '');

  if (q.removeItem) consumeItem(q.removeItem, q.removeItemMsg || null);

  // Minigioco palle di neve: niente timer, parte dopo l'eventuale schermata del falò
  if (q.snowball) {
    clearTimer();
    startSnowball(q, newlyLit);
    if (newlyLit) showBonfireLit(snowballBegin);
    return;
  }

  renderQuestion(q);

  // Yatzy: niente timer, una partita dura qualche minuto
  const timed = !q.yatzy;
  document.getElementById('game-wrapper').classList.toggle('no-timer', !timed);
  if (!timed) {
    clearTimer();
    if (newlyLit) showBonfireLit(() => {});
    return;
  }

  if (newlyLit) showBonfireLit(() => { if (gameActive) startTimer(q.timer); });
  else startTimer(q.timer);
}

function renderQuestion(q) {
  renderQuestionText(q);

  // Riavvia l'animazione d'entrata del foglietto domanda
  const box = document.querySelector('.question-box');
  if (box) {
    box.classList.remove('enter');
    void box.offsetWidth;
    box.classList.add('enter');
  }

  if (q.chess) {
    renderChessPuzzle(q);
    renderJollyButton(q);
    return;
  }

  if (q.ordering) {
    renderOrderGame(q);
    renderJollyButton(q);
    return;
  }

  if (q.map) {
    renderMapGame(q);
    renderJollyButton(q);
    return;
  }

  if (q.yatzy) {
    renderYatzyGame(q);
    renderJollyButton(q);
    return;
  }

  const container = document.getElementById('options-container');
  container.innerHTML = '';

  const colors = ['btn-red', 'btn-green', 'btn-blue', 'btn-orange'];

  // La risposta nascosta non è un bottone: si tocca nel testo della domanda
  q.options.filter(o => !o.hidden).forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn ' + (colors[i] || 'btn-red');

    const locked   = opt.requiresItem && !hasItem(opt.requiresItem);
    const unlocked = opt.requiresItem &&  hasItem(opt.requiresItem); // era bloccata, ora no

    if (locked) {
      const itemDef = gameItems[opt.requiresItem];
      const emoji   = itemDef ? itemDef.emoji : '🔒';
      btn.classList.add('option-locked');
      btn.innerHTML = `<span class="lock-icon">${emoji}</span>${opt.text}`;
      btn.addEventListener('click', () => handleLockedClick(btn, itemDef));
    } else {
      if (unlocked) {
        // Opzione sbloccata dall'oggetto: bordo dorato + emoji oggetto in cima
        const itemDef = gameItems[opt.requiresItem];
        const emoji   = itemDef ? itemDef.emoji : '✨';
        btn.classList.add('option-unlocked');
        btn.innerHTML = `<span class="unlock-badge">${emoji} SBLOCCATO</span>${opt.text}`;
      } else {
        btn.textContent = opt.text;
      }
      btn.addEventListener('click', () => handleAnswer(opt, btn));
    }

    container.appendChild(btn);
  });

  // Jolly: mostra pulsante "Usa Jolly" se lo si ha
  renderJollyButton(q);
}

// ─── Risposta nascosta (omaggio all'Impossible Quiz) ─────────────────────────
// Una parola del testo è toccabile: sembra identica alle altre, ma è la risposta giusta.

function renderQuestionText(q) {
  const el = document.getElementById('question-text');
  el.textContent = q.text;

  const hidden = q.options && q.options.find(o => o.hidden);
  if (!hidden) return;

  const idx = q.text.toLowerCase().indexOf(hidden.text.toLowerCase());
  if (idx === -1) return;

  const word = document.createElement('span');
  word.className = 'hidden-answer';
  word.textContent = q.text.slice(idx, idx + hidden.text.length);
  word.addEventListener('click', () => {
    if (!gameActive) return;
    word.classList.add('found');
    handleAnswer(hidden, word);
  });

  el.textContent = '';
  el.append(q.text.slice(0, idx), word, q.text.slice(idx + hidden.text.length));
}

// ─── Puzzle di scacchi ───────────────────────────────────────────────────────
// Il giocatore muove sulla scacchiera; l'avversario risponde da solo.
// Mossa diversa dalla soluzione = game over. All'ultima mossa vale qualsiasi matto.

const PIECE_GLYPHS = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

let chessGame     = null;   // istanza chess.js
let chessQuestion = null;
let chessPlayer   = 'w';    // colore di chi risolve
let chessStep     = 0;      // indice in chess.moves
let chessSelected = null;   // casa selezionata
let chessLastMove = null;
let chessBusy     = false;  // l'avversario sta rispondendo

function sanEquals(a, b) {
  const clean = s => String(s).replace(/[+#!?]/g, '');
  return clean(a) === clean(b);
}

function renderChessPuzzle(q) {
  const container = document.getElementById('options-container');
  container.innerHTML = '';

  if (typeof Chess === 'undefined') {
    container.innerHTML = '<p class="chess-info">Scacchiera non disponibile: controlla la connessione e ricarica.</p>';
    return;
  }

  chessQuestion = q;
  chessGame     = new Chess(q.chess.fen);
  chessPlayer   = chessGame.turn();
  chessStep     = 0;
  chessSelected = null;
  chessLastMove = null;
  chessBusy     = false;

  const n = Math.ceil(q.chess.moves.length / 2);
  const wrap = document.createElement('div');
  wrap.className = 'chess-wrap';
  wrap.innerHTML = `
    <p class="chess-info" id="chess-info">Muove il ${chessPlayer === 'w' ? 'bianco' : 'nero'} · matto in ${n}</p>
    <div class="chess-board" id="chess-board"></div>
  `;
  container.appendChild(wrap);

  document.getElementById('chess-board').addEventListener('click', (e) => {
    const sq = e.target.closest('.sq');
    if (sq) onChessSquare(sq.dataset.sq);
  });

  drawChessBoard();
}

function drawChessBoard() {
  const board = document.getElementById('chess-board');
  if (!board) return;

  const files = 'abcdefgh';
  const flip = chessPlayer === 'b'; // la scacchiera è sempre dal lato di chi risolve
  const targets = chessSelected
    ? chessGame.moves({ square: chessSelected, verbose: true }).map(m => m.to)
    : [];

  let html = '';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const fileIdx = flip ? 7 - f : f;
      const rank = flip ? r + 1 : 8 - r;
      const sq = files[fileIdx] + rank;
      const piece = chessGame.get(sq);

      const cls = ['sq', (fileIdx + rank) % 2 === 1 ? 'dark' : 'light'];
      if (sq === chessSelected) cls.push('selected');
      if (chessLastMove && (sq === chessLastMove.from || sq === chessLastMove.to)) cls.push('last');
      if (targets.includes(sq)) cls.push(piece ? 'target capture' : 'target');

      const glyph = piece
        ? `<span class="pc ${piece.color === 'w' ? 'white' : 'black'}">${PIECE_GLYPHS[piece.type]}︎</span>`
        : '';
      const fileLabel = r === 7 ? `<span class="coord file">${files[fileIdx]}</span>` : '';
      const rankLabel = f === 0 ? `<span class="coord rank">${rank}</span>` : '';

      html += `<button type="button" class="${cls.join(' ')}" data-sq="${sq}" aria-label="${sq}">${glyph}${fileLabel}${rankLabel}</button>`;
    }
  }
  board.innerHTML = html;
}

function onChessSquare(sq) {
  if (!gameActive || chessBusy) return;

  if (chessSelected) {
    const move = chessGame.moves({ square: chessSelected, verbose: true }).find(m => m.to === sq);
    if (move) { playChessMove(move); return; }
  }

  const piece = chessGame.get(sq);
  chessSelected = (piece && piece.color === chessPlayer && sq !== chessSelected) ? sq : null;
  drawChessBoard();
}

function playChessMove(m) {
  const solution = chessQuestion.chess.moves;
  const expected = solution[chessStep];
  const isLast = chessStep === solution.length - 1;

  // Promozione: il pezzo indicato dalla soluzione, altrimenti donna
  const req = { from: m.from, to: m.to };
  if (m.flags.includes('p')) {
    const promo = String(expected).match(/=([QRBN])/i);
    req.promotion = promo ? promo[1].toLowerCase() : 'q';
  }

  const made = chessGame.move(req);
  chessSelected = null;
  chessLastMove = made;
  drawChessBoard();

  const correct = isLast ? chessGame.in_checkmate() : sanEquals(made.san, expected);
  if (!correct) { chessFail(); return; }

  chessStep++;
  if (chessStep >= solution.length) { chessSolved(); return; }

  // Risposta automatica dell'avversario
  playTone(660, 'sine', getAudioCtx().currentTime, 0.12, 0.2);
  chessBusy = true;
  setTimeout(() => {
    if (!gameActive) return; // tempo scaduto nel frattempo
    chessLastMove = chessGame.move(solution[chessStep]);
    chessStep++;
    chessBusy = false;
    drawChessBoard();
  }, 700);
}

function chessFail() {
  gameActive = false;
  clearTimer();
  playWrong();
  const board = document.getElementById('chess-board');
  if (board) board.classList.add('animate-shake');
  setTimeout(() => { playGameOver(); showGameOver('chess'); }, 900);
}

function chessSolved() {
  clearTimer();
  chessBusy = true;
  const board = document.getElementById('chess-board');
  const info = document.getElementById('chess-info');
  if (board) board.classList.add('mate');
  if (info) info.textContent = 'Scacco matto! ♚';

  const solvedOpt = chessQuestion.options.find(o => o.correct);
  setTimeout(() => {
    if (solvedOpt) handleAnswer(solvedOpt, board);
    else { gameActive = false; showWin(); }
  }, 900);
}

// ─── Jolly ───────────────────────────────────────────────────────────────────

function renderJollyButton(q) {
  let jollyBtn = document.getElementById('btn-jolly');
  if (!jollyBtn) {
    jollyBtn = document.createElement('button');
    jollyBtn.id = 'btn-jolly';
    jollyBtn.className = 'btn-jolly';
    document.getElementById('game-wrapper').appendChild(jollyBtn);
  }

  if (hasItem('jolly')) {
    jollyBtn.style.display = 'block';
    jollyBtn.textContent = '⭐ Usa Jolly (salta questa domanda)';
    jollyBtn.onclick = () => useJolly(q);
  } else {
    jollyBtn.style.display = 'none';
  }
}

function useJolly(q) {
  if (!gameActive || !hasItem('jolly')) return;
  gameActive = false;
  clearTimer();
  disableAllButtons();
  useItem('jolly');

  // Segui il primo percorso corretto disponibile
  const firstCorrect = q.options.find(o => o.correct && (!o.requiresItem || hasItem(o.requiresItem)));
  if (!firstCorrect) { showWin(); return; }

  playCorrect();
  const jollyBtn = document.getElementById('btn-jolly');
  if (jollyBtn) jollyBtn.style.display = 'none';

  setTimeout(() => {
    if (firstCorrect.next) {
      currentQuestionId = firstCorrect.next;
      gameActive = true;
      loadQuestion(currentQuestionId);
    } else {
      showWin();
    }
  }, 600);
}

// ─── Risposta ────────────────────────────────────────────────────────────────

function handleAnswer(opt, btn) {
  if (!gameActive) return;

  // Percorso segreto: l'opzione sembra sbagliata ma con l'oggetto giusto porta altrove
  if (opt.secretItem && hasItem(opt.secretItem)) {
    gameActive = false;
    clearTimer();
    playCorrect();
    btn.classList.add('animate-bounce');
    disableAllButtons();
    if (opt.grantsItem) grantItem(opt.grantsItem, opt.grantsItemMsg || null);
    setTimeout(() => {
      if (opt.secretNext) {
        currentQuestionId = opt.secretNext;
        gameActive = true;
        loadQuestion(currentQuestionId);
      } else {
        showWin();
      }
    }, opt.grantsItem ? 1400 : 700);
    return;
  }

  gameActive = false;
  clearTimer();

  if (opt.correct) {
    playCorrect();
    btn.classList.add('animate-bounce');
    disableAllButtons();

    // Concede oggetto prima di navigare
    if (opt.grantsItem) grantItem(opt.grantsItem, opt.grantsItemMsg || null);

    setTimeout(() => {
      if (opt.next) {
        currentQuestionId = opt.next;
        gameActive = true;
        loadQuestion(currentQuestionId);
      } else {
        showWin();
      }
    }, opt.grantsItem ? 1400 : 700); // piccola pausa extra se c'è un item
  } else {
    playWrong();
    btn.classList.add('animate-shake');
    disableAllButtons();
    setTimeout(() => { playGameOver(); showGameOver(); }, 600);
  }
}

function handleLockedClick(btn, itemDef) {
  if (!gameActive) return;
  playLocked();
  btn.classList.add('animate-shake');
  setTimeout(() => btn.classList.remove('animate-shake'), 600);

  const msg = itemDef
    ? `Serve: ${itemDef.emoji} ${itemDef.name}`
    : 'Oggetto mancante!';
  showToast(msg);
}

function disableAllButtons() {
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
  const jollyBtn = document.getElementById('btn-jolly');
  if (jollyBtn) jollyBtn.disabled = true;
}

// ─── Inventario UI ───────────────────────────────────────────────────────────

function updateInventoryUI() {
  const bar = document.getElementById('inventory-bar');
  if (!bar) return;

  if (inventory.length === 0) {
    bar.classList.remove('visible');
    bar.innerHTML = '';
  } else {
    bar.classList.add('visible');
    bar.innerHTML = inventory.map(item =>
      `<span class="inv-item" title="${item.name}">${item.emoji} <span class="inv-name">${item.name}</span></span>`
    ).join('');
  }

  updateVisionEffect();
}

function updateVisionEffect() {
  const wrapper = document.getElementById('game-wrapper');
  if (!wrapper) return;
  if (hasItem('occhiali_rotti')) {
    wrapper.classList.add('vision-blur');
  } else {
    wrapper.classList.remove('vision-blur');
  }
}

function showItemNotification(item, isNew = true, customMsg = null) {
  const notif = document.getElementById('item-notification');
  if (!notif) return;
  notif.textContent = customMsg
    ? `${item.emoji} ${customMsg}`
    : isNew
      ? `${item.emoji} Nuovo oggetto: ${item.name}!`
      : `${item.emoji} Hai di nuovo: ${item.name}`;
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 2400);
}

function showToast(msg) {
  const t = document.getElementById('game-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function startTimer(seconds) {
  clearTimer();
  timeLeft = seconds;
  updateTimerUI();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 10 && timeLeft > 0) playTick();
    if (timeLeft <= 0) {
      clearTimer();
      gameActive = false;
      disableAllButtons();
      playGameOver();
      setTimeout(() => showGameOver('timeout'), 400);
    }
  }, 1000);
}

function clearTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerUI() {
  const bar   = document.getElementById('timer-bar');
  const label = document.getElementById('timer-label');
  const q     = gameQuestions[currentQuestionId];
  if (!q || !bar) return;

  const pct = (timeLeft / q.timer) * 100;
  bar.style.width = pct + '%';
  label.textContent = timeLeft + 's';

  bar.classList.remove('timer-green', 'timer-yellow', 'timer-red');
  if (pct > 50)      bar.classList.add('timer-green');
  else if (pct > 20) bar.classList.add('timer-yellow');
  else               bar.classList.add('timer-red');
}

// ─── Schermate ───────────────────────────────────────────────────────────────

const GAMEOVER_MESSAGES = [
  'Ahia. Questa me la segno.',
  'Sicuro sicuro? Perché io no.',
  'Ne riparliamo a cena.',
  'Sbagliato. Ti voglio bene lo stesso. Credo.',
  'Stanotte il divano ti aspetta.',
  'Ok, ricominciamo e facciamo finta di niente.',
  'Questa risposta finisce dritta nel diario.'
];

const TIMEOUT_MESSAGES = [
  'Tempo scaduto. Stavi pensando a me, vero?',
  'Il timer ha vinto. Di nuovo.',
  'Hai riflettuto così tanto che è finito il tempo.'
];

const CHESS_MESSAGES = [
  'Mossa sbagliata. Da qualche parte un grande maestro piange.',
  'Bella mossa. Per l\'avversario.',
  'Scacco matto… ma a te.'
];

const SNOWBALL_MESSAGES = [
  'Pupazzo di neve: 1. Tu: 0.',
  'Colpito e affondato. Serve più allenamento.',
  'Hai preso più palle di neve che decisioni giuste.'
];

const ORDER_MESSAGES = [
  'I gusti non si discutono. Questo ordine sì.',
  'Ordine sbagliato. Lo chef è offeso.',
  'Nemmeno a una cena di gala sbaglierebbero così.'
];

const MAP_MESSAGES = [
  'Fuori strada. Di parecchio.',
  'Eppure c\'eri anche tu!',
  'Il navigatore ricalcola il percorso… dall\'inizio.'
];

const YATZY_MESSAGES = [
  'I dadi non mentono. Purtroppo.',
  'Hai lanciato tanto e segnato poco.',
  'La fortuna è cieca, ma la sfortuna ci vede benissimo.'
];

function showGameOver(reason) {
  if (typeof stopSnowball === 'function') stopSnowball();
  if (typeof destroyYatzy === 'function') destroyYatzy();
  const pool = reason === 'timeout'  ? TIMEOUT_MESSAGES
             : reason === 'chess'    ? CHESS_MESSAGES
             : reason === 'snowball' ? SNOWBALL_MESSAGES
             : reason === 'order'    ? ORDER_MESSAGES
             : reason === 'map'      ? MAP_MESSAGES
             : reason === 'yatzy'    ? YATZY_MESSAGES
             : GAMEOVER_MESSAGES;
  const msg = document.getElementById('gameover-message');
  if (msg) msg.textContent = pool[Math.floor(Math.random() * pool.length)];
  updateCheckpointButtons();
  showScreen('screen-gameover');
}

function showWin() {
  if (typeof stopSnowball === 'function') stopSnowball();
  clearCheckpoint(); // partita finita: il falò si spegne
  playVictory();
  // Personalizza messaggio vittoria se si ha la lettera segreta
  const winMsg = document.getElementById('win-message');
  if (winMsg) {
    if (hasItem('lettera')) {
      winMsg.textContent = 'Hai trovato la lettera segreta e completato il percorso del cuore. Sei arrivato fino in fondo — proprio come nella vita reale. Buon anniversario! 💌';
    } else {
      winMsg.textContent = 'Lo sapevo che ci conoscevi bene. Grazie per esserci — ogni giorno con te è un\'avventura. Buon anniversario! 🎉';
    }
  }
  showScreen('screen-win');
  launchConfetti();
}

// ─── Confetti ────────────────────────────────────────────────────────────────

function launchConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#f7c6c7','#c9e7c4','#c6dcf2','#fbe7a1','#f39a86','#e9b52f','#fdf8ec'];
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left            = Math.random() * 100 + 'vw';
    piece.style.background      = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay  = (Math.random() * 3) + 's';
    piece.style.animationDuration = (2.5 + Math.random() * 2) + 's';
    piece.style.width           = (8 + Math.random() * 8) + 'px';
    piece.style.height          = (8 + Math.random() * 8) + 'px';
    piece.style.borderRadius    = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(piece);
  }
}
