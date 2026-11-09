/* =====================================================================
   App: scroll camera, depth mapping, HUD gauges, labels and science cards
   ===================================================================== */
(function () {
  const D = window.DIVE, P = D.params;

  // Page layout, in screen heights (u) from the top of the page
  const U = { surf: 1.3, ice: 4.55, garden: 7.75, floor: 11.15 };
  const PROBE_FRAC = 0.42;                 // where the probe sits on screen during the dive
  const ICE_M = P.iceKm * 1000;
  const FLOOR_M = (P.iceKm + P.oceanKm) * 1000;
  const GARDEN_M = FLOOR_M - P.chimneyM;

  // Non-linear depth scale: more scrolling where more happens
  const KEYS = [
    [U.surf, 0], [U.surf + 0.85, 12], [U.surf + 1.55, 1000], [U.ice, ICE_M], [U.garden, GARDEN_M], [U.floor, FLOOR_M]
  ];
  function dOfU(u) {
    if (u <= KEYS[0][0]) return -1;
    for (let i = 1; i < KEYS.length; i++) {
      const [u1, d1] = KEYS[i - 1], [u2, d2] = KEYS[i];
      if (u <= u2) return d1 + (d2 - d1) * (u - u1) / (u2 - u1);
    }
    return FLOOR_M;
  }
  function uOfD(d) {
    if (d <= 0) return U.surf;
    for (let i = 1; i < KEYS.length; i++) {
      const [u1, d1] = KEYS[i - 1], [u2, d2] = KEYS[i];
      if (d <= d2) return u1 + (u2 - u1) * (d - d1) / (d2 - d1);
    }
    return U.floor;
  }
  const depthOfMarker = (m) => m.aboveFloor != null ? FLOOR_M - m.aboveFloor : m.depth;
  const uOfMarker = (m) => m.sky != null ? m.sky : uOfD(depthOfMarker(m));

  // ---------- physics for the gauges ----------
  function pressurePa(d) {
    if (d <= 0) return 0;
    const g = P.gravity;
    if (d <= ICE_M) return P.rhoIce * g * d;
    return P.rhoIce * g * ICE_M + P.rhoWater * g * (d - ICE_M);
  }
  function tempC(d) {
    if (d <= 0) return P.surfaceTempC;
    if (d <= ICE_M) return P.surfaceTempC + (P.iceBaseTempC - P.surfaceTempC) * (d / ICE_M);
    if (d <= GARDEN_M) return P.iceBaseTempC;
    return P.iceBaseTempC + (P.gardenWaterTempC - P.iceBaseTempC) * ((d - GARDEN_M) / (FLOOR_M - GARDEN_M));
  }
  function lightPct(d) {
    if (d <= 0) return P.sunlightPct;
    return P.sunlightPct * Math.exp(-d / P.lightEfoldM);
  }
  function zoneOf(d) {
    if (d <= 0) return 'Surface';
    if (d < ICE_M) return 'Ice shell';
    if (d < GARDEN_M) return 'Dark ocean';
    if (d < FLOOR_M - 0.5) return 'Hydrogen Garden';
    return 'Seafloor';
  }
  const nf = (n, dp) => n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  function fmtDepth(d) {
    if (d < 1000) return nf(Math.max(0, d), 0) + ' m';
    if (d > GARDEN_M - 1) return nf(d, 0) + ' m';
    return nf(d / 1000, 2) + ' km';
  }
  const minus = (s) => s.replace('-', '−');

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const world = $('world'), spacer = $('spacer'), hud = $('hud');
  const markersEl = $('markers'), endEl = $('end');
  const el = {
    depth: $('depthVal'), zone: $('zoneVal'),
    pres: $('presVal'), presBar: $('presBar'), presSub: $('presSub'),
    temp: $('tempVal'), tempBar: $('tempBar'), tempSub: $('tempSub'),
    light: $('lightVal'), lightBar: $('lightBar'), lightSub: $('lightSub'),
    rulerFill: $('rulerFill'), rulerDot: $('rulerDot'), ticks: $('rulerTicks')
  };

  // Hero text
  $('heroTitle').textContent = D.meta.title;
  $('heroSub').textContent = D.meta.tagline + ' Our moon, ' + D.meta.moonName + ', is fictional; every design choice is tied to real evidence.';
  document.title = D.meta.title;

  // Markers
  const markerNodes = [];
  D.markers.forEach((m) => {
    const wrap = document.createElement('div');
    wrap.className = 'marker ' + m.side + ' ' + m.kind;
    const inner = document.createElement(m.card ? 'button' : 'div');
    inner.className = m.card ? 'marker-btn' : 'marker-txt';
    if (m.card) {
      inner.type = 'button';
      inner.addEventListener('click', () => { inner.classList.add('is-seen'); markFound(m.card); openCard(m.card, inner); });
    }

    if (m.side !== 'center') {
      const rule = document.createElement('span'); rule.className = 'rule'; rule.textContent = '──'; rule.setAttribute('aria-hidden', 'true');
      inner.appendChild(rule);
    }
    if (m.kind === 'level') {
      const lv = document.createElement('span'); lv.className = 'lv'; lv.textContent = 'Lv ' + m.level;
      inner.appendChild(lv);
    }
    const txt = document.createElement('span'); txt.textContent = m.text; inner.appendChild(txt);
    if (m.card) {
      const plus = document.createElement('span'); plus.className = 'tag-plus'; plus.textContent = '+'; plus.setAttribute('aria-hidden', 'true');
      inner.appendChild(plus);
    }
    wrap.appendChild(inner);
    markersEl.appendChild(wrap);
    markerNodes.push({ m, wrap });
  });

  // "Facts found" counter: a small collect-them-all game
  const found = new Set();
  const cardIds = new Set(D.markers.filter((m) => m.card && D.cards[m.card]).map((m) => m.card));
  $('foundTotal').textContent = cardIds.size;
  function markFound(id) {
    if (!cardIds.has(id) || found.has(id)) return;
    found.add(id);
    $('foundN').textContent = found.size;
    const box = $('foundBox');
    box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
    box.classList.toggle('all', found.size === cardIds.size);
  }

  // Ruler ticks (click to jump)
  const TICKS = [
    { label: 'Surface', d: 0 },
    { label: 'Ice', d: 1000 },
    { label: 'Ocean', d: ICE_M + 1 },
    { label: 'Garden', d: GARDEN_M + 2 },
    { label: 'Floor', d: FLOOR_M }
  ];
  const tickNodes = TICKS.map((tk) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tick'; b.textContent = tk.label;
    b.addEventListener('click', () => jumpToDepth(tk.d));
    el.ticks.appendChild(b);
    return { tk, b };
  });
  const fracOfU = (u) => Math.min(1, Math.max(0, (u - U.surf) / (U.floor - U.surf)));

  // End section lists
  D.limits.forEach((s) => { const li = document.createElement('li'); li.textContent = s; $('limitsList').appendChild(li); });
  D.tests.forEach((s) => { const li = document.createElement('li'); li.textContent = s; $('testsList').appendChild(li); });
  Object.entries(D.sources).forEach(([, s]) => $('sourcesList').appendChild(sourceItem(s)));
  $('credits').textContent = 'Team ' + D.meta.teamName + ': ' + D.meta.members.join(', ') + '.';

  function sourceItem(s) {
    const li = document.createElement('li');
    li.appendChild(document.createTextNode(s.cite + ' '));
    const a = document.createElement('a'); a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = s.url.replace(/^https?:\/\//, '');
    li.appendChild(a);
    const ty = document.createElement('span'); ty.className = 'src-type'; ty.textContent = s.type === 'peer' ? 'peer-reviewed' : 'agency';
    li.appendChild(ty);
    return li;
  }

  // ---------- layout ----------
  let W = innerWidth, H = innerHeight, endTop = 0;
  const L = { surf: U.surf, ice: U.ice, garden: U.garden, floor: U.floor };
  const creatures = {};

  function layout() {
    W = innerWidth; H = innerHeight;
    markerNodes.forEach(({ m, wrap }) => {
      let y = uOfMarker(m) * H;
      if (m.side === 'center') y += 0.1 * H;
      wrap.style.top = Math.round(y) + 'px';
    });
    endTop = (U.floor + 0.62) * H;
    endEl.style.top = Math.round(endTop) + 'px';
    const total = endTop + endEl.offsetHeight + 0.05 * H;
    spacer.style.height = Math.round(total) + 'px';
    world.style.height = Math.round(total) + 'px';
    tickNodes.forEach(({ tk, b }) => { b.style.top = (fracOfU(uOfD(tk.d)) * 100) + '%'; });
    Object.keys(D.creatures).forEach((k) => {
      creatures[k] = D.creatures[k].map((c) => ({ x: c.x, u: uOfD(FLOOR_M - c.aboveFloor) }));
    });
    World.resize(W, H, L);
  }

  function jumpToDepth(d) {
    const u = uOfD(d);
    const top = d <= 0 ? 0 : u * H - PROBE_FRAC * H + 2;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }

  // ---------- loop ----------
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  World.init($('scene'));
  layout();
  let cam = scrollY, t0 = performance.now();
  let lastHud = '';

  function frame(now) {
    const target = scrollY;
    cam = reduced ? target : cam + (target - cam) * 0.12;
    if (Math.abs(target - cam) < 0.3) cam = target;
    world.style.transform = 'translate3d(0,' + (-cam).toFixed(1) + 'px,0)';

    const probeY = Math.max(PROBE_FRAC * H, U.surf * H - cam);
    const probeU = (cam + probeY) / H;
    const depth = Math.min(FLOOR_M, Math.max(0, dOfU(probeU)));
    const t = reduced ? 0 : (now - t0) / 1000;

    requestAnimationFrame(frame);
    if (innerWidth !== W || innerHeight !== H) layout();
    World.draw({ cam, t, probeY, depth, L, dOfU, iceM: ICE_M, creatures });
    updateHud(depth, probeU);
  }

  function updateHud(d, probeU) {
    hud.classList.toggle('is-hidden', cam < 0.04 * H);
    hud.classList.toggle('at-end', cam + H * 0.55 > endTop);
    const key = d.toFixed(1);
    if (key === lastHud) return;
    lastHud = key;

    el.depth.textContent = fmtDepth(d);
    el.zone.textContent = zoneOf(d);

    const pa = pressurePa(d), bar = pa / 1e5;
    el.pres.textContent = d <= 0 ? '0 bar' : nf(bar, bar < 10 ? 2 : 1) + ' bar';
    el.presBar.style.width = Math.min(100, (bar / (pressurePa(FLOOR_M) / 1e5)) * 100) + '%';
    el.presSub.textContent = d <= 0 ? 'no air' : '≈ ' + nf(pa / (1030 * 9.81), 0) + ' m deep on Earth';

    const tc = tempC(d);
    el.temp.textContent = minus(nf(tc, Math.abs(tc) < 10 ? 1 : 0)) + ' °C';
    el.tempBar.style.width = Math.min(100, ((tc - P.surfaceTempC) / (100 - P.surfaceTempC)) * 100) + '%';
    el.tempSub.textContent = d <= 0 ? 'surface' : d < ICE_M ? 'inside the ice' : d < GARDEN_M ? 'near freezing' : 'vent fluid ' + P.ventFluidC + ' °C';

    const lp = lightPct(d);
    if (lp >= 0.01) el.light.textContent = nf(lp, 2) + '%';
    else if (lp >= 1e-9) el.light.textContent = lp.toExponential(0).replace('e', '×10^') + '%';
    else el.light.textContent = '0%';
    el.lightBar.style.width = lp < 1e-9 ? '0%' : Math.max(0, Math.min(100, ((Math.log10(lp) + 9) / 11) * 100)) + '%';
    el.lightSub.textContent = lp < 1e-9 ? 'total darkness' : "of Earth's sunlight";

    const f = fracOfU(probeU);
    el.rulerFill.style.height = (f * 100) + '%';
    el.rulerDot.style.top = (f * 100) + '%';
  }

  // ---------- science cards ----------
  const card = $('card'), cardTitle = $('cardTitle'), cardBody = $('cardBody'), cardTags = $('cardTags');
  let lastOpener = null;

  function chip(cls, text) { const s = document.createElement('span'); s.className = 'chip ' + cls; s.textContent = text; return s; }
  function para(text) {
    const p = document.createElement('p');
    p.textContent = text;
    if (/→/.test(text) && text.length < 60) p.className = 'eq';
    return p;
  }
  function section(cls, title, items) {
    const d = document.createElement('div'); d.className = 'card-sec ' + cls;
    const h = document.createElement('h4'); h.textContent = title; d.appendChild(h);
    const ul = document.createElement('ul');
    items.forEach((s) => { const li = document.createElement('li'); li.textContent = s; ul.appendChild(li); });
    d.appendChild(ul); return d;
  }
  function coins() {
    const wrap = document.createElement('div'); wrap.className = 'coins';
    [['Methane-makers', 1000], ['Grazers', 100], ['Shadowfin', 10]].forEach(([n, v]) => {
      const row = document.createElement('div'); row.className = 'coin-row';
      const a = document.createElement('span'); a.textContent = n;
      const bar = document.createElement('span'); bar.className = 'coin-bar';
      const i = document.createElement('i'); i.style.width = (v / 10) + '%'; bar.appendChild(i);
      const c = document.createElement('span'); c.className = 'coin-n'; c.textContent = nf(v, 0);
      row.append(a, bar, c); wrap.appendChild(row);
    });
    return wrap;
  }

  function openCard(id, opener) {
    const c = D.cards[id]; if (!c) return;
    lastOpener = opener || null;
    cardTitle.textContent = c.title;
    cardTags.replaceChildren();
    if (c.evidence && c.evidence.length) cardTags.appendChild(chip('evidence', 'Evidence'));
    if (c.assumptions && c.assumptions.length) cardTags.appendChild(chip('assumption', 'Assumption'));
    if (/fictional/i.test((c.assumptions || []).join(' '))) cardTags.appendChild(chip('fiction', 'Fictional'));

    cardBody.replaceChildren();
    if (window.Microscope && Microscope.has(id)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-pixel btn-small scope-open';
      b.textContent = '🔬 Look under the microscope';
      b.addEventListener('click', () => { closeCard(); Microscope.open(id, opener); });
      cardBody.appendChild(b);
    }
    (c.body || []).forEach((t) => cardBody.appendChild(para(t)));
    if (c.special === 'energy') {
      cardBody.appendChild(coins());
      const n = document.createElement('p'); n.className = 'coin-note'; n.textContent = 'Illustrative numbers, not measurements.';
      cardBody.appendChild(n);
    }
    (c.after || []).forEach((t) => cardBody.appendChild(para(t)));
    if (c.evidence && c.evidence.length) cardBody.appendChild(section('ev', 'What is evidence', c.evidence));
    if (c.assumptions && c.assumptions.length) cardBody.appendChild(section('as', 'What we assumed', c.assumptions));
    if (c.sources && c.sources.length) {
      const d = document.createElement('div'); d.className = 'card-src';
      d.appendChild(document.createTextNode('Sources'));
      const ol = document.createElement('ol');
      c.sources.forEach((k) => { if (D.sources[k]) ol.appendChild(sourceItem(D.sources[k])); });
      d.appendChild(ol); cardBody.appendChild(d);
    }
    card.hidden = false;
    card.scrollTop = 0;
    $('cardClose').focus({ preventScroll: true });
  }
  function closeCard() {
    if (card.hidden) return;
    card.hidden = true;
    if (lastOpener) lastOpener.focus({ preventScroll: true });
  }
  $('cardClose').addEventListener('click', closeCard);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });
  document.addEventListener('pointerdown', (e) => {
    if (!card.hidden && !card.contains(e.target) && !e.target.closest('.marker-btn')) closeCard();
  });

  window.DiveUI = { openCard: (id) => { markFound(id); openCard(id, null); } };

  // ---------- click a creature in the scene to open the microscope ----------
  function creatureAt(x, y) {
    if (!window.World || !World.getHits) return null;
    let best = null, bd = Infinity;
    World.getHits().forEach((h) => {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= h.r && d < bd) { best = h; bd = d; }
    });
    return best;
  }
  const isUi = (el) => el.closest && el.closest('button, a, .card, .scope, .hud-box, .end-panel');
  addEventListener('click', (e) => {
    if (isUi(e.target) || !window.Microscope) return;
    const h = creatureAt(e.clientX, e.clientY);
    if (h) { markFound(h.id); Microscope.open(h.id); }
  });
  addEventListener('mousemove', (e) => {
    const on = !isUi(e.target) && !!creatureAt(e.clientX, e.clientY);
    document.body.classList.toggle('over-creature', on);
  }, { passive: true });

  // ---------- buttons ----------
  $('beginBtn').addEventListener('click', () => jumpToDepth(4));
  $('topBtn').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
  $('sourcesLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: endTop - 0.08 * H, behavior: reduced ? 'auto' : 'smooth' });
  });

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); lastHud = ''; }, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); });

  requestAnimationFrame(frame);
})();
