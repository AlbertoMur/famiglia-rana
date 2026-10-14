// Minigioco "🗺️ Dove eravamo?" (domande con q.map).
// Si tocca la mappa per piantare la puntina e si conferma: se è entro la tolleranza
// (q.map.radius, in metri) si prosegue, altrimenti è Bad News. In entrambi i casi
// si vede dov'era il punto giusto.
//
// Mappe OpenStreetMap: gratuite e senza chiave per un uso leggero come questo,
// a patto di mostrare l'attribuzione (in basso a destra sulla mappa).

const MAP_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function formatDistance(m) {
  return m < 1000
    ? Math.round(m) + ' m'
    : (m / 1000).toLocaleString('it-IT', { maximumFractionDigits: m < 10000 ? 1 : 0 }) + ' km';
}

let mapGame = null; // { map, q, guess, marker, done }

function destroyMapGame() {
  if (!mapGame) return;
  mapGame.map.remove();
  mapGame = null;
}

function renderMapGame(q) {
  destroyMapGame();
  const container = document.getElementById('options-container');
  container.innerHTML = '';

  if (typeof L === 'undefined') {
    container.innerHTML = '<p class="chess-info">Mappa non disponibile: controlla la connessione e ricarica.</p>';
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'map-wrap';
  wrap.innerHTML = `
    <p class="map-hint">Tocca la mappa dove pensi che fosse 📍</p>
    <div class="map-frame"><div id="map-game"></div></div>
    <p class="map-result" id="map-result"></p>
    <button type="button" class="btn-primary map-confirm" id="map-confirm" disabled>CONFERMA 📍</button>
  `;
  container.appendChild(wrap);

  const m = q.map;
  const map = L.map('map-game', { zoomSnap: 0.5 }).setView([m.viewLat, m.viewLng], m.viewZoom);
  L.tileLayer(MAP_TILES, { attribution: MAP_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  mapGame = { map, q, guess: null, marker: null, done: false };

  const pinIcon = L.divIcon({ className: 'map-pin', html: '📍', iconSize: [34, 34], iconAnchor: [17, 32] });
  const confirmBtn = wrap.querySelector('#map-confirm');

  map.on('click', (e) => {
    if (!gameActive || !mapGame || mapGame.done) return;
    mapGame.guess = e.latlng;
    if (mapGame.marker) mapGame.marker.setLatLng(e.latlng);
    else mapGame.marker = L.marker(e.latlng, { icon: pinIcon, interactive: false }).addTo(map);
    confirmBtn.disabled = false;
    playTone(700, 'sine', getAudioCtx().currentTime, 0.06, 0.12);
  });

  confirmBtn.addEventListener('click', () => checkMapGuess(confirmBtn));
}

function checkMapGuess(btn) {
  if (!mapGame || mapGame.done || !mapGame.guess || !gameActive) return;
  const { map, q, guess } = mapGame;
  mapGame.done = true;
  btn.disabled = true;
  clearTimer();

  const target = L.latLng(q.map.lat, q.map.lng);
  const dist = map.distance(guess, target);
  const ok = dist <= q.map.radius;
  const result = document.getElementById('map-result');

  // Opzione "non mostrare la soluzione": se sbaglia non rivelo né il punto né la distanza
  if (!ok && q.map.hideAnswer) {
    result.textContent = 'Non era qui…';
    result.classList.add('wrong');
    gameActive = false;
    playWrong();
    setTimeout(() => { playGameOver(); showGameOver('map'); }, 1600);
    return;
  }

  // Mostro il punto giusto, la tolleranza e la distanza dalla puntina
  // Il battito va su un elemento interno: Leaflet usa il transform del segnaposto per posizionarlo
  const heartIcon = L.divIcon({ className: 'map-pin map-target', html: '<span class="map-heart">❤️</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
  L.circle(target, { radius: q.map.radius, color: ok ? '#4f9a5b' : '#d64545', weight: 2, fillOpacity: 0.12 }).addTo(map);
  L.polyline([guess, target], { color: '#2a2622', weight: 2, dashArray: '6 6' }).addTo(map);
  L.marker(target, { icon: heartIcon, interactive: false }).addTo(map);
  map.fitBounds(L.latLngBounds([guess, target]).pad(0.4), { maxZoom: 16 });

  result.textContent = ok
    ? (dist < 50 ? 'Proprio qui! ❤️' : `Era qui! Eri a ${formatDistance(dist)} ❤️`)
    : `Era qui… eri a ${formatDistance(dist)}`;
  result.classList.add(ok ? 'right' : 'wrong');

  if (ok) {
    const opt = q.options.find(o => o.correct);
    setTimeout(() => {
      if (opt) handleAnswer(opt, btn);
      else { gameActive = false; showWin(); }
    }, 1600);
  } else {
    gameActive = false;
    playWrong();
    setTimeout(() => { playGameOver(); showGameOver('map'); }, 2400);
  }
}
