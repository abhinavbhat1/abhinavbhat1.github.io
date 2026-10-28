/* The drawing. Journey mode: the network (About → Research → Experience → Education → Skills → Contact) sits beside the
   name; scrolling zooms onto each layer in turn, every neuron bursts out into its card and sucks back in before the next,
   and the last beat is the output neuron. Whatever is not in focus stays behind as beads on strings: drag a bead, pluck a
   string, and the network reverberates. Boring mode: the document, with small architecture diagrams (MLP, LSTM,
   Transformer, CNN, RNN, GNN) floating behind it; hover to wiggle, drag to move, click to break. */
(function () {
  'use strict';
  const root = document.documentElement; const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)); const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); }; const mix = (a, b, k) => a + (b - a) * k;
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const col = { ink: '#141414', accent: '#2b5bd7', bg: '#fbfbf9', dim: '#9a9a96' };
  function theme() { const cs = getComputedStyle(root); for (const k of ['ink', 'accent', 'bg', 'dim']) { const v = cs.getPropertyValue('--' + k).trim(); if (v) col[k] = v; } }
  theme(); window.addEventListener('themechange', theme);
  const canvas = document.getElementById('bg'), g = canvas.getContext('2d'); let W = 1, H = 1;
  function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); layoutSpacer(); buildGadgets(); }
  const narrow = () => W < 900; const mode = () => (window.currentMode ? window.currentMode() : 'journey');
  const MONO = "ui-monospace, 'SF Mono', Menlo, monospace", SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif";
  const HEAD = () => (narrow() ? 62 : 70);

  // ───────── the network, in world units: one layer per section, one neuron per entry ─────────
  const LAYERS = window.LAYERS || []; const counts = LAYERS.map(L => L.cards.length); const NLy = counts.length, Lmax = NLy - 1;
  const r0 = rng(21); const nodes = [], byL = [];
  counts.forEach((n, k) => { const row = []; for (let i = 0; i < n; i++) { const nd = { k, i, n, x: k + (r0() - 0.5) * 0.06, y: (i - (n - 1) / 2) * 0.5 + (n > 1 ? (r0() - 0.5) * 0.05 : 0), ox: 0, oy: 0, vx: 0, vy: 0, out: k === Lmax, short: LAYERS[k].cards[i].short, bPrev: 0 }; nodes.push(nd); row.push(nd); } byL.push(row); });
  const edges = []; { const r = rng(99); for (let k = 0; k < Lmax; k++) byL[k].forEach(A => byL[k + 1].forEach(B => edges.push({ A, B, k: k + 1, w: (r() - 0.5) * 2, amp: 0, t0: -9, ph: r() * 6.28 }))); }
  const adj = new Map(); nodes.forEach(nd => adj.set(nd, [])); edges.forEach(e => { adj.get(e.A).push(e); adj.get(e.B).push(e); });
  const spanK = (k) => (counts[k] - 1) * 0.5; const maxSpan = Math.max(...counts.map((_, k) => spanK(k)));

  // ───────── camera ─────────
  const cam = { cx: 0, cy: 0, s: 100 }; let camInit = false;
  const toScreen = (x, y) => ({ x: W / 2 + (x - cam.cx) * cam.s, y: H / 2 + (y - cam.cy) * cam.s });
  const toWorld = (sx, sy) => ({ x: cam.cx + (sx - W / 2) / cam.s, y: cam.cy + (sy - H / 2) / cam.s });
  const pose = (wx, wy, ax, ay, s) => ({ cx: wx - (ax - W / 2) / s, cy: wy - (ay - H / 2) / s, s });
  function poseHero() { const m = narrow(); if (m) { const copy = document.getElementById('hero-copy'); const top = HEAD() + 16, bot = copy ? Math.max(top + 120, copy.getBoundingClientRect().top - 28) : H * 0.42; const s = Math.min(W * 0.9 / Lmax, (bot - top - 22) / (2 * maxSpan + 0.7)); return pose(Lmax / 2, 0, W / 2, (top + bot) / 2 - 4, s); } const s = Math.min(W * 0.42 / Lmax, H * 0.6 / (maxSpan + 0.35)); return pose(Lmax / 2, 0, W * 0.745, H * 0.52, s); }
  function poseLayer(k) { const m = narrow(); const s = m ? Math.min(W * 0.5, H * 0.3 / (spanK(k) + 0.4)) : Math.min(W * 0.36, H * 0.6 / (spanK(k) + 0.4)); return pose(k, 0, m ? W / 2 : W * 0.3, m ? H * 0.25 : H * 0.52, s); }
  function poseNeuron(k, i) { const p = poseLayer(k); p.cy += 0.45 * byL[k][i].y; return p; }
  // keyframes along the scroll, in beats
  const kfs = [], layerStart = []; let total = 0;
  { let u = 0; kfs.push({ u: 0, f: poseHero }); kfs.push({ u: 1, f: poseHero });
    for (let k = 0; k < NLy; k++) { const uE = u + 0.5; layerStart[k] = uE; kfs.push({ u: uE, f: () => poseLayer(k) }); for (let i = 0; i < counts[k]; i++) kfs.push({ u: uE + i + 0.5, f: ((kk, ii) => () => poseNeuron(kk, ii))(k, i) }); u = uE + counts[k]; }
    total = u + 0.6; kfs.push({ u: total, f: () => poseNeuron(Lmax, 0) }); }
  const BEAT = () => H * 0.8;
  const spacer = document.getElementById('spacer');
  function layoutSpacer() { if (spacer) spacer.style.height = Math.round(total * BEAT() + H) + 'px'; }
  function poseAt(u) { if (u <= kfs[0].u) return kfs[0].f(); for (let j = 1; j < kfs.length; j++) { if (u <= kfs[j].u) { const a = kfs[j - 1], b = kfs[j]; const f = (u - a.u) / Math.max(1e-6, b.u - a.u); const pa = a.f(), pb = b.f(); return { cx: mix(pa.cx, pb.cx, f), cy: mix(pa.cy, pb.cy, f), s: Math.exp(mix(Math.log(pa.s), Math.log(pb.s), f)) }; } } return kfs[kfs.length - 1].f(); }
  const burstOf = (k, i, u) => { const local = u - (layerStart[k] + i); if (local < 0) return 0; if (k === Lmax) return smooth(local / 0.3); if (local >= 1) return 0; return smooth(local / 0.3) * (1 - smooth((local - 0.7) / 0.3)); };
  const layerWeight = (k, u) => smooth((u - (layerStart[k] - 0.55)) / 0.4) * (1 - smooth((u - (layerStart[k] + counts[k] - 0.05)) / 0.45)) * (k === Lmax ? 1 : 1) + (k === Lmax ? smooth((u - (layerStart[k] + counts[k] - 0.05)) / 0.45) : 0);
  window.jumpToLayer = (id) => { const k = LAYERS.findIndex(L => L.id === id); if (k < 0) return; window.scrollTo({ top: Math.round((layerStart[k] + 0.35) * BEAT()), behavior: reduced ? 'auto' : 'smooth' }); };
  window.resetJourney = () => { sv = 0; const p = poseHero(); cam.cx = p.cx; cam.cy = p.cy; cam.s = p.s; };

  // ───────── pointer: beads on strings (journey) and gadgets (boring) ─────────
  const ptr = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, vx: 0, vy: 0, down: false, t: 0 }; let dragNode = null, dragGad = null, downAt = { x: 0, y: 0, t: 0 };
  const interactive = (t) => !!(t && t.closest && t.closest('a, button, details, summary, input, label, select, .jcard, .top, .focus'));
  window.addEventListener('pointermove', (e) => { ptr.px = ptr.x; ptr.py = ptr.y; ptr.x = e.clientX; ptr.y = e.clientY; const now = performance.now(); const dt = Math.max(8, now - ptr.t) / 1000; ptr.vx = (ptr.x - ptr.px) / dt; ptr.vy = (ptr.y - ptr.py) / dt; ptr.t = now;
    if (dragNode) { const w = toWorld(ptr.x, ptr.y); dragNode.ox = w.x - dragNode.x; dragNode.oy = w.y - dragNode.y; dragNode.vx = dragNode.vy = 0; }
    if (dragGad) { dragGad.cx = ptr.x - dragGad.gx; dragGad.cy = ptr.y - dragGad.gy; } }, { passive: true });
  window.addEventListener('pointerdown', (e) => { if (e.button !== 0 || interactive(e.target)) return; ptr.x = e.clientX; ptr.y = e.clientY; ptr.down = true; downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (mode() === 'journey') { let best = null, bd = 26; nodes.forEach(nd => { const s = toScreen(nd.x + nd.ox, nd.y + nd.oy); const d = Math.hypot(s.x - e.clientX, s.y - e.clientY); if (d < bd) { bd = d; best = nd; } }); if (best) { dragNode = best; e.preventDefault(); } }
    else { let best = null, bd = 1e9; gadgets.forEach(gd => { const d = Math.hypot(gd.cx - e.clientX, gd.cy - e.clientY); if (d < gd.sz * 1.6 && d < bd) { bd = d; best = gd; } }); if (best) { dragGad = best; best.gx = e.clientX - best.cx; best.gy = e.clientY - best.cy; best.drag = true; e.preventDefault(); } } });
  window.addEventListener('pointerup', () => { ptr.down = false;
    if (dragNode) { const sp = Math.hypot(ptr.vx, ptr.vy) / cam.s; dragNode.vx = ptr.vx / cam.s * 0.6; dragNode.vy = ptr.vy / cam.s * 0.6; pluck(dragNode, clamp(0.04 + sp * 0.08, 0.04, 0.22)); dragNode = null; }
    if (dragGad) { const moved = Math.hypot(ptr.x - downAt.x, ptr.y - downAt.y), held = performance.now() - downAt.t; dragGad.drag = false; if (moved < 6 && held < 400) breakGadget(dragGad); dragGad = null; } });
  window.addEventListener('pointercancel', () => { ptr.down = false; dragNode = null; if (dragGad) dragGad.drag = false; dragGad = null; });
  function pluck(nd, amp) { adj.get(nd).forEach(e => { if (e.amp * Math.exp(-2.2 * (tNow - e.t0)) < amp) { e.amp = amp; e.t0 = tNow; } }); }
  let tNow = 0;

  // ───────── journey ─────────
  const heroCopy = document.getElementById('hero-copy'), jlabel = document.getElementById('jlabel');
  let sv = 0, lastJ = '';
  function drawJourney(t, dt) {
    const target = window.scrollY; sv += (target - sv) * (reduced ? 1 : 1 - Math.exp(-dt * 10)); if (Math.abs(target - sv) < 0.3) sv = target;
    const u = sv / BEAT(); const p = poseAt(u);
    if (!camInit) { cam.cx = p.cx; cam.cy = p.cy; cam.s = p.s; camInit = true; } else { const k = 1 - Math.exp(-dt * 7); cam.cx += (p.cx - cam.cx) * k; cam.cy += (p.cy - cam.cy) * k; cam.s = Math.exp(Math.log(cam.s) + (Math.log(p.s) - Math.log(cam.s)) * k); }
    const heroK = 1 - smooth((u - 0.1) / 0.7), zoomK = smooth((u - 0.5) / 0.7);
    if (heroCopy) { heroCopy.style.opacity = heroK.toFixed(3); heroCopy.style.transform = `translateY(${(-24 * (1 - heroK)).toFixed(1)}px)`; heroCopy.style.visibility = heroK > 0.01 ? '' : 'hidden'; }
    const lw = counts.map((_, k) => layerWeight(k, u)); let activeK = -1, aw = 0.25; lw.forEach((w, k) => { if (w > aw) { aw = w; activeK = k; } });
    // physics: beads spring home, the pointer pushes what it passes, strings ring down
    nodes.forEach(nd => { if (nd === dragNode) return; const s = toScreen(nd.x + nd.ox, nd.y + nd.oy); const dx = s.x - ptr.x, dy = s.y - ptr.y, d = Math.hypot(dx, dy); let fx = -30 * nd.ox - 4.5 * nd.vx, fy = -30 * nd.oy - 4.5 * nd.vy;
      if (d < 70 && d > 0.1 && !ptr.down) { const f = (1 - d / 70) * 2.2 / cam.s * 60; fx += dx / d * f; fy += dy / d * f; if (Math.random() < 0.08) pluck(nd, 0.03); }
      nd.vx += fx * dt; nd.vy += fy * dt; nd.ox += nd.vx * dt; nd.oy += nd.vy * dt; });
    g.clearRect(0, 0, W, H); g.lineWidth = 1;
    // strings
    edges.forEach(e => { const A = toScreen(e.A.x + e.A.ox, e.A.y + e.A.oy), B = toScreen(e.B.x + e.B.ox, e.B.y + e.B.oy); const inFocus = Math.max(lw[e.k - 1] || 0, lw[e.k] || 0);
      g.strokeStyle = col.ink; g.globalAlpha = 0.07 + 0.08 * Math.abs(e.w) + 0.12 * inFocus * zoomK; g.beginPath();
      const age = t - e.t0, ampS = Math.min(42, e.amp * cam.s) * Math.exp(-2.2 * age);
      if (ampS > 0.35) { const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; for (let j = 0; j <= 16; j++) { const s = j / 16; const off = ampS * (Math.sin(Math.PI * s) * Math.cos(2 * Math.PI * 2.1 * age + e.ph) + 0.45 * Math.sin(2 * Math.PI * s) * Math.cos(2 * Math.PI * 3.3 * age) * Math.exp(-0.8 * age)); const x = A.x + dx * s + nx * off, y = A.y + dy * s + ny * off; if (j === 0) g.moveTo(x, y); else g.lineTo(x, y); } }
      else { g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); }
      g.stroke();
      // signals flowing into the layer in focus
      if (zoomK > 0.05 && lw[e.k] > 0.05) { g.fillStyle = col.accent; for (let j = 0; j < 2; j++) { const s = (t * 0.22 + j * 0.5 + e.ph * 0.1) % 1; g.globalAlpha = 0.45 * lw[e.k] * zoomK * Math.sin(Math.PI * s); g.beginPath(); g.arc(mix(A.x, B.x, s), mix(A.y, B.y, s), 1.6, 0, 6.2832); g.fill(); } } });
    // beads, bursts, labels
    const Rb = Math.min(W, H) * 0.14; const bursts = []; g.textBaseline = 'middle';
    nodes.forEach(nd => { const s = toScreen(nd.x + nd.ox, nd.y + nd.oy); const r = clamp(0.045 * cam.s, 3.5, 13) * (nd.out ? 1.5 : 1); const b = burstOf(nd.k, nd.i, u); const focus = lw[nd.k];
      if (b > 0.05 && nd.bPrev <= 0.05) pluck(nd, 0.07); nd.bPrev = b;
      if (b > 0.002) { bursts.push({ nd, b, s, R: r + b * Rb }); g.fillStyle = col.accent; g.globalAlpha = 0.07 * b; g.beginPath(); g.arc(s.x, s.y, r + b * Rb, 0, 6.2832); g.fill(); g.strokeStyle = col.accent; g.globalAlpha = 0.55 * b; g.beginPath(); g.arc(s.x, s.y, r + b * Rb, 0, 6.2832); g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = col.bg; g.beginPath(); g.arc(s.x, s.y, r, 0, 6.2832); g.fill();
      g.strokeStyle = b > 0.01 ? col.accent : col.ink; g.globalAlpha = 0.4 + 0.5 * focus * zoomK + 0.4 * b; g.lineWidth = 1 + 0.6 * focus * zoomK; g.beginPath(); g.arc(s.x, s.y, r, 0, 6.2832); g.stroke(); g.lineWidth = 1;
      if (b > 0.01) { g.fillStyle = col.accent; g.globalAlpha = b; g.beginPath(); g.arc(s.x, s.y, r * (0.4 + 0.6 * b), 0, 6.2832); g.fill(); }
      // the neuron's name while its layer is in focus
      const la = focus * zoomK * (1 - b) * (cam.s > 160 ? 1 : 0); if (la > 0.03 && nd.short) { g.fillStyle = col.ink; g.globalAlpha = 0.65 * la; g.font = `500 12px ${SANS}`; g.textAlign = narrow() ? 'center' : 'left'; g.fillText(nd.short, narrow() ? s.x : s.x + r + 9, narrow() ? s.y + r + 11 : s.y); } });
    // layer names under the columns while the whole network is in view
    if (zoomK < 0.98 && cam.s > 58) { g.fillStyle = col.dim; g.globalAlpha = 0.9 * (1 - zoomK); g.font = `500 11px ${SANS}`; g.textAlign = 'center'; LAYERS.forEach((L, k) => { const s = toScreen(k, maxSpan + 0.45); g.fillText(L.name, s.x, s.y); }); }
    g.globalAlpha = 1;
    // cards
    LAYERS.forEach((L, k) => L.cards.forEach((c, i) => { const nd = byL[k][i]; const b = burstOf(k, i, u); const el = c.el;
      if (b <= 0.002) { if (el.classList.contains('on')) { el.classList.remove('on'); el.style.opacity = '0'; } return; }
      const s = toScreen(nd.x + nd.ox, nd.y + nd.oy); const R = clamp(0.045 * cam.s, 3.5, 13) + b * Rb; el.classList.add('on');
      const cw = el.offsetWidth, ch = el.offsetHeight; let left, top;
      if (narrow()) { left = 16; top = Math.max(s.y + R + 14, H * 0.4); el.style.maxHeight = (H - top - 12) + 'px'; }
      else { left = s.x + R + 26; if (left + cw > W - 16) left = s.x - R - 26 - cw; top = clamp(s.y - ch / 2, HEAD() + 12, Math.max(HEAD() + 12, H - ch - 12)); el.style.maxHeight = ''; }
      const tx = (s.x - (left + cw / 2)) * (1 - b), ty = (s.y - (top + ch / 2)) * (1 - b);
      el.style.left = left.toFixed(1) + 'px'; el.style.top = top.toFixed(1) + 'px'; el.style.opacity = smooth(b * 1.3).toFixed(3); el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${(0.55 + 0.45 * b).toFixed(3)})`; }));
    // the small label
    if (jlabel) { let txt = ''; if (activeK >= 0 && zoomK > 0.5) { const L = LAYERS[activeK]; let ni = -1, nb = 0; byL[activeK].forEach((nd, i) => { const b = burstOf(activeK, i, u); if (b > nb) { nb = b; ni = i; } }); txt = `<b>${String(activeK).padStart(2, '0')}</b>${L.name}` + (nb > 0.3 ? ` · ${ni + 1} / ${counts[activeK]}` : ''); } if (txt !== lastJ) { lastJ = txt; jlabel.innerHTML = txt; } jlabel.classList.toggle('show', !!txt); }
    window.__J = { u: +u.toFixed(2), activeK, zoomK: +zoomK.toFixed(2), heroK: +heroK.toFixed(2), bursts: bursts.map(x => [x.nd.k, x.nd.i, +x.b.toFixed(2)]), cam: { cx: +cam.cx.toFixed(2), cy: +cam.cy.toFixed(2), s: Math.round(cam.s) }, dragging: !!dragNode, maxAmp: +Math.max(0, ...edges.map(e => e.amp * Math.exp(-2.2 * (t - e.t0)))).toFixed(3), maxOff: +Math.max(...nodes.map(n => Math.hypot(n.ox, n.oy))).toFixed(3), total: +total.toFixed(2), beat: Math.round(BEAT()) };
    window.__nodeScreen = (k, i) => { const nd = byL[k][i]; return toScreen(nd.x + nd.ox, nd.y + nd.oy); };
  }

  // ───────── boring mode: floating architectures ─────────
  let gadgets = [];
  function makeGadget(kind, cx, cy, sz, seed) {
    const parts = [], links = []; const P = (x, y, c) => { parts.push({ rx: x, ry: y, x: cx + x, y: cy + y, vx: 0, vy: 0, c: !!c }); return parts.length - 1; }; const Lk = (a, b) => links.push([a, b]); const box = (x0, y0, x1, y1) => { const b = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]; Lk(b[0], b[1]); Lk(b[1], b[2]); Lk(b[2], b[3]); Lk(b[3], b[0]); return b; };
    if (kind === 'MLP') { const lay = [3, 4, 2]; const ids = lay.map((n, k) => Array.from({ length: n }, (_, i) => P((k - 1) * sz * 0.95, (i - (n - 1) / 2) * sz * 0.48, true))); for (let k = 0; k < 2; k++) ids[k].forEach(a => ids[k + 1].forEach(b => Lk(a, b))); }
    else if (kind === 'LSTM cell') { const w = sz * 1.3, h = sz * 0.75; box(-w, -h, w, h); const gates = [-0.6, -0.2, 0.2, 0.6].map(f => P(f * w, h * 0.25, true)); const inp = P(-w * 1.4, h * 0.6), out = P(w * 1.4, -h * 0.6); gates.forEach(gt => Lk(inp, gt)); const top = [-0.6, -0.2, 0.2, 0.6].map(f => P(f * w, -h * 0.45)); gates.forEach((gt, j) => { Lk(gt, top[j]); if (j < 3) Lk(top[j], top[j + 1]); }); Lk(top[3], out); }
    else if (kind === 'Transformer block') { const w = sz * 1.05, bh = sz * 0.3; const ys = [sz * 1.0, 0, -sz * 1.0]; ys.forEach(y => box(-w, y - bh, w, y + bh)); for (let j = 0; j < 2; j++) Lk(P(0, ys[j] - bh), P(0, ys[j + 1] + bh)); const hub = P(0, 0, true); for (let j = 0; j < 5; j++) Lk(hub, P((j - 2) * w * 0.42, -bh - sz * 0.02)); }
    else if (kind === 'CNN') { let prev = null; for (let q = 0; q < 3; q++) { const o = q * sz * 0.38, s = sz * (0.95 - q * 0.2); const b = box(-s + o, -s - o, s + o, s - o); if (prev) { Lk(prev[0], b[0]); Lk(prev[2], b[2]); Lk(prev[1], b[1]); } prev = b; } }
    else if (kind === 'RNN') { const c = P(0, 0, true); const n = 11; let prev = null, first = null; for (let j = 0; j < n; j++) { const a = Math.PI * (-0.25 + 1.7 * j / (n - 1)); const p = P(sz * 0.62 * Math.cos(a) + sz * 0.35, -sz * 0.62 * Math.sin(a) - sz * 0.25); if (prev != null) Lk(prev, p); else first = p; prev = p; } Lk(c, first); Lk(prev, c); Lk(P(-sz * 1.3, sz * 0.25), c); Lk(c, P(sz * 1.3, sz * 0.25)); }
    else { const r = rng(seed); const ids = []; for (let j = 0; j < 7; j++) { const a = j / 7 * 6.28 + r() * 0.7, d = sz * (0.45 + 0.65 * r()); ids.push(P(Math.cos(a) * d, Math.sin(a) * d, true)); } for (let j = 0; j < 7; j++) { Lk(ids[j], ids[(j + 1) % 7]); if (r() < 0.6) Lk(ids[j], ids[(j + 3) % 7]); } }
    return { kind, cx, cy, cx0: cx, cy0: cy, sz, ph: seed, parts, links, broken: 0, drag: false, gx: 0, gy: 0, linkA: 1 };
  }
  function buildGadgets() { const r = rng(5); const kinds = ['MLP', 'LSTM cell', 'Transformer block', 'CNN', 'RNN', 'GNN', 'MLP', 'Transformer block']; const n = narrow() ? 5 : 8; const mL = (W - 1080) / 2 - 16; gadgets = [];
    for (let j = 0; j < n; j++) { const sz = (narrow() ? 24 : 30) + 24 * r(); let cx; if (mL > 130) { const inner = mL - 2.2 * sz; cx = j % 2 ? W - 1.6 * sz - r() * Math.max(0, inner) : 1.6 * sz + r() * Math.max(0, inner); } else cx = narrow() ? W * (0.1 + 0.8 * r()) : W * (0.56 + 0.38 * r()); const cy = H * (0.14 + 0.76 * r()); gadgets.push(makeGadget(kinds[j], cx, cy, sz, 100 + j)); } window.__gadgets = gadgets; }
  function breakGadget(gd) { gd.broken = tNow; gd.parts.forEach(p => { p.vx += (Math.random() - 0.5) * 520; p.vy += -120 - Math.random() * 360; }); }
  window.__breakGadget = (j) => breakGadget(gadgets[j]);
  function drawBoring(t, dt) {
    g.clearRect(0, 0, W, H); g.lineWidth = 1; g.font = `500 10px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    gadgets.forEach(gd => {
      const tx = gd.cx0 + 16 * Math.sin(t * 0.22 + gd.ph), ty = gd.cy0 + 11 * Math.cos(t * 0.18 + gd.ph * 1.7);
      if (!gd.drag) { const k = 1 - Math.exp(-dt * 0.9); gd.cx += (tx - gd.cx) * k; gd.cy += (ty - gd.cy) * k; }
      const hover = !ptr.down && Math.hypot(gd.cx - ptr.x, gd.cy - ptr.y) < gd.sz * 1.6;
      const age = gd.broken ? t - gd.broken : 99; const isBroken = age < 2.4; if (!isBroken && gd.broken && age >= 2.4) gd.broken = 0;
      gd.linkA += (((isBroken ? 0 : 1) - gd.linkA)) * (1 - Math.exp(-dt * (isBroken ? 14 : 2.2)));
      gd.parts.forEach(p => { if (isBroken) { p.vy += 760 * dt; p.vx *= Math.exp(-dt * 0.5); p.x += p.vx * dt; p.y += p.vy * dt; if (p.y > H - 6) { p.y = H - 6; p.vy *= -0.42; p.vx *= 0.8; } if (p.x < 6 || p.x > W - 6) { p.vx *= -0.6; p.x = clamp(p.x, 6, W - 6); } }
        else { const rx = gd.cx + p.rx, ry = gd.cy + p.ry; const k = gd.drag ? 90 : 40; p.vx += ((rx - p.x) * k - 7 * p.vx) * dt; p.vy += ((ry - p.y) * k - 7 * p.vy) * dt; if (hover && Math.random() < 0.12) { p.vx += (Math.random() - 0.5) * 160; p.vy += (Math.random() - 0.5) * 160; } p.x += p.vx * dt; p.y += p.vy * dt; } });
      const faint = narrow() ? 0.45 : 1; g.strokeStyle = col.ink; g.globalAlpha = (0.3 * gd.linkA + 0.12 * (hover ? 1 : 0)) * faint; g.beginPath(); gd.links.forEach(([a, b]) => { g.moveTo(gd.parts[a].x, gd.parts[a].y); g.lineTo(gd.parts[b].x, gd.parts[b].y); }); g.stroke();
      gd.parts.forEach(p => { if (p.c) { g.globalAlpha = 1; g.fillStyle = col.bg; g.beginPath(); g.arc(p.x, p.y, 4, 0, 6.2832); g.fill(); g.strokeStyle = col.ink; g.globalAlpha = 0.5; g.beginPath(); g.arc(p.x, p.y, 4, 0, 6.2832); g.stroke(); } else { g.fillStyle = col.ink; g.globalAlpha = 0.45; g.beginPath(); g.arc(p.x, p.y, 1.6, 0, 6.2832); g.fill(); } });
      let maxY = -1e9; gd.parts.forEach(p => { maxY = Math.max(maxY, gd.cy + p.ry); }); g.fillStyle = col.dim; g.globalAlpha = 0.75 * gd.linkA; g.fillText(isBroken ? '…' : gd.kind, gd.cx, maxY + 16);
    });
    g.globalAlpha = 1;
    window.__G = gadgets.map(gd => ({ kind: gd.kind, x: Math.round(gd.cx), y: Math.round(gd.cy), broken: !!gd.broken, drag: gd.drag, spread: +Math.max(...gd.parts.map(p => Math.hypot(p.x - gd.cx - p.rx, p.y - gd.cy - p.ry))).toFixed(1) }));
  }

  // ───────── loop ─────────
  let last = 0, lastMode = null;
  function frame(now) {
    const t = now / 1000, dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now; tNow = t;
    const m = mode(); if (m !== lastMode) { lastMode = m; layoutSpacer(); if (m === 'journey') { camInit = false; sv = window.scrollY; } }
    if (m === 'journey') drawJourney(t, dt); else drawBoring(t, dt);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', resize); window.addEventListener('modechange', layoutSpacer); resize();
  requestAnimationFrame(frame);
})();
