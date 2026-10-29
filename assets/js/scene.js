/* The drawing. Journey mode: the network (Input → Research → Experience → Education → Skills → Contact) sits beside the
   name; on the home page it draws itself in (neurons pop, strings draw, layer by layer) and then runs a forward pass,
   on its own every few seconds or when pressed. The home page is a field of small architectures floating in the
   background that light up along random paths; the CV network is one of them, at a new spot every visit. Scrolling
   balls the hero text up into a bead that flies into that network's first research neuron while the camera zooms into
   it, and the journey then builds the network one neuron at a time: each neuron's strings grow out of the previous
   layer and the neuron pops in, the camera moves to it, and it explodes into its card and sucks back in before the next.
   Nav and home clicks warp instead of scrolling: the open card balls up, the whole network forms and contorts, the
   camera rides the wires from the current neuron to the target one, pivoting and changing plane on the way, and lands
   on it (a random neuron, then the floating view, on the way home). Between layers the camera
   takes a shot picked at random on each visit: a swivel either way, a vertical flip, a tumble, or a ride that zooms
   into the last neuron, follows the new string and zooms back out at the next one. Whatever is out of focus stays as
   beads on strings: drag a bead, let go, and the strings ring. Boring mode: the document, with a drifting population
   of faded architecture diagrams behind it (MLP, LSTM, Transformer, CNN, RNN, GNN) that wander about and every so
   often rearrange themselves into another architecture; hover to wiggle, drag to move, click to break: the pieces
   knock the others about, fall off the screen, and new ones drift in. */
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
  function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); layoutSpacer(); if (!gadgets.length) seedGadgets(); if (!flos.length) seedFlos(); }

  // ───────── the network: an input layer, one layer per section, one neuron per entry ─────────
  const SECS = window.LAYERS || [];
  const LAYERS = [{ id: 'input', name: 'Input', cards: [] }].concat(SECS);
  const counts = LAYERS.map((L, k) => k === 0 ? 4 : Math.max(1, L.cards.length)); const NLy = counts.length, Lmax = NLy - 1;
  const r0 = rng(21); const nodes = [], byL = [];
  counts.forEach((n, k) => { const row = []; for (let i = 0; i < n; i++) { const nd = { k, i, n, x: k + (r0() - 0.5) * 0.06, y: (i - (n - 1) / 2) * 0.5 + (n > 1 ? (r0() - 0.5) * 0.05 : 0), z: (r0() - 0.5) * 0.3, ox: 0, oy: 0, vx: 0, vy: 0, out: k === Lmax, short: k ? LAYERS[k].cards[i].short : '', bPrev: 0, act: 0, hov: 0, vis: 0, vr: 0, doneT: -1, p: { x: 0, y: 0, s: 1, z: 0 } }; nodes.push(nd); row.push(nd); } byL.push(row); });
  const edges = []; { const r = rng(99); for (let k = 0; k < Lmax; k++) byL[k].forEach(A => byL[k + 1].forEach(B => edges.push({ A, B, k: k + 1, w: (r() - 0.5) * 2, amp: 0, t0: -9, ph: r() * 6.28 }))); }
  const adj = new Map(); nodes.forEach(nd => adj.set(nd, [])); edges.forEach(e => { adj.get(e.A).push(e); adj.get(e.B).push(e); });
  const spanK = (k) => (counts[k] - 1) * 0.5; const maxSpan = Math.max(...counts.map((_, k) => spanK(k)));

  // ───────── camera: a focus point in the world, where it sits on screen, a zoom, and a yaw about the vertical axis ─────────
  const cam = { fx: 0, fy: 0, ax: 0, ay: 0, s: 100, th: 0, ph: 0 }; let camInit = false; const PERSP = 3.2; let tilt = 0;
  function proj(x, y, z, out) { // yaw about the vertical axis through the focus, then pitch about the horizontal one, then perspective
    const dx = x - cam.fx, dy = y - cam.fy; const th = cam.th + tilt; const c = Math.cos(th), sn = Math.sin(th); const xr = dx * c + z * sn; let zr = -dx * sn + z * c;
    const cp = Math.cos(cam.ph), sp = Math.sin(cam.ph); const yr = dy * cp - zr * sp; zr = dy * sp + zr * cp;
    const k = PERSP / Math.max(0.25, PERSP + zr); const sc = cam.s * k; out.x = cam.ax + xr * sc; out.y = cam.ay + yr * sc; out.s = sc; out.z = zr; return out; }
  const _p = { x: 0, y: 0, s: 1, z: 0 }, _q = { x: 0, y: 0, s: 1, z: 0 };
  const toScreen = (x, y, z) => { const o = { x: 0, y: 0, s: 1, z: 0 }; return proj(x, y, z || 0, o); };
  // the home page: the CV network floats among the others, small, drifting and gently turning; it takes a new spot every visit
  const floatHome = { x: 0.7, y: 0.5, s: 30, yaw0: 0, yawA: 0.5, ph: 0, t0: 0 }; let awayFlag = false;
  function randomizeHome() { const m = narrow(), r = Math.random; floatHome.x = m ? 0.25 + 0.5 * r() : 0.54 + 0.36 * r(); floatHome.y = m ? 0.13 + 0.15 * r() : 0.22 + 0.56 * r(); floatHome.s = (m ? 19 : 27) + 10 * r(); floatHome.yaw0 = (r() - 0.5) * 0.8; floatHome.yawA = 0.35 + 0.4 * r(); floatHome.ph = r() * 6.28; floatHome.t0 = tNow; }
  function poseHero() { const el = tNow - floatHome.t0; return { fx: Lmax / 2, fy: 0, ax: floatHome.x * W + 24 * Math.sin(el * 0.19 + floatHome.ph), ay: floatHome.y * H + 16 * Math.cos(el * 0.16 + floatHome.ph * 0.7), s: floatHome.s, th: floatHome.yaw0 + floatHome.yawA * Math.sin(el * 0.22 + floatHome.ph), ph: 0.18 * Math.sin(el * 0.27 + floatHome.ph * 1.3) }; }
  // each layer is viewed head-on, but the yaw and pitch it is reached at depend on the shots taken on the way (multiples of π)
  const thL = [0], phL = [0], shots = [null];
  function poseLayer(k) { const m = narrow(); const s = m ? Math.min(W * 0.5, H * 0.3 / (spanK(k) + 0.4)) : Math.min(W * 0.36, H * 0.58 / (spanK(k) + 0.45)); return { fx: k, fy: 0, ax: W / 2, ay: m ? H * 0.27 : H * 0.5, s, th: thL[k], ph: phL[k] }; }
  function poseNeuron(k, i) { const p = poseLayer(k); p.fy = 0.7 * byL[k][i].y; return p; }
  function poseClose(k, i, mul) { const p = poseLayer(k), nd = byL[k][i]; p.fx = nd.x; p.fy = nd.y; p.s *= mul; return p; }
  const lerpPose = (a, b, f) => ({ fx: mix(a.fx, b.fx, f), fy: mix(a.fy, b.fy, f), ax: mix(a.ax, b.ax, f), ay: mix(a.ay, b.ay, f), s: Math.exp(mix(Math.log(a.s), Math.log(b.s), f)), th: mix(a.th, b.th, f), ph: mix(a.ph || 0, b.ph || 0, f) });
  // the shots between layers, picked at random on every visit: swivel (half turn either way), loop (a full vertical turn, so every layer
  // stays upright with its first neuron on top), arc (a swivel that lifts over the top), ride (zoom into the last neuron, follow the new
  // string, zoom out at the next one). The first shot leaves the home page, so no ride there.
  { const pick = (arr, avoid) => { let v; do { v = arr[Math.floor(Math.random() * arr.length)]; } while (v === avoid && arr.length > 1); return v; };
    shots[1] = 'zoom'; for (let k = 2; k < NLy; k++) shots[k] = pick(['swivel', 'swivel-', 'loop', 'arc', 'ride'], shots[k - 1]);
    if (NLy > 2 && !shots.includes('ride')) shots[2 + Math.floor(Math.random() * (NLy - 2))] = 'ride';
    for (let k = 1; k < NLy; k++) { const sh = shots[k]; thL[k] = thL[k - 1] + (sh === 'swivel' || sh === 'arc' ? Math.PI : sh === 'swivel-' ? -Math.PI : 0); phL[k] = phL[k - 1] + (sh === 'loop' ? 2 * Math.PI : 0); } }
  // keyframes along the scroll, in beats. Leaving home: the network retracts, the first research neuron is created, then the shot.
  // In a layer: each next neuron is created while the camera holds on the previous one, then the camera moves to it and it bursts.
  // Between layers: the card closes, the next layer's first neuron is created (strings from the whole previous layer), then the shot.
  const kfs = [], layerStart = [], pois = [0]; let total = 0; const HOLD = 0.4, SHOT = 0.9, ZOOM = 1.1;
  { kfs.push({ u: 0, f: poseHero }); kfs.push({ u: HOLD, f: poseHero }); let S0 = HOLD, prevF = poseHero;
    for (let k = 1; k < NLy; k++) { const n = counts[k]; const uE = S0 + (k === 1 ? ZOOM : SHOT); layerStart[k] = uE; const sh = shots[k];
      if (sh === 'zoom') { /* straight in from the floating view: the zoom is the shot */ }
      else if (sh === 'ride') { const A = byL[k - 1][counts[k - 1] - 1], B = byL[k][0]; const kk = k;
        kfs.push({ u: S0 + 0.2 * SHOT, f: () => poseClose(kk - 1, A.i, 3) });
        kfs.push({ u: S0 + 0.55 * SHOT, f: () => { const p = poseLayer(kk); p.fx = kk - 0.5; p.fy = (A.y + B.y) / 2; p.s *= 1.7; p.th = thL[kk - 1] + 0.6; p.ph = phL[kk - 1]; return p; } });
        kfs.push({ u: S0 + 0.82 * SHOT, f: () => poseClose(kk, 0, 3) }); }
      else kfs.push({ u: S0 + SHOT / 2, f: ((pf, kk, arc) => () => { const m = lerpPose(pf(), poseLayer(kk), 0.5); m.s *= arc ? 0.38 : 0.42; if (arc) m.ph += 0.75; return m; })(prevF, k, sh === 'arc') });
      kfs.push({ u: uE, f: ((kk) => () => poseLayer(kk))(k) });
      for (let i = 0; i < n; i++) { if (i > 0) kfs.push({ u: uE + i, f: ((kk, ii) => () => poseNeuron(kk, ii))(k, i - 1) }); kfs.push({ u: uE + i + 0.5, f: ((kk, ii) => () => poseNeuron(kk, ii))(k, i) }); pois.push(uE + i + 0.5);
        byL[k][i].c0 = i > 0 ? uE + i - 0.45 : (k === 1 ? 0.5 : S0 - 0.45); }
      const B = uE + n - 0.5; prevF = ((kk, ii) => () => poseNeuron(kk, ii))(k, n - 1);
      if (k < Lmax) { S0 = B + 0.75; kfs.push({ u: S0, f: prevF }); } else { total = B + 0.9; kfs.push({ u: total, f: prevF }); pois.push(total); } } }
  const BEAT = () => H * 0.8;
  const spacer = document.getElementById('spacer');
  function layoutSpacer() { if (spacer) spacer.style.height = Math.round(total * BEAT() + H) + 'px'; }
  function poseAt(u) { if (u <= kfs[0].u) return kfs[0].f(); for (let j = 1; j < kfs.length; j++) { if (u <= kfs[j].u) { const a = kfs[j - 1], b = kfs[j]; const f = smooth((u - a.u) / Math.max(1e-6, b.u - a.u)); return lerpPose(a.f(), b.f(), f); } } return kfs[kfs.length - 1].f(); }
  const burstOf = (k, i, u) => { if (k === 0) return 0; const local = u - (layerStart[k] + i); if (local < 0) return 0; if (k === Lmax) return backOut(local / 0.32); if (local >= 1) return 0; return backOut(local / 0.32) * (1 - smooth((local - 0.7) / 0.3)); };
  const layerWeight = (k, u) => k === 0 ? 0 : smooth((u - (layerStart[k] - 1.0)) / 0.5) * (k === Lmax ? 1 : 1 - smooth((u - (layerStart[k] + counts[k] + 0.2)) / 0.45));
  window.jumpToLayer = (id) => { const k = LAYERS.findIndex(L => L.id === id); if (k < 1) return; startWarp(layerStart[k] + 0.5, byL[k][0]); };
  window.jumpToNeuron = (k, i) => { if (k < 1 || k >= NLy || i >= counts[k]) return; startWarp(layerStart[k] + i + 0.5, byL[k][i]); };
  window.warpHome = () => { if (warp.on) return; if (sv / BEAT() < 0.05) { lightUp(); return; } startWarp(0, null); };
  // the fidget: the CV network and a handful of the floating ones light up together
  function lightUp() { if (!build.pending) startPass(false); nextHomePass = tNow + 4 + Math.random() * 4; const picks = flos.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(flos.length, 3 + Math.floor(Math.random() * 3))); picks.forEach((f, j) => { f.nextPass = tNow + j * 0.12; }); }
  window.resetJourney = () => { sv = 0; const p = poseHero(); Object.assign(cam, p); camInit = true; };
  window.__shots = shots;
  // snapping: after the wheel stops, settle onto the nearest beat (forward-biased)
  let scrollTw = null, settleTimer = null, touching = false, lastY = 0, dir = 1;
  function goTo(to, ms) { const from = window.scrollY; if (scrollTw) cancelAnimationFrame(scrollTw.raf); if (reduced) { window.scrollTo(0, to); return; } const d = ms || Math.min(900, 300 + Math.abs(to - from) * 0.3); const t0 = performance.now(); const step = (now) => { const k = clamp((now - t0) / d); const e = 1 - Math.pow(1 - k, 3); window.scrollTo(0, from + (to - from) * e); if (k < 1) scrollTw.raf = requestAnimationFrame(step); else scrollTw = null; }; scrollTw = { raf: requestAnimationFrame(step) }; }
  function cancelTween() { if (scrollTw) { cancelAnimationFrame(scrollTw.raf); scrollTw = null; } }
  function settle() { if (mode() !== 'journey' || touching || dragNode || warp.on) return; const u = window.scrollY / BEAT(); let ahead = pois.find(p => p > u + 0.02), behind = [...pois].reverse().find(p => p <= u + 0.02); if (ahead == null || behind == null) return; const frac = (u - behind) / Math.max(1e-6, ahead - behind); const target = dir > 0 ? (frac > 0.3 ? ahead : behind) : (frac < 0.7 ? behind : ahead); if (Math.abs(target - u) > 0.01) goTo(Math.round(target * BEAT()), 520); }
  function scheduleSettle() { clearTimeout(settleTimer); settleTimer = setTimeout(settle, 170); }
  window.addEventListener('scroll', () => { const y = window.scrollY; if (y !== lastY) dir = y > lastY ? 1 : -1; lastY = y; }, { passive: true });
  window.addEventListener('wheel', () => { if (mode() === 'journey') { cancelTween(); scheduleSettle(); } }, { passive: true });
  window.addEventListener('touchstart', () => { touching = true; cancelTween(); }, { passive: true });
  window.addEventListener('touchend', () => { touching = false; if (mode() === 'journey') scheduleSettle(); }, { passive: true });
  window.addEventListener('keydown', (e) => { if (mode() !== 'journey' || warp.on || (e.target && /input|textarea|select/i.test(e.target.tagName))) return; const u = window.scrollY / BEAT(); if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { const n = pois.find(p => p > u + 0.05); if (n != null) { e.preventDefault(); goTo(Math.round(n * BEAT()), 600); } } if (['ArrowUp', 'PageUp'].includes(e.key)) { const p = [...pois].reverse().find(p => p < u - 0.05); e.preventDefault(); goTo(Math.round((p == null ? 0 : p) * BEAT()), 600); } });

  // ───────── warps: nav and home clicks. The open card balls up, every neuron forms (left to right), the camera spins and
  // contorts through the whole network, then zooms into the target neuron while the neurons beyond it un-form; on the way
  // home it zooms into a random neuron and settles on the home page, where a pass fires ─────────
  const warp = { on: false, t0: 0, dur: 1.8, from: 0, to: 0, F: null, T: null, path: [], dir: 1, pdir: 1, P0: null, PT: null, thEnd: 0, phEnd: 0, sRide: 100, homeFrom: false, homeTo: false };
  const nearestTurn = (a, target) => a + 2 * Math.PI * Math.round((target - a) / (2 * Math.PI)); const atHome = (u) => u < 0.05;
  function focusNode(u) { let best = null, bb = 0.05; nodes.forEach(nd => { if (nd.k === 0) return; const b = burstOf(nd.k, nd.i, u); if (b > bb) { bb = b; best = nd; } }); if (best) return best; let last = null; nodes.forEach(nd => { if (nd.k > 0 && nd.c0 <= u && (!last || nd.c0 > last.c0)) last = nd; }); return last || byL[1][0]; }
  function startWarp(toU, Tnode) {
    if (mode() !== 'journey' || warp.on) return; const fromU = sv / BEAT(); if (Math.abs(fromU - toU) < 0.05) return;
    if (reduced) { window.scrollTo(0, Math.round(toU * BEAT())); sv = toU * BEAT(); Object.assign(cam, poseAt(toU)); return; }
    cancelTween(); clearTimeout(settleTimer); nodes.forEach(nd => { nd.cStart = nd.c; }); const r = Math.random;
    warp.homeFrom = atHome(fromU); warp.homeTo = atHome(toU); if (warp.homeTo) randomizeHome();
    const F = warp.homeFrom ? byL[0][Math.floor(r() * counts[0])] : focusNode(fromU);
    const T = Tnode || (() => { const cand = nodes.filter(nd => nd.k > 0); return cand[Math.floor(r() * cand.length)]; })();
    // the path rides the wires: one neuron per layer in between (via a neighbouring layer when both are in the same one)
    const path = [F]; const step = Math.sign(T.k - F.k); if (step === 0) { const kv = F.k < Lmax ? F.k + 1 : F.k - 1; path.push(byL[kv][Math.floor(r() * counts[kv])]); } else for (let k = F.k + step; k !== T.k; k += step) path.push(byL[k][Math.floor(r() * counts[k])]); path.push(T);
    const P0 = Object.assign({}, cam), PT = warp.homeTo ? poseHero() : poseAt(toU), dir = r() < 0.5 ? -1 : 1;
    warp.thEnd = nearestTurn(PT.th, P0.th + Math.PI * dir); warp.phEnd = nearestTurn(PT.ph, P0.ph); warp.dir = dir; warp.pdir = r() < 0.5 ? -1 : 1;
    warp.sRide = Math.max(warp.homeTo ? PT.s * 5 : poseLayer(T.k).s * 1.3, 150); warp.P0 = P0; warp.PT = PT; warp.F = F; warp.T = T; warp.path = path;
    warp.on = true; warp.t0 = tNow; warp.from = fromU; warp.to = toU; warp.dur = 1.8;
  }
  function pathPoint(q) { const p = warp.path, n = p.length - 1; if (n <= 0) return { x: p[0].x, y: p[0].y }; const sq = clamp(q) * n, j = Math.min(n - 1, Math.floor(sq)), f = sq - j; return { x: mix(p[j].x, p[j + 1].x, f), y: mix(p[j].y, p[j + 1].y, f) }; }
  function warpState(t) {
    const wt = clamp((t - warp.t0) / warp.dur), from = warp.from, to = warp.to, P0 = warp.P0, hf = warp.homeFrom, ht = warp.homeTo, m = narrow();
    const PT = ht ? poseHero() : warp.PT; const ride = smooth((wt - 0.1) / 0.68); const ayC = m ? H * 0.4 : H * 0.5; let pose;
    if (wt < 0.1) pose = P0;
    else if (wt < 0.78) { const q = pathPoint(ride), sIn = smooth((wt - 0.1) / 0.2); pose = { fx: q.x, fy: q.y, ax: mix(P0.ax, W / 2, sIn), ay: mix(P0.ay, ayC, sIn), s: Math.exp(mix(Math.log(P0.s), Math.log(warp.sRide), sIn)), th: mix(P0.th, warp.thEnd, ride) + 0.45 * Math.sin(Math.PI * ride) * warp.dir, ph: mix(P0.ph, warp.phEnd, ride) + 0.55 * Math.sin(Math.PI * ride) * warp.pdir }; }
    else { const T = warp.T, A = { fx: T.x, fy: T.y, ax: W / 2, ay: ayC, s: warp.sRide, th: warp.thEnd, ph: warp.phEnd }, E = Object.assign({}, PT, { th: warp.thEnd, ph: warp.phEnd });
      if (ht) { const C = { fx: T.x, fy: T.y, ax: PT.ax, ay: PT.ay, s: PT.s * 3, th: warp.thEnd, ph: warp.phEnd }; pose = wt < 0.88 ? lerpPose(A, C, smooth((wt - 0.78) / 0.1)) : lerpPose(C, E, smooth((wt - 0.88) / 0.12)); }
      else pose = lerpPose(A, E, smooth((wt - 0.78) / 0.22)); }
    const zk = (u) => smooth((u - 0.5) / 0.7);
    return { wt, pose, done: wt >= 1, hf, ht, wob: Math.sin(Math.PI * clamp((wt - 0.08) / 0.8)),
      mk: hf ? smooth(wt / 0.15) : ht ? 1 - smooth((wt - 0.86) / 0.14) : 1,
      fly: hf ? smooth((wt - 0.08) / 0.2) : ht ? 1 - smooth((wt - 0.86) / 0.14) : 1,
      flo: hf ? 1 - smooth(wt / 0.25) : ht ? smooth((wt - 0.84) / 0.16) : 0,
      heroK: hf ? 1 - smooth(wt / 0.15) : ht ? smooth((wt - 0.86) / 0.14) : 0,
      zoomK: mix(zk(from), zk(to), smooth((wt - 0.1) / 0.3)),
      lw: (kk) => mix(layerWeight(kk, from), layerWeight(kk, to), smooth((wt - 0.3) / 0.4)),
      c: (nd) => { const form = clamp((wt - 0.04 - nd.x * 0.03) / 0.16), cB = Math.max(nd.cStart, form); const un = clamp((wt - 0.74 - (Lmax - nd.x) * 0.02) / 0.16); return mix(cB, Math.min(cB, journeyC(nd, to)), un); },
      burst: (kk, i) => burstOf(kk, i, from) * (1 - smooth(wt / 0.12)) + burstOf(kk, i, to) * smooth((wt - 0.86) / 0.14) };
  }
  function endWarp() { const to = warp.to; warp.on = false; window.scrollTo(0, Math.round(to * BEAT())); sv = to * BEAT(); lastY = window.scrollY; Object.assign(cam, poseAt(to)); if (to === 0) { build.pending = false; build.started = true; build.t0 = -1e9; awayFlag = false; lightUp(); } }
  window.__warp = () => warp.on ? { wt: +((tNow - warp.t0) / warp.dur).toFixed(2), from: +warp.from.toFixed(2), to: +warp.to.toFixed(2), path: warp.path.map(nd => [nd.k, nd.i]) } : null;

  // ───────── building the network, then forward passes (home page) ─────────
  // a cycle: the network retracts right to left, is drawn back in left to right (neurons pop, strings draw), then a pass runs
  const pop = (t) => { t = clamp(t); const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const build = { t0: 1e9, dis: false, pending: false, fromPointer: false, px: 0, py: 0, started: false }; const DIS = 0.5, GAP = 0.2, BUILD = Lmax * GAP + 0.55; let nextHomePass = 1e9;
  const stag = (nd) => (nd.n > 1 ? nd.i / (nd.n - 1) * 0.5 : 0);
  function heroLb(k, t) { if (reduced) return 1; let tb = t; if (build.dis) { if (t < DIS) return 1 - smooth((t - (Lmax - k) * 0.04) / 0.3); tb = t - DIS; } return clamp((tb - k * GAP) / 0.55); }
  // along the scroll: everything retracts right to left while the hero copy fades (the input column goes last and stays gone),
  // then each neuron is created at its own moment (nd.c0, set with the keyframes): strings first, then the pop
  function journeyC(nd, u) { if (reduced) return 1; const down = 1 - smooth((u - (0.3 + (Lmax - nd.k) * 0.1)) / 0.2); if (nd.k === 0) return down; if (nd.k === 1 && nd.i === 0) return Math.max(down, clamp((u - nd.c0) / 0.45), u < 1 ? 1 : 0); return Math.max(down, clamp((u - nd.c0) / 0.45)); }
  const pass = { on: false, t0: 0, acts: null, path: null, y: 0 }; const STEP = 0.42;
  function queuePass(fromPointer) { if (build.pending) return; build.px = ptr.x; build.py = ptr.y; startPass(!!fromPointer); nextHomePass = tNow + 4 + Math.random() * 4; }
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
    if (dragNode) { const sc = dragNode.p.s || cam.s; dragNode.ox += (ptr.x - ptr.px) / sc; dragNode.oy += (ptr.y - ptr.py) / sc; dragNode.vx = dragNode.vy = 0; pluck(dragNode, clamp(Math.hypot(ptr.vx, ptr.vy) / sc * 0.05, 0, 0.14)); }
    if (dragGad) { dragGad.cx = ptr.x - dragGad.gx; dragGad.cy = ptr.y - dragGad.gy; dragGad.ax = dragGad.cx; dragGad.ay = dragGad.cy; } }, { passive: true });
  window.addEventListener('pointerdown', (e) => { if (e.button !== 0 || interactive(e.target)) return; ptr.x = e.clientX; ptr.y = e.clientY; ptr.down = true; downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (mode() === 'journey') { let best = null, bd = 26; nodes.forEach(nd => { if (nd.vis < 0.5) return; const d = Math.hypot(nd.p.x - e.clientX, nd.p.y - e.clientY); if (d < bd) { bd = d; best = nd; } });
      if (best) { dragNode = best; pluck(best, 0.08); if (heroVis > 0.5 && !warp.on) queuePass(true); e.preventDefault(); return; }
      let fb = null, fd = 1e9; flos.forEach(f => { const d = Math.hypot(f.cx - e.clientX, f.cy - e.clientY); if (d < f.sz * 2.2 && d < fd) { fd = d; fb = f; } }); if (fb) { floPass(fb); return; }
      if (heroVis > 0.5 && !warp.on) queuePass(true); return; }
    let best = null, bd = 1e9; gadgets.forEach(gd => { if (gd.state !== 'float') return; const d = Math.hypot(gd.cx - e.clientX, gd.cy - e.clientY); if (d < gd.sz * 1.6 && d < bd) { bd = d; best = gd; } }); if (best) { dragGad = best; best.gx = e.clientX - best.cx; best.gy = e.clientY - best.cy; best.drag = true; best.parts.forEach(p => { p.vx += (Math.random() - 0.5) * 140; p.vy += (Math.random() - 0.5) * 140; }); e.preventDefault(); } });
  window.addEventListener('pointerup', (e) => { ptr.down = false; const moved = Math.hypot(ptr.x - downAt.x, ptr.y - downAt.y), held = performance.now() - downAt.t;
    if (dragNode) { const sc = dragNode.p.s || cam.s; if (moved < 5 && held < 350) { dragNode.vy -= 0.6; } else { dragNode.vx = ptr.vx / sc * 0.6; dragNode.vy = ptr.vy / sc * 0.6; pluck(dragNode, clamp(0.04 + Math.hypot(ptr.vx, ptr.vy) / sc * 0.08, 0.04, 0.22)); } dragNode = null; }
    else if (dragGad) { dragGad.drag = false; if (moved < 6 && held < 400) breakGadget(dragGad); dragGad = null; }
    });
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
  const heroCopy = document.getElementById('hero-copy');
  let sv = 0;
  function drawJourney(t, dt) {
    const target = window.scrollY; sv += (target - sv) * (reduced ? 1 : 1 - Math.exp(-dt * 14)); if (Math.abs(target - sv) < 0.3) sv = target;
    const u = sv / BEAT(); const Wp = warp.on ? warpState(t) : null; const p = Wp ? Wp.pose : poseAt(u);
    if (!Wp) { if (u > 2 && !awayFlag) { awayFlag = true; randomizeHome(); } else if (u < 0.05) awayFlag = false; }
    if (!camInit || Wp) { Object.assign(cam, p); camInit = true; } else { const k = 1 - Math.exp(-dt * 10); cam.fx += (p.fx - cam.fx) * k; cam.fy += (p.fy - cam.fy) * k; cam.ax += (p.ax - cam.ax) * k; cam.ay += (p.ay - cam.ay) * k; cam.s = Math.exp(Math.log(cam.s) + (Math.log(p.s) - Math.log(cam.s)) * k); cam.th += (p.th - cam.th) * k; cam.ph += (p.ph - cam.ph) * k; }
    const heroK = Wp ? Wp.heroK : 1 - smooth((u - 0.1) / 0.7), zoomK = Wp ? Wp.zoomK : smooth((u - 0.5) / 0.7); heroVis = heroK;
    // the hero text balls up into a bead (mk) that flies into the first research neuron (fly) while the camera zooms into the network;
    // the other floating architectures fade out on the way (floA)
    const mk = Wp ? Wp.mk : smooth((u - 0.08) / 0.45), fly = Wp ? Wp.fly : smooth((u - 0.45) / 0.5), floA = Wp ? Wp.flo : 1 - smooth((u - 0.3) / 0.5);
    const beadNode = Wp ? (Wp.hf ? warp.path[0] : Wp.ht ? warp.T : null) : byL[1][0];
    tilt += (((narrow() || ptr.x < 0) ? 0 : 0.07 * ptr.nx * zoomK) - tilt) * (1 - Math.exp(-dt * 3));
    const tcx = heroCopy ? heroCopy.offsetLeft + heroCopy.offsetWidth / 2 : W * 0.3, tcy = heroCopy ? heroCopy.offsetTop + heroCopy.offsetHeight / 2 : H * 0.5;
    if (heroCopy) { const sc = 1 - 0.97 * mk * mk; heroCopy.style.opacity = (1 - smooth((mk - 0.45) / 0.5)).toFixed(3); heroCopy.style.transform = `scale(${sc.toFixed(4)})`; heroCopy.style.visibility = mk > 0.985 ? 'hidden' : ''; }
    const lw = counts.map((_, k) => Wp ? Wp.lw(k) : layerWeight(k, u)); let activeK = -1, aw = 0.25; lw.forEach((w, k) => { if (w > aw) { aw = w; activeK = k; } });
    const bOf = (k, i) => Wp ? Wp.burst(k, i) : burstOf(k, i, u);
    // the home cycle: draw the network in, run a pass; again every few seconds, or on a click
    if (!build.started) { build.started = true; build.dis = false; build.t0 = t + 0.35; build.pending = true; }
    const ct = t - build.t0; if (build.pending && ct >= (reduced ? 0 : BUILD - 0.12)) { build.pending = false; startPass(false); nextHomePass = t + 4 + Math.random() * 4; }
    if (heroK < 0.5) nextHomePass = t + 2 + Math.random() * 3; else if (!build.pending && !reduced && document.visibilityState === 'visible' && t > nextHomePass) { startPass(false); nextHomePass = t + 4 + Math.random() * 5; }
    const hw = Wp ? 0 : 1 - smooth((u - 0.02) / 0.1); const lb = counts.map((_, k) => heroLb(k, ct));
    const el = pass.on ? (performance.now() - pass.t0) / 1000 : 99, pt = el / STEP; const fadeP = smooth((el - STEP * (NLy + 1) - 1.0) / 1.2); if (pass.on && fadeP >= 1) pass.on = false;
    // physics: beads spring home, the pointer pushes what it passes, strings ring down
    nodes.forEach(nd => { if (nd === dragNode) return; const dx = nd.p.x - ptr.x, dy = nd.p.y - ptr.y, d = Math.hypot(dx, dy); let fx = -30 * nd.ox - 4.5 * nd.vx, fy = -30 * nd.oy - 4.5 * nd.vy;
      if (d < 70 && d > 0.1 && !ptr.down) { const f = (1 - d / 70) * 130 / Math.max(40, nd.p.s); fx += dx / d * f; fy += dy / d * f; if (Math.random() < 0.08) pluck(nd, 0.03); }
      nd.vx += fx * dt; nd.vy += fy * dt; nd.ox += nd.vx * dt; nd.oy += nd.vy * dt;
      const hv = d < 90 ? 1 - d / 90 : 0; nd.hov += (hv - nd.hov) * (1 - Math.exp(-dt * 8));
      let a = 0; if (pass.on) { const reach = clamp(pt - nd.k); a = pass.acts[nd.k][nd.i] * smooth(reach) * (1 - fadeP); } nd.act += (a * heroK - nd.act) * (1 - Math.exp(-dt * 10));
      nd.c = Wp ? Wp.c(nd) : mix(journeyC(nd, u), clamp((lb[nd.k] - stag(nd) * 0.9) / 0.5), hw); nd.vr = clamp((nd.c - 0.25) / 0.75); nd.vis = pop(nd.vr); if (nd.c >= 0.99) { if (nd.doneT < 0) nd.doneT = t; } else nd.doneT = -1;
      const wob = Wp ? Wp.wob : 0; proj(nd.x + nd.ox + wob * 0.16 * Math.sin(nd.y * 4 + t * 7 + nd.k), nd.y + nd.oy + wob * 0.12 * Math.cos(nd.x * 3 + t * 6), nd.z + wob * 0.35 * Math.sin(nd.x * 2 + nd.y * 3 + t * 5), nd.p); });
    g.clearRect(0, 0, W, H); if (floA > 0.01) stepFlos(t, dt, floA); g.lineWidth = 1;
    // strings
    edges.forEach(e => { const ev = Math.min(clamp(e.B.c / 0.85), clamp(e.A.c * 2)); if (ev <= 0.001) return; const A = e.A.p, B = e.B.p; const inFocus = Math.max(lw[e.k - 1] || 0, lw[e.k] || 0); const depth = clamp(1 - (A.z + B.z) * 0.22, 0.3, 1.2);
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
    // a faint dashed trace to where the next neuron will appear, a hint that there is more to scroll: the moment a neuron is created it
    // draws itself out over half a second and ends in a ghost ring; it fades once the next neuron is created
    if (zoomK > 0.02 && !Wp) { g.setLineDash([3, 6]); g.strokeStyle = col.ink;
      for (let k = 1; k < NLy; k++) { const w = lw[k] * zoomK; if (w < 0.02) continue; byL[k].forEach((nd, i) => { const nx = i + 1 < counts[k] ? byL[k][i + 1] : (k < Lmax ? byL[k + 1][0] : null); if (!nx || nd.doneT < 0) return; const tp = reduced ? 1 : clamp((t - nd.doneT) / 0.5), te = 1 - Math.pow(1 - tp, 3); const a = 0.3 * w * (1 - smooth(nx.c * 2)); if (a < 0.01) return;
        const A = nd.p, B = nx.p; g.globalAlpha = a; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(mix(A.x, B.x, te), mix(A.y, B.y, te)); g.stroke(); const ra = clamp((tp - 0.7) / 0.3); if (ra > 0.01) { g.globalAlpha = a * ra; g.beginPath(); g.arc(B.x, B.y, clamp(0.045 * B.s, 3, 24) * (0.5 + 0.4 * ra), 0, 6.2832); g.stroke(); } }); }
      g.setLineDash([]); }
    // beads (far first), bursts, names
    const Rb = Math.min(W, H) * 0.14; const bursts = []; g.textBaseline = 'middle';
    const order = nodes.slice().sort((a, b) => b.p.z - a.p.z);
    order.forEach(nd => { if (nd.vis < 0.01) return; const s = nd.p; const r0 = clamp(0.045 * s.s * (nd.out ? 1.5 : 1), 3, 24), r = r0 * nd.vis; const b = bOf(nd.k, nd.i); const focus = lw[nd.k]; const bb = clamp(b);
      if (bb > 0.05 && nd.bPrev <= 0.05) pluck(nd, 0.07); nd.bPrev = bb;
      const onPath = pass.on && pass.path[nd.k] === nd.i && pt > nd.k + 0.5 && heroK > 0.5;
      if (bb > 0.002) { bursts.push({ nd, b: bb, s, R: r + b * Rb }); g.fillStyle = col.accent; g.globalAlpha = 0.07 * bb; g.beginPath(); g.arc(s.x, s.y, r + b * Rb, 0, 6.2832); g.fill(); g.strokeStyle = col.accent; g.globalAlpha = 0.55 * bb; g.beginPath(); g.arc(s.x, s.y, r + b * Rb, 0, 6.2832); g.stroke(); }
      const depth = clamp(1 - s.z * 0.3, 0.45, 1.2);
      if (nd.vr > 0.01 && nd.vr < 0.99) { g.strokeStyle = col.accent; g.globalAlpha = 0.5 * (1 - nd.vr) * depth; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, r0 * (0.5 + 1.5 * nd.vr), 0, 6.2832); g.stroke(); }
      sphere(s.x, s.y, r * (1 + 0.25 * nd.act), focus * zoomK, Math.max(bb, nd.act * 0.9, onPath ? 0.5 : 0), (0.4 + 0.5 * focus * zoomK + 0.4 * bb + 0.3 * nd.act) * depth);
      if (nd.hov > 0.05 && heroK < 0.5) { g.strokeStyle = col.accent; g.globalAlpha = nd.hov * 0.5; g.beginPath(); g.arc(s.x, s.y, r + 5 * nd.hov, 0, 6.2832); g.stroke(); }
      const la = focus * zoomK * (1 - bb) * nd.vr * (cam.s > 160 ? 1 : 0); if (la > 0.03 && nd.short) { g.fillStyle = col.ink; g.globalAlpha = 0.65 * la; g.font = `500 12px ${SANS}`; g.textAlign = narrow() ? 'center' : 'left'; g.fillText(nd.short, narrow() ? s.x : s.x + r + 9, narrow() ? s.y + r + 11 : s.y); } });
    // the bead the hero text balls up into, on its way into (or out of) a neuron of the network
    if (mk > 0.01 && fly < 0.999 && beadNode) { const B = beadNode.p; const bx = mix(tcx, B.x, fly), by = mix(tcy, B.y, fly); const rh = mix(Math.min(W, H) * 0.012 + 6, clamp(0.045 * B.s, 3, 24), fly) * smooth((mk - 0.2) / 0.8); if (rh > 0.3) sphere(bx, by, rh, 0.4, 0.6, 0.75); }
    // the output's readout during a pass
    if (pass.on && heroK > 0.5 && pt > Lmax + 0.6 && fadeP < 1) { const o = nodes[nodes.length - 1].p; g.fillStyle = col.accent; g.globalAlpha = 0.9 * (1 - fadeP); g.font = `600 11px ${MONO}`; g.textAlign = 'center'; g.fillText(`output ${pass.y.toFixed(2)}`, o.x, o.y + 22); }
    g.globalAlpha = 1;
    setNav(activeK > 0 && zoomK > 0.5 ? LAYERS[activeK].id : '');
    // cards explode out of their neuron
    LAYERS.forEach((L, k) => L.cards.forEach((c, i) => { const nd = byL[k][i]; const b = bOf(k, i); const el = c.el;
      if (b <= 0.002) { if (el.classList.contains('on')) { el.classList.remove('on'); el.style.opacity = '0'; } return; }
      const s = nd.p; const bb = clamp(b); const R = clamp(0.045 * s.s, 3, 16) + b * Rb; el.classList.add('on');
      const cw = el.offsetWidth, ch = el.offsetHeight; let left, top;
      if (narrow()) { left = 16; top = Math.max(s.y + R + 14, H * 0.42); el.style.maxHeight = (H - top - 12) + 'px'; }
      else { left = s.x + R + 26; if (left + cw > W - 16) left = s.x - R - 26 - cw; top = clamp(s.y - ch / 2, HEAD() + 12, Math.max(HEAD() + 12, H - ch - 12)); el.style.maxHeight = ''; }
      const tx = (s.x - (left + cw / 2)) * (1 - bb), ty = (s.y - (top + ch / 2)) * (1 - bb);
      el.style.left = left.toFixed(1) + 'px'; el.style.top = top.toFixed(1) + 'px'; el.style.opacity = smooth(bb * 1.3).toFixed(3); el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${(0.5 + 0.5 * b).toFixed(3)})`; }));
    if (Wp && Wp.done) endWarp();
    window.__J = { u: +u.toFixed(2), activeK, zoomK: +zoomK.toFixed(2), heroK: +heroK.toFixed(2), bursts: bursts.map(x => [x.nd.k, x.nd.i, +x.b.toFixed(2)]), cam: { fx: +cam.fx.toFixed(2), fy: +cam.fy.toFixed(2), s: Math.round(cam.s), th: +cam.th.toFixed(2), ph: +cam.ph.toFixed(2) }, pass: pass.on ? { pt: +pt.toFixed(2), y: +pass.y.toFixed(2) } : null, dragging: !!dragNode, maxAmp: +Math.max(0, ...edges.map(e => e.amp * Math.exp(-2.2 * (t - e.t0)))).toFixed(3), maxOff: +Math.max(...nodes.map(n => Math.hypot(n.ox, n.oy))).toFixed(3), total: +total.toFixed(2), beat: Math.round(BEAT()), pois, ls: layerStart, nav: navOn, lb: lb.map(v => +v.toFixed(2)), built: counts.map((_, k) => byL[k].filter(nd => nd.vr > 0.99).length), partial: nodes.filter(nd => nd.c > 0.01 && nd.c < 0.99).map(nd => [nd.k, nd.i, +nd.c.toFixed(2)]), traces: nodes.filter(nd => nd.doneT >= 0 && nd.k > 0).map(nd => [nd.k, nd.i, +Math.min(9, t - nd.doneT).toFixed(2)]), shots, mk: +mk.toFixed(2), fly: +fly.toFixed(2), floA: +floA.toFixed(2), flos: flos.length, lit: flos.filter(f => f.pass).length, home: { x: +floatHome.x.toFixed(2), y: +floatHome.y.toFixed(2), s: Math.round(floatHome.s) }, warp: window.__warp(), cycle: { t: +ct.toFixed(2), pending: build.pending, dis: build.dis }, gadgets: gadgets.length, zspread: +(Math.max(...nodes.map(n => n.p.z)) - Math.min(...nodes.map(n => n.p.z))).toFixed(2) };
    window.__nodeScreen = (k, i) => ({ x: byL[k][i].p.x, y: byL[k][i].p.y });
  }

  // ───────── the home field: small architectures (plain MLPs) floating behind the home page, each lighting up along a random path now and then ─────────
  let flos = [];
  function makeFlo() { const r = Math.random, m = narrow(); const nl = 3 + Math.floor(r() * 3); const layers = Array.from({ length: nl }, () => 2 + Math.floor(r() * 4)); const nodes = [], byLayer = [];
    layers.forEach((n, k) => { const row = []; for (let i = 0; i < n; i++) { const nd = { k, i, lx: k - (nl - 1) / 2, ly: (i - (n - 1) / 2) * 0.72, x: 0, y: 0, d: 1, lit: 0 }; nodes.push(nd); row.push(nd); } byLayer.push(row); });
    const edges = []; for (let k = 0; k < nl - 1; k++) byLayer[k].forEach(A => byLayer[k + 1].forEach(B => edges.push({ A, B })));
    return { layers, nodes, byLayer, edges, cx: W * (0.06 + 0.88 * r()), cy: H * (0.08 + 0.84 * r()), vx: (r() - 0.5) * 14, vy: (r() - 0.5) * 10, sz: (m ? 17 : 23) + 13 * r(), yaw: r() * 6.28, yawV: (r() < 0.5 ? -1 : 1) * (0.1 + 0.16 * r()), pass: null, nextPass: tNow + 0.5 + r() * 6, born: tNow }; }
  function seedFlos() { flos = []; const n = narrow() ? 5 : 9; for (let j = 0; j < n; j++) flos.push(makeFlo()); }
  function floPass(f) { f.pass = { t0: tNow, path: f.byLayer.map(row => row[Math.floor(Math.random() * row.length)]) }; }
  window.__flos = () => flos.map(f => ({ x: Math.round(f.cx), y: Math.round(f.cy), layers: f.layers, lit: !!f.pass }));
  function stepFlos(t, dt, alpha) {
    const wrapW = W + 200, wrapH = H + 200;
    flos.forEach(f => { f.cx += f.vx * dt; f.cy += f.vy * dt; if (f.cx < -100) f.cx += wrapW; else if (f.cx > W + 100) f.cx -= wrapW; if (f.cy < -100) f.cy += wrapH; else if (f.cy > H + 100) f.cy -= wrapH; f.yaw += f.yawV * dt;
      if (!f.pass && t > f.nextPass) floPass(f); const pt = f.pass ? (t - f.pass.t0) / 0.32 : -1; const fade = f.pass ? 1 - smooth((t - f.pass.t0 - 0.32 * f.layers.length - 0.9) / 0.8) : 0; if (f.pass && fade <= 0) { f.pass = null; f.nextPass = t + 2.5 + Math.random() * 6; }
      const c = Math.cos(f.yaw), sn = Math.sin(f.yaw); const a0 = alpha * (narrow() ? 0.5 : 0.85) * clamp((t - f.born) / 0.9);
      f.nodes.forEach(nd => { const zr = nd.lx * sn; const k = 2.6 / (2.6 + Math.max(-1.2, zr)); nd.x = f.cx + nd.lx * c * f.sz * k; nd.y = f.cy + nd.ly * f.sz * k; nd.d = k; const on = f.pass && f.pass.path[nd.k] === nd; nd.lit = on ? smooth(pt - nd.k) * fade : 0; });
      // strings, then the lit path with its travelling signals, then the nodes
      g.strokeStyle = col.ink; g.lineWidth = 1; g.beginPath(); f.edges.forEach(e => { g.moveTo(e.A.x, e.A.y); g.lineTo(e.B.x, e.B.y); }); g.globalAlpha = 0.09 * a0; g.stroke();
      if (f.pass) { const P = f.pass.path; g.strokeStyle = col.accent; g.lineWidth = 1.4; for (let k = 0; k < P.length - 1; k++) { const s = clamp(pt - k); if (s <= 0) break; const A = P[k], B = P[k + 1]; g.globalAlpha = 0.85 * a0 * fade; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(mix(A.x, B.x, s), mix(A.y, B.y, s)); g.stroke(); if (s < 1) { g.fillStyle = col.accent; g.beginPath(); g.arc(mix(A.x, B.x, s), mix(A.y, B.y, s), 2.2, 0, 6.2832); g.fill(); } } g.lineWidth = 1; }
      f.nodes.forEach(nd => { const r = 2.3 * nd.d * (1 + 0.5 * nd.lit); g.fillStyle = nd.lit > 0.01 ? mixc('bg', 'accent', nd.lit) : col.bg; g.globalAlpha = a0; g.beginPath(); g.arc(nd.x, nd.y, r, 0, 6.2832); g.fill(); g.strokeStyle = nd.lit > 0.3 ? col.accent : col.ink; g.globalAlpha = (0.38 + 0.5 * nd.lit) * a0 * clamp(nd.d, 0.5, 1); g.beginPath(); g.arc(nd.x, nd.y, r, 0, 6.2832); g.stroke(); if (nd.lit > 0.05) { g.fillStyle = col.accent; g.globalAlpha = 0.18 * nd.lit * a0; g.beginPath(); g.arc(nd.x, nd.y, r + 5, 0, 6.2832); g.fill(); } }); });
    g.globalAlpha = 1;
  }

  // ───────── boring mode: a drifting population of architectures ─────────
  let gadgets = []; let lastScroll = 0; const KINDS = ['MLP', 'LSTM cell', 'Transformer block', 'CNN', 'RNN', 'GNN'];
  function shape(kind, sz, seed) { // the parts (relative) and links of one architecture
    const parts = [], links = []; const P = (x, y, c) => { parts.push({ rx: x, ry: y, c: !!c }); return parts.length - 1; }; const Lk = (a, b) => links.push([a, b]); const box = (x0, y0, x1, y1) => { const b = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]; Lk(b[0], b[1]); Lk(b[1], b[2]); Lk(b[2], b[3]); Lk(b[3], b[0]); return b; };
    if (kind === 'MLP') { const lay = [3, 4, 2]; const ids = lay.map((n, k) => Array.from({ length: n }, (_, i) => P((k - 1) * sz * 0.95, (i - (n - 1) / 2) * sz * 0.48, true))); for (let k = 0; k < 2; k++) ids[k].forEach(a => ids[k + 1].forEach(b => Lk(a, b))); }
    else if (kind === 'LSTM cell') { const w = sz * 1.3, h = sz * 0.75; box(-w, -h, w, h); const gates = [-0.6, -0.2, 0.2, 0.6].map(f => P(f * w, h * 0.25, true)); const inp = P(-w * 1.4, h * 0.6), out = P(w * 1.4, -h * 0.6); gates.forEach(gt => Lk(inp, gt)); const top = [-0.6, -0.2, 0.2, 0.6].map(f => P(f * w, -h * 0.45)); gates.forEach((gt, j) => { Lk(gt, top[j]); if (j < 3) Lk(top[j], top[j + 1]); }); Lk(top[3], out); }
    else if (kind === 'Transformer block') { const w = sz * 1.05, bh = sz * 0.3; const ys = [sz * 1.0, 0, -sz * 1.0]; ys.forEach(y => box(-w, y - bh, w, y + bh)); for (let j = 0; j < 2; j++) Lk(P(0, ys[j] - bh), P(0, ys[j + 1] + bh)); const hub = P(0, 0, true); for (let j = 0; j < 5; j++) Lk(hub, P((j - 2) * w * 0.42, -bh - sz * 0.02)); }
    else if (kind === 'CNN') { let prev = null; for (let q = 0; q < 3; q++) { const o = q * sz * 0.38, s = sz * (0.95 - q * 0.2); const b = box(-s + o, -s - o, s + o, s - o); if (prev) { Lk(prev[0], b[0]); Lk(prev[2], b[2]); Lk(prev[1], b[1]); } prev = b; } }
    else if (kind === 'RNN') { const c = P(0, 0, true); const n = 11; let prev = null, first = null; for (let j = 0; j < n; j++) { const a = Math.PI * (-0.25 + 1.7 * j / (n - 1)); const p = P(sz * 0.62 * Math.cos(a) + sz * 0.35, -sz * 0.62 * Math.sin(a) - sz * 0.25); if (prev != null) Lk(prev, p); else first = p; prev = p; } Lk(c, first); Lk(prev, c); Lk(P(-sz * 1.3, sz * 0.25), c); Lk(c, P(sz * 1.3, sz * 0.25)); }
    else { const r = rng(seed); const ids = []; for (let j = 0; j < 7; j++) { const a = j / 7 * 6.28 + r() * 0.7, d = sz * (0.45 + 0.65 * r()); ids.push(P(Math.cos(a) * d, Math.sin(a) * d, true)); } for (let j = 0; j < 7; j++) { Lk(ids[j], ids[(j + 1) % 7]); if (r() < 0.6) Lk(ids[j], ids[(j + 3) % 7]); } }
    return { parts, links };
  }
  function makeGadget(kind, cx, cy, sz, seed) { const sh = shape(kind, sz, seed); return { kind, cx, cy, ax: cx, ay: cy, vx: 0, vy: 0, sz, ph: seed, parts: sh.parts.map(p => ({ rx: p.rx, ry: p.ry, c: p.c, x: cx + p.rx, y: cy + p.ry, vx: 0, vy: 0 })), links: sh.links, state: 'float', brokeT: 0, drag: false, gx: 0, gy: 0, linkA: 1, born: performance.now(), wa: Math.random() * 6.28, nextMorph: tNow + 4 + Math.random() * 10, morphT: -9 }; }
  // a gadget rearranges itself into another architecture: the new parts start where the old ones are and spring into place
  function morphGadget(gd) { const kinds = KINDS.filter(k => k !== gd.kind); const kind = kinds[Math.floor(Math.random() * kinds.length)]; const sh = shape(kind, gd.sz, gseed++); const old = gd.parts;
    gd.parts = sh.parts.map((p, j) => { const o = old[j % old.length]; return { rx: p.rx, ry: p.ry, c: p.c, x: o.x, y: o.y, vx: o.vx + (Math.random() - 0.5) * 60, vy: o.vy + (Math.random() - 0.5) * 60 }; });
    gd.links = sh.links; gd.kind = kind; gd.morphT = tNow; gd.nextMorph = tNow + 6 + Math.random() * 10; }
  window.__morphGadget = (j) => morphGadget(gadgets[j]);
  let gseed = 300;
  function spawnGadget(fromEdge) { const r = Math.random; const kind = KINDS[Math.floor(r() * KINDS.length)]; const sz = (narrow() ? 22 : 28) + 24 * r(); let cx = W * (0.06 + 0.88 * r()), cy = H * (0.1 + 0.8 * r()); const gd = makeGadget(kind, cx, cy, sz, gseed++);
    if (fromEdge) { const side = r(); if (side < 0.5) { gd.cy = -sz * 2.5; } else if (side < 0.75) { gd.cx = -sz * 2.5; } else { gd.cx = W + sz * 2.5; } gd.parts.forEach(p => { p.x = gd.cx + p.rx; p.y = gd.cy + p.ry; }); }
    gadgets.push(gd); return gd; }
  function seedGadgets() { gadgets = []; lastScroll = window.scrollY; const n = mode() === 'journey' ? 0 : (narrow() ? 8 : 14); for (let q = 0; q < n; q++) spawnGadget(false); window.__gadgets = gadgets; }
  function breakGadget(gd, hard) { if (gd.state !== 'float') return; gd.state = 'broken'; gd.brokeT = tNow; gd.parts.forEach(p => { p.vx += (Math.random() - 0.5) * (hard ? 700 : 520) + gd.vx; p.vy += -140 - Math.random() * 360 + gd.vy; }); }
  window.__breakGadget = (j) => breakGadget(gadgets[j]);
  // the population (boring mode): drifts with the scroll (wrapping), floats on soft springs, bumps apart; debris falls, knocks, chain-breaks, leaves, is replaced
  function stepGadgets(t, dt, drift, faintBase) {
    g.lineWidth = 1; g.font = `500 10px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const dS = (window.scrollY - lastScroll) * drift; lastScroll = window.scrollY; const wrapH = H + 240;
    const wrapW = W + 240;
    gadgets.forEach(gd => { if (gd.state !== 'float') return; gd.ay -= dS; gd.cy -= dS; gd.parts.forEach(p => { p.y -= dS; }); if (gd.drag) return;
      // wander: the anchor walks in a slowly turning direction, and wraps round the edges
      gd.wa += (Math.random() - 0.5) * 2.2 * dt; gd.ax += Math.cos(gd.wa) * 26 * dt; gd.ay += Math.sin(gd.wa) * 26 * dt;
      let sx = 0, sy = 0; if (gd.ay < -120) sy = wrapH; else if (gd.ay > H + 120) sy = -wrapH; if (gd.ax < -120) sx = wrapW; else if (gd.ax > W + 120) sx = -wrapW;
      if (sx || sy) { gd.ax += sx; gd.ay += sy; gd.cx += sx; gd.cy += sy; gd.parts.forEach(p => { p.x += sx; p.y += sy; }); }
      if (t > gd.nextMorph && t - gd.brokeT > 1) morphGadget(gd); });
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
      if (!broken) { let maxY = -1e9; gd.parts.forEach(p => { maxY = Math.max(maxY, gd.cy + p.ry); }); g.fillStyle = col.dim; g.globalAlpha = 0.6 * gd.linkA * faint * clamp((t - gd.morphT - 0.7) / 0.5); g.fillText(gd.kind, gd.cx, maxY + 16); }
    });
    const gone = gadgets.filter(gd => gd.state === 'gone').length; if (gone) { gadgets = gadgets.filter(gd => gd.state !== 'gone'); for (let j = 0; j < gone; j++) spawnGadget(true); window.__gadgets = gadgets; }
    g.globalAlpha = 1;
    window.__G = gadgets.map(gd => ({ kind: gd.kind, x: Math.round(gd.cx), y: Math.round(gd.cy), state: gd.state, drag: gd.drag, v: Math.round(Math.hypot(gd.vx, gd.vy)), morphs: +(t - gd.morphT).toFixed(1), parts: gd.parts.length, spread: +Math.max(...gd.parts.map(p => Math.hypot(p.x - gd.cx - p.rx, p.y - gd.cy - p.ry))).toFixed(1) }));
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
    const m = mode(); if (m !== lastMode) { lastMode = m; layoutSpacer(); lastScroll = window.scrollY; seedGadgets(); warp.on = false; if (m === 'journey') { camInit = false; sv = window.scrollY; seedFlos(); randomizeHome(); } else setNav(''); }
    if (m === 'journey') drawJourney(t, dt); else drawBoring(t, dt);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', resize); window.addEventListener('modechange', layoutSpacer); resize();
  requestAnimationFrame(frame);
})();
