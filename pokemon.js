// Minigioco "⚔️ Palestra" (domande con q.pokemon): lotte a turni in stile Pokémon Cristallo.
// Versione A: una serie di lotte contro gli allenatori della palestra, poi il capopalestra.
// La squadra è già fatta e i PS restano tra una lotta e l'altra (come in palestra);
// ci sono le pozioni nello zaino. Vincere dà la medaglia e si va avanti, perdere è game over.
//
// Lo schermo è quello del Game Boy: 160×144 "pixel", disegnato su canvas a 4×.
// Il motore della lotta (calcoli, IA) non tocca il DOM: lo usa anche la simulazione.
// I dati (creature, mosse, allenatori) arrivano dalla domanda (q.pokemon.data), che l'admin
// compone da pokemon-data.js.

const PK_W = 160, PK_H = 144, PK_SCALE = 4;
const PK_COLORS = { w: '#f8f8f8', k: '#181818' };
const PK_FONT = '8px "Press Start 2P", monospace';

// ─── Sprite ──────────────────────────────────────────────────────────────────

// Converte uno sprite fatto di forme in una griglia di colori (null = trasparente)
function pkRaster(def, palOverride) {
  const { w, h } = def;
  const pal = Object.assign({}, def.pal, palOverride || {});
  const grid = new Array(w * h).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) grid[y * w + x] = c; };

  for (const s of def.shapes) {
    const kind = s[0];
    if (kind === 'px') { set(s[1], s[2], s[3]); continue; }
    if (kind === 'l') {
      let [x0, y0, x1, y1] = s.slice(1, 5).map(Math.round);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        set(x0, y0, s[5]);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      continue;
    }

    // Forme piene: per ogni pixel "dentro" anche la posizione normalizzata (per l'ombra)
    let color, opts, test;
    if (kind === 'e') {
      const [, cx, cy, rx, ry, c, o] = s;
      color = c; opts = o || {};
      const cos = Math.cos(opts.rot || 0), sin = Math.sin(opts.rot || 0);
      test = (px, py) => {
        const dx = px - cx, dy = py - cy;
        const u = (dx * cos + dy * sin) / rx, v = (-dx * sin + dy * cos) / ry;
        return u * u + v * v <= 1 ? [u, v] : null;
      };
    } else if (kind === 'r') {
      const [, x, y, rw, rh, c, o] = s;
      color = c; opts = o || {};
      test = (px, py) => (px >= x && px < x + rw && py >= y && py < y + rh)
        ? [(px - x - rw / 2) / (rw / 2), (py - y - rh / 2) / (rh / 2)] : null;
    } else if (kind === 'p') {
      const [, pts, c, o] = s;
      color = c; opts = o || {};
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      test = (px, py) => {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside ? [((px - minX) / (maxX - minX || 1)) * 2 - 1, ((py - minY) / (maxY - minY || 1)) * 2 - 1] : null;
      };
    } else continue;

    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = test(x + 0.5, y + 0.5);
      if (!r) continue;
      mask[y * w + x] = 1;
      const shaded = color === 'a' && opts.shade !== false && r[0] * 0.5 + r[1] * 0.85 > 0.62;
      grid[y * w + x] = shaded ? 'b' : color;
    }
    if (opts.ol) {
      const inM = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (mask[y * w + x] && (!inM(x - 1, y) || !inM(x + 1, y) || !inM(x, y - 1) || !inM(x, y + 1))) grid[y * w + x] = 'k';
      }
    }
  }

  // Contorno esterno nero
  const filled = grid.slice();
  const isF = (x, y) => x >= 0 && y >= 0 && x < w && y < h && filled[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!filled[y * w + x] && (isF(x - 1, y) || isF(x + 1, y) || isF(x, y - 1) || isF(x, y + 1))) grid[y * w + x] = 'k';
  }

  // a/b/w/k più eventuali colori in più definiti nella palette (es. s = pelle)
  const colors = Object.assign({}, pal, { w: PK_COLORS.w, k: PK_COLORS.k });
  return { w, h, px: grid.map(c => c && colors[c]) };
}

// ─── Motore della lotta (senza DOM) ──────────────────────────────────────────

function pkStatOf(base, level) { return Math.floor((base + 8) * 2 * level / 100) + 5; }
function pkHpOf(base, level)   { return Math.floor((base + 8) * 2 * level / 100) + level + 10; }

function pkMakeMon(data, entry, side) {
  const sp = data.species[entry.species];
  const L = entry.level;
  const hp = pkHpOf(sp.base.hp, L);
  const moves = (entry.moves || sp.moves).filter(id => data.moves[id]).slice(0, 4)
    .map(id => ({ id, ...data.moves[id], left: data.moves[id].pp }));
  return {
    key: entry.species, name: sp.name, types: sp.types, level: L, side,
    hp, maxHp: hp,
    atk: pkStatOf(sp.base.atk, L), def: pkStatOf(sp.base.def, L), spd: pkStatOf(sp.base.spd, L),
    stages: { atk: 0, def: 0 },
    moves, sprite: sp.sprite, back: sp.back || null,
  };
}

const pkStageMul = (s) => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);

function pkEffectiveness(data, moveType, defTypes) {
  return defTypes.reduce((m, t) => m * (((data.chart || {})[moveType] || {})[t] ?? 1), 1);
}

// Danno (formula semplificata della seconda generazione). rnd: 0..1 per la variazione, crit: bool
function pkDamage(data, user, target, move, rnd, crit) {
  const A = user.atk * (crit ? 1 : pkStageMul(user.stages.atk));
  const D = target.def * (crit ? 1 : pkStageMul(target.stages.def));
  let dmg = Math.floor(Math.floor(Math.floor(2 * user.level / 5 + 2) * move.power * A / D) / 50) + 2;
  if (crit) dmg *= 2;
  if (user.types.includes(move.type)) dmg = Math.floor(dmg * 1.5);
  const eff = pkEffectiveness(data, move.type, target.types);
  dmg = Math.floor(dmg * eff);
  if (eff === 0) return { dmg: 0, eff };
  dmg = Math.max(1, Math.floor(dmg * (217 + Math.floor(rnd * 39)) / 255));
  return { dmg, eff };
}

const PK_STRUGGLE = { id: 'scontro', name: 'SCONTRO', type: 'NORMALE', power: 50, acc: 100, pp: 1, left: 1, recoil: 0.25 };

function pkUsableMoves(mon) { return mon.moves.filter(m => m.left > 0); }

// Scelta dell'IA: con probabilità "smart" la mossa che fa più danno, altrimenti una a caso
function pkAiMove(data, user, target, smart) {
  const usable = pkUsableMoves(user);
  if (!usable.length) return PK_STRUGGLE;
  const useful = usable.filter(m => {
    if (m.power > 0) return pkEffectiveness(data, m.type, target.types) > 0;
    const who = m.effect.target === 'self' ? user : target;
    return Math.abs(who.stages[m.effect.stat] + m.effect.stages) <= 2; // non insiste con le mosse di stato
  });
  const pool = useful.length ? useful : usable;
  if (Math.random() < smart) {
    const scored = pool.filter(m => m.power > 0)
      .map(m => ({ m, d: pkDamage(data, user, target, m, 0.5, false).dmg * m.acc / 100 }));
    if (scored.length) return scored.sort((a, b) => b.d - a.d)[0].m;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Stato della partita ─────────────────────────────────────────────────────

let pk = null;

function destroyPokemon() {
  if (!pk) return;
  cancelAnimationFrame(pk.raf);
  document.removeEventListener('keydown', pk.onKey);
  document.removeEventListener('keyup', pk.onKeyUp);
  window.removeEventListener('blur', pk.onBlur);
  pkMusicStop();
  pk = null;
}

function renderPokemon(q) {
  destroyPokemon();
  const container = document.getElementById('options-container');
  container.innerHTML = '';

  const data = (q.pokemon && q.pokemon.data) || (typeof pkBundle === 'function' ? pkBundle((q.pokemon && q.pokemon.gym) || 'scintilla') : null);
  if (!data) { container.textContent = 'Palestra non trovata'; return; }

  const wrap = document.createElement('div');
  wrap.className = 'pk-wrap';
  wrap.innerHTML = `
    <div class="pk-shell">
      <div class="pk-bezel"><span class="pk-led"></span><canvas id="pk-canvas" width="${PK_W * PK_SCALE}" height="${PK_H * PK_SCALE}"></canvas></div>
      <div class="pk-controls">
        <div class="pk-dpad">
          <button type="button" data-k="up" class="pk-d up" aria-label="Su"></button>
          <button type="button" data-k="left" class="pk-d left" aria-label="Sinistra"></button>
          <button type="button" data-k="right" class="pk-d right" aria-label="Destra"></button>
          <button type="button" data-k="down" class="pk-d down" aria-label="Giù"></button>
          <span class="pk-d mid"></span>
        </div>
        <div class="pk-ab">
          <button type="button" data-k="b" class="pk-btn b">B</button>
          <button type="button" data-k="a" class="pk-btn a">A</button>
        </div>
      </div>
    </div>
    <p class="pk-hint">${data.gym && data.gym.world
      ? 'Tieni premuta la croce per camminare · A parla e legge · B apre il menu'
      : 'Tocca lo schermo per scegliere e andare avanti (A conferma, B torna indietro)'}</p>
  `;
  container.appendChild(wrap);

  const canvas = wrap.querySelector('#pk-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const PK_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
                    KeyZ: 'a', Enter: 'a', Space: 'a', KeyX: 'b', Backspace: 'b', Escape: 'b' };
  pk = {
    id: Math.random(), q, data, canvas, ctx,
    sprites: {}, tiles: {}, tweens: [], waiter: null,
    raf: 0, time: 0, last: performance.now(),
    held: [], // direzioni tenute premute (per camminare), l'ultima vince
    view: pkFreshView(),
    onKey: (e) => {
      const k = PK_KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      if (PKW_DIR_KEYS.includes(k)) { if (e.repeat) return; pkHold(k, true); }
      pkInput(k);
    },
    onKeyUp: (e) => { const k = PK_KEYS[e.code]; if (k) pkHold(k, false); },
    onBlur: () => { if (pk) pk.held = []; },
  };

  wrap.querySelectorAll('[data-k]').forEach(btn => {
    const k = btn.dataset.k;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      if (PKW_DIR_KEYS.includes(k)) pkHold(k, true);
      else setTimeout(() => btn.classList.remove('pressed'), 120);
      pkInput(k);
    });
    const release = () => { btn.classList.remove('pressed'); pkHold(k, false); };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  });
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    pkTap((e.clientX - r.left) / r.width * PK_W, (e.clientY - r.top) / r.height * PK_H);
  });
  document.addEventListener('keydown', pk.onKey);
  document.addEventListener('keyup', pk.onKeyUp);
  window.addEventListener('blur', pk.onBlur);

  pk.raf = requestAnimationFrame(pkLoop);
  pkMain(pk.id);
}

function pkFreshView() {
  return {
    scene: 'black',            // 'black' | 'title' | 'battle' | 'party' | 'badge' | 'world'
    title: null,
    foe: null, me: null,       // { mon | trainer, x, dy, scale, hidden, blink }
    foeBox: null, meBox: null, // mostri di cui mostrare il riquadro PS
    text: null,                // { lines, shown, done }
    menu: null,
    party: null,
    flash: 0, wipe: 0, fade: 0, // fade: schermo che si oscura (porte, scale)
  };
}

const pkAlive = (id) => pk && pk.id === id;

// ─── Input ───────────────────────────────────────────────────────────────────

function pkInput(k) {
  if (!pk || !gameActive) return;
  getAudioCtx();
  if (pk.waiter && pk.waiter.key) pk.waiter.key(k);
}

const PKW_DIR_KEYS = ['up', 'down', 'left', 'right'];

function pkHold(k, down) {
  if (!pk || !PKW_DIR_KEYS.includes(k)) return;
  pk.held = pk.held.filter(d => d !== k);
  if (down) pk.held.push(k);
}
const pkHeldDir = () => (pk && gameActive && pk.held.length ? pk.held[pk.held.length - 1] : null);

function pkTap(x, y) {
  if (!pk || !gameActive) return;
  getAudioCtx();
  if (pk.waiter && pk.waiter.tap) pk.waiter.tap(x, y);
}

// ─── Primitive asincrone ─────────────────────────────────────────────────────

function pkSleep(ms) {
  const id = pk.id;
  return new Promise(res => setTimeout(() => { if (pkAlive(id)) res(); }, ms));
}

// Anima f(t) con t da 0 a 1 in "dur" secondi
function pkTween(dur, f) {
  return new Promise(res => pk.tweens.push({ start: performance.now(), dur, f, res }));
}

// Divide un testo in righe da 18 caratteri
function pkWrap(text) {
  const lines = [];
  text.split('\n').forEach(par => {
    let line = '';
    par.split(' ').forEach(word => {
      while (word.length > 18) { if (line) { lines.push(line); line = ''; } lines.push(word.slice(0, 18)); word = word.slice(18); }
      if (!line) line = word;
      else if ((line + ' ' + word).length <= 18) line += ' ' + word;
      else { lines.push(line); line = word; }
    });
    lines.push(line);
  });
  return lines;
}

// Scrive un messaggio nel riquadro in basso, due righe alla volta, e aspetta A
async function pkSay(text, opts = {}) {
  const id = pk.id;
  const lines = pkWrap(text);
  for (let i = 0; i < lines.length; i += 2) {
    const page = lines.slice(i, i + 2);
    const total = page.join('').length;
    const t = { lines: page, shown: 0, done: false, wait: false };
    pk.view.text = t;
    await new Promise(res => {
      const finish = () => { t.shown = total; t.done = true; };
      const typer = setInterval(() => {
        if (!pkAlive(id)) return clearInterval(typer);
        t.shown += 1;
        if (t.shown >= total) { clearInterval(typer); finish(); }
      }, 22);
      const advance = () => {
        if (!t.done) { clearInterval(typer); finish(); return; }
        if (opts.auto) return;
        pk.waiter = null;
        pkBlip();
        res();
      };
      pk.waiter = { key: (k) => { if (k === 'a' || k === 'b') advance(); }, tap: () => advance() };
      if (opts.auto) {
        const check = setInterval(() => {
          if (!pkAlive(id)) return clearInterval(check);
          if (t.done) { clearInterval(check); setTimeout(() => { if (pkAlive(id)) { pk.waiter = null; res(); } }, opts.auto); }
        }, 30);
      } else {
        t.wait = true;
      }
    });
  }
  if (!opts.keep) pk.view.text = null;
}

// Menu con cursore: items [{label, x, y, w, h, disabled}], cols per le frecce.
// Ritorna l'indice scelto o -1 (B, se cancel).
function pkChoose(menu) {
  menu.cursor = Math.min(menu.cursor || 0, menu.items.length - 1);
  pk.view.menu = menu;
  return new Promise(res => {
    const pick = (i) => {
      pk.waiter = null;
      pkBlip();
      if (!menu.keepOpen) pk.view.menu = null;
      res(i);
    };
    const cols = menu.cols || 1;
    pk.waiter = {
      key: (k) => {
        const n = menu.items.length;
        if (k === 'a') return pick(menu.cursor);
        if (k === 'b') { if (menu.cancel) pick(-1); return; }
        const c = menu.cursor;
        const nc = k === 'up' ? c - cols : k === 'down' ? c + cols : k === 'left' ? c - 1 : c + 1;
        if (cols === 1 && (k === 'left' || k === 'right')) return;
        if (cols > 1 && (k === 'left' || k === 'right') && Math.floor(nc / cols) !== Math.floor(c / cols)) return;
        if (nc >= 0 && nc < n) { menu.cursor = nc; pkBlip(0.5); if (menu.onMove) menu.onMove(nc); }
      },
      tap: (x, y) => {
        const i = menu.items.findIndex(it => x >= it.x - 10 && x < it.x + it.w + 4 && y >= it.y - 3 && y < it.y + (it.h || 8) + 3);
        if (i >= 0) { menu.cursor = i; if (menu.onMove) menu.onMove(i); pick(i); }
        else if (menu.tapOutside) pick(-1);
      },
    };
  });
}

// ─── Suoni (chiptune) ────────────────────────────────────────────────────────

function pkOut() {
  const ac = getAudioCtx();
  if (!pk.sfx) { pk.sfx = ac.createGain(); pk.sfx.gain.value = 1; pk.sfx.connect(ac.destination); }
  return pk.sfx;
}

function pkNote(freq, type, t, dur, vol, dest) {
  const ac = getAudioCtx();
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || pkOut());
  o.start(t); o.stop(t + dur + 0.02);
}

const pkMidi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function pkBlip(vol = 1) {
  if (!pk) return;
  pkNote(1760, 'square', getAudioCtx().currentTime, 0.03, 0.03 * vol);
}

function pkNoise(dur, vol) {
  const ac = getAudioCtx();
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  const src = ac.createBufferSource(), g = ac.createGain();
  src.buffer = buf; g.gain.value = vol;
  src.connect(g); g.connect(pkOut());
  src.start();
}

function pkJingle(notes, step, type = 'square', vol = 0.05) {
  const t = getAudioCtx().currentTime + 0.05;
  notes.forEach(([n, len], i) => {
    const at = notes.slice(0, i).reduce((s, x) => s + x[1], 0) * step;
    if (n) pkNote(pkMidi(n), type, t + at, len * step * 0.95, vol);
  });
  return notes.reduce((s, x) => s + x[1], 0) * step * 1000;
}

// Musica della lotta: un giro originale in La minore (Am F G E), basso a ottave
const PK_SONG = (() => {
  const lead = [
    [69, 72, 76, 81, 79, 76, 72, 76], [65, 69, 72, 77, 76, 72, 69, 72],
    [67, 71, 74, 79, 77, 74, 71, 74], [64, 68, 71, 76, 74, 71, 68, 71],
    [81, 0, 79, 76, 77, 76, 72, 69], [77, 0, 76, 72, 74, 72, 69, 65],
    [79, 0, 77, 74, 76, 74, 71, 67], [76, 0, 74, 71, 72, 71, 68, 64],
  ];
  const roots = [45, 41, 43, 40, 45, 41, 43, 40];
  return { lead, roots };
})();

// Musiche dell'avventura (originali): percorso in Do maggiore, grotta lenta in La minore,
// CENTRO tranquillo, palestra più svelta
const PK_SONGS = {
  battle: Object.assign({ step: 0.17 }, PK_SONG),
  route: {
    step: 0.19,
    lead: [
      [72, 0, 76, 79, 77, 76, 74, 72], [69, 0, 72, 76, 74, 72, 71, 69],
      [65, 69, 72, 77, 76, 74, 72, 69], [67, 71, 74, 79, 77, 74, 71, 67],
      [76, 77, 79, 84, 83, 79, 76, 79], [81, 79, 76, 72, 74, 76, 77, 76],
      [77, 76, 74, 72, 71, 72, 74, 77], [79, 0, 74, 0, 71, 0, 67, 0],
    ],
    roots: [48, 45, 41, 43, 48, 45, 41, 43],
  },
  cave: {
    step: 0.24, vol: 0.016,
    lead: [
      [69, 0, 0, 72, 0, 71, 0, 0], [68, 0, 0, 71, 0, 69, 0, 0],
      [65, 0, 0, 69, 0, 68, 0, 64], [64, 0, 0, 0, 0, 0, 0, 0],
      [72, 0, 0, 76, 0, 74, 0, 0], [71, 0, 0, 74, 0, 72, 0, 0],
      [69, 0, 0, 72, 0, 71, 0, 68], [69, 0, 0, 0, 0, 0, 0, 0],
    ],
    roots: [45, 44, 41, 40, 45, 44, 41, 45],
  },
  center: {
    step: 0.2,
    lead: [
      [79, 76, 72, 76, 77, 74, 71, 74], [76, 72, 69, 72, 74, 71, 67, 0],
      [77, 74, 71, 74, 76, 72, 69, 72], [71, 74, 79, 0, 72, 0, 0, 0],
    ],
    roots: [48, 43, 41, 43],
  },
  gym: {
    step: 0.16,
    lead: [
      [72, 72, 79, 72, 77, 72, 76, 74], [70, 70, 77, 70, 76, 70, 74, 72],
      [69, 69, 76, 69, 74, 69, 72, 71], [67, 71, 74, 77, 79, 77, 74, 71],
    ],
    roots: [48, 46, 45, 43],
  },
};

// fast = true (capopalestra) o false: musica della lotta; una stringa: musica dell'avventura
function pkMusicStart(fast) {
  pkMusicStop();
  if (!pk) return;
  const song = typeof fast === 'string' ? (PK_SONGS[fast] || PK_SONGS.route) : PK_SONGS.battle;
  const ac = getAudioCtx();
  const bus = ac.createGain();
  bus.gain.value = 1;
  bus.connect(ac.destination);
  const step = fast === true ? 0.15 : song.step; // durata di un ottavo
  const m = { bus, step, next: ac.currentTime + 0.1, i: 0 };
  m.timer = setInterval(() => {
    while (m.next < ac.currentTime + 0.25) {
      const bar = Math.floor(m.i / 8) % song.lead.length, k = m.i % 8;
      const n = song.lead[bar][k];
      if (n) pkNote(pkMidi(n), 'square', m.next, step * 0.9, song.vol || 0.022, bus);
      const r = song.roots[bar] + (k % 2 ? 12 : 0);
      pkNote(pkMidi(r), 'triangle', m.next, step * 0.9, 0.09, bus);
      m.next += step; m.i++;
    }
  }, 60);
  pk.music = m;
}

function pkMusicStop() {
  if (!pk || !pk.music) return;
  clearInterval(pk.music.timer);
  try { pk.music.bus.gain.setValueAtTime(0, getAudioCtx().currentTime); pk.music.bus.disconnect(); } catch (e) {}
  pk.music = null;
}

// ─── Svolgimento ─────────────────────────────────────────────────────────────

const pkLabel = (m) => m.side === 'foe' ? m.name + (m.wild ? ' selvatico' : ' nemico') : m.name;
const pkTrainerLabel = (t) => t.title + ' ' + t.name;

async function pkMain(id) {
  try { await Promise.race([document.fonts.load(PK_FONT), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  if (!pkAlive(id)) return;

  const { data } = pk;
  const gym = data.gym;
  pk.player = {
    name: gym.player.name,
    sprite: gym.player.sprite,
    team: gym.player.team.map(e => pkMakeMon(data, e, 'me')),
    bag: Object.assign({}, gym.player.bag || {}),
  };

  // Schermata del titolo
  const v = pk.view;
  v.scene = 'title';
  v.title = { name: gym.name, sub: gym.world ? (gym.sub || '') : gym.trainers.length + ' SFIDE' };
  await new Promise(res => { pk.waiter = { key: (k) => { if (k === 'a') { pk.waiter = null; res(); } }, tap: () => { pk.waiter = null; res(); } }; });
  if (!pkAlive(id)) return;
  pkBlip();

  // Versione B: l'avventura da esplorare (pokemon-world.js)
  if (gym.world) return pkWorldMain(id);

  for (let i = 0; i < gym.trainers.length; i++) {
    const trainer = data.trainers[gym.trainers[i]];
    if (!trainer) continue;
    const last = i === gym.trainers.length - 1;
    const won = await pkBattle(id, trainer, last);
    if (!pkAlive(id)) return;
    if (!won) return pkLose(id);
    if (!last) {
      v.scene = 'black';
      v.foe = v.me = v.foeBox = v.meBox = null;
      await pkSay(i === gym.trainers.length - 2 ? 'Davanti a te c\'è il capopalestra…' : 'Prosegui nella palestra…');
    }
  }
  if (pkAlive(id)) pkWin(id);
}

// Lampi + tendine nere, come all'inizio di una lotta con un allenatore
async function pkTransition() {
  const v = pk.view;
  for (let i = 0; i < 3; i++) {
    v.flash = 1; await pkSleep(70);
    v.flash = 0; await pkSleep(70);
  }
  await pkTween(0.45, t => { v.wipe = t; });
}

// opts.wild = { species, level }: creatura selvatica (si può fuggire).
// opts.world: lotta partita dalla mappa (la presentazione l'allenatore l'ha già detta lì).
// Ritorna true se vinta, 'fled' se si è fuggiti, false se la squadra è esausta.
async function pkBattle(id, trainer, isLeader, opts = {}) {
  const v = pk.view, data = pk.data, P = pk.player;
  const wild = opts.wild || null;
  const foes = wild ? [Object.assign(pkMakeMon(data, wild, 'foe'), { wild: true })] : trainer.team.map(e => pkMakeMon(data, e, 'foe'));
  const bag = wild ? {} : Object.assign({}, trainer.items || {});
  const smart = wild ? 0.3 : trainer.smart ?? 0.6;
  let runs = 0;

  pkMusicStart(!!isLeader);
  await pkTransition();
  if (!pkAlive(id)) return false;

  v.scene = 'battle';
  v.foeBox = v.meBox = null;
  // Come in Cristallo: l'avversario entra da destra e la giocatrice, di schiena, da sinistra
  const meTrainer = data.sprites[P.sprite] ? { trainer: P, x: -70, dy: 0, scale: 1 } : null;
  v.me = meTrainer;
  v.foe = wild ? { mon: foes[0], x: 70, dy: 0, scale: 1 } : { trainer, x: 70, dy: 0, scale: 1 };
  pkTween(0.45, t => { v.wipe = 1 - t; });
  await pkTween(0.6, t => { v.foe.x = 70 * (1 - t); if (meTrainer) meTrainer.x = -70 * (1 - t); });
  if (!pkAlive(id)) return false;

  if (wild) {
    foes[0].stages = { atk: 0, def: 0 };
    v.foeBox = foes[0];
    pkNote(pkMidi(84), 'square', getAudioCtx().currentTime, 0.08, 0.04);
    await pkSay('Appare ' + foes[0].name + ' selvatico!');
  } else {
    if (trainer.intro && !opts.world) await pkSay(trainer.intro);
    await pkSay(pkTrainerLabel(trainer) + ' vuole combattere!');
    if (!pkAlive(id)) return false;
    await pkTween(0.35, t => { v.foe.x = 70 * t; });
  }
  if (!pkAlive(id)) return false;

  let fi = 0;
  const sendFoe = async () => {
    const f = foes[fi];
    f.stages = { atk: 0, def: 0 };
    v.foe = { mon: f, x: 0, dy: 0, scale: 0 };
    v.foeBox = f;
    pkNote(pkMidi(84), 'square', getAudioCtx().currentTime, 0.08, 0.04);
    await pkTween(0.3, t => { v.foe.scale = t; });
    await pkSay(pkTrainerLabel(trainer) + ' manda in campo ' + f.name + '!');
  };
  let me = null;
  const sendMe = async (mon) => {
    if (v.me && v.me.trainer) {
      const s = v.me;
      await pkTween(0.35, t => { s.x = -70 * t; });
      v.me = null;
    }
    me = mon;
    me.stages = { atk: 0, def: 0 };
    v.me = { mon: me, x: 0, dy: 0, scale: 0 };
    v.meBox = me;
    await pkSay('Vai! ' + me.name + '!', { auto: 350, keep: true });
    pkNote(pkMidi(79), 'square', getAudioCtx().currentTime, 0.08, 0.04);
    await pkTween(0.3, t => { v.me.scale = t; });
    v.text = null;
  };
  const withdrawMe = async () => {
    await pkSay('Torna qui, ' + me.name + '!', { auto: 300, keep: true });
    await pkTween(0.25, t => { v.me.scale = 1 - t; });
    v.text = null;
  };

  if (!wild) await sendFoe();
  if (!pkAlive(id)) return false;
  await sendMe(P.team.find(m => m.hp > 0));
  if (!pkAlive(id)) return false;

  for (;;) {
    // ── Scelta del giocatore ──
    const action = await pkPlayerAction(id, me, !!wild);
    if (!pkAlive(id)) return false;
    const foe = foes[fi];

    // Fuga (solo dalle creature selvatiche): riesce sempre se si è più veloci, altrimenti sempre più facile
    if (action.kind === 'run') {
      runs++;
      if (me.spd >= foe.spd || Math.random() < 0.25 + 0.25 * runs) {
        const t0 = getAudioCtx().currentTime;
        [67, 64, 60].forEach((n, i) => pkNote(pkMidi(n), 'square', t0 + i * 0.06, 0.06, 0.04));
        await pkSay('Scampato pericolo!');
        pkMusicStop();
        return 'fled';
      }
      await pkSay('Non riesci a fuggire!');
      if (!pkAlive(id)) return false;
    }

    // L'avversario: strumento se è messo male, altrimenti una mossa
    let foeAction;
    const potion = Object.keys(bag).find(k => bag[k] > 0 && data.items[k]);
    if (potion && foe.hp < foe.maxHp * 0.3 && Math.random() < 0.7) foeAction = { kind: 'item', item: potion };
    else foeAction = { kind: 'move', move: pkAiMove(data, foe, me, smart) };

    // Ordine: cambi e strumenti prima, poi le mosse per velocità (dopo una fuga fallita tocca solo a lei)
    const meFirst = action.kind !== 'move' || (foeAction.kind !== 'item' &&
      (me.spd > foe.spd || (me.spd === foe.spd && Math.random() < 0.5)));
    const turns = action.kind === 'run' ? ['foe'] : meFirst ? ['me', 'foe'] : ['foe', 'me'];

    for (const who of turns) {
      if (who === 'me') {
        if (action.kind === 'switch') {
          await withdrawMe();
          await sendMe(P.team[action.index]);
        } else if (action.kind === 'item') {
          await pkUseItem(id, P.name, action.item, P.team[action.target], P.bag);
        } else {
          await pkUseMove(id, me, foe, action.move);
        }
      } else {
        if (foe.hp <= 0) continue;
        if (foeAction.kind === 'item') await pkUseItem(id, pkTrainerLabel(trainer), foeAction.item, foe, bag);
        else await pkUseMove(id, foe, me, foeAction.move);
      }
      if (!pkAlive(id)) return false;
      if (foe.hp <= 0 || me.hp <= 0) break;
    }

    // ── Esausti ──
    if (foe.hp <= 0) {
      await pkFaint(id, 'foe');
      if (!pkAlive(id)) return false;
      fi++;
      if (fi >= foes.length && wild) {
        pkMusicStop();
        const dur = pkJingle([[72, 1], [76, 1], [79, 2]], 0.1);
        await pkSleep(dur);
        return true;
      }
      if (fi >= foes.length) {
        // Lotta vinta
        pkMusicStop();
        const dur = pkJingle([[72, 1], [76, 1], [79, 1], [84, 3], [0, 1], [83, 1], [84, 4]], 0.11);
        await pkSay('Hai sconfitto ' + pkTrainerLabel(trainer) + '!');
        v.foeBox = null;
        v.foe = { trainer, x: 70, dy: 0, scale: 1 };
        await pkTween(0.4, t => { v.foe.x = 70 * (1 - t); });
        if (trainer.defeat) await pkSay(trainer.defeat);
        await pkSleep(Math.max(0, dur - 1500));
        return true;
      }
      await pkSay(pkTrainerLabel(trainer) + ' sta per mandare in campo ' + foes[fi].name + '.');
      await sendFoe();
    }
    if (me.hp <= 0) {
      await pkFaint(id, 'me');
      if (!pkAlive(id)) return false;
      if (!P.team.some(m => m.hp > 0)) { pkMusicStop(); return false; }
      const idx = await pkParty(id, { forced: true, prompt: 'Chi mandi in campo?' });
      if (!pkAlive(id)) return false;
      v.scene = 'battle';
      await sendMe(P.team[idx]);
    }
    if (!pkAlive(id)) return false;
  }
}

async function pkPlayerAction(id, me, canRun) {
  const v = pk.view, P = pk.player;
  let cursor = 0;
  for (;;) {
    v.text = { lines: [], shown: 0, done: true };
    const items = [
      { label: 'LOTTA', x: 64, y: 108, w: 40 }, { label: 'PKMN', x: 116, y: 108, w: 32 },
      { label: 'ZAINO', x: 64, y: 124, w: 40 }, { label: 'FUGA', x: 116, y: 124, w: 32 },
    ];
    const c = await pkChoose({ type: 'main', items, cols: 2, cursor });
    if (!pkAlive(id)) return null;
    cursor = c;
    v.text = null;

    if (c === 0) {
      if (!pkUsableMoves(me).length) {
        await pkSay(me.name + ' non ha più mosse!');
        return { kind: 'move', move: PK_STRUGGLE };
      }
      const mi = await pkChooseMove(id, me);
      if (!pkAlive(id)) return null;
      if (mi < 0) continue;
      const mv = me.moves[mi];
      if (mv.left <= 0) { await pkSay('Non ci sono più PP per questa mossa!'); continue; }
      return { kind: 'move', move: mv };
    }
    if (c === 1) {
      const idx = await pkParty(id, { prompt: 'Chi mandi in campo?' });
      if (!pkAlive(id)) return null;
      v.scene = 'battle';
      if (idx < 0) continue;
      const m = P.team[idx];
      if (m === me) { await pkSay(m.name + ' è già in campo!'); continue; }
      if (m.hp <= 0) { await pkSay(m.name + ' non ha più energie per lottare!'); continue; }
      return { kind: 'switch', index: idx };
    }
    if (c === 2) {
      const keys = Object.keys(P.bag).filter(k => P.bag[k] > 0 && pk.data.items[k]);
      const bagItems = keys.map((k, i) => ({ label: pk.data.items[k].name, count: P.bag[k], x: 24, y: 50 + i * 12, w: 128 }));
      bagItems.push({ label: 'ANNULLA', x: 24, y: 50 + keys.length * 12, w: 128 });
      v.text = { lines: ['Quale strumento?'], shown: 99, done: true };
      const bi = await pkChoose({ type: 'bag', items: bagItems, cancel: true });
      v.text = null;
      if (!pkAlive(id)) return null;
      if (bi < 0 || bi >= keys.length) continue;
      const ti = await pkParty(id, { prompt: 'Su chi la usi?' });
      if (!pkAlive(id)) return null;
      v.scene = 'battle';
      if (ti < 0) continue;
      const target = P.team[ti];
      if (target.hp <= 0 || target.hp >= target.maxHp) { await pkSay('Non avrebbe alcun effetto.'); continue; }
      return { kind: 'item', item: keys[bi], target: ti };
    }
    if (canRun) return { kind: 'run' };
    await pkSay('No! Da una lotta tra allenatori non si scappa!');
  }
}

function pkChooseMove(id, me) {
  const items = me.moves.map((m, i) => ({ label: m.name, x: 48, y: 101 + i * 10, w: 100 }));
  const menu = { type: 'moves', items, cancel: true, mon: me, cursor: pk.lastMove || 0 };
  return pkChoose(menu).then(i => { if (i >= 0) pk.lastMove = i; return i; });
}

async function pkParty(id, { forced = false, prompt }) {
  const v = pk.view, P = pk.player;
  v.scene = 'party';
  const items = P.team.map((m, i) => ({ label: m.name, x: 16, y: 6 + i * 26, w: 136, h: 20 }));
  if (!forced) items.push({ label: 'ANNULLA', x: 16, y: 6 + P.team.length * 26, w: 64 });
  v.text = { lines: pkWrap(prompt), shown: 99, done: true };
  for (;;) {
    const i = await pkChoose({ type: 'party', items, cancel: !forced });
    if (!pkAlive(id)) return -1;
    if (i < 0 || i >= P.team.length) { v.text = null; return -1; }
    if (forced && P.team[i].hp <= 0) { await pkSay(P.team[i].name + ' non ha più energie per lottare!'); v.text = { lines: pkWrap(prompt), shown: 99, done: true }; continue; }
    v.text = null;
    return i;
  }
}

async function pkAnimHp(mon, to) {
  const from = mon.shownHp ?? mon.hp;
  mon.hp = to;
  const dur = Math.max(0.25, Math.abs(to - from) / mon.maxHp * 1.4);
  await pkTween(dur, t => { mon.shownHp = Math.round(from + (to - from) * t); });
  mon.shownHp = to;
}

async function pkUseItem(id, userName, key, target, bag) {
  const item = pk.data.items[key];
  bag[key]--;
  await pkSay(userName + ' usa ' + item.name + '!');
  const heal = Math.min(item.heal, target.maxHp - target.hp);
  const t0 = getAudioCtx().currentTime;
  [72, 76, 79, 84].forEach((n, i) => pkNote(pkMidi(n), 'square', t0 + i * 0.07, 0.07, 0.035));
  await pkAnimHp(target, target.hp + heal);
  await pkSay(pkLabel(target) + ' recupera ' + heal + ' PS!');
}

async function pkUseMove(id, user, target, move) {
  const v = pk.view, data = pk.data;
  const side = user.side === 'me' ? v.me : v.foe;
  const tside = target.side === 'me' ? v.me : v.foe;
  if (move.left !== undefined && move !== PK_STRUGGLE) move.left--;

  await pkSay(pkLabel(user) + ' usa ' + move.name + '!', { auto: 250, keep: true });
  if (!pkAlive(id)) return;

  // Spinta in avanti di chi attacca
  const dir = user.side === 'me' ? 1 : -1;
  await pkTween(0.12, t => { side.x = dir * 6 * Math.sin(t * Math.PI); });
  side.x = 0;

  if (Math.random() * 100 >= move.acc) {
    await pkSay('Ma l\'attacco di ' + pkLabel(user) + ' fallisce!');
    return;
  }

  if (move.power > 0) {
    const crit = Math.random() < 1 / 16;
    const { dmg, eff } = pkDamage(data, user, target, move, Math.random(), crit);
    if (eff === 0) { await pkSay('Non ha effetto su ' + pkLabel(target) + '…'); return; }

    // Colpo: rumore e lampeggio
    pkNoise(0.18, eff > 1 ? 0.22 : eff < 1 ? 0.08 : 0.14);
    for (let i = 0; i < 3; i++) { tside.hidden = true; await pkSleep(60); tside.hidden = false; await pkSleep(60); }
    if (!pkAlive(id)) return;
    v.text = null;
    await pkAnimHp(target, Math.max(0, target.hp - dmg));
    if (crit) await pkSay('Brutto colpo!');
    if (eff > 1) await pkSay('È superefficace!');
    else if (eff < 1) await pkSay('Non è molto efficace…');
    if (move.drain && target.hp >= 0) {
      const heal = Math.min(Math.max(1, Math.floor(dmg * move.drain)), user.maxHp - user.hp);
      if (heal > 0) { await pkAnimHp(user, user.hp + heal); await pkSay('Assorbita l\'energia di ' + pkLabel(target) + '!'); }
    }
    if (move.recoil) {
      await pkAnimHp(user, Math.max(0, user.hp - Math.max(1, Math.floor(dmg * move.recoil))));
      await pkSay(pkLabel(user) + ' subisce il contraccolpo!');
    }
  } else if (move.effect) {
    v.text = null;
    const e = move.effect;
    const who = e.target === 'self' ? user : target;
    const statName = e.stat === 'atk' ? 'L\'ATTACCO' : 'La DIFESA';
    const next = Math.max(-6, Math.min(6, who.stages[e.stat] + e.stages));
    if (next === who.stages[e.stat]) { await pkSay('Non succede nulla!'); return; }
    who.stages[e.stat] = next;
    const t0 = getAudioCtx().currentTime;
    (e.stages > 0 ? [67, 71, 74, 79] : [79, 74, 71, 67]).forEach((n, i) => pkNote(pkMidi(n), 'square', t0 + i * 0.05, 0.05, 0.03));
    await pkSay(statName + ' di ' + pkLabel(who) + (e.stages > 0 ? ' aumenta!' : ' cala!'));
  }
}

async function pkFaint(id, which) {
  const v = pk.view;
  const s = which === 'me' ? v.me : v.foe;
  const mon = s.mon;
  const t0 = getAudioCtx().currentTime;
  [72, 67, 64, 60, 55].forEach((n, i) => pkNote(pkMidi(n), 'square', t0 + i * 0.07, 0.08, 0.04));
  await pkTween(0.4, t => { s.dy = t; });
  if (which === 'me') { v.me = null; v.meBox = null; } else { v.foe = null; v.foeBox = null; }
  await pkSay(pkLabel(mon) + ' è esausto!');
}

async function pkLose(id) {
  const v = pk.view;
  await pkSay('Non hai più creature in grado di lottare!');
  if (!pkAlive(id)) return;
  await pkTween(0.8, t => { v.wipe = t; });
  v.scene = 'black';
  v.foe = v.me = v.foeBox = v.meBox = null;
  v.wipe = 0;
  await pkSay('Hai perso la sfida…', { auto: 900 });
  if (!pkAlive(id)) return;
  gameActive = false;
  clearTimer();
  playGameOver();
  showGameOver('pokemon');
}

async function pkWin(id) {
  const v = pk.view, gym = pk.data.gym;
  v.scene = 'badge';
  v.foe = v.me = v.foeBox = v.meBox = null;
  const dur = pkJingle([[67, 1], [72, 1], [76, 1], [79, 2], [76, 1], [79, 1], [84, 6]], 0.13);
  await pkSay('Hai ottenuto la ' + gym.badge.name + '!');
  await pkSleep(Math.max(200, dur - 1200));
  if (!pkAlive(id)) return;
  const q = pk.q;
  const stage = pk.canvas;
  destroyPokemon();
  const opt = q.options.find(o => o.correct);
  if (opt) handleAnswer(opt, stage);
  else { gameActive = false; showWin(); }
}

// ─── Disegno ─────────────────────────────────────────────────────────────────

function pkLoop(now) {
  if (!pk) return;
  const dt = Math.min((now - pk.last) / 1000, 0.05);
  pk.last = now;
  pk.time += dt;
  if (pk.worldPoll) pk.worldPoll(); // avventura: si cammina finché la croce resta premuta
  // Le animazioni seguono il tempo reale: se il telefono perde fotogrammi non rallentano
  for (const tw of pk.tweens.slice()) {
    const k = Math.min(1, (now - tw.start) / 1000 / tw.dur);
    tw.f(k);
    if (k >= 1) { pk.tweens.splice(pk.tweens.indexOf(tw), 1); tw.res(); }
  }
  if (!pk) return;
  pkDraw();
  pk.raf = requestAnimationFrame(pkLoop);
}

function pkSpriteCanvas(def, pal, flip) {
  if (!def._id) def._id = Math.random().toString(36).slice(2);
  const key = def._id + JSON.stringify(pal || null) + (flip ? 'f' : '');
  if (pk.sprites[key]) return pk.sprites[key];
  const c = document.createElement('canvas');
  if (def.img) {
    // Immagine PNG: la carico e la ridisegno quando è pronta
    const img = new Image();
    img.onload = () => {
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      if (flip) { x.translate(img.width, 0); x.scale(-1, 1); }
      x.drawImage(img, 0, 0);
      c.ready = true;
    };
    img.src = def.img;
    c.width = 1; c.height = 1;
  } else {
    const r = pkRaster(def, pal);
    c.width = r.w; c.height = r.h;
    const x = c.getContext('2d');
    r.px.forEach((col, i) => {
      if (!col) return;
      const px = i % r.w, py = Math.floor(i / r.w);
      x.fillStyle = col;
      x.fillRect(flip ? r.w - 1 - px : px, py, 1, 1);
    });
    c.ready = true;
  }
  pk.sprites[key] = c;
  return c;
}

// Disegna uno sprite in un riquadro 56×56 con ancoraggio in basso al centro
function pkDrawSprite(def, pal, flip, x, y, s) {
  if (!def) return;
  const c = pkSpriteCanvas(def, pal, flip);
  if (!c.ready) return;
  const ctx = pk.ctx;
  const size = 56;
  const k = size / Math.max(c.width, c.height); // 28→2×, 56→1×
  const w = c.width * k * s.scale, h = c.height * k * s.scale;
  const dx = x + (size - w) / 2 + s.x;
  const dy = y + size - h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 20, y - 20, size + 40, size + 20); // la discesa quando è esausto sparisce sotto
  ctx.clip();
  ctx.drawImage(c, dx, dy + s.dy * size, w, h);
  ctx.restore();
}

function pkText(str, x, y, color) {
  const ctx = pk.ctx;
  ctx.fillStyle = color || PK_COLORS.k;
  ctx.fillText(str, x, y);
}

function pkBox(x, y, w, h) {
  const ctx = pk.ctx;
  ctx.fillStyle = PK_COLORS.w;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PK_COLORS.k;
  const line = (lx, ly, lw, lh) => ctx.fillRect(lx, ly, lw, lh);
  // doppio bordo
  line(x + 1, y + 1, w - 2, 1); line(x + 1, y + h - 2, w - 2, 1); line(x + 1, y + 1, 1, h - 2); line(x + w - 2, y + 1, 1, h - 2);
  line(x + 3, y + 3, w - 6, 1); line(x + 3, y + h - 4, w - 6, 1); line(x + 3, y + 3, 1, h - 6); line(x + w - 4, y + 3, 1, h - 6);
}

// Scritta "PS" in pixel 3×5
const PK_TINY = { P: ['111', '101', '111', '100', '100'], S: ['111', '100', '111', '001', '111'] };
function pkTiny(str, x, y) {
  const ctx = pk.ctx;
  ctx.fillStyle = PK_COLORS.k;
  [...str].forEach((ch, i) => (PK_TINY[ch] || []).forEach((row, ry) => [...row].forEach((b, rx) => {
    if (b === '1') ctx.fillRect(x + i * 4 + rx, y + ry, 1, 1);
  })));
}

function pkHpBar(mon, x, y, w) {
  const ctx = pk.ctx;
  const hp = mon.shownHp ?? mon.hp;
  const r = Math.max(0, hp / mon.maxHp);
  pkTiny('PS', x, y);
  const bx = x + 9;
  ctx.fillStyle = PK_COLORS.k;
  ctx.fillRect(bx, y, w, 5);
  ctx.fillStyle = PK_COLORS.w;
  ctx.fillRect(bx + 1, y + 1, w - 2, 3);
  ctx.fillStyle = r > 0.5 ? '#20b838' : r > 0.2 ? '#f0b000' : '#e82010';
  const fw = Math.round((w - 2) * r);
  if (fw > 0) ctx.fillRect(bx + 1, y + 1, fw, 3);
}

function pkDraw() {
  const { ctx, view: v } = pk;
  ctx.setTransform(PK_SCALE, 0, 0, PK_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.font = PK_FONT;
  ctx.textBaseline = 'top';

  const blinkOn = Math.floor(pk.time * 2.5) % 2 === 0;

  if (v.scene === 'black') {
    ctx.fillStyle = PK_COLORS.k;
    ctx.fillRect(0, 0, PK_W, PK_H);
  } else if (v.scene === 'title') {
    ctx.fillStyle = PK_COLORS.k;
    ctx.fillRect(0, 0, PK_W, PK_H);
    ctx.textAlign = 'center';
    const words = pkWrap(v.title.name);
    words.forEach((l, i) => pkText(l, 80, 36 + i * 12, PK_COLORS.w));
    pkText(v.title.sub, 80, 70, '#f8d830');
    if (blinkOn) pkText('TOCCA PER', 80, 104, PK_COLORS.w), pkText('INIZIARE', 80, 116, PK_COLORS.w);
    ctx.textAlign = 'left';
    return;
  } else if (v.scene === 'world') {
    pkDrawWorld();
  } else if (v.scene === 'party') {
    pkDrawParty();
  } else if (v.scene === 'badge') {
    ctx.fillStyle = PK_COLORS.w;
    ctx.fillRect(0, 0, PK_W, PK_H);
    const b = pk.data.gym.badge;
    const def = pk.data.sprites[b.sprite];
    if (def) {
      const bob = Math.sin(pk.time * 3) * 2;
      const c = pkSpriteCanvas(def, null, false);
      ctx.drawImage(c, 80 - c.width * 1.5, 14 + bob, c.width * 3, c.height * 3);
      // scintillii
      if (Math.floor(pk.time * 4) % 2) { ctx.fillStyle = '#f8d830'; ctx.fillRect(44, 20, 2, 2); ctx.fillRect(112, 66, 2, 2); }
      else { ctx.fillStyle = '#f8d830'; ctx.fillRect(114, 18, 2, 2); ctx.fillRect(42, 68, 2, 2); }
    }
  } else {
    pkDrawBattle();
  }

  // Dissolvenza a nero, a scatti come sul Game Boy
  if (v.fade > 0) {
    ctx.globalAlpha = Math.ceil(v.fade * 4) / 4;
    ctx.fillStyle = PK_COLORS.k;
    ctx.fillRect(0, 0, PK_W, PK_H);
    ctx.globalAlpha = 1;
  }

  // Riquadro del testo
  if (v.text) {
    pkBox(0, 96, PK_W, 48);
    let left = v.text.shown;
    v.text.lines.forEach((l, i) => {
      const s = l.slice(0, Math.max(0, left));
      left -= l.length;
      pkText(s, 8, 108 + i * 16);
    });
    if (v.text.done && v.text.wait && blinkOn) {
      ctx.fillStyle = PK_COLORS.k;
      ctx.fillRect(146, 134, 6, 1); ctx.fillRect(147, 135, 4, 1); ctx.fillRect(148, 136, 2, 1);
    }
  }

  if (v.menu) pkDrawMenu(v.menu, blinkOn);

  if (v.flash) {
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PK_W, PK_H);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (v.wipe > 0) {
    const hh = Math.ceil(PK_H / 2 * v.wipe);
    ctx.fillStyle = PK_COLORS.k;
    ctx.fillRect(0, 0, PK_W, hh);
    ctx.fillRect(0, PK_H - hh, PK_W, hh);
  }
}

function pkDrawBattle() {
  const { ctx, view: v } = pk;
  ctx.fillStyle = PK_COLORS.w;
  ctx.fillRect(0, 0, PK_W, PK_H);

  // Avversario (in alto a destra)
  if (v.foe && !v.foe.hidden) {
    if (v.foe.trainer) {
      const t = v.foe.trainer;
      pkDrawSprite(pk.data.sprites[t.sprite], t.pal, false, 100, 2, { x: v.foe.x, dy: 0, scale: 1 });
    } else {
      pkDrawSprite(v.foe.mon.sprite, null, false, 100, 2, v.foe);
    }
  }
  // Giocatore (in basso a sinistra, girato verso l'avversario)
  if (v.me && !v.me.hidden) {
    if (v.me.trainer) {
      pkDrawSprite(pk.data.sprites[v.me.trainer.sprite], null, false, 8, 40, v.me);
    } else {
      const m = v.me.mon;
      pkDrawSprite(m.back || m.sprite, null, !m.back, 8, 40, v.me);
    }
  }

  if (v.foeBox) {
    const f = v.foeBox;
    pkText(f.name, 8, 4);
    pkText('Lv' + f.level, 56, 13);
    pkHpBar(f, 14, 23, 66);
    ctx.fillStyle = PK_COLORS.k;
    ctx.fillRect(6, 13, 1, 17); ctx.fillRect(6, 30, 84, 1);
  }
  if (v.meBox) {
    const m = v.meBox;
    const hp = m.shownHp ?? m.hp;
    pkText(m.name, 72, 56);
    pkText('Lv' + m.level, 112, 65);
    pkHpBar(m, 76, 75, 72);
    ctx.textAlign = 'right';
    pkText(hp + '/' + m.maxHp, 152, 83);
    ctx.textAlign = 'left';
    ctx.fillStyle = PK_COLORS.k;
    ctx.fillRect(154, 66, 1, 27); ctx.fillRect(70, 93, 85, 1);
  }
}

function pkDrawParty() {
  const { ctx } = pk;
  ctx.fillStyle = PK_COLORS.w;
  ctx.fillRect(0, 0, PK_W, PK_H);
  pk.player.team.forEach((m, i) => {
    const y = 6 + i * 26;
    const hp = m.shownHp ?? m.hp;
    pkText(m.name, 16, y, hp > 0 ? PK_COLORS.k : '#888888');
    ctx.textAlign = 'right';
    pkText('Lv' + m.level, 152, y);
    pkText(hp + '/' + m.maxHp, 152, y + 11);
    ctx.textAlign = 'left';
    pkHpBar(m, 16, y + 12, 64);
  });
}

function pkDrawMenu(menu, blinkOn) {
  const { ctx } = pk;
  if (menu.type === 'main') {
    pkBox(48, 96, 112, 48);
  } else if (menu.type === 'moves') {
    pkBox(32, 96, 128, 48);
    const mv = menu.mon.moves[menu.cursor];
    pkBox(0, 60, 72, 38);
    pkText('TIPO/', 8, 67);
    pkText(mv.type, 8, 76);
    ctx.textAlign = 'right';
    pkText(mv.left + '/' + mv.pp, 64, 86);
    ctx.textAlign = 'left';
  } else if (menu.type === 'bag') {
    pkBox(8, 40, 152, 58);
  } else if (menu.type === 'box') {
    pkBox(...menu.box);
  }

  menu.items.forEach((it, i) => {
    let label = it.label;
    if (it.count !== undefined) label = label.padEnd(13) + '×' + it.count;
    pkText(label, it.x, it.y, menu.type === 'moves' && menu.mon.moves[i].left <= 0 ? '#888888' : PK_COLORS.k);
  });
  // cursore ▶
  const cur = menu.items[menu.cursor];
  if (cur) {
    const cx = cur.x - 8, cy = cur.y;
    ctx.fillStyle = PK_COLORS.k;
    for (let r = 0; r < 4; r++) ctx.fillRect(cx + 1, cy + r, r + 1, 1), ctx.fillRect(cx + 1, cy + 7 - r, r + 1, 1);
  }
}
