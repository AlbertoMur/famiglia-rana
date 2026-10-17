// Dati del minigioco "⚔️ Palestra" (lotte stile Pokémon seconda generazione).
// Tutto qui è segnaposto: creature, allenatori e dialoghi si cambiano in questo file.
// L'admin copia la palestra scelta dentro la domanda (quindi finisce cifrata online):
// dopo aver modificato questo file basta ri-esportare dall'admin.
//
// SPRITE: ogni sprite è una griglia w×h (disegnata a 2× sullo schermo) fatta di forme:
//   ['e', cx, cy, rx, ry, colore, {rot, ol, shade}]  ellisse (rot in radianti)
//   ['r', x, y, w, h, colore]                         rettangolo
//   ['p', [[x,y], ...], colore]                       poligono
//   ['l', x1, y1, x2, y2, colore]                     linea di 1 pixel
//   ['px', x, y, colore]                              singolo pixel
// Colori (4 come sul Game Boy Color): 'a' chiaro e 'b' scuro della palette, 'w' bianco, 'k' nero.
// Se servono, altri colori si aggiungono alla palette con una lettera qualsiasi (es. s: pelle).
// Le forme 'a' prendono da sole l'ombra 'b' in basso a destra (shade:false per toglierla),
// ol:true disegna il bordo nero della forma, il contorno esterno si fa da solo.
// In alternativa: { img: 'sprites/nome.png' } (pixel art 28×28 o 56×56, sfondo trasparente).

const PK_TYPES = ['NORMALE', 'FUOCO', 'ACQUA', 'ERBA', 'ELETTRO', 'VOLANTE', 'ACCIAIO'];

// Efficacia: attaccante → difensore (quello che manca vale 1)
const PK_CHART = {
  NORMALE: { ACCIAIO: 0.5 },
  FUOCO:   { ERBA: 2, ACCIAIO: 2, FUOCO: 0.5, ACQUA: 0.5 },
  ACQUA:   { FUOCO: 2, ACQUA: 0.5, ERBA: 0.5 },
  ERBA:    { ACQUA: 2, FUOCO: 0.5, ERBA: 0.5, VOLANTE: 0.5, ACCIAIO: 0.5 },
  ELETTRO: { ACQUA: 2, VOLANTE: 2, ERBA: 0.5, ELETTRO: 0.5 },
  VOLANTE: { ERBA: 2, ELETTRO: 0.5, ACCIAIO: 0.5 },
  ACCIAIO: { FUOCO: 0.5, ACQUA: 0.5, ELETTRO: 0.5, ACCIAIO: 0.5 },
};

// power 0 = mossa di stato. effect: { target: 'self'|'foe', stat: 'atk'|'def', stages }
// drain: frazione del danno recuperata
const PK_MOVES = {
  azione:       { name: 'AZIONE',       type: 'NORMALE', power: 35, acc: 95,  pp: 35 },
  graffio:      { name: 'GRAFFIO',      type: 'NORMALE', power: 40, acc: 100, pp: 35 },
  ruggito:      { name: 'RUGGITO',      type: 'NORMALE', power: 0,  acc: 100, pp: 40, effect: { target: 'foe',  stat: 'atk', stages: -1 } },
  fulmisguardo: { name: 'FULMISGUARDO', type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'foe',  stat: 'def', stages: -1 } },
  rafforzatore: { name: 'RAFFORZATORE', type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'self', stat: 'def', stages: 1 } },
  crescita:     { name: 'CRESCITA',     type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'self', stat: 'atk', stages: 1 } },
  braciere:     { name: 'BRACIERE',     type: 'FUOCO',   power: 40, acc: 100, pp: 25 },
  ruotafuoco:   { name: 'RUOTAFUOCO',   type: 'FUOCO',   power: 60, acc: 100, pp: 25 },
  pistolacqua:  { name: 'PISTOLACQUA',  type: 'ACQUA',   power: 40, acc: 100, pp: 25 },
  bollaraggio:  { name: 'BOLLARAGGIO',  type: 'ACQUA',   power: 65, acc: 100, pp: 20 },
  foglielama:   { name: 'FOGLIELAMA',   type: 'ERBA',    power: 55, acc: 95,  pp: 25 },
  assorbimento: { name: 'ASSORBIMENTO', type: 'ERBA',    power: 35, acc: 100, pp: 20, drain: 0.5 },
  tuonoshock:   { name: 'TUONOSHOCK',   type: 'ELETTRO', power: 40, acc: 100, pp: 30 },
  scintilla:    { name: 'SCINTILLA',    type: 'ELETTRO', power: 65, acc: 100, pp: 20 },
  tuonopugno:   { name: 'TUONOPUGNO',   type: 'ELETTRO', power: 75, acc: 100, pp: 15 },
  raffica:      { name: 'RAFFICA',      type: 'VOLANTE', power: 40, acc: 100, pp: 35 },
  // ── Mosse delle creature di JERRY ──
  travata:      { name: 'TRAVATA',      type: 'ACCIAIO', power: 50, acc: 95,  pp: 25 },
  saldatura:    { name: 'SALDATURA',    type: 'FUOCO',   power: 40, acc: 100, pp: 25 },
  imbullona:    { name: 'IMBULLONA',    type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'self', stat: 'def', stages: 1 } },
  spruzzolime:  { name: 'SPRUZZOLIME',  type: 'ACQUA',   power: 40, acc: 100, pp: 25 },
  pestamenta:   { name: 'PESTAMENTA',   type: 'ERBA',    power: 35, acc: 100, pp: 20, drain: 0.5 },
  happyhour:    { name: 'HAPPY HOUR',   type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'self', stat: 'atk', stages: 1 } },
  assegno:      { name: 'ASSEGNO',      type: 'NORMALE', power: 40, acc: 100, pp: 35 },
  attesainps:   { name: 'ATTESA INPS',  type: 'NORMALE', power: 0,  acc: 100, pp: 40, effect: { target: 'foe',  stat: 'atk', stages: -1 } },
  divanata:     { name: 'DIVANATA',     type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'self', stat: 'def', stages: 1 } },
  clickday:     { name: 'CLICK DAY',    type: 'ELETTRO', power: 45, acc: 90,  pp: 20 },
  fulmine:      { name: 'FULMINE',      type: 'ELETTRO', power: 50, acc: 100, pp: 20 },
  bustina:      { name: 'BUSTINA',      type: 'NORMALE', power: 60, acc: 100, pp: 20, recoil: 0.25 }, // aprire buste costa caro
  tappaterre:   { name: 'TAPPATERRE',   type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'self', stat: 'atk', stages: 1 } },
  contromagia:  { name: 'CONTROMAGIA',  type: 'NORMALE', power: 0,  acc: 100, pp: 20, effect: { target: 'foe',  stat: 'atk', stages: -1 } },
  // ── Mosse delle creature del MERLO ──
  schiumata:    { name: 'SCHIUMATA',    type: 'ACQUA',   power: 40, acc: 100, pp: 30 },
  rutto:        { name: 'RUTTO',        type: 'NORMALE', power: 55, acc: 85,  pp: 15 },
  brindisi:     { name: 'BRINDISI',     type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'self', stat: 'atk', stages: 1 } },
  beccata:      { name: 'BECCATA',      type: 'VOLANTE', power: 35, acc: 100, pp: 35 },
  fischietto:   { name: 'FISCHIETTO',   type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'foe',  stat: 'def', stages: -1 } },
  giornimerla:  { name: 'GIORNI MERLA', type: 'NORMALE', power: 55, acc: 90,  pp: 15 }, // fa un freddo cane
  solarraggio:  { name: 'SOLARRAGGIO',  type: 'ERBA',    power: 60, acc: 90,  pp: 10 },
  superbonus:   { name: 'SUPERBONUS',   type: 'NORMALE', power: 0,  acc: 100, pp: 10, effect: { target: 'self', stat: 'atk', stages: 2 } }, // 110%
  accelerata:   { name: 'ACCELERATA',   type: 'NORMALE', power: 50, acc: 95,  pp: 25 },
  colonnina:    { name: 'COLONNINA',    type: 'ELETTRO', power: 45, acc: 100, pp: 20 },
  clacson:      { name: 'CLACSON',      type: 'NORMALE', power: 0,  acc: 100, pp: 40, effect: { target: 'foe',  stat: 'atk', stages: -1 } },
  // ── Mosse dei vini del DOTT. MARCHI ──
  terroir:      { name: 'TERROIR',      type: 'ERBA',    power: 55, acc: 100, pp: 20 },
  scontrino:    { name: 'SCONTRINO',    type: 'NORMALE', power: 65, acc: 85,  pp: 15 }, // il conto fa male
  decantazione: { name: 'DECANTAZIONE', type: 'NORMALE', power: 0,  acc: 100, pp: 20, effect: { target: 'self', stat: 'atk', stages: 1 } },
  merlot:       { name: 'MERLOT',       type: 'NORMALE', power: 50, acc: 100, pp: 30 }, // Petrus è 100% merlot
  barrique:     { name: 'BARRIQUE',     type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'self', stat: 'def', stages: 1 } },
  chiavicielo:  { name: 'CHIAVI CIELO', type: 'NORMALE', power: 60, acc: 90,  pp: 15 },
  nebbiolo:     { name: 'NEBBIOLO',     type: 'ACQUA',   power: 50, acc: 100, pp: 20 },
  gradazione:   { name: 'GRADAZIONE',   type: 'FUOCO',   power: 60, acc: 95,  pp: 15 },
  redeivini:    { name: 'RE DEI VINI',  type: 'NORMALE', power: 0,  acc: 100, pp: 20, effect: { target: 'self', stat: 'atk', stages: 1 } },
  tappo:        { name: 'TAPPO',        type: 'NORMALE', power: 60, acc: 90,  pp: 20 },
  bollicine:    { name: 'BOLLICINE',    type: 'ACQUA',   power: 45, acc: 100, pp: 25 },
  brut:         { name: 'BRUT',         type: 'NORMALE', power: 0,  acc: 100, pp: 30, effect: { target: 'foe',  stat: 'def', stages: -1 } },
};

// Strumenti dello zaino (heal: PS recuperati)
const PK_ITEMS = {
  pozione:      { name: 'POZIONE',      heal: 20 },
  superpozione: { name: 'SUPERPOZIONE', heal: 50 },
};

const PK_SPECIES = {
  // ── Squadra del giocatore ──
  ranella: {
    name: 'RANELLA', types: ['ACQUA'], base: { hp: 55, atk: 50, def: 55, spd: 50 },
    moves: ['bollaraggio', 'azione', 'ruggito', 'rafforzatore'],
    sprite: { w: 28, h: 28, pal: { a: '#78c850', b: '#3a7a34' }, shapes: [
      ['e', 7, 23.5, 5, 3, 'a'], ['e', 21, 23.5, 5, 3, 'a'],
      ['e', 14, 17, 11.5, 7.5, 'a'],
      ['e', 14, 20.5, 6.5, 3.8, 'w'],
      ['e', 8, 9, 5, 4.5, 'a'], ['e', 20, 9, 5, 4.5, 'a'],
      ['e', 8, 9, 3, 3, 'w', { ol: true }], ['e', 20, 9, 3, 3, 'w', { ol: true }],
      ['r', 8, 8, 2, 2, 'k'], ['r', 18, 8, 2, 2, 'k'],
      ['l', 6, 14, 8, 16, 'k'], ['l', 9, 16, 18, 16, 'k'], ['l', 19, 16, 21, 14, 'k'],
      ['px', 5, 15, 'b'], ['px', 22, 15, 'b'],
    ] },
  },
  fiammino: {
    name: 'FIAMMINO', types: ['FUOCO'], base: { hp: 45, atk: 60, def: 45, spd: 65 },
    moves: ['ruotafuoco', 'graffio', 'fulmisguardo', 'braciere'],
    sprite: { w: 28, h: 28, pal: { a: '#f8a838', b: '#d83818' }, shapes: [
      ['p', [[14, 1.5], [16.5, 6], [19.5, 4.5], [19, 11], [9, 11], [8.5, 4.5], [11.5, 6]], 'b'],
      ['p', [[14, 5], [16.2, 9.5], [14, 11], [11.8, 9.5]], 'a', { shade: false }],
      ['e', 4.5, 18, 2.5, 3, 'a'], ['e', 23.5, 18, 2.5, 3, 'a'],
      ['e', 9.5, 25, 3, 1.6, 'b'], ['e', 18.5, 25, 3, 1.6, 'b'],
      ['e', 14, 17.5, 9, 8, 'a'],
      ['e', 14, 21.8, 5, 3.4, 'w'],
      ['e', 10.5, 15, 1.6, 2.4, 'k'], ['e', 17.5, 15, 1.6, 2.4, 'k'],
      ['px', 10, 14, 'w'], ['px', 17, 14, 'w'],
      ['l', 12, 18, 16, 18, 'k'], ['px', 11, 17, 'k'], ['px', 17, 17, 'k'],
    ] },
  },
  ciuffetto: {
    name: 'CIUFFETTO', types: ['ERBA'], base: { hp: 60, atk: 50, def: 60, spd: 40 },
    moves: ['foglielama', 'assorbimento', 'crescita', 'azione'],
    sprite: { w: 28, h: 28, pal: { a: '#a0d858', b: '#4a7c22' }, shapes: [
      ['r', 13, 7, 2, 4, 'b'],
      ['e', 9, 6.5, 2.8, 5.5, 'b', { rot: -0.7 }], ['e', 19, 6.5, 2.8, 5.5, 'b', { rot: 0.7 }],
      ['e', 9, 25.2, 3, 1.6, 'b'], ['e', 19, 25.2, 3, 1.6, 'b'],
      ['e', 14, 17.5, 10.5, 8.2, 'a'],
      ['e', 10, 16, 2.4, 2.8, 'w', { ol: true }], ['e', 18, 16, 2.4, 2.8, 'w', { ol: true }],
      ['r', 10, 16, 1, 2, 'k'], ['r', 17, 16, 1, 2, 'k'],
      ['l', 12, 21, 15, 21, 'k'], ['px', 11, 20, 'k'], ['px', 16, 20, 'k'],
    ] },
  },

  // ── Palestra Scintilla ──
  spinotto: {
    name: 'SPINOTTO', types: ['ELETTRO'], base: { hp: 40, atk: 55, def: 40, spd: 80 },
    moves: ['tuonoshock', 'azione', 'ruggito'],
    sprite: { w: 28, h: 28, pal: { a: '#8cd4f4', b: '#3a7ab8' }, shapes: [
      ['l', 21, 21, 24, 21, 'k'], ['l', 24, 21, 25, 18, 'k'], ['l', 25, 18, 25, 14, 'k'],
      ['r', 23, 11, 5, 4, 'w', { ol: true }], ['r', 24, 8, 1, 3, 'k'], ['r', 26, 8, 1, 3, 'k'],
      ['e', 6.5, 7, 4, 4, 'a'], ['e', 21.5, 7, 4, 4, 'a'],
      ['e', 6.5, 7, 2, 2, 'b', { shade: false }], ['e', 21.5, 7, 2, 2, 'b', { shade: false }],
      ['e', 10, 24.5, 2.8, 1.6, 'b'], ['e', 18, 24.5, 2.8, 1.6, 'b'],
      ['e', 14, 16, 9, 8.5, 'a'],
      ['e', 14, 19.5, 5, 3.5, 'w'],
      ['r', 11, 5, 2, 4, 'w', { ol: true }], ['r', 15, 5, 2, 4, 'w', { ol: true }],
      ['e', 10.5, 14, 1.5, 2.2, 'k'], ['e', 17.5, 14, 1.5, 2.2, 'k'],
      ['px', 10, 13, 'w'], ['px', 17, 13, 'w'],
      ['px', 13, 18, 'k'], ['px', 14, 18, 'k'],
    ] },

  },
  nuvolotto: {
    name: 'NUVOLOTTO', types: ['ELETTRO', 'VOLANTE'], base: { hp: 50, atk: 50, def: 50, spd: 60 },
    moves: ['tuonoshock', 'raffica', 'fulmisguardo'],
    sprite: { w: 28, h: 28, pal: { a: '#e4ecf8', b: '#8890c0' }, shapes: [
      ['p', [[13.5, 16], [18, 16], [16, 20], [19, 20], [12, 26.5], [14, 21.5], [10.5, 21.5]], 'w', { ol: true }],
      ['e', 3.8, 10.5, 1.8, 3.2, 'w', { rot: 0.5, ol: true }], ['e', 24.2, 10.5, 1.8, 3.2, 'w', { rot: -0.5, ol: true }],
      ['e', 8, 13, 5.5, 5, 'a'], ['e', 20, 13, 5.5, 5, 'a'],
      ['e', 14, 9.5, 6.5, 6, 'a'], ['e', 14, 15, 10, 4.5, 'a'],
      ['e', 11, 12, 1.3, 2, 'k'], ['e', 17, 12, 1.3, 2, 'k'],
      ['l', 13, 15, 15, 15, 'k'],
    ] },
  },
  bulbolux: {
    name: 'BULBOLUX', types: ['ELETTRO'], base: { hp: 60, atk: 60, def: 55, spd: 55 },
    moves: ['scintilla', 'tuonopugno', 'rafforzatore', 'azione'],
    sprite: { w: 28, h: 28, pal: { a: '#f8f080', b: '#a8a090' }, shapes: [
      ['e', 14, 11, 9, 8.5, 'a', { shade: false }],
      ['e', 10.5, 7, 2, 1.5, 'w'],
      ['r', 9, 18, 10, 2, 'a', { shade: false }],
      ['r', 9, 20, 10, 6, 'b', { shade: false }],
      ['l', 9, 22, 18, 22, 'k'], ['l', 9, 24, 18, 24, 'k'],
      ['r', 12, 26, 4, 1, 'k'],
      ['l', 11, 7, 12, 4, 'b'], ['l', 12, 4, 14, 7, 'b'], ['l', 14, 7, 16, 4, 'b'], ['l', 16, 4, 17, 7, 'b'],
      ['e', 10.5, 11.5, 1.3, 2, 'k'], ['e', 17.5, 11.5, 1.3, 2, 'k'],
      ['l', 12, 15, 16, 15, 'k'], ['px', 11, 14, 'k'], ['px', 17, 14, 'k'],
      ['px', 2, 5, 'b'], ['px', 3, 6, 'b'], ['px', 25, 5, 'b'], ['px', 24, 6, 'b'], ['px', 2, 14, 'b'], ['px', 25, 14, 'b'],
    ] },
  },

  // ── Le creature di JERRY ──
  // Trave d'acciaio col caschetto: costruisce ponti, non amicizie
  cimolai: {
    name: 'CIMOLAI', types: ['ACCIAIO'], base: { hp: 55, atk: 55, def: 75, spd: 25 },
    moves: ['travata', 'saldatura', 'imbullona'],
    sprite: { w: 28, h: 28, pal: { a: '#a8b4c0', b: '#5c6874', y: '#f8c820', z: '#c08a10' }, shapes: [
      ['l', 9, 18, 4, 15, 'k'], ['l', 18, 18, 23, 15, 'k'],
      ['r', 9, 13, 10, 10, 'a'],
      ['r', 4, 11, 20, 3, 'a'], ['r', 4, 22, 20, 4, 'a'],
      ['px', 6, 12, 'b'], ['px', 21, 12, 'b'], ['px', 6, 23, 'b'], ['px', 21, 23, 'b'], ['px', 6, 24, 'b'], ['px', 21, 24, 'b'],
      ['e', 14, 6.8, 6.5, 4, 'y'], ['r', 6, 9, 16, 2, 'y', { ol: true }], ['l', 14, 3, 14, 8, 'z'],
      ['l', 10, 15, 12, 16, 'k'], ['l', 17, 15, 15, 16, 'k'],
      ['r', 11, 17, 2, 2, 'k'], ['r', 15, 17, 2, 2, 'k'],
      ['l', 12, 21, 15, 21, 'k'],
    ] },
  },
  // Bicchiere di mojito con menta, lime e cannuccia (un po' alticcio)
  mojito: {
    name: 'MOJITO', types: ['ACQUA', 'ERBA'], base: { hp: 50, atk: 50, def: 45, spd: 55 },
    moves: ['spruzzolime', 'pestamenta', 'happyhour'],
    sprite: { w: 28, h: 28, pal: { a: '#c4ecac', b: '#78b85a', g: '#e4f6f0', m: '#2c9a3c', r: '#e83860', y: '#a8d830', c: '#eef8b0', p: '#f490a8' }, shapes: [
      ['l', 17, 12, 21, 1, 'r'], ['l', 18, 12, 22, 1, 'r'],
      ['p', [[6, 8], [22, 8], [20, 26], [8, 26]], 'g'],
      ['p', [[7, 11], [21, 11], [19.5, 25], [8.5, 25]], 'a'],
      ['r', 9, 12, 3, 2, 'g'], ['r', 16, 12, 3, 2, 'g'], ['px', 9, 12, 'w'], ['px', 16, 12, 'w'],
      ['e', 22, 8.5, 3.5, 3.5, 'y'], ['e', 22, 8.5, 2.2, 2.2, 'c'],
      ['e', 10, 8, 3.2, 1.6, 'm', { rot: -0.5 }], ['e', 14.5, 7, 3.2, 1.6, 'm', { rot: 0.4 }],
      ['l', 10, 17, 12, 19, 'k'], ['l', 12, 17, 10, 19, 'k'],
      ['r', 15, 17, 2, 3, 'k'], ['px', 15, 17, 'w'],
      ['l', 12, 22, 16, 22, 'k'], ['px', 11, 21, 'k'], ['px', 17, 21, 'k'],
      ['px', 10, 21, 'p'], ['px', 18, 21, 'p'],
    ] },
  },
  // Il modulo dell'INPS, sempre in attesa e un po' triste
  naspi: {
    name: 'NASPI', types: ['NORMALE'], base: { hp: 75, atk: 40, def: 50, spd: 30 },
    moves: ['assegno', 'attesainps', 'divanata', 'clickday'],
    sprite: { w: 28, h: 28, pal: { a: '#f4f4ea', b: '#b8b8a6', i: '#2a62b8', g: '#9a9a9a', c: '#8cd0f8', y: '#f0c838' }, shapes: [
      ['l', 7, 16, 4, 18, 'k'],
      ['e', 3.5, 20, 2.2, 2.2, 'y', { ol: true }],
      ['p', [[7, 3], [18, 3], [22, 7], [22, 25], [7, 25]], 'a'],
      ['p', [[18, 3], [18, 7], [22, 7]], 'b', { ol: true }],
      ['l', 9, 5, 15, 5, 'i'], ['l', 9, 7, 14, 7, 'g'],
      ['l', 10, 11, 12, 10, 'k'], ['l', 16, 10, 18, 11, 'k'],
      ['e', 11, 13, 1.2, 1.8, 'k'], ['e', 17, 13, 1.2, 1.8, 'k'],
      ['e', 10, 16.5, 0.9, 1.4, 'c'],
      ['l', 12, 17, 16, 17, 'k'], ['px', 11, 18, 'k'], ['px', 17, 18, 'k'],
      ['l', 9, 21, 14, 21, 'g'], ['l', 9, 23, 13, 23, 'g'],
      ['e', 18.5, 21.5, 2.8, 2.8, 'i'], ['e', 18.5, 21.5, 1.5, 1.5, 'a', { shade: false }],
    ] },
  },
  // Il retro di una carta di Magic, coi cinque colori del mana
  cartamagic: {
    name: 'CARTA MAGIC', types: ['NORMALE'], base: { hp: 45, atk: 62, def: 40, spd: 70 },
    moves: ['fulmine', 'bustina', 'tappaterre', 'contromagia'],
    sprite: { w: 28, h: 28, pal: { a: '#9a6434', b: '#5e3818', o: '#d88a30', u: '#2e4a9c', q: '#f6eec4', l: '#3a8ad8', r: '#d83020', v: '#30a040' }, shapes: [
      ['l', 6, 15, 2, 13, 'k'], ['l', 21, 15, 25, 13, 'k'],
      ['r', 6, 2, 16, 24, 'a'],
      ['e', 14, 14, 6.2, 9.5, 'o', { shade: false }],
      ['e', 14, 14, 5, 8.3, 'u', { shade: false }],
      ['e', 11.5, 11.5, 1.8, 2.2, 'w'], ['e', 16.5, 11.5, 1.8, 2.2, 'w'],
      ['r', 12, 11, 1, 2, 'k'], ['r', 16, 11, 1, 2, 'k'],
      ['l', 11, 16, 17, 16, 'w'], ['px', 10, 15, 'w'], ['px', 18, 15, 'w'],
      ['px', 10, 20, 'q'], ['px', 12, 20, 'l'], ['px', 14, 20, 'k'], ['px', 16, 20, 'r'], ['px', 18, 20, 'v'],
    ] },
  },

  // ── Creature selvatiche della grotta (segnaposto) ──
  squitto: {
    name: 'SQUITTO', types: ['VOLANTE'], base: { hp: 40, atk: 45, def: 35, spd: 60 },
    moves: ['raffica', 'graffio', 'ruggito'],
    sprite: { w: 28, h: 28, pal: { a: '#8870b8', b: '#584088', p: '#f090b0' }, shapes: [
      ['p', [[13, 13], [2, 6], [3, 11], [1, 14], [4, 16], [3, 20], [11, 18]], 'b', { shade: false }],
      ['p', [[15, 13], [26, 6], [25, 11], [27, 14], [24, 16], [25, 20], [17, 18]], 'b', { shade: false }],
      ['e', 14, 15, 5.5, 6, 'a'],
      ['p', [[10, 11], [9, 5], [13, 9]], 'a'], ['p', [[18, 11], [19, 5], [15, 9]], 'a'],
      ['e', 11.5, 14, 1.3, 1.6, 'k'], ['e', 16.5, 14, 1.3, 1.6, 'k'], ['px', 11, 13, 'w'], ['px', 16, 13, 'w'],
      ['px', 12, 18, 'w'], ['px', 15, 18, 'w'], ['l', 12, 17, 15, 17, 'k'],
      ['l', 12, 21, 12, 23, 'k'], ['l', 16, 21, 16, 23, 'k'],
    ] },
  },
  grottino: {
    name: 'GROTTINO', types: ['ACCIAIO'], base: { hp: 50, atk: 55, def: 70, spd: 20 },
    moves: ['azione', 'rafforzatore', 'travata'],
    sprite: { w: 28, h: 28, pal: { a: '#a8a090', b: '#6c6458', g: '#8a8274' }, shapes: [
      ['e', 4, 17, 3, 2.5, 'a'], ['e', 24, 17, 3, 2.5, 'a'],
      ['p', [[6, 24], [5, 15], [8, 9], [14, 6], [20, 8], [23, 14], [22, 24]], 'a'],
      ['l', 9, 11, 11, 10, 'g'], ['l', 17, 20, 19, 19, 'g'], ['px', 8, 20, 'g'], ['px', 18, 10, 'g'],
      ['l', 9, 14, 12, 15, 'k'], ['l', 19, 14, 16, 15, 'k'],
      ['r', 10, 16, 2, 2, 'k'], ['r', 16, 16, 2, 2, 'k'],
      ['l', 12, 20, 16, 20, 'k'],
    ] },
  },

  // ── Le creature del MERLO ──
  // Boccale di birra con la schiuma, già allegro
  birra: {
    name: 'BIRRA', types: ['ACQUA'], base: { hp: 60, atk: 55, def: 45, spd: 40 },
    moves: ['schiumata', 'rutto', 'brindisi'],
    sprite: { w: 28, h: 28, pal: { a: '#f0b030', b: '#c07818', g: '#e8e4d0', c: '#f8e078', p: '#f08870' }, shapes: [
      ['r', 17, 11, 8, 11, 'g', { ol: true }], ['r', 19, 13, 4, 7, 'w', { ol: true }],
      ['r', 5, 9, 14, 16, 'a'],
      ['r', 5, 24, 14, 2, 'g', { ol: true }],
      ['px', 7, 21, 'c'], ['px', 16, 18, 'c'], ['px', 15, 22, 'c'],
      ['e', 7.5, 8.5, 3.5, 3, 'w'], ['e', 12, 7, 4, 3.5, 'w'], ['e', 16.5, 8.5, 3, 3, 'w'], ['e', 5.5, 11, 1.2, 2, 'w'],
      ['l', 7, 15, 8, 14, 'k'], ['l', 8, 14, 9, 15, 'k'], ['l', 14, 15, 15, 14, 'k'], ['l', 15, 14, 16, 15, 'k'],
      ['px', 6, 17, 'p'], ['px', 17, 17, 'p'],
      ['e', 11.5, 19, 1.6, 1.4, 'k'],
    ] },
  },
  // Un merlo, quello vero: nero col becco arancione
  merlo: {
    name: 'MERLO', types: ['VOLANTE'], base: { hp: 45, atk: 55, def: 40, spd: 75 },
    moves: ['beccata', 'fischietto', 'giornimerla'],
    sprite: { w: 28, h: 28, pal: { a: '#4c4c5c', b: '#26262e', o: '#f8a020' }, shapes: [
      ['l', 12, 23, 12, 26, 'o'], ['l', 16, 23, 16, 26, 'o'], ['l', 11, 26, 13, 26, 'o'], ['l', 15, 26, 17, 26, 'o'],
      ['p', [[19, 15], [26, 11], [26.5, 15], [21, 20]], 'a'],
      ['e', 15, 17, 8, 6.5, 'a'],
      ['e', 17, 16, 5.5, 3.5, 'b', { rot: 0.3, shade: false }],
      ['e', 10.5, 10, 5.5, 5, 'a'],
      ['p', [[5.5, 8.5], [1, 10.5], [5.5, 12]], 'o'],
      ['e', 9, 9, 1.8, 1.8, 'o', { shade: false }], ['r', 8, 8, 2, 2, 'k'], ['px', 8, 8, 'w'],
    ] },
  },
  // Pannello fotovoltaico sul suo cavalletto, abbronzato
  pannello: {
    name: 'PANNELLO', types: ['ELETTRO'], base: { hp: 55, atk: 50, def: 60, spd: 35 },
    moves: ['solarraggio', 'tuonoshock', 'superbonus'],
    sprite: { w: 28, h: 28, pal: { a: '#3a5cc0', b: '#1e3274', g: '#9cb8f0', y: '#f8d830' }, shapes: [
      ['l', 8, 18, 7, 26, 'k'], ['l', 20, 18, 21, 26, 'k'], ['l', 5, 26, 23, 26, 'k'],
      ['p', [[4, 6], [22, 6], [25, 19], [2, 19]], 'a', { ol: true }],
      ['l', 4, 10, 23, 10, 'g'], ['l', 3, 14, 24, 14, 'g'],
      ['l', 10, 6, 9, 19, 'g'], ['l', 16, 6, 17, 19, 'g'],
      ['px', 6, 7, 'w'], ['px', 5, 8, 'w'],
      ['r', 11, 11, 2, 2, 'w'], ['r', 18, 11, 2, 2, 'w'], ['px', 12, 12, 'k'], ['px', 19, 12, 'k'],
      ['l', 12, 16, 17, 16, 'w'], ['px', 11, 15, 'w'], ['px', 18, 15, 'w'],
      ['e', 24, 3.5, 2.5, 2.5, 'y', { shade: false }], ['px', 20, 3, 'y'], ['px', 24, 0, 'y'], ['px', 27, 6, 'y'],
    ] },
  },
  // BYD Dolphin giallo fluorescente, elettrica e silenziosa
  dolphin: {
    name: 'BYD DOLPHIN', types: ['ELETTRO'], base: { hp: 55, atk: 60, def: 50, spd: 70 },
    moves: ['accelerata', 'colonnina', 'clacson'],
    sprite: { w: 28, h: 28, pal: { a: '#dcf020', b: '#94a610', u: '#3a4a5c', g: '#a0a0a8' }, shapes: [
      ['p', [[1.5, 21], [2, 16], [8, 14.5], [11.5, 9.5], [20, 9.5], [24.5, 14], [26.5, 16], [26.5, 21]], 'a'],
      ['p', [[9, 14.5], [12.5, 10.8], [16, 10.8], [16, 14.5]], 'u'],
      ['p', [[17, 10.8], [19.5, 10.8], [23, 14.5], [17, 14.5]], 'u'],
      ['e', 13.5, 12.8, 1.5, 1.6, 'w'], ['e', 19.5, 12.8, 1.5, 1.6, 'w'], ['px', 14, 13, 'k'], ['px', 20, 13, 'k'],
      ['r', 24, 16, 2, 1, 'w'], ['l', 22, 19, 26, 19, 'k'],
      ['p', [[11, 16], [13, 16], [12, 17.5], [13.5, 17.5], [10.5, 20], [11.3, 18.3], [10, 18.3]], 'w', { shade: false }],
      ['e', 7.5, 21, 3, 3, 'k'], ['e', 21, 21, 3, 3, 'k'],
      ['e', 7.5, 21, 1.4, 1.4, 'g'], ['e', 21, 21, 1.4, 1.4, 'g'],
    ] },
  },

  // ── I vini del DOTT. MARCHI ──
  // Il re dei vini, con la corona
  barolo: {
    name: 'BAROLO', types: ['FUOCO'], base: { hp: 65, atk: 70, def: 60, spd: 45 },
    moves: ['gradazione', 'nebbiolo', 'redeivini'],
    sprite: { w: 28, h: 28, pal: { a: '#8a2a2e', b: '#561618', c: '#efe2c0', y: '#f0c030' }, shapes: [
      ['p', [[12, 8], [16, 8], [16, 10], [20, 12], [20, 26], [8, 26], [8, 12], [12, 10]], 'a'],
      ['r', 12, 5, 4, 4, 'b'],
      ['p', [[10, 5.5], [10, 1], [12, 3], [14, 0.5], [16, 3], [18, 1], [18, 5.5]], 'y', { ol: true }],
      ['r', 9, 14, 10, 10, 'c', { ol: true }],
      ['l', 10, 16, 12, 17, 'k'], ['l', 17, 16, 15, 17, 'k'],
      ['r', 11, 18, 2, 2, 'k'], ['r', 15, 18, 2, 2, 'k'],
      ['l', 11, 21, 16, 21, 'k'], ['px', 10, 20, 'k'], ['px', 17, 20, 'k'],
      ['l', 10, 23, 17, 23, 'b'],
    ] },
  },
  // Pomerol santo: aureola e chiavi di San Pietro
  petrus: {
    name: 'PETRUS', types: ['NORMALE'], base: { hp: 75, atk: 60, def: 65, spd: 40 },
    moves: ['merlot', 'chiavicielo', 'barrique'],
    sprite: { w: 28, h: 28, pal: { a: '#4a3a5a', b: '#2a2036', r: '#8a1020', c: '#f8f4ec', y: '#f0d040' }, shapes: [
      ['e', 14, 2.5, 5.5, 2, 'y', { shade: false }], ['e', 14, 2.5, 3.2, 0.9, 'w'],
      ['p', [[12, 8], [16, 8], [16, 10], [20, 12], [20, 26], [8, 26], [8, 12], [12, 10]], 'a'],
      ['r', 12, 5, 4, 4, 'r'],
      ['r', 9, 14, 10, 8, 'c', { ol: true }],
      ['r', 11, 16, 2, 2, 'k'], ['r', 15, 16, 2, 2, 'k'], ['px', 11, 16, 'w'], ['px', 15, 16, 'w'],
      ['l', 12, 20, 15, 20, 'k'], ['px', 11, 19, 'k'], ['px', 16, 19, 'k'],
      ['l', 10, 24, 14, 24, 'y'], ['r', 15, 23, 3, 3, 'y'], ['px', 10, 25, 'y'], ['px', 12, 25, 'y'],
    ] },
  },
  // Champagne con la stagnola d'oro e il tappo che salta
  krug: {
    name: 'KRUG', types: ['ACQUA'], base: { hp: 55, atk: 65, def: 50, spd: 75 },
    moves: ['tappo', 'bollicine', 'brut'],
    sprite: { w: 28, h: 28, pal: { a: '#2e5a3a', b: '#173222', y: '#e8c040', z: '#b08a20', c: '#f4ecd4', p: '#a8d8f0' }, shapes: [
      ['p', [[12, 9], [16, 9], [19.5, 15], [20, 26], [8, 26], [8.5, 15]], 'a'],
      ['r', 12, 5, 4, 7, 'y'], ['l', 12, 10, 15, 10, 'z'],
      ['e', 14, 1.8, 2, 1.6, 'z'],
      ['r', 8, 3, 2, 2, 'p'], ['r', 19, 2, 2, 2, 'p'], ['px', 21, 7, 'p'], ['px', 7, 8, 'p'], ['px', 9, 6, 'p'],
      ['e', 14, 20, 5.2, 4, 'c', { ol: true }],
      ['r', 11, 18, 2, 2, 'k'], ['r', 15, 18, 2, 2, 'k'], ['px', 11, 18, 'w'], ['px', 15, 18, 'w'],
      ['e', 14, 22, 1.3, 1, 'k'],
    ] },
  },
  // Il borgognone da collezione, col monocolo
  romanee: {
    name: 'ROMANÉE', types: ['ERBA'], base: { hp: 60, atk: 65, def: 55, spd: 55 },
    moves: ['terroir', 'scontrino', 'decantazione'],
    sprite: { w: 28, h: 28, pal: { a: '#4e7a3a', b: '#2c4a20', r: '#a01830', c: '#f2ead0', y: '#e0b030' }, shapes: [
      ['p', [[12, 6], [16, 6], [16, 8], [20, 14], [20, 26], [8, 26], [8, 14], [12, 8]], 'a'],
      ['r', 12, 1, 4, 6, 'r'],
      ['r', 9, 15, 10, 9, 'c', { ol: true }],
      ['l', 10, 17, 12, 17, 'k'], ['r', 11, 18, 2, 1, 'k'],
      ['e', 15.5, 18, 2.3, 2.3, 'y', { shade: false }], ['e', 15.5, 18, 1.3, 1.3, 'c', { shade: false }], ['r', 15, 18, 1, 1, 'k'],
      ['l', 17, 20, 19, 25, 'y'],
      ['l', 11, 22, 14, 22, 'k'],
    ] },
  },
};

// Sprite degli allenatori (palette per allenatore: a = pelle, b = vestiti)
const PK_SPRITES = {
  trainer: { w: 28, h: 28, pal: { a: '#f8c8a0', b: '#4878d0' }, shapes: [
    ['p', [[6, 28], [8, 17], [11, 15.5], [17, 15.5], [20, 17], [22, 28]], 'b'],
    ['p', [[11.5, 15.5], [14, 19], [16.5, 15.5]], 'w'],
    ['e', 14, 9.5, 5, 5.5, 'a', { shade: false }],
    ['e', 14, 6, 5.6, 3.4, 'b'],
    ['r', 13, 6, 9, 2, 'b', { shade: false }],
    ['r', 12, 10, 1, 2, 'k'], ['r', 16, 10, 1, 2, 'k'],
    ['l', 13, 13, 15, 13, 'k'],
  ] },
  leader: { w: 28, h: 28, pal: { a: '#f8c8a0', b: '#7040a0' }, shapes: [
    ['p', [[3, 28], [7, 16], [21, 16], [25, 28]], 'b'],
    ['r', 9, 17, 10, 11, 'w'],
    ['p', [[14, 18], [16.5, 18], [15, 21], [17.5, 21], [12.5, 27], [14, 22.5], [11.5, 22.5]], 'b', { shade: false }],
    ['e', 14, 10, 5, 5.5, 'a', { shade: false }],
    ['p', [[8.5, 10], [7, 4], [10, 6], [11, 1.5], [14, 4.5], [17, 1.5], [18, 6], [21, 4], [19.5, 10], [18, 7], [10, 7]], 'k'],
    ['r', 12, 11, 1, 2, 'k'], ['r', 16, 11, 1, 2, 'k'],
    ['l', 13, 14, 16, 13, 'k'],
  ] },
  // JERRY (dalle foto in sprites/foto): occhiali tondi neri, barbetta, cappellino crema e fucsia.
  // 56×56: gli allenatori, come in Cristallo, sono a risoluzione piena
  jerry: { w: 56, h: 56, pal: { a: '#f2c230', b: '#c8941a', s: '#f6caa8', t: '#eebe9e', u: '#c89078', c: '#f4f0c4', m: '#d8287c' }, shapes: [
    ['p', [[5, 56], [8, 45], [18, 39.5], [38, 39.5], [48, 45], [51, 56]], 'a'],
    ['l', 15, 42, 13, 56, 'b'], ['l', 41, 42, 43, 56, 'b'],
    ['e', 28, 39.6, 7.6, 3.3, 'b', { shade: false }],
    ['e', 16.5, 25.5, 2.4, 3.6, 's'], ['e', 39.5, 25.5, 2.4, 3.6, 's'],
    ['px', 16, 25, 't'], ['px', 40, 25, 't'],
    ['r', 23, 33, 10, 8, 's'],
    ['e', 28, 25, 10.8, 12.5, 's'],
    ['e', 28, 33, 8.2, 4.4, 't'],
    ['px', 23, 33, 'u'], ['px', 26, 35, 'u'], ['px', 30, 35, 'u'], ['px', 33, 33, 'u'], ['px', 28, 36, 'u'],
    ['l', 28, 26, 28, 28, 't'], ['px', 27, 29, 't'], ['px', 29, 29, 't'],
    ['l', 26, 32, 30, 32, 'u'], ['l', 27, 33, 29, 33, 't'],
    ['e', 22.8, 24, 4.9, 4.1, 'k'], ['e', 33.2, 24, 4.9, 4.1, 'k'],
    ['e', 22.8, 24, 3.3, 2.6, 's'], ['e', 33.2, 24, 3.3, 2.6, 's'],
    ['r', 27, 23, 2, 1, 'k'], ['l', 15, 23, 18, 23, 'k'], ['l', 38, 23, 41, 23, 'k'],
    ['r', 21, 24, 4, 2, 'w'], ['r', 31, 24, 4, 2, 'w'],
    ['r', 22, 24, 2, 2, 'k'], ['r', 32, 24, 2, 2, 'k'],
    ['px', 21, 22, 'w'], ['px', 31, 22, 'w'],
    ['e', 28, 39, 6.2, 2.2, 's'],
    ['p', [[16, 18], [16.5, 10], [20, 6], [28, 4.5], [36, 6], [39.5, 10], [40, 18]], 'c'],
    ['p', [[18.5, 8.5], [21, 5.8], [28, 4.8], [35, 5.8], [37.5, 8.5], [28, 10]], 'm'],
    ['p', [[24.5, 13.5], [31.5, 12], [29, 15]], 'm'],
    ['p', [[15, 16.5], [41, 16.5], [43.5, 20], [12.5, 20]], 'c', { ol: true }],
    ['l', 16, 21, 40, 21, 't'],
  ] },
  // JERRY col piumino nero
  jerry_piumino: { w: 56, h: 56, pal: { a: '#3e3e44', b: '#232328', s: '#f6caa8', t: '#eebe9e', u: '#c89078', h: '#c49a62', g: '#8a6a3e' }, shapes: [
    ['p', [[3, 56], [6, 45], [18, 39], [38, 39], [50, 45], [53, 56]], 'a'],
    ['l', 5, 47, 51, 47, 'b'], ['l', 4, 52, 52, 52, 'b'],
    ['l', 14, 42, 12, 56, 'b'], ['l', 42, 42, 44, 56, 'b'],
    ['e', 16.5, 25.5, 2.4, 3.6, 's'], ['e', 39.5, 25.5, 2.4, 3.6, 's'],
    ['px', 16, 25, 't'], ['px', 40, 25, 't'],
    ['r', 23, 33, 10, 8, 's'],
    ['e', 28, 25, 10.8, 12.5, 's'],
    ['e', 28, 33, 8.2, 4.4, 't'],
    ['px', 23, 33, 'u'], ['px', 26, 35, 'u'], ['px', 30, 35, 'u'], ['px', 33, 33, 'u'], ['px', 28, 36, 'u'],
    ['l', 28, 26, 28, 28, 't'], ['px', 27, 29, 't'], ['px', 29, 29, 't'],
    ['l', 26, 32, 30, 32, 'u'], ['l', 27, 33, 29, 33, 't'],
    ['e', 22.8, 24, 4.9, 4.1, 'k'], ['e', 33.2, 24, 4.9, 4.1, 'k'],
    ['e', 22.8, 24, 3.3, 2.6, 's'], ['e', 33.2, 24, 3.3, 2.6, 's'],
    ['r', 27, 23, 2, 1, 'k'], ['l', 15, 23, 18, 23, 'k'], ['l', 38, 23, 41, 23, 'k'],
    ['r', 21, 24, 4, 2, 'w'], ['r', 31, 24, 4, 2, 'w'],
    ['r', 22, 24, 2, 2, 'k'], ['r', 32, 24, 2, 2, 'k'],
    ['px', 21, 22, 'w'], ['px', 31, 22, 'w'],
    ['p', [[18, 43], [19.5, 35.5], [36.5, 35.5], [38, 43], [33, 45], [23, 45]], 'a', { shade: false, ol: true }],
    ['l', 28, 36, 28, 56, 'k'], ['r', 27, 37, 2, 3, 'w'],
    ['p', [[17, 25], [16.5, 16], [19, 11], [24, 8.5], [31, 8], [36, 9.5], [39, 13], [39.8, 19], [39.5, 24], [37, 17.5], [32, 15.5], [26, 16], [21, 17.5], [18.5, 21]], 'h'],
    ['l', 21, 12, 26, 9.5, 'g'], ['l', 29, 10, 35, 11.5, 'g'], ['l', 19, 16, 22, 13, 'g'],
    ['l', 20, 18.5, 25, 18, 'h'], ['l', 31, 18, 36, 18.5, 'h'],
  ] },
  // IL MERLO (dalla foto in sprites/foto): ricci scuri, barba, occhiali rettangolari, piumino blu
  ilmerlo: { w: 56, h: 56, pal: { a: '#2c3c6c', b: '#1a2446', s: '#f2c4a0', t: '#e6b08c', h: '#3c2618', g: '#24160c', r: '#d04030' }, shapes: [
    ['p', [[3, 56], [6, 45], [18, 39], [38, 39], [50, 45], [53, 56]], 'a'],
    ['l', 5, 47, 51, 47, 'b'], ['l', 4, 52, 52, 52, 'b'],
    ['l', 14, 42, 12, 56, 'b'], ['l', 42, 42, 44, 56, 'b'],
    ['e', 13.5, 12, 3, 3, 'h'], ['e', 42.5, 12, 3, 3, 'h'], ['e', 17, 5.5, 3, 3, 'h'], ['e', 39, 5.5, 3, 3, 'h'], ['e', 28, 2.5, 4, 2.5, 'h'],
    ['e', 28, 13, 13.5, 9, 'h'], ['e', 16.5, 18, 5, 7, 'h'], ['e', 39.5, 18, 5, 7, 'h'],
    ['e', 21, 8, 6, 5, 'h'], ['e', 35, 8, 6, 5, 'h'], ['e', 28, 6, 7, 4.5, 'h'],
    ['e', 15.5, 25.5, 2.4, 3.6, 's'], ['e', 40.5, 25.5, 2.4, 3.6, 's'],
    ['r', 23, 33, 10, 8, 's'],
    ['e', 28, 25.5, 10.8, 12.5, 's'],
    ['e', 21.5, 15, 4.5, 3, 'h'], ['e', 28.5, 14, 5, 3, 'h'], ['e', 35, 15, 4, 3, 'h'],
    ['px', 18, 10, 'g'], ['px', 23, 6, 'g'], ['px', 30, 5, 'g'], ['px', 36, 9, 'g'], ['px', 40, 14, 'g'], ['px', 14, 16, 'g'],
    ['l', 20, 13, 23, 12, 'g'], ['l', 27, 12, 30, 11, 'g'], ['l', 33, 13, 36, 12, 'g'], ['l', 15, 20, 15, 23, 'g'], ['l', 41, 20, 41, 23, 'g'],
    ['p', [[17, 27], [18, 33], [22, 37.5], [28, 39.5], [34, 37.5], [38, 33], [39, 27], [36, 30], [32, 31], [24, 31], [20, 30]], 'h'],
    ['e', 28, 30.5, 5.5, 1.8, 'h'],
    ['p', [[23.5, 32], [32.5, 32], [30.5, 35.5], [25.5, 35.5]], 'k'],
    ['r', 24.5, 32, 7, 1.5, 'w'],
    ['l', 28, 26, 28, 28, 't'], ['px', 27, 29, 't'], ['px', 29, 29, 't'],
    ['r', 17, 20, 10, 7, 'k'], ['r', 29, 20, 10, 7, 'k'],
    ['r', 18, 21, 8, 5, 's'], ['r', 30, 21, 8, 5, 's'],
    ['r', 27, 21, 2, 1, 'k'], ['l', 15, 21, 17, 21, 'k'], ['l', 39, 21, 41, 21, 'k'],
    ['l', 20, 24, 23, 23, 'k'], ['l', 23, 23, 24, 24, 'k'], ['l', 32, 24, 33, 23, 'k'], ['l', 33, 23, 36, 24, 'k'],
    ['p', [[18, 43], [19.5, 37], [36.5, 37], [38, 43], [33, 45], [23, 45]], 'a', { shade: false, ol: true }],
    ['p', [[22.5, 38], [33.5, 38], [28, 45]], 'r'],
    ['l', 28, 45, 28, 56, 'k'],
  ] },
  badge_scintilla: { w: 20, h: 20, pal: { a: '#f8d830', b: '#c06010' }, shapes: [
    ['e', 10, 10, 8.5, 8.5, 'a', { ol: true }],
    ['p', [[9.5, 3], [13.5, 3], [11.5, 8], [14.5, 8], [7.5, 17], [9, 11], [6, 11]], 'b', { shade: false, ol: true }],
  ] },
  // DOTT. MARCHI (dalla foto in sprites/foto): capelli lunghi mossi, occhiali dorati, pizzetto, calice in mano
  marchi: { w: 56, h: 56, pal: { a: '#2c2c32', b: '#18181c', s: '#eec0a0', t: '#dcaa88', u: '#bc8a70', h: '#4a3020', g: '#2c1a10', e: '#c8a040', l: '#ecdcc4', r: '#d84030', v: '#8a1838', q: '#eef0f6', f: '#6e4c32' }, shapes: [
    ['p', [[3, 56], [6, 45], [18, 39], [38, 39], [50, 45], [53, 56]], 'a'],
    ['l', 14, 42, 12, 56, 'b'], ['l', 42, 42, 44, 56, 'b'],
    ['e', 28, 22, 14, 17, 'h'],
    ['p', [[14, 22], [13, 36], [16, 41], [19, 38], [18, 26]], 'h'], ['p', [[42, 22], [43, 36], [40, 41], [37, 38], [38, 26]], 'h'],
    ['r', 24, 33, 8, 8, 's'],
    ['e', 28, 25, 9.5, 12, 's'],
    ['p', [[18, 23], [18, 13], [22, 8], [28, 6.5], [34, 8], [38, 13], [38, 23], [35.5, 15], [30, 12.5], [26, 13], [21, 16]], 'h'],
    ['l', 27, 6, 25, 2, 'h'], ['l', 29, 6, 31, 1, 'h'], ['l', 28, 6, 28, 3, 'g'],
    ['l', 22, 10, 19, 20, 'g'], ['l', 34, 10, 37, 20, 'g'], ['l', 16, 28, 15, 36, 'g'], ['l', 40, 28, 41, 36, 'g'], ['l', 30, 9, 33, 13, 'g'],
    ['e', 23, 24, 4.6, 3.6, 'e'], ['e', 33, 24, 4.6, 3.6, 'e'],
    ['e', 23, 24, 3.6, 2.6, 'l'], ['e', 33, 24, 3.6, 2.6, 'l'],
    ['l', 27, 22, 29, 22, 'e'], ['l', 18, 23, 19, 23, 'e'], ['l', 37, 23, 38, 23, 'e'],
    ['r', 22, 24, 2, 1, 'k'], ['r', 32, 24, 2, 1, 'k'], ['l', 21, 22, 24, 22, 'u'], ['l', 32, 22, 35, 22, 'u'],
    ['l', 28, 26, 28, 29, 't'], ['px', 27, 30, 't'], ['px', 29, 30, 't'],
    ['p', [[23.5, 32.5], [28, 31.5], [32.5, 32.5], [31, 33], [25, 33]], 'f'],
    ['l', 25, 34, 30, 34, 'k'], ['px', 31, 33, 'k'],
    ['p', [[25, 35.5], [31, 35.5], [30.5, 37], [28, 38.5], [25.5, 37]], 'f'],
    ['px', 20, 32, 'u'], ['px', 21, 34, 'u'], ['px', 36, 32, 'u'], ['px', 35, 34, 'u'], ['px', 23, 36, 'u'], ['px', 33, 36, 'u'],
    ['p', [[23, 39], [33, 39], [28, 47]], 'r'],
    ['p', [[18, 42], [20, 37], [24, 39], [28, 48], [22, 46]], 'a', { shade: false, ol: true }],
    ['p', [[38, 42], [36, 37], [32, 39], [28, 48], [34, 46]], 'a', { shade: false, ol: true }],
    ['l', 29, 48, 29, 56, 'k'], ['r', 37, 47, 4, 1, 'w'], ['px', 36, 46, 'w'],
    ['p', [[6, 49], [14, 47], [17, 56], [3, 56]], 'a'],
    ['l', 11, 39, 11, 46, 'q'],
    ['e', 11, 33, 5, 6.5, 'q', { ol: true }],
    ['e', 11, 35.5, 4, 3.5, 'v'], ['px', 9, 30, 'w'], ['px', 8, 31, 'w'],
    ['e', 11, 47, 3, 2.5, 's'],
  ] },
  // FIAMMI di schiena (dalla foto in sprites/foto): capelli raccolti con gli occhiali da sole in testa,
  // maglia corallo col nome e il 10
  fiammi_back: { w: 56, h: 56, pal: { a: '#f45464', b: '#c83646', s: '#f0c0a0', h: '#5a3a28', g: '#3c2618', i: '#7c5638', o: '#e8602c', n: '#22408c' }, shapes: [
    ['p', [[5, 44], [11, 45], [10, 56], [4, 56]], 's'], ['p', [[51, 44], [45, 45], [46, 56], [52, 56]], 's'],
    ['p', [[14, 31], [6, 37], [5, 45], [11, 46]], 'a'], ['p', [[42, 31], [50, 37], [51, 45], [45, 46]], 'a'],
    ['p', [[9, 56], [10, 40], [14, 31], [22, 29], [34, 29], [42, 31], [46, 40], [47, 56]], 'a'],
    ['l', 12, 34, 11, 45, 'b'], ['l', 44, 34, 45, 45, 'b'],
    ['r', 24, 23, 8, 7, 's'],
    ['e', 28, 29.5, 5.5, 1.5, 'b'],
    ['e', 17.5, 18, 2, 3, 's'], ['e', 38.5, 18, 2, 3, 's'],
    ['e', 28, 15, 10, 11, 'h'],
    ['p', [[19, 18], [37, 18], [36, 24], [31, 26.5], [25, 26.5], [20, 24]], 'h'],
    ['l', 24, 8, 22, 21, 'g'], ['l', 30, 7, 31, 23, 'g'], ['l', 27, 11, 26, 25, 'g'], ['l', 34, 10, 35, 21, 'g'], ['l', 21, 12, 20, 19, 'g'],
    ['e', 28, 11, 3.5, 2.5, 'g'], ['l', 26, 10, 29, 10, 'i'],
    ['p', [[19, 10], [21, 6], [28, 4], [35, 6], [37, 10], [35, 8], [28, 6], [21, 8]], 'o'],
    ['l', 24, 5, 27, 4.5, 'i'],
    // FIAMMI
    ['r', 17, 33, 1, 5, 'n'], ['r', 18, 33, 2, 1, 'n'], ['px', 18, 35, 'n'],
    ['r', 21, 33, 1, 5, 'n'],
    ['px', 24, 33, 'n'], ['r', 23, 34, 1, 4, 'n'], ['r', 25, 34, 1, 4, 'n'], ['px', 24, 35, 'n'],
    ['r', 27, 33, 1, 5, 'n'], ['r', 31, 33, 1, 5, 'n'], ['px', 28, 34, 'n'], ['px', 29, 35, 'n'], ['px', 30, 34, 'n'],
    ['r', 33, 33, 1, 5, 'n'], ['r', 37, 33, 1, 5, 'n'], ['px', 34, 34, 'n'], ['px', 35, 35, 'n'], ['px', 36, 34, 'n'],
    ['r', 39, 33, 1, 5, 'n'],
    // 10
    ['r', 21, 40, 3, 13, 'n'], ['r', 19, 41, 2, 2, 'n'],
    ['e', 31.5, 46.5, 5, 6.5, 'n'], ['e', 31.5, 46.5, 2.4, 4.2, 'a', { shade: false }],
  ] },
  badge_calice: { w: 20, h: 20, pal: { a: '#f0d040', b: '#b08020', v: '#a01838' }, shapes: [
    ['e', 10, 10, 8.5, 8.5, 'a', { ol: true }],
    ['p', [[6, 4], [14, 4], [13.5, 8], [10, 11], [6.5, 8]], 'v', { shade: false, ol: true }],
    ['l', 10, 11, 10, 14, 'k'], ['l', 8, 15, 12, 15, 'k'],
  ] },
};

const PK_TRAINERS = {
  jerry: {
    title: 'ALLENATORE', name: 'JERRY', sprite: 'jerry', smart: 0.5, // oppure sprite: 'jerry_piumino'
    intro: 'Ehi! Per arrivare dal capopalestra devi prima passare da me!',
    defeat: 'Pazienza, tanto mi resta la NASPI.',
    team: [{ species: 'cimolai', level: 8 }, { species: 'mojito', level: 8 }, { species: 'naspi', level: 8 }, { species: 'cartamagic', level: 9 }],
  },
  merlo: {
    title: 'ECOLOGISTA', name: 'MERLO', sprite: 'ilmerlo', smart: 0.6,
    intro: 'Ho caricato la macchina col sole e mi sono fatto una birra. Sono carico!',
    defeat: 'Vabbè, ci bevo su. Tanto la birra è a chilometro zero.',
    team: [{ species: 'birra', level: 9 }, { species: 'merlo', level: 9 }, { species: 'pannello', level: 9 }, { species: 'dolphin', level: 10 }],
  },
  // Il vecchio capopalestra segnaposto (non più in palestra)
  volta: {
    title: 'CAPOPALESTRA', name: 'VOLTA', sprite: 'leader', pal: { b: '#7040a0' }, smart: 0.75,
    intro: 'Benvenuta nella PALESTRA SCINTILLA! Io sono VOLTA. Vediamo se reggi il voltaggio!',
    defeat: 'Che energia! Te la sei meritata: ecco la MEDAGLIA SCINTILLA!',
    team: [{ species: 'spinotto', level: 15, moves: ['scintilla', 'azione', 'fulmisguardo'] }, { species: 'bulbolux', level: 16 }],
    items: { superpozione: 1 },
  },
  marchi: {
    title: 'CAPOPALESTRA', name: 'DOTT. MARCHI', sprite: 'marchi', smart: 0.75,
    intro: 'Benvenuta nella mia CANTINA. Io sono il DOTT. MARCHI. Vediamo se hai il palato per una vera degustazione!',
    defeat: 'Notevole. Finale lungo, retrogusto di vittoria. Ti sei meritata la MEDAGLIA CALICE!',
    team: [{ species: 'barolo', level: 11 }, { species: 'petrus', level: 11 }, { species: 'krug', level: 11 }, { species: 'romanee', level: 12 }],
    items: { superpozione: 1 },
  },
  // ── Avventura (versione B) ──
  // Il MERLO capopalestra della PALESTRA SCINTILLA
  merlo_capo: {
    title: 'CAPOPALESTRA', name: 'MERLO', sprite: 'ilmerlo', smart: 0.7,
    intro: 'Benvenuta nella PALESTRA SCINTILLA! Io sono il MERLO: qui l\'energia è tutta rinnovabile. Vediamo se reggi il voltaggio!',
    defeat: 'Vabbè, ci bevo su. Tanto la birra è a chilometro zero. Ecco la MEDAGLIA SCINTILLA!',
    after: 'Torna quando vuoi, ti offro una birra. Spillata col fotovoltaico.',
    team: [{ species: 'birra', level: 11 }, { species: 'merlo', level: 11 }, { species: 'pannello', level: 11 }, { species: 'dolphin', level: 12 }],
    items: { superpozione: 1 },
  },
  // Segnaposto della PALESTRA CANTINA
  gino: {
    title: 'CAMERIERE', name: 'GINO', sprite: 'trainer', pal: { b: '#303030' }, smart: 0.6,
    intro: 'Ha prenotato? No? Allora deve passare da me!',
    defeat: 'Le porto il conto… ah no, ha vinto lei.',
    after: 'Il DOTT. MARCHI la aspetta in fondo. Non chieda la carta dei vini: la sa a memoria.',
    team: [{ species: 'spinotto', level: 9 }, { species: 'bulbolux', level: 9 }],
  },
};

// ─── Avventura (versione B): mappe da esplorare ─────────────────────────────
// Personaggi sulla mappa (16×16, disegnati dal gioco): colori e acconciatura.
// style: 'bun' (capelli raccolti), 'short', 'long', 'curly', 'cap' (cappellino).
const PK_LOOKS = {
  fiammi:      { style: 'bun',   hair: '#5a3a28', skin: '#f0c0a0', shirt: '#f45464', pants: '#2a2a3a', shades: '#e8602c' },
  jerry:       { style: 'cap',   hair: '#c49a62', skin: '#f6caa8', shirt: '#f2c230', pants: '#3a4a7a', cap: '#f4f0c4', capTop: '#d8287c', glasses: true },
  merlo:       { style: 'curly', hair: '#3c2618', skin: '#f2c4a0', shirt: '#2c3c6c', pants: '#2a2a3a', glasses: true, beard: true },
  marchi:      { style: 'long',  hair: '#4a3020', skin: '#eec0a0', shirt: '#2c2c32', pants: '#2a2a3a', glasses: true, beard: true },
  infermiera:  { style: 'long',  hair: '#f088b0', skin: '#f8d0b0', shirt: '#f8f8f8', pants: '#f8f8f8' },
  guida:       { style: 'short', hair: '#303030', skin: '#e8b890', shirt: '#4878d0', pants: '#2a2a3a' },
  cameriere:   { style: 'short', hair: '#202020', skin: '#f0c0a0', shirt: '#f8f8f8', pants: '#202020' },
  ragazzo:     { style: 'cap',   hair: '#a06030', skin: '#f0c0a0', shirt: '#58a848', pants: '#3a4a7a', cap: '#e04040', capTop: '#e04040' },
  signora:     { style: 'long',  hair: '#c8c8c8', skin: '#f0c8a8', shirt: '#9060c0', pants: '#5a3a80' },
  escursionista: { style: 'short', hair: '#704020', skin: '#e0b088', shirt: '#c07030', pants: '#505a30', beard: true },
};

// Mappe. Ogni carattere è una casella 16×16:
//   fuori:  T albero  . prato  , sentiero  " erba alta  f fiori  ~ acqua  S cartello  R roccia
//           r tetto del CENTRO  G tetto della palestra  W muro  O finestra  P insegna CENTRO
//           M targa palestra  D porta  E ingresso della grotta
//   dentro: _ pavimento  = muro  C bancone  m tappetino (uscita: giù)  X pianta  H macchina cure
//           K computer  Q statua  V botte
//   grotta: : terra  B roccia  I ghiaccio (si scivola)  k sasso  h buca (si riempie coi massi)  L scala
// warps: porte/scale (x, y → mappa "to" in tx, ty, girata verso dir). Un warp con id si può
// chiudere o usare come traguardo dalla tappa (vedi PK_GYMS più sotto).
// npcs: { x, y, dir, look, text } per chi parla, { trainer, sight } per chi sfida con lo sguardo,
// { trainer, leader: true } per il capopalestra, { nurse: true } per l'infermiera del CENTRO.
// encounters: le creature selvatiche sulle caselle "on" (rate = probabilità a passo).
function pkCenterMap(exitTo, tx, ty) {
  return {
    name: 'CENTRO POKéMON', music: 'center', border: ' ',
    rows: [
      '==========',
      '=H______K=',
      '=CCCCCCCC=',
      '__________',
      'X________X',
      '__________',
      '____mm____',
    ],
    warps: [{ x: 4, y: 6, to: exitTo, tx, ty, dir: 'down' }, { x: 5, y: 6, to: exitTo, tx, ty, dir: 'down' }],
    npcs: [
      { x: 4, y: 1, dir: 'down', look: 'infermiera', nurse: true },
      { x: 7, y: 4, dir: 'left', look: 'escursionista', text: 'Lo sai? Questo CENTRO POKéMON fa anche da falò: se la tua squadra va KO, ricominci da qui.' },
    ],
  };
}

const PK_MAPS = {
  percorso1: {
    name: 'PERCORSO 1', music: 'route', border: 'T',
    rows: [
      'TTTTTTTTTTTTTTTT',
      'TTTTTGGGGGGTTTTT',
      'TTTTTGGGGGGTTTTT',
      'TTTTTWOWWOWTTTTT',
      'TTTTTWWDMWWTTTTT',
      'TTTf...,,...fTTT',
      'TTT....,,....TTT',
      'TTT..S.,,....TTT',
      'TTTTTT.,,.TTTTTT',
      'TTT""""""""""TTT',
      'TTT""""""""""TTT',
      'TTT""""""""""TTT',
      'TTTTTT.,,.TTTTTT',
      'TT~~~..,,....TTT',
      'TT~~~..,,..f.TTT',
      'TT~~~..,,....TTT',
      'TTTTT..,,.TTTTTT',
      'TTT"""",,.."".TT',
      'TTT"""",,.."".TT',
      'TTT.f..,,......T',
      'TTT....,,...TTTT',
      'TTT..S.,,....TTT',
      'TTT....,,....TTT',
      'TTTTTTT,,TTTTTTT',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [{ id: 'palestra', x: 7, y: 4, to: 'palestra1', tx: 4, ty: 11, dir: 'up' }],
    signs: [
      { x: 5, y: 21, text: 'PERCORSO 1\nA nord: PALESTRA SCINTILLA' },
      { x: 5, y: 7, text: 'PALESTRA SCINTILLA\nCapopalestra: MERLO\n«Energia pulita, lotte sporche.»' },
      { x: 8, y: 4, text: 'PALESTRA SCINTILLA' },
    ],
    npcs: [
      { x: 11, y: 14, dir: 'left', look: 'ragazzo', text: 'Le creature selvatiche si nascondono nell\'erba alta. Se non ti va di lottare puoi sempre scappare!' },
    ],
    items: [{ x: 14, y: 19, item: 'pozione' }],
    encounters: { on: '"', rate: 0.12, list: [
      { species: 'spinotto', min: 5, max: 7, w: 3 }, { species: 'nuvolotto', min: 5, max: 7, w: 2 }, { species: 'merlo', min: 5, max: 6, w: 2 },
    ] },
  },
  palestra1: {
    name: 'PALESTRA SCINTILLA', music: 'gym', border: ' ',
    rows: [
      '==========',
      '==========',
      '_X______X_',
      '__________',
      '_XX____XX_',
      '__________',
      '__________',
      '_XX____XX_',
      '__________',
      '__________',
      '_Q______Q_',
      '____mm____',
    ],
    warps: [{ x: 4, y: 11, to: 'percorso1', tx: 7, ty: 5, dir: 'down' }, { x: 5, y: 11, to: 'percorso1', tx: 7, ty: 5, dir: 'down' }],
    signs: [
      { x: 1, y: 10, text: 'PALESTRA SCINTILLA\nCapopalestra: MERLO' },
      { x: 8, y: 10, text: 'PALESTRA SCINTILLA\nCapopalestra: MERLO' },
    ],
    npcs: [
      { x: 2, y: 9, dir: 'right', look: 'guida', text: 'Ciao, futura campionessa! Il MERLO usa creature ELETTRO e VOLANTE, più una BIRRA. CIUFFETTO regge bene l\'elettricità, RANELLA un po\' meno!' },
      { x: 7, y: 6, dir: 'left', trainer: 'jerry', look: 'jerry', sight: 4 },
      { x: 4, y: 2, dir: 'down', trainer: 'merlo_capo', look: 'merlo', leader: true },
    ],
  },
  centro1: pkCenterMap('percorso2', 3, 11),
  percorso2: {
    name: 'PERCORSO 2', music: 'route', border: 'T',
    rows: [
      'RRRRRRRRRRRRRR',
      'RRRRRRERRRRRRR',
      'RRR...,....RRR',
      'TT....,.....TT',
      'TT.""",.""".TT',
      'TT.""",.""".TT',
      'TT....,.....TT',
      'TTrrrr,.....TT',
      'TTrrrr,..S..TT',
      'TTWOPW,.....TT',
      'TTWDWW,.....TT',
      'TT..,,,..f..TT',
      'TT..........TT',
      'TTTTTTTTTTTTTT',
    ],
    warps: [
      { id: 'centro', x: 3, y: 10, to: 'centro1', tx: 4, ty: 6, dir: 'up' },
      { id: 'grotta', x: 6, y: 1, to: 'grotta1', tx: 6, ty: 13, dir: 'up' },
    ],
    signs: [
      { x: 9, y: 8, text: 'GROTTA GELATA\nAttenzione: ghiaccio scivoloso e massi pesanti!' },
      { x: 4, y: 9, text: 'CENTRO POKéMON' },
    ],
    encounters: { on: '"', rate: 0.12, list: [
      { species: 'spinotto', min: 6, max: 8, w: 2 }, { species: 'nuvolotto', min: 6, max: 8, w: 2 }, { species: 'merlo', min: 6, max: 7, w: 2 },
    ] },
  },
  // Puzzle del ghiaccio (come la Via Gelata): ci si ferma solo contro un ostacolo
  grotta1: {
    name: 'GROTTA GELATA', music: 'cave', border: 'B',
    rows: [
      'BBBBBBBBBBBBB',
      'BBBBBBLBBBBBB',
      'BBBBB:::BBBBB',
      'BIIIIIIIIIIIB',
      'BIIIIIIIIIIIB',
      'BIIIIIIkIIIIB',
      'BkIIkIIIIIIIB',
      'BIIIIkIkkIIIB',
      'BIIIIIIIIIIIB',
      'BIIkIIkIIIIIB',
      'BBBB::::SBBBB',
      'BBBB:::::BBBB',
      'BBBBBB:BBBBBB',
      'BBBBBBEBBBBBB',
    ],
    warps: [
      { x: 6, y: 13, to: 'percorso2', tx: 6, ty: 2, dir: 'down' },
      { x: 6, y: 1, to: 'grotta2', tx: 6, ty: 1, dir: 'down' },
    ],
    signs: [{ x: 8, y: 10, text: 'Il ghiaccio è scivoloso: ci si ferma solo sbattendo contro qualcosa. La scala è in fondo!' }],
    encounters: { on: ':', rate: 0.06, list: [
      { species: 'squitto', min: 8, max: 10, w: 3 }, { species: 'grottino', min: 8, max: 10, w: 2 },
    ] },
  },
  // Puzzle dei massi (come FORZA nei giochi originali): spingili nelle buche
  grotta2: {
    name: 'GROTTA GELATA B1', music: 'cave', border: 'B',
    rows: [
      'BBBBBBBBBBBBB',
      'BBBBBBLBBBBBB',
      'BB:::::::::BB',
      'BB:::::::::BB',
      'BB:::::::::BB',
      'BB::BB:BB::BB',
      'BB:::::::::BB',
      'BBBBBB:BBBBBB',
      'BBBBBBhBBBBBB',
      'BBBBBBhBBBBBB',
      'BBBB:::::BBBB',
      'BBBB:::::BBBB',
      'BBBBBB:BBBBBB',
      'BBBBBBEBBBBBB',
    ],
    boulders: [{ x: 3, y: 4 }, { x: 9, y: 4 }],
    warps: [
      { x: 6, y: 1, to: 'grotta1', tx: 6, ty: 1, dir: 'down' },
      { x: 6, y: 13, to: 'percorso3', tx: 7, ty: 2, dir: 'down' },
    ],
    npcs: [
      { x: 8, y: 2, dir: 'down', look: 'escursionista', text: 'Quelle buche bloccano la strada… Spingi i massi camminandoci contro! Se uno si incastra, risali la scala e ridiscendi: tornano tutti al loro posto.' },
    ],
    items: [{ x: 8, y: 11, item: 'superpozione' }],
    encounters: { on: ':', rate: 0.04, list: [
      { species: 'squitto', min: 8, max: 10, w: 2 }, { species: 'grottino', min: 9, max: 11, w: 3 },
    ] },
  },
  percorso3: {
    name: 'PERCORSO 3', music: 'route', border: 'T',
    rows: [
      'RRRRRRRRRRRRRRRR',
      'RRRRRRRERRRRRRRR',
      'RRT....,....TRRR',
      'TT.....,......TT',
      'TTrrrr.,.GGGGGGT',
      'TTrrrr.,.GGGGGGT',
      'TTWOPW.,.WOWWOWT',
      'TTWDWW.,.WWDMWWT',
      'TT.,,,,,,,,,...T',
      'TT.....,.......T',
      'TT.f...,..S..f.T',
      'TTTTTTTTTTTTTTTT',
    ],
    warps: [
      { id: 'centro', x: 3, y: 7, to: 'centro2', tx: 4, ty: 6, dir: 'up' },
      { id: 'palestra', x: 11, y: 7, to: 'palestra2', tx: 4, ty: 11, dir: 'up' },
    ],
    signs: [
      { x: 7, y: 1, text: 'La grotta è buia e gelata: meglio non tornare indietro.' },
      { x: 10, y: 10, text: 'PALESTRA CANTINA\nCapopalestra: DOTT. MARCHI\n«Si lotta solo dopo il decanter.»' },
      { x: 4, y: 6, text: 'CENTRO POKéMON' },
      { x: 12, y: 7, text: 'PALESTRA CANTINA' },
    ],
  },
  centro2: pkCenterMap('percorso3', 3, 8),
  palestra2: {
    name: 'PALESTRA CANTINA', music: 'gym', border: ' ',
    rows: [
      '==========',
      '==========',
      '_V______V_',
      '_V______V_',
      '__________',
      'VVV____VVV',
      '__________',
      '__________',
      'VVV____VVV',
      '__________',
      '_Q______Q_',
      '____mm____',
    ],
    warps: [{ x: 4, y: 11, to: 'percorso3', tx: 11, ty: 8, dir: 'down' }, { x: 5, y: 11, to: 'percorso3', tx: 11, ty: 8, dir: 'down' }],
    signs: [
      { x: 1, y: 10, text: 'PALESTRA CANTINA\nCapopalestra: DOTT. MARCHI' },
      { x: 8, y: 10, text: 'PALESTRA CANTINA\nCapopalestra: DOTT. MARCHI' },
    ],
    npcs: [
      { x: 7, y: 9, dir: 'left', look: 'guida', text: 'Ehi! Il DOTT. MARCHI ha vini di ogni tipo: FUOCO, ACQUA, ERBA… Porta una squadra varia e qualche pozione!' },
      { x: 2, y: 7, dir: 'right', trainer: 'gino', look: 'cameriere', sight: 4 },
      { x: 4, y: 2, dir: 'down', trainer: 'marchi', look: 'marchi', leader: true },
    ],
  },
};

const PK_GYMS = {
  // L'id resta 'scintilla' perché le domande già salvate puntano lì
  scintilla: {
    name: 'PALESTRA CANTINA',
    badge: { name: 'MEDAGLIA CALICE', sprite: 'badge_calice' },
    player: {
      name: 'FIAMMI', sprite: 'fiammi_back', // di schiena, come la giocatrice in Cristallo
      team: [{ species: 'ranella', level: 16 }, { species: 'fiammino', level: 16 }, { species: 'ciuffetto', level: 17 }],
      bag: { pozione: 3, superpozione: 1 },
    },
    trainers: ['jerry', 'merlo', 'marchi'], // in ordine, l'ultimo è il capopalestra
  },

  // ── Avventura (versione B): tre tappe, una per domanda ──
  // Le tappe 2 e 3 cominciano in un CENTRO POKéMON: l'admin accende da solo il falò su quelle domande,
  // così se la squadra va KO si riparte da lì.
  // world.start: dove si comincia; world.end: il warp che chiude la tappa (altrimenti la chiude il
  // capopalestra con la medaglia); world.closed: warp chiusi in questa tappa, col messaggio.
  tappa1: {
    name: 'PERCORSO 1', sub: 'TAPPA 1 DI 3',
    badge: { name: 'MEDAGLIA SCINTILLA', sprite: 'badge_scintilla' },
    player: {
      name: 'FIAMMI', sprite: 'fiammi_back', look: 'fiammi',
      team: [{ species: 'ranella', level: 16 }, { species: 'fiammino', level: 16 }, { species: 'ciuffetto', level: 17 }],
      bag: { pozione: 3, superpozione: 1 },
    },
    world: {
      start: { map: 'percorso1', x: 7, y: 22, dir: 'up' },
      intro: 'Eccoti sul PERCORSO 1! In fondo alla strada ti aspetta la PALESTRA SCINTILLA.',
    },
  },
  tappa2: {
    name: 'GROTTA GELATA', sub: 'TAPPA 2 DI 3', bonfire: true,
    player: {
      name: 'FIAMMI', sprite: 'fiammi_back', look: 'fiammi',
      team: [{ species: 'ranella', level: 16 }, { species: 'fiammino', level: 16 }, { species: 'ciuffetto', level: 17 }],
      bag: { pozione: 3, superpozione: 1 },
    },
    world: {
      start: { map: 'centro1', x: 4, y: 5, dir: 'up' },
      intro: 'Le tue creature sono state curate. Per arrivare alla prossima città devi attraversare la GROTTA GELATA!',
      end: { map: 'percorso3', warp: 'centro', text: 'Finalmente un CENTRO POKéMON! La GROTTA GELATA è alle spalle.' },
      closed: { 'percorso3.palestra': 'La PALESTRA è chiusa. Prima riposati al CENTRO POKéMON qui accanto!' },
    },
  },
  tappa3: {
    name: 'PALESTRA CANTINA', sub: 'TAPPA 3 DI 3', bonfire: true,
    badge: { name: 'MEDAGLIA CALICE', sprite: 'badge_calice' },
    player: {
      name: 'FIAMMI', sprite: 'fiammi_back', look: 'fiammi',
      team: [{ species: 'ranella', level: 16 }, { species: 'fiammino', level: 16 }, { species: 'ciuffetto', level: 17 }],
      bag: { pozione: 3, superpozione: 2 },
    },
    world: {
      start: { map: 'centro2', x: 4, y: 5, dir: 'up' },
      intro: 'Squadra in forma smagliante. Qui accanto c\'è l\'ultima palestra: la PALESTRA CANTINA!',
    },
  },
};

// Tutto quello che serve a giocare una palestra, in un unico oggetto (finisce nella domanda)
function pkBundle(gymId) {
  const gym = PK_GYMS[gymId];
  if (!gym) return null;
  const b = { id: gymId, gym, trainers: {}, species: {}, moves: {}, items: PK_ITEMS, chart: PK_CHART, sprites: {} };
  const addMon = (m) => {
    const sp = PK_SPECIES[m.species];
    if (!sp) return;
    b.species[m.species] = sp;
    (m.moves || sp.moves).forEach(id => { if (PK_MOVES[id]) b.moves[id] = PK_MOVES[id]; });
  };
  const addTrainer = (id) => {
    const t = PK_TRAINERS[id];
    if (!t) return;
    b.trainers[id] = t;
    t.team.forEach(addMon);
    if (PK_SPRITES[t.sprite]) b.sprites[t.sprite] = PK_SPRITES[t.sprite];
  };
  gym.player.team.forEach(addMon);
  (gym.trainers || []).forEach(addTrainer);

  // Avventura: le mappe raggiungibili dall'inizio della tappa (senza passare da warp chiusi o dal traguardo)
  if (gym.world) {
    const w = gym.world;
    b.maps = {}; b.looks = {};
    const addLook = (id) => { if (PK_LOOKS[id]) b.looks[id] = PK_LOOKS[id]; };
    addLook(gym.player.look);
    const todo = [w.start.map];
    while (todo.length) {
      const id = todo.pop();
      const m = PK_MAPS[id];
      if (!m || b.maps[id]) continue;
      b.maps[id] = m;
      (m.warps || []).forEach(wp => {
        const key = id + '.' + wp.id;
        if (wp.id && ((w.closed && w.closed[key]) || (w.end && w.end.map === id && w.end.warp === wp.id))) return;
        todo.push(wp.to);
      });
      (m.npcs || []).forEach(n => { addLook(n.look); if (n.trainer) addTrainer(n.trainer); });
      ((m.encounters && m.encounters.list) || []).forEach(e => addMon({ species: e.species }));
    }
  }
  if (PK_SPRITES[gym.player.sprite]) b.sprites[gym.player.sprite] = PK_SPRITES[gym.player.sprite];
  if (gym.badge && PK_SPRITES[gym.badge.sprite]) b.sprites[gym.badge.sprite] = PK_SPRITES[gym.badge.sprite];
  return JSON.parse(JSON.stringify(b));
}
