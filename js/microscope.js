/* =====================================================================
   Microscope: a zoomed, animated look at each level of the food web.
   Opens from the creatures in the scene (World.getHits) or from the
   "Look under the microscope" button in a level's science card.
   Text here must only repeat facts already in js/content.js.
   ===================================================================== */
/* Life cycle: numbered steps that loop back to the start, plus the Fiction/Assumption note. */
window.lifeCycleEl = function (lc, el) {
  const box = el || document.createElement('div');
  box.className = 'cycle'; box.replaceChildren();
  const h = document.createElement('h4'); h.textContent = 'Life cycle'; box.appendChild(h);
  const ol = document.createElement('ol'); ol.className = 'cycle-steps';
  lc.steps.forEach((s) => { const li = document.createElement('li'); li.textContent = s; ol.appendChild(li); });
  const back = document.createElement('li'); back.className = 'cycle-back'; back.setAttribute('aria-hidden', 'true'); back.textContent = '↺ and again';
  ol.appendChild(back);
  box.appendChild(ol);
  if (lc.note) { const p = document.createElement('p'); p.className = 'cycle-note'; p.textContent = lc.note; box.appendChild(p); }
  return box;
};
window.Microscope = (function () {
  const S = 120;                       // low-res art size; CSS scales it up, pixelated
  // Read live, so switching reduced motion on while the microscope is open freezes it.
  const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionMq.matches;
  const onMotion = (e) => {
    reduced = e.matches;
    if (!current) return;
    cancelAnimationFrame(raf);
    if (reduced) draw(current, 1.5); else { t0 = performance.now(); loop(t0); }
  };
  if (motionMq.addEventListener) motionMq.addEventListener('change', onMotion); else motionMq.addListener(onMotion);

  // Tags: what is real on Earth, what is our assumption, what is invented, what is a drawing choice.
  const SPECIMENS = {
    methanogens: {
      level: 'Level 1', name: 'Methane-makers', card: 'methanogens',
      tags: [['evidence', 'Real microbes on Earth'], ['assumption', 'Assumption: living on this moon']],
      lines: [
        'Single cells living in slimy films (biofilms) inside the warm chimney pores.',
        'They take in hydrogen (H₂) and carbon dioxide (CO₂) and give off methane (CH₄).',
        'No sunlight and no oxygen needed.'
      ],
      eq: 'CO₂ + 4H₂ → CH₄ + 2H₂O',
      legend: [['h2', 'H₂ in'], ['ch4', 'CH₄ out']],
      scale: 'Drawing choice: zoomed in much further than the animals (not to scale)'
    },
    grazers: {
      level: 'Level 2', name: 'Grazers', card: 'grazers',
      tags: [['fiction', 'Fictional, based on real protozoa: single-celled organisms with a nucleus']],
      lines: [
        'One single cell covered in tiny beating hairs (cilia) that it uses to swim.',
        'It swallows methane-makers whole. See the green microbes inside it.'
      ],
      legend: [['cil', 'cilia'], ['food', 'swallowed microbes']],
      scale: 'Drawing choice: shown about ×300 larger than life'
    },
    predator: {
      level: 'Level 3', name: 'Shadowfin', card: 'predator',
      tags: [['fiction', 'Fictional, based on Loricifera: real tiny animals']],
      lines: [
        'The top predator, and still smaller than 1 mm: about the size of a grain of salt.',
        'A vase-shaped shell protects its body. It has a spiny head and no eyes, because there is no light.',
        'We imagine it finds grazers by sensing the chemistry of the water and their movement.'
      ],
      legend: [['spine', 'spiny head'], ['shell', 'vase-shaped shell']],
      scale: 'Drawing choice: shown about ×300 larger than life'
    }
  };

  // ---------- DOM ----------
  const root = document.getElementById('scope');
  if (!root) return { open() {}, close() {}, has: () => false };
  const cvs = root.querySelector('#scopeCanvas');
  const ctx = cvs.getContext('2d');
  cvs.width = S; cvs.height = S; ctx.imageSmoothingEnabled = false;
  const $ = (sel) => root.querySelector(sel);
  let current = null, raf = 0, t0 = 0, opener = null, fallback = null;

  function chip(cls, text) { const s = document.createElement('span'); s.className = 'chip ' + cls; s.textContent = text; return s; }

  // While open, everything behind the microscope is inert (no Tab, no clicks, hidden from
  // screen readers), so aria-modal is true in practice; Tab cycles inside the box.
  const behindScope = () => ['world', 'hud', 'card'].map((i) => document.getElementById(i)).filter(Boolean);
  const focusables = () => [...root.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function open(id, from, fb) {
    const sp = SPECIMENS[id]; if (!sp) return;
    current = id; opener = from || document.activeElement; fallback = fb || null;
    behindScope().forEach((el) => { el.inert = true; });
    $('#scopeLevel').textContent = sp.level;
    $('#scopeName').textContent = sp.name;
    const tags = $('#scopeTags'); tags.replaceChildren(...sp.tags.map(([cls, txt]) => chip(cls, txt)));
    const ul = $('#scopeLines'); ul.replaceChildren();
    sp.lines.forEach((l) => { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li); });
    const eq = $('#scopeEq'); eq.hidden = !sp.eq; eq.textContent = sp.eq || '';
    const lg = $('#scopeLegend'); lg.replaceChildren();
    sp.legend.forEach(([k, txt]) => {
      const li = document.createElement('li'); const sw = document.createElement('i'); sw.className = 'sw sw-' + k;
      li.append(sw, document.createTextNode(txt)); lg.appendChild(li);
    });
    $('#scopeScale').textContent = sp.scale;
    const lc = window.DIVE && DIVE.cards[sp.card] && DIVE.cards[sp.card].lifeCycle;
    const cy = $('#scopeCycle'); cy.hidden = !lc; if (lc) window.lifeCycleEl(lc, cy);
    root.hidden = false;
    root.classList.remove('is-open'); void root.offsetWidth; root.classList.add('is-open');
    t0 = performance.now();
    cancelAnimationFrame(raf); loop(t0);
    $('#scopeClose').focus({ preventScroll: true });
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true; current = null; cancelAnimationFrame(raf);
    behindScope().forEach((el) => { el.inert = false; });
    window.dispatchEvent(new Event('scope-closed'));     // app.js re-applies HUD inertness
    // back to whatever opened it; if that button was removed meanwhile, to its fallback
    const back = opener && opener.isConnected && opener !== document.body ? opener : fallback;
    if (back && back.focus) back.focus({ preventScroll: true });
  }
  $('#scopeClose').addEventListener('click', close);
  $('#scopeCard').addEventListener('click', () => {
    const id = current && SPECIMENS[current].card;
    const from = opener, fb = fallback;
    close();
    // the card remembers the same opener, so closing it returns focus to the reader's place
    if (id && window.DiveUI) window.DiveUI.openCard(id, from && from.isConnected && from !== document.body ? from : fb);
  });
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  function loop(now) {
    const t = reduced ? 1.5 : (now - t0) / 1000;
    draw(current, t);
    if (!reduced && current) raf = requestAnimationFrame(loop);
  }

  // ---------- pixel helpers ----------
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function ellipse(cx, cy, rx, ry, c) {
    ctx.fillStyle = c;
    for (let y = -ry; y <= ry; y++) {
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  }
  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  function background(tint) {
    rect(0, 0, S, S, tint[0]);
    const r = rng(11);
    for (let i = 0; i < 140; i++) px(r() * S, r() * S, tint[1]);          // drifting specks
  }

  // ---------- specimens ----------
  function draw(id, t) {
    if (id === 'methanogens') drawMethanogens(t);
    else if (id === 'grazers') drawGrazer(t);
    else if (id === 'predator') drawShadowfin(t);
  }

  function drawMethanogens(t) {
    background(['#0b2a26', '#123b35']);
    // biofilm floor
    for (let x = 0; x < S; x++) {
      const h = 16 + Math.round(Math.sin(x * 0.15) * 3 + Math.sin(x * 0.05 + 1) * 4);
      rect(x, S - h, 1, h, x % 3 ? '#1d5a4c' : '#1a5244');
    }
    // H2 molecules drifting down into the film
    for (let i = 0; i < 14; i++) {
      const x = (i * 37 % S) + Math.sin(t + i) * 3;
      const y = ((t * 12 + i * 23) % (S - 30));
      px(x, y, '#5de4ff'); px(x + 1, y, '#5de4ff');
    }
    // cells: rods and spheres, gently jiggling; a few dividing
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      const x = 8 + r() * (S - 16), y = 22 + r() * (S - 52);
      const jx = Math.round(Math.sin(t * 2 + i) * 0.7), jy = Math.round(Math.cos(t * 1.7 + i) * 0.7);
      const rod = r() > 0.4, horiz = r() > 0.5;
      const body = i % 2 ? '#4fe0a6' : '#3cc893', dark = '#1f8a66', lite = '#b6ffe0';
      if (rod) {
        const w = horiz ? 9 : 3, h = horiz ? 3 : 9;
        rect(x + jx, y + jy, w, h, body);
        rect(x + jx, y + jy + (horiz ? 2 : 0), horiz ? w : 1, horiz ? 1 : h, dark);
        px(x + jx + 1, y + jy, lite);
        // dividing: pinch in the middle, every few seconds
        if (i % 5 === 0 && Math.sin(t * 0.8 + i) > 0.6) rect(x + jx + (horiz ? 4 : 0), y + jy + (horiz ? 0 : 4), horiz ? 1 : 3, horiz ? 3 : 1, '#0b2a26');
      } else {
        ellipse(x + jx, y + jy, 2, 2, body); px(x + jx - 1, y + jy - 1, lite); px(x + jx + 1, y + jy + 2, dark);
      }
      // CH4 bubble leaving some cells, rising
      if (i % 3 === 0) {
        const life = (t * 0.6 + i * 0.37) % 1;
        const by = y - life * 40, bx = x + 2 + Math.sin(t * 3 + i) * 1.5;
        if (by > 2) {
          px(bx, by - 1, '#e6f2ff'); px(bx - 1, by, '#e6f2ff'); px(bx + 1, by, '#e6f2ff'); px(bx, by + 1, '#e6f2ff');
        }
      }
    }
  }

  function drawGrazer(t) {
    background(['#1a1020', '#2a1a33']);
    const cx = 60 + Math.sin(t * 0.6) * 4, cy = 58 + Math.sin(t * 0.9) * 3;
    const rx = 37, ry = 26;
    // cilia: short strokes around the cell; a wave travels around them
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      const wave = Math.sin(a * 6 - t * 9);
      const len = 4 + Math.round(wave * 1.5);
      const tilt = wave * 0.35;
      for (let s = 1; s <= len; s++) {
        const ex = cx + Math.cos(a + tilt * s / len) * (rx + s);
        const ey = cy + Math.sin(a + tilt * s / len) * (ry + s);
        px(ex, ey, s === len ? '#ffe1e8' : '#ffb3c6');
      }
    }
    // body with simple shading bands
    ellipse(cx, cy, rx, ry, '#c2456b');
    ellipse(cx - 1, cy - 1, rx - 2, ry - 2, '#ff7f9f');
    ellipse(cx - 4, cy - 4, rx - 9, ry - 8, '#ff9fb4');
    ellipse(cx - 9, cy - 9, 6, 3, '#ffd0dc');
    // oral groove (mouth) on the front
    for (let i = 0; i < 9; i++) px(cx + rx - 6 - i * 0.6, cy - 2 + i, '#8e2347');
    // nucleus
    ellipse(cx - 6, cy + 2, 7, 5, '#ffe1e8'); ellipse(cx - 6, cy + 2, 4, 3, '#f7b6c8');
    // food vacuoles with swallowed green microbes
    [[cx + 10, cy - 7], [cx + 12, cy + 8], [cx - 16, cy - 8]].forEach(([vx, vy], i) => {
      const wob = Math.round(Math.sin(t * 1.3 + i) * 1);
      ellipse(vx + wob, vy, 4, 4, '#6d2440');
      rect(vx - 2 + wob, vy - 1, 4, 2, '#4fe0a6'); px(vx + 1 + wob, vy + 2, '#3cc893'); px(vx - 2 + wob, vy - 2, '#b6ffe0');
    });
    // a free methane-maker about to be swallowed, drifting toward the mouth
    const f = (t * 0.25) % 1;
    const mx = cx + rx + 18 - f * 16, my = cy + 4 - f * 2;
    if (f < 0.9) { rect(mx, my, 5, 2, '#4fe0a6'); px(mx, my, '#b6ffe0'); }
  }

  function drawShadowfin(t) {
    background(['#120f24', '#1f1a3a']);
    const flip = Math.sin(t * 0.25) < 0 ? -1 : 1;
    const ox = 60 + Math.sin(t * 0.25) * 10, oy = 60 + Math.sin(t * 0.8) * 3;
    const X = (dx) => ox + dx * flip;
    // lorica (vase-shaped shell): wide in the middle, narrowing to a closed end
    for (let dx = -2; dx <= 34; dx++) {
      const w = Math.round(12 * Math.sin(Math.min(1, (dx + 2) / 30) * Math.PI * 0.95) + 4);
      const plate = Math.floor(dx / 4) % 2 === 0;
      rect(X(dx), oy - w, 1, w * 2, plate ? '#b7a2ff' : '#8f78db');
      px(X(dx), oy - w, '#e3d9ff');
      px(X(dx), oy + w - 1, '#5d4aa8');
      if (dx % 4 === 0) rect(X(dx), oy - w + 2, 1, w * 2 - 4, '#7a63c8');   // plate seams
    }
    // neck
    for (let dx = -8; dx < -2; dx++) rect(X(dx), oy - 5, 1, 10, '#d6c8ff');
    for (let dx = -8; dx < -2; dx += 2) rect(X(dx), oy - 5, 1, 10, '#a593e6');
    // head (no eyes) with spines that extend and pull back in
    const hx = X(-14);
    ellipse(hx, oy, 7, 7, '#d6c8ff'); ellipse(hx - flip, oy - 1, 5, 5, '#ebe3ff');
    const reach = 5 + Math.round((Math.sin(t * 1.6) + 1) * 3);
    for (let k = 0; k < 14; k++) {
      const a = Math.PI / 2 + (k / 13) * Math.PI;           // a fan of spines facing forward
      const ang = flip > 0 ? a : Math.PI - a;
      for (let s = 7; s < 7 + reach; s++) px(hx + Math.cos(ang) * s, oy + Math.sin(ang) * s, s > 7 + reach - 2 ? '#ffffff' : '#f2ecff');
    }
    // "sensing" ripples in front of the head (chemistry + movement, no eyes)
    const rp = (t * 0.9) % 1;
    const rr = 16 + rp * 22;
    for (let k = -6; k <= 6; k++) {
      const a = (flip > 0 ? Math.PI : 0) + k * 0.12;
      const c = 'rgba(93,228,255,' + (0.6 * (1 - rp)).toFixed(2) + ')';
      px(hx + Math.cos(a) * rr, oy + Math.sin(a) * rr, c);
    }
  }

  return { open, close, has: (id) => !!SPECIMENS[id] };
})();
