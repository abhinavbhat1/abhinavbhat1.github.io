/* Two-tone line art, drawn on one canvas behind the page. One 3D model of the network (About → Research → Experience →
   Education → Skills → Output) and a different projection of it for each chapter's concept:
   hero: a field of vertical lines that bend around the pointer, with the forward pass rippling through them;
   research (3D imaging): a perspective corridor of layer frames the camera flies through, like slicing a scan;
   experience (data pipelines): a top-down schematic with bits streaming through the pipes and validation checks;
   education (foundations): a sunburst, the network as concentric rings, lit from the outside in;
   skills (the toolkit): a weight matrix as a full-bleed grid with hatched cells and a lens under the pointer;
   contact: a loss landscape, the output neuron released into the global minimum under damped marble physics;
   footer: the grid again, bulging under the pointer. */
(function () {
  'use strict';
  const canvas = document.getElementById('scene'); const ctx = canvas.getContext('2d'); const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; const narrow = () => window.innerWidth < 900;
  let W = 1, H = 1, DPR = 1;
  function resize() { DPR = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; canvas.width = Math.ceil(W * DPR); canvas.height = Math.ceil(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  window.addEventListener('resize', resize); resize();
  let INK = '#06040f'; function theme() { INK = getComputedStyle(root).getPropertyValue('--ink').trim() || INK; } theme(); window.addEventListener('themechange', theme);
  const MONO = "'Space Mono', ui-monospace, Menlo, monospace", DISPLAY = "'Anton', Impact, sans-serif";
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)); const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); }; const mix = (a, b, k) => a + (b - a) * k;
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ───────── the network ─────────
  const HID = (window.LAYERS && window.LAYERS.length) ? window.LAYERS : [4, 8, 2, 2, 1]; const NL = HID.length + 1; const L = NL - 1;
  const nodes = []; const r0 = rng(7);
  HID.forEach((n, k) => { for (let i = 0; i < n; i++) nodes.push({ k, i, n, x: (k - L / 2) * 2.6, y: (i - (n - 1) / 2) * (n > 5 ? 0.95 : 1.15), z: (r0() - 0.5) * 0.9, r: r0() }); });
  nodes.push({ k: L, i: 0, n: 1, x: (L / 2) * 2.6, y: 0, z: 0, r: 0.5, out: true });
  const OUT = nodes.length - 1, outNd = nodes[OUT];
  const byLayer = Array.from({ length: NL }, (_, k) => nodes.filter(nd => nd.k === k));
  const edges = []; { const r = rng(1000); for (let k = 0; k < L; k++) byLayer[k].forEach(A => byLayer[k + 1].forEach(B => { edges.push({ a: nodes.indexOf(A), b: nodes.indexOf(B), k: k + 1, w: (r() - 0.5) * 2, r: r() }); })); }
  const outEdges = edges.filter(e => nodes[e.b].out);

  // ───────── projection ─────────
  const cam = { tx: 0, ty: 0, tz: 0, yaw: 0, pitch: 0, dist: 12, f: 600, cx: 0, cy: 0, ortho: false };
  function proj(x, y, z, out) {
    x -= cam.tx; y -= cam.ty; z -= cam.tz;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw); const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch); const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    let d = cam.dist + z2; if (d < 0.15) d = 0.15; const s = cam.ortho ? cam.f / cam.dist : cam.f / d;
    out.x = cam.cx + x1 * s; out.y = cam.cy - y2 * s; out.s = s; out.d = d; return out;
  }
  const P = Array.from({ length: nodes.length }, () => ({ x: 0, y: 0, s: 1, d: 1 })); const _p = { x: 0, y: 0, s: 1, d: 1 }, _q = { x: 0, y: 0, s: 1, d: 1 };
  const sceneCX = () => narrow() ? W / 2 : W * 0.36, sceneCY = () => narrow() ? H * 0.3 : H * 0.52;

  // ───────── pointer ─────────
  const ptr = { x: -1e4, y: -1e4, down: false };
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
  window.addEventListener('pointerdown', (e) => { ptr.down = true; if (marble.on) { const dx = e.clientX - ballS.x, dy = e.clientY - ballS.y; if (Math.hypot(dx, dy) < 48) { marble.du -= dx * 0.06; marble.dv -= dy * 0.08; } } });
  window.addEventListener('pointerup', () => { ptr.down = false; });

  // ───────── hero: the field of lines ─────────
  const wavesEl = document.getElementById('waves');
  function drawWaves(t, a, introT) {
    const r = wavesEl.getBoundingClientRect(); const headBot = (document.getElementById('head') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom; const top = Math.max(r.top, headBot, 0), bot = Math.min(r.bottom, H); if (bot - top < 20) return;
    ctx.globalAlpha = a; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath();
    const step = narrow() ? 12 : 16; const n = Math.floor(W / step) + 1; const x0 = (W - (n - 1) * step) / 2;
    const xp = ((t * 0.19) % 1.5 - 0.25) * W;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * step; const u = (x - W / 2) / (W / 2);
      let hf = 1; if (introT != null) hf = smooth(introT * 1.15 - 0.9 * (1 - Math.abs(u))); if (hf <= 0.001) continue;
      const yEnd = bot - (bot - top) * hf; let first = true;
      for (let y = bot; y >= yEnd; y -= 9) {
        const dx0 = x - ptr.x, dy0 = y - ptr.y; const rr = Math.hypot(dx0, dy0) + 1e-3; const bend = Math.exp(-((rr / 150) ** 2)) * 62 * (dx0 / rr);
        const wave = 8 * Math.sin(y * 0.014 + t * 1.3 + x * 0.0045); const pulse = 30 * Math.exp(-(((x - xp) / 70) ** 2)) * Math.sin(y * 0.03 + t * 5);
        const px = x + bend + wave + pulse; if (first) { ctx.moveTo(px, y); first = false; } else ctx.lineTo(px, y);
      }
    }
    ctx.stroke();
  }

  // ───────── research: the corridor of layers (slicing through a 3D scan) ─────────
  function drawCorridor(p, a, t) {
    cam.ortho = false; cam.yaw = Math.PI / 2 - 0.34; cam.pitch = 0.1; cam.dist = 6.2; cam.f = Math.min(W, H) * 0.95; cam.cx = sceneCX(); cam.cy = sceneCY(); cam.tx = mix(-9.6, 3.2, p); cam.ty = 0; cam.tz = 0;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1;
    const fr = [];
    for (let k = 0; k < NL; k++) { const col = byLayer[k]; const hy = col[0].out ? 1.3 : Math.max(1.6, Math.abs(col[0].y) + 1.0), hz = 2.6, x = col[0].x; const c = [[x, hy, -hz], [x, hy, hz], [x, -hy, hz], [x, -hy, -hz]].map(v => proj(v[0], v[1], v[2], { x: 0, y: 0, s: 1, d: 1 })); fr.push(c.every(q => q.d > 0.4) ? c : null); }
    for (let k = 0; k < NL; k++) { const c = fr[k]; if (!c) continue; ctx.globalAlpha = a * clamp(1.3 - c[0].d / 30) * 0.9; ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(c[i].x, c[i].y); ctx.closePath(); ctx.stroke();
      if (k < NL - 1 && fr[k + 1]) { ctx.globalAlpha = a * 0.45; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(c[i].x, c[i].y); ctx.lineTo(fr[k + 1][i].x, fr[k + 1][i].y); } ctx.stroke(); } }
    nodes.forEach((nd, i) => proj(nd.x, nd.y, nd.z, P[i]));
    ctx.globalAlpha = a * 0.33; ctx.beginPath(); edges.forEach(e => { const A = P[e.a], B = P[e.b]; if (A.d > 0.4 && B.d > 0.4) { ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); } }); ctx.stroke();
    // the scan line sweeping the frame nearest the camera
    const kn = clamp(Math.round((cam.tx + L / 2 * 2.6) / 2.6), 0, L); if (fr[kn]) { const c = fr[kn]; const u = 0.5 + 0.5 * Math.sin(t * 1.4); ctx.globalAlpha = a * 0.8; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(mix(c[3].x, c[0].x, u), mix(c[3].y, c[0].y, u)); ctx.lineTo(mix(c[2].x, c[1].x, u), mix(c[2].y, c[1].y, u)); ctx.stroke(); ctx.setLineDash([]); }
    nodes.forEach((nd, i) => { const q = P[i]; if (q.d <= 0.4) return; const rad = clamp(0.17 * q.s, 1.5, 44); const lit = nd.x < cam.tx + 2.2; ctx.globalAlpha = a * clamp(1.3 - q.d / 30); ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, 6.2832); if (lit) ctx.fill(); else ctx.stroke(); });
    ctx.globalAlpha = 1;
  }

  // ───────── experience: the pipeline schematic, bits streaming, checks passing ─────────
  function drawPipes(p, a, t) {
    const U = Math.min(W, H) * 0.105; const cx = sceneCX() - mix(-1.6, 1.6, p) * U, cy = sceneCY();
    const sx = (x) => cx + x * U, sy = (y) => cy - y * U * 0.8;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1;
    const path = (e) => { const A = nodes[e.a], B = nodes[e.b]; const ax = sx(A.x), ay = sy(A.y), bx = sx(B.x), by = sy(B.y); const mx = (ax + bx) / 2 + e.w * 0.14 * U; return [ax, ay, mx, by, bx]; };
    ctx.globalAlpha = a * 0.42; ctx.beginPath(); edges.forEach(e => { const [ax, ay, mx, by, bx] = path(e); ctx.moveTo(ax, ay); ctx.lineTo(mx, ay); ctx.lineTo(mx, by); ctx.lineTo(bx, by); }); ctx.stroke();
    // bits riding the pipes
    ctx.globalAlpha = a; ctx.font = `700 ${Math.max(8, U * 0.13)}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    edges.forEach(e => { const [ax, ay, mx, by, bx] = path(e); const l1 = Math.abs(mx - ax), l2 = Math.abs(by - ay), l3 = Math.abs(bx - mx), T = l1 + l2 + l3 || 1; let s = ((t * 0.16 * (0.7 + e.r * 0.7) + e.r) % 1) * T; let x, y; if (s < l1) { x = ax + Math.sign(mx - ax) * s; y = ay; } else if (s < l1 + l2) { x = mx; y = ay + Math.sign(by - ay) * (s - l1); } else { x = mx + Math.sign(bx - mx) * (s - l1 - l2); y = by; } ctx.fillText(e.w > 0 ? '1' : '0', x, y); });
    // nodes as boxes, lit as the chapter progresses, with validation badges
    const side = U * 0.24; ctx.font = `700 ${Math.max(7, U * 0.11)}px ${MONO}`;
    nodes.forEach(nd => { const x = sx(nd.x), y = sy(nd.y); const lit = nd.k / L < p * 1.25; ctx.globalAlpha = a; if (lit) ctx.fillRect(x - side / 2, y - side / 2, side, side); else ctx.strokeRect(x - side / 2, y - side / 2, side, side);
      if (lit && nd.k > 0) { const bad = nd.r < 0.14 && !nd.out; ctx.strokeRect(x + side * 0.55, y - side * 0.95, side * 0.75, side * 0.75); if (bad) { ctx.beginPath(); for (let h = 0; h < 3; h++) { const o = side * 0.19 * (h + 0.5); ctx.moveTo(x + side * 0.55 + o, y - side * 0.95); ctx.lineTo(x + side * 0.55, y - side * 0.95 + o); } ctx.stroke(); } ctx.fillText(bad ? '✕' : '✓', x + side * 0.925, y - side * 0.56); } });
    ctx.globalAlpha = 1;
  }

  // ───────── education: the sunburst, the network as rings lit from the outside in ─────────
  function drawRadial(p, a, t) {
    const cx = sceneCX(), cy = sceneCY(); const R1 = Math.min(W, H) * 0.1; const rot = p * 1.1 + t * 0.035;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1;
    ctx.globalAlpha = a * 0.3; ctx.beginPath(); for (let i = 0; i < 28; i++) { const th = rot * 0.5 + i / 28 * 6.2832; ctx.moveTo(cx + Math.cos(th) * R1 * 0.5, cy + Math.sin(th) * R1 * 0.5); ctx.lineTo(cx + Math.cos(th) * R1 * (L + 1.6), cy + Math.sin(th) * R1 * (L + 1.6)); } ctx.stroke();
    for (let k = 0; k < NL; k++) { const R = (L - k) * R1; if (R <= 0) continue; ctx.globalAlpha = a * 0.55; ctx.setLineDash(k === 0 ? [] : [2, 6]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke(); } ctx.setLineDash([]);
    nodes.forEach((nd, i) => { const R = (L - nd.k) * R1; const th = rot + nd.k * 0.35 + (nd.i + 0.5) / nd.n * 6.2832; P[i].x = cx + Math.cos(th) * R; P[i].y = cy + Math.sin(th) * R; });
    ctx.globalAlpha = a * 0.3; ctx.beginPath(); edges.forEach(e => { ctx.moveTo(P[e.a].x, P[e.a].y); ctx.lineTo(P[e.b].x, P[e.b].y); }); ctx.stroke();
    nodes.forEach((nd, i) => { const lit = (L - nd.k) / L > 1 - p * 1.3; const rad = R1 * (nd.out ? 0.16 : 0.085); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(P[i].x, P[i].y, rad, 0, 6.2832); if (lit) ctx.fill(); else ctx.stroke(); });
    ctx.globalAlpha = 1;
  }

  // ───────── skills and footer: the grid with a lens under the pointer; hatched cells are the heavy weights ─────────
  const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
  function drawGrid(a, t, hatch, lensK, yoff) {
    const cell = Math.max(44, Math.min(W, H) / 11); const cols = Math.ceil(W / cell) + 2, rows = Math.ceil(H / cell) + 2; const ox = -cell + ((yoff || 0) % cell), oy = -cell;
    const lens = (x, y) => { const dx = x - ptr.x, dy = y - ptr.y; const r = Math.hypot(dx, dy); const k = 1 + lensK * Math.exp(-((r / 240) ** 2)); return [ptr.x + dx * k, ptr.y + dy * k]; };
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1; ctx.globalAlpha = a * 0.55; ctx.beginPath();
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const [x, y] = lens(ox + i * cell, oy + j * cell); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const [x, y] = lens(ox + i * cell, oy + j * cell); if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    if (hatch) { ctx.globalAlpha = a * 0.5; ctx.beginPath();
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) { const h = hash(i, j); if (h > 0.17) continue; const c0 = lens(ox + i * cell, oy + j * cell), c1 = lens(ox + (i + 1) * cell, oy + j * cell), c2 = lens(ox + (i + 1) * cell, oy + (j + 1) * cell), c3 = lens(ox + i * cell, oy + (j + 1) * cell);
        const nL = 2 + Math.floor(h * 30); for (let s = 1; s <= nL; s++) { const u = s / (nL + 1); ctx.moveTo(mix(c0[0], c1[0], u), mix(c0[1], c1[1], u)); ctx.lineTo(mix(c0[0], c3[0], u), mix(c0[1], c3[1], u)); ctx.moveTo(mix(c1[0], c2[0], u), mix(c1[1], c2[1], u)); ctx.lineTo(mix(c3[0], c2[0], u), mix(c3[1], c2[1], u)); } }
      ctx.stroke();
      ctx.globalAlpha = a * 0.9; ctx.font = `700 ${narrow() ? 8 : 10}px ${MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('W · RESEARCH → EXPERIENCE · 8 × 2 · HATCH = |WEIGHT|', narrow() ? 14 : 36, (narrow() ? 0.19 : 0.17) * H); }
    ctx.globalAlpha = 1;
  }

  // ───────── contact: the loss landscape and the global minimum ─────────
  const land = { NX: 30, NZ: 24, x0: -18, x1: 18, z0: -17, z1: 10, wx: -3.5, wz: -1, sig: 4.6 };
  const marble = { u: 0, v: 0, du: 0, dv: 0, on: false }; const ballS = { x: -1e4, y: -1e4 }; let fallS = 0, depth = 0; const OM = 1.9, MU = 1.0, RR = 3.2;
  const wellH = (x, z) => { const dx = x - land.wx, dz = z - land.wz, r2 = dx * dx + dz * dz; return -depth * (0.7 * Math.exp(-r2 / (2 * land.sig * land.sig)) + 0.3 * Math.exp(-r2 / (2 * (2.4 * land.sig) ** 2))); };
  const net3 = nodes.map(nd => ({ x: land.wx - 1 + nd.x * 0.85, y: 4.2 + nd.y * 0.85, z: land.wz - 7 + nd.z * 0.85 }));
  function drawLandscape(fin, a, t, dt) {
    cam.ortho = false; cam.yaw = 0.32; cam.pitch = 0.46 + 0.16 * smooth(fin / 0.45); cam.dist = 34; cam.f = Math.min(W, H) * 1.05; cam.cx = narrow() ? W / 2 : W * 0.38; cam.cy = narrow() ? H * 0.3 : H * 0.52; cam.tx = land.wx + 2.5; cam.ty = -1.2; cam.tz = land.wz - 2;
    const sheetK = smooth((fin - 0.04) / 0.24), toRim = smooth((fin - 0.22) / 0.22), relK = smooth((fin - 0.5) / 0.06);
    if (relK > 0.01 && !marble.on) { marble.on = true; marble.u = RR * 0.92; marble.v = 0; marble.du = -0.3; marble.dv = 0.66 * OM * RR * 0.92; }
    if (relK <= 0.01) { marble.on = false; marble.u = marble.v = marble.du = marble.dv = 0; }
    if (marble.on) for (let s = 0; s < 2; s++) { const h = dt / 2; marble.du += (-OM * OM * marble.u - MU * marble.du) * h; marble.dv += (-OM * OM * marble.v - MU * marble.dv) * h; marble.u += marble.du * h; marble.v += marble.dv * h; const rr = Math.hypot(marble.u, marble.v), rmax = RR * 1.3; if (rr > rmax) { const k = rmax / rr; marble.u *= k; marble.v *= k; const nu = marble.u / rr, nv = marble.v / rr, vn = marble.du * nu + marble.dv * nv; if (vn > 0) { marble.du -= 1.5 * vn * nu; marble.dv -= 1.5 * vn * nv; } } }
    fallS += (((marble.on ? clamp(1 - Math.hypot(marble.u, marble.v) / RR) : 0) * relK) - fallS) * (1 - Math.exp(-dt * 3));
    depth = 7.5 * sheetK * (0.22 + 0.3 * toRim + 0.48 * fallS);
    const bx = land.wx + marble.u, bz = land.wz + marble.v; const dent = (x, z) => marble.on ? -0.55 * relK * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / 1.1) : 0;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1;
    // the sheet
    for (let j = 0; j <= land.NZ; j++) { const z = mix(land.z0, land.z1, j / land.NZ); ctx.beginPath(); let al = 0; for (let i = 0; i <= land.NX; i++) { const x = mix(land.x0, land.x1, i / land.NX); proj(x, wellH(x, z) + dent(x, z), z, _p); if (i === 0) ctx.moveTo(_p.x, _p.y); else ctx.lineTo(_p.x, _p.y); al += _p.d; } ctx.globalAlpha = a * sheetK * clamp(1.5 - (al / (land.NX + 1)) / 52); ctx.stroke(); }
    for (let i = 0; i <= land.NX; i += 1) { const x = mix(land.x0, land.x1, i / land.NX); ctx.beginPath(); for (let j = 0; j <= land.NZ; j++) { const z = mix(land.z0, land.z1, j / land.NZ); proj(x, wellH(x, z) + dent(x, z), z, _p); if (j === 0) ctx.moveTo(_p.x, _p.y); else ctx.lineTo(_p.x, _p.y); } ctx.globalAlpha = a * sheetK * 0.8; ctx.stroke(); }
    // the network above, its output neuron on its way down
    nodes.forEach((nd, i) => { const q = net3[i]; proj(q.x, q.y, q.z, P[i]); });
    const o = net3[OUT]; const rimX = land.wx + RR * 0.92, rimZ = land.wz; let ox = mix(o.x, rimX, toRim), oy = mix(o.y, wellH(rimX, rimZ) + 0.35, toRim), oz = mix(o.z, rimZ, toRim);
    if (marble.on) { ox = mix(ox, bx, relK); oz = mix(oz, bz, relK); oy = mix(oy, wellH(bx, bz) + dent(bx, bz) + 0.35, relK); }
    proj(ox, oy, oz, P[OUT]); ballS.x = P[OUT].x; ballS.y = P[OUT].y;
    ctx.globalAlpha = a * 0.3; ctx.beginPath(); edges.forEach(e => { if (nodes[e.b].out) return; ctx.moveTo(P[e.a].x, P[e.a].y); ctx.lineTo(P[e.b].x, P[e.b].y); }); ctx.stroke();
    ctx.globalAlpha = a * 0.75; ctx.beginPath(); outEdges.forEach(e => { ctx.moveTo(P[e.a].x, P[e.a].y); ctx.lineTo(P[OUT].x, P[OUT].y); }); ctx.stroke();
    ctx.globalAlpha = a; outEdges.forEach((e, k) => { for (let b = 0; b < 3; b++) { const s = (t * 0.45 + b / 3 + k * 0.17) % 1; const x = mix(P[e.a].x, P[OUT].x, s), y = mix(P[e.a].y, P[OUT].y, s); ctx.fillRect(x - 2, y - 2, 4, 4); } });
    nodes.forEach((nd, i) => { if (nd.out) return; const q = P[i]; const rad = clamp(0.14 * q.s, 1.5, 30); ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, 6.2832); ctx.fill(); });
    // the shadow under the ball, then the ball
    proj(ox, wellH(ox, oz) + dent(ox, oz) + 0.02, oz, _q); const rb = clamp(0.3 * P[OUT].s, 3, 40) * (1 + 0.3 * toRim);
    ctx.globalAlpha = a * 0.35 * toRim; ctx.beginPath(); ctx.ellipse(_q.x, _q.y, rb * 1.1, rb * 0.45, 0, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(P[OUT].x, P[OUT].y, rb, 0, 6.2832); ctx.fill(); ctx.globalAlpha = a * 0.9; ctx.beginPath(); ctx.arc(P[OUT].x, P[OUT].y, rb * 1.55, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ───────── intro + loop ─────────
  let introT0 = null, introDone = false, introSkipped = false; const cap = document.getElementById('intro-cap');
  function finishIntro() { if (introDone) return; introDone = true; root.classList.remove('intro'); root.classList.add('ready'); window.dispatchEvent(new CustomEvent('introdone')); }
  window.introSkip = () => { introSkipped = true; finishIntro(); };
  document.getElementById('intro-skip')?.addEventListener('click', window.introSkip);
  const SCENES = { corridor: drawCorridor, pipes: drawPipes, radial: drawRadial, matrix: (p, a, t) => drawGrid(a, t, true, 0.5, p * 400) };
  const secScenes = Array.from(document.querySelectorAll('.sec')).filter(s => !s.classList.contains('final')).map(s => SCENES[s.dataset.scene] || drawCorridor);
  let lastNow = 0, running = true;
  function frame(now) {
    const t = now / 1000, dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60; lastNow = now;
    ctx.clearRect(0, 0, W, H);
    if (!introDone) {
      if (introT0 === null) introT0 = t; const it = (reduced || introSkipped) ? 99 : t - introT0;
      drawWaves(t, 1, Math.min(it, 3));
      if (cap) { const c = it < 0.8 ? 'Loading…' : it < 1.6 ? 'Initialising weights…' : 'Warming up the neurons…'; if (cap.textContent !== c) cap.textContent = c; }
      if (it >= 1.9 && !root.classList.contains('ready')) root.classList.add('ready');
      if (it >= 2.5) finishIntro();
      window.__it = it;
    } else {
      const T = window.T || { phase: 'hero', heroK: 1, finalU: 0, footK: 0, secs: [] };
      if (T.heroK > 0.01) drawWaves(t, T.heroK, null);
      const al = [];
      (T.secs || []).forEach((S, k) => { const w = smooth((S.entering - 0.3) / 0.7) * (1 - S.leaving); al.push(+w.toFixed(2)); if (w > 0.01 && secScenes[k]) secScenes[k](S.p, w, t); });
      if (T.finalU > 0) drawLandscape(T.finalU, smooth(T.finalU / 0.12) * (1 - 0.85 * smooth((T.footK - 0.05) / 0.6)), t, dt); else { marble.on = false; fallS = 0; depth = 0; }
      if (T.footK > 0.01) drawGrid(T.footK, t, false, 0.55, 0);
      window.__scene = { heroK: +T.heroK.toFixed(2), al, fin: +T.finalU.toFixed(2), foot: +T.footK.toFixed(2), depth: +depth.toFixed(2), marble: { u: +marble.u.toFixed(2), v: +marble.v.toFixed(2), on: marble.on }, ball: { x: Math.round(ballS.x), y: Math.round(ballS.y) } };
    }
    if (running) requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { const was = running; running = !document.hidden; if (running && !was) requestAnimationFrame(frame); });
  requestAnimationFrame(frame);
})();
