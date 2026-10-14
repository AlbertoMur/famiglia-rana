// Minigioco "🎲 Yatzy" (domande con q.yatzy).
// Partita da soli contro un punteggio obiettivo (q.yatzy.target): 11 turni, in ognuno
// fino a 3 lanci. Si toccano i dadi da tenere, poi si sceglie la riga in cui segnare.
// Appena si raggiunge l'obiettivo si vince; se diventa impossibile raggiungerlo è Bad News.

const YZ_CATEGORIES = [
  { key: 'n1', face: 1, label: 'Uno',     max: 5 },
  { key: 'n2', face: 2, label: 'Due',     max: 10 },
  { key: 'n3', face: 3, label: 'Tre',     max: 15 },
  { key: 'n4', face: 4, label: 'Quattro', max: 20 },
  { key: 'n5', face: 5, label: 'Cinque',  max: 25 },
  { key: 'n6', face: 6, label: 'Sei',     max: 30 },
  { key: 'tris',  label: 'Tris',   hint: '3 uguali · somma', max: 30 },
  { key: 'poker', label: 'Poker',  hint: '4 uguali · somma', max: 30 },
  { key: 'full',  label: 'Full',   hint: '3 + 2 · 25',       max: 25 },
  { key: 'scala', label: 'Scala',  hint: '5 in fila · 40',   max: 40 },
  { key: 'yatzy', label: 'Yatzy!', hint: '5 uguali · 50',    max: 50 },
];
const YZ_ROUNDS = YZ_CATEGORIES.length;

// Posizioni dei puntini sul dado (griglia 3×3, indici 0..8)
const YZ_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

let yz = null; // partita in corso

const yzWait = (ms) => new Promise(r => setTimeout(r, ms));

function yzCounts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  dice.forEach(d => c[d]++);
  return c;
}

function yzScore(key, dice) {
  if (dice.some(d => !d)) return 0;
  const counts = yzCounts(dice);
  const sum = dice.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts);
  switch (key) {
    case 'tris':  return max >= 3 ? sum : 0;
    case 'poker': return max >= 4 ? sum : 0;
    case 'full':  return counts.includes(3) && counts.includes(2) ? 25 : 0;
    case 'scala': {
      const s = [...new Set(dice)].sort().join('');
      return s === '12345' || s === '23456' ? 40 : 0;
    }
    case 'yatzy': return max === 5 ? 50 : 0;
    default: {
      const face = Number(key.slice(1));
      return counts[face] * face;
    }
  }
}

function yzTotal() {
  return Object.values(yz.scores).reduce((a, b) => a + b, 0);
}

// Il massimo che si potrebbe ancora fare con le righe libere
function yzMaxRemaining() {
  return YZ_CATEGORIES.filter(c => yz.scores[c.key] === undefined).reduce((a, c) => a + c.max, 0);
}

function yzDieHtml(value) {
  if (!value) return '<span class="yz-empty">✦</span>';
  const on = YZ_PIPS[value];
  return '<span class="yz-pipgrid">' +
    Array.from({ length: 9 }, (_, i) => `<i class="${on.includes(i) ? 'on' : ''}"></i>`).join('') +
    '</span>';
}

// ─── Avvio / stop ────────────────────────────────────────────────────────────

function destroyYatzy() {
  yz = null; // un lancio in corso si accorge che la partita non c'è più
}

function renderYatzyGame(q) {
  const container = document.getElementById('options-container');
  container.innerHTML = '';

  yz = {
    id: Math.random(),
    q,
    target: (q.yatzy && q.yatzy.target) || 140,
    dice: [0, 0, 0, 0, 0],
    held: [false, false, false, false, false],
    rollsLeft: 3,
    round: 1,
    scores: {},
    busy: false,
    over: false,
  };

  const rows = YZ_CATEGORIES.map(c => `
    <tr data-key="${c.key}">
      <th><div class="yz-cat">
        ${c.face ? `<span class="yz-die mini">${yzDieHtml(c.face)}</span>` : ''}
        <span class="yz-label">${c.label}${c.hint ? `<small>${c.hint}</small>` : ''}</span>
      </div></th>
      <td class="yz-cell" data-key="${c.key}"></td>
    </tr>`).join('');

  const wrap = document.createElement('div');
  wrap.className = 'yz-wrap';
  wrap.innerHTML = `
    <div class="yz-goal">
      <div class="yz-goal-label"><span id="yz-round"></span><span>🎯 <b id="yz-total">0</b> / ${yz.target}</span></div>
      <div class="yz-goal-track"><div class="yz-goal-fill" id="yz-goal-fill"></div></div>
    </div>
    <div class="yz-dice" id="yz-dice">
      ${[0, 1, 2, 3, 4].map(i => `<button type="button" class="yz-die" data-i="${i}" aria-label="Dado ${i + 1}"></button>`).join('')}
    </div>
    <button type="button" class="btn-primary yz-roll" id="yz-roll">LANCIA <span id="yz-rolls"></span></button>
    <p class="yz-status" id="yz-status"></p>
    <table class="yz-table"><tbody>${rows}</tbody></table>
  `;
  container.appendChild(wrap);

  wrap.querySelector('#yz-dice').addEventListener('click', (e) => {
    const die = e.target.closest('.yz-die');
    if (!die || !yzCanAct() || yz.rollsLeft === 3 || yz.rollsLeft === 0) return;
    const i = Number(die.dataset.i);
    yz.held[i] = !yz.held[i];
    playTone(yz.held[i] ? 760 : 520, 'sine', getAudioCtx().currentTime, 0.05, 0.1);
    yzRender();
  });

  wrap.querySelector('#yz-roll').addEventListener('click', () => {
    if (yzCanAct() && yz.rollsLeft > 0) yzRoll();
  });

  wrap.querySelector('tbody').addEventListener('click', (e) => {
    const cell = e.target.closest('.yz-cell');
    if (!cell || !yzCanAct() || yz.rollsLeft === 3) return;
    if (yz.scores[cell.dataset.key] !== undefined) return;
    yzAssign(cell.dataset.key);
  });

  yzRender();
}

function yzCanAct() {
  return yz && gameActive && !yz.over && !yz.busy;
}

// ─── Disegno ─────────────────────────────────────────────────────────────────

function yzRender() {
  if (!yz) return;

  document.querySelectorAll('#yz-dice .yz-die').forEach((el, i) => {
    el.innerHTML = yzDieHtml(yz.dice[i]);
    el.classList.toggle('held', yz.held[i]);
  });

  document.getElementById('yz-roll').disabled = yz.busy || yz.over || yz.rollsLeft === 0;
  document.getElementById('yz-rolls').textContent = '●'.repeat(yz.rollsLeft) + '○'.repeat(3 - yz.rollsLeft);

  const total = yzTotal();
  document.getElementById('yz-round').textContent = `Turno ${Math.min(yz.round, YZ_ROUNDS)}/${YZ_ROUNDS}`;
  document.getElementById('yz-total').textContent = total;
  document.getElementById('yz-goal-fill').style.width = Math.min(100, total / yz.target * 100) + '%';

  // Nelle righe libere, dopo il primo lancio, si vedono i punti che si farebbero
  const preview = !yz.over && yz.rollsLeft < 3;
  document.querySelectorAll('.yz-table .yz-cell').forEach(cell => {
    const done = yz.scores[cell.dataset.key];
    cell.textContent = done !== undefined ? done : (preview ? yzScore(cell.dataset.key, yz.dice) : '');
    cell.classList.toggle('filled', done !== undefined);
    cell.classList.toggle('preview', done === undefined && preview);
    cell.closest('tr').classList.toggle('used', done !== undefined);
  });

  if (!yz.over) {
    document.getElementById('yz-status').textContent =
        yz.rollsLeft === 3 ? 'Lancia i dadi!'
      : yz.rollsLeft > 0   ? 'Tocca i dadi da tenere, rilancia o scegli una riga'
      : 'Scegli la riga in cui segnare';
  }
}

// ─── Lanci e punteggi ────────────────────────────────────────────────────────

async function yzRoll() {
  const id = yz.id;
  yz.busy = true;
  yz.rollsLeft--;
  const free = [0, 1, 2, 3, 4].filter(i => !yz.held[i]);
  document.querySelectorAll('#yz-dice .yz-die').forEach((el, i) => el.classList.toggle('rolling', free.includes(i)));
  playTone(300, 'triangle', getAudioCtx().currentTime, 0.08, 0.12);

  for (let t = 0; t < 6; t++) {
    free.forEach(i => { yz.dice[i] = 1 + Math.floor(Math.random() * 6); });
    yzRender();
    await yzWait(70);
    if (!yz || yz.id !== id) return;
  }
  document.querySelectorAll('#yz-dice .yz-die').forEach(el => el.classList.remove('rolling'));
  playTone(420, 'triangle', getAudioCtx().currentTime, 0.06, 0.12);
  yz.busy = false;
  yzRender();
}

function yzAssign(key) {
  const pts = yzScore(key, yz.dice);
  yz.scores[key] = pts;
  playTone(pts ? 880 : 240, 'sine', getAudioCtx().currentTime, 0.12, 0.15);

  const cell = document.querySelector(`.yz-table .yz-cell[data-key="${key}"]`);
  if (cell) { cell.classList.remove('flash'); void cell.offsetWidth; cell.classList.add('flash'); }

  const total = yzTotal();
  yz.round++;
  yz.dice = [0, 0, 0, 0, 0];
  yz.held = [false, false, false, false, false];
  yz.rollsLeft = 3;

  if (total >= yz.target) return yzEnd(true);
  if (total + yzMaxRemaining() < yz.target || yz.round > YZ_ROUNDS) return yzEnd(false);
  yzRender();
}

// ─── Fine partita ────────────────────────────────────────────────────────────

function yzEnd(won) {
  yz.over = true;
  yzRender();
  const total = yzTotal();
  const status = document.getElementById('yz-status');
  status.textContent = won
    ? `Obiettivo raggiunto: ${total} punti! 🎲`
    : (yz.round > YZ_ROUNDS ? `Finito con ${total} punti: ne servivano ${yz.target}…`
                            : `Non ci arrivi più: ${total} punti, ne servivano ${yz.target}…`);
  status.classList.add(won ? 'won' : 'lost');

  const id = yz.id;
  if (!won) playWrong();
  setTimeout(() => {
    if (!yz || yz.id !== id) return;
    if (won) {
      const opt = yz.q.options.find(o => o.correct);
      if (opt) handleAnswer(opt, document.querySelector('.yz-table'));
      else { gameActive = false; showWin(); }
    } else {
      gameActive = false;
      playGameOver();
      showGameOver('yatzy');
    }
  }, 2200);
}
