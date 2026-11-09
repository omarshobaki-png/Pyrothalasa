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

  // Hero text: the title drops in letter by letter (CSS animates each span)
  (function titleLetters() {
    const h = $('heroTitle'); h.textContent = '';
    h.setAttribute('aria-label', D.meta.title);
    let i = 0;
    D.meta.title.split(' ').forEach((word, wi) => {
      const w = document.createElement('span'); w.className = 'tw'; w.setAttribute('aria-hidden', 'true');
      [...word].forEach((ch) => {
        const s = document.createElement('span'); s.className = 'tl'; s.textContent = ch;
        s.style.setProperty('--i', i++); w.appendChild(s);
      });
      if (wi) h.appendChild(document.createTextNode(' '));
      h.appendChild(w);
    });
  })();
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

  // "Discoveries" counter: a small collect-them-all game. A discovery is a science card you
  // opened, or a food-web level you looked at under the microscope.
  const found = new Set();
  const cardIds = new Set(D.markers.filter((m) => m.card && D.cards[m.card]).map((m) => m.card));
  const SCOPE = { methanogens: 'Methane-makers', grazers: 'Grazers', predator: 'Shadowfin' };
  const allIds = [...cardIds, ...Object.keys(SCOPE).map((k) => 'scope:' + k)];
  const labelOf = (id) => id.startsWith('scope:') ? '🔬 ' + SCOPE[id.slice(6)] : D.cards[id].title;
  $('foundTotal').textContent = allIds.length;
  function markFound(id) {
    if (!allIds.includes(id) || found.has(id)) return;
    found.add(id);
    const box = $('foundBox');
    $('foundN').textContent = found.size;
    $('foundBar').style.width = (found.size / allIds.length * 100) + '%';
    box.title = 'Facts ' + [...found].filter((k) => !k.startsWith('scope:')).length + '/' + cardIds.size +
      ' · microscope ' + [...found].filter((k) => k.startsWith('scope:')).length + '/3';
    box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
    const done = found.size === allIds.length;
    box.classList.toggle('all', done);
    if (done) showToast({ text: 'All ' + allIds.length + ' found!', sub: 'you explored everything' }, 'Discoveries');
    renderMissed();
    renderLog();
  }
  // End screen: your score plus buttons for anything you missed
  function renderMissed() {
    const wrap = $('discoveries'); if (!wrap) return;
    $('discN').textContent = found.size + ' / ' + allIds.length;
    const list = $('missedList'); list.replaceChildren();
    const missed = allIds.filter((id) => !found.has(id));
    $('missedHead').textContent = missed.length ? 'Show what you missed (' + missed.length + ')' : 'You found every discovery. Nice exploring!';
    $('missedBox').classList.toggle('none-left', !missed.length);
    missed.forEach((id) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'missed-btn';
      b.textContent = labelOf(id);
      b.addEventListener('click', () => {
        // open first (so the still-connected button is remembered), then count it as found
        if (id.startsWith('scope:')) Microscope.open(id.slice(6), b);
        else { openCard(id, b); markFound(id); }
      });
      list.appendChild(b);
    });
    window.dispatchEvent(new Event('resize'));
  }
  $('missedBox').addEventListener('toggle', () => window.dispatchEvent(new Event('resize')));

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
    scanLayout();
  }

  function jumpToDepth(d) {
    const u = uOfD(d);
    const top = d <= 0 ? 0 : u * H - PROBE_FRAC * H + 2;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }

  // =====================================================================
  // Probe scan: info appears by itself as the probe reaches it.
  //  - A feature (a marker, or a garden specimen) is "reached" when it crosses the scan line.
  //  - Normal speed: a scan beam + corner brackets (drawn by world.js), then a callout that
  //    types out the marker's own text (no new wording), with "Read more" -> the full card.
  //  - Faster than about one marker gap per second: logged as "missed" instead (and scanned
  //    after all if the scroll settles while it is still on screen).
  //  - Seen vs discovered: every scan is "seen" in the mission log; the Discoveries counter
  //    still counts what you opened (cards, microscope), so scrolling alone can't fill it.
  //  - Never moves the scroll position and never moves focus.
  // =====================================================================
  const SCAN_LINE = 0.62;                       // fraction of screen height where a feature is reached
  const sc = {
    el: $('scanCallout'), leader: $('scanLeader'), title: $('scanTitle'), tags: $('scanTags'),
    full: $('scanFull'), typed: $('scanTyped'), sr: $('scanSr'), kicker: $('scanKicker'),
    more: $('scanMore'), scope: $('scanScope'), x: $('scanX')
  };
  const liveEl = $('scanLive'), autoBtn = $('autoBtn'), logEl = $('missionLog'), logList = $('logList');
  let autoOn = true;
  try { autoOn = localStorage.getItem('hg-autoinfo') !== 'off'; } catch (e) { /* storage blocked: stay on */ }

  const SPECIMEN = { grazers: 'grazers', predator: 'predator' };   // card id -> creature group drawn in the scene
  const targets = markerNodes.filter(({ m }) => m.card && D.cards[m.card]).map(({ m, wrap }) => ({
    m, wrap, card: m.card,
    scope: window.Microscope && Microscope.has(m.card) ? m.card : null,
    crit: SPECIMEN[m.card] || null,
    yw: 0, thr: 1, state: '', prevY: null, rect: null, box: null, li: null, btn: null
  }));

  function scanLayout() {
    targets.forEach((t) => {
      const w = t.wrap, center = t.m.side === 'center';
      const top = parseFloat(w.style.top) - (center ? 0 : w.offsetHeight / 2);
      t.box = { x: w.offsetLeft - (center ? w.offsetWidth / 2 : 0), y: top, w: w.offsetWidth, h: w.offsetHeight };
      let y = top + w.offsetHeight / 2;
      if (t.crit && creatures[t.crit]) creatures[t.crit].forEach((c) => { y = Math.min(y, c.u * H); });
      t.yw = y; t.prevY = null;
    });
    targets.sort((a, b) => a.yw - b.yw);
    targets.forEach((t, i) => {
      const gaps = [];
      if (i > 0) gaps.push(t.yw - targets[i - 1].yw);
      if (i < targets.length - 1) gaps.push(targets[i + 1].yw - t.yw);
      // about one marker gap per second, but never below 0.8 screens/s (garden labels are close together)
      t.thr = Math.min(1.6, Math.max(0.8, Math.min.apply(null, gaps) / H));
    });
    hudRects = null;
    if (!logBuilt) buildLog();
  }

  // scroll speed in screen heights per second, smoothed over ~0.25 s
  let lastSY = scrollY, lastST = performance.now(), speed = 0;
  function trackSpeed() {
    const now = performance.now();               // wall-clock time (frame timestamps can lag it)
    const dt = Math.max(1, now - lastST) / 1000;
    const v = Math.abs(scrollY - lastSY) / H / dt;
    speed += (v - speed) * Math.min(1, dt / 0.25);
    lastSY = scrollY; lastST = now;
  }

  let cur = null;                               // the open callout
  function scanTick(now, probeY) {
    if (!autoOn) return;
    const S = SCAN_LINE * H;
    for (const t of targets) {
      const y = t.yw - cam;
      if (t.prevY !== null && t.prevY > S && y <= S) reached(t, now);
      t.prevY = y;
    }
    if (!cur && speed < 0.25 && !(logOpen && phoneMq.matches)) {   // caught up after a fast scroll
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i], y = t.yw - cam;
        if (t.state === 'missed' && y > 0.15 * H && y <= S) { openScan(t, now); break; }
      }
    }
    if (cur) updateScan(now, probeY);
  }
  function reached(t, now) {
    if (t.state === 'scanned') return;
    if (found.has(t.card) || (logOpen && phoneMq.matches)) { setState(t, 'scanned'); return; }
    if (speed > t.thr) { setState(t, 'missed'); return; }
    openScan(t, now);
  }
  function tagChips(c) {
    const out = [];
    if (c.evidence && c.evidence.length) out.push(chip('evidence', 'Evidence'));
    if (c.assumptions && c.assumptions.length) out.push(chip('assumption', 'Assumption'));
    if (/fictional|our invention|invented/i.test((c.assumptions || []).join(' '))) out.push(chip('fiction', 'Fictional'));
    return out;
  }
  function announce(text) {
    liveEl.textContent = '';
    setTimeout(() => { liveEl.textContent = text; }, 60);
  }
  function openScan(t, now) {
    if (cur && sc.el.contains(document.activeElement)) { setState(t, 'scanned'); return; }   // never pull focus away
    if (cur) hideScan();
    setState(t, 'scanned');
    const c = D.cards[t.card], text = t.m.text;
    sc.kicker.textContent = t.scope ? 'Specimen detected' : 'Probe scan';
    sc.title.textContent = c.title;
    sc.tags.replaceChildren.apply(sc.tags, tagChips(c));
    sc.full.textContent = text; sc.sr.textContent = text;
    sc.typed.textContent = reduced ? text : '';
    sc.scope.hidden = !t.scope;
    sc.el.classList.toggle('specimen', !!t.scope);
    sc.el.dataset.side = t.m.side === 'right' ? 'right' : 'left';
    sc.el.classList.remove('is-open', 'is-closing', 'compact');
    sc.el.hidden = false;
    void sc.el.offsetWidth;
    sc.el.classList.add('is-open');
    cur = { t, start: now, closing: 0, place: null, w: sc.el.offsetWidth, h: sc.el.offsetHeight, typedN: reduced ? text.length : 0 };
    hudRects = null;
    announce((t.scope ? 'Specimen detected: ' : 'Probe scan: ') + c.title + '. ' + text);
    forceDraw = true;
  }
  function hideScan() {
    sc.el.hidden = true; sc.leader.hidden = true;
    sc.el.classList.remove('is-open', 'is-closing');
    cur = null; forceDraw = true;
  }
  function closeScan() {
    if (!cur || cur.closing) return;
    if (reduced) { hideScan(); return; }
    cur.closing = performance.now();
    sc.el.classList.add('is-closing'); sc.leader.hidden = true;
    forceDraw = true;
  }
  function updateScan(now, probeY) {
    const t = cur.t, age = (now - cur.start) / 1000;
    if (cur.closing) { forceDraw = true; if (now - cur.closing > 170) hideScan(); return; }
    const yc = t.yw - cam;
    const focused = sc.el.contains(document.activeElement);
    if (!focused && (yc < 0.06 * H || yc > 0.96 * H)) { closeScan(); return; }   // left the visible band
    if (!reduced) {                              // ~25 ms per character; any line done within 1.5 s
      const per = Math.min(25, 1500 / t.m.text.length);
      const n = Math.max(0, Math.min(t.m.text.length, Math.floor((age - 0.4) * 1000 / per)));
      if (n !== cur.typedN) { cur.typedN = n; sc.typed.textContent = t.m.text.slice(0, n); }
    }
    t.rect = featureRect(t);
    position(t, probeY);
    if (age < 0.75) forceDraw = true;
  }
  function featureRect(t) {
    if (t.crit && window.World && World.getHits) {
      let best = null;
      const S = SCAN_LINE * H;
      World.getHits().forEach((h) => { if (h.id === t.crit && (!best || Math.abs(h.y - S) < Math.abs(best.y - S))) best = h; });
      if (best) return { x: best.x - best.r, y: best.y - best.r, w: best.r * 2, h: best.r * 2 };
    }
    const b = t.box;
    return { x: b.x, y: b.y - cam, w: b.w, h: b.h };
  }

  // Placement: never over the HUD, the probe or a tappable creature. Desktop: beside the
  // feature on its own side; phones: a bottom sheet above the gauges (or under the top HUD).
  let hudRects = null;
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  function obstacles(probeY) {
    if (!hudRects) {
      hudRects = [...hud.querySelectorAll('.hud-box, .ruler, .mlog')].map((e) => e.getBoundingClientRect())
        .filter((r) => r.width && r.height).map((r) => ({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 }));
    }
    const ph = phoneMq.matches ? 2 : 3;
    const list = hudRects.slice();
    list.push({ x: W / 2 - 12 * ph, y: probeY - 40 * ph, w: 24 * ph, h: 46 * ph });      // the probe (+ its lamp)
    if (window.World && World.getHits) World.getHits().forEach((h) => list.push({ x: h.x - h.r - 4, y: h.y - h.r - 4, w: h.r * 2 + 8, h: h.r * 2 + 8 }));
    return list;
  }
  function score(r, obs) {
    let s = 0;
    obs.forEach((o) => { s += overlap(r, o); });
    if (r.y < 6) s += (6 - r.y) * r.w * 4;
    if (r.y + r.h > H - 6) s += (r.y + r.h - H + 6) * r.w * 4;
    return s;
  }
  function position(t, probeY) {
    const r = t.rect, obs = obstacles(probeY);
    let w = cur.w, h = cur.h, cands;
    const build = () => {
      if (phoneMq.matches) {
        const g = hud.querySelector('.hud-gauges').getBoundingClientRect();
        const fb = $('foundBox').getBoundingClientRect();
        cands = [{ k: 'bottom', x: 8, y: Math.min(H - 8, g.top) - 8 - h }, { k: 'top', x: 8, y: fb.bottom + 8 }];
      } else {
        const right = t.m.side === 'right';
        let x = right ? r.x + r.w - w : r.x;
        x = right ? Math.max(W / 2 + 44, Math.min(W - 150 - w, x)) : Math.max(60, Math.min(W / 2 - 44 - w, x));
        cands = [{ k: 'below', x, y: r.y + r.h + 14 }, { k: 'above', x, y: r.y - 14 - h }];
      }
      cands.forEach((c) => { c.s = score({ x: c.x, y: c.y, w, h }, obs); });
    };
    build();
    let pick = cands.find((c) => c.k === cur.place);              // sticky: only switch when it starts to collide
    if (!pick || pick.s > 0) pick = cands.reduce((a, b) => (b.s < a.s ? b : a));
    if (pick.s > 0 && phoneMq.matches && !cur.compact) {
      // phones: no free sheet slot -> a compact sheet (title + buttons), so the probe and creatures stay clear
      cur.compact = true; sc.el.classList.add('compact'); cur.h = h = sc.el.offsetHeight;
      build(); pick = cands.reduce((a, b) => (b.s < a.s ? b : a));
    }
    if (pick.s > 0) {
      // both slots collide -> the nearest free slot in the same column (phones: between the HUD rows)
      let best = pick, bd = Infinity;
      const yMin = phoneMq.matches ? $('foundBox').getBoundingClientRect().bottom + 8 : 8;
      const yMax = phoneMq.matches ? hud.querySelector('.hud-gauges').getBoundingClientRect().top - 8 - h : H - h - 8;
      for (let y = yMin; y <= yMax; y += 12) {
        const sc2 = score({ x: pick.x, y, w, h }, obs), d = Math.abs(y - (r.y + r.h / 2 - h / 2));
        if (sc2 < best.s || (sc2 === best.s && d < bd)) { best = { k: 'slot', x: pick.x, y, s: sc2 }; bd = d; }
      }
      pick = best;
    }
    cur.place = pick.k;
    sc.el.style.transform = 'translate(' + Math.round(pick.x) + 'px,' + Math.round(pick.y) + 'px)';
    // 1px leader line from the feature to the callout (desktop; on phones the beam does this job)
    if (phoneMq.matches) { sc.leader.hidden = true; return; }
    const lx = Math.round(Math.max(pick.x + 10, Math.min(pick.x + w - 10, r.x + r.w / 2)));
    const under = pick.y > r.y + r.h / 2;
    const y1 = under ? r.y + r.h + 2 : pick.y + h, y2 = under ? pick.y : r.y - 2;
    const age = (performance.now() - cur.start) / 1000;
    sc.leader.hidden = !(y2 > y1 && (reduced || age > 0.3));
    sc.leader.style.transform = 'translate(' + lx + 'px,' + Math.round(y1) + 'px)';
    sc.leader.style.height = Math.round(y2 - y1) + 'px';
  }
  function scanDrawState(now, probeY) {
    if (!cur || !cur.t.rect) return null;
    return {
      bx: W / 2, by: probeY, rect: cur.t.rect, age: (now - cur.start) / 1000, reduced,
      alpha: cur.closing ? Math.max(0, 1 - (now - cur.closing) / 170) : 1
    };
  }
  sc.x.addEventListener('click', () => closeScan());
  sc.more.addEventListener('click', () => {
    if (!cur) return;
    openCard(cur.t.card, sc.more); markFound(cur.t.card);
    lastFallback = $('foundBox');                 // if the callout has folded away by the time the card closes
  });
  sc.scope.addEventListener('click', () => { if (cur && window.Microscope) Microscope.open(cur.t.scope, sc.more); });
  // Escape closes the card first; a second Escape closes the callout
  let cardOpenAtKey = false;
  addEventListener('keydown', (e) => { if (e.key === 'Escape') cardOpenAtKey = !card.hidden; }, true);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || cardOpenAtKey) return;
    if (logOpen) { setLog(false); return; }
    if (cur) closeScan();
  });

  // ---------- zone banners: big chapter titles, words taken from the zone markers ----------
  const zb = { el: $('zoneBanner'), k: $('zbK'), title: $('zbTitle'), sub: $('zbSub') };
  const BANNERS = [['iceshell', 50], ['ocean', ICE_M], ['chimneys', GARDEN_M], ['shutdown', FLOOR_M - 1]].map(([id, d]) => {
    const m = D.markers.find((x) => x.card === id && x.kind === 'zone');
    const parts = m ? m.text.split(' · ') : ['', ''];
    return { d, title: parts[0], sub: parts.slice(1).join(' · '), shown: false };
  });
  let bannerLast = null, bannerTimer = 0, lastAtEnd = null;
  function showBanner(b, kicker) {
    b.shown = true;
    if (!autoOn || !b.title) return;
    toast.hidden = true;                          // the banner owns the top of the screen
    zb.k.textContent = kicker; zb.title.textContent = b.title; zb.sub.textContent = b.sub;
    zb.el.hidden = false;
    zb.el.classList.remove('show'); void zb.el.offsetWidth; zb.el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { zb.el.hidden = true; }, 2600);
    if (!cur) announce(kicker + ': ' + b.title + (b.sub ? ', ' + b.sub : ''));
  }
  function bannerCheck(d) {
    if (bannerLast !== null && d > bannerLast) {
      BANNERS.forEach((b, i) => { if (!b.shown && bannerLast < b.d && d >= b.d) showBanner(b, i === 3 ? 'Arrived' : 'Entering'); });
    }
    bannerLast = d;
  }
  function atEndChanged(atEnd) {
    if (!phoneMq.matches && innerWidth >= 1240 && !logTouched) setLog(atEnd);   // fill the wide end-screen gutter
    if (atEnd) closeScan();
  }

  // ---------- mission log ----------
  let logBuilt = false, logOpen = false, logTouched = false;
  function buildLog() {
    logBuilt = true;
    targets.forEach((t) => {
      const li = document.createElement('li');
      const b = document.createElement('button'); b.type = 'button';
      const ic = document.createElement('span'); ic.className = 'ml-ic'; ic.setAttribute('aria-hidden', 'true');
      const tx = document.createElement('span'); tx.className = 'ml-t'; tx.textContent = D.cards[t.card].title;
      b.append(ic, tx);
      b.addEventListener('click', () => { openCard(t.card, b); markFound(t.card); });
      li.appendChild(b); logList.appendChild(li);
      t.li = li; t.btn = b;
    });
    renderLog();
  }
  function setState(t, s) { if (t.state !== s) { t.state = s; renderLog(); } }
  function renderLog() {
    if (!logBuilt) return;
    let n = 0;
    targets.forEach((t) => {
      const st = found.has(t.card) ? 'read' : t.state;
      t.li.className = 'ml-' + (st || 'todo');
      const reachedYet = !!st;
      t.btn.hidden = false;
      t.btn.disabled = !reachedYet;
      t.li.setAttribute('aria-hidden', reachedYet ? 'false' : 'true');
      const word = st === 'read' ? 'read' : st === 'missed' ? 'missed (passed too fast)' : 'scanned';
      t.btn.setAttribute('aria-label', reachedYet ? D.cards[t.card].title + ', ' + word : 'not reached yet');
      t.btn.title = reachedYet ? D.cards[t.card].title + ' · ' + word : '';
      if (reachedYet) n++;
    });
    $('logN').textContent = n + '/' + targets.length;
  }
  function setLog(open) {
    logOpen = open;
    logEl.classList.toggle('open', open);
    $('logToggle').setAttribute('aria-expanded', String(open));
    $('foundBox').setAttribute('aria-expanded', String(open));
    hudRects = null;
    if (open && phoneMq.matches) hideScan();     // the log sheet and a callout sheet never share the screen
  }
  $('logToggle').addEventListener('click', () => { logTouched = true; setLog(!logOpen); });
  $('logClose').addEventListener('click', () => { logTouched = true; setLog(false); $('foundBox').focus({ preventScroll: true }); });
  $('foundBox').addEventListener('click', () => { logTouched = true; setLog(!logOpen); });

  // ---------- Auto-info toggle (remembered) ----------
  function setAuto(on) {
    autoOn = on;
    autoBtn.setAttribute('aria-pressed', String(on));
    autoBtn.querySelector('b').textContent = on ? 'on' : 'off';
    try { localStorage.setItem('hg-autoinfo', on ? 'on' : 'off'); } catch (e) { /* not remembered */ }
    if (!on) { if (cur) hideScan(); zb.el.hidden = true; }
    targets.forEach((t) => { t.prevY = null; });  // re-arm without firing for what passed meanwhile
    bannerLast = null;
  }
  autoBtn.addEventListener('click', () => setAuto(!autoOn));
  setAuto(autoOn);

  // ---------- loop ----------
  // Reduced motion is read live: switching it on mid-visit freezes the scene at once.
  const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionMq.matches;
  const onMotion = (e) => { reduced = e.matches; forceDraw = true; };
  if (motionMq.addEventListener) motionMq.addEventListener('change', onMotion); else motionMq.addListener(onMotion);
  World.init($('scene'));
  layout();
  let cam = scrollY, t0 = performance.now();
  let lastHud = '', lastCam = -1, frameN = 0, forceDraw = true, lastHover = null;

  function frame(now) {
    requestAnimationFrame(frame);
    const f0 = window.__frameProf ? performance.now() : 0;   // opt-in timing for tests
    const target = scrollY;
    cam = reduced ? target : cam + (target - cam) * 0.12;
    if (Math.abs(target - cam) < 0.3) cam = target;
    const moving = cam !== lastCam;
    if (moving) world.style.transform = 'translate3d(0,' + (-cam).toFixed(1) + 'px,0)';

    const probeY = Math.max(PROBE_FRAC * H, U.surf * H - cam);
    const probeU = (cam + probeY) / H;
    const depth = Math.min(FLOOR_M, Math.max(0, dOfU(probeU)));
    const t = reduced ? 0 : (now - t0) / 1000;
    nowT = t;

    if (innerWidth !== W || innerHeight !== H) { layout(); forceDraw = true; }
    if (hoverPt !== lastHover) { lastHover = hoverPt; forceDraw = true; }
    // Keep CPU/GPU light: full rate while the camera moves; at rest the ambient animation
    // runs at half rate, and with reduced motion the static scene is not redrawn at all.
    frameN++;
    trackSpeed(now);
    scanTick(now, probeY);
    if (moving) bannerCheck(depth);
    const draw = moving || forceDraw || (!reduced && frameN % 2 === 0);
    if (draw) {
      World.draw({ cam, t, probeY, depth, L, dOfU, uOfD, iceM: ICE_M, gardenM: GARDEN_M, creatures, hover: hoverPt, revealT: revealAt ? (reduced ? 99 : t - revealAt) : -1, reduced, scan: scanDrawState(now, probeY) });
      forceDraw = false;
    }
    lastCam = cam;
    if (moving) { updateHud(depth, probeU); checkpoints(depth); }
    if (f0) window.__frameProf.push(performance.now() - f0);
  }

  // ---------- depth checkpoints: a small pop-up each time you pass a milestone ----------
  const CHECKS = [
    { d: 1000, text: '1 km down', sub: 'still solid ice' },
    { d: 10000, text: '10 km', sub: 'halfway through the ice' },
    { d: ICE_M, text: 'Through the ice!', sub: 'into the dark ocean', zone: true },
    { d: 30000, text: '30 km', sub: 'pitch dark, almost empty' },
    { d: 40000, text: '40 km', sub: 'hydrogen in the water' },
    { d: GARDEN_M, text: 'Hydrogen Garden', sub: 'probe floodlights on', zone: true }
  ];
  const toast = $('toast');
  let lastDepth = 0, toastTimer = 0;
  const flashEl = $('flash');
  function flash(kind) {
    if (reduced) return;
    flashEl.className = 'flash'; void flashEl.offsetWidth; flashEl.className = 'flash ' + kind;
    if (kind === 'ice') { $('scene').classList.remove('pulse'); void $('scene').offsetWidth; $('scene').classList.add('pulse'); }
  }
  function checkpoints(d) {
    if (d > lastDepth) {
      const hit = CHECKS.filter((c) => lastDepth < c.d && d >= c.d).pop();
      if (hit && lastDepth > 0 && !(autoOn && hit.zone)) showToast(hit);
      if (lastDepth > 0 && lastDepth < ICE_M && d >= ICE_M) flash('ice');
      if (lastDepth > 0 && lastDepth < GARDEN_M && d >= GARDEN_M) { flash('warm'); gardenReveal(); }
    }
    lastDepth = d;
    // deeper = darker edges (CSS vignette); updated only when it changes noticeably
    const dk = Math.round(Math.min(1, d / FLOOR_M) * 20) / 20;
    if (dk !== lastDk) { lastDk = dk; document.documentElement.style.setProperty('--dk', dk); }
  }
  let lastDk = -1, hoverPt = null, revealAt = 0, nowT = 0;

  // Garden arrival: the probe's floodlights light up the chimneys (world.js uses revealT).
  // (The microscope prompt is now the "Specimen detected" probe scan.)
  function gardenReveal() {
    if (revealAt) return;
    revealAt = Math.max(0.001, nowT);
    document.body.classList.add('garden-reached');
  }
  function showToast(c, kind) {
    if (!zb.el.hidden) return;                    // never on top of a zone banner
    toast.querySelector('.toast-k').textContent = kind || 'Checkpoint';
    toast.querySelector('.toast-main').textContent = c.text;
    toast.querySelector('.toast-sub').textContent = c.sub;
    toast.hidden = false;
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  }

  // Faded-out HUD controls are made inert so Tab skips them (pointer-events alone doesn't).
  const phoneMq = matchMedia('(max-width: 700px)');
  const rulerEl = hud.querySelector('.ruler');
  const setInert = (el, on) => { if (el && el.inert !== on) el.inert = on; };
  function updateHud(d, probeU) {
    const hidden = cam < 0.04 * H, atEnd = cam + H * 0.55 > endTop;
    hud.classList.toggle('is-hidden', hidden);
    hud.classList.toggle('at-end', atEnd);
    if ($('scope').hidden) setInert(hud, hidden);   // the open microscope owns inertness meanwhile
    setInert(rulerEl, atEnd);
    if (atEnd !== lastAtEnd) { if (lastAtEnd !== null) atEndChanged(atEnd); lastAtEnd = atEnd; }
    setInert($('sourcesLink'), atEnd && phoneMq.matches);
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
  // Key science words are shown in bold the first time they appear in each card.
  // (Formatting only: the wording itself stays exactly as written in content.js.)
  const TERMS = ['serpentinisation', 'chemosynthesis', 'photosynthesis', 'methanogens', 'methane-makers',
    'biofilms', 'cilia', 'protozoa', 'Archaea', 'Loricifera', 'mitochondria', 'hydrothermal', 'plume',
    'marine snow', 'inverse-square law', 'tidal heating', 'olivine', 'Lost City', 'habitable', 'alkaline', 'food web'];
  const termRe = new RegExp('\\b(' + TERMS.map((s) => s.replace(/[-]/g, '\\-')).join('|') + ')\\b', 'i');
  let usedTerms = new Set();
  function withTerms(el, text) {
    let rest = text;
    while (rest) {
      const m = termRe.exec(rest);
      if (!m) { el.appendChild(document.createTextNode(rest)); break; }
      const key = m[1].toLowerCase();
      el.appendChild(document.createTextNode(rest.slice(0, m.index)));
      if (usedTerms.has(key)) el.appendChild(document.createTextNode(m[1]));
      else { usedTerms.add(key); const b = document.createElement('strong'); b.className = 'term'; b.textContent = m[1]; el.appendChild(b); }
      rest = rest.slice(m.index + m[1].length);
    }
    return el;
  }
  function para(text) {
    const p = document.createElement('p');
    if (/→/.test(text) && text.length < 60) { p.className = 'eq'; p.textContent = text; }
    else withTerms(p, text);
    return p;
  }
  function section(cls, title, items) {
    const d = document.createElement('div'); d.className = 'card-sec ' + cls;
    const h = document.createElement('h4'); h.textContent = title; d.appendChild(h);
    const ul = document.createElement('ul');
    items.forEach((s) => { const li = document.createElement('li'); withTerms(li, s); ul.appendChild(li); });
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
    lastFallback = focusFallback(opener);
    cardTitle.textContent = c.title;
    cardTags.replaceChildren();
    if (c.evidence && c.evidence.length) cardTags.appendChild(chip('evidence', 'Evidence'));
    if (c.assumptions && c.assumptions.length) cardTags.appendChild(chip('assumption', 'Assumption'));
    // Fiction chip for anything the content calls fictional or "our invention" (e.g. the probe)
    if (/fictional|our invention|invented/i.test((c.assumptions || []).join(' '))) cardTags.appendChild(chip('fiction', 'Fictional'));

    cardBody.replaceChildren();
    usedTerms = new Set();
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
    restoreFocus(lastOpener, lastFallback);
  }
  // Where focus goes back to if the opener was removed meanwhile (e.g. a "missed" button
  // that disappears once found): the Discoveries summary it lived under.
  let lastFallback = null;
  function focusFallback(opener) {
    return opener && opener.closest && opener.closest('#missedList') ? $('missedHead') : null;
  }
  function restoreFocus(opener, fallback) {
    const el = opener && opener.isConnected ? opener : fallback;
    if (el && el.focus) el.focus({ preventScroll: !world.contains(el) });
  }
  $('cardClose').addEventListener('click', closeCard);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });
  document.addEventListener('pointerdown', (e) => {
    if (!card.hidden && !card.contains(e.target) && !e.target.closest('.marker-btn')) closeCard();
  });

  window.DiveUI = { openCard: (id, opener) => { markFound(id); openCard(id, opener || null); } };

  // Keyboard users: #world is a fixed layer moved by the camera, so the browser can't scroll
  // a focused label or end-screen control into view by itself. When something in the world
  // gets focus outside the HUD-safe band, scroll the page so it sits mid-screen; the camera
  // then glides there.
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!world.contains(el) || el === world) return;
    const r = el.getBoundingClientRect();
    const topSafe = 110, botSafe = H - (phoneMq.matches ? 90 : 130);
    if (r.top >= topSafe && r.bottom <= botSafe) return;
    const docTop = r.top + cam;                      // world is translated by -cam
    const y = docTop + r.height / 2 - H * 0.45;
    window.scrollTo({ top: Math.max(0, Math.round(y)), behavior: 'auto' });
  });

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
    if (h) Microscope.open(h.id);
  });
  addEventListener('mousemove', (e) => {
    const h = !isUi(e.target) ? creatureAt(e.clientX, e.clientY) : null;
    document.body.classList.toggle('over-creature', !!h);
    hoverPt = h ? { x: h.x, y: h.y } : null;          // world.js highlights that lens
  }, { passive: true });
  // every microscope view counts as a discovery, however it was opened
  if (window.Microscope) {
    const openScope = Microscope.open;
    Microscope.open = (id, from) => {
      openScope(id, from, focusFallback(from));    // open first, so `from` is still connected
      markFound('scope:' + id);
    };
  }
  addEventListener('scope-closed', () => { lastCam = -1; });   // forces updateHud next frame
  renderMissed();

  // ---------- buttons ----------
  $('beginBtn').addEventListener('click', () => jumpToDepth(4));
  $('scrollCue').addEventListener('click', () => jumpToDepth(4));
  $('topBtn').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
  $('sourcesLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: endTop - 0.08 * H, behavior: reduced ? 'auto' : 'smooth' });
  });

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); lastHud = ''; lastCam = -1; forceDraw = true; }, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); });

  requestAnimationFrame(frame);
})();
