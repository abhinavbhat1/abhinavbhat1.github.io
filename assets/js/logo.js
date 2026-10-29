/* The boot: the logo is drawn in 3D, then bursts into the home page. The outlines of the mark are traced onto a plate that turns
   to face the camera, the faces fill and the plate gains depth, a light sweeps across it, and then it shatters outward while a
   flat copy flies to the header (where the static mark takes over as the home button) and the page shows through the pieces.
   About 2.1 s; a press skips it; reduced motion skips it entirely. */
(function () {
  'use strict';
  const root = document.documentElement, host = document.getElementById('boot'); if (!host) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { host.remove(); return; }
  root.classList.add('booting');
  const c = host.querySelector('canvas'), g = c.getContext('2d');
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); }, mix = (a, b, k) => a + (b - a) * k;
  let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // the logo as drawn: the two filled paths of the SVG (the ink and the accent), normalised so the plate spans x in [-1, 1]
  const D = { ink: 'M188.5 195.83C192.44 195.97 198.5 194.65 202.16 196.08C203.84 196.74 205.31 199.42 206.54 200.7C210.55 204.87 214.45 209.13 218.42 213.34C232.08 227.81 245.56 242.61 259.62 256.62C265.22 262.2 270.54 268.05 275.95 273.8C278.16 276.15 281.13 278.42 282.67 281.25C281.03 283.79 276.37 288.3 273.41 289.01C248.99 262.79 224.56 236.57 200.13 210.35C199.34 209.95 198.54 209.55 197.75 209.14C194.92 214.73 193.72 221.71 191.94 227.72C187.83 241.58 183.1 255.33 178.89 269.19C168.2 304.33 156.58 339.23 145.57 374.28C142.85 382.94 140.31 391.62 137.4 400.2C136.24 403.61 135.9 408.13 133.84 411.1C131.68 414.23 127.54 416.97 124.6 419.35C122.17 421.32 118.61 426.17 115.49 426.37C139.24 349.69 163 273 186.75 196.32C187.33 196.16 187.92 196 188.5 195.83ZM457.92 310.19C458.91 311.38 459.91 312.56 460.91 313.75C419.59 310.75 378.28 307.75 336.96 304.75C340.43 299.95 343.89 295.14 347.36 290.34C374.94 294.98 402.53 299.61 430.12 304.25C429.19 301.96 424.73 298.98 422.46 297.81C402.97 282.79 383.48 267.77 363.98 252.75C366.82 243.83 369.65 234.92 372.49 226C373.02 225.16 373.19 224.04 373.97 223.23C377.39 219.71 391.8 207.56 395.75 205.5C396.36 208.82 393.46 214.75 392.28 218.01C390.01 224.32 383.31 242.01 383.07 247.75C408.02 268.56 432.97 289.38 457.92 310.19ZM346.04 347.16C345.94 347.73 345.85 348.29 345.75 348.86C342.42 351.04 339.08 353.22 335.75 355.4C318.71 337.41 301.67 319.43 284.63 301.44C283.58 300.27 282.54 299.09 281.49 297.92C280.02 296.28 278.54 294.63 277.07 292.99C277.91 290.26 283.63 285.64 286.25 284.79C306.18 305.58 326.11 326.37 346.04 347.16Z', accent: 'M457.92 310.19C432.97 289.38 408.02 268.56 383.07 247.75C383.31 242.01 390.01 224.32 392.28 218.01C393.46 214.75 396.36 208.82 395.75 205.5C391.8 207.56 377.39 219.71 373.97 223.23C373.19 224.04 373.02 225.16 372.49 226C369.17 226.5 358.81 237.05 355.53 239.77C341.8 251.16 328.56 263.13 315.07 274.81C311.75 277.69 299.89 286.51 298.61 289.75C315.54 307.75 332.47 325.75 349.4 343.75C348.28 344.89 347.16 346.02 346.04 347.16C326.11 326.37 306.18 305.58 286.25 284.79C283.63 285.64 277.91 290.26 277.07 292.99C273.17 293.58 268.71 299.42 265.7 301.97C256.07 310.16 246.71 318.62 237.12 326.86C209.36 350.71 181.48 374.56 154.21 398.96C145.85 406.44 137.27 413.68 128.83 421.07C125.3 424.16 121.48 428.78 117.25 430.79C116.42 430.36 115.58 429.93 114.75 429.5C115 428.46 115.24 427.41 115.49 426.37C118.61 426.17 122.17 421.32 124.6 419.35C127.54 416.97 131.68 414.23 133.84 411.1C135.9 408.13 136.24 403.61 137.4 400.2C140.31 391.62 142.85 382.94 145.57 374.28C156.58 339.23 168.2 304.33 178.89 269.19C183.1 255.33 187.83 241.58 191.94 227.72C193.72 221.71 194.92 214.73 197.75 209.14C198.54 209.55 199.34 209.95 200.13 210.35C197.29 211.82 196.83 218.62 195.8 221.58C191.97 232.55 188.52 243.73 185.17 254.86C178.24 277.9 171.08 300.93 163.45 323.74C159.31 336.12 156.07 348.8 151.86 361.14C148.36 371.44 145.43 381.92 141.99 392.23C140.96 395.3 137.51 403.69 138.25 406.35C142.3 404.14 145.53 400.25 149.07 397.33C157.72 390.18 166.13 382.73 174.62 375.37C196.51 356.43 218.47 337.57 240.32 318.56C248.43 311.51 256.63 304.57 264.68 297.45C267.25 295.18 272.33 292.28 273.41 289.01C276.37 288.3 281.03 283.79 282.67 281.25C281.13 278.42 278.16 276.15 275.95 273.8C270.54 268.05 265.22 262.2 259.62 256.62C245.56 242.61 232.08 227.81 218.42 213.34C214.45 209.13 210.55 204.87 206.54 200.7C205.31 199.42 203.84 196.74 202.16 196.08C198.5 194.65 192.44 195.97 188.5 195.83C189.08 194.51 189.67 193.19 190.25 191.87C192.9 191.45 203.49 191.04 205.65 192.07C207.69 193.03 209.84 196.68 211.38 198.37C215.6 202.99 219.96 207.46 224.26 212C238.85 227.38 253.44 242.8 268.19 258.07C272.15 262.17 283.15 275.56 287.25 277.56C323.75 246.01 360.25 214.47 396.75 182.93C397.45 183.7 398.15 184.48 398.85 185.25C397.59 188.45 392.83 191.24 390.22 193.47C383.29 199.36 376.63 205.57 369.65 211.42C352.01 226.19 334.97 241.75 317.59 256.82C310.72 262.78 303.83 268.73 297.03 274.77C294.84 276.71 292.17 278.39 290.44 280.75C292.04 282.54 293.65 284.33 295.25 286.12C300.15 284.07 313.83 270.37 318.85 266.1C337.65 250.11 356.05 233.59 374.9 217.65C381.13 212.38 387.26 207 393.31 201.56C395.35 199.73 398.59 195.89 400.75 199.17C395.88 213.86 391 228.56 386.13 243.25C388.26 247.27 399.41 254.93 403.42 258.32C417.89 270.52 432.49 282.59 446.97 294.78C450.82 298.02 462.2 305.88 464.04 309.75C462 309.9 459.96 310.05 457.92 310.19ZM422.46 297.81C424.73 298.98 429.19 301.96 430.12 304.25C402.53 299.61 374.94 294.98 347.36 290.34C348.32 289.06 349.29 287.79 350.25 286.51C356.69 285.86 364.67 288.44 371.03 289.73C381.59 291.87 392.31 293.32 402.9 295.28C407.33 296.11 411.86 296.53 416.25 297.53C418.12 297.95 420.82 298.92 422.46 297.81ZM281.49 297.92C282.54 299.09 283.58 300.27 284.63 301.44C232 346.77 179.38 392.09 126.75 437.42C126.07 436.53 125.39 435.64 124.71 434.75C176.97 389.14 229.23 343.53 281.49 297.92Z' };
  const CX = 289.395, CY = 310.175, HW = 174.645, RATIO = 254.49 / 349.29;
  function flatten(d) { const subs = []; let cur = null, x = 0, y = 0; const tk = d.match(/[MCZ]|-?\d*\.?\d+/g); let i = 0;
    const P = (px, py) => [(px - CX) / HW, (py - CY) / HW];
    while (i < tk.length) { const t = tk[i++];
      if (t === 'M') { x = +tk[i++]; y = +tk[i++]; cur = [P(x, y)]; subs.push(cur); }
      else if (t === 'C') { const x1 = +tk[i++], y1 = +tk[i++], x2 = +tk[i++], y2 = +tk[i++], x3 = +tk[i++], y3 = +tk[i++]; for (let q = 1; q <= 6; q++) { const s = q / 6, u = 1 - s; cur.push(P(u * u * u * x + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s * x3, u * u * u * y + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s * y3)); } x = x3; y = y3; }
      else if (t === 'Z') { cur = null; } }
    return subs.map(pts => { const p = pts.concat([pts[0]]); const len = [0]; for (let j = 1; j < p.length; j++) len[j] = len[j - 1] + Math.hypot(p[j][0] - p[j - 1][0], p[j][1] - p[j - 1][1]); return { pts: p, len, L: len[len.length - 1] }; }); }
  const SHAPES = [{ col: 'ink', subs: flatten(D.ink) }, { col: 'accent', subs: flatten(D.accent) }];
  // the trace: every outline draws itself over half a second, the long ones first
  { const all = []; SHAPES.forEach(sh => sh.subs.forEach(s => all.push(s))); all.sort((a, b) => b.L - a.L); all.forEach((s, j) => { s.t0 = 0.04 + j * 0.1; s.dur = 0.5; }); }
  // the pieces it shatters into: a grid over the plate, kept where it lands inside a shape (even-odd, like the SVG)
  const inside = (subs, x, y) => { let n = 0; subs.forEach(s => { const p = s.pts; for (let j = 1; j < p.length; j++) { const [ax, ay] = p[j - 1], [bx, by] = p[j]; if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) n++; } }); return n & 1; };
  const shards = []; for (let gy = -RATIO; gy <= RATIO; gy += 0.042) for (let gx = -1; gx <= 1; gx += 0.042) { const jx = gx + (rnd() - 0.5) * 0.02, jy = gy + (rnd() - 0.5) * 0.02; SHAPES.forEach(sh => { if (inside(sh.subs, jx, jy)) shards.push({ x: jx, y: jy, col: sh.col, sz: 0.028 + rnd() * 0.02, sp: (rnd() - 0.5) * 9, X: 0, Y: 0, vx: 0, vy: 0, a: rnd() * 6.28 }); }); }
  // timeline
  const T_FILL = 0.78, T_HOLD = 1.28, T_BURST = 1.52, T_END = 2.1, PERSP = 2.7;
  let t0 = 0, done = false, W = 0, H = 0, burstInit = false, lastT = 0;
  function size() { const dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(ch => ch + ch).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const mixc = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${Math.round(mix(A[0], B[0], k))},${Math.round(mix(A[1], B[1], k))},${Math.round(mix(A[2], B[2], k))})`; };
  function colours() { const cs = getComputedStyle(root); const ink = cs.getPropertyValue('--ink').trim() || '#141414', accent = cs.getPropertyValue('--accent').trim() || '#2b5bd7', bg = cs.getPropertyValue('--bg').trim() || '#fbfbf9'; return { ink, accent, bg, side: { ink: mixc(ink, bg, 0.42), accent: mixc(accent, bg, 0.42) }, dark: root.getAttribute('data-theme') === 'dark' }; }
  function finish() { if (done) return; done = true; host.remove(); root.classList.remove('booting'); root.classList.add('ready'); window.dispatchEvent(new CustomEvent('booted')); }
  // the plate: yaw about the vertical axis, pitch about the horizontal, perspective
  const P = { yaw: 0, pitch: 0, S: 100, ox: 0, oy: 0 };
  function pose(t) { const k = smooth((t - 0.02) / 1.3), w = 1 - k; P.yaw = mix(-1.05, 0, k) + 0.1 * w * Math.sin(t * 3.1); P.pitch = mix(0.42, 0, k) + 0.07 * w * Math.cos(t * 2.3); P.S = Math.min(W * 0.29, H * 0.4); P.ox = W / 2 + 0.06 * W * w * Math.sin(t * 1.7); P.oy = H / 2 - H * 0.02; }
  function pr(x, y, z, o) { const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw); const xr = x * cy + z * sy; let zr = -x * sy + z * cy; const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch); const yr = y * cp - zr * sp; zr = y * sp + zr * cp; const k = PERSP / (PERSP + zr); o.x = P.ox + xr * P.S * k; o.y = P.oy + yr * P.S * k; o.k = k; return o; }
  const _o = { x: 0, y: 0, k: 1 };
  function facePath(sh, z) { g.beginPath(); sh.subs.forEach(s => { s.pts.forEach((p, j) => { pr(p[0], p[1], z, _o); if (j === 0) g.moveTo(_o.x, _o.y); else g.lineTo(_o.x, _o.y); }); g.closePath(); }); }
  function frame(now) {
    if (done) return; if (!t0) t0 = now; const t = (now - t0) / 1000, dt = Math.min(0.05, t - lastT); lastT = t; if (W !== window.innerWidth || H !== window.innerHeight) size();
    const col = colours(); g.clearRect(0, 0, W, H);
    const b = clamp((t - T_BURST) / (T_END - T_BURST));
    // the page shows through once the burst starts
    if (t >= T_BURST) { if (!burstInit) { burstInit = true; host.style.background = 'transparent'; root.classList.add('ready'); pose(T_BURST); shards.forEach(s => { pr(s.x, s.y, 0, _o); s.X = _o.x; s.Y = _o.y; const dx = _o.x - P.ox, dy = _o.y - P.oy, d = Math.hypot(dx, dy) || 1; const v = (0.9 + 1.6 * rnd()) * Math.min(W, H) * 0.9; s.vx = dx / d * v + (rnd() - 0.5) * 260; s.vy = dy / d * v + (rnd() - 0.5) * 260 - 120; }); }
      g.globalAlpha = 1 - smooth(b / 0.75); g.fillStyle = col.bg; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    else { g.globalAlpha = 1; g.fillStyle = col.bg; g.fillRect(0, 0, W, H); }
    if (t < T_BURST) {
      pose(t); const fa = smooth((t - T_FILL) / 0.35), depth = 0.075 * smooth((t - (T_FILL - 0.05)) / 0.45);
      // the sides: the plate extruded away from the camera, slice by slice, back to front
      if (depth > 0.001) { const n = 7; for (let j = n; j >= 1; j--) { const z = -depth * j / n; SHAPES.forEach(sh => { g.fillStyle = col.side[sh.col]; g.globalAlpha = fa; facePath(sh, z); g.fill('evenodd'); }); } }
      // the faces
      if (fa > 0.001) SHAPES.forEach(sh => { g.fillStyle = col[sh.col]; g.globalAlpha = fa; facePath(sh, 0); g.fill('evenodd'); });
      // the light sweeping across the faces while it holds
      const sw = (t - (T_FILL + 0.12)) / 0.55; if (sw > 0 && sw < 1 && fa > 0.5) { g.save(); facePath(SHAPES[0], 0); SHAPES[1].subs.forEach(s => { s.pts.forEach((p, j) => { pr(p[0], p[1], 0, _o); if (j === 0) g.moveTo(_o.x, _o.y); else g.lineTo(_o.x, _o.y); }); g.closePath(); }); g.clip('evenodd');
        const x0 = P.ox + mix(-1.6, 1.6, sw) * P.S; const gr = g.createLinearGradient(x0 - 0.5 * P.S, 0, x0 + 0.5 * P.S, 0); const lc = col.dark ? '255,255,255' : '255,255,255'; gr.addColorStop(0, `rgba(${lc},0)`); gr.addColorStop(0.5, `rgba(${lc},${col.dark ? 0.28 : 0.5})`); gr.addColorStop(1, `rgba(${lc},0)`); g.fillStyle = gr; g.globalAlpha = fa; g.fillRect(0, 0, W, H); g.restore(); }
      // the trace: each outline draws itself out with a bright tip, then thins as the face fills behind it
      g.lineCap = 'round'; g.lineJoin = 'round';
      SHAPES.forEach(sh => sh.subs.forEach(s => { const q = clamp((t - s.t0) / s.dur); if (q <= 0) return; const e = 1 - Math.pow(1 - q, 2.2), upto = e * s.L; const p = s.pts, L = s.len;
        g.strokeStyle = col[sh.col]; g.lineWidth = Math.max(1.2, P.S * 0.011) * (1 - 0.5 * fa); g.globalAlpha = 0.95 - 0.55 * fa; g.beginPath(); let tip = null;
        for (let j = 0; j < p.length; j++) { if (L[j] > upto) { const f = (upto - L[j - 1]) / Math.max(1e-6, L[j] - L[j - 1]); const x = mix(p[j - 1][0], p[j][0], f), y = mix(p[j - 1][1], p[j][1], f); pr(x, y, 0, _o); g.lineTo(_o.x, _o.y); tip = { x: _o.x, y: _o.y }; break; } pr(p[j][0], p[j][1], 0, _o); if (j === 0) g.moveTo(_o.x, _o.y); else g.lineTo(_o.x, _o.y); }
        g.stroke();
        if (tip && q < 1) { g.fillStyle = col.accent; g.globalAlpha = 0.9; g.beginPath(); g.arc(tip.x, tip.y, Math.max(2, P.S * 0.016), 0, 6.2832); g.fill(); g.globalAlpha = 0.25; g.beginPath(); g.arc(tip.x, tip.y, Math.max(5, P.S * 0.04), 0, 6.2832); g.fill(); } }));
    } else {
      // the burst: the pieces fly outward and fade; a flat copy flies to the header and lands on the static mark
      const k = smooth(b / 0.78), drag = Math.exp(-dt * 1.6), S0 = Math.min(W * 0.29, H * 0.4);
      shards.forEach(s => { s.vx *= drag; s.vy = s.vy * drag + 500 * dt; s.X += s.vx * dt; s.Y += s.vy * dt; s.a += s.sp * dt; const r = s.sz * S0 * (1 - 0.6 * b); if (r < 0.3) return; g.save(); g.translate(s.X, s.Y); g.rotate(s.a); g.fillStyle = col[s.col]; g.globalAlpha = 0.95 * (1 - smooth((b - 0.35) / 0.65)); g.fillRect(-r / 2, -r / 2, r, r); g.restore(); });
      const mark = document.querySelector('.brand .mark'); const mr = mark ? mark.getBoundingClientRect() : { left: 24, top: 20, width: 34, height: 25 };
      P.yaw = 0; P.pitch = 0; const S1 = mr.width * 0.4906; P.S = Math.exp(mix(Math.log(Math.min(W * 0.29, H * 0.4)), Math.log(S1), k)); P.ox = mix(W / 2, mr.left + mr.width / 2, k); P.oy = mix(H / 2 - H * 0.02, mr.top + mr.height / 2, k);
      SHAPES.forEach(sh => { g.fillStyle = col[sh.col]; g.globalAlpha = 1; facePath(sh, 0); g.fill('evenodd'); });
    }
    g.globalAlpha = 1;
    if (t >= T_END) { finish(); return; }
    requestAnimationFrame(frame);
  }
  host.addEventListener('pointerdown', finish); size(); requestAnimationFrame(frame);
  window.__bootFinish = finish; window.__bootShards = shards.length; window.__bootT = () => t0 ? (performance.now() - t0) / 1000 : 0;
})();
