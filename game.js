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
      .then(() => showScreen('screen-title'))
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
      showScreen('screen-title');
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
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    if (raw) persistentCollection = JSON.parse(raw);
  } catch (e) { persistentCollection = {}; }
}

function saveCollection() {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(persistentCollection));
}

function resetCollection() {
  persistentCollection = {};
  localStorage.removeItem(COLLECTION_KEY);
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
}

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (needsUnlock()) initLockScreen();
  renderTitleCollection();

  document.getElementById('btn-start').addEventListener('click', () => {
    getAudioCtx();
    startGame();
  });
  document.getElementById('btn-gameover-retry').addEventListener('click', startGame);
  document.getElementById('btn-win-restart').addEventListener('click', () => {
    renderTitleCollection(); // aggiorna collezione prima di tornare al titolo
    startGame();
  });
  document.getElementById('btn-reset-collection').addEventListener('click', () => {
    if (confirm('Sei sicuro? Tutti gli oggetti trovati verranno dimenticati.')) {
      resetCollection();
    }
  });
});

// ─── Game Flow ───────────────────────────────────────────────────────────────

function startGame() {
  clearTimer();
  // Ogni run parte con tutti gli oggetti già trovati in passato
  inventory = Object.values(persistentCollection).map(item => ({ ...item }));
  updateInventoryUI();
  questionCount = 0;
  currentQuestionId = gameStartQuestion;
  gameActive = true;
  loadQuestion(currentQuestionId);
}

function loadQuestion(id) {
  const q = gameQuestions[id];
  if (!q) { console.error('Domanda non trovata:', id); return; }
  showScreen('screen-game');
  questionCount++;
  const counter = document.getElementById('q-counter');
  if (counter) counter.textContent = 'Domanda ' + questionCount;
  if (q.removeItem) consumeItem(q.removeItem, q.removeItemMsg || null);
  renderQuestion(q);
  startTimer(q.timer);
}

function renderQuestion(q) {
  document.getElementById('question-text').textContent = q.text;

  // Riavvia l'animazione d'entrata del foglietto domanda
  const box = document.querySelector('.question-box');
  if (box) {
    box.classList.remove('enter');
    void box.offsetWidth;
    box.classList.add('enter');
  }

  const container = document.getElementById('options-container');
  container.innerHTML = '';

  const colors = ['btn-red', 'btn-green', 'btn-blue', 'btn-orange'];

  q.options.forEach((opt, i) => {
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

function showGameOver(reason) {
  const pool = reason === 'timeout' ? TIMEOUT_MESSAGES : GAMEOVER_MESSAGES;
  const msg = document.getElementById('gameover-message');
  if (msg) msg.textContent = pool[Math.floor(Math.random() * pool.length)];
  showScreen('screen-gameover');
}

function showWin() {
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
