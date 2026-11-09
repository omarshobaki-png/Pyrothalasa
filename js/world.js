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
    film1: [70, 222, 170], film2: [40, 170, 140]
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
  }

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
  const GRAZER = ['.SSS.', 'SSSSS', 'bbbbbb'];
  const GCOL = { S: '#ff9fb4', b: '#ffd6df' };
  const PRED = [
    '...ddd.....',
    '.ddddddd..d',
    'sdddddddddd',
    '.ddddddd..d',
    '...d.d.....'
  ];
  const PRCOL = { d: '#b7a2ff', s: '#f2ecff' };

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
      } else if (u < L.floor) c = mix(COL.ocean1, COL.ocean2, q((u - L.ice) / (L.floor - L.ice), 14));
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
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, aw, ah);
    for (let r = 0; r < ah; r++) {
      const d = s.dOfU(uAt(r));
      let a;
      if (d <= 0) a = 0;
      else if (d < 12) a = 0.5 * (d / 12);
      else if (d < s.iceM) a = 0.5 + 0.15 * (d / s.iceM);
      else a = 0.64;
      if (a > 0) { dctx.fillStyle = 'rgba(0,3,9,' + a.toFixed(3) + ')'; dctx.fillRect(0, r, aw, 1); }
    }
    if (s.depth > 2) {
      const lx = aw / 2, ly = pyBottom + 8;
      const R = Math.min(aw, ah) * 0.42;
      const g = dctx.createRadialGradient(lx, ly, 2, lx, ly, R);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.globalCompositeOperation = 'destination-out';
      dctx.fillStyle = g;
      dctx.fillRect(0, 0, aw, ah);
    }
    ctx.drawImage(dark, 0, 0);
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

    CHIMNEYS.forEach((ch, i) => {
      const topU = L.floor - ch.h * span;
      const tAy = toAy(topU);
      const baseX = ch.x * aw;
      // chimney body
      for (let r = Math.max(rStart, Math.floor(tAy)); r < rEnd; r++) {
        const u = uAt(r);
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
        ctx.fillStyle = rgb(sh(COL.chimL)); ctx.fillRect(l, r, Math.ceil(w * 0.35), 1);
        ctx.fillStyle = rgb(sh(COL.chimM)); ctx.fillRect(l + Math.ceil(w * 0.35), r, Math.ceil(w * 0.35), 1);
        ctx.fillStyle = rgb(sh(COL.chimD)); ctx.fillRect(l + Math.ceil(w * 0.7), r, w - Math.ceil(w * 0.7), 1);
        // microbe mats (level 1)
        const fl = 0.55 + 0.45 * Math.sin(t * 2 + row * 0.7 + i);
        if (hash(row, i + 7) > 0.35) { ctx.fillStyle = rgb(COL.film1, fl); ctx.fillRect(l, r, 1, 1); }
        if (hash(row, i + 8) > 0.35) { ctx.fillStyle = rgb(COL.film2, fl); ctx.fillRect(l + w - 1, r, 1, 1); }
        if (hash(row, i + 13) > 0.82) {
          ctx.fillStyle = rgb(COL.film1, 0.75);
          ctx.fillRect(Math.round(l + hash(row, i + 14) * w), r, 2, 1);
        }
      }
      // warm shimmering fluid + rising bubbles at the top
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
    });
  }

  // Animals are drawn above the darkness layer so they stay readable.
  function drawCreatures(s, toAy) {
    const t = s.t;
    const cr = s.creatures;
    cr.grazers.forEach((g, i) => {
      const ay = toAy(g.u) + Math.sin(t * 0.35 + i * 2) * 4;
      if (ay < -10 || ay > ah + 10) return;
      sprite(GRAZER, GCOL, g.x * aw - 3, ay, 1, i % 2 === 1);
    });
    cr.fanfeeders.forEach((f, i) => {
      const ay = toAy(f.u); if (ay < -12 || ay > ah + 12) return;
      const bx = f.x * aw, sway = Math.sin(t * 1.2 + i) * 0.25;
      for (let k = 0; k < 6; k++) {
        const ang = -Math.PI / 2 + (k - 2.5) * 0.32 + sway;
        for (let j = 1; j <= 7; j++) {
          ctx.fillStyle = j > 5 ? '#ff9f43' : '#ffcf5a';
          ctx.fillRect(Math.round(bx + Math.cos(ang) * j), Math.round(ay + Math.sin(ang) * j), 1, 1);
        }
      }
      ctx.fillStyle = '#c98a2e'; ctx.fillRect(Math.round(bx) - 1, Math.round(ay), 3, 2);
    });
    cr.predator.forEach((p, i) => {
      const ph = t * 0.16 + i;
      const x = (p.x + Math.sin(ph) * 0.13) * aw;
      const ay = toAy(p.u) + Math.sin(t * 0.9) * 2;
      if (ay < -10 || ay > ah + 10) return;
      sprite(PRED, PRCOL, x - 11, ay - 5, 2, Math.cos(ph) > 0);
    });
  }

  return { init, resize, draw };
})();
