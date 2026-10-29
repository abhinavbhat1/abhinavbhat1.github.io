/* The boot: the mark is drawn by neurons. Dots fly in from everywhere and settle along the strokes, the strings between them
   draw as they land, the finished mark then shrinks into the header where the static mark takes over as the home button.
   About 1.7 s; a press skips it; reduced motion skips it entirely. */
(function () {
  'use strict';
  const root = document.documentElement, host = document.getElementById('boot'); if (!host) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { host.remove(); return; }
  root.classList.add('booting');
  const c = host.querySelector('canvas'), g = c.getContext('2d');
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); }, mix = (a, b, k) => a + (b - a) * k;
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // the mark, in a 100-box: the Λ and the chevron in ink, the offset lines in the accent
  const STROKES = [
    { col: 'ink', w: 0.055, r: 0.03, pts: [[5, 92], [24, 31], [65, 73]] },
    { col: 'ink', w: 0.055, r: 0.03, pts: [[76, 35], [97, 62], [64, 56], [71, 46], [76, 35]] },
    { col: 'accent', w: 0.024, r: 0.017, pts: [[26, 30], [66, 71]] },
    { col: 'accent', w: 0.024, r: 0.017, pts: [[3, 94], [80, 28]] },
    { col: 'accent', w: 0.024, r: 0.017, pts: [[5, 98], [82, 31]] },
    { col: 'accent', w: 0.024, r: 0.017, pts: [[79, 33], [99, 61]] },
    { col: 'accent', w: 0.024, r: 0.017, pts: [[64, 59], [99, 64]] }];
  const dots = [];
  STROKES.forEach(st => { st.seq = []; for (let j = 0; j < st.pts.length - 1; j++) { const [x0, y0] = st.pts[j], [x1, y1] = st.pts[j + 1]; const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6.5)); for (let q = (j === 0 ? 0 : 1); q <= n; q++) { const f = q / n; const d = { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, sx: 50 + (rnd() - 0.5) * 170, sy: 50 + (rnd() - 0.5) * 170, st }; st.seq.push(d); dots.push(d); } } });
  dots.sort(() => rnd() - 0.5).forEach((d, i) => { d.t0 = 0.06 + i * (0.5 / dots.length) + rnd() * 0.08; });
  const T_HOLD = 1.0, T_SHRINK = 1.42, T_END = 1.65; let t0 = 0, done = false, W = 0, H = 0;
  function size() { const dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function colours() { const cs = getComputedStyle(root); return { ink: cs.getPropertyValue('--ink').trim() || '#141414', accent: cs.getPropertyValue('--accent').trim() || '#2b5bd7' }; }
  function finish() { if (done) return; done = true; host.remove(); root.classList.remove('booting'); root.classList.add('ready'); window.dispatchEvent(new CustomEvent('booted')); }
  function frame(now) {
    if (done) return; if (!t0) t0 = now; const t = (now - t0) / 1000; if (W !== window.innerWidth || H !== window.innerHeight) size();
    const col = colours(); g.clearRect(0, 0, W, H);
    const mark = document.querySelector('.brand .mark'); const mr = mark ? mark.getBoundingClientRect() : { left: 24, top: 20, width: 30 };
    const S0 = Math.min(W, H) * 0.46, k = smooth((t - T_HOLD) / (T_SHRINK - T_HOLD)); const S = mix(S0, mr.width, k), ox = mix((W - S0) / 2, mr.left, k), oy = mix((H - S0) / 2 - H * 0.03, mr.top, k);
    const at = (d) => { const a = smooth((t - d.t0) / 0.45); const e = 1 - Math.pow(1 - a, 3); return { x: ox + mix(d.sx, d.x, e) / 100 * S, y: oy + mix(d.sy, d.y, e) / 100 * S, a }; };
    g.lineCap = 'round'; g.lineJoin = 'round';
    STROKES.forEach(st => { g.strokeStyle = col[st.col]; g.lineWidth = Math.max(1, S * st.w); for (let j = 0; j < st.seq.length - 1; j++) { const A = at(st.seq[j]), B = at(st.seq[j + 1]); const al = Math.min(A.a, B.a); if (al <= 0.01) continue; g.globalAlpha = al; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); } });
    const shrink = 1 - 0.9 * k;
    STROKES.forEach(st => { g.fillStyle = col[st.col]; st.seq.forEach(d => { const P = at(d); if (P.a <= 0.01) return; g.globalAlpha = 0.25 + 0.75 * P.a; g.beginPath(); g.arc(P.x, P.y, Math.max(0.6, S * st.r * shrink), 0, 6.2832); g.fill(); }); });
    g.globalAlpha = 1;
    host.style.opacity = t > T_SHRINK ? String(clamp(1 - (t - T_SHRINK) / (T_END - T_SHRINK))) : '1';
    if (t >= T_END) { finish(); return; }
    requestAnimationFrame(frame);
  }
  host.addEventListener('pointerdown', finish); size(); requestAnimationFrame(frame);
  window.__bootFinish = finish;
})();
