/* The drawing. Journey mode: the network (Input → Research → Experience → Education → Skills → Contact) sits beside the
   name; on the home page it draws itself in (neurons pop, strings draw, layer by layer) and then runs a forward pass,
   on its own every few seconds or when clicked. Scrolling retracts it to the input column, then centres each layer in
   turn and snaps to it: the layer's neurons and strings are drawn in as the camera arrives, and every neuron explodes
   into its card and sucks back in before the next. Between layers the network twists in 3D and the camera passes
   through it, coming out on the other side at the next layer. Whatever is out of focus stays as beads on strings: drag
   a bead, let go, and the strings ring. Behind all of it a few faded architecture diagrams drift. Boring mode: the
   document, with a bigger drifting population of those diagrams (MLP, LSTM, Transformer, CNN, RNN, GNN); hover to
   wiggle, drag to move, click to break: the pieces knock the others about, fall off the screen, and new ones drift in. */
(function () {
  'use strict';
  const root = document.documentElement; const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)); const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); }; const mix = (a, b, k) => a + (b - a) * k;
  const backOut = (t) => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const col = { ink: '#141414', accent: '#2b5bd7', bg: '#fbfbf9', dim: '#9a9a96' }; const rgb = {};
  const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const rgba = (k, a) => `rgba(${rgb[k][0]},${rgb[k][1]},${rgb[k][2]},${a})`; const mixc = (a, b, k) => `rgb(${Math.round(mix(rgb[a][0], rgb[b][0], k))},${Math.round(mix(rgb[a][1], rgb[b][1], k))},${Math.round(mix(rgb[a][2], rgb[b][2], k))})`;
  function theme() { const cs = getComputedStyle(root); for (const k of ['ink', 'accent', 'bg', 'dim']) { const v = cs.getPropertyValue('--' + k).trim(); if (v) col[k] = v; rgb[k] = hex(col[k]); } }
  theme(); window.addEventListener('themechange', theme);
  const canvas = document.getElementById('bg'), g = canvas.getContext('2d'); let W = 1, H = 1;
  const narrow = () => W < 900; const mode = () => (window.currentMode ? window.currentMode() : 'journey');
  const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
  const HEAD = () => (narrow() ? 62 : 70);
  function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); layoutSpacer(); if (!gadgets.length) seedGadgets(); }

  // ───────── the network: an input layer, one layer per section, one neuron per entry ─────────
  const SECS = window.LAYERS || [];
  const LAYERS = [{ id: 'input', name: 'Input', cards: [] }].concat(SECS);
  const counts = LAYERS.map((L, k) => k === 0 ? 4 : Math.max(1, L.cards.length)); const NLy = counts.length, Lmax = NLy - 1;
  const r0 = rng(21); const nodes = [], byL = [];
  counts.forEach((n, k) => { const row = []; for (let i = 0; i < n; i++) { const nd = { k, i, n, x: k + (r0() - 0.5) * 0.06, y: (i - (n - 1) / 2) * 0.5 + (n > 1 ? (r0() - 0.5) * 0.05 : 0), z: (r0() - 0.5) * 0.3, ox: 0, oy: 0, vx: 0, vy: 0, out: k === Lmax, short: k ? LAYERS[k].cards[i].short : '', bPrev: 0, act: 0, hov: 0, vis: 0, vr: 0, p: { x: 0, y: 0, s: 1, z: 0 } }; nodes.push(nd); row.push(nd); } byL.push(row); });
  const edges = []; { const r = rng(99); for (let k = 0; k < Lmax; k++) byL[k].forEach(A => byL[k + 1].forEach(B => edges.push({ A, B, k: k + 1, w: (r() - 0.5) * 2, amp: 0, t0: -9, ph: r() * 6.28 }))); }
  const adj = new Map(); nodes.forEach(nd => adj.set(nd, [])); edges.forEach(e => { adj.get(e.A).push(e); adj.get(e.B).push(e); });
  const spanK = (k) => (counts[k] - 1) * 0.5; const maxSpan = Math.max(...counts.map((_, k) => spanK(k)));

  // ───────── camera: a focus point in the world, where it sits on screen, a zoom, and a yaw about the vertical axis ─────────
  const cam = { fx: 0, fy: 0, ax: 0, ay: 0, s: 100, th: 0 }; let camInit = false; const PERSP = 3.2; let tilt = 0;
  function proj(x, y, z, out) { const dx = x - cam.fx, dy = y - cam.fy; const th = cam.th + tilt; const c = Math.cos(th), sn = Math.sin(th); const xr = dx * c + z * sn, zr = -dx * sn + z * c; const k = PERSP / Math.max(0.25, PERSP + zr); const sc = cam.s * k; out.x = cam.ax + xr * sc; out.y = cam.ay + dy * sc; out.s = sc; out.z = zr; return out; }
  const _p = { x: 0, y: 0, s: 1, z: 0 }, _q = { x: 0, y: 0, s: 1, z: 0 };
  const toScreen = (x, y, z) => { const o = { x: 0, y: 0, s: 1, z: 0 }; return proj(x, y, z || 0, o); };
  function poseHero() { const m = narrow(); if (m) { const copy = document.getElementById('hero-copy'); const top = HEAD() + 16, bot = copy ? Math.max(top + 120, copy.getBoundingClientRect().top - 28) : H * 0.42; const s = Math.min(W * 0.9 / Lmax, (bot - top - 22) / (2 * maxSpan + 0.7)); return { fx: Lmax / 2, fy: 0, ax: W / 2, ay: (top + bot) / 2 - 4, s, th: 0 }; } const s = Math.min(W * 0.42 / Lmax, H * 0.6 / (maxSpan + 0.35)); return { fx: Lmax / 2, fy: 0, ax: W * 0.745, ay: H * 0.52, s, th: 0 }; }
  function poseLayer(k) { const m = narrow(); const s = m ? Math.min(W * 0.5, H * 0.3 / (spanK(k) + 0.4)) : Math.min(W * 0.36, H * 0.58 / (spanK(k) + 0.45)); return { fx: k, fy: 0, ax: W / 2, ay: m ? H * 0.27 : H * 0.5, s, th: k * Math.PI }; }
  function poseNeuron(k, i) { const p = poseLayer(k); p.fy = 0.7 * byL[k][i].y; return p; }
  const lerpPose = (a, b, f) => ({ fx: mix(a.fx, b.fx, f), fy: mix(a.fy, b.fy, f), ax: mix(a.ax, b.ax, f), ay: mix(a.ay, b.ay, f), s: Math.exp(mix(Math.log(a.s), Math.log(b.s), f)), th: mix(a.th, b.th, f) });
  // keyframes along the scroll, in beats; between two layers a wide mid-frame so the twist reads
  const kfs = [], layerStart = [], pois = [0]; let total = 0;
  { let u = 1; kfs.push({ u: 0, f: poseHero }); kfs.push({ u: 1, f: poseHero });
    for (let k = 1; k < NLy; k++) { const n = counts[k]; const uE = u + 0.5; layerStart[k] = uE; const prev = kfs[kfs.length - 1];
      const mid = { u: (prev.u + uE) / 2, f: ((pf, kk) => () => { const a = pf(), b = poseLayer(kk); const m = lerpPose(a, b, 0.5); m.s *= 0.42; return m; })(prev.f, k) }; kfs.push(mid);
      kfs.push({ u: uE, f: ((kk) => () => poseLayer(kk))(k) });
      for (let i = 0; i < n; i++) { kfs.push({ u: uE + i + 0.5, f: ((kk, ii) => () => poseNeuron(kk, ii))(k, i) }); pois.push(uE + i + 0.5); }
      u = uE + n; }
    total = u + 0.4; kfs.push({ u: total, f: () => poseNeuron(Lmax, 0) }); pois.push(total); }
  const BEAT = () => H * 0.8;
  const spacer = document.getElementById('spacer');
  function layoutSpacer() { if (spacer) spacer.style.height = Math.round(total * BEAT() + H) + 'px'; }
  function poseAt(u) { if (u <= kfs[0].u) return kfs[0].f(); for (let j = 1; j < kfs.length; j++) { if (u <= kfs[j].u) { const a = kfs[j - 1], b = kfs[j]; const f = smooth((u - a.u) / Math.max(1e-6, b.u - a.u)); return lerpPose(a.f(), b.f(), f); } } return kfs[kfs.length - 1].f(); }
  const burstOf = (k, i, u) => { if (k === 0) return 0; const local = u - (layerStart[k] + i); if (local < 0) return 0; if (k === Lmax) return backOut(local / 0.32); if (local >= 1) return 0; return backOut(local / 0.32) * (1 - smooth((local - 0.7) / 0.3)); };
  const layerWeight = (k, u) => k === 0 ? 0 : smooth((u - (layerStart[k] - 0.55)) / 0.4) * (k === Lmax ? 1 : 1 - smooth((u - (layerStart[k] + counts[k] - 0.05)) / 0.45));
  window.jumpToLayer = (id) => { const k = LAYERS.findIndex(L => L.id === id); if (k < 1) return; goTo(Math.round((layerStart[k] + 0.5) * BEAT()), 700); };
  window.resetJourney = () => { sv = 0; const p = poseHero(); Object.assign(cam, p); camInit = true; };
  // snapping: after the wheel stops, settle onto the nearest beat (forward-biased)
  let scrollTw = null, settleTimer = null, touching = false, lastY = 0, dir = 1;
  function goTo(to, ms) { const from = window.scrollY; if (scrollTw) cancelAnimationFrame(scrollTw.raf); if (reduced) { window.scrollTo(0, to); return; } const d = ms || Math.min(900, 300 + Math.abs(to - from) * 0.3); const t0 = performance.now(); const step = (now) => { const k = clamp((now - t0) / d); const e = 1 - Math.pow(1 - k, 3); window.scrollTo(0, from + (to - from) * e); if (k < 1) scrollTw.raf = requestAnimationFrame(step); else scrollTw = null; }; scrollTw = { raf: requestAnimationFrame(step) }; }
  function cancelTween() { if (scrollTw) { cancelAnimationFrame(scrollTw.raf); scrollTw = null; } }
  function settle() { if (mode() !== 'journey' || touching || dragNode) return; const u = window.scrollY / BEAT(); let ahead = pois.find(p => p > u + 0.02), behind = [...pois].reverse().find(p => p <= u + 0.02); if (ahead == null || behind == null) return; const frac = (u - behind) / Math.max(1e-6, ahead - behind); const target = dir > 0 ? (frac > 0.3 ? ahead : behind) : (frac < 0.7 ? behind : ahead); if (Math.abs(target - u) > 0.01) goTo(Math.round(target * BEAT()), 520); }
  function scheduleSettle() { clearTimeout(settleTimer); settleTimer = setTimeout(settle, 170); }
  window.addEventListener('scroll', () => { const y = window.scrollY; if (y !== lastY) dir = y > lastY ? 1 : -1; lastY = y; }, { passive: true });
  window.addEventListener('wheel', () => { if (mode() === 'journey') { cancelTween(); scheduleSettle(); } }, { passive: true });
  window.addEventListener('touchstart', () => { touching = true; cancelTween(); }, { passive: true });
  window.addEventListener('touchend', () => { touching = false; if (mode() === 'journey') scheduleSettle(); }, { passive: true });
  window.addEventListener('keydown', (e) => { if (mode() !== 'journey' || (e.target && /input|textarea|select/i.test(e.target.tagName))) return; const u = window.scrollY / BEAT(); if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { const n = pois.find(p => p > u + 0.05); if (n != null) { e.preventDefault(); goTo(Math.round(n * BEAT()), 600); } } if (['ArrowUp', 'PageUp'].includes(e.key)) { const p = [...pois].reverse().find(p => p < u - 0.05); e.preventDefault(); goTo(Math.round((p == null ? 0 : p) * BEAT()), 600); } });

  // ───────── building the network, then forward passes (home page) ─────────
  // a cycle: the network retracts right to left, is drawn back in left to right (neurons pop, strings draw), then a pass runs
  const pop = (t) => { t = clamp(t); const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const build = { t0: 1e9, dis: false, pending: false, fromPointer: false, px: 0, py: 0, started: false }; const DIS = 0.5, GAP = 0.2, BUILD = Lmax * GAP + 0.55, REST = 8500;
  const stag = (nd) => (nd.n > 1 ? nd.i / (nd.n - 1) * 0.5 : 0);
  function heroLb(k, t) { if (reduced) return 1; let tb = t; if (build.dis) { if (t < DIS) return 1 - smooth((t - (Lmax - k) * 0.04) / 0.3); tb = t - DIS; } return clamp((tb - k * GAP) / 0.55); }
  // along the scroll: layers retract right to left while the hero copy fades, and each layer is drawn in as the camera comes round to it
  function journeyLb(k, u) { if (k === 0 || reduced) return 1; const down = 1 - smooth((u - (0.12 + (Lmax - k) * 0.12)) / 0.22); const up = smooth((u - (layerStart[k] - 0.62)) / 0.55); return Math.max(down, up); }
  const pass = { on: false, t0: 0, acts: null, path: null, y: 0 }; const STEP = 0.42; let lastFire = performance.now();
  function queuePass(fromPointer) { if (build.pending) return; build.dis = build.started; build.started = true; build.t0 = tNow; build.pending = true; build.fromPointer = !!fromPointer; build.px = ptr.x; build.py = ptr.y; pass.on = false; lastFire = performance.now(); }
  function startPass(fromPointer) {
    const acts = [byL[0].map(nd => { const d = Math.hypot(nd.p.x - build.px, nd.p.y - build.py); const h = fromPointer ? Math.exp(-((d / 150) ** 2)) : 0; return clamp(0.15 + 0.85 * h + (fromPointer ? Math.random() * 0.25 : Math.random() * 0.85)); })];
    let yOut = 0.5;
    for (let k = 1; k <= Lmax; k++) { const prev = acts[k - 1]; const raw = byL[k].map(nd => { let s = 0; adj.get(nd).forEach(e => { if (e.B === nd) s += prev[e.A.i] * e.w; }); return s; }); if (k === Lmax) { yOut = 1 / (1 + Math.exp(-1.6 * raw[0])); acts.push([0.35 + 0.65 * yOut]); } else { const cur = raw.map(v => Math.max(0, v)); const m = Math.max(...cur, 1e-6); acts.push(cur.map(v => v / m)); } }
    pass.on = true; pass.t0 = performance.now(); pass.acts = acts; pass.path = acts.map(a => a.indexOf(Math.max(...a))); pass.y = yOut;
  }
  window.__fire = () => queuePass(false);

  // ───────── pointer: beads on strings (journey) and gadgets (boring) ─────────
  const ptr = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, vx: 0, vy: 0, nx: 0, down: false, t: 0 }; let dragNode = null, dragGad = null, downAt = { x: 0, y: 0, t: 0 };
  const interactive = (t) => !!(t && t.closest && t.closest('a, button, details, summary, input, label, select, .jcard, .top, .focus'));
  window.addEventListener('pointermove', (e) => { ptr.px = ptr.x; ptr.py = ptr.y; ptr.x = e.clientX; ptr.y = e.clientY; ptr.nx = (e.clientX / W) * 2 - 1; const now = performance.now(); const dt = Math.max(8, now - ptr.t) / 1000; ptr.vx = (ptr.x - ptr.px) / dt; ptr.vy = (ptr.y - ptr.py) / dt; ptr.t = now;
    if (dragNode) { const sc = dragNode.p.s || cam.s; dragNode.ox += (ptr.x - ptr.px) / sc; dragNode.oy += (ptr.y - ptr.py) / sc; dragNode.vx = dragNode.vy = 0; }
    if (dragGad) { dragGad.cx = ptr.x - dragGad.gx; dragGad.cy = ptr.y - dragGad.gy; dragGad.ax = dragGad.cx; dragGad.ay = dragGad.cy; } }, { passive: true });
  window.addEventListener('pointerdown', (e) => { if (e.button !== 0 || interactive(e.target)) return; ptr.x = e.clientX; ptr.y = e.clientY; ptr.down = true; downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (mode() === 'journey') { let best = null, bd = 26; nodes.forEach(nd => { if (nd.vis < 0.5) return; const d = Math.hypot(nd.p.x - e.clientX, nd.p.y - e.clientY); if (d < bd) { bd = d; best = nd; } }); if (best) { dragNode = best; e.preventDefault(); return; } }
    let best = null, bd = 1e9; gadgets.forEach(gd => { if (gd.state !== 'float') return; const d = Math.hypot(gd.cx - e.clientX, gd.cy - e.clientY); if (d < gd.sz * 1.6 && d < bd) { bd = d; best = gd; } }); if (best) { dragGad = best; best.gx = e.clientX - best.cx; best.gy = e.clientY - best.cy; best.drag = true; e.preventDefault(); } });
  window.addEventListener('pointerup', (e) => { ptr.down = false; const moved = Math.hypot(ptr.x - downAt.x, ptr.y - downAt.y), held = performance.now() - downAt.t;
    if (dragNode) { const sc = dragNode.p.s || cam.s; if (moved < 5 && held < 350) { pluck(dragNode, 0.1); dragNode.vy -= 0.6; } else { dragNode.vx = ptr.vx / sc * 0.6; dragNode.vy = ptr.vy / sc * 0.6; pluck(dragNode, clamp(0.04 + Math.hypot(ptr.vx, ptr.vy) / sc * 0.08, 0.04, 0.22)); } dragNode = null; }
    else if (dragGad) { dragGad.drag = false; if (moved < 6 && held < 400) breakGadget(dragGad); dragGad = null; }
    else if (mode() === 'journey' && moved < 6 && held < 400 && !interactive(e.target) && heroVis > 0.5) queuePass(true); });
  window.addEventListener('pointercancel', () => { ptr.down = false; dragNode = null; if (dragGad) dragGad.drag = false; dragGad = null; });
  function pluck(nd, amp) { adj.get(nd).forEach(e => { if (e.amp * Math.exp(-2.2 * (tNow - e.t0)) < amp) { e.amp = amp; e.t0 = tNow; } }); }
  let tNow = 0, heroVis = 1;

  // ───────── drawing helpers ─────────
  function sphere(x, y, r, fillK, accentK, strokeA) { // a quietly shaded bead
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.38, r * 0.15, x, y, r * 1.05);
    const base = accentK > 0.01 ? mixc('bg', 'accent', accentK) : col.bg; gr.addColorStop(0, base); gr.addColorStop(1, accentK > 0.01 ? mixc('bg', 'accent', clamp(accentK * 1.15)) : mixc('bg', 'ink', 0.16 + 0.1 * fillK));
    g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    g.strokeStyle = accentK > 0.3 ? col.accent : col.ink; g.globalAlpha = strokeA; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.stroke();
  }
  const navLinks = Array.from(document.querySelectorAll('.nav a')); let navOn = '';
  function setNav(id) { if (id === navOn) return; navOn = id; navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id)); }

  // ───────── journey ─────────
  const heroCopy = document.getElementById('hero-copy'), jlabel = document.getElementById('jlabel');
  let sv = 0, lastJ = '';
  function drawJourney(t, dt) {
    const target = window.scrollY; sv += (target - sv) * (reduced ? 1 : 1 - Math.exp(-dt * 10)); if (Math.abs(target - sv) < 0.3) sv = target;
    const u = sv / BEAT(); const p = poseAt(u);
    if (!camInit) { Object.assign(cam, p); camInit = true; } else { const k = 1 - Math.exp(-dt * 7); cam.fx += (p.fx - cam.fx) * k; cam.fy += (p.fy - cam.fy) * k; cam.ax += (p.ax - cam.ax) * k; cam.ay += (p.ay - cam.ay) * k; cam.s = Math.exp(Math.log(cam.s) + (Math.log(p.s) - Math.log(cam.s)) * k); cam.th += (p.th - cam.th) * k; }
    const heroK = 1 - smooth((u - 0.1) / 0.7), zoomK = smooth((u - 0.5) / 0.7); heroVis = heroK;
    tilt += (((narrow() || ptr.x < 0) ? 0 : 0.07 * ptr.nx * zoomK) - tilt) * (1 - Math.exp(-dt * 3));
    if (heroCopy) { heroCopy.style.opacity = heroK.toFixed(3); heroCopy.style.transform = `translateY(${(-24 * (1 - heroK)).toFixed(1)}px)`; heroCopy.style.visibility = heroK > 0.01 ? '' : 'hidden'; }
    const lw = counts.map((_, k) => layerWeight(k, u)); let activeK = -1, aw = 0.25; lw.forEach((w, k) => { if (w > aw) { aw = w; activeK = k; } });
    // the home cycle: draw the network in, run a pass; again every few seconds, or on a click
    if (!build.started) { build.started = true; build.dis = false; build.t0 = t + 0.35; build.pending = true; build.fromPointer = false; lastFire = performance.now(); }
    if (heroK < 0.5) lastFire = performance.now(); else if (!reduced && document.visibilityState === 'visible' && performance.now() - lastFire > REST) queuePass(false);
    const ct = t - build.t0; if (build.pending && ct >= (reduced ? 0 : (build.dis ? DIS : 0) + BUILD - 0.12)) { build.pending = false; startPass(build.fromPointer); }
    const hw = 1 - smooth((u - 0.02) / 0.1); const lb = counts.map((_, k) => mix(journeyLb(k, u), heroLb(k, ct), hw));
    const el = pass.on ? (performance.now() - pass.t0) / 1000 : 99, pt = el / STEP; const fadeP = smooth((el - STEP * (NLy + 1) - 1.0) / 1.2); if (pass.on && fadeP >= 1) pass.on = false;
    // physics: beads spring home, the pointer pushes what it passes, strings ring down
    nodes.forEach(nd => { if (nd === dragNode) return; const dx = nd.p.x - ptr.x, dy = nd.p.y - ptr.y, d = Math.hypot(dx, dy); let fx = -30 * nd.ox - 4.5 * nd.vx, fy = -30 * nd.oy - 4.5 * nd.vy;
      if (d < 70 && d > 0.1 && !ptr.down) { const f = (1 - d / 70) * 130 / Math.max(40, nd.p.s); fx += dx / d * f; fy += dy / d * f; if (Math.random() < 0.08) pluck(nd, 0.03); }
      nd.vx += fx * dt; nd.vy += fy * dt; nd.ox += nd.vx * dt; nd.oy += nd.vy * dt;
      const hv = d < 90 ? 1 - d / 90 : 0; nd.hov += (hv - nd.hov) * (1 - Math.exp(-dt * 8));
      let a = 0; if (pass.on) { const reach = clamp(pt - nd.k); a = pass.acts[nd.k][nd.i] * smooth(reach) * (1 - fadeP); } nd.act += (a * heroK - nd.act) * (1 - Math.exp(-dt * 10));
      nd.vr = clamp((lb[nd.k] - stag(nd) * 0.9) / 0.5); nd.vis = pop(nd.vr);
      proj(nd.x + nd.ox, nd.y + nd.oy, nd.z, nd.p); });
    g.clearRect(0, 0, W, H); stepGadgets(t, dt, 0.12, narrow() ? 0.18 : 0.26); g.lineWidth = 1;
    // strings
    edges.forEach(e => { const ev = clamp((lb[e.k] - stag(e.B) * 0.9 - 0.05) / 0.45); if (ev <= 0.001) return; const A = e.A.p, B = e.B.p; const inFocus = Math.max(lw[e.k - 1] || 0, lw[e.k] || 0); const depth = clamp(1 - (A.z + B.z) * 0.22, 0.3, 1.2);
      if (ev < 0.999) { // being drawn: a line growing out of the previous neuron, with a bright tip
        const ex = mix(A.x, B.x, ev), ey = mix(A.y, B.y, ev); g.strokeStyle = col.ink; g.globalAlpha = (0.1 + 0.1 * Math.abs(e.w)) * depth; g.lineWidth = 1; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(ex, ey); g.stroke();
        g.fillStyle = col.accent; g.globalAlpha = 0.7 * depth * Math.sin(Math.PI * ev); g.beginPath(); g.arc(ex, ey, 1.8, 0, 6.2832); g.fill(); return; }
      const onPath = pass.on && pass.path[e.k - 1] === e.A.i && pass.path[e.k] === e.B.i && pt > e.k - 0.5; const sig = pass.on ? pass.acts[e.k - 1][e.A.i] * Math.abs(e.w) * smooth(pt - (e.k - 1)) * (1 - fadeP) * heroK : 0;
      g.strokeStyle = onPath ? col.accent : col.ink; g.globalAlpha = (onPath ? 0.85 * (1 - fadeP) : 0.06 + 0.08 * Math.abs(e.w) + 0.14 * inFocus * zoomK + 0.3 * sig + 0.12 * Math.max(e.A.hov, e.B.hov)) * depth; g.lineWidth = onPath ? 1.6 : 1; g.beginPath();
      const age = t - e.t0, ampS = Math.min(42, e.amp * cam.s) * Math.exp(-2.2 * age);
      if (ampS > 0.35) { const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; for (let j = 0; j <= 16; j++) { const s = j / 16; const off = ampS * (Math.sin(Math.PI * s) * Math.cos(2 * Math.PI * 2.1 * age + e.ph) + 0.45 * Math.sin(2 * Math.PI * s) * Math.cos(2 * Math.PI * 3.3 * age) * Math.exp(-0.8 * age)); const x = A.x + dx * s + nx * off, y = A.y + dy * s + ny * off; if (j === 0) g.moveTo(x, y); else g.lineTo(x, y); } }
      else { g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); }
      g.stroke();
      if (sig > 0.08 && pt > e.k - 1 && pt < e.k + 0.4) { const s = clamp(pt - (e.k - 1)); g.globalAlpha = sig; g.fillStyle = col.accent; g.beginPath(); g.arc(mix(A.x, B.x, s), mix(A.y, B.y, s), 1.6 + 1.8 * sig, 0, 6.2832); g.fill(); }
      if (zoomK > 0.05 && lw[e.k] > 0.05) { g.fillStyle = col.accent; for (let j = 0; j < 2; j++) { const s = (t * 0.22 + j * 0.5 + e.ph * 0.1) % 1; g.globalAlpha = 0.45 * lw[e.k] * zoomK * Math.sin(Math.PI * s); g.beginPath(); g.arc(mix(A.x, B.x, s), mix(A.y, B.y, s), 1.6, 0, 6.2832); g.fill(); } } });
    g.lineWidth = 1;
    // beads (far first), bursts, names
    const Rb = Math.min(W, H) * 0.14; const bursts = []; g.textBaseline = 'middle';
    const order = nodes.slice().sort((a, b) => b.p.z - a.p.z);
    order.forEach(nd => { if (nd.vis < 0.01) return; const s = nd.p; const r0 = clamp(0.045 * s.s, 3, 16) * (nd.out ? 1.5 : 1), r = r0 * nd.vis; const b = burstOf(nd.k, nd.i, u); const focus = lw[nd.k]; const bb = clamp(b);
      if (bb > 0.05 && nd.bPrev <= 0.05) pluck(nd, 0.07); nd.bPrev = bb;
      const onPath = pass.on && pass.path[nd.k] === nd.i && pt > nd.k + 0.5 && heroK > 0.5;
      if (bb > 0.002) { bursts.push({ nd, b: bb, s, R: r + b * Rb }); g.fillStyle = col.accent; g.globalAlpha = 0.07 * bb; g.beginPath(); g.arc(s.x, s.y, r + b * Rb, 0, 6.2832); g.fill(); g.strokeStyle = col.accent; g.globalAlpha = 0.55 * bb; g.beginPath(); g.arc(s.x, s.y, r + b * Rb, 0, 6.2832); g.stroke(); }
      const depth = clamp(1 - s.z * 0.3, 0.45, 1.2);
      if (nd.vr > 0.01 && nd.vr < 0.99) { g.strokeStyle = col.accent; g.globalAlpha = 0.5 * (1 - nd.vr) * depth; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, r0 * (0.5 + 1.5 * nd.vr), 0, 6.2832); g.stroke(); }
      sphere(s.x, s.y, r * (1 + 0.25 * nd.act), focus * zoomK, Math.max(bb, nd.act * 0.9, onPath ? 0.5 : 0), (0.4 + 0.5 * focus * zoomK + 0.4 * bb + 0.3 * nd.act) * depth);
      if (nd.hov > 0.05 && heroK < 0.5) { g.strokeStyle = col.accent; g.globalAlpha = nd.hov * 0.5; g.beginPath(); g.arc(s.x, s.y, r + 5 * nd.hov, 0, 6.2832); g.stroke(); }
      const la = focus * zoomK * (1 - bb) * nd.vr * (cam.s > 160 ? 1 : 0); if (la > 0.03 && nd.short) { g.fillStyle = col.ink; g.globalAlpha = 0.65 * la; g.font = `500 12px ${SANS}`; g.textAlign = narrow() ? 'center' : 'left'; g.fillText(nd.short, narrow() ? s.x : s.x + r + 9, narrow() ? s.y + r + 11 : s.y); } });
    // the output's readout during a pass
    if (pass.on && heroK > 0.5 && pt > Lmax + 0.6 && fadeP < 1) { const o = nodes[nodes.length - 1].p; g.fillStyle = col.accent; g.globalAlpha = 0.9 * (1 - fadeP); g.font = `600 11px ${MONO}`; g.textAlign = 'center'; g.fillText(`output ${pass.y.toFixed(2)}`, o.x, o.y + 22); }
    // the section in focus, named under its layer
    g.textAlign = 'center';
    if (activeK > 0 && zoomK > 0.02) { const L = LAYERS[activeK]; const s = toScreen(activeK, spanK(activeK) + 0.55, 0); const a = lw[activeK] * zoomK; g.fillStyle = col.ink; g.globalAlpha = 0.85 * a; g.font = `600 14px ${SANS}`; g.fillText(L.name, s.x, Math.min(s.y, H - 28)); g.fillStyle = col.dim; g.globalAlpha = 0.8 * a; g.font = `500 10px ${MONO}`; g.fillText(String(activeK).padStart(2, '0'), s.x, Math.min(s.y, H - 28) + 16); }
    g.globalAlpha = 1;
    setNav(activeK > 0 && zoomK > 0.5 ? LAYERS[activeK].id : '');
    // cards explode out of their neuron
    LAYERS.forEach((L, k) => L.cards.forEach((c, i) => { const nd = byL[k][i]; const b = burstOf(k, i, u); const el = c.el;
      if (b <= 0.002) { if (el.classList.contains('on')) { el.classList.remove('on'); el.style.opacity = '0'; } return; }
      const s = nd.p; const bb = clamp(b); const R = clamp(0.045 * s.s, 3, 16) + b * Rb; el.classList.add('on');
      const cw = el.offsetWidth, ch = el.offsetHeight; let left, top;
      if (narrow()) { left = 16; top = Math.max(s.y + R + 14, H * 0.42); el.style.maxHeight = (H - top - 12) + 'px'; }
      else { left = s.x + R + 26; if (left + cw > W - 16) left = s.x - R - 26 - cw; top = clamp(s.y - ch / 2, HEAD() + 12, Math.max(HEAD() + 12, H - ch - 12)); el.style.maxHeight = ''; }
      const tx = (s.x - (left + cw / 2)) * (1 - bb), ty = (s.y - (top + ch / 2)) * (1 - bb);
      el.style.left = left.toFixed(1) + 'px'; el.style.top = top.toFixed(1) + 'px'; el.style.opacity = smooth(bb * 1.3).toFixed(3); el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${(0.5 + 0.5 * b).toFixed(3)})`; }));
    if (jlabel) { let txt = ''; if (activeK > 0 && zoomK > 0.5) { const L = LAYERS[activeK]; let ni = -1, nb = 0; byL[activeK].forEach((nd, i) => { const b = burstOf(activeK, i, u); if (b > nb) { nb = b; ni = i; } }); txt = `<b>${String(activeK).padStart(2, '0')}</b>${L.name}` + (nb > 0.3 ? ` · ${ni + 1} / ${counts[activeK]}` : ''); } if (txt !== lastJ) { lastJ = txt; jlabel.innerHTML = txt; } jlabel.classList.toggle('show', !!txt); }
    window.__J = { u: +u.toFixed(2), activeK, zoomK: +zoomK.toFixed(2), heroK: +heroK.toFixed(2), bursts: bursts.map(x => [x.nd.k, x.nd.i, +x.b.toFixed(2)]), cam: { fx: +cam.fx.toFixed(2), fy: +cam.fy.toFixed(2), s: Math.round(cam.s), th: +cam.th.toFixed(2) }, pass: pass.on ? { pt: +pt.toFixed(2), y: +pass.y.toFixed(2) } : null, dragging: !!dragNode, maxAmp: +Math.max(0, ...edges.map(e => e.amp * Math.exp(-2.2 * (t - e.t0)))).toFixed(3), maxOff: +Math.max(...nodes.map(n => Math.hypot(n.ox, n.oy))).toFixed(3), total: +total.toFixed(2), beat: Math.round(BEAT()), pois, ls: layerStart, nav: navOn, lb: lb.map(v => +v.toFixed(2)), cycle: { t: +ct.toFixed(2), pending: build.pending, dis: build.dis }, gadgets: gadgets.length, zspread: +(Math.max(...nodes.map(n => n.p.z)) - Math.min(...nodes.map(n => n.p.z))).toFixed(2) };
    window.__nodeScreen = (k, i) => ({ x: byL[k][i].p.x, y: byL[k][i].p.y });
  }

  // ───────── boring mode: a drifting population of architectures ─────────
  let gadgets = []; let lastScroll = 0; const KINDS = ['MLP', 'LSTM cell', 'Transformer block', 'CNN', 'RNN', 'GNN'];
  function makeGadget(kind, cx, cy, sz, seed) {
    const parts = [], links = []; const P = (x, y, c) => { parts.push({ rx: x, ry: y, x: cx + x, y: cy + y, vx: 0, vy: 0, c: !!c }); return parts.length - 1; }; const Lk = (a, b) => links.push([a, b]); const box = (x0, y0, x1, y1) => { const b = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]; Lk(b[0], b[1]); Lk(b[1], b[2]); Lk(b[2], b[3]); Lk(b[3], b[0]); return b; };
    if (kind === 'MLP') { const lay = [3, 4, 2]; const ids = lay.map((n, k) => Array.from({ length: n }, (_, i) => P((k - 1) * sz * 0.95, (i - (n - 1) / 2) * sz * 0.48, true))); for (let k = 0; k < 2; k++) ids[k].forEach(a => ids[k + 1].forEach(b => Lk(a, b))); }
    else if (kind === 'LSTM cell') { const w = sz * 1.3, h = sz * 0.75; box(-w, -h, w, h); const gates = [-0.6, -0.2, 0.2, 0.6].map(f => P(f * w, h * 0.25, true)); const inp = P(-w * 1.4, h * 0.6), out = P(w * 1.4, -h * 0.6); gates.forEach(gt => Lk(inp, gt)); const top = [-0.6, -0.2, 0.2, 0.6].map(f => P(f * w, -h * 0.45)); gates.forEach((gt, j) => { Lk(gt, top[j]); if (j < 3) Lk(top[j], top[j + 1]); }); Lk(top[3], out); }
    else if (kind === 'Transformer block') { const w = sz * 1.05, bh = sz * 0.3; const ys = [sz * 1.0, 0, -sz * 1.0]; ys.forEach(y => box(-w, y - bh, w, y + bh)); for (let j = 0; j < 2; j++) Lk(P(0, ys[j] - bh), P(0, ys[j + 1] + bh)); const hub = P(0, 0, true); for (let j = 0; j < 5; j++) Lk(hub, P((j - 2) * w * 0.42, -bh - sz * 0.02)); }
    else if (kind === 'CNN') { let prev = null; for (let q = 0; q < 3; q++) { const o = q * sz * 0.38, s = sz * (0.95 - q * 0.2); const b = box(-s + o, -s - o, s + o, s - o); if (prev) { Lk(prev[0], b[0]); Lk(prev[2], b[2]); Lk(prev[1], b[1]); } prev = b; } }
    else if (kind === 'RNN') { const c = P(0, 0, true); const n = 11; let prev = null, first = null; for (let j = 0; j < n; j++) { const a = Math.PI * (-0.25 + 1.7 * j / (n - 1)); const p = P(sz * 0.62 * Math.cos(a) + sz * 0.35, -sz * 0.62 * Math.sin(a) - sz * 0.25); if (prev != null) Lk(prev, p); else first = p; prev = p; } Lk(c, first); Lk(prev, c); Lk(P(-sz * 1.3, sz * 0.25), c); Lk(c, P(sz * 1.3, sz * 0.25)); }
    else { const r = rng(seed); const ids = []; for (let j = 0; j < 7; j++) { const a = j / 7 * 6.28 + r() * 0.7, d = sz * (0.45 + 0.65 * r()); ids.push(P(Math.cos(a) * d, Math.sin(a) * d, true)); } for (let j = 0; j < 7; j++) { Lk(ids[j], ids[(j + 1) % 7]); if (r() < 0.6) Lk(ids[j], ids[(j + 3) % 7]); } }
    return { kind, cx, cy, ax: cx, ay: cy, vx: 0, vy: 0, sz, ph: seed, parts, links, state: 'float', brokeT: 0, drag: false, gx: 0, gy: 0, linkA: 1, born: performance.now() };
  }
  let gseed = 300;
  function spawnGadget(fromEdge) { const r = Math.random; const kind = KINDS[Math.floor(r() * KINDS.length)]; const sz = (narrow() ? 22 : 28) + 24 * r(); let cx = W * (0.06 + 0.88 * r()), cy = H * (0.1 + 0.8 * r()); const gd = makeGadget(kind, cx, cy, sz, gseed++);
    if (fromEdge) { const side = r(); if (side < 0.5) { gd.cy = -sz * 2.5; } else if (side < 0.75) { gd.cx = -sz * 2.5; } else { gd.cx = W + sz * 2.5; } gd.parts.forEach(p => { p.x = gd.cx + p.rx; p.y = gd.cy + p.ry; }); }
    gadgets.push(gd); return gd; }
  function seedGadgets() { gadgets = []; lastScroll = window.scrollY; const j = mode() === 'journey'; const n = j ? (narrow() ? 3 : 6) : (narrow() ? 7 : 12); for (let q = 0; q < n; q++) spawnGadget(false); window.__gadgets = gadgets; }
  function breakGadget(gd, hard) { if (gd.state !== 'float') return; gd.state = 'broken'; gd.brokeT = tNow; gd.parts.forEach(p => { p.vx += (Math.random() - 0.5) * (hard ? 700 : 520) + gd.vx; p.vy += -140 - Math.random() * 360 + gd.vy; }); }
  window.__breakGadget = (j) => breakGadget(gadgets[j]);
  // the population, both modes: drifts with the scroll (wrapping), floats on soft springs, bumps apart; debris falls, knocks, chain-breaks, leaves, is replaced
  function stepGadgets(t, dt, drift, faintBase) {
    g.lineWidth = 1; g.font = `500 10px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const dS = (window.scrollY - lastScroll) * drift; lastScroll = window.scrollY; const wrapH = H + 240;
    gadgets.forEach(gd => { if (gd.state === 'float') { gd.ay -= dS; gd.cy -= dS; gd.parts.forEach(p => { p.y -= dS; }); if (!gd.drag) { if (gd.ay < -120) { gd.ay += wrapH; gd.cy += wrapH; gd.parts.forEach(p => { p.y += wrapH; }); } else if (gd.ay > H + 120) { gd.ay -= wrapH; gd.cy -= wrapH; gd.parts.forEach(p => { p.y -= wrapH; }); } } } });
    // float physics: a soft spring to the drifting anchor, knocks from debris, gentle bumps between neighbours
    gadgets.forEach(gd => { if (gd.state !== 'float' || gd.drag) return; const tx = gd.ax + 18 * Math.sin(t * 0.2 + gd.ph), ty = gd.ay + 12 * Math.cos(t * 0.17 + gd.ph * 1.7); gd.vx += ((tx - gd.cx) * 1.2 - 1.6 * gd.vx) * dt; gd.vy += ((ty - gd.cy) * 1.2 - 1.6 * gd.vy) * dt; gd.cx += gd.vx * dt; gd.cy += gd.vy * dt; });
    for (let a = 0; a < gadgets.length; a++) for (let b = a + 1; b < gadgets.length; b++) { const A = gadgets[a], B = gadgets[b]; if (A.state !== 'float' || B.state !== 'float') continue; const dx = B.cx - A.cx, dy = B.cy - A.cy, d = Math.hypot(dx, dy) || 1, min = (A.sz + B.sz) * 1.15; if (d < min) { const push = (min - d) * 2.2 * dt, nx = dx / d, ny = dy / d; if (!A.drag) { A.cx -= nx * push; A.cy -= ny * push; A.vx -= nx * push * 6; A.vy -= ny * push * 6; } if (!B.drag) { B.cx += nx * push; B.cy += ny * push; B.vx += nx * push * 6; B.vy += ny * push * 6; } } }
    gadgets.forEach(gd => {
      const hover = !ptr.down && gd.state === 'float' && Math.hypot(gd.cx - ptr.x, gd.cy - ptr.y) < gd.sz * 1.6;
      const broken = gd.state === 'broken'; gd.linkA += (((broken ? 0 : 1) - gd.linkA)) * (1 - Math.exp(-dt * (broken ? 14 : 2.2)));
      let below = 0;
      gd.parts.forEach(p => {
        if (broken) { p.vy += 820 * dt; p.vx *= Math.exp(-dt * 0.35); p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < 4 || p.x > W - 4) { p.vx *= -0.55; p.x = clamp(p.x, 4, W - 4); } if (p.y > H + 60) below++;
          // debris knocks the floating ones
          const sp = Math.hypot(p.vx, p.vy); if (sp > 60) gadgets.forEach(o => { if (o === gd || o.state !== 'float') return; const dx = p.x - o.cx, dy = p.y - o.cy, d = Math.hypot(dx, dy), R = o.sz * 1.35; if (d < R && d > 0.1) { const nx = dx / d, ny = dy / d, vn = p.vx * nx + p.vy * ny; if (vn < 0) { p.vx -= 1.6 * vn * nx; p.vy -= 1.6 * vn * ny; o.vx += -vn * nx * 0.35; o.vy += -vn * ny * 0.35; o.parts.forEach(q => { q.vx += (Math.random() - 0.5) * 90; q.vy += (Math.random() - 0.5) * 90; }); if (-vn > 520 && Math.random() < 0.3) breakGadget(o, true); } } }); }
        else { const rx = gd.cx + p.rx, ry = gd.cy + p.ry; const k = gd.drag ? 90 : 40; p.vx += ((rx - p.x) * k - 7 * p.vx) * dt; p.vy += ((ry - p.y) * k - 7 * p.vy) * dt; if (hover && Math.random() < 0.12) { p.vx += (Math.random() - 0.5) * 160; p.vy += (Math.random() - 0.5) * 160; } p.x += p.vx * dt; p.y += p.vy * dt; } });
      if (broken && (below === gd.parts.length || t - gd.brokeT > 6)) gd.state = 'gone';
      const faint = faintBase * clamp((performance.now() - gd.born) / 900);
      g.strokeStyle = col.ink; g.globalAlpha = (0.2 * gd.linkA + 0.14 * (hover ? 1 : 0)) * faint; g.beginPath(); gd.links.forEach(([a, b]) => { g.moveTo(gd.parts[a].x, gd.parts[a].y); g.lineTo(gd.parts[b].x, gd.parts[b].y); }); g.stroke();
      gd.parts.forEach(p => { if (p.c) { g.globalAlpha = faint; g.fillStyle = col.bg; g.beginPath(); g.arc(p.x, p.y, 4, 0, 6.2832); g.fill(); g.strokeStyle = col.ink; g.globalAlpha = 0.4 * faint; g.beginPath(); g.arc(p.x, p.y, 4, 0, 6.2832); g.stroke(); } else { g.fillStyle = col.ink; g.globalAlpha = 0.35 * faint; g.beginPath(); g.arc(p.x, p.y, 1.6, 0, 6.2832); g.fill(); } });
      if (!broken) { let maxY = -1e9; gd.parts.forEach(p => { maxY = Math.max(maxY, gd.cy + p.ry); }); g.fillStyle = col.dim; g.globalAlpha = 0.6 * gd.linkA * faint; g.fillText(gd.kind, gd.cx, maxY + 16); }
    });
    const gone = gadgets.filter(gd => gd.state === 'gone').length; if (gone) { gadgets = gadgets.filter(gd => gd.state !== 'gone'); for (let j = 0; j < gone; j++) spawnGadget(true); window.__gadgets = gadgets; }
    g.globalAlpha = 1;
    window.__G = gadgets.map(gd => ({ kind: gd.kind, x: Math.round(gd.cx), y: Math.round(gd.cy), state: gd.state, drag: gd.drag, v: Math.round(Math.hypot(gd.vx, gd.vy)), spread: +Math.max(...gd.parts.map(p => Math.hypot(p.x - gd.cx - p.rx, p.y - gd.cy - p.ry))).toFixed(1) }));
  }
  function drawBoring(t, dt) {
    g.clearRect(0, 0, W, H); stepGadgets(t, dt, 0.3, narrow() ? 0.4 : 0.5);
    // which section is on screen → the nav
    let on = ''; SECS.forEach(L => { if (L.sec.offsetTop - 140 <= window.scrollY) on = L.id; }); setNav(window.scrollY < 80 ? '' : on);
  }

  // ───────── loop ─────────
  let last = 0, lastMode = null;
  function frame(now) {
    const t = now / 1000, dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now; tNow = t;
    const m = mode(); if (m !== lastMode) { lastMode = m; layoutSpacer(); lastScroll = window.scrollY; seedGadgets(); if (m === 'journey') { camInit = false; sv = window.scrollY; } else setNav(''); }
    if (m === 'journey') drawJourney(t, dt); else drawBoring(t, dt);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', resize); window.addEventListener('modechange', layoutSpacer); resize();
  requestAnimationFrame(frame);
})();
