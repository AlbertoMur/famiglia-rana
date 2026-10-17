// Minigioco "🗡️ Ghigliottina" (domande con q.guillotine), ispirato alla scena
// della ghigliottina che gira su se stessa.
// La lama trema (e la corda scricchiola) per avvisare, poi cade in modo ben visibile:
// appena la si vede cadere si tocca lo schermo per abbassare la testa per un attimo.
// Troppo presto o troppo tardi = colpito. Nei livelli alti ci sono finte (trema e non cade).
// Si vince sopravvivendo a un certo numero di calate.
//
// La caduta dura più del tempo di reazione tipico su telefono (~0,3 s): è quella il segnale.

const GL_LEVELS = {
  //           calate  avviso (s)   caduta (s)  abbassata  finte   rotazione (°/s) base + per colpo
  facile:    { drops: 5,  cue: [1.0, 1.4], fall: 0.55, duck: 0.6,  feint: 0,    spin: 20, spinUp: 5 },
  normale:   { drops: 8,  cue: [0.7, 1.1], fall: 0.45, duck: 0.5,  feint: 0.2,  spin: 28, spinUp: 7 },
  difficile: { drops: 10, cue: [0.5, 0.9], fall: 0.40, duck: 0.45, feint: 0.35, spin: 36, spinUp: 9 },
};

const GL_RISE = 0.7;     // risalita della lama (s)
const GL_TRAVEL = 114;   // corsa della lama nel disegno (unità SVG)
const GL_DUCK_DEPTH = 42;

let gl = null; // partita in corso

const glRand = (a, b) => a + Math.random() * (b - a);

function destroyGuillotine() {
  if (!gl) return;
  cancelAnimationFrame(gl.raf);
  document.removeEventListener('keydown', gl.onKey);
  gl = null;
}

function renderGuillotine(q) {
  destroyGuillotine();
  const container = document.getElementById('options-container');
  container.innerHTML = '';

  const cfg = GL_LEVELS[q.guillotine && q.guillotine.difficulty] || GL_LEVELS.normale;

  const wrap = document.createElement('div');
  wrap.className = 'gl-wrap';
  wrap.innerHTML = `
    <div class="gl-head-row">
      <span>Colpi schivati <b id="gl-count">0</b> / ${cfg.drops}</span>
    </div>
    <div class="gl-stage" id="gl-stage">
      <svg viewBox="0 0 300 370" class="gl-svg" aria-hidden="true">
        <!-- palco (fermo) -->
        <rect x="36" y="330" width="228" height="24" rx="5" class="gl-platform"/>
        <line x1="60" y1="342" x2="240" y2="342" class="gl-grain"/>

        <!-- ghigliottina (gira) -->
        <g id="gl-rot">
          <rect x="86" y="34" width="20" height="296" rx="3" class="gl-wood"/>
          <rect x="194" y="34" width="20" height="296" rx="3" class="gl-wood"/>
          <line x1="96" y1="50" x2="96" y2="320" class="gl-grain"/>
          <line x1="204" y1="50" x2="204" y2="320" class="gl-grain"/>
          <rect x="76" y="20" width="148" height="24" rx="5" class="gl-wood dark"/>

          <line id="gl-rope" x1="150" y1="44" x2="150" y2="52" class="gl-rope"/>
          <g id="gl-blade">
            <rect x="110" y="50" width="80" height="16" rx="3" class="gl-weight"/>
            <polygon points="110,66 190,66 190,86 110,112" class="gl-steel"/>
            <line x1="118" y1="74" x2="182" y2="74" class="gl-shine"/>
          </g>

          <!-- testa del pirata -->
          <g id="gl-head">
            <path d="M134 208 Q130 222 128 238 M138 210 Q136 226 136 242 M166 210 Q168 226 166 242 M170 208 Q172 222 174 236" class="gl-dread"/>
            <circle cx="150" cy="214" r="19" class="gl-skin"/>
            <path d="M131 206 Q150 191 169 206 L169 211 Q150 199 131 211 Z" class="gl-bandana"/>
            <path d="M139 214 l6 0 M155 214 l6 0" class="gl-eyes"/>
            <path d="M141 223 Q150 218 159 223" class="gl-stache"/>
            <path d="M148 226 l1 6 M152 226 l-1 6" class="gl-stache"/>
            <g id="gl-hat">
              <path d="M118 200 Q150 182 182 200 Q166 194 150 196 Q134 194 118 200 Z" class="gl-hat"/>
              <path d="M128 196 Q150 160 172 196 Z" class="gl-hat"/>
            </g>
          </g>

          <!-- gogna: la testa abbassata ci sparisce dietro -->
          <rect x="90" y="228" width="120" height="66" rx="5" class="gl-wood"/>
          <path d="M131 228 A19 19 0 0 0 169 228" class="gl-notch"/>
          <line x1="98" y1="250" x2="202" y2="250" class="gl-grain"/>
          <line x1="98" y1="272" x2="202" y2="272" class="gl-grain"/>
        </g>
      </svg>
      <p class="gl-msg" id="gl-msg"></p>
    </div>
    <button type="button" class="btn-primary gl-duck" id="gl-duck">GIÙ LA TESTA!</button>
    <p class="gl-hint">Quando la lama trema preparati: appena cade, tocca per abbassare la testa. Occhio alle finte!</p>
  `;
  container.appendChild(wrap);

  gl = {
    id: Math.random(),
    q, cfg,
    survived: 0,
    phase: 'idle', t: 0, dur: glRand(1.2, 1.8),
    feint: false,
    duckT: 0, duckAge: 0, cooldown: 0,
    angle: 0,
    bladeY: 0,
    hatT: -1,
    raf: 0, last: performance.now(),
    els: {
      rot: wrap.querySelector('#gl-rot'),
      blade: wrap.querySelector('#gl-blade'),
      rope: wrap.querySelector('#gl-rope'),
      head: wrap.querySelector('#gl-head'),
      hat: wrap.querySelector('#gl-hat'),
      msg: wrap.querySelector('#gl-msg'),
      count: wrap.querySelector('#gl-count'),
      stage: wrap.querySelector('#gl-stage'),
    },
    onKey: (e) => { if (e.code === 'Space' || e.code === 'ArrowDown') { e.preventDefault(); glDuck(); } },
  };

  wrap.querySelector('#gl-stage').addEventListener('pointerdown', (e) => { e.preventDefault(); glDuck(); });
  wrap.querySelector('#gl-duck').addEventListener('pointerdown', (e) => { e.preventDefault(); glDuck(); });
  document.addEventListener('keydown', gl.onKey);

  gl.raf = requestAnimationFrame(glLoop);
}

function glDuck() {
  if (!gl || !gameActive || gl.phase === 'over' || gl.cooldown > 0) return;
  getAudioCtx();
  gl.duckT = gl.cfg.duck;
  gl.duckAge = 0;
  gl.cooldown = gl.cfg.duck + 0.35; // niente raffica: dopo una schivata serve un attimo
  playTone(330, 'sine', getAudioCtx().currentTime, 0.06, 0.08);
}

function glMsg(text, cls = '') {
  const m = gl.els.msg;
  m.textContent = text;
  m.className = 'gl-msg show ' + cls;
  clearTimeout(gl.msgTimer);
  gl.msgTimer = setTimeout(() => {
    if (gl && !gl.els.msg.classList.contains('stay')) gl.els.msg.classList.remove('show');
  }, 700);
}

// ─── Loop ────────────────────────────────────────────────────────────────────

function glLoop(now) {
  if (!gl) return;
  const dt = Math.min((now - gl.last) / 1000, 0.05);
  gl.last = now;
  if (gameActive || gl.phase === 'over') glStep(dt);
  if (!gl) return;
  glDraw();
  gl.raf = requestAnimationFrame(glLoop);
}

function glStep(dt) {
  const { cfg } = gl;
  gl.angle = (gl.angle + (cfg.spin + gl.survived * cfg.spinUp) * dt * (gl.phase === 'over' ? 0.3 : 1)) % 360;
  if (gl.duckT > 0) { gl.duckT = Math.max(0, gl.duckT - dt); gl.duckAge += dt; }
  gl.cooldown = Math.max(0, gl.cooldown - dt);
  if (gl.hatT >= 0) gl.hatT += dt;
  if (gl.phase === 'over') return;

  gl.t += dt;
  switch (gl.phase) {
    case 'idle':
      if (gl.t >= gl.dur) {
        gl.phase = 'cue'; gl.t = 0;
        gl.dur = glRand(...cfg.cue);
        gl.feint = Math.random() < cfg.feint;
        playTone(140, 'sawtooth', getAudioCtx().currentTime, 0.35, 0.06); // la corda scricchiola
      }
      break;
    case 'cue':
      if (gl.t >= gl.dur) {
        if (gl.feint) {
          glMsg('Finta!');
          gl.phase = 'idle'; gl.t = 0; gl.dur = glRand(0.9, 1.5);
        } else {
          gl.phase = 'fall'; gl.t = 0; gl.dur = cfg.fall;
          playTone(900, 'triangle', getAudioCtx().currentTime, 0.18, 0.08);
        }
      }
      break;
    case 'fall':
      gl.bladeY = Math.min(gl.t / gl.dur, 1); // lineare: si vede subito che sta cadendo
      if (gl.t >= gl.dur) glImpact();
      break;
    case 'rise':
      gl.bladeY = 1 - Math.min(gl.t / gl.dur, 1);
      if (gl.t >= gl.dur) { gl.bladeY = 0; gl.phase = 'idle'; gl.t = 0; gl.dur = glRand(0.8, 1.8); }
      break;
  }
}

function glImpact() {
  gl.bladeY = 1;
  const t = getAudioCtx().currentTime;
  playTone(90, 'square', t, 0.15, 0.25); // TUNK

  if (gl.duckT > 0) {
    gl.survived++;
    gl.els.count.textContent = gl.survived;
    if (gl.survived >= gl.cfg.drops) return glEnd(true);
    glMsg(['Schivato!', 'Per un pelo!', 'Savvy!', 'Ancora vivo!'][gl.survived % 4], 'ok');
    playTone(660, 'sine', t + 0.1, 0.1, 0.15);
    gl.phase = 'rise'; gl.t = 0; gl.dur = GL_RISE;
  } else {
    glEnd(false);
  }
}

function glEnd(won) {
  gl.phase = 'over';
  const id = gl.id;
  if (won) {
    glMsg('Salvo! Capitano, ce l\'hai fatta! 🏴‍☠️', 'ok big');
    gl.els.msg.classList.add('stay');
  } else {
    gl.hatT = 0; // vola via il tricorno
    gameActive = false;
    clearTimer();
    glMsg('Preso!', 'bad big');
    gl.els.msg.classList.add('stay');
    gl.els.stage.classList.add('gl-hit');
    playWrong();
  }
  setTimeout(() => {
    if (!gl || gl.id !== id) return;
    if (won) {
      const opt = gl.q.options.find(o => o.correct);
      if (opt) handleAnswer(opt, gl.els.stage);
      else { gameActive = false; showWin(); }
    } else {
      playGameOver();
      showGameOver('guillotine');
    }
  }, 1700);
}

// ─── Disegno ─────────────────────────────────────────────────────────────────

function glDraw() {
  const { els } = gl;
  els.rot.setAttribute('transform', `rotate(${gl.angle.toFixed(2)} 150 190)`);

  // La lama trema durante l'avviso
  const shake = gl.phase === 'cue' ? Math.sin(gl.t * 70) * 2.2 : 0;
  const y = gl.bladeY * GL_TRAVEL;
  els.blade.setAttribute('transform', `translate(${shake.toFixed(2)} ${y.toFixed(2)})`);
  els.rope.setAttribute('y2', (52 + y).toFixed(2));

  // Testa: scende in fretta, risale alla fine della schivata
  let duck = 0;
  if (gl.duckT > 0) duck = Math.min(1, gl.duckAge / 0.07, gl.duckT / 0.1);
  els.head.setAttribute('transform', `translate(0 ${(duck * GL_DUCK_DEPTH).toFixed(2)})`);

  // Il tricorno vola via quando la lama colpisce
  if (gl.hatT >= 0) {
    const t = gl.hatT;
    els.hat.setAttribute('transform', `translate(${(t * 140).toFixed(1)} ${(-t * 160 + t * t * 260).toFixed(1)}) rotate(${(t * 540).toFixed(1)} 150 190)`);
  }
}
