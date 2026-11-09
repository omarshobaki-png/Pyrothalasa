/* =====================================================================
   World renderer: draws the pixel-art scene on a low-resolution canvas
   that the browser scales up (image-rendering: pixelated).
   All world positions are in "screen heights" (u) from the top of the page,
   so the scene keeps its layout when the window is resized.
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
  const rgb = (c, a) => a == null
    ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
    : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';

  const COL = {
    space1: [4, 6, 16], space2: [16, 24, 52],
    iceTop: [222, 242, 252], iceMid: [118, 172, 207], iceBase: [30, 66, 100],
    ocean1: [12, 44, 74], ocean2: [3, 10, 20],
    rock: [36, 29, 27], rockDeep: [16, 12, 11],
    chimL: [240, 233, 216], chimM: [214, 203, 180], chimD: [168, 155, 130],
    film1: [70, 222, 170], film2: [40, 170, 140],
    warm: [44, 30, 26]
  };

  // ---------- precomputed decorations (in u units) ----------
  let stars = [], iceSpecks = [], cracks = [], particles = [];
  const CHIMNEYS = [
    { x: 0.10, w: 0.11, h: 0.50 },
    { x: 0.31, w: 0.13, h: 0.80 },
    { x: 0.635, w: 0.17, h: 1.0 },
    { x: 0.83, w: 0.12, h: 0.66 },
    { x: 0.97, w: 0.09, h: 0.40 }
  ];

  function build(L) {
    const r = rng(7);
    stars = Array.from({ length: 260 }, () => ({ x: r(), u: r() * (L.surf - 0.02), b: 0.35 + r() * 0.65, p: r() * 6.28 }));
    iceSpecks = Array.from({ length: 700 }, () => ({ x: r(), u: L.surf + 0.03 + r() * (L.ice - L.surf - 0.03), c: r() }));
    cracks = Array.from({ length: 18 }, () => {
      let x = r(), u = L.surf + 0.1 + r() * (L.ice - L.surf - 0.4);
      const pts = [[x, u]];
      const n = 5 + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) { x += (r() - 0.5) * 0.05; u += 0.03 + r() * 0.06; pts.push([x, u]); }
      return pts;
    });
    particles = Array.from({ length: 320 }, () => ({ x: r(), u: L.ice + r() * (L.floor - L.ice), s: 0.2 + r(), p: r() * 6.28 }));
    // ice layers (faint strata) and glints
    strata = Array.from({ length: 16 }, (_, i) => ({ u: L.surf + 0.25 + i * (L.ice - L.surf - 0.35) / 16 + r() * 0.08, a: 0.05 + r() * 0.07, f: r() * 10 }));
    glints = Array.from({ length: 60 }, () => ({ x: r(), u: L.surf + 0.05 + r() * (L.ice - L.surf - 0.1), p: r() * 6.28 }));
    // hydrogen (H2) specks rising from below, denser toward the garden
    const h0 = L.ice + (L.garden - L.ice) * 0.55;
    hydrogen = Array.from({ length: 150 }, () => ({ x: r(), u: h0 + Math.pow(r(), 0.45) * (L.floor - h0), s: 0.4 + r(), p: r() * 6.28 }));
  }
  let strata = [], glints = [], hydrogen = [];

  // ---------- sprites ----------
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
    W = w; H = h; PX = w < 700 ? 2 : 3;
    aw = Math.ceil(W / PX); ah = Math.ceil(H / PX);
    cvs.width = aw; cvs.height = ah; dark.width = aw; dark.height = ah;
    ctx.imageSmoothingEnabled = false;
    if (!stars.length) build(L);
  }

  // s = { cam, t, probeY, depth, L, dOfU, uOf, creatures, lampOn }
  function draw(s) {
    if (!aw || !ah || !H) return;
    hits = [];
    const L = s.L, cam = s.cam, t = s.t;
    const u0 = cam / H;
    const toAy = (u) => (u * H - cam) / PX;        // u -> art row on screen
    const uAt = (ay) => (cam + ay * PX) / H;       // art row -> u

    // ---- background bands ----
    for (let r = 0; r < ah; r++) {
      const u = uAt(r);
      let c;
      if (u < L.surf) c = mix(COL.space1, COL.space2, q(u / L.surf, 9));
      else if (u < L.ice) {
        const k = (u - L.surf) / (L.ice - L.surf);
        c = k < 0.1 ? mix(COL.iceTop, COL.iceMid, q(k / 0.1, 6)) : mix(COL.iceMid, COL.iceBase, q((k - 0.1) / 0.9, 12));
      } else if (u < L.floor) {
        c = mix(COL.ocean1, COL.ocean2, q((u - L.ice) / (L.floor - L.ice), 14));
        // colour warms as the vent field comes into view
        const warm = Math.min(1, Math.max(0, (u - (L.garden - 1.6)) / 1.9));
        if (warm > 0) c = mix(c, COL.warm, q(warm, 8) * 0.38);
      }
      else c = mix(COL.rock, COL.rockDeep, q(Math.min(1, (u - L.floor) / 0.6), 5));
      ctx.fillStyle = rgb(c);
      ctx.fillRect(0, r, aw, 1);
    }

    const visible = (u) => u > u0 - 0.15 && u < u0 + H / H + 0.15;

    // ---- sky ----
    if (u0 < L.surf) {
      for (const st of stars) {
        const ay = toAy(st.u); if (ay < 0 || ay > ah) continue;
        const a = st.b * (0.65 + 0.35 * Math.sin(t * 1.3 + st.p));
        ctx.fillStyle = 'rgba(220,235,255,' + a.toFixed(2) + ')';
        ctx.fillRect(Math.floor(st.x * aw), Math.floor(ay), 1, 1);
      }
      // the distant Sun
      const sx = Math.floor(0.09 * aw), sy = Math.floor(toAy(0.72));
      ctx.fillStyle = 'rgba(255,240,200,0.35)';
      ctx.fillRect(sx - 3, sy, 7, 1); ctx.fillRect(sx, sy - 3, 1, 7);
      ctx.fillStyle = '#fff6d8'; ctx.fillRect(sx - 1, sy - 1, 3, 3);
      drawSaturn(Math.floor(0.74 * aw), toAy(0.93), Math.max(10, Math.floor(Math.min(aw, ah) * 0.085)));
    }

    // ---- surface crust, tiger-stripe cracks and jets ----
    const sAy = toAy(L.surf);
    if (sAy > -40 && sAy < ah + 40) {
      for (let c = 0; c < aw; c++) {
        const bump = 1 + Math.floor(hash(c >> 1, 3) * 2) + (hash(c >> 3, 9) > 0.7 ? 2 : 0);
        ctx.fillStyle = '#f2fbff'; ctx.fillRect(c, Math.floor(sAy) - bump, 1, bump);
        ctx.fillStyle = '#b8dcef'; ctx.fillRect(c, Math.floor(sAy), 1, 2);
      }
      for (const cx of [0.17, 0.9]) {
        const x = Math.floor(cx * aw);
        ctx.fillStyle = '#3b6f95';
        for (let k = 0; k < 6; k++) ctx.fillRect(x - 2 + k, Math.floor(sAy) + (k < 3 ? k : 5 - k), 1, 1);
        for (let k = 0; k < 70; k++) {
          const ph = ((t * 0.18 + k / 70) % 1);
          const spread = (hash(k, cx * 100) - 0.5) * ph * aw * 0.09;
          const y = sAy - ph * H * 0.55 / PX;
          const a = 0.85 * (1 - ph);
          ctx.fillStyle = 'rgba(225,245,255,' + a.toFixed(2) + ')';
          ctx.fillRect(Math.floor(x + spread), Math.floor(y), 1, 1);
        }
      }
    }

    // ---- ice: specks and cracks ----
    if (u0 + 1 > L.surf && u0 < L.ice) {
      for (const p of iceSpecks) {
        const ay = toAy(p.u); if (ay < 0 || ay > ah) continue;
        ctx.fillStyle = p.c > 0.5 ? 'rgba(235,250,255,0.45)' : 'rgba(10,30,55,0.35)';
        ctx.fillRect(Math.floor(p.x * aw), Math.floor(ay), p.c > 0.85 ? 2 : 1, 1);
      }
      // strata: wavy lighter bands = layers of ice
      for (const st of strata) {
        const ay = toAy(st.u); if (ay < -4 || ay > ah + 4) continue;
        ctx.fillStyle = 'rgba(200,235,255,' + st.a.toFixed(3) + ')';
        for (let c = 0; c < aw; c += 1) {
          const w = Math.round(Math.sin(c * 0.045 + st.f) * 2 + Math.sin(c * 0.13 + st.f * 2));
          ctx.fillRect(c, Math.floor(ay + w), 1, 1);
        }
      }
      // glints: tiny twinkles in the ice near the probe lamp
      for (const g of glints) {
        const ay = toAy(g.u); if (ay < 0 || ay > ah) continue;
        const k = Math.sin(t * 2.2 + g.p);
        if (k < 0.85) continue;
        const gx = Math.floor(g.x * aw), gy = Math.floor(ay);
        ctx.fillStyle = 'rgba(240,252,255,' + ((k - 0.85) * 5).toFixed(2) + ')';
        ctx.fillRect(gx, gy, 1, 1); ctx.fillRect(gx - 1, gy, 3, 1); ctx.fillRect(gx, gy - 1, 1, 3);
      }
      ctx.fillStyle = 'rgba(12,35,60,0.45)';
      for (const cr of cracks) {
        for (let i = 1; i < cr.length; i++) {
          const [x1, ua] = cr[i - 1], [x2, ub] = cr[i];
          const ya = toAy(ua), yb = toAy(ub);
          if ((ya < 0 && yb < 0) || (ya > ah && yb > ah)) continue;
          const n = Math.max(1, Math.ceil(Math.abs(yb - ya)));
          for (let k = 0; k <= n; k++) {
            const f = k / n;
            ctx.fillRect(Math.floor((x1 + (x2 - x1) * f) * aw), Math.floor(ya + (yb - ya) * f), 1, 1);
          }
        }
      }
    }

    // ---- ocean particles ----
    if (u0 + 1 > L.ice) {
      for (const p of particles) {
        let u = p.u - ((t * 0.004 * p.s) % 0.5);
        if (u < L.ice) u += 0.5;
        const ay = toAy(u); if (ay < 0 || ay > ah) continue;
        const x = (p.x + Math.sin(t * 0.3 * p.s + p.p) * 0.004) * aw;
        ctx.fillStyle = 'rgba(150,200,230,' + (0.18 + 0.2 * p.s).toFixed(2) + ')';
        ctx.fillRect(Math.floor(x), Math.floor(ay), 1, 1);
      }
      // underside of the ice shell: a jagged ceiling where ice meets ocean
      const iAy = toAy(L.ice);
      if (iAy > -12 && iAy < ah + 12) {
        for (let c = 0; c < aw; c++) {
          const drip = Math.floor(hash(c >> 1, 41) * 3) + (hash(c >> 2, 43) > 0.82 ? 3 + Math.floor(hash(c, 47) * 4) : 0);
          ctx.fillStyle = rgb(COL.iceBase); ctx.fillRect(c, Math.floor(iAy) - 1, 1, drip + 1);
          if (hash(c, 49) > 0.7) { ctx.fillStyle = 'rgba(160,210,240,0.35)'; ctx.fillRect(c, Math.floor(iAy) + drip, 1, 1); }
        }
      }
    }

    // ---- hydrogen garden ----
    if (u0 + 1 > L.garden - 0.3) drawGarden(s, toAy, uAt);

    // ---- seafloor top edge ----
    const fAy = toAy(L.floor);
    if (fAy > -10 && fAy < ah + 10) {
      for (let c = 0; c < aw; c++) {
        const bump = Math.floor(hash(c >> 2, 21) * 4) + (hash(c >> 4, 5) > 0.75 ? 2 : 0);
        ctx.fillStyle = rgb(COL.rock); ctx.fillRect(c, Math.floor(fAy) - bump, 1, bump + 1);
        if (hash(c, 77) > 0.8) { ctx.fillStyle = '#4a3f39'; ctx.fillRect(c, Math.floor(fAy) - bump, 1, 1); }
      }
    }

    // ---- probe trail (melt channel + tether) ----
    const sc = PX === 2 ? 2 : 2;
    const pw = PROBE[0].length * sc, ph = PROBE.length * sc;
    const px = Math.round(aw / 2 - pw / 2);
    const pyBottom = s.probeY / PX;
    const pyTop = pyBottom - ph;
    if (s.depth > 0.5) {
      const topLimit = Math.max(0, toAy(L.surf));
      for (let r = Math.floor(pyTop); r >= topLimit; r--) {
        const u = uAt(r);
        if (u < L.ice) {
          const dist = (pyTop - r) * PX / H;
          const a = 0.3 * Math.exp(-dist / 0.35);
          if (a < 0.01) break;
          ctx.fillStyle = 'rgba(230,248,255,' + a.toFixed(3) + ')';
          ctx.fillRect(px + 2, r, pw - 4, 1);
        }
      }
    }

    // ---- darkness + probe lamp ----
    // 0 -> 1 over 1.6 s after arriving in the garden (eased), used by the floodlight reveal
    const rev = s.revealT >= 0 ? 1 - Math.pow(1 - Math.min(1, s.revealT / 1.6), 3) : 0;
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, aw, ah);
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
      if (a > 0) { dctx.fillStyle = 'rgba(0,3,9,' + a.toFixed(3) + ')'; dctx.fillRect(0, r, aw, 1); }
    }
    if (s.depth > 2) {
      const lx = aw / 2, ly = pyBottom + 8;
      const R = Math.min(aw, ah) * 0.42 * (1 + 0.7 * rev);
      const g = dctx.createRadialGradient(lx, ly, 2, lx, ly, R);
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
    drawOverlays(s, toAy, px + pw / 2, pyBottom);
    if (u0 + 1 > L.garden - 0.3) drawCreatures(s, toAy);

    // ---- tether + probe on top ----
    if (s.depth > 0.5) {
      ctx.fillStyle = 'rgba(160,185,210,0.55)';
      const top = Math.max(0, toAy(L.surf) - 2);
      ctx.fillRect(Math.round(aw / 2), top, 1, Math.max(0, pyTop - top));
    }
    const bob = s.depth > 20000 ? Math.round(Math.sin(t * 1.6)) : 0;
    sprite(PROBE, PCOL, px, pyTop + bob, sc, false);
    if (s.depth > 0.5 && s.depth < s.iceM) {   // hot nose melting the ice
      ctx.fillStyle = 'rgba(255,157,60,' + (0.35 + 0.25 * Math.sin(t * 8)).toFixed(2) + ')';
      ctx.fillRect(px, Math.round(pyBottom + bob), pw, 2);
    }
    if (s.depth > 2) {                           // lamp
      ctx.fillStyle = 'rgba(255,248,210,0.9)';
      ctx.fillRect(Math.round(aw / 2) - 1, Math.round(pyBottom + bob - 1), 2, 1);
    }
  }

  // Things drawn above the darkness so they read in the deep: H2 specks, sonar,
  // depth checkpoint lines and the splash when the probe breaks out of the ice.
  function drawOverlays(s, toAy, cx, cy) {
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
        ctx.fillStyle = 'rgba(93,228,255,' + (0.25 + 0.55 * near).toFixed(2) + ')';
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
    if (d > s.iceM + 300 && d < (s.gardenM || Infinity)) {
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
    }

    // splash of bubbles just after breaking through the ice into the ocean
    const since = d - s.iceM;
    if (since > 0 && since < 2500) {
      const k = 1 - since / 2500;
      for (let i = 0; i < 26; i++) {
        const life = (t * 0.9 + i * 0.137) % 1;
        const bx = cx + (hash(i, 5) - 0.5) * 34 + Math.sin(t * 3 + i) * 1.5;
        const by = cy + 6 - life * 46;
        ctx.fillStyle = 'rgba(220,245,255,' + (0.8 * k * (1 - life)).toFixed(2) + ')';
        if (i % 3) ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
        else { ctx.fillRect(Math.round(bx) - 1, Math.round(by), 3, 1); ctx.fillRect(Math.round(bx), Math.round(by) - 1, 1, 3); }
      }
    }
  }

  function drawSaturn(cx, cy, r) {
    const rx = r * 2.25, ry = r * 0.55, inner = 0.62;
    const ring = (front) => {
      for (let y = Math.floor(-ry); y <= ry; y++) {
        if (front ? y < 0 : y >= 0) continue;
        for (let x = Math.floor(-rx); x <= rx; x++) {
          const e = (x * x) / (rx * rx) + (y * y) / (ry * ry);
          if (e > 1 || e < inner * inner) continue;
          const band = e > 0.83 ? '#cdb489' : (e > 0.6 ? '#a8916b' : '#e6d3a8');
          ctx.fillStyle = band;
          ctx.fillRect(cx + x, Math.floor(cy + y - x * 0.18), 1, 1);
        }
      }
    };
    ring(false);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const b = Math.floor(((y + r) / (2 * r)) * 7);
      const cols = ['#f0dcae', '#e2c48f', '#d9b67d', '#e8cf9c', '#cfa86c', '#c49a5e', '#a9824d'];
      let c = cols[b];
      if (x > r * 0.45 && x * x + y * y > r * r * 0.5) c = '#8e6c40';
      ctx.fillStyle = c; ctx.fillRect(cx + x, Math.floor(cy + y), 1, 1);
    }
    ring(true);
  }

  function drawGarden(s, toAy, uAt) {
    const L = s.L, t = s.t;
    const rStart = Math.max(0, Math.floor(toAy(L.garden - 0.1)));
    const rEnd = Math.min(ah, Math.ceil(toAy(L.floor)) + 1);
    const span = L.floor - L.garden;

    // Chimney bodies and microbe mats are static, so they come from a cache drawn once per
    // layout (see buildChimneyCache); the mats "breathe" by pulsing the whole layer's alpha.
    const cache = buildChimneyCache(L);
    const y0 = Math.round(toAy(cache.u0));
    ctx.drawImage(cache.body, 0, y0);
    ctx.globalAlpha = 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7));
    ctx.drawImage(cache.mats, 0, y0);
    ctx.globalAlpha = 1;

    CHIMNEYS.forEach((ch, i) => {
      const topU = L.floor - ch.h * span;
      const tAy = toAy(topU);
      const baseX = ch.x * aw;
      drawChimneyTop(ch, i, tAy, baseX, t, topU, toAy);   // warm shimmering fluid + rising bubbles
    });
  }

  let chimCache = null;
  function buildChimneyCache(L) {
    const key = aw + 'x' + H + 'x' + PX;
    if (chimCache && chimCache.key === key) return chimCache;
    const u0 = L.garden - 0.1;
    const rows = Math.ceil((L.floor + 0.02 - u0) * H / PX) + 1;
    const body = document.createElement('canvas'), mats = document.createElement('canvas');
    body.width = mats.width = aw; body.height = mats.height = rows;
    const bc = body.getContext('2d'), mc = mats.getContext('2d');
    const span = L.floor - L.garden;
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
        const sh = (c) => [c[0] * band, c[1] * band, c[2] * band];
        bc.fillStyle = rgb(sh(COL.chimL)); bc.fillRect(l, r, Math.ceil(w * 0.35), 1);
        bc.fillStyle = rgb(sh(COL.chimM)); bc.fillRect(l + Math.ceil(w * 0.35), r, Math.ceil(w * 0.35), 1);
        bc.fillStyle = rgb(sh(COL.chimD)); bc.fillRect(l + Math.ceil(w * 0.7), r, w - Math.ceil(w * 0.7), 1);
        // microbe mats (level 1), on their own layer so they can pulse
        const fl = 0.6 + 0.4 * hash(row, i + 21);
        if (hash(row, i + 7) > 0.35) { mc.fillStyle = rgb(COL.film1, fl); mc.fillRect(l, r, 1, 1); }
        if (hash(row, i + 8) > 0.35) { mc.fillStyle = rgb(COL.film2, fl); mc.fillRect(l + w - 1, r, 1, 1); }
        if (hash(row, i + 13) > 0.82) {
          mc.fillStyle = rgb(COL.film1, 0.8);
          mc.fillRect(Math.round(l + hash(row, i + 14) * w), r, 2, 1);
        }
      }
    });
    chimCache = { key, u0, body, mats };
    return chimCache;
  }

  function drawChimneyTop(ch, i, tAy, baseX, t, topU, toAy) {
      if (tAy > -60 && tAy < ah + 20) {
        for (let k = 0; k < 22; k++) {
          const y = tAy - k;
          const x = baseX + Math.sin(t * 3 + k * 0.6 + i) * (1 + k * 0.08);
          ctx.fillStyle = 'rgba(255,205,150,' + (0.28 * (1 - k / 22)).toFixed(3) + ')';
          ctx.fillRect(Math.round(x) - 1, Math.round(y), 2, 1);
        }
      }
      for (let b = 0; b < 12; b++) {
        const ph = (t * 0.05 + b / 12 + i * 0.137) % 1;
        const u = topU - ph * 0.9;
        const ay = toAy(u); if (ay < 0 || ay > ah) continue;
        const x = baseX + Math.sin(ph * 14 + b) * 3;
        ctx.fillStyle = 'rgba(205,240,255,' + (0.7 * (1 - ph)).toFixed(2) + ')';
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
  const isHovered = (s, x, y, r) => s.hover && Math.hypot(s.hover.x / PX - x, s.hover.y / PX - y) < 7;
  // little "hello" hop for the creatures when the floodlights come on
  const hop = (s, i) => (s.revealT > 0 && s.revealT < 2.4) ? -Math.abs(Math.sin((s.revealT - i * 0.15) * 6)) * 3 * (1 - s.revealT / 2.4) : 0;

  function drawCreatures(s, toAy) {
    const t = s.t;
    const cr = s.creatures;
    const lit = s.revealT > 0;
    cr.grazers.forEach((g, i) => {
      const gx = g.x * aw + Math.sin(t * 0.3 + i * 1.7) * 3;
      const ay = toAy(g.u) + Math.sin(t * 0.35 + i * 2) * 3 + hop(s, i);
      if (ay < -12 || ay > ah + 12) return;
      hits.push({ id: 'grazers', x: gx * PX, y: (ay + 2) * PX, r: 11 * PX });
      lens(gx, ay + 2, 8);
      const hov = isHovered(s, gx, ay + 2);
      if (hov || lit) lensHighlight(gx, ay + 2, 8, t + i, hov);
      tapBadge(gx, ay + 2, 8, t);
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
      sprite(PRED, PRCOL, x - 11, ay - 5, 2, Math.cos(ph) > 0);
    });
  }

  return { init, resize, draw, getHits };
})();
