// Minigioco "📋 Metti in ordine" (domande con q.ordering).
// Gli elementi compaiono mescolati: si trascinano per riordinarli e si conferma.
// Ogni opzione corretta ha il suo ordine (opt.order) e la sua strada (opt.next):
// se l'ordine corrisponde a uno di questi si prosegue di lì, altrimenti è Bad News.

function renderOrderGame(q) {
  const container = document.getElementById('options-container');
  container.innerHTML = '';

  const routes = q.options.filter(o => o.correct && Array.isArray(o.order));
  if (!routes.length) return;

  // Mescolo finché l'ordine di partenza non coincide con una soluzione
  const items = [...routes[0].order];
  do {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  } while (routes.some(r => r.order.every((x, i) => x === items[i])));

  const wrap = document.createElement('div');
  wrap.className = 'order-wrap';
  wrap.innerHTML = `
    <p class="order-hint">${escapeText(q.ordering.hint || 'Metti in ordine')}</p>
    <p class="order-end top">👑 il migliore</p>
    <ol class="order-list" id="order-list"></ol>
    <p class="order-end bottom">🤢 il peggiore</p>
    <button type="button" class="btn-primary order-confirm" id="order-confirm">CONFERMA ✓</button>
  `;
  container.appendChild(wrap);

  const list = wrap.querySelector('#order-list');
  items.forEach((text, idx) => {
    const li = document.createElement('li');
    li.className = 'order-item c' + (idx % 4);
    li.innerHTML = `<span class="order-num"></span><span class="order-text"></span><span class="order-grip">≡</span>`;
    li.querySelector('.order-text').textContent = text;
    li.dataset.value = text;
    list.appendChild(li);
  });
  renumberOrder(list);
  enableOrderDrag(list);

  wrap.querySelector('#order-confirm').addEventListener('click', (e) => confirmOrder(q, list, e.currentTarget));
}

function escapeText(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renumberOrder(list) {
  [...list.children].forEach((li, i) => { li.querySelector('.order-num').textContent = i + 1; });
}

// Trascinamento con il dito (o il mouse): l'elemento segue il puntatore e scambia
// posto con il vicino quando lo supera di metà altezza.
function enableOrderDrag(list) {
  let drag = null;

  list.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.order-item');
    if (!item || !gameActive || list.classList.contains('locked')) return;
    e.preventDefault();
    drag = { item, startY: e.clientY };
    try { item.setPointerCapture(e.pointerId); } catch (err) {}
    item.classList.add('dragging');
  });

  list.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { item } = drag;
    const gap = orderGap(list);
    let moved = false;

    // Dopo uno scambio la posizione "naturale" dell'elemento cambia di (altezza vicino + spazio):
    // sposto il punto di partenza dello stesso valore, così resta sotto il dito.
    // Ciclo: un gesto veloce può superare più posizioni in un solo movimento.
    // Soglia = metà di (altezza + spazio): dopo uno scambio la condizione opposta
    // non può essere vera, quindi niente avanti-e-indietro. Il limite è solo una rete di sicurezza.
    for (let guard = 0; guard < list.children.length; guard++) {
      const dy = e.clientY - drag.startY;
      const next = item.nextElementSibling;
      const prev = item.previousElementSibling;
      if (next && dy > (next.offsetHeight + gap) / 2) {
        list.insertBefore(next, item);
        drag.startY += next.offsetHeight + gap;
      } else if (prev && dy < -(prev.offsetHeight + gap) / 2) {
        list.insertBefore(item, prev);
        drag.startY -= prev.offsetHeight + gap;
      } else break;
      moved = true;
    }
    if (moved) {
      renumberOrder(list);
      playTone(600, 'sine', getAudioCtx().currentTime, 0.04, 0.08);
    }

    item.style.transform = `translateY(${e.clientY - drag.startY}px) rotate(-1.5deg) scale(1.03)`;
  });

  const end = () => {
    if (!drag) return;
    drag.item.classList.remove('dragging');
    drag.item.style.transform = '';
    drag = null;
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
}

function orderGap(list) {
  return parseFloat(getComputedStyle(list).rowGap) || 0;
}

function confirmOrder(q, list, btn) {
  if (!gameActive || list.classList.contains('locked')) return;
  const current = [...list.children].map(li => li.dataset.value);
  const match = q.options.find(o => o.correct && Array.isArray(o.order) && o.order.every((x, i) => x === current[i]));

  list.classList.add('locked');
  btn.disabled = true;

  if (match) {
    list.classList.add('right');
    handleAnswer(match, list);
  } else {
    gameActive = false;
    clearTimer();
    playWrong();
    list.classList.add('wrong', 'animate-shake');
    setTimeout(() => { playGameOver(); showGameOver('order'); }, 900);
  }
}
