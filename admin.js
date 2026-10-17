// Admin Panel — Bad News Quiz

// ─── State ───────────────────────────────────────────────────────────────────

let adminQuestions = {};
let adminStartQuestion = 'q1';
let adminItems = {};      // { id: { id, emoji, name } }
let editingId = null;
let nodeDragPositions = {};

const STORAGE_KEY    = 'badnews_admin_questions';
const STORAGE_START  = 'badnews_admin_start';
const STORAGE_ITEMS  = 'badnews_admin_items';
const STORAGE_LAYOUT = 'badnews_admin_layout';

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  showFileProtocolWarning();
  loadFromStorage();
  renderChessSelect();
  bindEvents();
  renderAll();
});

// Aperto come file dal disco le mappe OpenStreetMap vengono rifiutate: va usato admin.bat.
// Il browser tiene dati separati per file e per http://127.0.0.1, quindi per passare
// si esporta prima qui: l'admin nuovo, partendo vuoto, carica questions.js.
function showFileProtocolWarning() {
  if (location.protocol !== 'file:') return;
  const bar = document.createElement('div');
  bar.className = 'file-warning';
  bar.innerHTML = `
    ⚠️ <strong>Admin aperto come file:</strong> le mappe di "Dove eravamo?" non funzionano.
    Per passare all'admin nuovo: <strong>1)</strong> premi <em>Esporta questions.js</em> qui,
    <strong>2)</strong> chiudi questa scheda, <strong>3)</strong> fai doppio clic su <em>admin.bat</em>.
  `;
  document.body.prepend(bar);
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      adminQuestions = JSON.parse(raw);
    } else if (typeof QUESTIONS !== 'undefined') {
      adminQuestions = JSON.parse(JSON.stringify(QUESTIONS));
    }
    const start = localStorage.getItem(STORAGE_START);
    if (start) adminStartQuestion = start;
    else if (typeof START_QUESTION !== 'undefined') adminStartQuestion = START_QUESTION;

    // Carica items: localStorage → poi merge con ITEMS dal file statico
    const rawItems = localStorage.getItem(STORAGE_ITEMS);
    adminItems = rawItems ? JSON.parse(rawItems) : {};
    if (typeof ITEMS !== 'undefined') {
      // Il file statico ha la precedenza solo per id non ancora personalizzati
      Object.entries(ITEMS).forEach(([id, def]) => {
        if (!adminItems[id]) adminItems[id] = { ...def };
      });
    }

    // Posizioni del grafo: memoria del browser, altrimenti quelle salvate nell'export
    const rawLayout = localStorage.getItem(STORAGE_LAYOUT);
    if (rawLayout) nodeDragPositions = JSON.parse(rawLayout);
    else if (typeof LAYOUT !== 'undefined' && LAYOUT) nodeDragPositions = { ...LAYOUT };
  } catch (e) {
    console.error('Errore caricamento dati:', e);
    adminQuestions = {};
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY,   JSON.stringify(adminQuestions));
  localStorage.setItem(STORAGE_START, adminStartQuestion);
  localStorage.setItem(STORAGE_ITEMS, JSON.stringify(adminItems));
}

function saveLayoutToStorage() {
  localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(nodeDragPositions));
}

function resetLayout() {
  nodeDragPositions = {};
  localStorage.removeItem(STORAGE_LAYOUT);
  renderGraph(false);
  toast('Layout resettato', 'success');
}

// Rileva tutti gli id usati come grantsItem/requiresItem nelle domande
// e aggiunge eventuali nuovi item con valori di default
function syncItemsFromQuestions() {
  const usedIds = new Set();
  Object.values(adminQuestions).forEach(q => {
    q.options.forEach(opt => {
      if (opt.grantsItem)   usedIds.add(opt.grantsItem);
      if (opt.requiresItem) usedIds.add(opt.requiresItem);
    });
  });
  Object.values(adminQuestions).forEach(q => {
    if (q.removeItem) usedIds.add(q.removeItem);
  });
  usedIds.forEach(id => {
    if (!adminItems[id]) {
      adminItems[id] = { id, emoji: '🎁', name: id };
    }
  });
}

// ─── Items panel ─────────────────────────────────────────────────────────────

function getItemUsage(itemId) {
  // Restituisce array di id domanda che usano questo item
  return Object.keys(adminQuestions).filter(qid => {
    const q = adminQuestions[qid];
    if (q.removeItem === itemId) return true;
    return q.options.some(o => o.grantsItem === itemId || o.requiresItem === itemId);
  });
}

function renderItemsList() {
  const el = document.getElementById('items-list');
  if (!el) return;
  const ids = Object.keys(adminItems);
  if (ids.length === 0) {
    el.innerHTML = '<div class="empty-state">Nessun oggetto. Creane uno o usalo in una domanda.</div>';
    return;
  }
  el.innerHTML = ids.map(id => {
    const item = adminItems[id];
    const inUse = getItemUsage(id).length > 0;
    return `
      <div class="item-edit-row" data-item-id="${escHtml(id)}">
        <span class="item-id-label" title="${escHtml(id)}">${escHtml(id)}</span>
        <input type="text" class="item-emoji-input" value="${escHtml(item.emoji || '🎁')}" maxlength="4" placeholder="🎁" title="Emoji" />
        <input type="text" class="item-name-input" value="${escHtml(item.name || id)}" placeholder="Nome oggetto" title="Nome" />
        <button type="button" class="item-remove-btn${inUse ? ' item-in-use' : ''}" onclick="removeItem('${escHtml(id)}')" title="${inUse ? 'In uso nelle domande' : 'Rimuovi'}">✕</button>
      </div>
    `;
  }).join('');
}

function addItemRow() {
  // Salva prima i valori attuali
  saveItemsFromForm(false);

  const el = document.getElementById('items-list');
  if (!el) return;

  // Rimuovi eventuale riga "new" già aperta
  const existing = el.querySelector('.item-edit-row[data-new]');
  if (existing) { existing.querySelector('.item-id-new').focus(); return; }

  const row = document.createElement('div');
  row.className = 'item-edit-row';
  row.dataset.new = '1';
  row.innerHTML = `
    <input type="text" class="item-id-new" placeholder="ID (es. chiave)" title="ID oggetto" />
    <input type="text" class="item-emoji-input" value="🎁" maxlength="4" placeholder="🎁" title="Emoji" />
    <input type="text" class="item-name-input" placeholder="Nome oggetto" title="Nome" />
    <button type="button" class="item-remove-btn" onclick="this.closest('.item-edit-row').remove()" title="Annulla">✕</button>
  `;
  el.appendChild(row);
  row.querySelector('.item-id-new').focus();
}

function removeItem(id) {
  const usedIn = getItemUsage(id);
  if (usedIn.length > 0) {
    alert(`Impossibile rimuovere "${id}": è usato nelle domande:\n${usedIn.join(', ')}\n\nRimuovi prima i riferimenti da quelle domande.`);
    return;
  }
  delete adminItems[id];
  saveToStorage();
  renderItemsList();
  toast(`Oggetto "${id}" rimosso`, 'success');
}

function saveItemsFromForm(showToast = true) {
  const rows = document.querySelectorAll('#items-list .item-edit-row');
  let hasError = false;
  rows.forEach(row => {
    if (row.dataset.new) {
      // Nuova riga: leggi ID dall'input
      const idInput = row.querySelector('.item-id-new');
      const id = idInput ? idInput.value.trim() : '';
      if (!id) return; // riga vuota, ignora
      if (adminItems[id] && showToast) {
        toast(`ID "${id}" già esistente`, 'error');
        hasError = true;
        return;
      }
      const emoji = row.querySelector('.item-emoji-input').value.trim() || '🎁';
      const name  = row.querySelector('.item-name-input').value.trim()  || id;
      adminItems[id] = { id, emoji, name };
    } else {
      const id    = row.dataset.itemId;
      if (!id) return;
      const emoji = row.querySelector('.item-emoji-input').value.trim() || '🎁';
      const name  = row.querySelector('.item-name-input').value.trim()  || id;
      adminItems[id] = { id, emoji, name };
    }
  });
  saveToStorage();
  if (showToast && !hasError) toast('Oggetti salvati!', 'success');
  if (!hasError) renderItemsList();
}

// ─── Bind events ─────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('btn-new-question').addEventListener('click', openNewQuestionForm);
  document.getElementById('btn-cancel-form').addEventListener('click', closeForm);
  document.getElementById('btn-save-question').addEventListener('click', saveQuestion);
  document.getElementById('btn-add-option').addEventListener('click', addOptionRow);
  document.getElementById('field-chess').addEventListener('change', toggleChessFields);
  document.getElementById('field-hidden-word').addEventListener('input', toggleHiddenFields);
  bindMapEvents();
  document.getElementById('field-yatzy-target').addEventListener('input', updateYatzyOdds);
  document.getElementById('btn-refresh-graph').addEventListener('click', () => renderGraph(true));
  document.getElementById('btn-fit-graph').addEventListener('click', graphFitView);
  document.getElementById('btn-reset-layout').addEventListener('click', resetLayout);
  document.getElementById('btn-new-item').addEventListener('click', addItemRow);
  document.getElementById('btn-save-items').addEventListener('click', () => saveItemsFromForm(true));
  document.getElementById('btn-export').addEventListener('click', exportJS);
  document.getElementById('btn-import-pick').addEventListener('click', () => document.getElementById('file-import').click());
  document.getElementById('file-import').addEventListener('change', importJS);
  document.getElementById('btn-reset-storage').addEventListener('click', resetToDefault);
  document.getElementById('start-question-select').addEventListener('change', (e) => {
    adminStartQuestion = e.target.value;
    saveToStorage();
    toast('Domanda iniziale aggiornata', 'success');
  });
}

// ─── Render All ──────────────────────────────────────────────────────────────

function renderAll() {
  syncItemsFromQuestions();
  renderQuestionList();
  renderStartQuestionDropdown();
  renderItemsList();
  renderGraph(false);
}

// ─── Question List ────────────────────────────────────────────────────────────

function renderQuestionList() {
  const list = document.getElementById('question-list');
  const ids = Object.keys(adminQuestions);

  if (ids.length === 0) {
    list.innerHTML = '<div class="empty-state">Nessuna domanda. Creane una!</div>';
    return;
  }

  list.innerHTML = ids.map((id, idx) => {
    const q = adminQuestions[id];
    const correctCount = q.options.filter(o => o.correct).length;
    const isStart = id === adminStartQuestion ? ' ⭐ START' : '';
    const isFirst = idx === 0;
    const isLast  = idx === ids.length - 1;
    return `
      <div class="question-card" id="card-${escHtml(id)}">
        <div class="q-move-btns">
          <button class="btn-move" onclick="moveQuestion('${escHtml(id)}', -1)" ${isFirst ? 'disabled' : ''} title="Sposta su">▲</button>
          <button class="btn-move" onclick="moveQuestion('${escHtml(id)}',  1)" ${isLast  ? 'disabled' : ''} title="Sposta giù">▼</button>
        </div>
        <div class="question-card-info">
          <div class="q-id">${escHtml(id)}${isStart}</div>
          <div class="q-text">${escHtml(q.text)}</div>
          <div class="q-meta">
            <span>⏱ ${q.timer}s</span>
            ${q.bonfire ? '<span>🔥 Falò</span>' : ''}
            ${q.chess
              ? `<span>♟ ${escHtml(q.chess.name)}</span>`
              : q.snowball
              ? `<span>⛄ Palle di neve — ${escHtml(SNOWBALL_LEVELS[q.snowball.difficulty] || q.snowball.difficulty)}</span>`
              : q.ordering
              ? `<span>📋 ${escHtml(q.ordering.name)} — ${q.options.length} strade</span>`
              : q.map
              ? `<span>🗺️ Dove eravamo? — tolleranza ${formatRadius(q.map.radius)}${q.map.hideAnswer ? ' · 🙈 soluzione nascosta' : ''}</span>`
              : q.yatzy
              ? `<span>🎲 Yatzy — obiettivo ${q.yatzy.target}</span>`
              : q.guillotine
              ? `<span>🗡️ ${escHtml(GUILLOTINE_LEVELS[q.guillotine.difficulty] || q.guillotine.difficulty)}</span>`
              : q.pokemon
              ? `<span>⚔️ ${escHtml(q.pokemon.name)}</span>`
              : `<span>✓ ${correctCount} corretta/e</span>
            <span>⊞ ${q.options.filter(o => !o.hidden).length} opzioni</span>`}
            ${q.options.some(o => o.hidden) ? '<span>👆 nascosta</span>' : ''}
          </div>
        </div>
        <div class="question-card-actions">
          <button class="btn btn-ghost btn-sm" onclick="testQuestion('${escHtml(id)}')" title="Apre il gioco direttamente su questa domanda (modalità test)">▶ Prova</button>
          <button class="btn btn-blue btn-sm" onclick="editQuestion('${escHtml(id)}')">Modifica</button>
          <button class="btn btn-danger btn-sm" onclick="deleteQuestion('${escHtml(id)}')">Elimina</button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function openNewQuestionForm() {
  editingId = null;
  document.getElementById('form-title').textContent = 'Nuova Domanda';
  document.getElementById('field-id').value = generateId();
  document.getElementById('field-id').disabled = false;
  document.getElementById('field-text').value = '';
  document.getElementById('field-timer').value = '60';
  document.getElementById('field-remove-item').value = '';
  document.getElementById('field-remove-item-msg').value = '';
  document.getElementById('field-bonfire').checked = false;
  clearOptionsUI();
  addOptionRow();
  addOptionRow();
  setChessFields(null);
  setHiddenFields(null);
  showFormPanel();
}

function editQuestion(id) {
  editingId = id;
  const q = adminQuestions[id];
  document.getElementById('form-title').textContent = 'Modifica Domanda';
  document.getElementById('field-id').value = id;
  document.getElementById('field-id').disabled = true;
  document.getElementById('field-text').value = q.text;
  document.getElementById('field-timer').value = q.timer;
  document.getElementById('field-remove-item').value = q.removeItem || '';
  document.getElementById('field-remove-item-msg').value = q.removeItemMsg || '';
  document.getElementById('field-bonfire').checked = !!q.bonfire;
  clearOptionsUI();
  q.options.filter(o => !o.hidden).forEach(opt => addOptionRow(opt));
  setChessFields(q);
  setHiddenFields(q);
  showFormPanel();
}

// ─── Blocco scacchi ───────────────────────────────────────────────────────────

// Il blocco (nato per gli scacchi, id "field-chess") ora gestisce tutti i minigiochi:
// valori "<id puzzle>" per gli scacchi, "snowball:<livello>" per le palle di neve.

const SNOWBALL_LEVELS = { facile: 'Facile', normale: 'Normale', difficile: 'Difficile' };
function pkGymLabel(g) {
  if (g.world) return 'Avventura — ' + (g.sub ? g.sub.toLowerCase().replace(/^./, c => c.toUpperCase()) + ': ' : '') + g.name + (g.bonfire ? ' 🔥' : '');
  return 'Palestra — ' + g.name + ' (' + (g.trainers || []).length + ' sfide)';
}

const GUILLOTINE_LEVELS = { facile: 'Facile (5 calate)', normale: 'Normale (8 calate, qualche finta)', difficile: 'Difficile (10 calate, più finte)' };

function renderChessSelect() {
  const sel = document.getElementById('field-chess');

  if (typeof CHESS_PUZZLES !== 'undefined') {
    const group = document.createElement('optgroup');
    group.label = '♟ Scacchi';
    Object.entries(CHESS_PUZZLES).forEach(([id, p]) => group.appendChild(new Option(p.name, id)));
    sel.appendChild(group);
  }

  const snow = document.createElement('optgroup');
  snow.label = '⛄ Palle di neve';
  Object.entries(SNOWBALL_LEVELS).forEach(([lvl, name]) => snow.appendChild(new Option('Palle di neve — ' + name, 'snowball:' + lvl)));
  sel.appendChild(snow);

  const gil = document.createElement('optgroup');
  gil.label = '🗡️ Ghigliottina';
  Object.entries(GUILLOTINE_LEVELS).forEach(([lvl, name]) => gil.appendChild(new Option('Ghigliottina — ' + name, 'guillotine:' + lvl)));
  sel.appendChild(gil);

  if (typeof PK_GYMS !== 'undefined') {
    const gyms = document.createElement('optgroup');
    gyms.label = '⚔️ Palestra';
    Object.entries(PK_GYMS).forEach(([gid, g]) => gyms.appendChild(new Option(pkGymLabel(g), 'pokemon:' + gid)));
    sel.appendChild(gyms);
  }

  const dice = document.createElement('optgroup');
  dice.label = '🎲 Yatzy';
  dice.appendChild(new Option('Yatzy — batti un punteggio', 'yatzy'));
  sel.appendChild(dice);

  const geo = document.createElement('optgroup');
  geo.label = '🗺️ Dove eravamo?';
  geo.appendChild(new Option('Dove eravamo? — punto sulla mappa', 'map'));
  sel.appendChild(geo);

  if (typeof ORDER_PRESETS !== 'undefined') {
    const ord = document.createElement('optgroup');
    ord.label = '📋 Metti in ordine';
    Object.entries(ORDER_PRESETS).forEach(([key, p]) => ord.appendChild(new Option('Metti in ordine — ' + p.name, 'order:' + key)));
    sel.appendChild(ord);
  }
}

// Lista "Metti in ordine": dalla libreria, oppure ricostruita dalla domanda salvata
function getOrderPreset(key, q) {
  if (typeof ORDER_PRESETS !== 'undefined' && ORDER_PRESETS[key]) return ORDER_PRESETS[key];
  if (q && q.ordering && q.ordering.id === key) {
    const orders = {};
    q.options.filter(o => o.orderKey).forEach(o => {
      orders[o.orderKey] = { label: o.text.replace(/^📋\s*/, ''), items: o.order };
    });
    return { name: q.ordering.name, hint: q.ordering.hint, orders };
  }
  return null;
}

// Una riga "ordine → vai a / oggetto" per ogni ordine valido
function renderOrderRoutes(key, q) {
  const box = document.getElementById('order-routes');
  box.innerHTML = '';
  const preset = key ? getOrderPreset(key, q) : null;
  if (!preset) return;

  Object.entries(preset.orders).forEach(([orderKey, o]) => {
    const saved = q && q.ordering && q.ordering.id === key
      ? (q.options.find(opt => opt.orderKey === orderKey) || {})
      : {};
    const row = document.createElement('div');
    row.className = 'order-route';
    row.dataset.orderKey = orderKey;
    row.innerHTML = `
      <p class="order-route-title">📋 ${escHtml(o.label)}: <span>${o.items.map(escHtml).join(' › ')}</span></p>
      <div class="form-row">
        <div class="form-group">
          <label>Se ordina così vai a</label>
          <select class="order-next">
            <option value="">— Nessuna (vittoria) —</option>
            ${getQuestionOptions(saved.next || '')}
          </select>
        </div>
        <div class="form-group">
          <label>Concede oggetto (opzionale)</label>
          <input type="text" class="order-grants" placeholder="ID oggetto" value="${escHtml(saved.grantsItem || '')}" />
        </div>
      </div>
    `;
    box.appendChild(row);
  });
}

function setChessFields(q) {
  const sel = document.getElementById('field-chess');
  const chess = q && q.chess;
  // Puzzle salvato ma non più in libreria: lo aggiungo al menu per non perderlo
  if (chess && !Array.from(sel.options).some(o => o.value === chess.id)) {
    sel.appendChild(new Option(chess.name, chess.id));
  }
  // Lista "Metti in ordine" salvata ma non più in libreria: la aggiungo al menu
  if (q && q.ordering && !Array.from(sel.options).some(o => o.value === 'order:' + q.ordering.id)) {
    sel.appendChild(new Option('Metti in ordine — ' + q.ordering.name, 'order:' + q.ordering.id));
  }
  // Palestra salvata ma non più in pokemon-data.js: la aggiungo al menu
  if (q && q.pokemon && !Array.from(sel.options).some(o => o.value === 'pokemon:' + q.pokemon.gym)) {
    sel.appendChild(new Option('Palestra — ' + q.pokemon.name, 'pokemon:' + q.pokemon.gym));
  }
  sel.value = chess ? chess.id
            : (q && q.snowball) ? 'snowball:' + q.snowball.difficulty
            : (q && q.ordering) ? 'order:' + q.ordering.id
            : (q && q.map) ? 'map'
            : (q && q.yatzy) ? 'yatzy'
            : (q && q.guillotine) ? 'guillotine:' + q.guillotine.difficulty
            : (q && q.pokemon) ? 'pokemon:' + q.pokemon.gym
            : '';

  setMapDraft(q && q.map ? q.map : null);
  document.getElementById('field-yatzy-target').value = q && q.yatzy ? q.yatzy.target : 140;
  updateYatzyOdds();

  const solved = (chess || (q && (q.snowball || q.map || q.yatzy || q.guillotine || q.pokemon))) ? (q.options.find(o => o.correct) || {}) : {};
  document.getElementById('field-chess-next').innerHTML =
    '<option value="">— Nessuna (vittoria) —</option>' + getQuestionOptions(solved.next || '');
  document.getElementById('field-chess-grants').value = solved.grantsItem || '';
  toggleChessFields();
}

function toggleChessFields() {
  const value = document.getElementById('field-chess').value;
  const on = !!value;
  document.getElementById('chess-fields').style.display    = on ? 'block' : 'none';
  document.getElementById('options-section').style.display = on ? 'none'  : 'block';
  document.getElementById('hidden-block').style.display    = on ? 'none'  : 'block';

  const isOrder = value.startsWith('order:');
  document.getElementById('minigame-single').style.display = isOrder ? 'none' : '';
  renderOrderRoutes(isOrder ? value.slice('order:'.length) : '', editingId ? adminQuestions[editingId] : null);

  const isMap = value === 'map';
  document.getElementById('map-config').style.display = isMap ? 'block' : 'none';
  if (isMap) showAdminMap();

  document.getElementById('yatzy-config').style.display = value === 'yatzy' ? 'block' : 'none';

  document.getElementById('minigame-note').textContent =
      value.startsWith('snowball:') ? 'Duello a turni contro il computer: chi finisce l\'energia perde. Se perde è game over. Il timer non conta.'
    : value.startsWith('guillotine:') ? 'La lama trema prima di calare: il giocatore tocca per abbassare la testa. Se lo prende è game over. Il timer non conta.'
    : value.startsWith('pokemon:') && typeof PK_GYMS !== 'undefined' && PK_GYMS[value.slice(8)] && PK_GYMS[value.slice(8)].world
      ? 'Avventura stile Pokémon da esplorare (percorsi, erba alta, grotta, palestre) con una squadra già fatta. Si finisce la tappa battendo il capopalestra o arrivando al traguardo → prosegue; squadra esausta → game over. Il timer non conta. Una tappa per domanda, in ordine: 1, 2, 3.' + (PK_GYMS[value.slice(8)].bonfire ? ' Questa tappa comincia in un CENTRO POKéMON: il falò si accende da solo.' : '') + ' Mappe e dialoghi sono in pokemon-data.js.'
    : value.startsWith('pokemon:') ? 'Lotte stile Pokémon contro gli allenatori della palestra e poi il capopalestra, con una squadra già fatta. Vince la medaglia → prosegue; squadra esausta → game over. Il timer non conta. Creature, allenatori e dialoghi sono in pokemon-data.js.'
    : value === 'yatzy' ? 'Partita a Yatzy da soli: appena si raggiunge il punteggio si vince; se diventa impossibile raggiungerlo è game over. Il timer non conta.'
    : isMap ? 'Il giocatore tocca la mappa e conferma: entro la tolleranza prosegue, altrimenti è game over (e vede dov\'era il punto). Il timer conta.'
    : isOrder ? 'Il giocatore trascina gli elementi e conferma: ogni ordine valido porta alla sua strada, qualsiasi altro ordine è game over. Il timer conta: meglio alzarlo (es. 120s).'
    : 'Il giocatore muove i pezzi sulla scacchiera: una mossa sbagliata è game over.';
}

// ─── Yatzy: probabilità di raggiungere l'obiettivo ───────────────────────────
// Da 20.000 partite simulate con una strategia ragionevole (punteggio medio ~151)

const YATZY_ODDS = [[80, 99], [90, 97], [100, 93], [110, 87], [120, 80], [130, 72], [140, 63], [150, 52],
                    [160, 39], [170, 27], [180, 20], [190, 16], [200, 12], [220, 3], [240, 0]];

function yatzyOdds(target) {
  if (target <= YATZY_ODDS[0][0]) return YATZY_ODDS[0][1];
  for (let i = 1; i < YATZY_ODDS.length; i++) {
    const [t1, p1] = YATZY_ODDS[i - 1], [t2, p2] = YATZY_ODDS[i];
    if (target <= t2) return Math.round(p1 + (p2 - p1) * (target - t1) / (t2 - t1));
  }
  return 0;
}

function updateYatzyOdds() {
  const t = parseInt(document.getElementById('field-yatzy-target').value, 10) || 0;
  const p = yatzyOdds(t);
  const level = p >= 80 ? 'facile' : p >= 50 ? 'normale' : p >= 20 ? 'difficile' : 'quasi impossibile';
  document.getElementById('yatzy-odds').textContent = `circa ${p}% delle partite (${level}) — consigliati: 110 facile, 140 normale, 170 difficile`;
}

// ─── Mappa "Dove eravamo?" ────────────────────────────────────────────────────
// Stesse mappe del gioco (OpenStreetMap). Il punto giusto si sceglie
// cliccando sulla mappa o incollando le coordinate da Google Maps.

const MAP_DEFAULT_VIEW = { viewLat: 41.9, viewLng: 12.5, viewZoom: 5 }; // Italia
const MAP_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = '&copy; OpenStreetMap';

let mapDraft = null;   // { lat, lng, radius, viewLat, viewLng, viewZoom }
let adminMap = null, adminMarker = null, adminCircle = null;

function formatRadius(m) {
  return m < 1000 ? m + ' m' : (m / 1000) + ' km';
}

function setMapDraft(map) {
  mapDraft = map
    ? { ...map }
    : { lat: null, lng: null, radius: 1000, ...MAP_DEFAULT_VIEW };
  document.getElementById('field-map-coords').value =
    mapDraft.lat === null ? '' : `${mapDraft.lat.toFixed(5)}, ${mapDraft.lng.toFixed(5)}`;
  document.getElementById('field-map-radius').value = String(mapDraft.radius);
  document.getElementById('field-map-hide').checked = !!mapDraft.hideAnswer;
  updateMapViewInfo();
}

function updateMapViewInfo() {
  document.getElementById('map-view-info').textContent =
    `Partenza: ${mapDraft.viewLat.toFixed(3)}, ${mapDraft.viewLng.toFixed(3)} · zoom ${mapDraft.viewZoom}`;
}

function showAdminMap() {
  if (typeof L === 'undefined') {
    document.getElementById('admin-map').textContent = 'Mappa non disponibile: serve la connessione.';
    return;
  }
  if (!adminMap) {
    adminMap = L.map('admin-map', { zoomSnap: 0.5 });
    L.tileLayer(MAP_TILES, { attribution: MAP_ATTRIBUTION, maxZoom: 19 }).addTo(adminMap);
    adminMap.on('click', e => setMapPoint(e.latlng.lat, e.latlng.lng));
  }
  // Il contenitore era nascosto: Leaflet deve rimisurarlo
  setTimeout(() => {
    adminMap.invalidateSize();
    if (mapDraft.lat !== null) adminMap.setView([mapDraft.lat, mapDraft.lng], Math.max(mapDraft.viewZoom, 13));
    else adminMap.setView([mapDraft.viewLat, mapDraft.viewLng], mapDraft.viewZoom);
    drawAdminPoint();
  }, 0);
}

function drawAdminPoint() {
  if (!adminMap) return;
  if (adminMarker) { adminMarker.remove(); adminMarker = null; }
  if (adminCircle) { adminCircle.remove(); adminCircle = null; }
  if (mapDraft.lat === null) return;
  const p = [mapDraft.lat, mapDraft.lng];
  adminCircle = L.circle(p, { radius: mapDraft.radius, color: '#ff6b35', weight: 2, fillOpacity: 0.12 }).addTo(adminMap);
  adminMarker = L.marker(p, {
    icon: L.divIcon({ className: 'admin-map-pin', html: '❤️', iconSize: [28, 28], iconAnchor: [14, 14] }),
    interactive: false
  }).addTo(adminMap);
}

function setMapPoint(lat, lng) {
  mapDraft.lat = lat;
  mapDraft.lng = lng;
  document.getElementById('field-map-coords').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  drawAdminPoint();
}

function bindMapEvents() {
  // Coordinate incollate da Google Maps, es. "45.46421, 9.19005"
  document.getElementById('field-map-coords').addEventListener('change', (e) => {
    const m = e.target.value.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) { toast('Coordinate non valide (es. 45.4642, 9.1900)', 'error'); return; }
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { toast('Coordinate fuori scala', 'error'); return; }
    setMapPoint(lat, lng);
    if (adminMap) adminMap.setView([lat, lng], 14);
  });
  document.getElementById('field-map-radius').addEventListener('change', (e) => {
    mapDraft.radius = parseInt(e.target.value, 10);
    drawAdminPoint();
  });
  document.getElementById('field-map-hide').addEventListener('change', (e) => {
    mapDraft.hideAnswer = e.target.checked;
  });
  document.getElementById('btn-map-view').addEventListener('click', () => {
    if (!adminMap) return;
    const c = adminMap.getCenter();
    mapDraft.viewLat = c.lat;
    mapDraft.viewLng = c.lng;
    mapDraft.viewZoom = adminMap.getZoom();
    updateMapViewInfo();
    toast('Vista di partenza salvata', 'success');
  });
}

// ─── Blocco risposta nascosta ─────────────────────────────────────────────────
// Salvata come opzione corretta con hidden: true (il gioco non la mostra come bottone)

function setHiddenFields(q) {
  const hidden = q ? (q.options.find(o => o.hidden) || null) : null;
  document.getElementById('field-hidden-word').value = hidden ? hidden.text : '';
  document.getElementById('field-hidden-next').innerHTML =
    '<option value="">— Nessuna (vittoria) —</option>' + getQuestionOptions(hidden ? hidden.next || '' : '');
  document.getElementById('field-hidden-grants').value = hidden ? hidden.grantsItem || '' : '';
  toggleHiddenFields();
}

function toggleHiddenFields() {
  const on = !!document.getElementById('field-hidden-word').value.trim();
  document.getElementById('hidden-fields').style.display = on ? 'block' : 'none';
}

function showFormPanel() {
  document.getElementById('form-panel').style.display = 'block';
  document.getElementById('form-panel').scrollIntoView({ behavior: 'smooth' });
}

function closeForm() {
  document.getElementById('form-panel').style.display = 'none';
  editingId = null;
}

function clearOptionsUI() {
  document.getElementById('options-rows').innerHTML = '';
}

let optionCounter = 0;

function addOptionRow(opt = null) {
  const container = document.getElementById('options-rows');
  if (container.children.length >= 4) {
    toast('Massimo 4 opzioni', 'error');
    return;
  }

  const oid = 'opt-' + (++optionCounter);
  const isCorrect    = opt ? opt.correct           : false;
  const nextVal      = opt ? (opt.next          || '') : '';
  const grantsVal    = opt ? (opt.grantsItem     || '') : '';
  const grantsMsgVal = opt ? (opt.grantsItemMsg  || '') : '';
  const requiresVal  = opt ? (opt.requiresItem   || '') : '';
  const secretIVal   = opt ? (opt.secretItem     || '') : '';
  const secretNVal   = opt ? (opt.secretNext     || '') : '';

  const row = document.createElement('div');
  row.className = 'option-row';
  row.dataset.oid = oid;

  row.innerHTML = `
    <div class="opt-move-btns">
      <button type="button" class="btn-move" onclick="moveOptionRow(this, -1)" title="Sposta su">▲</button>
      <button type="button" class="btn-move" onclick="moveOptionRow(this,  1)" title="Sposta giù">▼</button>
    </div>
    <div class="option-text-wrap">
      <input type="text" class="opt-text" placeholder="Testo risposta..." value="${opt ? escHtml(opt.text) : ''}" />
      <select class="next-select opt-next" ${isCorrect ? '' : 'disabled'}>
        <option value="">— Nessuna (vittoria) —</option>
        ${getQuestionOptions(nextVal)}
      </select>
      <div class="opt-item-row">
        <input type="text" class="opt-grants"     placeholder="🎁 Concede oggetto (ID)"        value="${escHtml(grantsVal)}"    title="ID oggetto concesso se si sceglie questa opzione" />
        <input type="text" class="opt-grants-msg" placeholder="💬 Messaggio raccolta oggetto"  value="${escHtml(grantsMsgVal)}" title="Messaggio mostrato quando il giocatore raccoglie l'oggetto" />
        <input type="text" class="opt-requires"   placeholder="🔒 Richiede oggetto (ID)"       value="${escHtml(requiresVal)}"  title="ID oggetto necessario per sbloccare questa opzione (visibile)" />
      </div>
      <div class="opt-secret-row">
        <input type="text" class="opt-secret-item" placeholder="🔮 Oggetto segreto (nascosto)" value="${escHtml(secretIVal)}" title="Se il giocatore ha questo oggetto, invece del game over va al percorso segreto — l'opzione appare normale" />
        <select class="next-select opt-secret-next" title="Domanda destinazione percorso segreto">
          <option value="">— Nessuna (game over) —</option>
          ${getQuestionOptions(secretNVal)}
        </select>
      </div>
    </div>
    <div class="option-correct-wrap">
      <button type="button" class="toggle-correct ${isCorrect ? 'on' : ''}" title="Corretta?"></button>
      <span>${isCorrect ? 'Corretta' : 'Sbagliata'}</span>
    </div>
    <button type="button" class="option-remove" title="Rimuovi" onclick="removeOptionRow(this)">✕</button>
  `;

  const toggle = row.querySelector('.toggle-correct');
  const nextSel = row.querySelector('.opt-next');
  const label = row.querySelector('.option-correct-wrap span');

  toggle.addEventListener('click', () => {
    const on = toggle.classList.toggle('on');
    label.textContent = on ? 'Corretta' : 'Sbagliata';
    nextSel.disabled = !on;
    if (!on) nextSel.value = '';
  });

  container.appendChild(row);
}

function moveOptionRow(btn, direction) {
  const row = btn.closest('.option-row');
  const container = document.getElementById('options-rows');
  if (direction === -1 && row.previousElementSibling) {
    container.insertBefore(row, row.previousElementSibling);
  } else if (direction === 1 && row.nextElementSibling) {
    container.insertBefore(row.nextElementSibling, row);
  }
}

function removeOptionRow(btn) {
  const row = btn.closest('.option-row');
  if (document.getElementById('options-rows').children.length <= 1) {
    toast('Almeno 1 opzione obbligatoria', 'error');
    return;
  }
  row.remove();
}

function getQuestionOptions(selectedNext = '') {
  return Object.keys(adminQuestions).map(id => {
    const sel = id === selectedNext ? 'selected' : '';
    return `<option value="${escHtml(id)}" ${sel}>${escHtml(id)}</option>`;
  }).join('');
}

function saveQuestion() {
  const id           = document.getElementById('field-id').value.trim();
  const text         = document.getElementById('field-text').value.trim();
  const timer        = parseInt(document.getElementById('field-timer').value, 10);
  const removeItem   = document.getElementById('field-remove-item').value.trim() || null;
  const removeItemMsg = document.getElementById('field-remove-item-msg').value.trim() || null;

  if (!id) { toast('ID obbligatorio', 'error'); return; }
  if (!text) { toast('Testo domanda obbligatorio', 'error'); return; }
  if (!timer || timer < 1) { toast('Timer non valido', 'error'); return; }

  const chessId = document.getElementById('field-chess').value; // minigioco scelto (vedi renderChessSelect)
  let chess = null;
  let snowball = null;
  let ordering = null;
  let mapData = null;
  let yatzy = null;
  let guillotine = null;
  let pokemon = null;
  const options = [];
  let hasCorrect = false;

  if (chessId.startsWith('order:')) {
    // Metti in ordine: un'opzione "corretta" per ogni ordine valido, ognuna con la sua strada
    const key = chessId.slice('order:'.length);
    const preset = getOrderPreset(key, editingId ? adminQuestions[editingId] : null);
    if (!preset) { toast('Lista non trovata', 'error'); return; }
    ordering = { id: key, name: preset.name, hint: preset.hint || '' };
    document.querySelectorAll('#order-routes .order-route').forEach(row => {
      const o = preset.orders[row.dataset.orderKey];
      const opt = { text: '📋 ' + o.label, correct: true, orderKey: row.dataset.orderKey, order: [...o.items] };
      const next   = row.querySelector('.order-next').value;
      const grants = row.querySelector('.order-grants').value.trim();
      if (next)   opt.next = next;
      if (grants) opt.grantsItem = grants;
      options.push(opt);
    });
    hasCorrect = options.length > 0;
  } else if (chessId) {
    // Minigioco: un'unica opzione "corretta" che rappresenta la vittoria
    if (chessId.startsWith('snowball:')) {
      snowball = { difficulty: chessId.slice('snowball:'.length) };
    } else if (chessId === 'map') {
      if (mapDraft.lat === null) { toast('Clicca sulla mappa il punto giusto', 'error'); return; }
      mapData = { ...mapDraft };
    } else if (chessId.startsWith('guillotine:')) {
      guillotine = { difficulty: chessId.slice('guillotine:'.length) };
    } else if (chessId.startsWith('pokemon:')) {
      const gid = chessId.slice('pokemon:'.length);
      const prev = editingId && adminQuestions[editingId] && adminQuestions[editingId].pokemon;
      const bundle = typeof pkBundle === 'function' ? pkBundle(gid) : null;
      if (bundle) pokemon = { gym: gid, name: bundle.gym.name, data: bundle };
      else if (prev && prev.gym === gid) pokemon = prev;
      else { toast('Palestra non trovata', 'error'); return; }
    } else if (chessId === 'yatzy') {
      const target = parseInt(document.getElementById('field-yatzy-target').value, 10);
      if (!target || target < 1) { toast('Punteggio da raggiungere non valido', 'error'); return; }
      yatzy = { target };
    } else {
      const prev = editingId && adminQuestions[editingId] && adminQuestions[editingId].chess;
      const puzzle = (typeof CHESS_PUZZLES !== 'undefined' && CHESS_PUZZLES[chessId]) || (prev && prev.id === chessId ? prev : null);
      if (!puzzle) { toast('Puzzle non trovato', 'error'); return; }
      chess = { id: chessId, name: puzzle.name, fen: puzzle.fen, moves: [...puzzle.moves] };
    }

    const opt = {
      text: snowball ? '⛄ Sfida vinta' : mapData ? '🗺️ Trovato' : yatzy ? '🎲 Obiettivo raggiunto'
          : guillotine ? '🗡️ Sopravvissuto' : pokemon ? '⚔️ Medaglia ottenuta' : '♟ Puzzle risolto',
      correct: true
    };
    const next   = document.getElementById('field-chess-next').value;
    const grants = document.getElementById('field-chess-grants').value.trim();
    if (next)   opt.next = next;
    if (grants) opt.grantsItem = grants;
    options.push(opt);
    hasCorrect = true;
  }

  const rows = chessId ? [] : document.querySelectorAll('#options-rows .option-row');
  if (!chessId && rows.length < 1) { toast('Almeno 1 opzione', 'error'); return; }

  rows.forEach(row => {
    const optText  = row.querySelector('.opt-text').value.trim();
    const isOn     = row.querySelector('.toggle-correct').classList.contains('on');
    const nextQ    = row.querySelector('.opt-next').value    || null;
    const grants      = row.querySelector('.opt-grants').value.trim()       || null;
    const grantsMsg   = row.querySelector('.opt-grants-msg').value.trim()   || null;
    const requires    = row.querySelector('.opt-requires').value.trim()     || null;
    const secretItem  = row.querySelector('.opt-secret-item').value.trim()  || null;
    const secretNext  = row.querySelector('.opt-secret-next').value         || null;

    if (!optText) return;

    const opt = { text: optText, correct: isOn };
    if (isOn) {
      hasCorrect = true;
      if (nextQ) opt.next = nextQ;
    }
    if (grants)      opt.grantsItem    = grants;
    if (grantsMsg)   opt.grantsItemMsg = grantsMsg;
    if (requires)    opt.requiresItem  = requires;
    if (secretItem)  opt.secretItem  = secretItem;
    if (secretNext)  opt.secretNext  = secretNext;
    options.push(opt);
  });

  if (options.length === 0) { toast('Aggiungi almeno un\'opzione con testo', 'error'); return; }

  // Risposta nascosta: la parola da toccare nel testo della domanda
  const hiddenWord = chessId ? '' : document.getElementById('field-hidden-word').value.trim();
  if (hiddenWord) {
    if (!text.toLowerCase().includes(hiddenWord.toLowerCase())) {
      toast(`"${hiddenWord}" non compare nel testo della domanda`, 'error'); return;
    }
    const hiddenOpt = { text: hiddenWord, correct: true, hidden: true };
    const hNext   = document.getElementById('field-hidden-next').value;
    const hGrants = document.getElementById('field-hidden-grants').value.trim();
    if (hNext)   hiddenOpt.next = hNext;
    if (hGrants) hiddenOpt.grantsItem = hGrants;
    options.push(hiddenOpt);
    hasCorrect = true;
  }

  if (!hasCorrect) { toast('Almeno una risposta deve essere corretta (o una risposta nascosta)', 'error'); return; }

  if (!editingId && adminQuestions[id]) {
    toast(`ID "${id}" gia' esistente`, 'error'); return;
  }

  const q = { id, text, timer, options };
  if (chess)         q.chess         = chess;
  if (snowball)      q.snowball      = snowball;
  if (ordering)      q.ordering      = ordering;
  if (mapData)       q.map           = mapData;
  if (yatzy)         q.yatzy         = yatzy;
  if (guillotine)    q.guillotine    = guillotine;
  if (pokemon)       q.pokemon       = pokemon;
  if (document.getElementById('field-bonfire').checked) q.bonfire = true;
  // Le tappe dell'avventura che cominciano in un CENTRO POKéMON fanno da falò
  if (pokemon && pokemon.data && pokemon.data.gym && pokemon.data.gym.bonfire) q.bonfire = true;
  if (removeItem)    q.removeItem    = removeItem;
  if (removeItemMsg) q.removeItemMsg = removeItemMsg;
  adminQuestions[id] = q;

  if (!adminStartQuestion || !adminQuestions[adminStartQuestion]) {
    adminStartQuestion = id;
  }

  saveToStorage();
  renderAll();
  closeForm();
  toast(`Domanda "${id}" salvata!`, 'success');
}

// Apre il gioco su questa domanda in modalità test (sempre nella stessa scheda "badnews-test").
// Il gioco legge le domande salvate qui nell'admin: non serve esportare.
function testQuestion(id) {
  window.open('index.html?test=' + encodeURIComponent(id), 'badnews-test');
}

function moveQuestion(id, direction) {
  const ids = Object.keys(adminQuestions);
  const idx = ids.indexOf(id);
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= ids.length) return;

  // Cambia solo l'ordine della lista: collegamenti e domanda iniziale restano invariati
  // (il percorso del gioco dipende solo dai collegamenti "vai a")
  const newIds = [...ids];
  [newIds[idx], newIds[swapIdx]] = [newIds[swapIdx], newIds[idx]];
  const reordered = {};
  newIds.forEach(qid => { reordered[qid] = adminQuestions[qid]; });
  adminQuestions = reordered;

  saveToStorage();
  renderAll();
}

function deleteQuestion(id) {
  if (!confirm(`Eliminare la domanda "${id}"?`)) return;
  delete adminQuestions[id];
  if (adminStartQuestion === id) {
    adminStartQuestion = Object.keys(adminQuestions)[0] || '';
  }
  saveToStorage();
  renderAll();
  toast(`Domanda "${id}" eliminata`, 'success');
}

// ─── Start Question ───────────────────────────────────────────────────────────

function renderStartQuestionDropdown() {
  const sel = document.getElementById('start-question-select');
  const ids = Object.keys(adminQuestions);
  sel.innerHTML = ids.map(id => {
    const sel2 = id === adminStartQuestion ? 'selected' : '';
    return `<option value="${escHtml(id)}" ${sel2}>${escHtml(id)}: ${escHtml(adminQuestions[id].text.substring(0, 40))}...</option>`;
  }).join('');
  if (!adminStartQuestion && ids.length > 0) adminStartQuestion = ids[0];
}

// ─── Graph (SVG interattivo) ──────────────────────────────────────────────────

let graphTransform = { x: 0, y: 0, scale: 1 };
let _graphPanCleanup = null;
let _graphNaturalW = 0, _graphNaturalH = 0;
let _graphPosMap = {};      // posizioni calcolate correnti (lette da initNodeDrag)
let _nodeDragCleanup = null;

function renderGraph(resetView = true) {
  if (resetView) { graphTransform = { x: 0, y: 0, scale: 1 }; }

  const container = document.getElementById('graph-container');
  const ids = Object.keys(adminQuestions);

  if (ids.length === 0) {
    container.innerHTML = '<p class="graph-empty">Nessuna domanda</p>';
    return;
  }

  // ── Costanti layout ──────────────────────────
  const NW = 192, NH = 68;
  const CGAP = 64, RGAP = 108;
  const MX = 56, MY = 44;
  const TW = 148, TH = 46;

  // ── BFS: assegna layer ───────────────────────
  const layer = {};
  if (adminStartQuestion && adminQuestions[adminStartQuestion]) {
    const bq = [adminStartQuestion];
    layer[adminStartQuestion] = 0;
    while (bq.length) {
      const id = bq.shift();
      const qd = adminQuestions[id];
      if (!qd) continue;
      qd.options.forEach(opt => {
        if (opt.correct && opt.next && adminQuestions[opt.next] && layer[opt.next] === undefined) {
          layer[opt.next] = layer[id] + 1;
          bq.push(opt.next);
        }
      });
    }
  }

  const maxReachable = Object.values(layer).length > 0 ? Math.max(...Object.values(layer)) : -1;
  const orphanLayer = maxReachable + 1;
  const orphans = ids.filter(id => layer[id] === undefined);
  orphans.forEach(id => { layer[id] = orphanLayer; });

  const byLayer = {};
  ids.forEach(id => { (byLayer[layer[id]] = byLayer[layer[id]] || []).push(id); });
  const sortedLayers = Object.keys(byLayer).map(Number).sort((a, b) => a - b);
  const maxLayer = sortedLayers[sortedLayers.length - 1] ?? 0;

  // ── Larghezza SVG ────────────────────────────
  let maxRowW = 0;
  sortedLayers.forEach(l => {
    const n = byLayer[l].length;
    maxRowW = Math.max(maxRowW, n * NW + (n - 1) * CGAP);
  });

  let hasWin = false;
  ids.forEach(id => adminQuestions[id].options.forEach(opt => {
    if (opt.correct && !opt.next) hasWin = true;
  }));

  maxRowW = Math.max(maxRowW, hasWin ? TW : 0);
  const svgW = maxRowW + MX * 2;

  // ── Posizioni nodi ───────────────────────────
  const pos = {};
  sortedLayers.forEach(l => {
    const nodes = byLayer[l];
    const rowW = nodes.length * NW + (nodes.length - 1) * CGAP;
    const sx = (svgW - rowW) / 2;
    nodes.forEach((id, i) => {
      const baseX = sx + i * (NW + CGAP);
      const baseY = l * (NH + RGAP) + MY;
      // Applica override manuale se l'utente ha trascinato il nodo
      const ov = nodeDragPositions[id];
      const x = ov ? ov.x : baseX;
      const y = ov ? ov.y : baseY;
      pos[id] = { x, y, cx: x + NW / 2, cy: y + NH / 2, w: NW, h: NH };
    });
  });
  _graphPosMap = pos; // esposto per initNodeDrag

  // ── Nodo terminale VITTORIA ───────────────────
  const termY = (maxLayer + 1) * (NH + RGAP) + MY;
  let winPos = null;
  if (hasWin) {
    winPos = { x: (svgW - TW) / 2, y: termY, cx: svgW / 2, cy: termY + TH / 2, w: TW, h: TH };
  }

  const svgH = (hasWin ? termY + TH + MY : maxLayer * (NH + RGAP) + NH + MY * 2);

  function nodePos(id) {
    if (id === '__WIN__') return winPos;
    return pos[id];
  }

  // ── Archi (percorsi corretti + segreti) ──────
  const edges = [];
  const itemDefs = typeof ITEMS !== 'undefined' ? ITEMS : {};
  ids.forEach(id => {
    const corrects = adminQuestions[id].options.filter(o => o.correct);
    const ct = corrects.length;
    corrects.forEach((opt, ci) => {
      const itemTag = opt.grantsItem
        ? (itemDefs[opt.grantsItem]?.emoji || '🎁') + ' +' + opt.grantsItem
        : opt.requiresItem
          ? (itemDefs[opt.requiresItem]?.emoji || '🔒') + ' ?' + opt.requiresItem
          : null;
      const label = opt.hidden ? '👆 ' + opt.text : opt.text;
      if (opt.next && pos[opt.next]) {
        edges.push({ from: id, to: opt.next, label, type: opt.requiresItem ? 'locked' : 'correct', ci, ct, itemTag });
      } else if (!opt.next && winPos) {
        edges.push({ from: id, to: '__WIN__', label, type: 'win', ci, ct, itemTag });
      }
    });

    // Archi segreti (secretItem + secretNext)
    const secrets = adminQuestions[id].options.filter(o => o.secretItem && o.secretNext);
    const st = secrets.length;
    secrets.forEach((opt, si) => {
      const itemTag = (itemDefs[opt.secretItem]?.emoji || '🔮') + ' 🔮' + opt.secretItem;
      if (pos[opt.secretNext]) {
        edges.push({ from: id, to: opt.secretNext, label: opt.text, type: 'secret', ci: si, ct: st, itemTag });
      }
    });
  });

  // ── Build SVG ────────────────────────────────
  _graphNaturalW = svgW;
  _graphNaturalH = svgH;

  const s = [];
  // SVG riempie il container — la trasformazione del <g> gestisce tutto
  s.push(`<svg id="graph-svg" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block;">`);

  s.push(`<defs>
    <marker id="ar-ok"     markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><polygon points="0,0 7,3.5 0,7" fill="#2ed573"/></marker>
    <marker id="ar-win"    markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><polygon points="0,0 7,3.5 0,7" fill="#ffd700"/></marker>
    <marker id="ar-secret" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><polygon points="0,0 7,3.5 0,7" fill="#a060e0"/></marker>
  </defs>`);

  s.push(`<g id="graph-g" transform="translate(${graphTransform.x},${graphTransform.y}) scale(${graphTransform.scale})">`);

  // ── Calcola fan-in: quante frecce arrivano a ogni nodo ───────────────────
  // Serve per distribuire i punti di arrivo orizzontalmente
  const incomingEdges = {}; // targetId -> [edge, ...]
  edges.forEach(e => {
    const key = e.to;
    (incomingEdges[key] = incomingEdges[key] || []).push(e);
  });
  // Assegna a ogni edge il suo indice di arrivo
  edges.forEach(e => {
    const arr = incomingEdges[e.to];
    e.di = arr.indexOf(e); // destination index
    e.dt = arr.length;     // destination total
  });

  // ─── LAYER 1: archi (sotto i nodi) ───────────────────────────────────────
  s.push(`<g id="layer-edges">`);

  // Label "non raggiungibili" (fa parte del layer edges per semplicità)
  if (orphans.length > 0 && pos[orphans[0]]) {
    s.push(`<text x="${MX}" y="${pos[orphans[0]].y - 12}" font-size="11" fill="#998866" font-family="Nunito,sans-serif" font-style="italic">⚠ Non raggiungibili dal percorso principale</text>`);
  }

  edges.forEach(e => {
    const fp = nodePos(e.from);
    const tp = nodePos(e.to);
    if (!fp || !tp) return;

    const srcOffX = e.ct > 1 ? (e.ci - (e.ct - 1) / 2) * 26 : 0;
    const dstOffX = e.dt > 1 ? (e.di - (e.dt - 1) / 2) * 22 : 0;

    const isLocked = e.type === 'locked';
    const isSecret = e.type === 'secret';
    const stroke = e.type === 'win' ? '#ffd700' : isLocked ? '#ffa502' : isSecret ? '#a060e0' : '#2ed573';
    const marker = e.type === 'win' ? 'ar-win' : isSecret ? 'ar-secret' : 'ar-ok';
    const dash   = isLocked ? 'stroke-dasharray="5,3"' : isSecret ? 'stroke-dasharray="2,4"' : '';

    // ── Routing ──────────────────────────────────────────────────────────
    // Se la destinazione è abbastanza sotto: freccia verticale (basso→alto)
    // Altrimenti: routing laterale (lato dest→lato sorg) — evita di passare sotto i nodi
    let path, labelX, labelY;
    const VERT_THRESHOLD = RGAP * 0.35;

    if (tp.y > fp.y + fp.h + VERT_THRESHOLD) {
      // Routing normale verticale
      const x1 = fp.cx + srcOffX, y1 = fp.y + fp.h + 2;
      const x2 = tp.cx + dstOffX, y2 = tp.y - 2;
      const cy2 = (y1 + y2) / 2;
      path   = `M${x1},${y1} C${x1},${cy2} ${x2},${cy2} ${x2},${y2}`;
      labelX = (x1 + x2) / 2;
      labelY = cy2;
    } else {
      // Routing laterale: uscita dal lato del nodo sorgente, entrata dal lato del nodo destinazione
      // Fan-out/in verticale invece che orizzontale (piccoli offset in Y)
      const srcOffY = e.ct > 1 ? (e.ci - (e.ct - 1) / 2) * 14 : 0;
      const dstOffY = e.dt > 1 ? (e.di - (e.dt - 1) / 2) * 14 : 0;
      const goRight = tp.cx >= fp.cx;
      const x1 = goRight ? fp.x + fp.w + 2 : fp.x - 2;
      const y1 = fp.cy + srcOffY;
      const x2 = goRight ? tp.x - 2         : tp.x + tp.w + 2;
      const y2 = tp.cy + dstOffY;
      const bend = Math.max(30, Math.abs(x2 - x1) * 0.35);
      if (goRight) {
        path = `M${x1},${y1} C${x1+bend},${y1} ${x2-bend},${y2} ${x2},${y2}`;
      } else {
        path = `M${x1},${y1} C${x1-bend},${y1} ${x2+bend},${y2} ${x2},${y2}`;
      }
      labelX = (x1 + x2) / 2;
      labelY = (y1 + y2) / 2;
    }

    s.push(`<path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.8" ${dash} marker-end="url(#${marker})" opacity="0.85"/>`);

    if (e.label) {
      const t = e.label.length > 22 ? e.label.substring(0, 20) + '…' : e.label;
      s.push(`<rect x="${labelX - 52}" y="${labelY - 10}" width="104" height="17" rx="4" fill="#0c1520" opacity="0.92"/>`);
      s.push(`<text x="${labelX}" y="${labelY + 3}" text-anchor="middle" font-size="9.5" fill="${stroke}" font-family="Nunito,sans-serif">${escHtml(t)}</text>`);
    }
    if (e.itemTag) {
      const lx = labelX, ly = labelY + 20;
      const tw = e.itemTag.length * 7 + 12;
      s.push(`<rect x="${lx - tw/2}" y="${ly - 9}" width="${tw}" height="16" rx="5" fill="#1a1a00" stroke="${stroke}" stroke-width="1" opacity="0.95"/>`);
      s.push(`<text x="${lx}" y="${ly + 3}" text-anchor="middle" font-size="9" fill="${stroke}" font-family="Nunito,sans-serif">${escHtml(e.itemTag)}</text>`);
    }
  });

  s.push(`</g>`); // layer-edges

  // ─── LAYER 2: nodi (sempre sopra le frecce) ───────────────────────────────
  s.push(`<g id="layer-nodes">`);

  // Nodi domanda — ogni nodo è un <g transform="translate(x,y)"> con coordinate relative
  // così il drag cambia solo il transform senza toccare il resto del SVG
  ids.forEach(id => {
    const p = pos[id];
    if (!p) return;
    const q = adminQuestions[id];
    const isStart  = id === adminStartQuestion;
    const isOrphan = orphans.includes(id);

    const bg     = isStart ? '#2d1800' : isOrphan ? '#1e1e10' : '#16213e';
    const border = isStart ? '#ffa502' : isOrphan ? '#665544' : '#2e3f6e';
    const bw     = isStart ? 2.5 : 1.5;
    const label  = (q.bonfire ? '🔥 ' : '') + (q.chess ? '♟ ' : '') + (q.snowball ? '⛄ ' : '') + (q.ordering ? '📋 ' : '') + (q.map ? '🗺️ ' : '') + (q.yatzy ? '🎲 ' : '') + (q.guillotine ? '🗡️ ' : '') + (q.pokemon ? '⚔️ ' : '') + q.text;
    const txt    = label.length > 30 ? label.substring(0, 28) + '…' : label;
    const idPillW = id.length * 8 + 16;

    // Wrapper trascinabile — coordinate interne tutte relative a (0,0)
    s.push(`<g class="graph-node" id="gnode-${escHtml(id)}" data-node-id="${escHtml(id)}" transform="translate(${p.x},${p.y})" style="cursor:grab">`);
    s.push(`  <rect x="3" y="3" width="${NW}" height="${NH}" rx="11" fill="rgba(0,0,0,0.45)"/>`);
    s.push(`  <rect class="node-bg" x="0" y="0" width="${NW}" height="${NH}" rx="11" fill="${bg}" stroke="${border}" stroke-width="${bw}"/>`);
    s.push(`  <rect class="node-hl" x="0" y="0" width="${NW}" height="${NH}" rx="11" fill="white" opacity="0"/>`);
    s.push(`  <rect x="8" y="8" width="${idPillW}" height="20" rx="6" fill="${isStart ? '#ffa502' : '#0a2040'}"/>`);
    s.push(`  <text x="16" y="22" font-size="11.5" font-weight="bold" fill="${isStart ? '#1a1a1a' : '#7ec8e3'}" font-family="'Fredoka One',Nunito,sans-serif">${escHtml(id)}</text>`);
    s.push(`  <text x="${NW - 9}" y="21" text-anchor="end" font-size="10" fill="#555" font-family="Nunito,sans-serif">${q.timer}s</text>`);
    s.push(`  <text x="${NW / 2}" y="50" text-anchor="middle" font-size="11" fill="#bbb" font-family="Nunito,sans-serif">${escHtml(txt)}</text>`);
    // Indicatori opzioni (1–4): verde=corretta, viola=segreta, rosso scuro=sbagliata, azzurro "?"=nascosta
    const circW = 13, circGap = 3;
    const totalCircW = q.options.length * circW + (q.options.length - 1) * circGap;
    const circStartX = Math.round((NW - totalCircW) / 2);
    const circY = NH - 16;
    q.options.forEach((o, oi) => {
      const ox = circStartX + oi * (circW + circGap);
      const fill      = o.hidden ? '#7ec8e3' : o.correct ? '#2ed573' : o.secretItem ? '#a060e0' : '#3a1010';
      const textFill  = o.hidden ? '#0a2a3a' : o.correct ? '#003a15' : o.secretItem ? '#e8d0ff' : '#884444';
      s.push(`  <rect x="${ox}" y="${circY}" width="${circW}" height="${circW}" rx="3" fill="${fill}"/>`);
      s.push(`  <text x="${ox + circW/2}" y="${circY + 9}" text-anchor="middle" font-size="9" font-weight="bold" fill="${textFill}" font-family="Nunito,sans-serif">${o.hidden ? '?' : oi + 1}</text>`);
    });
    if (isStart) s.push(`  <text x="9" y="${NH - 4}" font-size="9" fill="#ffa502" font-family="Nunito,sans-serif">★ START</text>`);

    // ── Pill oggetti — posizionate dentro il wrapper, sotto il rettangolo ──
    const itemDefs = typeof ITEMS !== 'undefined' ? ITEMS : {};
    const grantIds   = [...new Set(q.options.filter(o => o.grantsItem).map(o => o.grantsItem))];
    const requireIds = [...new Set(q.options.filter(o => o.requiresItem).map(o => o.requiresItem))];
    const allPills = [
      ...grantIds.map(pid   => ({ color: '#2ed573', bg: '#0a2a15', label: (itemDefs[pid]?.emoji || '🎁') + ' +' + pid })),
      ...requireIds.map(pid => ({ color: '#ffa502', bg: '#2a1a00', label: (itemDefs[pid]?.emoji || '🔒') + ' ?' + pid })),
      ...(q.removeItem ? [{ color: '#ff4757', bg: '#2a0a0a', label: (itemDefs[q.removeItem]?.emoji || '🗑') + ' −' + q.removeItem }] : []),
    ];
    if (allPills.length > 0) {
      const pillH = 16, pillGap = 5;
      let px = 4, pillY = NH + 8;
      allPills.forEach(pill => {
        const pw = Math.min(pill.label.length * 7 + 12, NW - px - 4);
        if (pw < 20 || px + pw > NW) return; // non supera il bordo destro del nodo
        s.push(`  <rect x="${px}" y="${pillY}" width="${pw}" height="${pillH}" rx="5" fill="${pill.bg}" stroke="${pill.color}" stroke-width="1"/>`);
        s.push(`  <text x="${px + pw / 2}" y="${pillY + 11}" text-anchor="middle" font-size="9" fill="${pill.color}" font-family="Nunito,sans-serif">${escHtml(pill.label)}</text>`);
        px += pw + pillGap;
      });
    }

    s.push(`</g>`);
  });

  s.push(`</g>`); // layer-nodes

  // Nodo terminale VITTORIA (nel layer nodes — sempre sopra)
  if (winPos) {
    const p = winPos;
    s.push(`<g>
      <rect x="${p.x+3}" y="${p.y+3}" width="${p.w}" height="${p.h}" rx="11" fill="rgba(0,0,0,0.35)"/>
      <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="11" fill="#0a2a0a" stroke="#2ed573" stroke-width="2"/>
      <text x="${p.cx}" y="${p.y + p.h / 2 + 5}" text-anchor="middle" font-size="13" fill="#2ed573" font-family="'Fredoka One',Nunito,sans-serif">🏆 VITTORIA</text>
    </g>`);
  }

  s.push(`</g>`); // graph-g
  s.push('</svg>');

  container.innerHTML = s.join('\n');
  initGraphPanZoom();
  initNodeDrag();
}

function graphFitView() {
  const container = document.getElementById('graph-container');
  const g = document.getElementById('graph-g');
  if (!container || !g || !_graphNaturalW || !_graphNaturalH) return;
  const cw = container.clientWidth  || 800;
  const ch = container.clientHeight || 500;
  const scale = Math.min(0.97, Math.min(cw / _graphNaturalW, ch / _graphNaturalH));
  graphTransform = {
    x: (cw - _graphNaturalW * scale) / 2,
    y: (ch - _graphNaturalH * scale) / 2,
    scale
  };
  g.setAttribute('transform', `translate(${graphTransform.x},${graphTransform.y}) scale(${graphTransform.scale})`);
}

function initNodeDrag() {
  if (_nodeDragCleanup) { _nodeDragCleanup(); _nodeDragCleanup = null; }

  let drag = null; // { id, startCX, startCY, origX, origY, moved }

  function onNodeDown(e, id) {
    e.stopPropagation(); // evita che parta anche il pan del container
    const p = _graphPosMap[id];
    if (!p) return;
    drag = { id, startCX: e.clientX, startCY: e.clientY, origX: p.x, origY: p.y, moved: false };
    e.preventDefault();
  }

  function onMove(e) {
    if (!drag) return;
    const dx = (e.clientX - drag.startCX) / graphTransform.scale;
    const dy = (e.clientY - drag.startCY) / graphTransform.scale;
    if (!drag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) drag.moved = true;
    if (!drag.moved) return;
    // Sposta visivamente solo il nodo — le frecce si aggiorneranno al mouseup
    const g = document.getElementById('gnode-' + drag.id);
    if (g) g.setAttribute('transform', `translate(${drag.origX + dx},${drag.origY + dy})`);
  }

  function onUp(e) {
    if (!drag) return;
    if (!drag.moved) {
      // Click senza spostamento → apri form modifica
      editQuestion(drag.id);
    } else {
      // Salva posizione finale e aggiorna grafo (frecce incluse)
      const dx = (e.clientX - drag.startCX) / graphTransform.scale;
      const dy = (e.clientY - drag.startCY) / graphTransform.scale;
      nodeDragPositions[drag.id] = { x: drag.origX + dx, y: drag.origY + dy };
      saveLayoutToStorage();
      renderGraph(false);
    }
    drag = null;
  }

  document.querySelectorAll('.graph-node[data-node-id]').forEach(nodeEl => {
    const id = nodeEl.dataset.nodeId;
    nodeEl.addEventListener('mousedown', e => onNodeDown(e, id));
  });

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  _nodeDragCleanup = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
}

function initGraphPanZoom() {
  if (_graphPanCleanup) { _graphPanCleanup(); _graphPanCleanup = null; }

  // Usiamo il container div — copre sempre tutta l'area, anche lo spazio vuoto
  const el = document.getElementById('graph-container');
  if (!el) return;

  let dragging = false, lx = 0, ly = 0;

  function onDown(e) {
    if (e.target.closest('.graph-node')) return;
    dragging = true;
    lx = e.clientX; ly = e.clientY;
    el.style.cursor = 'grabbing';
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    graphTransform.x += e.clientX - lx;
    graphTransform.y += e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    const g = document.getElementById('graph-g');
    if (g) g.setAttribute('transform', `translate(${graphTransform.x},${graphTransform.y}) scale(${graphTransform.scale})`);
  }
  function onUp() {
    if (dragging) { dragging = false; el.style.cursor = 'grab'; }
  }
  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const newScale = Math.min(4, Math.max(0.2, graphTransform.scale * factor));
    const ratio = newScale / graphTransform.scale;
    graphTransform.x = mx - ratio * (mx - graphTransform.x);
    graphTransform.y = my - ratio * (my - graphTransform.y);
    graphTransform.scale = newScale;
    const g = document.getElementById('graph-g');
    if (g) g.setAttribute('transform', `translate(${graphTransform.x},${graphTransform.y}) scale(${graphTransform.scale})`);
  }

  el.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  _graphPanCleanup = () => {
    el.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    el.removeEventListener('wheel', onWheel);
  };

  setTimeout(graphFitView, 0);
}

// ─── Import / Export ──────────────────────────────────────────────────────────

// Chrome/Edge: la prima volta si sceglie la cartella del gioco, poi l'export
// sovrascrive direttamente questions.js lì dentro (la cartella resta ricordata).
// Altri browser: download classico (deploy.js lo trova comunque in Download).

function idbRequest(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('badnews_admin', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      try {
        const tx = open.result.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = tx.onabort = () => reject(tx.error);
      } catch (e) {
        reject(e); // es. oggetto non salvabile: meglio un errore che un'attesa infinita
      }
    };
  });
}
const idbGet = (key)        => idbRequest('readonly',  s => s.get(key));
const idbSet = (key, value) => idbRequest('readwrite', s => s.put(value, key));
const idbDel = (key)        => idbRequest('readwrite', s => s.delete(key));

async function getGameFolder() {
  let dir = null;
  try { dir = await idbGet('gameFolder'); } catch (e) {}
  if (dir) {
    let perm = await dir.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') perm = await dir.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') return dir;
  }

  toast('Scegli la cartella del gioco (quella con index.html)');
  dir = await window.showDirectoryPicker({ id: 'badnews-game', mode: 'readwrite' });
  try {
    await dir.getFileHandle('index.html');
  } catch (e) {
    const err = new Error('In quella cartella non c\'è index.html: scegli la cartella del gioco.');
    err.name = 'WrongFolder';
    throw err;
  }
  try { await idbSet('gameFolder', dir); } catch (e) {}
  return dir;
}

async function writeToGameFolder(content) {
  const dir = await getGameFolder();
  const file = await dir.getFileHandle('questions.js', { create: true });
  const writable = await file.createWritable();
  await writable.write(content);
  await writable.close();
  return dir.name;
}

function downloadJS(content) {
  const blob = new Blob([content], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'questions.js';
  a.click();
  URL.revokeObjectURL(url);
}

async function exportJS() {
  // Salva eventuali modifiche non ancora confermate nel pannello oggetti
  saveItemsFromForm(false);

  // Palestre: ricopio i dati aggiornati da pokemon-data.js (creature, allenatori, dialoghi)
  if (typeof pkBundle === 'function') {
    Object.values(adminQuestions).forEach(q => {
      const b = q.pokemon && pkBundle(q.pokemon.gym);
      if (b) { q.pokemon.data = b; q.pokemon.name = b.gym.name; }
    });
    saveToStorage();
  }

  const content = [
    '// Dati domande per il gioco anniversario',
    '// Generato da admin.html — ' + new Date().toLocaleString('it-IT'),
    '',
    'const ITEMS = ' + JSON.stringify(adminItems, null, 2) + ';',
    '',
    'const QUESTIONS = ' + JSON.stringify(adminQuestions, null, 2) + ';',
    '',
    'const START_QUESTION = ' + JSON.stringify(adminStartQuestion) + ';',
    '',
    '// Posizioni dei nodi nel grafo dell\'admin (il gioco le ignora)',
    'const LAYOUT = ' + JSON.stringify(nodeDragPositions) + ';',
  ].join('\n');

  if ('showDirectoryPicker' in window) {
    try {
      const folder = await writeToGameFolder(content);
      toast(`Salvato in ${folder}/questions.js — ora lancia deploy.bat`, 'success');
      return;
    } catch (e) {
      if (e.name === 'AbortError')   { toast('Export annullato', 'error'); return; }
      if (e.name === 'WrongFolder')  { toast(e.message, 'error'); return; }
      // Cartella spostata, permesso negato, ecc.: dimentico la cartella e scarico il file
      console.error('Salvataggio diretto non riuscito:', e);
      try { await idbDel('gameFolder'); } catch (e2) {}
    }
  }

  downloadJS(content);
  toast('questions.js scaricato in Download — deploy.bat lo trova da solo', 'success');
}

function importJS(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      // Esegui il file JS in un ambiente isolato per estrarre QUESTIONS e START_QUESTION
      const code = ev.target.result;

      // Estrai QUESTIONS con regex-free parsing: usa Function
      const fn = new Function(code + '\n return { QUESTIONS, START_QUESTION, ITEMS: typeof ITEMS !== "undefined" ? ITEMS : null, LAYOUT: typeof LAYOUT !== "undefined" ? LAYOUT : null };');
      const result = fn();

      if (!result.QUESTIONS || typeof result.QUESTIONS !== 'object') {
        throw new Error('QUESTIONS non trovato');
      }

      adminQuestions = result.QUESTIONS;
      if (result.START_QUESTION) adminStartQuestion = result.START_QUESTION;
      if (result.ITEMS && typeof result.ITEMS === 'object') {
        adminItems = { ...adminItems, ...result.ITEMS };
      }
      if (result.LAYOUT && typeof result.LAYOUT === 'object') {
        nodeDragPositions = { ...result.LAYOUT };
        saveLayoutToStorage();
      }

      saveToStorage();
      renderAll();
      toast('Importato con successo!', 'success');
    } catch (err) {
      toast('Errore importazione: ' + err.message, 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function resetToDefault() {
  if (!confirm('Ripristinare le domande originali da questions.js? I dati non salvati andranno persi.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_START);
  loadFromStorage();
  renderAll();
  toast('Ripristinato da questions.js', 'success');
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function generateId() {
  const ids = Object.keys(adminQuestions);
  let n = ids.length + 1;
  while (adminQuestions['q' + n]) n++;
  return 'q' + n;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer = null;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}
