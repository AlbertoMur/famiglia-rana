// Il nostro viaggio: dopo "Hai vinto!" una freccia salta sulla mappa di tappa in tappa,
// andando avanti nel tempo. Le tappe sono in gameTimeline (vedi timeline-data.js).
//
// Per ogni tappa: la mappa inquadra partenza e arrivo, la freccia fa un salto ad arco
// (con la sua ombra che corre dritta sotto), lascia una scia tratteggiata, pianta una
// puntina numerata e il cartoncino in alto mostra data e luogo. Alla fine si vede tutto
// il percorso e si può toccare ogni puntina.

const JOURNEY_MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
                        'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const JOURNEY_NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319]; // pentatonica che sale
const JOURNEY_DAY = 86400000;

// Freccia di Cupido, punta verso destra (la ruoto lungo l'arco): asta di legno,
// punta a cuore e piume rosa in coda
const JOURNEY_ARROW_SVG = `
  <svg viewBox="-32 -14 64 28" aria-hidden="true">
    <path d="M -24 0 L 16 0" stroke="#2a2622" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M -24 0 L 16 0" stroke="#c98a4b" stroke-width="2" stroke-linecap="round"/>
    <path d="M -15 0 L -21 -9 L -30 -9 L -24 0 L -30 9 L -21 9 Z"
          fill="#f7c6c7" stroke="#2a2622" stroke-width="2" stroke-linejoin="round"/>
    <path d="M -19 -6 L -25 -6 M -19 6 L -25 6" stroke="#2a2622" stroke-width="1.2" opacity="0.6"/>
    <path d="M 29 0 C 23 -3, 21 -11, 17 -9 C 13 -7, 14 -2, 16 0 C 14 2, 13 7, 17 9 C 21 11, 23 3, 29 0 Z"
          fill="#d64545" stroke="#2a2622" stroke-width="2" stroke-linejoin="round"/>
    <path d="M 17.5 -5.5 C 16.5 -4.5, 16.5 -3, 17.5 -2" stroke="#fdf8ec" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.8"/>
  </svg>`;

const JOURNEY_HEART_SVG = '<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21 C 5 15, 1 11, 1 6.5 C 1 3.2, 3.6 1, 6.6 1 C 8.8 1, 10.8 2.3, 12 4.3 C 13.2 2.3, 15.2 1, 17.4 1 C 20.4 1, 23 3.2, 23 6.5 C 23 11, 19 15, 12 21 Z" stroke="#2a2622" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const JOURNEY_HEART_COLORS = ['#d64545', '#f39a86', '#f7c6c7', '#e8657a'];

let journey = null; // { map, run, stops, onDone, layers }

function journeyDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function journeyDateLabel(d) {
  return `${d.getDate()} ${JOURNEY_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function journeyDaysLabel(n) {
  return n === 1 ? 'giorno 1' : `giorno ${n}`;
}

function destroyJourney() {
  if (!journey) return;
  journey.run.cancelled = true;
  journey.map.remove();
  journey = null;
}

function playJourney(onDone) {
  destroyJourney();
  const stops = gameTimeline
    .map(t => ({ ...t, when: journeyDate(t.date), ll: L.latLng(t.lat, t.lng) }))
    .sort((a, b) => a.when - b.when);
  if (!stops.length) { onDone(); return; }

  showScreen('screen-journey');
  document.getElementById('journey-continue').hidden = true;
  document.getElementById('journey-skip').hidden = false;
  document.getElementById('journey-card').style.visibility = 'hidden';

  const map = L.map('journey-map', {
    zoomControl: false,
    attributionControl: true,
    dragging: false,
    touchZoom: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    zoomSnap: 1, // zoom interi: con quelli intermedi fra le tessere compaiono righe bianche
  });
  L.tileLayer(MAP_TILES, { attribution: MAP_ATTRIBUTION, maxZoom: 19 }).addTo(map);

  const run = { cancelled: false };
  journey = { map, run, stops, onDone, layers: [] };

  // Linea del tempo: pallini distanziati in proporzione alle date
  const first = stops[0].when, last = stops[stops.length - 1].when;
  const span = Math.max(1, last - first);
  const track = document.getElementById('journey-track');
  track.querySelectorAll('.journey-dot').forEach(d => d.remove());
  stops.forEach(s => {
    s.frac = stops.length === 1 ? 1 : (s.when - first) / span;
    s.day = Math.round((s.when - first) / JOURNEY_DAY) + 1;
    const dot = document.createElement('div');
    dot.className = 'journey-dot';
    dot.style.left = (s.frac * 100) + '%';
    track.appendChild(dot);
    s.dot = dot;
  });
  journeySetTime(0, 1);

  document.getElementById('journey-skip').onclick = () => journeyFinish(true);
  document.getElementById('journey-continue').onclick = () => {
    const done = journey && journey.onDone;
    destroyJourney();
    if (done) done();
  };

  // Leaflet ha bisogno che lo schermo sia visibile per misurare la mappa
  map.invalidateSize();
  map.fitBounds(L.latLngBounds(stops.map(s => s.ll)), journeyPadding(map));
  journeyRun(run).catch(e => { if (e !== 'cancelled') console.error(e); });
}

// Lascio spazio al cartoncino (sopra) e alla linea del tempo (sotto)
function journeyPadding(map) {
  const h = map.getSize().y;
  const top = Math.min(150, h * 0.22), bottom = Math.min(150, h * 0.22);
  return { paddingTopLeft: [40, top], paddingBottomRight: [40, bottom] };
}

function journeySleep(run, ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => (run.cancelled ? reject('cancelled') : resolve()), ms);
  });
}

// Animazione frame per frame: step(t) con t da 0 a 1
function journeyAnimate(run, ms, step) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const frame = (now) => {
      if (run.cancelled) return reject('cancelled');
      const t = Math.min(1, (now - start) / ms);
      step(t);
      if (t < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
}

// Volo della mappa; se Leaflet non manda moveend (vista già giusta) vado avanti lo stesso
function journeyFly(run, bounds, opts) {
  const map = journey.map;
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      map.off('moveend', finish);
      run.cancelled ? reject('cancelled') : resolve();
    };
    map.on('moveend', finish);
    setTimeout(finish, (opts.duration || 1) * 1000 + 600);
    if (bounds instanceof L.LatLngBounds) map.flyToBounds(bounds, opts);
    else map.flyTo(bounds, opts.zoom, opts);
  });
}

const journeyEase = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function journeySetTime(day, frac, idx = -1) {
  document.getElementById('journey-fill').style.width = (frac * 100) + '%';
  document.getElementById('journey-days').textContent = journeyDaysLabel(day);
  if (journey) journey.stops.forEach((s, i) => {
    s.dot.classList.toggle('on', i <= idx);
    s.dot.classList.toggle('here', i === idx);
  });
}

function journeyShowCard(dateText, place, note) {
  const card = document.getElementById('journey-card');
  document.getElementById('journey-date').textContent = dateText;
  document.getElementById('journey-place').textContent = place;
  document.getElementById('journey-note').textContent = note || '';
  card.style.visibility = 'visible';
  card.classList.remove('pop');
  void card.offsetWidth;
  card.classList.add('pop');
}

function journeyPin(i) {
  const s = journey.stops[i];
  const last = i === journey.stops.length - 1;
  const icon = L.divIcon({
    className: '',
    html: `<div class="journey-pin${last ? ' last' : ''}">${i + 1}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
  const pin = L.marker(s.ll, { icon, zIndexOffset: 100 + i }).addTo(journey.map);
  pin.bindTooltip(`${journeyDateLabel(s.when)} · ${s.place}`, { className: 'journey-tip', direction: 'top', offset: [0, -14] });
  s.pin = pin;
}

function journeyPing(i) {
  try {
    const ctx = getAudioCtx();
    const f = JOURNEY_NOTES[i % JOURNEY_NOTES.length];
    playTone(f, 'sine', ctx.currentTime, 0.35, 0.18);
    playTone(f * 1.5, 'sine', ctx.currentTime + 0.08, 0.3, 0.08);
  } catch (e) { /* niente audio, pazienza */ }
}

// Punti dell'arco (in coordinate della mappa allo zoom attuale, poi riconvertiti)
function journeyArc(a, b) {
  const map = journey.map, z = map.getZoom();
  const p0 = map.project(a, z), p2 = map.project(b, z);
  const d = p2.subtract(p0), len = Math.max(1, Math.hypot(d.x, d.y));
  // controllo perpendicolare, sempre verso l'alto dello schermo: un salto
  let nx = -d.y / len, ny = d.x / len;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const h = Math.min(len * 0.35, 220);
  const mid = p0.add(p2).divideBy(2);
  const p1 = L.point(mid.x + nx * h, mid.y + ny * h);
  const at = (t) => {
    const u = 1 - t;
    return L.point(u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
                   u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y);
  };
  const tangent = (t) => L.point(2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
                                 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y));
  return { at, tangent, len, z, p0, p2 };
}

async function journeyHop(run, i) {
  const map = journey.map;
  const a = journey.stops[i - 1], b = journey.stops[i];

  await journeyFly(run, L.latLngBounds([a.ll, b.ll]), { ...journeyPadding(map), maxZoom: 10, duration: 1.3 });

  const arc = journeyArc(a.ll, b.ll);
  const toLL = (p) => map.unproject(p, arc.z);
  // le scie dei salti precedenti sbiadiscono, quella nuova resta in primo piano
  journey.layers.forEach(l => l.setStyle({ opacity: 0.35 }));
  const trail = L.polyline([a.ll], { color: '#d64545', weight: 3, dashArray: '2 8', lineCap: 'round', opacity: 0.9 }).addTo(map);
  journey.layers.push(trail);

  const shadow = L.marker(a.ll, {
    icon: L.divIcon({ className: '', html: '<div class="journey-shadow-inner"></div>', iconSize: [34, 8], iconAnchor: [17, 4] }),
    interactive: false,
  }).addTo(map);
  const arrow = L.marker(a.ll, {
    icon: L.divIcon({ className: '', html: `<div class="journey-arrow-inner">${JOURNEY_ARROW_SVG}</div>`, iconSize: [64, 28], iconAnchor: [32, 14] }),
    interactive: false,
    zIndexOffset: 1000,
  }).addTo(map);
  const inner = arrow.getElement().querySelector('.journey-arrow-inner');
  const shadowEl = shadow.getElement().querySelector('.journey-shadow-inner');

  const points = [a.ll];
  const ms = Math.min(2200, 1100 + arc.len * 1.6);
  let lastSample = 0;
  await journeyAnimate(run, ms, (raw) => {
    const t = journeyEase(raw);
    const p = arc.at(t), tg = arc.tangent(t);
    const ll = toLL(p);
    arrow.setLatLng(ll);
    const jump = Math.sin(Math.PI * t);
    const deg = Math.atan2(tg.y, tg.x) * 180 / Math.PI;
    inner.style.transform = `rotate(${deg}deg) scale(${1 + 0.45 * jump})`;
    shadow.setLatLng(toLL(arc.p0.add(arc.p2.subtract(arc.p0).multiplyBy(t))));
    shadowEl.style.transform = `scale(${1 - 0.5 * jump})`;
    shadowEl.style.opacity = String(1 - 0.6 * jump);
    if (t - lastSample > 0.02 || raw === 1) { points.push(ll); lastSample = t; }
    trail.setLatLngs([...points, ll]);
    // il tempo scorre insieme alla freccia
    const day = Math.round(a.day + (b.day - a.day) * t);
    journeySetTime(day, a.frac + (b.frac - a.frac) * t, i - 1);
  });

  trail.setLatLngs([...points, b.ll]);
  map.removeLayer(shadow);
  map.removeLayer(arrow);
  journeyArrive(i);
}

function journeyArrive(i) {
  const s = journey.stops[i];
  journeyPin(i);
  journeySetTime(s.day, s.frac, i);
  journeyShowCard(journeyDateLabel(s.when), s.place, s.note);
  journeyPing(i);
  const p = journey.map.latLngToContainerPoint(s.ll);
  journeyHearts(p.x, p.y, 16, 70);
}

// Esplosione di cuoricini in (x, y) sullo schermo: volano via in tutte le direzioni
// (un po' più verso l'alto) e svaniscono
function journeyHearts(x, y, count, reach) {
  const screen = document.getElementById('screen-journey');
  for (let k = 0; k < count; k++) {
    const h = document.createElement('div');
    h.className = 'journey-heart';
    h.innerHTML = JOURNEY_HEART_SVG;
    const ang = (k / count) * Math.PI * 2 + Math.random() * 0.6;
    const dist = reach * (0.55 + Math.random() * 0.6);
    const size = 9 + Math.random() * 10;
    h.style.left = x + 'px';
    h.style.top = y + 'px';
    h.style.width = h.style.height = size + 'px';
    h.style.fill = JOURNEY_HEART_COLORS[k % JOURNEY_HEART_COLORS.length];
    h.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
    h.style.setProperty('--dy', (Math.sin(ang) * dist - reach * 0.45).toFixed(1) + 'px');
    h.style.setProperty('--r', ((Math.random() - 0.5) * 70).toFixed(0) + 'deg');
    h.style.animationDuration = (0.9 + Math.random() * 0.6).toFixed(2) + 's';
    h.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
    h.addEventListener('animationend', () => h.remove());
    screen.appendChild(h);
  }
}

async function journeyRun(run) {
  const map = journey.map, stops = journey.stops;

  journeyShowCard('dal primo giorno a oggi', 'Il nostro viaggio', `${stops.length} tappe`);
  await journeySleep(run, 2200);

  await journeyFly(run, stops[0].ll, { zoom: Math.min(9, map.getMaxZoom()), duration: 1.8 });
  journeyArrive(0);
  await journeySleep(run, 1900);

  for (let i = 1; i < stops.length; i++) {
    await journeyHop(run, i);
    await journeySleep(run, 1900);
  }
  journeyFinish(false);
}

// Fine (o SALTA): tutto il percorso, puntine toccabili, bottone per andare avanti
function journeyFinish(skipped) {
  if (!journey) return;
  const { map, stops, run } = journey;
  run.cancelled = true;

  if (skipped) {
    // ridisegno da zero quello che l'animazione non ha fatto in tempo a disegnare
    map.eachLayer(l => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });
    for (let i = 1; i < stops.length; i++) {
      const arc = journeyArc(stops[i - 1].ll, stops[i].ll);
      const pts = [];
      for (let k = 0; k <= 30; k++) pts.push(map.unproject(arc.at(k / 30), arc.z));
      L.polyline(pts, { color: '#d64545', weight: 3, dashArray: '2 8', lineCap: 'round', opacity: 0.9 }).addTo(map);
    }
    stops.forEach((s, i) => journeyPin(i));
  }

  const lastStop = stops[stops.length - 1];
  journeySetTime(lastStop.day, 1, stops.length - 1);
  stops.forEach(s => s.dot.classList.remove('here'));
  journey.layers.forEach(l => l.setStyle({ opacity: 0.8 }));
  journeyShowCard(`${stops.length} tappe · ${lastStop.day} giorni`, '…e la prossima? ❤️', '');

  // Ora la mappa si può esplorare e le puntine dicono dove e quando
  map.dragging.enable();
  map.touchZoom.enable();
  map.scrollWheelZoom.enable();
  map.doubleClickZoom.enable();
  map.flyToBounds(L.latLngBounds(stops.map(s => s.ll)), { ...journeyPadding(map), duration: skipped ? 0.8 : 2 });

  document.getElementById('journey-skip').hidden = true;
  setTimeout(() => {
    if (!journey) return;
    document.getElementById('journey-continue').hidden = false;
    if (!skipped) playVictory();
    const size = journey.map.getSize();
    journeyHearts(size.x / 2, size.y / 2, 36, Math.min(size.x, size.y) * 0.45);
  }, skipped ? 300 : 2200);
}
