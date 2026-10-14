// Minigioco "Palle di neve" (domande con q.snowball).
// A turni contro il computer: tocca il tuo omino rosso e, senza staccare il dito,
// trascina all'indietro per mirare (vedi Forza e Angolo); lascia per lanciare.
// Chi finisce l'energia perde. Se perdi è Bad News.
//
// Mondo in metri (y verso l'alto), disegnato su canvas con contorni a inchiostro.

const SB_G        = 20;     // gravità (m/s²)
const SB_VMAX     = 34;     // velocità a forza 100% (m/s)
const SB_BALL_R   = 0.18;   // raggio della palla (m)
const SB_DRAG_MAX = 0.42;   // trascinamento per forza 100% (frazione del lato corto dello schermo)
const SB_INK      = '#2a2622';
const SB_RED      = '#e8574a';
const SB_BLUE     = '#3fa9e0';

const SB_LEVELS = {
  facile:    { dist: [20, 26], heights: [-1, 1.5],  aiError: 0.14,  dmgBody: 34, dmgHead: 50 },
  normale:   { dist: [26, 34], heights: [-1.5, 2.5], aiError: 0.085, dmgBody: 25, dmgHead: 40 },
  difficile: { dist: [32, 40], heights: [-2, 3.5],  aiError: 0.05,  dmgBody: 20, dmgHead: 34 },
};

let sb = null; // partita in corso

const sbRand = (a, b) => a + Math.random() * (b - a);

// ─── Avvio / stop ────────────────────────────────────────────────────────────

function startSnowball(q, waitIntro = false) {
  stopSnowball();
  const level = SB_LEVELS[q.snowball && q.snowball.difficulty] || SB_LEVELS.normale;
  const dist = sbRand(...level.dist);
  const foeY = sbRand(...level.heights);

  const stage  = document.getElementById('snowball-stage');
  const canvas = document.getElementById('snowball-canvas');

  sb = {
    q, level, stage, canvas,
    ctx: canvas.getContext('2d'),
    w: 0, h: 0, scale: 40, time: 0,
    players: [sbFighter(0, 0, 1, SB_RED), sbFighter(dist, foeY, -1, SB_BLUE)],
    platforms: [
      { x1: -80, x2: 1.4, y: 0 },
      { x1: dist - 1.4, x2: dist + 80, y: foeY },
    ],
    scenery: sbScenery(dist),
    flakes: Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), r: sbRand(1.5, 3.5), v: sbRand(0.02, 0.06) })),
    turn: 0,
    phase: waitIntro ? 'intro' : 'aim', // intro | aim | flying | wait | enemy | over
    timer: 0,
    enemyThrows: 0,
    ball: null, particles: [], floats: [],
    aim: null, hint: true, focus: null,
    cam: { x: 3, y: 0 },
    raf: 0, last: 0,
  };

  document.getElementById('screen-game').classList.add('snowball-mode');
  stage.classList.add('active');
  stage.classList.toggle('vision-blur', hasItem('occhiali_rotti'));
  document.getElementById('sb-question').textContent = q.text;

  sbResize();
  sb.cam.x = sbCamTarget().x;
  sbUpdateHud();
  sbSetTurnText();
  sb.last = performance.now();
  sb.raf = requestAnimationFrame(sbLoop);
}

// Dopo la schermata del falò
function snowballBegin() {
  if (sb && sb.phase === 'intro') {
    sb.phase = 'aim';
    sbSetTurnText();
  }
}

function stopSnowball() {
  if (!sb) return;
  cancelAnimationFrame(sb.raf);
  sb.stage.classList.remove('active', 'vision-blur');
  document.getElementById('screen-game').classList.remove('snowball-mode');
  sb = null;
}

function sbFighter(x, y, dir, color) {
  return { x, y, dir, color, hp: 100, hitT: 0, throwT: 0, dead: false, deadT: 0, knock: null };
}

function sbScenery(dist) {
  const clouds = [], hills = [];
  for (let x = -40; x < dist + 50; x += sbRand(7, 12)) clouds.push({ x, y: sbRand(7, 13), s: sbRand(0.8, 1.4) });
  for (let x = -40; x < dist + 60; x += sbRand(5, 8))  hills.push({ x, hgt: sbRand(4, 10), wid: sbRand(6, 10) });
  return { clouds, hills };
}

function sbResize() {
  if (!sb) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = sb.stage.getBoundingClientRect();
  sb.w = r.width;
  sb.h = r.height;
  sb.canvas.width  = Math.round(sb.w * dpr);
  sb.canvas.height = Math.round(sb.h * dpr);
  sb.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sb.scale = Math.min(sb.w / 11, sb.h / 19); // ~11 m visibili in larghezza su telefono
}

window.addEventListener('resize', sbResize);

// ─── Coordinate ──────────────────────────────────────────────────────────────

function sbToScreen(x, y) {
  return { x: sb.w / 2 + (x - sb.cam.x) * sb.scale, y: sb.h * 0.62 - (y - sb.cam.y) * sb.scale };
}

function sbHand(f) {
  return { x: f.x + 0.35 * f.dir, y: f.y + 1.45 };
}

// ─── HUD (HTML) ──────────────────────────────────────────────────────────────

function sbUpdateHud() {
  document.getElementById('sb-hp-0').style.width = sb.players[0].hp + '%';
  document.getElementById('sb-hp-1').style.width = sb.players[1].hp + '%';
}

function sbSetTurnText(text) {
  const el = document.getElementById('sb-turn');
  if (text === undefined) {
    if (sb.phase === 'aim')        text = sb.hint ? 'Tocca il tuo omino e trascina indietro ↩' : 'Tocca a te!';
    else if (sb.phase === 'enemy') text = 'Tocca all\'avversario…';
    else text = '';
  }
  el.textContent = text;
  el.style.visibility = text ? 'visible' : 'hidden';
}

// ─── Input: mira a fionda ────────────────────────────────────────────────────

function sbPointer(e) {
  const r = sb.canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function sbComputeAim() {
  const a = sb.aim;
  const dx = a.sx - a.cx; // trascino indietro → lancio in avanti
  const dy = a.cy - a.sy; // trascino in basso → lancio verso l'alto
  const maxLen = Math.min(sb.w, sb.h) * SB_DRAG_MAX;
  a.force = Math.min(Math.hypot(dx, dy) / maxLen, 1);
  a.angle = Math.max(0, Math.min(85, Math.atan2(dy, dx) * 180 / Math.PI));
}

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('snowball-canvas');
  if (!canvas) return;

  canvas.addEventListener('pointerdown', (e) => {
    if (!sb || sb.phase !== 'aim' || !gameActive) return;
    const p = sbPointer(e);
    const me = sb.players[0];
    const c = sbToScreen(me.x, me.y + 0.9);
    // Bisogna partire dal proprio omino (con un po' di tolleranza per il dito)
    if (Math.hypot(p.x - c.x, p.y - c.y) > Math.max(1.5 * sb.scale, 60)) return;
    sb.aim = { sx: p.x, sy: p.y, cx: p.x, cy: p.y, force: 0, angle: 0 };
    if (sb.hint) { sb.hint = false; sbSetTurnText(); }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {} // il dito resta "agganciato" anche fuori dal canvas
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!sb || !sb.aim) return;
    const p = sbPointer(e);
    sb.aim.cx = p.x;
    sb.aim.cy = p.y;
    sbComputeAim();
  });

  canvas.addEventListener('pointerup', () => {
    if (!sb || !sb.aim) return;
    const a = sb.aim;
    sb.aim = null;
    if (a.force >= 0.08 && sb.phase === 'aim' && gameActive) sbThrow(0, a.force, a.angle);
  });

  canvas.addEventListener('pointercancel', () => { if (sb) sb.aim = null; });
});

// ─── Lanci ───────────────────────────────────────────────────────────────────

function sbThrow(who, force, angleDeg) {
  const f = sb.players[who];
  const hand = sbHand(f);
  const v = force * SB_VMAX;
  const a = angleDeg * Math.PI / 180;
  sb.ball = { x: hand.x, y: hand.y, vx: Math.cos(a) * v * f.dir, vy: Math.sin(a) * v, owner: who };
  f.throwT = 0.3;
  sb.phase = 'flying';
  sbSetTurnText('');
  playTone(520, 'sine', getAudioCtx().currentTime, 0.12, 0.15);
}

function sbEnemyThrow() {
  const e = sb.players[1], p = sb.players[0];
  const hand = sbHand(e);
  const dx = hand.x - p.x;            // distanza orizzontale (l'avversario tira verso sinistra)
  const dy = (p.y + 1.0) - hand.y;     // punta al busto
  let a = sbRand(28, 58) * Math.PI / 180;
  let v2 = SB_G * dx * dx / (2 * Math.cos(a) ** 2 * (dx * Math.tan(a) - dy));
  if (!(v2 > 0)) {
    a = 60 * Math.PI / 180;
    v2 = SB_G * dx * dx / (2 * Math.cos(a) ** 2 * (dx * Math.tan(a) - dy));
  }
  // Errore casuale che si riduce a ogni tiro: l'avversario "prende le misure"
  const learn = Math.max(0.45, 1 - 0.15 * sb.enemyThrows);
  const noise = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // circa -1..1
  const v = Math.min(Math.sqrt(v2) * (1 + noise * sb.level.aiError * 2 * learn), SB_VMAX);
  sb.enemyThrows++;
  sbThrow(1, v / SB_VMAX, a * 180 / Math.PI);
}

// ─── Simulazione ─────────────────────────────────────────────────────────────

function sbStep(dt) {
  sb.time += dt;

  for (const f of sb.players) {
    f.hitT = Math.max(0, f.hitT - dt);
    f.throwT = Math.max(0, f.throwT - dt);
    if (f.dead) f.deadT += dt;
    if (f.knock) {
      f.knock.t += dt;
      const k = Math.min(f.knock.t / 0.25, 1);
      f.x = f.knock.from + (f.knock.to - f.knock.from) * (1 - (1 - k) * (1 - k));
      if (k >= 1) f.knock = null;
    }
  }

  sb.particles = sb.particles.filter(p => (p.life -= dt) > 0);
  for (const p of sb.particles) {
    p.vy -= SB_G * 0.5 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  sb.floats = sb.floats.filter(t => (t.life -= dt) > 0);
  for (const t of sb.floats) t.y += 1.2 * dt;

  if (sb.phase === 'flying' && sb.ball) {
    sbStepBall(dt);
  } else if (sb.phase === 'wait' || sb.phase === 'enemy') {
    sb.timer -= dt;
    if (sb.timer <= 0) {
      if (sb.phase === 'wait') sbNextTurn();
      else sbEnemyThrow();
    }
  }
}

function sbStepBall(dt) {
  const b = sb.ball;
  b.vy -= SB_G * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (Math.random() < 0.08) sb.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.35, r: 0.07 });

  const target = sb.players[1 - b.owner];
  const head = { x: target.x + 0.02 * target.dir, y: target.y + 1.62 };
  if (Math.hypot(b.x - head.x, b.y - head.y) < 0.42 + SB_BALL_R) return sbHit(target, true);
  if (Math.abs(b.x - target.x) < 0.45 + SB_BALL_R && b.y > target.y && b.y < target.y + 1.3 + SB_BALL_R) {
    return sbHit(target, false);
  }
  for (const p of sb.platforms) {
    if (b.x >= p.x1 && b.x <= p.x2 && b.y - SB_BALL_R <= p.y) return sbMiss(b.x, p.y);
  }
  if (b.y < -30) return sbMiss(null, 0); // caduta nel vuoto
}

function sbBurst(x, y, n) {
  for (let i = 0; i < n; i++) {
    sb.particles.push({ x, y, vx: sbRand(-4, 4), vy: sbRand(1, 6), life: sbRand(0.4, 0.8), r: sbRand(0.05, 0.12) });
  }
}

function sbHit(target, head) {
  const b = sb.ball;
  sb.ball = null;
  const dmg = head ? sb.level.dmgHead : sb.level.dmgBody;
  target.hp = Math.max(0, target.hp - dmg);
  target.hitT = 0.4;
  // Rinculo: arretra leggermente nella direzione del colpo
  target.knock = { from: target.x, to: target.x + Math.sign(b.vx) * 0.6, t: 0 };
  sbBurst(b.x, b.y, 18);
  sb.floats.push({ text: (head ? 'In testa! ' : '') + '-' + dmg, x: target.x, y: target.y + 2.4, life: 1.2 });
  const t = getAudioCtx().currentTime;
  playTone(160, 'square', t, 0.12, 0.2);
  playTone(90, 'sine', t + 0.05, 0.2, 0.25);
  sbUpdateHud();
  sb.focus = { x: target.x, y: target.y };

  if (target.hp <= 0) {
    target.dead = true;
    sb.phase = 'over';
    sbEnd(target === sb.players[1]);
  } else {
    sb.phase = 'wait';
    sb.timer = 1.1;
  }
}

function sbMiss(x, y) {
  const b = sb.ball;
  sb.ball = null;
  if (x !== null) sbBurst(x, y + 0.1, 12);
  sb.floats.push({ text: 'Mancato!', x: x !== null ? x : b.x, y: (x !== null ? y : 0) + 1.5, life: 1 });
  playTone(220, 'triangle', getAudioCtx().currentTime, 0.15, 0.15);
  sb.focus = { x: x !== null ? x : b.x, y: x !== null ? y : 0 };
  sb.phase = 'wait';
  sb.timer = 0.9;
}

function sbNextTurn() {
  sb.turn = 1 - sb.turn;
  sb.focus = null;
  if (sb.turn === 1) {
    sb.phase = 'enemy';
    sb.timer = 1.2; // la telecamera raggiunge l'avversario, che "prende la mira"
  } else {
    sb.phase = 'aim';
  }
  sbSetTurnText();
}

function sbEnd(won) {
  sbSetTurnText(won ? 'Hai vinto la sfida! ⛄' : 'Colpito e affondato…');
  if (!won) playWrong();
  setTimeout(() => {
    if (!sb) return;
    if (won) {
      const opt = sb.q.options.find(o => o.correct);
      if (opt) handleAnswer(opt, document.createElement('div')); // prosegue come una risposta giusta
      else { gameActive = false; stopSnowball(); showWin(); }
    } else {
      gameActive = false;
      stopSnowball();
      playGameOver();
      showGameOver('snowball');
    }
  }, 1600);
}

// ─── Telecamera ──────────────────────────────────────────────────────────────

function sbCamTarget() {
  const me = sb.players[0], foe = sb.players[1];
  const lead = (sb.w / sb.scale) * 0.18; // spazio davanti a chi tira

  if (sb.ball) {
    const owner = sb.players[sb.ball.owner], target = sb.players[1 - sb.ball.owner];
    const prog = Math.min(Math.max((sb.ball.x - owner.x) / (target.x - owner.x), 0), 1);
    const ground = owner.y + (target.y - owner.y) * prog;
    const upRoom = (sb.h * 0.62 - 140) / sb.scale;
    return { x: sb.ball.x, y: Math.max(ground, sb.ball.y - upRoom) };
  }
  if (sb.focus) return sb.focus;
  if (sb.phase === 'over') {
    const loser = me.dead ? me : foe;
    return { x: loser.x, y: loser.y };
  }
  return sb.turn === 0 ? { x: me.x + lead, y: me.y } : { x: foe.x - lead, y: foe.y };
}

function sbCamera(dt) {
  const t = sbCamTarget();
  const k = 1 - Math.exp(-dt * (sb.ball ? 9 : 3.5));
  sb.cam.x += (t.x - sb.cam.x) * k;
  sb.cam.y += (t.y - sb.cam.y) * k;
}

// ─── Loop ────────────────────────────────────────────────────────────────────

function sbLoop(now) {
  if (!sb) return;
  const dt = Math.min((now - sb.last) / 1000, 0.05);
  sb.last = now;
  for (let i = 0; i < 4; i++) sbStep(dt / 4);
  if (!sb) return;
  sbCamera(dt);
  sbDraw();
  sb.raf = requestAnimationFrame(sbLoop);
}

// ─── Disegno ─────────────────────────────────────────────────────────────────

function sbRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sbDraw() {
  const { ctx, w, h } = sb;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#9fd6f5');
  sky.addColorStop(1, '#e3f3fc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  sbDrawScenery();
  sbDrawFlakes();
  for (const p of sb.platforms) sbDrawPlatform(p);
  sb.players.forEach(sbDrawFighter);
  sbDrawBall();
  sbDrawParticles();
  sbDrawAim();
  sbDrawFloats();
  sb.players.forEach(sbDrawIndicator);
}

function sbDrawScenery() {
  const { ctx, scale } = sb;
  const groundY = sb.h * 0.62;

  // Colline lontane (parallasse)
  const fH = 0.45;
  ctx.lineWidth = 2;
  for (const m of sb.scenery.hills) {
    const sx = sb.w / 2 + (m.x - sb.cam.x * fH) * scale;
    const half = m.wid / 2 * scale;
    if (sx + half < -10 || sx - half > sb.w + 10) continue;
    const base = groundY + (sb.cam.y * fH) * scale + scale;
    ctx.beginPath();
    ctx.moveTo(sx - half, base);
    ctx.quadraticCurveTo(sx, base - 2 * m.hgt * scale, sx + half, base);
    ctx.closePath();
    ctx.fillStyle = '#b3d9f1';
    ctx.fill();
    ctx.strokeStyle = 'rgba(42, 38, 34, 0.22)';
    ctx.stroke();
  }

  // Nuvole (parallasse più lenta): contorno solo all'esterno
  const fC = 0.2;
  for (const c of sb.scenery.clouds) {
    const sx = sb.w / 2 + (c.x - sb.cam.x * fC) * scale;
    const sy = groundY - (c.y - sb.cam.y * fC) * scale;
    const r = 0.9 * c.s * scale;
    if (sx + 3 * r < 0 || sx - 3 * r > sb.w) continue;
    const puffs = [[-1.3 * r, 0.25 * r, 0.75 * r], [0, 0, r], [1.3 * r, 0.25 * r, 0.75 * r]];
    ctx.strokeStyle = 'rgba(42, 38, 34, 0.35)';
    ctx.lineWidth = 5;
    puffs.forEach(([dx, dy, pr]) => { ctx.beginPath(); ctx.arc(sx + dx, sy + dy, pr, 0, Math.PI * 2); ctx.stroke(); });
    ctx.fillStyle = '#ffffff';
    puffs.forEach(([dx, dy, pr]) => { ctx.beginPath(); ctx.arc(sx + dx, sy + dy, pr, 0, Math.PI * 2); ctx.fill(); });
  }
}

function sbDrawFlakes() {
  const { ctx } = sb;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (const f of sb.flakes) {
    f.y += f.v / 60;
    if (f.y > 1) { f.y = -0.02; f.x = Math.random(); }
    const x = ((f.x * sb.w - sb.cam.x * sb.scale * 0.3) % sb.w + sb.w) % sb.w;
    ctx.beginPath();
    ctx.arc(x, f.y * sb.h, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function sbDrawPlatform(p) {
  const { ctx, scale } = sb;
  const tl = sbToScreen(p.x1, p.y), tr = sbToScreen(p.x2, p.y);
  const L = Math.max(tl.x, -40), R = Math.min(tr.x, sb.w + 40);
  if (R <= L) return;
  const top = tl.y;
  const snow = 0.5 * scale;
  const lw = Math.max(2.5, scale * 0.07);
  // Bordi sul vuoto leggermente obliqui
  const slantL = tl.x >= -40 ? 0.9 * scale : 0;
  const slantR = tr.x <= sb.w + 40 ? -0.9 * scale : 0;

  // Roccia (la forma serve tre volte: riempimento, ritaglio del tratteggio, contorno)
  const rockPath = () => {
    ctx.beginPath();
    ctx.moveTo(L, top + snow);
    ctx.lineTo(R, top + snow);
    ctx.lineTo(R + slantR, sb.h + 20);
    ctx.lineTo(L + slantL, sb.h + 20);
    ctx.closePath();
  };
  rockPath();
  ctx.fillStyle = '#4766b0';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 0.4 * scale;
  for (let x = L - sb.h; x < R + sb.h; x += 1.1 * scale) {
    ctx.beginPath();
    ctx.moveTo(x, top + snow);
    ctx.lineTo(x + (sb.h - top), sb.h + 20);
    ctx.stroke();
  }
  ctx.restore();
  // restore() non ripristina il percorso: senza ricostruirlo verrebbe ripassata
  // in nero l'ultima riga del tratteggio, fuori dalla roccia
  rockPath();
  ctx.strokeStyle = SB_INK;
  ctx.lineWidth = lw;
  ctx.stroke();

  // Neve
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(L, top, R - L, snow);
  ctx.strokeRect(L, top, R - L, snow);
}

function sbDrawFighter(f) {
  const { ctx, scale: s } = sb;
  const feet = sbToScreen(f.x, f.y);
  if (feet.x < -3 * s || feet.x > sb.w + 3 * s) return;

  const isTurn = (sb.turn === 0 && f === sb.players[0]) || (sb.turn === 1 && f === sb.players[1]);
  const ready = isTurn && !sb.ball && !f.dead && ['intro', 'aim', 'enemy'].includes(sb.phase);
  const lw = Math.max(2, s * 0.07);

  ctx.save();
  ctx.translate(feet.x, feet.y);
  ctx.scale(f.dir, 1);
  let tilt = 0;
  if (f.dead) tilt = -Math.min(f.deadT * 3, 1) * Math.PI / 2 * 0.95; // cade all'indietro
  else if (f.hitT > 0) tilt = -0.3 * (f.hitT / 0.4);
  ctx.rotate(tilt);
  if (f.hitT > 0 && Math.floor(f.hitT * 20) % 2) ctx.globalAlpha = 0.55;

  ctx.lineWidth = lw;
  ctx.strokeStyle = SB_INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const bob = f.dead ? 0 : Math.sin(sb.time * 3 + f.dir) * 0.03 * s;

  // Gambe e scarponi
  ctx.fillStyle = SB_INK;
  sbRoundRect(ctx, -0.34 * s, -0.16 * s, 0.28 * s, 0.16 * s, 0.05 * s); ctx.fill();
  sbRoundRect(ctx,  0.06 * s, -0.16 * s, 0.28 * s, 0.16 * s, 0.05 * s); ctx.fill();
  ctx.fillStyle = f.color;
  ctx.fillRect(-0.28 * s, -0.6 * s, 0.2 * s, 0.46 * s); ctx.strokeRect(-0.28 * s, -0.6 * s, 0.2 * s, 0.46 * s);
  ctx.fillRect( 0.08 * s, -0.6 * s, 0.2 * s, 0.46 * s); ctx.strokeRect( 0.08 * s, -0.6 * s, 0.2 * s, 0.46 * s);

  // Braccio dietro
  sbDrawArm(f, -0.15 * s, -1.1 * s + bob, -0.5, false);

  // Giaccone imbottito
  ctx.fillStyle = f.color;
  sbRoundRect(ctx, -0.44 * s, -1.34 * s + bob, 0.88 * s, 0.82 * s, 0.32 * s);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(42, 38, 34, 0.35)';
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath(); ctx.moveTo(-0.3 * s, -0.95 * s + bob); ctx.lineTo(0.3 * s, -0.95 * s + bob); ctx.stroke();
  ctx.strokeStyle = SB_INK;
  ctx.lineWidth = lw;

  // Testa: cappuccio bianco, viso, frangia, occhi
  const hy = -1.66 * s + bob;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0.02 * s, hy, 0.42 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f6c9a0';
  sbRoundRect(ctx, -0.06 * s, hy - 0.16 * s, 0.38 * s, 0.34 * s, 0.09 * s); ctx.fill();
  ctx.fillStyle = SB_INK;
  sbRoundRect(ctx, -0.06 * s, hy - 0.16 * s, 0.38 * s, 0.1 * s, 0.05 * s); ctx.fill();
  if (f.dead || f.hitT > 0) {
    // occhi a X
    ctx.lineWidth = lw * 0.6;
    [[0.1, 0], [0.23, 0]].forEach(([ex]) => {
      ctx.beginPath();
      ctx.moveTo((ex - 0.03) * s, hy - 0.02 * s); ctx.lineTo((ex + 0.03) * s, hy + 0.06 * s);
      ctx.moveTo((ex + 0.03) * s, hy - 0.02 * s); ctx.lineTo((ex - 0.03) * s, hy + 0.06 * s);
      ctx.stroke();
    });
  } else {
    ctx.fillRect(0.08 * s, hy - 0.02 * s, 0.045 * s, 0.09 * s);
    ctx.fillRect(0.21 * s, hy - 0.02 * s, 0.045 * s, 0.09 * s);
  }

  // Braccio che lancia (sopra la testa, così la palla in mano si vede):
  // pronto = indietro con la palla, poi lancio in avanti, poi riposo
  let armA = 0.35;
  if (f.throwT > 0) { const k = 1 - f.throwT / 0.3; armA = -1.9 + k * 3.5; }
  else if (ready) armA = -1.9;
  ctx.lineWidth = lw;
  sbDrawArm(f, 0.1 * s, -1.12 * s + bob, armA, ready && f.throwT === 0);
  ctx.restore();
}

function sbDrawArm(f, sx, sy, angle, holdingBall) {
  const { ctx, scale: s } = sb;
  const len = 0.55 * s;
  const ex = sx + Math.sin(angle) * len;
  const ey = sy + Math.cos(angle) * len;
  ctx.lineWidth = 0.24 * s;
  ctx.strokeStyle = SB_INK;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.lineWidth = 0.16 * s;
  ctx.strokeStyle = f.color;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.strokeStyle = SB_INK;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(ex, ey, 0.1 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (holdingBall) {
    ctx.beginPath(); ctx.arc(ex, ey - 0.12 * s, SB_BALL_R * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

function sbDrawBall() {
  if (!sb.ball) return;
  const { ctx } = sb;
  const p = sbToScreen(sb.ball.x, sb.ball.y);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = SB_INK;
  ctx.lineWidth = Math.max(2, sb.scale * 0.06);
  ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(SB_BALL_R * sb.scale, 5), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function sbDrawParticles() {
  const { ctx } = sb;
  for (const p of sb.particles) {
    const sp = sbToScreen(p.x, p.y);
    ctx.globalAlpha = Math.min(p.life * 2, 1);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(42, 38, 34, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(p.r * sb.scale, 2), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function sbDrawAim() {
  const { ctx } = sb;
  const me = sb.players[0];

  // Cerchio che invita a toccare l'omino
  if (sb.phase === 'aim' && !sb.aim && sb.hint) {
    const c = sbToScreen(me.x, me.y + 0.9);
    const r = (1.2 + Math.sin(sb.time * 5) * 0.12) * sb.scale;
    ctx.strokeStyle = 'rgba(232, 87, 74, 0.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  const a = sb.aim;
  if (!a) return;

  // Primo tratto della traiettoria
  const hand = sbHand(me);
  const v = a.force * SB_VMAX, ang = a.angle * Math.PI / 180;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = SB_INK;
  ctx.lineWidth = 1.5;
  for (let t = 0.06, i = 0; t < 0.5; t += 0.06, i++) {
    const p = sbToScreen(hand.x + Math.cos(ang) * v * t, hand.y + Math.sin(ang) * v * t - 0.5 * SB_G * t * t);
    ctx.globalAlpha = 1 - i * 0.1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Riquadro Forza / Angolo sopra l'omino
  const c = sbToScreen(me.x, me.y + 2.5);
  const bw = 132, bh = 52;
  const bx = Math.min(Math.max(c.x - bw / 2, 8), sb.w - bw - 8), by = c.y - bh;
  ctx.fillStyle = '#fdf8ec';
  ctx.strokeStyle = SB_INK;
  ctx.lineWidth = 2.5;
  sbRoundRect(ctx, bx, by, bw, bh, 12); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + bw / 2, by + 9); ctx.lineTo(bx + bw / 2, by + bh - 9); ctx.stroke();
  ctx.fillStyle = SB_INK;
  ctx.textAlign = 'center';
  ctx.font = "bold 21px 'Patrick Hand', sans-serif";
  ctx.fillText(Math.round(a.force * 100) + '%', bx + bw / 4, by + 25);
  ctx.fillText(Math.round(a.angle) + '°', bx + bw * 3 / 4, by + 25);
  ctx.font = "14px 'Patrick Hand', sans-serif";
  ctx.fillStyle = '#6b6157';
  ctx.fillText('Forza', bx + bw / 4, by + 43);
  ctx.fillText('Angolo', bx + bw * 3 / 4, by + 43);
}

function sbDrawFloats() {
  const { ctx } = sb;
  ctx.textAlign = 'center';
  ctx.font = "bold 24px 'Patrick Hand', sans-serif";
  ctx.lineWidth = 4;
  ctx.strokeStyle = SB_INK;
  for (const t of sb.floats) {
    const p = sbToScreen(t.x, t.y);
    ctx.globalAlpha = Math.min(t.life * 2, 1);
    ctx.fillStyle = t.text === 'Mancato!' ? '#ffffff' : '#fbe7a1';
    ctx.strokeText(t.text, p.x, p.y);
    ctx.fillText(t.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

// Indicatore a bordo schermo per l'omino fuori inquadratura
function sbDrawIndicator(f) {
  const { ctx } = sb;
  const p = sbToScreen(f.x, f.y + 0.9);
  if (p.x > -10 && p.x < sb.w + 10) return;
  const left = p.x < 0;
  const x = left ? 38 : sb.w - 38;
  const y = Math.min(Math.max(p.y, 140), sb.h - 70);

  // freccia verso l'esterno
  ctx.fillStyle = f.color;
  ctx.beginPath();
  if (left) { ctx.moveTo(4, y); ctx.lineTo(16, y - 9); ctx.lineTo(16, y + 9); }
  else { ctx.moveTo(sb.w - 4, y); ctx.lineTo(sb.w - 16, y - 9); ctx.lineTo(sb.w - 16, y + 9); }
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = f.color;
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // mini viso
  ctx.fillStyle = '#f6c9a0';
  ctx.fillRect(x - 7, y - 12, 14, 12);
  ctx.fillStyle = SB_INK;
  ctx.fillRect(x - 7, y - 12, 14, 4);
  ctx.fillRect(x - 4, y - 7, 2, 4);
  ctx.fillRect(x + 2, y - 7, 2, 4);
  const dist = Math.round(Math.abs(sb.players[1].x - sb.players[0].x));
  ctx.textAlign = 'center';
  ctx.font = "bold 12px 'Patrick Hand', sans-serif";
  ctx.fillText(dist + 'm', x, y + 15);
}
