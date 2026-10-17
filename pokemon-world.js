// Minigioco "⚔️ Palestra", versione B: l'avventura da esplorare (percorsi, grotta, CENTRO POKéMON,
// palestre). Usa il motore di pokemon.js per le lotte, i testi e i menu.
// Una tappa = una domanda: le mappe, i personaggi e le creature arrivano in q.pokemon.data
// (l'admin li compone da pokemon-data.js). Si gioca a caselle di 16×16 sullo schermo 160×144.

const PKW_DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const PKW_BACK = { up: 'down', down: 'up', left: 'right', right: 'left' };
// Caselle dove si cammina ('D' ed 'E' solo se c'è un warp)
const PKW_WALK = new Set(['.', ',', '"', 'f', '_', 'm', ':', 'I', 'L']);
const PKW_STEP = 0.2;   // secondi per un passo
const PKW_SLIDE = 0.09; // secondi per casella sul ghiaccio

// ─── Caselle (disegnate in pixel, niente immagini) ──────────────────────────

const PKW_PAL = {
  k: '#181818', w: '#f8f8f8',
  grass: '#90d070', grassD: '#68b050', tall: '#58b048', tallL: '#a0e070', tallD: '#2c7030',
  path: '#e8d8a8', pathD: '#d0bc88', tree: '#2f7a3a', treeL: '#58a848', treeD: '#1c4a24', trunk: '#7a4a28',
  water: '#5898f0', waterL: '#a8d8f8', rock: '#b09070', rockD: '#7a6048', rockL: '#d0b898',
  roofR: '#e05048', roofRD: '#a02828', roofG: '#7880a8', roofGD: '#4a5078',
  wall: '#f0e8d0', wallD: '#c8b898', glass: '#78b8f0', door: '#4a3030',
  floor: '#f0e0b8', floorD: '#dcc894', iwall: '#b8a8d8', iwallD: '#8878b0',
  counter: '#d07050', counterL: '#f0a080',
  cave: '#c8a878', caveD: '#a88858', cwall: '#786048', cwallD: '#4c3c2c', cwallL: '#9a8060',
  ice: '#c8eef8', iceL: '#ffffff', iceD: '#98d0e8',
};

// put(x, y, w, h, colore) disegna; ground è il fondo della mappa (per cartelli, sassi…)
function pkwPaintTile(ch, ground, put) {
  const P = PKW_PAL;
  const fill = (c) => put(0, 0, 16, 16, c);
  const circle = (cx, cy, r, c, cond) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r && (!cond || cond(x, y))) put(x, y, 1, 1, c);
    }
  };
  const dots = (pts, c) => pts.forEach(([x, y]) => put(x, y, 1, 1, c));
  const stamp = (rows, map, ox, oy) => rows.forEach((r, y) => [...r].forEach((c, x) => { if (map[c]) put(ox + x, oy + y, 1, 1, map[c]); }));
  const base = (c) => pkwPaintTile(c, ground, put);

  switch (ch) {
    case '.': fill(P.grass); dots([[2, 3], [3, 2], [4, 3], [10, 10], [11, 9], [12, 10], [6, 13], [13, 4]], P.grassD); break;
    case ',': fill(P.path); dots([[3, 5], [11, 2], [7, 12], [13, 13], [1, 10], [9, 7]], P.pathD); break;
    case 'f': {
      base('.');
      const flower = (x, y, c) => { put(x, y - 1, 1, 1, c); put(x - 1, y, 3, 1, c); put(x, y + 1, 1, 1, c); put(x, y, 1, 1, '#f8e050'); };
      flower(4, 4, '#f05858'); flower(11, 11, P.w); flower(12, 4, '#f05858');
      break;
    }
    case '"': {
      fill(P.tall);
      const tuft = ['..L....', '.LD..L.', 'LDL.LDL', 'DLD.DLD', '.D.D.D.'];
      [[0, 1], [8, 1], [0, 9], [8, 9]].forEach(([x, y]) => stamp(tuft, { L: P.tallL, D: P.tallD }, x, y));
      break;
    }
    case '~':
      fill(P.water);
      put(2, 4, 4, 1, P.waterL); put(6, 3, 2, 1, P.waterL); put(10, 11, 4, 1, P.waterL); put(14, 10, 2, 1, P.waterL); put(8, 7, 2, 1, P.waterL);
      break;
    case 'T':
      base('.');
      circle(8, 7, 7, P.k); circle(8, 7, 6, P.tree); circle(6, 5, 2.5, P.treeL);
      dots([[10, 10], [11, 9], [12, 8], [9, 11], [12, 6]], P.treeD);
      put(6, 13, 4, 3, P.k); put(7, 13, 2, 3, P.trunk);
      break;
    case 'S':
      base(ground);
      put(6, 10, 4, 6, P.k); put(7, 10, 2, 6, P.trunk);
      put(2, 2, 12, 8, P.k); put(3, 3, 10, 6, '#d8a050'); put(4, 5, 8, 1, '#a06830'); put(4, 7, 6, 1, '#a06830');
      break;
    case 'R':
      fill(P.rock); put(0, 0, 16, 2, P.rockL); put(0, 8, 16, 1, P.rockD); put(4, 2, 1, 6, P.rockD); put(11, 9, 1, 7, P.rockD);
      dots([[8, 4], [2, 12], [14, 4], [7, 12]], P.rockD); put(0, 15, 16, 1, P.rockD);
      break;
    case 'E':
      base(ground === ':' ? 'B' : 'R');
      put(3, 5, 10, 11, P.k); put(4, 3, 8, 2, P.k); put(5, 2, 6, 1, P.k);
      break;
    case 'r': fill(P.roofR); [3, 7, 11, 15].forEach(y => put(0, y, 16, 1, P.roofRD)); break;
    case 'G': fill(P.roofG); [3, 7, 11, 15].forEach(y => put(0, y, 16, 1, P.roofGD)); break;
    case 'W': fill(P.wall); put(0, 0, 16, 1, P.wallD); put(0, 15, 16, 1, P.wallD); break;
    case 'O':
      base('W'); put(3, 3, 10, 9, P.k); put(4, 4, 8, 7, P.glass); put(8, 4, 1, 7, P.k); put(4, 7, 8, 1, P.k); put(5, 5, 2, 1, '#d0f0ff');
      break;
    case 'P':
      base('W'); circle(8, 8, 6, P.k); circle(8, 8, 5, '#e04040'); circle(8, 8, 5, P.w, (x, y) => y >= 8);
      put(3, 7, 10, 2, P.k); circle(8, 8, 2.2, P.k); circle(8, 8, 1.2, P.w);
      break;
    case 'M':
      base('W'); put(2, 4, 12, 8, P.k); put(3, 5, 10, 6, '#e0b840'); put(5, 7, 6, 1, '#a07820'); put(5, 9, 4, 1, '#a07820');
      break;
    case 'D':
      base('W'); put(2, 1, 12, 15, P.k); put(3, 2, 10, 14, P.door); put(3, 2, 10, 1, '#6a4a40');
      break;
    case '_': fill(P.floor); put(0, 15, 16, 1, P.floorD); put(15, 0, 1, 16, P.floorD); break;
    case '=': fill(P.iwall); put(7, 0, 1, 11, '#a898c8'); put(0, 11, 16, 5, P.iwallD); put(0, 11, 16, 1, '#6a5a90'); break;
    case 'C': fill(P.counter); put(0, 0, 16, 6, P.counterL); put(0, 6, 16, 1, P.k); put(0, 15, 16, 1, '#904030'); break;
    case 'm': base('_'); put(1, 3, 14, 11, '#c03838'); put(2, 4, 12, 9, '#e05858'); break;
    case 'X':
      base('_'); circle(8, 6, 6, P.k); circle(8, 6, 5, '#48a040'); circle(6, 4, 2, '#78c860');
      put(4, 11, 8, 5, P.k); put(5, 11, 6, 4, '#c06030');
      break;
    case 'H':
      base('_'); put(1, 1, 14, 14, P.k); put(2, 2, 12, 12, '#b0b0c0'); circle(5.5, 6, 2, '#e04040'); circle(10.5, 6, 2, '#e04040');
      put(3, 10, 10, 2, '#606070');
      break;
    case 'K':
      base('_'); put(2, 2, 12, 13, P.k); put(3, 3, 10, 11, '#a0a0b0'); put(4, 4, 8, 5, '#3060c0'); put(5, 5, 3, 1, '#a0c8f8');
      break;
    case 'Q':
      base('_'); put(3, 10, 10, 6, P.k); put(4, 11, 8, 4, '#909090'); circle(8, 6, 4.5, P.k); circle(8, 6, 3.5, '#b8b8b8'); put(7, 9, 2, 2, '#909090');
      break;
    case 'V':
      base('_'); put(3, 1, 10, 15, P.k); put(4, 2, 8, 13, '#a0602c'); put(4, 5, 8, 1, '#5a3010'); put(4, 11, 8, 1, '#5a3010'); put(6, 2, 1, 13, '#c07840');
      break;
    case ':': fill(P.cave); dots([[3, 4], [4, 4], [11, 9], [7, 13], [13, 2], [1, 11]], P.caveD); break;
    case 'B':
      fill(P.cwall); put(0, 0, 16, 3, P.cwallL); put(0, 3, 16, 1, P.cwallD); put(5, 4, 1, 5, P.cwallD); put(11, 7, 1, 9, P.cwallD);
      put(0, 10, 16, 1, P.cwallD); dots([[2, 6], [9, 13], [14, 5]], P.cwallL);
      break;
    case 'I':
      fill(P.ice); put(3, 3, 3, 1, P.iceL); put(4, 2, 1, 3, P.iceL); put(11, 10, 3, 1, P.iceL); put(12, 9, 1, 3, P.iceL);
      put(0, 15, 16, 1, P.iceD); put(15, 0, 1, 16, P.iceD);
      break;
    case 'k':
      base('I'); circle(8, 9, 6, P.k); circle(8, 9, 5, '#a09888'); circle(8, 9, 5, '#80786a', (x, y) => x + y > 19); circle(6, 7, 1.8, '#c8c0b0');
      break;
    case 'h': base(':'); circle(8, 8.5, 6.5, P.caveD); circle(8, 9, 5.5, '#101010'); break;
    case 'L':
      base(':'); put(4, 1, 1, 14, P.k); put(11, 1, 1, 14, P.k);
      [3, 7, 11].forEach(y => { put(4, y, 8, 1, '#a07040'); put(4, y + 1, 8, 1, P.k); });
      break;
    default: fill('#000000');
  }
}

// Oggetti che si muovono o si raccolgono (masso, sfera con lo strumento)
function pkwPaintThing(kind, put) {
  const P = PKW_PAL;
  const circle = (cx, cy, r, c, cond) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r && (!cond || cond(x, y))) put(x, y, 1, 1, c);
    }
  };
  if (kind === 'boulder') {
    circle(8, 8.5, 7.5, P.k); circle(8, 8.5, 6.5, '#a8a098'); circle(8, 8.5, 6.5, '#847c70', (x, y) => x + y > 19);
    circle(5.5, 5.5, 2, '#d0c8c0'); put(9, 6, 2, 1, '#847c70'); put(4, 11, 2, 1, '#847c70');
  } else if (kind === 'ball') {
    circle(8, 10, 4.5, P.k); circle(8, 10, 3.5, '#e04040', (x, y) => y < 10); circle(8, 10, 3.5, P.w, (x, y) => y >= 10);
    put(4, 10, 8, 1, P.k); put(7, 9, 2, 2, P.k); put(6, 7, 1, 1, '#f8a0a0');
  }
}

function pkwCanvas(key, paint) {
  if (pk.tiles[key]) return pk.tiles[key];
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const x = c.getContext('2d');
  paint((px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); });
  pk.tiles[key] = c;
  return c;
}
const pkwTile = (ch, ground) => pkwCanvas('t' + ch + ground, put => pkwPaintTile(ch, ground, put));
const pkwThing = (kind) => pkwCanvas('o' + kind, put => pkwPaintThing(kind, put));

// ─── Personaggi 16×16 (forme come gli sprite delle lotte, contorno automatico) ─

// dir: 'down' | 'up' | 'left' (a destra si specchia); frame: 0 fermo, 1 e 2 i due passi
function pkwCharDef(lookId, dir, frame) {
  const key = lookId + dir + frame;
  pk.charDefs = pk.charDefs || {};
  if (pk.charDefs[key]) return pk.charDefs[key];
  const L = (pk.data.looks && pk.data.looks[lookId]) || { style: 'short', hair: '#604030', skin: '#f0c0a0', shirt: '#6080c0', pants: '#303040' };
  const pal = { h: L.hair, s: L.skin, c: L.shirt, p: L.pants, q: L.cap || L.hair, t: L.capTop || L.cap || L.hair, o: L.shades || L.hair };
  const S = [];
  const side = dir === 'left';

  // gambe
  if (!side) {
    if (frame === 0) S.push(['r', 5, 13, 2, 2, 'p'], ['r', 9, 13, 2, 2, 'p']);
    else if (frame === 1) S.push(['r', 5, 13, 2, 3, 'p'], ['r', 9, 13, 2, 1, 'p']);
    else S.push(['r', 5, 13, 2, 1, 'p'], ['r', 9, 13, 2, 3, 'p']);
  } else if (frame === 0) S.push(['r', 6, 13, 4, 2, 'p']);
  else if (frame === 1) S.push(['r', 4, 13, 2, 2, 'p'], ['r', 9, 13, 2, 2, 'p']);
  else S.push(['r', 6, 13, 3, 3, 'p']);

  // busto e braccia
  if (!side) {
    S.push(['r', 4, 9, 8, 4, 'c'], ['r', 3, 9, 1, 1, 'c'], ['r', 12, 9, 1, 1, 'c'], ['r', 3, 10, 1, 2, 's'], ['r', 12, 10, 1, 2, 's']);
  } else {
    S.push(['r', 5, 9, 6, 4, 'c']);
    S.push(frame === 1 ? ['r', 5, 10, 2, 2, 's'] : frame === 2 ? ['r', 8, 10, 2, 2, 's'] : ['r', 7, 10, 2, 2, 's']);
  }

  // capelli lunghi dietro la testa
  if (L.style === 'long') {
    if (dir === 'down') S.push(['r', 3, 5, 10, 6, 'h']);
    else if (dir === 'up') S.push(['r', 4, 6, 8, 6, 'h']);
    else S.push(['r', 8, 5, 4, 6, 'h']);
  }

  // testa
  if (L.style === 'curly') S.push(['e', 8, 5, 5.6, 5, 'h'], ['e', 4, 2.2, 2, 2, 'h'], ['e', 12, 2.2, 2, 2, 'h'], ['e', 8, 1, 2.6, 1.5, 'h']);
  else S.push(['e', 8, 5, 5, 4.6, 'h']);

  if (dir === 'down') {
    S.push(['e', 8, 6.4, 4.2, 3.2, 's']);
    if (L.style === 'long') S.push(['r', 3, 6, 1, 5, 'h'], ['r', 12, 6, 1, 5, 'h']);
    S.push(['r', 4, 2, 8, 2, 'h']);
    if (L.glasses) S.push(['l', 4, 5, 11, 5, 'k']);
    S.push(['r', 5, 6, 1, 2, 'k'], ['r', 10, 6, 1, 2, 'k']);
    if (L.beard) S.push(['r', 6, 9, 4, 1, 'h']);
  } else if (dir === 'left') {
    S.push(['e', 6, 6.4, 3.2, 3.2, 's'], ['r', 6, 2, 7, 3, 'h'], ['r', 9, 4, 4, 4, 'h']);
    if (L.glasses) S.push(['l', 3, 5, 6, 5, 'k']);
    S.push(['r', 4, 6, 1, 2, 'k']);
    if (L.beard) S.push(['r', 3, 9, 4, 1, 'h']);
  }

  // dettagli dell'acconciatura
  if (L.style === 'bun') {
    S.push(dir === 'left' ? ['e', 11.5, 2.5, 2, 1.8, 'h'] : ['e', 8, 1.2, 2.2, 1.4, 'h']);
    S.push(dir === 'left' ? ['r', 5, 2, 6, 1, 'o'] : ['r', 5, 2, 6, 1, 'o']);
  } else if (L.style === 'cap') {
    S.push(['e', 8, 3, 5.2, 2.8, 'q'], ['r', 6, 0, 4, 2, 't']);
    if (dir === 'down') S.push(['r', 4, 4, 8, 1, 'q']);
    else if (dir === 'left') S.push(['r', 1, 4, 6, 1, 'q']);
  }

  const def = { w: 16, h: 16, pal, shapes: S };
  pk.charDefs[key] = def;
  return def;
}

// ─── Stato dell'avventura ───────────────────────────────────────────────────

function pkwTileAt(x, y) {
  const W = pk.world;
  if (x < 0 || y < 0 || y >= W.grid.length || x >= W.grid[0].length) return null;
  return W.grid[y][x];
}
const pkwWarpAt = (x, y) => (pk.world.map.warps || []).find(w => w.x === x && w.y === y) || null;
const pkwNpcAt = (x, y) => pk.world.npcs.find(n => n.x === x && n.y === y) || null;
const pkwBoulderAt = (x, y) => pk.world.boulders.find(b => b.x === x && b.y === y) || null;
const pkwItemAt = (x, y) => pk.world.items.find(i => i.x === x && i.y === y) || null;
const pkwClosed = (wp) => {
  const w = pk.data.gym.world;
  return wp && wp.id && w.closed ? w.closed[pk.world.mapId + '.' + wp.id] || null : null;
};

function pkwTileWalkable(x, y) {
  const t = pkwTileAt(x, y);
  if (t === null) return false;
  if (PKW_WALK.has(t)) return true;
  return (t === 'D' || t === 'E') && !!pkwWarpAt(x, y);
}
const pkwFree = (x, y) => pkwTileWalkable(x, y) && !pkwNpcAt(x, y) && !pkwBoulderAt(x, y) && !pkwItemAt(x, y);

function pkwEnter(mapId, x, y, dir) {
  const W = pk.world;
  const map = pk.data.maps[mapId];
  W.mapId = mapId;
  W.map = map;
  W.grid = map.rows.map(r => r.split(''));
  W.ground = map.border === 'B' ? ':' : map.border === ' ' ? '_' : '.';
  // massi e buche tornano a posto ogni volta che si entra (così un puzzle incastrato si ripara)
  W.boulders = (map.boulders || []).map(b => ({ x: b.x, y: b.y, fx: b.x, fy: b.y }));
  W.npcs = (map.npcs || []).map((n, i) => Object.assign({}, n, { key: mapId + '#' + i, fx: n.x, fy: n.y, frame: 0 }));
  W.items = (map.items || []).map((it, i) => Object.assign({}, it, { key: mapId + '@' + i })).filter(it => !W.taken[it.key]);
  W.x = x; W.y = y; W.fx = x; W.fy = y; W.dir = dir || 'down'; W.frame = 0;
}

function pkwMusic() {
  pkMusicStart(pk.world.map.music || 'route');
}

async function pkwFade(to, dur = 0.25) {
  const v = pk.view, from = v.fade || 0;
  await pkTween(dur, t => { v.fade = from + (to - from) * t; });
  v.fade = to;
}

// ─── Svolgimento ─────────────────────────────────────────────────────────────

async function pkWorldMain(id) {
  const { data } = pk;
  const w = data.gym.world;
  const v = pk.view;
  pk.world = { taken: {}, defeated: {}, steps: 0, pushed: false };
  pkwEnter(w.start.map, w.start.x, w.start.y, w.start.dir);
  v.fade = 1;
  v.scene = 'world';
  pkwMusic();
  await pkwFade(0, 0.4);
  if (!pkAlive(id)) return;
  if (w.intro) await pkSay(w.intro);

  for (;;) {
    if (!pkAlive(id) || pk.world.done) return;
    const inp = await pkwInput();
    if (!pkAlive(id)) return;
    if (inp.a) await pkwInteract(id);
    else if (inp.b) await pkwMenu(id);
    else if (inp.dir) await pkwStep(id, inp.dir);
  }
}

// Aspetta una direzione tenuta premuta, A o B
function pkwInput() {
  return new Promise(res => {
    const done = (r) => { pk.waiter = null; pk.worldPoll = null; res(r); };
    pk.waiter = {
      key: (k) => { if (k === 'a') done({ a: true }); else if (k === 'b') done({ b: true }); else if (PKW_DIRS[k]) done({ dir: k }); },
      tap: () => done({ a: true }),
    };
    pk.worldPoll = () => { const d = pkHeldDir(); if (d) done({ dir: d }); };
    const d = pkHeldDir();
    if (d) done({ dir: d });
  });
}

function pkwBump() {
  pkNote(110, 'square', getAudioCtx().currentTime, 0.06, 0.05);
}

async function pkwStep(id, dir) {
  const W = pk.world;
  const [dx, dy] = PKW_DIRS[dir];
  const turned = W.dir !== dir;
  W.dir = dir;
  const nx = W.x + dx, ny = W.y + dy;

  // Uscite (tappetino, bordo della grotta): si esce spingendo verso fuori dal warp
  const here = pkwWarpAt(W.x, W.y);
  if (here && !pkwTileWalkable(nx, ny) && pkwTileAt(W.x, W.y) !== 'D') {
    if (dir === here.dir || dir === 'down' || pkwTileAt(nx, ny) === null) return pkwWarp(id, here);
  }

  const wpAhead = pkwWarpAt(nx, ny);
  const closed = pkwClosed(wpAhead);
  if (closed) { pkwBump(); await pkSay(closed); return; }

  const boulder = pkwBoulderAt(nx, ny);
  if (boulder) return pkwPush(id, boulder, dx, dy);

  if (!pkwFree(nx, ny)) {
    if (turned) { await pkSleep(90); return; }
    pkwBump();
    await pkSleep(200);
    return;
  }

  await pkwMove(id, nx, ny, PKW_STEP, true);
  if (!pkAlive(id)) return;

  // Ghiaccio: si scivola finché non si sbatte contro qualcosa
  while (pkwTileAt(W.x, W.y) === 'I') {
    const sx = W.x + dx, sy = W.y + dy;
    if (!pkwFree(sx, sy) || pkwClosed(pkwWarpAt(sx, sy))) break;
    await pkwMove(id, sx, sy, PKW_SLIDE, false);
    if (!pkAlive(id)) return;
  }

  const wp = pkwWarpAt(W.x, W.y);
  if (wp && pkwTileAt(W.x, W.y) !== 'm') return pkwWarp(id, wp);

  if (await pkwCheckTrainers(id)) return;
  await pkwMaybeWild(id);
}

// Sposta la giocatrice di una casella in "dur" secondi
async function pkwMove(id, nx, ny, dur, walking) {
  const W = pk.world;
  const ox = W.x, oy = W.y;
  W.steps++;
  const walkFrame = W.steps % 2 ? 1 : 2;
  W.x = nx; W.y = ny;
  await pkTween(dur, t => {
    W.fx = ox + (nx - ox) * t; W.fy = oy + (ny - oy) * t;
    W.frame = walking && t < 0.6 ? walkFrame : 0;
  });
  W.fx = nx; W.fy = ny; W.frame = 0;
}

// FORZA: il masso si sposta di una casella; nella buca la riempie
async function pkwPush(id, b, dx, dy) {
  const W = pk.world;
  const tx = b.x + dx, ty = b.y + dy;
  const t = pkwTileAt(tx, ty);
  const free = (t === ':' || t === '_' || t === '.') && !pkwNpcAt(tx, ty) && !pkwBoulderAt(tx, ty) && !pkwItemAt(tx, ty);
  if (!W.pushed) {
    W.pushed = true;
    await pkSay(pk.player.name + ' usa FORZA! Ora può spostare i massi.');
  }
  if (t !== 'h' && !free) { pkwBump(); await pkSleep(200); return; }
  pkNoise(0.12, 0.06);
  const ox = b.x, oy = b.y;
  b.x = tx; b.y = ty;
  await pkTween(0.25, k => { b.fx = ox + dx * k; b.fy = oy + dy * k; });
  b.fx = tx; b.fy = ty;
  if (t === 'h') {
    W.boulders.splice(W.boulders.indexOf(b), 1);
    W.grid[ty][tx] = ':';
    pkNoise(0.3, 0.12);
    await pkSay('Il masso è caduto nella buca!');
  }
}

async function pkwWarp(id, wp) {
  const W = pk.world, w = pk.data.gym.world;
  if (w.end && w.end.map === W.mapId && w.end.warp === wp.id) return pkwFinish(id, w.end.text);
  const t0 = getAudioCtx().currentTime;
  [60, 55].forEach((n, i) => pkNote(pkMidi(n), 'square', t0 + i * 0.06, 0.06, 0.04));
  const oldMusic = W.map.music;
  await pkwFade(1);
  if (!pkAlive(id)) return;
  pkwEnter(wp.to, wp.tx, wp.ty, wp.dir);
  if ((W.map.music || 'route') !== (oldMusic || 'route')) pkwMusic();
  await pkwFade(0);
}

// Tappa finita senza capopalestra (es. arrivo al CENTRO POKéMON)
async function pkwFinish(id, text) {
  const v = pk.view;
  pk.world.done = true;
  pkMusicStop();
  await pkwFade(1, 0.4);
  if (!pkAlive(id)) return;
  v.scene = 'black';
  v.fade = 0;
  const dur = pkJingle([[72, 1], [76, 1], [79, 1], [84, 3]], 0.12);
  if (text) await pkSay(text);
  await pkSay('Tappa completata!', { auto: Math.max(300, dur - 600) });
  if (!pkAlive(id)) return;
  const q = pk.q, stage = pk.canvas;
  destroyPokemon();
  const opt = q.options.find(o => o.correct);
  if (opt) handleAnswer(opt, stage);
  else { gameActive = false; showWin(); }
}

// ─── Allenatori, creature selvatiche, CENTRO POKéMON ────────────────────────

async function pkwCheckTrainers(id) {
  const W = pk.world;
  for (const n of W.npcs) {
    if (!n.trainer || !n.sight || W.defeated[n.key] || !pk.data.trainers[n.trainer]) continue;
    const [dx, dy] = PKW_DIRS[n.dir];
    for (let k = 1; k <= n.sight; k++) {
      const tx = n.x + dx * k, ty = n.y + dy * k;
      if (tx === W.x && ty === W.y) { await pkwSpotted(id, n, k); return true; }
      if (!pkwTileWalkable(tx, ty) || pkwNpcAt(tx, ty) || pkwBoulderAt(tx, ty)) break;
    }
  }
  return false;
}

// "!" sopra l'allenatore, che si avvicina e sfida
async function pkwSpotted(id, n, dist) {
  const W = pk.world;
  pkMusicStop();
  pkJingle([[76, 1], [0, 1], [76, 1], [79, 1], [83, 2]], 0.08);
  n.bang = true;
  await pkSleep(800);
  n.bang = false;
  const [dx, dy] = PKW_DIRS[n.dir];
  for (let i = 1; i < dist; i++) {
    const ox = n.x, oy = n.y;
    n.x += dx; n.y += dy;
    n.steps = (n.steps || 0) + 1;
    const f = n.steps % 2 ? 1 : 2;
    await pkTween(PKW_STEP, t => { n.fx = ox + dx * t; n.fy = oy + dy * t; n.frame = t < 0.6 ? f : 0; });
    n.fx = n.x; n.fy = n.y; n.frame = 0;
    if (!pkAlive(id)) return;
  }
  W.dir = PKW_BACK[n.dir];
  await pkwTrainerBattle(id, n);
}

async function pkwTrainerBattle(id, n) {
  const W = pk.world;
  const trainer = pk.data.trainers[n.trainer];
  if (trainer.intro) await pkSay(trainer.intro);
  if (!pkAlive(id)) return;
  const won = await pkBattle(id, trainer, !!n.leader, { world: true });
  if (!pkAlive(id)) return;
  if (!won) return pkLose(id);
  W.defeated[n.key] = true;
  if (n.leader) { W.done = true; return pkWin(id); }
  await pkwBackFromBattle(id);
}

async function pkwBackFromBattle(id) {
  const v = pk.view;
  v.foe = v.me = v.foeBox = v.meBox = null;
  v.text = null;
  v.fade = 1;
  v.wipe = 0;
  v.scene = 'world';
  pkwMusic();
  await pkwFade(0);
}

async function pkwMaybeWild(id) {
  const W = pk.world, enc = W.map.encounters;
  if (!enc || pkwTileAt(W.x, W.y) !== enc.on || Math.random() >= enc.rate) return;
  const list = enc.list.filter(e => pk.data.species[e.species]);
  if (!list.length) return;
  let r = Math.random() * list.reduce((s, e) => s + (e.w || 1), 0);
  const e = list.find(x => (r -= (x.w || 1)) < 0) || list[0];
  const level = e.min + Math.floor(Math.random() * (e.max - e.min + 1));
  pkMusicStop();
  const res = await pkBattle(id, null, false, { wild: { species: e.species, level } });
  if (!pkAlive(id)) return;
  if (!res) return pkLose(id);
  await pkwBackFromBattle(id);
}

async function pkwHeal(id) {
  const v = pk.view, W = pk.world;
  await pkSay('Benvenuta al CENTRO POKéMON! Ora curo le tue creature, dammi un attimo.');
  if (!pkAlive(id)) return;
  pkMusicStop();
  W.healing = true;
  const dur = pkJingle([[72, 1], [76, 1], [79, 1], [84, 2], [79, 1], [84, 3]], 0.12);
  await pkSleep(dur + 200);
  W.healing = false;
  if (!pkAlive(id)) return;
  pk.player.team.forEach(m => {
    m.hp = m.maxHp; m.shownHp = m.hp;
    m.stages = { atk: 0, def: 0 };
    m.moves.forEach(mv => { mv.left = mv.pp; });
  });
  pkwMusic();
  await pkSay('Ecco fatto! Le tue creature sono in perfetta forma. Torna quando vuoi!');
  v.text = null;
}

// ─── A: parla, leggi, raccogli ──────────────────────────────────────────────

async function pkwInteract(id) {
  const W = pk.world;
  const [dx, dy] = PKW_DIRS[W.dir];
  let tx = W.x + dx, ty = W.y + dy;
  // oltre il bancone si parla con chi c'è dietro
  if (pkwTileAt(tx, ty) === 'C') { tx += dx; ty += dy; }

  const n = pkwNpcAt(tx, ty);
  if (n) {
    n.dir = PKW_BACK[W.dir];
    if (n.nurse) return pkwHeal(id);
    if (n.trainer && pk.data.trainers[n.trainer]) {
      const t = pk.data.trainers[n.trainer];
      if (W.defeated[n.key]) { await pkSay(t.after || t.defeat || '…'); return; }
      return pkwTrainerBattle(id, n);
    }
    if (n.text) await pkSay(n.text);
    return;
  }
  const item = pkwItemAt(tx, ty);
  if (item) {
    const it = pk.data.items[item.item];
    W.taken[item.key] = true;
    W.items.splice(W.items.indexOf(item), 1);
    pkJingle([[79, 1], [84, 1], [88, 2]], 0.1);
    if (it) pk.player.bag[item.item] = (pk.player.bag[item.item] || 0) + 1;
    await pkSay(pk.player.name + ' trova ' + (it ? it.name : 'qualcosa') + '!');
    return;
  }
  if (pkwBoulderAt(tx, ty)) { await pkSay('È un masso enorme. Si può spingere camminandoci contro.'); return; }
  const sign = (W.map.signs || []).find(s => s.x === tx && s.y === ty);
  if (sign) { await pkSay(sign.text); return; }
}

// ─── B: menu ────────────────────────────────────────────────────────────────

async function pkwMenu(id) {
  const v = pk.view, P = pk.player;
  pkBlip();
  const items = [
    { label: 'SQUADRA', x: 96, y: 10, w: 56 },
    { label: 'ZAINO', x: 96, y: 26, w: 56 },
    { label: 'ESCI', x: 96, y: 42, w: 56 },
  ];
  for (;;) {
    const c = await pkChoose({ type: 'box', box: [80, 0, 80, 58], items, cancel: true, tapOutside: true, cursor: pk.worldMenuCursor || 0 });
    if (!pkAlive(id)) return;
    if (c < 0 || c === 2) return;
    pk.worldMenuCursor = c;
    if (c === 0) {
      await pkParty(id, { prompt: 'La tua squadra.' });
      v.scene = 'world';
      continue;
    }
    const keys = Object.keys(P.bag).filter(k => P.bag[k] > 0 && pk.data.items[k]);
    if (!keys.length) { await pkSay('Lo zaino è vuoto.'); continue; }
    const bagItems = keys.map((k, i) => ({ label: pk.data.items[k].name, count: P.bag[k], x: 24, y: 50 + i * 12, w: 128 }));
    bagItems.push({ label: 'ANNULLA', x: 24, y: 50 + keys.length * 12, w: 128 });
    v.text = { lines: ['Quale strumento?'], shown: 99, done: true };
    const bi = await pkChoose({ type: 'bag', items: bagItems, cancel: true });
    v.text = null;
    if (!pkAlive(id)) return;
    if (bi < 0 || bi >= keys.length) continue;
    const ti = await pkParty(id, { prompt: 'Su chi la usi?' });
    if (!pkAlive(id)) return;
    if (ti >= 0) {
      const target = P.team[ti];
      if (target.hp <= 0 || target.hp >= target.maxHp) await pkSay('Non avrebbe alcun effetto.');
      else await pkUseItem(id, P.name, keys[bi], target, P.bag);
    }
    v.scene = 'world';
  }
}

// ─── Disegno ────────────────────────────────────────────────────────────────

function pkDrawWorld() {
  const { ctx } = pk;
  const W = pk.world;
  if (!W || !W.map) { ctx.fillStyle = PK_COLORS.k; ctx.fillRect(0, 0, PK_W, PK_H); return; }
  // la giocatrice sta nella casella (4, 4) dello schermo, come sul Game Boy
  const camX = Math.round(W.fx * 16) - 64, camY = Math.round(W.fy * 16) - 64;
  const x0 = Math.floor(camX / 16), y0 = Math.floor(camY / 16);
  const border = W.map.border || 'T';
  for (let ty = y0; ty <= y0 + 9; ty++) for (let tx = x0; tx <= x0 + 10; tx++) {
    const t = pkwTileAt(tx, ty);
    ctx.drawImage(pkwTile(t === null ? border : t, W.ground), tx * 16 - camX, ty * 16 - camY);
  }
  if (W.healing && Math.floor(pk.time * 6) % 2) {
    // lampeggiano le luci della macchina del CENTRO
    W.grid.forEach((row, ty) => row.forEach((t, tx) => {
      if (t === 'H') { ctx.fillStyle = '#f8f080'; ctx.fillRect(tx * 16 - camX + 4, ty * 16 - camY + 4, 3, 3); ctx.fillRect(tx * 16 - camX + 9, ty * 16 - camY + 4, 3, 3); }
    }));
  }

  const things = [];
  W.items.forEach(it => things.push({ y: it.y, draw: () => ctx.drawImage(pkwThing('ball'), it.x * 16 - camX, it.y * 16 - camY) }));
  W.boulders.forEach(b => things.push({ y: b.fy, draw: () => ctx.drawImage(pkwThing('boulder'), Math.round(b.fx * 16) - camX, Math.round(b.fy * 16) - camY) }));
  W.npcs.forEach(n => things.push({ y: n.fy, draw: () => pkwDrawChar(n.look, n.dir, n.frame, n.fx, n.fy, camX, camY, n.bang) }));
  things.push({ y: W.fy, draw: () => pkwDrawChar(pk.data.gym.player.look, W.dir, W.frame, W.fx, W.fy, camX, camY) });
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
}

function pkwDrawChar(lookId, dir, frame, fx, fy, camX, camY, bang) {
  const { ctx } = pk;
  const flip = dir === 'right';
  const def = pkwCharDef(lookId, flip ? 'left' : dir, frame || 0);
  const c = pkSpriteCanvas(def, null, flip);
  const sx = Math.round(fx * 16) - camX, sy = Math.round(fy * 16) - camY;
  ctx.drawImage(c, sx, sy - 4);
  // nell'erba alta si vedono solo dalla vita in su
  const W = pk.world;
  if (Number.isInteger(fx) && Number.isInteger(fy) && pkwTileAt(fx, fy) === '"') {
    ctx.drawImage(pkwTile('"', W.ground), 0, 9, 16, 7, sx, sy + 9, 16, 7);
  }
  if (bang) {
    ctx.fillStyle = PK_COLORS.k; ctx.fillRect(sx + 2, sy - 18, 12, 12);
    ctx.fillStyle = PK_COLORS.w; ctx.fillRect(sx + 3, sy - 17, 10, 10);
    ctx.fillStyle = PK_COLORS.k; ctx.fillRect(sx + 7, sy - 16, 2, 5); ctx.fillRect(sx + 7, sy - 10, 2, 2);
  }
}
