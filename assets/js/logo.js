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
  // the mark, traced from the logo into a 100 x 73 box: the Λ (a heavier left leg), the chevron with its thin spike, and the
  // red lines of the original as accent lines: along the right leg, the two long diagonals, and under the chevron's lower arm
  const STROKES = [
    { col: 'ink', w: 0.0520, r: 0.0286, pts: [[0.8, 69.9], [23.3, 3.8]] },
    { col: 'ink', w: 0.0390, r: 0.0215, pts: [[23.3, 3.8], [65.9, 48.9]] },
    { col: 'ink', w: 0.0400, r: 0.0220, pts: [[80, 4.5], [98.5, 36.8]] },
    { col: 'ink', w: 0.0240, r: 0.0132, pts: [[80, 4.5], [71.9, 18.8]] },
    { col: 'ink', w: 0.0390, r: 0.0215, pts: [[98.5, 36.8], [63.9, 34.6]] },
    { col: 'ink', w: 0.0260, r: 0.0143, pts: [[63.9, 34.6], [68.6, 30.2]] },
    { col: 'accent', w: 0.014, r: 0.011, pts: [[25.3, 1.9], [67.9, 47.0]] },
    { col: 'accent', w: 0.014, r: 0.011, pts: [[0.6, 72.6], [80.3, 0.8]] },
    { col: 'accent', w: 0.014, r: 0.011, pts: [[2.7, 71.6], [82.1, 3.3]] },
    { col: 'accent', w: 0.014, r: 0.011, pts: [[63.6, 37.6], [98.4, 39.8]] }];
  const BOX_H = 0.73;
  const dots = [];
  STROKES.forEach(st => { st.seq = []; for (let j = 0; j < st.pts.length - 1; j++) { const [x0, y0] = st.pts[j], [x1, y1] = st.pts[j + 1]; const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 5.5)); for (let q = (j === 0 ? 0 : 1); q <= n; q++) { const f = q / n; const d = { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, sx: 50 + (rnd() - 0.5) * 170, sy: 36 + (rnd() - 0.5) * 150, st }; st.seq.push(d); dots.push(d); } } });
  dots.sort(() => rnd() - 0.5).forEach((d, i) => { d.t0 = 0.06 + i * (0.4 / dots.length) + rnd() * 0.06; });
  // every neuron has landed and melted into its stroke by the hold
  const T_HOLD = 1.25, T_SHRINK = 1.6, T_END = 1.8; let t0 = 0, done = false, W = 0, H = 0;
  function size() { const dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function colours() { const cs = getComputedStyle(root); return { ink: cs.getPropertyValue('--ink').trim() || '#141414', accent: cs.getPropertyValue('--accent').trim() || '#2b5bd7' }; }
  function finish() { if (done) return; done = true; host.remove(); root.classList.remove('booting'); root.classList.add('ready'); window.dispatchEvent(new CustomEvent('booted')); }
  function frame(now) {
    if (done) return; if (!t0) t0 = now; const t = (now - t0) / 1000; if (W !== window.innerWidth || H !== window.innerHeight) size();
    const col = colours(); g.clearRect(0, 0, W, H);
    const mark = document.querySelector('.brand .mark'); const mr = mark ? mark.getBoundingClientRect() : { left: 24, top: 20, width: 30 };
    const S0 = Math.min(W * 0.62, H * 0.6 / BOX_H), k = smooth((t - T_HOLD) / (T_SHRINK - T_HOLD)); const S = mix(S0, mr.width, k), ox = mix((W - S0) / 2, mr.left, k), oy = mix((H - S0 * BOX_H) / 2 - H * 0.02, mr.top, k);
    const at = (d) => { const a = smooth((t - d.t0) / 0.45); const e = 1 - Math.pow(1 - a, 3); return { x: ox + mix(d.sx, d.x, e) / 100 * S, y: oy + mix(d.sy, d.y, e) / 100 * S, a }; };
    g.lineCap = 'round'; g.lineJoin = 'round';
    STROKES.forEach(st => { g.strokeStyle = col[st.col]; g.lineWidth = Math.max(1, S * st.w); for (let j = 0; j < st.seq.length - 1; j++) { const A = at(st.seq[j]), B = at(st.seq[j + 1]); const al = Math.min(A.a, B.a); if (al <= 0.01) continue; g.globalAlpha = al; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); } });
    STROKES.forEach(st => { g.fillStyle = col[st.col]; st.seq.forEach(d => { const P = at(d); const gone = smooth((t - d.t0 - 0.45) / 0.28); if (gone >= 1) return; g.globalAlpha = (0.3 + 0.7 * P.a) * (1 - gone); g.beginPath(); g.arc(P.x, P.y, S * st.r * (1 + 0.6 * (1 - P.a)), 0, 6.2832); g.fill(); }); });
    g.globalAlpha = 1;
    host.style.opacity = t > T_SHRINK ? String(clamp(1 - (t - T_SHRINK) / (T_END - T_SHRINK))) : '1';
    if (t >= T_END) { finish(); return; }
    requestAnimationFrame(frame);
  }
  host.addEventListener('pointerdown', finish); size(); requestAnimationFrame(frame);
  window.__bootFinish = finish;
})();
