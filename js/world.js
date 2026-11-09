/* =====================================================================
   World renderer: draws the pixel-art scene on a low-resolution canvas
   that the browser scales up (image-rendering: pixelated).
   All world positions are in "screen heights" (u) from the top of the page,
   so the scene keeps its layout when the window is resized.

   Speed: everything that never moves (sky, Saturn, drill rig, ice detail, far
   chimneys, seafloor rock) is painted ONCE per layout into one tall "scenery"
   canvas; each frame copies the visible slice with a single drawImage. Only
   moving things (currents, lamp, sonar, shimmer, creatures, probe) draw per frame.

   Science rule for scenery: only geology, ice, water and machinery. The only life
   is the microscopic 3-level food web in the garden.

   Sprites: if js/sprites.js (Codex) provides window.Sprites with a sprite of the
   right name, it is used; otherwise the built-in sprites below are drawn.
   ===================================================================== */
window.World = (function () {
  let cvs, ctx, dark, dctx;
  let W = 0, H = 0, PX = 3, aw = 0, ah = 0;

  // ---------- helpers ----------
  function hash(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const q = (t, n) => Math.min(n - 1, Math.max(0, Math.floor(t * n))) / (n - 1);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  // per-frame colours: 21 alpha steps per base colour, built once (no new strings each frame)
  const alphaCache = {};
  function rgba(base, a) {
    const arr = alphaCache[base] || (alphaCache[base] = []);
    const i = a <= 0 ? 0 : a >= 1 ? 20 : Math.round(a * 20);
    return arr[i] || (arr[i] = 'rgba(' + base + ',' + (i / 20) + ')');
  }
  const rgb = (c, a) => a == null
    ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
    : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';

  const COL = {
    space1: [4, 6, 16], space2: [16, 24, 52],
    iceTop: [222, 242, 252], iceMid: [118, 172, 207], iceBase: [30, 66, 100], iceDeep: [14, 40, 72],
    ocean1: [12, 44, 74], ocean2: [3, 10, 20],
    rock: [36, 29, 27], rockDeep: [16, 12, 11],
    chimL: [240, 233, 216], chimM: [214, 203, 180], chimD: [168, 155, 130],
    film1: [70, 222, 170], film2: [40, 170, 140],
    warm: [44, 30, 26]
  };
  // machinery palette (shared with the probe)
  const MC = { hi: '#dde6ef', mid: '#9fb3c8', lo: '#7f90a6', dk: '#4a5b70', ink: '#17293d', foil: '#e2b45a', foilD: '#a97e35', red: '#ff5d8f', cyan: '#5de4ff', hot: '#ff9d3c' };

  // ---------- precomputed decorations (in u units) ----------
  let stars = [], particles = [], glints = [], hydrogen = [];
  const CHIMNEYS = [
    { x: 0.10, w: 0.11, h: 0.50 },
    { x: 0.31, w: 0.13, h: 0.80 },
    { x: 0.635, w: 0.17, h: 1.0 },
    { x: 0.83, w: 0.12, h: 0.66 },
    { x: 0.97, w: 0.09, h: 0.40 }
  ];
  // distant chimneys (silhouettes behind the garden, no microbes drawn on them)
  const FAR = [];
  (function () {
    const r = rng(91);
    for (let i = 0; i < 24; i++) FAR.push({ x: (i + r() * 0.8) / 24, w: 0.06 + r() * 0.08, h: Math.min(1, 0.4 + r() * 0.7), far: i % 2 === 0 });
  })();

  function build(L) {
    const r = rng(7);
    stars = Array.from({ length: 200 }, () => ({ x: r(), u: r() * (L.surf - 0.02), b: 0.45 + r() * 0.55, p: r() * 6.28 }));
    particles = Array.from({ length: 320 }, () => ({ x: r(), u: L.ice + r() * (L.floor - L.ice), s: 0.2 + r(), p: r() * 6.28 }));
    glints = Array.from({ length: 70 }, () => ({ x: r(), u: L.surf + 0.05 + r() * (L.ice - L.surf - 0.1), p: r() * 6.28 }));
    // hydrogen (H2) specks rising from below, denser toward the garden
    const h0 = L.ice + (L.garden - L.ice) * 0.55;
    hydrogen = Array.from({ length: 150 }, () => ({ x: r(), u: h0 + Math.pow(r(), 0.45) * (L.floor - h0), s: 0.4 + r(), p: r() * 6.28 }));
  }

  // ---------- optional sprite library (js/sprites.js, Codex) ----------
  let spriteBroken = false;
  function libHas(name) {
    if (spriteBroken) return false;
    const S = window.Sprites;
    try { return !!(S && typeof S.draw === 'function' && S.list && S.list.indexOf(name) >= 0); } catch (e) { return false; }
  }
  function libSize(name) {
    try { const z = window.Sprites.size(name); return z && z.w > 0 && z.h > 0 ? z : null; } catch (e) { return null; }
  }
  function libDraw(name, frame, x, y, flip, g) {
    try { return window.Sprites.draw(g || ctx, name, frame, Math.round(x), Math.round(y), 1, !!flip) !== false; }
    catch (e) { spriteBroken = true; return false; }
  }
  // stamp n copies of a library sprite into a cache canvas (no-op if the sprite is missing)
  function stamp(g, name, n, place, r) {
    if (!libHas(name) || !libSize(name)) return;
    const z = libSize(name);
    for (let i = 0; i < n; i++) { const p = place(z); if (p) libDraw(name, 0, p[0], p[1], r() > 0.5, g); }
  }

  // ---------- built-in sprites (fallbacks) ----------
  const PROBE = [
    '..a..',
    '..a..',
    '.gWg.',
    '.WWW.',
    '.WRW.',
    '.WWW.',
    '.WKW.',
    '.WWW.',
    '.WRW.',
    'gWWWg',
    'gWWWg',
    '.WWW.',
    '..O..'
  ];
  const PCOL = { a: '#9fb3c8', g: '#7f90a6', W: '#dde6ef', R: '#ff5d8f', K: '#17293d', O: '#ff9d3c' };
  // Level 2 grazer: a single-celled ciliate (cilia are drawn separately, animated)
  const GRAZER = [
    '..ggg..',
    '.gGGGg.',
    'gGGnGGg',
    '.gGGGg.',
    '..ggg..'
  ];
  const GCOL = { g: '#ff9fb4', G: '#ff7f9f', n: '#ffe1e8' };
  // Level 3 Shadowfin: a tiny Loricifera-like animal: spiny head + plated, vase-shaped shell
  const PRED = [
    's.s........',
    '.shhnLlLlL.',
    'sshhnLlLlLL',
    '.shhnLlLlL.',
    's.s........'
  ];
  const PRCOL = { s: '#f2ecff', h: '#d6c8ff', n: '#9d88e0', L: '#b7a2ff', l: '#8f78db' };

  function sprite(map, cols, x, y, sc, flip) {
    const h = map.length, w = map[0].length;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = map[j][flip ? w - 1 - i : i];
      if (ch === '.') continue;
      ctx.fillStyle = cols[ch];
      ctx.fillRect(Math.round(x + i * sc), Math.round(y + j * sc), sc, sc);
    }
  }

  // ---------- public ----------
  function init(canvas) {
    cvs = canvas; ctx = cvs.getContext('2d');
    dark = document.createElement('canvas'); dctx = dark.getContext('2d');
  }
  function resize(w, h, L) {
    // Widgets fire 'resize' when their height changes; skip reallocating the canvases
    // (which clears them and costs a frame) unless the window size really changed.
    if (w === W && h === H && aw) { if (!stars.length) build(L); return; }
    W = w; H = h; PX = w < 700 ? 2 : 3;
    aw = Math.ceil(W / PX); ah = Math.ceil(H / PX);
    cvs.width = aw; cvs.height = ah; dark.width = aw; dark.height = ah;
    ctx.imageSmoothingEnabled = false;
    if (!stars.length) build(L);
  }

  // =====================================================================
  // Static scenery cache: one tall canvas in art pixels, world row 0 = page top.
  // =====================================================================
  let scen = null;
  // opt-in build timings for tests: set window.__wprof = {} and read it back
  const prof = (name, fn) => { const a = performance.now(), r = fn(); if (window.__wprof) window.__wprof[name] = Math.round(performance.now() - a); return r; };
  function scenery(L) {
    const key = aw + 'x' + H + 'x' + PX;
    if (scen && scen.key === key) return scen;
    const R = (u) => u * H / PX;                       // u -> world art row
    const rows = Math.ceil(R(L.floor + 0.7));
    const sRow = Math.floor(R(L.surf)), iRow = Math.floor(R(L.ice)), fRow = Math.floor(R(L.floor));
    const gTop = Math.max(iRow + 40, Math.floor(fRow - R(L.floor - L.garden)) - 8);
    // Sections are painted separately: the one under the camera at once, the rest in idle time,
    // so a resize or phone rotation never stalls on painting the whole 50 km at once.
    const secs = [
      { r0: 0, r1: sRow + 4, paint: (g) => paintSky(g, L, R, sRow) },
      { r0: sRow + 4, r1: iRow + 12, paint: (g) => paintIce(g, L, R, sRow, iRow) },
      { r0: iRow + 12, r1: gTop, paint: null },
      { r0: gTop, r1: rows, paint: (g) => paintGardenBack(g, L, R, fRow) }
    ];
    scen = { key, L, secs, rows, rock: prof('rock', rockTile), sRow, iRow, fRow, pat: null, fg: null, drift: null, profile: sonarProfile() };
    lampCone();                                       // build now, not mid-scroll
    scen.queue = [secs[0], secs[1], 'drift', secs[2], secs[3], 'chim', 'fg'];
    idleBuild();
    return scen;
  }
  function buildSection(sec) {
    if (sec.cv) return sec.cv;
    return prof('sec' + scen.secs.indexOf(sec), () => paintSection(sec));
  }
  function paintSection(sec) {
    const L = scen.L, cv = document.createElement('canvas');
    cv.width = aw; cv.height = Math.max(1, sec.r1 - sec.r0);
    const g = cv.getContext('2d');
    g.translate(0, -sec.r0);
    let last = '';
    for (let r = sec.r0; r < Math.min(sec.r1, scen.fRow); r++) {
      const u = r * PX / H;
      let c;
      if (u < L.surf) c = mix(COL.space1, COL.space2, q(u / L.surf, 9));
      else if (u < L.ice) {
        const k = (u - L.surf) / (L.ice - L.surf);
        c = k < 0.1 ? mix(COL.iceTop, COL.iceMid, q(k / 0.1, 6))
          : k < 0.75 ? mix(COL.iceMid, COL.iceBase, q((k - 0.1) / 0.65, 12))
          : mix(COL.iceBase, COL.iceDeep, q((k - 0.75) / 0.25, 5));
      } else {
        c = mix(COL.ocean1, COL.ocean2, q((u - L.ice) / (L.floor - L.ice), 14));
        const warm = Math.min(1, Math.max(0, (u - (L.garden - 1.6)) / 1.9));
        if (warm > 0) c = mix(c, COL.warm, q(warm, 8) * 0.38);
      }
      const st = rgb(c);
      if (st !== last) { g.fillStyle = st; last = st; }
      g.fillRect(0, r, aw, 1);
    }
    if (sec.r1 > scen.fRow) {                          // rock below the seafloor
      g.save(); g.translate(0, scen.fRow); g.fillStyle = g.createPattern(scen.rock, 'repeat');
      g.fillRect(0, Math.max(0, sec.r0 - scen.fRow), aw, sec.r1 - Math.max(sec.r0, scen.fRow)); g.restore();
    }
    if (sec.paint) sec.paint(g);
    sec.cv = cv;
    return cv;
  }
  const getDrift = (sc) => sc.drift || (sc.drift = prof('drift', () => driftLayers(sc.L, null, sc.iRow, sc.fRow)));
  const getFg = (sc) => sc.fg || (sc.fg = prof('fg', () => floorForeground(sc.L, null, sc.fRow)));
  function idleBuild() {
    const ric = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 400 }) : (f) => setTimeout(f, 50);
    const step = () => {
      const sc = scen; if (!sc || !sc.queue.length) return;
      const job = sc.queue.shift();
      if (job === 'drift') getDrift(sc); else if (job === 'fg') getFg(sc); else if (job === 'chim') buildChimneyCache(sc.L); else buildSection(job);
      if (sc.queue.length) ric(step);
    };
    ric(step);
  }

  // --- surface: faint star field, the Sun, Saturn, distant ridges, plume haze, crust, drill rig ---
  function paintSky(g, L, R, sRow) {
    const r = rng(11);
    for (let i = 0; i < 520; i++) {
      const x = Math.floor(r() * aw), y = Math.floor(r() * (sRow - 4)), b = r();
      g.fillStyle = b > 0.93 ? 'rgba(255,236,210,0.55)' : 'rgba(190,210,255,' + (0.12 + b * 0.25).toFixed(2) + ')';
      g.fillRect(x, y, 1, 1);
    }
    // a faint band of distant stars across the sky (dithered)
    for (let i = 0; i < 900; i++) {
      const x = r() * aw, y = sRow * (0.18 + 0.5 * (x / aw)) + (r() - 0.5) * sRow * 0.16;
      if (y < 0 || y > sRow - 6) continue;
      g.fillStyle = 'rgba(170,190,240,0.10)'; g.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    // the distant Sun
    const sx = Math.floor(0.09 * aw), sy = Math.floor(R(0.72));
    g.fillStyle = 'rgba(255,240,200,0.35)';
    g.fillRect(sx - 3, sy, 7, 1); g.fillRect(sx, sy - 3, 1, 7);
    g.fillStyle = '#fff6d8'; g.fillRect(sx - 1, sy - 1, 3, 3);
    drawSaturn(g, Math.floor(0.74 * aw), Math.floor(R(0.93)), Math.max(10, Math.floor(Math.min(aw, H / PX) * 0.085)));

    // plume haze over the south-pole cracks (the jets themselves animate per frame)
    for (const cx of [0.17, 0.9]) {
      const x0 = cx * aw, hgt = Math.floor(H * 0.55 / PX);
      for (let i = 0; i < 420; i++) {
        const k = Math.pow(r(), 0.7), y = sRow - k * hgt, spread = (r() - 0.5) * k * aw * 0.11;
        g.fillStyle = 'rgba(210,235,255,' + (0.16 * (1 - k)).toFixed(3) + ')';
        g.fillRect(Math.floor(x0 + spread), Math.floor(y), 1, 1);
      }
    }
    // distant ice ridges on the horizon (two tones = two distances)
    for (let pass = 0; pass < 2; pass++) {
      g.fillStyle = pass ? '#a9c6dc' : '#7f9bb8';
      for (let c = 0; c < aw; c++) {
        const hgt = pass
          ? 2 + Math.round(3 * (0.5 + 0.5 * Math.sin(c * 0.05 + 1)) + 2 * hash(c >> 2, 61))
          : 4 + Math.round(6 * Math.pow(0.5 + 0.5 * Math.sin(c * 0.021 + 2), 2) + 3 * hash(c >> 3, 63));
        g.fillRect(c, sRow - hgt - 1, 1, hgt);
      }
    }
    // crust
    for (let c = 0; c < aw; c++) {
      const bump = 1 + Math.floor(hash(c >> 1, 3) * 2) + (hash(c >> 3, 9) > 0.7 ? 2 : 0);
      g.fillStyle = '#f2fbff'; g.fillRect(c, sRow - bump, 1, bump);
      g.fillStyle = '#b8dcef'; g.fillRect(c, sRow, 1, 2);
    }
    // tiger-stripe cracks under the jets
    for (const cx of [0.17, 0.9]) {
      const x = Math.floor(cx * aw);
      g.fillStyle = '#3b6f95';
      for (let k = 0; k < 6; k++) g.fillRect(x - 2 + k, sRow + (k < 3 ? k : 5 - k), 1, 1);
    }
    if (!libHas('lander')) paintRig(g, Math.round(aw / 2), sRow);
  }

  // The surface lander + drill gantry the probe was lowered from (machinery only).
  function paintRig(g, cx, sy) {
    const P = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(cx + x, sy + y, w, h); };
    // melt hole
    P('#0b1d2e', -5, 0, 11, 2); P('#2d5778', -6, 0, 1, 1); P('#2d5778', 6, 0, 1, 1);
    // gantry: two posts with X-braces (the probe hangs between them)
    for (let i = 0; i <= 44; i++) {
      const o = Math.round(11 - 3 * (i / 44));
      P(MC.mid, -o, -i, 1, 1); P(MC.lo, o, -i, 1, 1);
    }
    for (let seg = 0; seg < 4; seg++) {
      const y0 = -4 - seg * 10;
      P(MC.lo, -10, y0, 21, 1);
      for (let k = 0; k < 9; k++) { P(MC.dk, -9 + k * 2, y0 - k, 1, 1); P(MC.dk, 9 - k * 2, y0 - k, 1, 1); }
    }
    P(MC.hi, -10, -45, 21, 2); P(MC.lo, -10, -43, 21, 1);           // crossbeam
    // cable winch on top
    P(MC.hi, -5, -51, 11, 6); P(MC.ink, -3, -50, 7, 4);
    P(MC.foil, -3, -49, 7, 1); P(MC.foil, -3, -47, 7, 1); P(MC.lo, -5, -46, 11, 1);
    P(MC.mid, 6, -50, 2, 3);                                          // motor
    // feet
    P(MC.hi, -14, -1, 5, 1); P(MC.hi, 10, -1, 5, 1);
    // lander body (left) in gold thermal foil, on legs
    P(MC.hi, -36, -17, 17, 1);
    P(MC.foil, -36, -16, 17, 9);
    for (let y = -15; y < -7; y += 3) P(MC.foilD, -36, y, 17, 1);
    P(MC.ink, -31, -14, 5, 3); P(MC.cyan, -30, -13, 1, 1);            // window
    P(MC.lo, -35, -7, 1, 7); P(MC.lo, -21, -7, 1, 7);
    P(MC.hi, -37, -1, 3, 1); P(MC.hi, -22, -1, 3, 1);
    // radiator fins of the power unit (left side of the lander)
    for (let k = 0; k < 6; k++) P(k % 2 ? MC.ink : MC.mid, -41, -15 + k, 5, 1);
    P(MC.hot, -39, -16, 1, 1);
    // walkway to the gantry, with the cable/power line
    P(MC.lo, -19, -10, 9, 1); P(MC.dk, -19, -9, 9, 1);
    // communications dish (right)
    P(MC.lo, 22, -18, 1, 18); P(MC.hi, 20, -1, 5, 1);
    for (let k = -6; k <= 6; k++) {
      const y = -24 + Math.round((k * k) / 7);
      P(k < 0 ? MC.hi : MC.mid, 22 + k, y, 1, 2);
    }
    P(MC.lo, 21, -21, 3, 3); P(MC.dk, 22, -27, 1, 6);                 // feed + horn
  }

  // --- ice shell: texture, layers, cracks, bubbles, brine pockets, rock grains, underside ---
  function paintIce(g, L, R, sRow, iRow) {
    const r = rng(23), span = iRow - sRow;
    const at = (k) => sRow + k * span;                // fraction of the shell -> row
    // fine texture: scattered lighter/darker pixels, a little denser deeper down
    {
      const tex = document.createElement('canvas'); tex.width = aw; tex.height = span;
      const id = new ImageData(aw, span), D = id.data;
      for (let i = 0; i < aw * span * 0.035; i++) {
        const y = Math.floor(3 + r() * (span - 3)), x = Math.floor(r() * aw), k = y / span, light = r() > 0.5, wide = r() > 0.9;
        for (let w = 0; w < (wide && x + 1 < aw ? 2 : 1); w++) {
          const j = (y * aw + x + w) * 4;
          if (light) { D[j] = 235; D[j + 1] = 250; D[j + 2] = 255; D[j + 3] = Math.round(255 * (0.18 - 0.1 * k)); }
          else { D[j] = 6; D[j + 1] = 24; D[j + 2] = 46; D[j + 3] = Math.round(255 * (0.16 + 0.1 * k)); }
        }
      }
      tex.getContext('2d').putImageData(id, 0, 0);
      g.drawImage(tex, 0, sRow);
    }
    // layers of ice: wavy bands with a pale top edge and a dark seam below
    for (let i = 0; i < 26; i++) {
      const y0 = at(0.03 + (i / 26) * 0.94 + (r() - 0.5) * 0.02), th = 2 + Math.floor(r() * 5), f = r() * 10;
      const a = 0.05 + r() * 0.08, dirty = r() > 0.72;
      const wv = new Int16Array(aw);
      for (let c = 0; c < aw; c++) wv[c] = Math.floor(y0 + Math.round(Math.sin(c * 0.03 + f) * 3 + Math.sin(c * 0.11 + f * 2) * 1.2));
      const runs = [];
      for (let c = 0; c < aw;) { let e = c + 1; while (e < aw && wv[e] === wv[c]) e++; runs.push(c, e - c, wv[c]); c = e; }
      const pass = (style, dy, hh) => { g.fillStyle = style; for (let k = 0; k < runs.length; k += 3) g.fillRect(runs[k], runs[k + 2] + dy, runs[k + 1], hh); };
      pass('rgba(215,240,255,' + (a * 1.6).toFixed(3) + ')', 0, 1);
      pass('rgba(200,232,255,' + a.toFixed(3) + ')', 1, th);
      pass(dirty ? 'rgba(40,30,28,0.22)' : 'rgba(8,30,56,0.16)', 1 + th, 1);
      // dust layers carry dark grains of rock
      if (dirty) for (let k = 0; k < aw * 0.25; k++) {
        const x = Math.floor(r() * aw), w = Math.round(Math.sin(x * 0.03 + f) * 3 + Math.sin(x * 0.11 + f * 2) * 1.2);
        g.fillStyle = r() > 0.5 ? '#3a2e29' : '#5a4a40';
        g.fillRect(x, Math.floor(y0 + w + 1 + r() * th), r() > 0.8 ? 2 : 1, 1);
      }
    }
    // loose rock grains everywhere
    for (let i = 0; i < span * aw * 0.0012; i++) {
      const x = Math.floor(r() * aw), y = Math.floor(sRow + 6 + r() * (span - 8));
      g.fillStyle = r() > 0.4 ? 'rgba(52,40,34,0.85)' : 'rgba(92,76,64,0.8)';
      g.fillRect(x, y, 1, 1); if (r() > 0.6) g.fillRect(x + 1, y, 1, 1);
    }
    // cracks: a dark line with a bright edge, with side branches
    const crack = (x, y, len, dx0, depth) => {
      for (let i = 0; i < len; i++) {
        x += dx0 + (r() - 0.5) * 1.6; y += 1;
        if (y >= iRow - 2) return;
        g.fillStyle = 'rgba(10,32,58,0.55)'; g.fillRect(Math.floor(x), y, 1, 1);
        g.fillStyle = 'rgba(225,248,255,0.28)'; g.fillRect(Math.floor(x) + 1, y, 1, 1);
        if (depth < 2 && r() > 0.965) crack(x, y, Math.floor(len * 0.4 * r()), (r() - 0.5) * 1.6, depth + 1);
      }
    };
    for (let i = 0; i < Math.max(18, Math.floor(aw / 14)); i++) crack(r() * aw, Math.floor(at(0.04 + r() * 0.9)), 18 + Math.floor(r() * 70), (r() - 0.5) * 0.8, 0);
    // trapped bubble clusters
    const bubble = (x, y, big) => {
      g.fillStyle = 'rgba(240,252,255,0.6)';
      if (big) { g.fillRect(x - 1, y - 2, 3, 1); g.fillRect(x - 1, y + 2, 3, 1); g.fillRect(x - 2, y - 1, 1, 3); g.fillRect(x + 2, y - 1, 1, 3); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(x - 1, y - 1, 1, 1); }
      else { g.fillRect(x, y - 1, 1, 1); g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y + 1, 1, 1); }
    };
    for (let i = 0; i < Math.max(40, Math.floor(span * aw / 3200)); i++) {
      const cx = r() * aw, cy = at(0.04 + r() * 0.85), n = 3 + Math.floor(r() * 9);
      for (let k = 0; k < n; k++) bubble(Math.round(cx + (r() - 0.5) * 16), Math.round(cy + (r() - 0.5) * 10), r() > 0.7);
    }
    // brine pockets: lenses of salty liquid water inside the ice
    for (let i = 0; i < Math.max(14, Math.floor(span * aw / 9000)); i++) {
      const cx = Math.round(r() * aw), cy = Math.round(at(0.2 + r() * 0.75)), rx = 3 + Math.floor(r() * 7), ry = 1 + Math.floor(r() * 3);
      for (let y = -ry; y <= ry; y++) {
        const hw = Math.round(rx * Math.sqrt(1 - (y * y) / ((ry + 0.5) * (ry + 0.5))));
        g.fillStyle = 'rgba(12,54,80,0.55)'; g.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
        g.fillStyle = 'rgba(190,236,250,0.4)'; g.fillRect(cx - hw, cy + y, 1, 1);
      }
      g.fillStyle = 'rgba(190,236,250,0.4)'; g.fillRect(cx - rx + 2, cy - ry - 1, rx * 2 - 3, 1);
      g.fillStyle = 'rgba(120,200,225,0.5)'; g.fillRect(cx - 1, cy, 2, 1);
    }
    const inIce = (z) => [r() * aw - z.w / 2, sRow + 8 + r() * (span - 16 - z.h)];
    ['crack1', 'crack2', 'crack3'].forEach((n) => stamp(g, n, Math.ceil(span * aw / 40000), inIce, r));
    stamp(g, 'bubbles', Math.ceil(span * aw / 26000), inIce, r);
    stamp(g, 'brinePocket', Math.ceil(span * aw / 50000), (z) => [r() * aw - z.w / 2, sRow + span * (0.3 + r() * 0.6)], r);
    stamp(g, 'grit', Math.ceil(span * aw / 40000), inIce, r);
    // underside of the ice shell: a jagged ceiling where ice meets ocean
    for (let c = 0; c < aw; c++) {
      const drip = Math.floor(hash(c >> 1, 41) * 3) + (hash(c >> 2, 43) > 0.82 ? 3 + Math.floor(hash(c, 47) * 4) : 0);
      g.fillStyle = rgb(COL.iceDeep); g.fillRect(c, iRow - 1, 1, drip + 1);
      if (hash(c, 49) > 0.7) { g.fillStyle = 'rgba(160,210,240,0.35)'; g.fillRect(c, iRow + drip, 1, 1); }
    }
    if (libHas('iceEdge1') && libHas('iceEdge2')) {
      for (let x = 0; x < aw; x += 16) if (hash(x, 55) > 0.35) libDraw(hash(x, 56) > 0.5 ? 'iceEdge1' : 'iceEdge2', 0, x, iRow - 2, hash(x, 57) > 0.5, g);
    }
  }

  // --- rock below the seafloor: strata, green serpentinite veins, white carbonate veins (tileable) ---
  function rockTile() {
    const th = 192, cv = document.createElement('canvas'); cv.width = aw; cv.height = th;
    const g = cv.getContext('2d'), r = rng(57);
    for (let y = 0; y < th; y++) {
      const k = 0.5 + 0.5 * Math.sin((y / th) * Math.PI * 2 * 3);
      g.fillStyle = rgb(mix(COL.rockDeep, COL.rock, 0.45 + 0.4 * q(k, 4))); g.fillRect(0, y, aw, 1);
    }
    for (let i = 0; i < aw * th * 0.05; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(70,58,52,0.6)' : 'rgba(8,6,6,0.5)';
      g.fillRect(Math.floor(r() * aw), Math.floor(r() * th), 1, 1);
    }
    // olive-green grains (olivine) and serpentine veins: the rock that makes hydrogen
    for (let i = 0; i < aw * th * 0.004; i++) { g.fillStyle = r() > 0.5 ? '#4d5a2e' : '#36452a'; g.fillRect(Math.floor(r() * aw), Math.floor(r() * th), 1, 1); }
    const vein = (col, n, step) => {
      for (let v = 0; v < n; v++) {
        let x = r() * aw, y = r() * th; const dir = (r() - 0.5) * 0.8;
        for (let k = 0; k < 40 + r() * 90; k++) {
          x = (x + 1 + aw) % aw; y = (y + dir + (r() - 0.5) * step + th) % th;
          g.fillStyle = col; g.fillRect(Math.floor(x), Math.floor(y), 1, 1);
        }
      }
    };
    vein('rgba(64,104,74,0.75)', Math.ceil(aw / 30), 1.6);
    vein('rgba(110,150,104,0.5)', Math.ceil(aw / 60), 1.2);
    vein('rgba(206,198,180,0.4)', Math.ceil(aw / 50), 2);
    return cv;
  }

  // --- garden backdrop: two rows of distant chimney silhouettes + the seafloor surface ---
  function paintGardenBack(g, L, R, fRow) {
    const span = (L.floor - L.garden) * H / PX;
    FAR.forEach((ch, i) => {
      const tone = ch.far ? mix(COL.ocean1, COL.chimD, 0.32) : mix(COL.ocean1, COL.chimD, 0.5);
      const hgt = Math.floor(ch.h * span * (ch.far ? 0.9 : 1.0)), cx = ch.x * aw, hw0 = ch.w * aw / 2 * (ch.far ? 0.8 : 1);
      const cBody = rgb(tone), cLit = rgb(mix(tone, COL.chimL, 0.25)), cShade = rgb(mix(tone, COL.ocean2, 0.3));
      let rl = null, rw = 0, ry = 0, rn = 0;
      const flushRun = () => {
        if (rl === null) return;
        const top = fRow + 2 - ry;               // ry = highest row of the run
        g.fillStyle = cBody; g.fillRect(rl, top, rw, rn);
        g.fillStyle = cLit; g.fillRect(rl, top, 1, rn);
        g.fillStyle = cShade; g.fillRect(rl + rw - 1, top, 1, rn);
      };
      for (let y = 0; y < hgt; y++) {
        const k = y / hgt;                               // 0 base -> 1 tip
        let hw = hw0 * (1 - 0.8 * Math.pow(k, 0.7)) * (1 + 0.2 * Math.sin(k * 14 * ch.h + i)) * (y < 6 ? 1.3 : 1);
        if (hash(Math.floor(y / 6), i + 300) > 0.8 && y % 6 < 1) hw *= 1.5;      // ledges
        const l = Math.round(cx - hw), w = Math.max(1, Math.round(hw * 2));
        if (l === rl && w === rw) { ry = y; rn++; } else { flushRun(); rl = l; rw = w; ry = y; rn = 1; }
      }
      flushRun();
    });
    // seafloor surface: rubble boulders and white carbonate ledges
    const r = rng(33);
    for (let i = 0; i < Math.floor(aw / 7); i++) boulder(g, r() * aw, fRow + 1 + r() * 3, 2 + r() * 6, r);
    for (let c = 0; c < aw; c++) {
      const bump = Math.floor(hash(c >> 2, 21) * 4) + (hash(c >> 4, 5) > 0.75 ? 2 : 0);
      g.fillStyle = rgb(COL.rock); g.fillRect(c, fRow - bump, 1, bump + 1);
      if (hash(c, 77) > 0.8) { g.fillStyle = '#4a3f39'; g.fillRect(c, fRow - bump, 1, 1); }
    }
    CHIMNEYS.forEach((ch, i) => { for (let k = 0; k < 3; k++) ledge(g, ch.x * aw + (k - 1) * ch.w * aw * 0.7 + (r() - 0.5) * 6, fRow - 1 - k * 2 - Math.floor(r() * 2), 6 + r() * ch.w * aw * 0.5); });
    for (let i = 0; i < Math.floor(aw / 14); i++) crystals(g, r() * aw, fRow - Math.floor(r() * 4), r);
    stamp(g, 'chimney1', Math.ceil(aw / 60), (z) => [r() * aw - z.w / 2, fRow + 2 - z.h], r);
    stamp(g, 'chimney2', Math.ceil(aw / 70), (z) => [r() * aw - z.w / 2, fRow + 2 - z.h], r);
    ['rock1', 'rock2', 'rock3'].forEach((n) => stamp(g, n, Math.ceil(aw / 90), (z) => [r() * aw - z.w / 2, fRow + 3 - z.h], r));
    stamp(g, 'ledge', Math.ceil(aw / 110), (z) => [r() * aw - z.w / 2, fRow + 1 - z.h], r);
    stamp(g, 'crystalCluster', Math.ceil(aw / 80), (z) => [r() * aw - z.w / 2, fRow + 2 - z.h], r);
  }
  function boulder(g, cx, cy, rad, r) {
    const ry = rad * 0.7;
    for (let y = -Math.ceil(ry); y <= 0; y++) {
      const hw = Math.round(rad * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      g.fillStyle = y === -Math.ceil(ry) ? '#5a4c44' : (y < -ry * 0.4 ? '#463a34' : '#2c2421');
      g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
    g.fillStyle = '#6a5a50'; g.fillRect(Math.round(cx - rad * 0.4), Math.round(cy - ry * 0.7), 2, 1);
  }
  function ledge(g, cx, y, w) {
    const l = Math.round(cx - w / 2), wi = Math.round(w);
    g.fillStyle = rgb(COL.chimL); g.fillRect(l, y, wi, 1);
    g.fillStyle = rgb(COL.chimM); g.fillRect(l, y + 1, wi, 1);
    g.fillStyle = rgb(COL.chimD); g.fillRect(l + 1, y + 2, wi - 2, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(l + 2, y + 3, wi - 4, 1);
  }
  function crystals(g, cx, y, r) {
    const n = 3 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const x = Math.round(cx + (k - n / 2) * 1.5 + (r() - 0.5)), h = 2 + Math.floor(r() * 5);
      g.fillStyle = '#9fc4cf'; g.fillRect(x, y - h + 1, 1, h);
      g.fillStyle = '#eaf7fb'; g.fillRect(x, y - h, 1, 1);
    }
  }
  // a few boulders/crystals IN FRONT of the chimney bases (drawn after the chimneys)
  function floorForeground(L, R, fRow) {
    const top = 14, cv = document.createElement('canvas'); cv.width = aw; cv.height = top + 6;
    const g = cv.getContext('2d'), r = rng(44);
    g.translate(0, top - fRow);
    for (let i = 0; i < Math.floor(aw / 22); i++) boulder(g, r() * aw, fRow + 3, 2 + r() * 4, r);
    for (let i = 0; i < Math.floor(aw / 30); i++) crystals(g, r() * aw, fRow + 1, r);
    return { cv, row0: fRow - top };
  }

  // --- ocean drift layers (scroll sideways = slow currents); tileable horizontally ---
  function driftLayers(L, R, iRow, fRow) {
    const rows = fRow - iRow, r = rng(71);
    const mk = () => { const c = document.createElement('canvas'); c.width = aw; c.height = rows; return c; };
    const haze = mk(), streak = mk();
    // written straight into pixel buffers: far faster than tens of thousands of fillRects
    const hd = new ImageData(aw, rows), sd = new ImageData(aw, rows), H8 = hd.data, S8 = sd.data;
    const put = (D, x, y, cr, cg, cb, a) => {
      if (y < 0 || y >= rows) return;
      const i = (y * aw + ((x % aw) + aw) % aw) * 4;
      if (a > D[i + 3]) { D[i] = cr; D[i + 1] = cg; D[i + 2] = cb; D[i + 3] = a; }
    };
    // layers of fine sediment hanging in the water
    for (let b = 0; b < 34; b++) {
      const y0 = r() * rows, th = 8 + r() * 30, ph = r() * 6.28, n = 1 + Math.floor(r() * 3), dens = 0.05 + r() * 0.08;
      for (let x = 0; x < aw; x++) {
        const t = th * (0.55 + 0.45 * Math.sin((x / aw) * Math.PI * 2 * n + ph));
        const cnt = Math.floor(t * dens + r());
        for (let k = 0; k < cnt; k++) {
          const f = (r() + r()) / 2, edge = 1 - Math.abs(f - 0.5) * 2;
          put(H8, x, Math.floor(y0 + f * t - t / 2), 150, 196, 220, Math.round(255 * (0.10 + 0.14 * edge)));
        }
      }
    }
    // current streaks
    for (let i = 0; i < Math.floor(rows * aw / 900); i++) {
      const y = Math.floor(r() * rows), x = Math.floor(r() * aw), len = 6 + Math.floor(r() * 22), a = Math.round(255 * (0.10 + r() * 0.12));
      for (let k = 0; k < len; k++) put(S8, x + k, y, 140, 205, 235, a);
    }
    haze.getContext('2d').putImageData(hd, 0, 0); streak.getContext('2d').putImageData(sd, 0, 0);
    return { haze, streak, row0: iRow };
  }

  // --- what sonar "sees" of the seafloor: a height (art px) per column ---
  function sonarProfile() {
    const p = new Float32Array(aw);
    for (let x = 0; x < aw; x++) p[x] = 2 + 3 * hash(x >> 2, 501) + 2 * Math.sin(x * 0.04);
    const add = (cx, hw, h) => { for (let x = Math.max(0, Math.floor(cx - hw)); x < Math.min(aw, Math.ceil(cx + hw)); x++) p[x] = Math.max(p[x], h * (1 - Math.abs(x - cx) / hw)); };
    FAR.forEach((c) => add(c.x * aw, Math.max(2, c.w * aw * 0.8), 8 + c.h * 16));
    CHIMNEYS.forEach((c) => add(c.x * aw, c.w * aw * 0.7, 10 + c.h * 26));
    return p;
  }

  // ---------- lamp cone (pre-drawn once per size; added with 'lighter') ----------
  let cone = null;
  function lampCone() {
    const len = Math.round(ah * 0.5), key = aw + 'x' + ah;
    if (cone && cone.key === key) return cone;
    const half = Math.ceil(len * 0.5), cv = document.createElement('canvas');
    cv.width = half * 2 + 1; cv.height = len;
    const g = cv.getContext('2d');
    for (let y = 0; y < len; y++) {
      const f = y / len, hw = Math.round(2 + y * 0.46);
      const a = Math.round(0.13 * Math.pow(1 - f, 1.4) * 40) / 40;     // stepped = pixel look
      if (a <= 0) continue;
      g.fillStyle = 'rgba(255,236,190,' + a.toFixed(3) + ')'; g.fillRect(half - hw, y, hw * 2 + 1, 1);
      g.fillStyle = 'rgba(255,236,190,' + (a * 0.5).toFixed(3) + ')'; g.fillRect(half - hw - 2, y, 2, 1); g.fillRect(half + hw + 1, y, 2, 1);
    }
    cone = { key, cv, half, len };
    return cone;
  }

  // s = { cam, t, probeY, depth, L, dOfU, uOf, creatures, lampOn }
  function draw(s) {
    if (!aw || !ah || !H) return;
    hits = [];
    const L = s.L, cam = s.cam, t = s.t;
    const u0 = cam / H;
    const toAy = (u) => (u * H - cam) / PX;        // u -> art row on screen
    const uAt = (ay) => (cam + ay * PX) / H;       // art row -> u
    const camRow = Math.round(cam / PX);           // world art row at the top of the screen
    const sc0 = scenery(L);

    // ---- static scenery slice (+ repeating rock below its end) ----
    for (const sec of sc0.secs) {
      const a = Math.max(sec.r0, camRow), b = Math.min(sec.r1, camRow + ah);
      if (b <= a) continue;
      ctx.drawImage(buildSection(sec), 0, a - sec.r0, aw, b - a, 0, a - camRow, aw, b - a);
    }
    if (camRow + ah > sc0.rows) {
      const y = Math.max(0, sc0.rows - camRow);
      if (!sc0.pat) sc0.pat = ctx.createPattern(sc0.rock, 'repeat');
      ctx.save(); ctx.translate(0, sc0.fRow - camRow);       // same pattern origin as inside the cache
      ctx.fillStyle = sc0.pat;
      ctx.fillRect(0, camRow + y - sc0.fRow, aw, ah - y);
      ctx.restore();
    }

    // ---- sky: twinkling stars and the jets ----
    const sAy = toAy(L.surf);
    if (u0 < L.surf) {
      for (const st of stars) {
        const ay = toAy(st.u); if (ay < 0 || ay > ah) continue;
        const a = st.b * (0.65 + 0.35 * Math.sin(t * 1.3 + st.p));
        ctx.fillStyle = rgba('220,235,255', a);
        ctx.fillRect(Math.floor(st.x * aw), Math.floor(ay), 1, 1);
      }
    }
    if (sAy > -40 && sAy - H * 0.55 / PX < ah) {
      for (const cx of [0.17, 0.9]) {
        const x = Math.floor(cx * aw);
        for (let k = 0; k < 70; k++) {
          const ph = ((t * 0.18 + k / 70) % 1);
          const spread = (hash(k, cx * 100) - 0.5) * ph * aw * 0.09;
          const y = sAy - ph * H * 0.55 / PX;
          ctx.fillStyle = rgba('225,245,255', 0.85 * (1 - ph));
          ctx.fillRect(Math.floor(x + spread), Math.floor(y), 1, 1);
        }
        if (libHas('plume')) {
          const z = libSize('plume');
          if (z) libDraw('plume', Math.floor(t * 4 + cx * 10) % (z.frames || 1), x - z.w / 2, Math.round(sAy) - z.h + 1, cx > 0.5);
        }
      }
      if (libHas('lander')) {
        const z = libSize('lander');
        if (z) libDraw('lander', Math.floor(t * 4) % (z.frames || 1), aw / 2 - z.w / 2, sAy - z.h, false);
      } else {
        // rig lights: red beacon on the winch, green status light on the lander
        const on = s.reduced || Math.floor(t * 1.5) % 2 === 0;
        ctx.fillStyle = on ? MC.red : '#5a2234'; ctx.fillRect(Math.round(aw / 2), Math.round(sAy) - 53, 1, 2);
        ctx.fillStyle = (s.reduced || Math.floor(t * 0.8 + 0.5) % 2 === 0) ? '#4fe0a6' : '#1d4a3a';
        ctx.fillRect(Math.round(aw / 2) - 22, Math.round(sAy) - 18, 1, 1);
      }
    }

    // ---- ice: glints near the lamp ----
    if (u0 + 1 > L.surf && u0 < L.ice) {
      for (const gl of glints) {
        const ay = toAy(gl.u); if (ay < 0 || ay > ah) continue;
        const k = Math.sin(t * 2.2 + gl.p);
        if (k < 0.85) continue;
        const gx = Math.floor(gl.x * aw), gy = Math.floor(ay);
        ctx.fillStyle = rgba('240,252,255', (k - 0.85) * 5);
        ctx.fillRect(gx, gy, 1, 1); ctx.fillRect(gx - 1, gy, 3, 1); ctx.fillRect(gx, gy - 1, 1, 3);
      }
    }

    // ---- ocean particles (dim, behind the darkness) ----
    const inOcean = u0 + 1 > L.ice && u0 < L.floor + 0.2;
    if (inOcean) {
      ctx.fillStyle = 'rgba(150,200,230,0.3)';
      for (const p of particles) {
        let u = p.u - ((t * 0.004 * p.s) % 0.5);
        if (u < L.ice) u += 0.5;
        const ay = toAy(u); if (ay < 0 || ay > ah) continue;
        ctx.fillRect(Math.floor((p.x + Math.sin(t * 0.3 * p.s + p.p) * 0.004) * aw), Math.floor(ay), 1, 1);
      }
    }

    // ---- hydrogen garden ----
    if (u0 + 1 > L.garden - 0.3) {
      drawGarden(s, toAy, uAt);
      const fg = getFg(sc0), fy = Math.round(fg.row0 - camRow);
      if (fy < ah && fy + fg.cv.height > 0) ctx.drawImage(fg.cv, 0, fy);
    }

    // ---- probe geometry ----
    let pw, ph, useLibProbe = libHas('probe'), pz = null;
    if (useLibProbe) { pz = libSize('probe'); if (!pz) useLibProbe = false; }
    const sc = 2;
    if (useLibProbe) { pw = pz.w; ph = pz.h; } else { pw = PROBE[0].length * sc; ph = PROBE.length * sc; }
    const px = Math.round(aw / 2 - pw / 2);
    const pyBottom = s.probeY / PX;
    const pyTop = pyBottom - ph;

    // ---- darkness + probe lamp ----
    // 0 -> 1 over 1.6 s after arriving in the garden (eased), used by the floodlight reveal
    const rev = s.revealT >= 0 ? 1 - Math.pow(1 - Math.min(1, s.revealT / 1.6), 3) : 0;
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, aw, ah);
    let lastA = -1, runStart = 0;
    const flush = (r) => { if (lastA > 0) { dctx.fillStyle = 'rgba(0,3,9,' + lastA.toFixed(3) + ')'; dctx.fillRect(0, runStart, aw, r - runStart); } };
    for (let r = 0; r < ah; r++) {
      const d = s.dOfU(uAt(r));
      let a;
      if (d <= 0) a = 0;
      else if (d < 12) a = 0.5 * (d / 12);
      else if (d < s.iceM) a = 0.5 + 0.15 * (d / s.iceM);
      else {
        // the ocean gets darker the deeper you go, then the vents lift it a little
        const g = s.gardenM || (s.iceM * 2.5);
        const k = Math.min(1, (d - s.iceM) / (g - s.iceM));
        a = 0.62 + 0.2 * k;
        if (d > g - 1) a -= 0.12 * Math.min(1, (d - g + 1) / 30);
        if (rev > 0 && d > g - 40) a -= 0.28 * rev;      // floodlights on: the garden lights up
      }
      a = Math.round(a * 200) / 200;                       // merge rows with the same darkness
      if (a !== lastA) { flush(r); lastA = a; runStart = r; }
    }
    flush(ah);
    if (s.depth > 2) {
      const lx = aw / 2, ly = pyBottom + 8;
      const Rr = Math.min(aw, ah) * 0.42 * (1 + 0.7 * rev);
      const g = dctx.createRadialGradient(lx, ly, 2, lx, ly, Rr);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.globalCompositeOperation = 'destination-out';
      dctx.fillStyle = g;
      dctx.fillRect(0, 0, aw, ah);
    }
    ctx.drawImage(dark, 0, 0);
    // floodlit chimneys: redraw the cached chimneys faintly above the darkness so they stand out
    if (rev > 0 && chimCache && u0 + 1 > L.garden - 0.3) {
      const y0 = Math.round(toAy(chimCache.u0));
      ctx.globalAlpha = 0.42 * rev; ctx.drawImage(chimCache.body, 0, y0);
      ctx.globalAlpha = 0.5 * rev * (0.75 + 0.25 * Math.sin(t * 1.7)); ctx.drawImage(chimCache.mats, 0, y0);
      ctx.globalAlpha = 1;
    }
    if (inOcean) drawWater(s, sc0, camRow, toAy, pyBottom);
    drawOverlays(s, toAy, px + pw / 2, pyBottom, sc0);
    if (u0 + 1 > L.garden - 0.3) drawCreatures(s, toAy);

    if (s.scan) drawScan(s.scan);

    // ---- melt channel, tether + probe on top ----
    if (s.depth > 0.5) drawChannel(s, toAy, px, pw, pyTop, camRow, sAy);
    const bob = s.depth > 20000 ? Math.round(Math.sin(t * 1.6)) : 0;
    if (useLibProbe) useLibProbe = libDraw('probe', Math.floor(t * 6) % (pz.frames || 1), px, pyTop + bob, false);
    if (!useLibProbe) sprite(PROBE, PCOL, px, pyTop + bob, sc, false);
    if (s.depth > 0.5 && s.depth < s.iceM) {   // hot nose melting the ice
      ctx.fillStyle = 'rgba(255,157,60,' + (0.35 + 0.25 * Math.sin(t * 8)).toFixed(2) + ')';
      ctx.fillRect(px, Math.round(pyBottom + bob), pw, 2);
    }
    if (s.depth > 2) {                           // lamp
      ctx.fillStyle = 'rgba(255,248,210,0.9)';
      ctx.fillRect(Math.round(aw / 2) - 1, Math.round(pyBottom + bob - 1), 2, 1);
    }
  }

  // The melt channel (refrozen water above the probe, liquid right behind it) and the cable.
  function drawChannel(s, toAy, px, pw, pyTop, camRow, sAy) {
    const L = s.L;
    const top = Math.max(0, Math.floor(sAy) + 2);
    const iceBot = Math.min(Math.floor(pyTop), Math.floor(toAy(L.ice)), ah);
    if (iceBot > top) {
      ctx.fillStyle = 'rgba(205,238,255,0.06)'; ctx.fillRect(px + 2, top, pw - 4, iceBot - top);
      ctx.fillStyle = 'rgba(235,250,255,0.22)'; ctx.fillRect(px + 1, top, 1, iceBot - top); ctx.fillRect(px + pw - 2, top, 1, iceBot - top);
      ctx.fillStyle = 'rgba(245,252,255,0.55)';   // bubbles trapped as the meltwater refroze
      for (let r = top; r < iceBot; r++) {
        const wr = r + camRow;
        if (hash(wr, 911) > 0.9) ctx.fillRect(px + 1 + Math.floor(hash(wr, 912) * (pw - 2)), r, 1, 1);
      }
      // fresh meltwater right behind the probe, still liquid and bright
      if (iceBot === Math.floor(pyTop) && s.depth < s.iceM) {
        const len = Math.min(iceBot - top, Math.round(ah * 0.14));
        const gr = ctx.createLinearGradient(0, iceBot - len, 0, iceBot);
        gr.addColorStop(0, 'rgba(230,248,255,0)'); gr.addColorStop(1, 'rgba(230,248,255,0.3)');
        ctx.fillStyle = gr; ctx.fillRect(px + 2, iceBot - len, pw - 4, len);
      }
    }
    // cable from the winch to the probe, with clamps every few metres
    const lz = libHas('lander') && libSize('lander');
    const cTop = Math.max(0, Math.round(sAy) - (lz ? lz.h - 2 : 44)), cBot = Math.floor(pyTop);
    if (cBot > cTop) {
      const cx = Math.round(aw / 2);
      ctx.fillStyle = 'rgba(200,218,236,0.85)'; ctx.fillRect(cx, cTop, 1, cBot - cTop);
      ctx.fillStyle = 'rgba(255,214,140,0.8)';
      for (let r = cTop + ((48 - ((cTop + camRow) % 48)) % 48); r < cBot; r += 48) ctx.fillRect(cx - 1, r, 3, 1);
    }
  }

  // Probe scan (app.js): a dashed beam from the probe's nose to the feature (first 250 ms),
  // then pixel corner brackets that snap in around it and stay while the callout is open.
  // sc = { bx, by (CSS px, probe nose), rect {x,y,w,h} (CSS px), age (s), alpha, reduced }
  function drawScan(sc) {
    const x0 = Math.round(sc.bx / PX), y0 = Math.round(sc.by / PX), r = sc.rect;
    const rx = Math.round(r.x / PX), ry = Math.round(r.y / PX), rw = Math.max(1, Math.round(r.w / PX)), rh = Math.max(1, Math.round(r.h / PX));
    const tx = Math.max(rx, Math.min(x0, rx + rw)), ty = Math.max(ry, Math.min(y0, ry + rh));
    const age = sc.age;
    if (!sc.reduced && age < 0.5) {
      const p = Math.min(1, age / 0.25), fade = age < 0.25 ? 1 : 1 - (age - 0.25) / 0.25;
      const n = Math.max(1, Math.round(Math.hypot(tx - x0, ty - y0))), m = Math.round(n * p);
      ctx.fillStyle = rgba('93,228,255', 0.9 * fade * sc.alpha);
      for (let i = 0; i <= m; i++) if (i % 3 !== 2) ctx.fillRect(Math.round(x0 + (tx - x0) * i / n), Math.round(y0 + (ty - y0) * i / n), 1, 1);
      if (p < 1) {                                     // bright head of the beam
        ctx.fillStyle = '#e8fbff';
        ctx.fillRect(Math.round(x0 + (tx - x0) * m / n) - 1, Math.round(y0 + (ty - y0) * m / n) - 1, 3, 3);
      }
    }
    const ba = sc.reduced ? 1 : age - 0.25;
    if (ba < 0) return;
    const snap = sc.reduced ? 0 : Math.max(0, 4 - Math.floor(ba / 0.025));   // 4 px out -> 0 in 100 ms
    const pad = 2 + snap, Lc = 4;
    const x1 = rx - pad, y1 = ry - pad, x2 = rx + rw + pad - 1, y2 = ry + rh + pad - 1;
    ctx.fillStyle = rgba('93,228,255', sc.alpha);
    ctx.fillRect(x1, y1, Lc, 1); ctx.fillRect(x1, y1, 1, Lc);
    ctx.fillRect(x2 - Lc + 1, y1, Lc, 1); ctx.fillRect(x2, y1, 1, Lc);
    ctx.fillRect(x1, y2, Lc, 1); ctx.fillRect(x1, y2 - Lc + 1, 1, Lc);
    ctx.fillRect(x2 - Lc + 1, y2, Lc, 1); ctx.fillRect(x2, y2 - Lc + 1, 1, Lc);
  }

  // Open-water life of the scene (no organisms): drifting sediment, currents, lamp, lit particles.
  function drawWater(s, sc0, camRow, toAy, pyBottom) {
    const L = s.L, t = s.t, dr = getDrift(sc0);
    const y0 = Math.max(0, camRow - dr.row0), dy = y0 + dr.row0 - camRow;
    const h = Math.min(ah - dy, dr.haze.height - y0);
    if (h > 0) {
      const lay = (cv, speed, alpha) => {
        const o = Math.floor((t * speed) % aw);
        ctx.globalAlpha = alpha;
        ctx.drawImage(cv, 0, y0, aw, h, o, dy, aw, h);
        ctx.drawImage(cv, 0, y0, aw, h, o - aw, dy, aw, h);
      };
      // fade the layers out toward the warm garden so the vents own that space
      const k = clamp01((L.garden - 0.2 - (camRow * PX / H)) / 1.2);
      if (k > 0.05) { lay(dr.haze, 1.2, 0.15 + 0.85 * k); lay(dr.streak, 3.5, 0.3 + 0.6 * k); }
      ctx.globalAlpha = 1;
    }
    // the probe's lamp: a cone of light below it in open water, lighting up particles
    if (s.depth > s.iceM + 50) {
      const c = lampCone(), lx = Math.round(aw / 2), ly = Math.round(pyBottom + 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(c.cv, lx - c.half, ly);
      ctx.globalCompositeOperation = 'source-over';
      for (const p of particles) {
        let u = p.u - ((t * 0.004 * p.s) % 0.5);
        if (u < L.ice) u += 0.5;
        const ay = toAy(u), d = ay - ly;
        if (d < 2 || d > c.len) continue;
        const x = (p.x + Math.sin(t * 0.3 * p.s + p.p) * 0.004) * aw;
        if (Math.abs(x - lx) > 2 + d * 0.46) continue;
        ctx.fillStyle = rgba('255,244,214', 0.25 + 0.65 * (1 - d / c.len));
        ctx.fillRect(Math.floor(x), Math.floor(ay), p.s > 0.9 ? 2 : 1, 1);
      }
    }
  }

  // Things drawn above the darkness so they read in the deep: H2 specks, sonar,
  // depth checkpoint lines and the splash when the probe breaks out of the ice.
  function drawOverlays(s, toAy, cx, cy, sc0) {
    const L = s.L, t = s.t, d = s.depth;
    const u0 = s.cam / H;

    // parallax: a far layer drifts slower than the scene, a near layer faster
    if (u0 + 1 > L.surf && !s.reduced) {
      const inIce = u0 + 0.5 < L.ice;
      const farShift = (s.cam / PX) * 0.45, nearShift = (s.cam / PX) * 1.5;
      const sTop = toAy(L.surf) + 3;                 // never over the sky
      for (let i = 0; i < 70; i++) {
        const y = ((hash(i, 301) * ah * 3 - farShift) % ah + ah) % ah;
        if (y < sTop) continue;
        ctx.fillStyle = inIce ? 'rgba(220,240,255,0.16)' : 'rgba(120,180,220,0.14)';
        ctx.fillRect(Math.floor(hash(i, 302) * aw), Math.floor(y), 1, 1);
      }
      for (let i = 0; i < 22; i++) {
        const y = ((hash(i, 401) * ah * 3 - nearShift) % ah + ah) % ah;
        if (y < sTop) continue;
        ctx.fillStyle = inIce ? 'rgba(235,250,255,0.22)' : 'rgba(150,205,235,0.2)';
        ctx.fillRect(Math.floor(hash(i, 402) * aw), Math.floor(y), 2, 2);
      }
    }

    // warm vent glow rising from the floor as the garden comes into view
    const fAy = toAy(L.floor);
    const glowTop = toAy(L.garden - 1.4);
    if (glowTop < ah && fAy > 0) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 1.3);
      const gr = ctx.createLinearGradient(0, glowTop, 0, fAy);
      gr.addColorStop(0, 'rgba(255,154,61,0)');
      gr.addColorStop(0.75, 'rgba(255,140,60,' + (0.045 * pulse).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(255,170,90,' + (0.11 * pulse).toFixed(3) + ')');
      ctx.fillStyle = gr;
      ctx.fillRect(0, Math.max(0, glowTop), aw, Math.min(ah, fAy) - Math.max(0, glowTop));
    }

    // hydrogen specks (cyan pairs, like the microscope's H2), rising slowly
    if (s.cam / H + 1 > L.ice) {
      for (const h of hydrogen) {
        let u = h.u - ((t * 0.006 * h.s) % 0.6);
        if (u < h.u - 0.6) u += 0.6;
        const ay = toAy(u); if (ay < 0 || ay > ah) continue;
        const near = Math.min(1, Math.max(0, (u - (L.garden - 1.4)) / 1.4));   // fade in toward the garden
        if (near <= 0) continue;
        const x = Math.floor((h.x + Math.sin(t * 0.5 * h.s + h.p) * 0.006) * aw);
        ctx.fillStyle = rgba('93,228,255', 0.25 + 0.55 * near);
        ctx.fillRect(x, Math.floor(ay), 1, 1); ctx.fillRect(x + 1, Math.floor(ay), 1, 1);
      }
    }

    // depth checkpoint lines every 10 km (dashed, with a gap around the probe)
    if (s.uOfD) {
      for (let km = 10; km <= 40; km += 10) {
        const ay = toAy(s.uOfD(km * 1000)); if (ay < 0 || ay > ah) continue;
        const passed = d >= km * 1000;
        ctx.fillStyle = passed ? 'rgba(79,224,166,0.45)' : 'rgba(93,228,255,0.3)';
        for (let c = 0; c < aw; c += 6) {
          if (Math.abs(c - cx) < 14) continue;
          ctx.fillRect(c, Math.floor(ay), 3, 1);
        }
      }
    }

    // sonar: rings from the probe in the open ocean
    const g = s.gardenM || Infinity;
    if (d > s.iceM + 300 && d < g) {
      const period = 2.8;
      for (let k = 0; k < 2; k++) {
        const ph = ((t / period) + k * 0.5) % 1;
        const r = 6 + ph * Math.min(aw, ah) * 0.38;
        const a = 0.5 * (1 - ph);
        ctx.fillStyle = 'rgba(93,228,255,' + a.toFixed(3) + ')';
        const n = Math.round(r * 2.2);
        for (let i = 0; i < n; i++) {
          if (i % 3 === 2) continue;                       // dashed ring
          const ang = (i / n) * Math.PI * 2;
          ctx.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.8), 1, 1);
        }
      }
      // the echo: after each ping, the shape of the seafloor far below flashes up at the
      // bottom of the screen, rising and growing as the probe gets closer
      const near = clamp01((d - 25000) / (g - 25000));
      if (near > 0) {
        const ph = (t / period) % 1;
        const a = s.reduced ? 0.3 : (ph > 0.4 ? 0.6 * (1 - (ph - 0.4) / 0.6) : 0);
        if (a > 0.02) {
          const base = Math.round(ah * (0.985 - 0.17 * near)), amp = 0.5 + 0.7 * near, prof = sc0.profile;
          ctx.fillStyle = 'rgba(93,228,255,' + (a * (0.45 + 0.55 * near)).toFixed(3) + ')';
          for (let x = 0; x < aw; x += 2) ctx.fillRect(x, Math.round(base - prof[x] * amp), 1, 1);
          ctx.fillStyle = 'rgba(93,228,255,' + (a * 0.18).toFixed(3) + ')';
          for (let x = 1; x < aw; x += 4) ctx.fillRect(x, Math.round(base - prof[x] * amp) + 2, 1, 1);
        }
      }
    }

    // splash of bubbles just after breaking through the ice into the ocean
    const since = d - s.iceM;
    if (since > 0 && since < 2500) {
      const k = 1 - since / 2500;
      for (let i = 0; i < 26; i++) {
        const life = (t * 0.9 + i * 0.137) % 1;
        const bx = cx + (hash(i, 5) - 0.5) * 34 + Math.sin(t * 3 + i) * 1.5;
        const by = cy + 6 - life * 46;
        ctx.fillStyle = rgba('220,245,255', 0.8 * k * (1 - life));
        if (i % 3) ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
        else { ctx.fillRect(Math.round(bx) - 1, Math.round(by), 3, 1); ctx.fillRect(Math.round(bx), Math.round(by) - 1, 1, 3); }
      }
    }
  }

  function drawSaturn(g, cx, cy, r) {
    const rx = r * 2.25, ry = r * 0.55, inner = 0.62;
    const ring = (front) => {
      for (let y = Math.floor(-ry); y <= ry; y++) {
        if (front ? y < 0 : y >= 0) continue;
        for (let x = Math.floor(-rx); x <= rx; x++) {
          const e = (x * x) / (rx * rx) + (y * y) / (ry * ry);
          if (e > 1 || e < inner * inner) continue;
          g.fillStyle = e > 0.83 ? '#cdb489' : (e > 0.6 ? '#a8916b' : '#e6d3a8');
          g.fillRect(cx + x, Math.floor(cy + y - x * 0.18), 1, 1);
        }
      }
    };
    ring(false);
    const cols = ['#f0dcae', '#e2c48f', '#d9b67d', '#e8cf9c', '#cfa86c', '#c49a5e', '#a9824d'];
    for (let y = -r; y <= r; y++) {
      const c = cols[Math.floor(((y + r) / (2 * r)) * 7)] || cols[6];
      let runC = null, runX = 0;
      for (let x = -r; x <= r + 1; x++) {
        let cc = null;
        if (x <= r && x * x + y * y <= r * r) cc = (x > r * 0.45 && x * x + y * y > r * r * 0.5) ? '#8e6c40' : c;
        if (cc !== runC) {
          if (runC) { g.fillStyle = runC; g.fillRect(cx + runX, Math.floor(cy + y), x - runX, 1); }
          runC = cc; runX = x;
        }
      }
    }
    ring(true);
  }

  function drawGarden(s, toAy, uAt) {
    const L = s.L, t = s.t;
    // Chimney bodies and microbe mats are static, so they come from a cache drawn once per
    // layout (see buildChimneyCache); the mats "breathe" by pulsing the whole layer's alpha.
    const cache = buildChimneyCache(L);
    const y0 = Math.round(toAy(cache.u0));
    ctx.drawImage(cache.body, 0, y0);
    ctx.globalAlpha = 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7));
    ctx.drawImage(cache.mats, 0, y0);
    ctx.globalAlpha = 1;

    const span = L.floor - L.garden;
    CHIMNEYS.forEach((ch, i) => {
      const topU = L.floor - ch.h * span;
      drawChimneyTop(ch, i, toAy(topU), ch.x * aw, t, topU, toAy);   // warm shimmering fluid + rising bubbles
    });
  }

  let chimCache = null;
  function buildChimneyCache(L) {
    const key = aw + 'x' + H + 'x' + PX;
    if (chimCache && chimCache.key === key) return chimCache;
    return prof('chimneys', () => paintChimneyCache(L, key));
  }
  function paintChimneyCache(L, key) {
    const u0 = L.garden - 0.1;
    const rows = Math.ceil((L.floor + 0.02 - u0) * H / PX) + 1;
    const body = document.createElement('canvas'), mats = document.createElement('canvas');
    body.width = mats.width = aw; body.height = mats.height = rows;
    const bc = body.getContext('2d'), mc = mats.getContext('2d');
    const span = L.floor - L.garden;
    const memo = new Map();
    const shade = (c, band) => { const k = c[0] + ',' + Math.round(band * 100); let v = memo.get(k); if (!v) { v = rgb([c[0] * band, c[1] * band, c[2] * band]); memo.set(k, v); } return v; };
    const film = (c, a) => { const k = 'f' + c[0] + ',' + Math.round(a * 10); let v = memo.get(k); if (!v) { v = rgb(c, Math.round(a * 10) / 10); memo.set(k, v); } return v; };
    CHIMNEYS.forEach((ch, i) => {
      const topU = L.floor - ch.h * span;
      const baseX = ch.x * aw;
      for (let r = 0; r < rows; r++) {
        const u = u0 + r * PX / H;
        if (u < topU || u > L.floor) continue;
        const k = (u - topU) / (L.floor - topU);                 // 0 = tip, 1 = base
        const row = Math.floor(u * 400);
        let hw = (ch.w * aw / 2) * (0.22 + 0.78 * Math.pow(k, 1.25));
        hw *= 1 + 0.24 * Math.sin(k * Math.PI * 8 * ch.h + i * 1.7);   // bulges
        hw *= 0.96 + 0.08 * hash(row >> 2, i);                          // rough edge
        if (k > 0.9) hw *= 1 + (k - 0.9) * 5;                            // mound at the base
        const seg = u * 14, si = Math.floor(seg), sf = seg - si;
        const isLedge = hash(si, i + 50) > 0.72 && sf < 0.2;            // flat ledges
        if (isLedge) hw *= 1.45;
        const cx = baseX + (hash(row >> 4, i + 99) - 0.5) * 2;
        const l = Math.round(cx - hw), w = Math.max(2, Math.round(hw * 2));
        const band = (isLedge && sf > 0.14) ? 0.74 : 0.92 + 0.08 * Math.sin(u * 160 + i);
        bc.fillStyle = shade(COL.chimL, band); bc.fillRect(l, r, Math.ceil(w * 0.35), 1);
        bc.fillStyle = shade(COL.chimM, band); bc.fillRect(l + Math.ceil(w * 0.35), r, Math.ceil(w * 0.35), 1);
        bc.fillStyle = shade(COL.chimD, band); bc.fillRect(l + Math.ceil(w * 0.7), r, w - Math.ceil(w * 0.7), 1);
        // microbe mats (level 1), on their own layer so they can pulse
        const fl = 0.6 + 0.4 * hash(row, i + 21);
        if (hash(row, i + 7) > 0.35) { mc.fillStyle = film(COL.film1, fl); mc.fillRect(l, r, 1, 1); }
        if (hash(row, i + 8) > 0.35) { mc.fillStyle = film(COL.film2, fl); mc.fillRect(l + w - 1, r, 1, 1); }
        if (hash(row, i + 13) > 0.82) {
          mc.fillStyle = film(COL.film1, 0.8);
          mc.fillRect(Math.round(l + hash(row, i + 14) * w), r, 2, 1);
        }
      }
    });
    chimCache = { key, u0, body, mats };
    return chimCache;
  }

  function drawChimneyTop(ch, i, tAy, baseX, t, topU, toAy) {
    // shimmering warm vent water: a wavy column of heat haze above the tip
    if (tAy > -60 && tAy < ah + 40) {
      for (let k = 0; k < 40; k++) {
        const y = tAy - k;
        const x = baseX + Math.sin(t * 3 + k * 0.5 + i) * (1 + k * 0.1);
        const a = 0.3 * (1 - k / 40);
        ctx.fillStyle = rgba('255,205,150', a);
        ctx.fillRect(Math.round(x) - 1, Math.round(y), k < 14 ? 3 : 2, 1);
        if (k % 3 === 0) {                               // side wisps
          ctx.fillStyle = rgba('255,190,130', a * 0.5);
          ctx.fillRect(Math.round(x + Math.sin(t * 2 + k) * (3 + k * 0.15)), Math.round(y), 1, 1);
        }
      }
    }
    if (libHas('ventShimmer') && tAy > -30 && tAy < ah + 30) {
      const z = libSize('ventShimmer');
      if (z) { ctx.globalAlpha = 0.75; libDraw('ventShimmer', Math.floor(t * 5 + i) % (z.frames || 1), baseX - z.w / 2, tAy - z.h + 2, i % 2 === 1); ctx.globalAlpha = 1; }
    }
    for (let b = 0; b < 12; b++) {
      const ph = (t * 0.05 + b / 12 + i * 0.137) % 1;
      const u = topU - ph * 0.9;
      const ay = toAy(u); if (ay < 0 || ay > ah) continue;
      const x = baseX + Math.sin(ph * 14 + b) * 3;
      ctx.fillStyle = rgba('205,240,255', 0.7 * (1 - ph));
      ctx.fillRect(Math.round(x), Math.round(ay), 1, 1);
    }
  }

  // A faint "microscope lens" circle: these organisms are drawn ~300x life size.
  function lens(cx, cy, r) {
    ctx.fillStyle = 'rgba(120,200,255,0.07)';
    for (let y = -r; y <= r; y++) {
      const hw = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
    ctx.fillStyle = 'rgba(170,230,255,0.45)';
    const n = Math.max(16, Math.round(r * 5));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
  }
  // Blinking "+" badge on a lens: same "tap me" sign as the labels.
  function tapBadge(cx, cy, r, t) {
    const bx = Math.round(cx + r * 0.72), by = Math.round(cy - r * 0.72);
    ctx.fillStyle = Math.floor(t * 1.6) % 2 ? '#5de4ff' : '#b8f4ff';
    ctx.fillRect(bx - 2, by - 2, 5, 5);
    ctx.fillStyle = '#04070f';
    ctx.fillRect(bx - 1, by, 3, 1); ctx.fillRect(bx, by - 1, 1, 3);
  }

  // Clickable creature positions in CSS pixels, refreshed every frame (used by the microscope).
  let hits = [];
  function getHits() { return hits; }

  // Organisms are drawn above the darkness layer so they stay readable.
  // Hovered lens: a brighter double ring that "breathes"; after the reveal every lens pulses.
  function lensHighlight(cx, cy, r, t, strong) {
    const a = strong ? 0.9 : 0.35 + 0.25 * Math.sin(t * 3);
    ctx.fillStyle = 'rgba(93,228,255,' + a.toFixed(2) + ')';
    const rr = r + (strong ? 2 + (Math.floor(t * 4) % 2) : 1);
    const n = Math.round(rr * 6);
    for (let k = 0; k < n; k++) {
      if (k % 2) continue;
      const ang = (k / n) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(ang) * rr), Math.round(cy + Math.sin(ang) * rr), 1, 1);
    }
  }
  const isHovered = (s, x, y) => s.hover && Math.hypot(s.hover.x / PX - x, s.hover.y / PX - y) < 10;
  // little "hello" hop for the creatures when the floodlights come on
  const hop = (s, i) => (s.revealT > 0 && s.revealT < 2.4) ? -Math.abs(Math.sin((s.revealT - i * 0.15) * 6)) * 3 * (1 - s.revealT / 2.4) : 0;

  function drawCreatures(s, toAy) {
    const t = s.t;
    const cr = s.creatures;
    const lit = s.revealT > 0;
    const libG = libHas('grazer') && libSize('grazer'), libP = libHas('shadowfin') && libSize('shadowfin');
    cr.grazers.forEach((g, i) => {
      const gx = g.x * aw + Math.sin(t * 0.3 + i * 1.7) * 3;
      const ay = toAy(g.u) + Math.sin(t * 0.35 + i * 2) * 3 + hop(s, i);
      if (ay < -12 || ay > ah + 12) return;
      const lr = libG ? 12 : 8;
      hits.push({ id: 'grazers', x: gx * PX, y: (ay + 2) * PX, r: (lr + 3) * PX });
      lens(gx, ay + 2, lr);
      const hov = isHovered(s, gx, ay + 2);
      if (hov || lit) lensHighlight(gx, ay + 2, lr, t + i, hov);
      tapBadge(gx, ay + 2, lr, t);
      if (libG && libDraw('grazer', Math.floor(t * 6 + i) % (libG.frames || 1), gx - libG.w / 2, ay + 2 - libG.h / 2, i % 2 === 1)) return;
      sprite(GRAZER, GCOL, gx - 3, ay, 1, i % 2 === 1);
      // beating cilia around the cell
      ctx.fillStyle = 'rgba(255,214,223,0.85)';
      const f = Math.floor(t * 6 + i) % 2;
      const rim = [[-1, 2], [7, 2], [1, -1], [5, -1], [1, 5], [5, 5], [0, 0], [6, 0], [0, 4], [6, 4]];
      rim.forEach(([dx, dy], k) => { if ((k + f) % 2 === 0) ctx.fillRect(Math.round(gx - 3 + dx), Math.round(ay + dy), 1, 1); });
    });
    cr.predator.forEach((p, i) => {
      const ph = t * 0.16 + i;
      const x = (p.x + Math.sin(ph) * 0.1) * aw;
      const ay = toAy(p.u) + Math.sin(t * 0.9) * 2 + hop(s, 4 + i);
      if (ay < -16 || ay > ah + 16) return;
      hits.push({ id: 'predator', x: x * PX, y: ay * PX, r: 17 * PX });
      lens(x, ay, 15);
      const hov = isHovered(s, x, ay);
      if (hov || lit) lensHighlight(x, ay, 15, t + 2, hov);
      tapBadge(x, ay, 15, t);
      if (libP && libDraw('shadowfin', Math.floor(t * 4 + i) % (libP.frames || 1), x - libP.w / 2, ay - libP.h / 2, Math.cos(ph) > 0)) return;
      sprite(PRED, PRCOL, x - 11, ay - 5, 2, Math.cos(ph) > 0);
    });
  }

  return { init, resize, draw, getHits };
})();
