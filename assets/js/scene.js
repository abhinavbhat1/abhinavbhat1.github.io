/* The drawing. The home page is a field of small architectures floating in the background: they drift, turn, light up along
   random paths, flinch from the cursor, can be dragged, and break into debris that knocks the others when tapped. The CV
   network is not among them: it does not exist until you scroll. Then the home page itself bursts: the text collapses to a
   point and four beads fly out of it in 3D, the input layer of the network, sitting exactly where the text was. Strings grow
   out of those beads to the first research neuron, which pops in, and the camera rides over to it; from there the network is
   built one neuron at a time: each neuron's strings grow out of the previous layer and the neuron pops in, the camera moves
   to it, and it explodes into its card and sucks back in before the next. Between layers the camera takes a shot picked at
   random on each visit (swivel, loop, arc, roll, dive, orbit, ride), swaying on every axis while the network contorts.
   Everything is a function of the scroll, so scrolling back runs it all in reverse: strings retract into the beads, the beads
   fly back into the point, the text re-expands. Nav and home clicks warp: the open card balls up, every neuron forms, the
   camera rides the wires to the target, pivots on it and lands; on the way home the beads fold back into the text. */
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
  const narrow = () => W < 900; const mode = () => 'journey';
  const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
  const HEAD = () => (narrow() ? 62 : 70);
  function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); layoutSpacer(); if (!flos.length) seedFlos(); }

  // ───────── the network: an input layer, one layer per section, one neuron per entry ─────────
  const SECS = window.LAYERS || [];
  const LAYERS = [{ id: 'input', name: 'Input', cards: [] }].concat(SECS);
  const counts = LAYERS.map((L, k) => k === 0 ? 4 : Math.max(1, L.cards.length)); const NLy = counts.length, Lmax = NLy - 1;
  const r0 = rng(21); const nodes = [], byL = [];
  // the input beads carry more depth than the rest: they are what bursts out of the home page, in 3D
  counts.forEach((n, k) => { const row = []; for (let i = 0; i < n; i++) { const nd = { k, i, n, x: k + (r0() - 0.5) * 0.06, y: (i - (n - 1) / 2) * 0.5 + (n > 1 ? (r0() - 0.5) * 0.05 : 0), z: (r0() - 0.5) * (k === 0 ? 0.9 : 0.3), ox: 0, oy: 0, vx: 0, vy: 0, out: k === Lmax, short: k ? LAYERS[k].cards[i].short : '', bPrev: 0, hov: 0, vis: 0, vr: 0, c: 0, doneT: -1, p: { x: 0, y: 0, s: 1, z: 0 } }; nodes.push(nd); row.push(nd); } byL.push(row); });
  const edges = []; { const r = rng(99); for (let k = 0; k < Lmax; k++) byL[k].forEach(A => byL[k + 1].forEach(B => edges.push({ A, B, k: k + 1, w: (r() - 0.5) * 2, amp: 0, t0: -9, ph: r() * 6.28 }))); }
  const adj = new Map(); nodes.forEach(nd => adj.set(nd, [])); edges.forEach(e => { adj.get(e.A).push(e); adj.get(e.B).push(e); });
  const spanK = (k) => (counts[k] - 1) * 0.5; const maxSpan = Math.max(...counts.map((_, k) => spanK(k)));
  const stag = (nd) => (nd.n > 1 ? nd.i / (nd.n - 1) : 0);

  // ───────── camera: a focus point in the world, where it sits on screen, a zoom, and a yaw about the vertical axis ─────────
  const cam = { fx: 0, fy: 0, ax: 0, ay: 0, s: 100, th: 0, ph: 0, rl: 0 }; let camInit = false; const PERSP = 3.2; let tilt = 0;
  function proj(x, y, z, out) { // yaw about the vertical axis through the focus, pitch about the horizontal one, perspective, then roll
    const dx = x - cam.fx, dy = y - cam.fy; const th = cam.th + tilt; const c = Math.cos(th), sn = Math.sin(th); const xr = dx * c + z * sn; let zr = -dx * sn + z * c;
    const cp = Math.cos(cam.ph), sp = Math.sin(cam.ph); const yr = dy * cp - zr * sp; zr = dy * sp + zr * cp;
    const k = PERSP / Math.max(0.25, PERSP + zr); const sc = cam.s * k; const X = xr * sc, Y = yr * sc, cr = Math.cos(cam.rl), sr = Math.sin(cam.rl); out.x = cam.ax + X * cr - Y * sr; out.y = cam.ay + X * sr + Y * cr; out.s = sc; out.z = zr; return out; }
  const _p = { x: 0, y: 0, s: 1, z: 0 }, _q = { x: 0, y: 0, s: 1, z: 0 };
  const toScreen = (x, y, z) => { const o = { x: 0, y: 0, s: 1, z: 0 }; return proj(x, y, z || 0, o); };
  // the home pose: the input layer's centre (the world origin) sits on the centre of the hero text, at a scale that fits the layer
  // to the text block, seen flat. The text and the beads share that point: it is the hinge of the whole transition
  const hero = { cx: 0, cy: 0, s: 100 };
  function poseHero() { return { fx: 0, fy: 0, ax: hero.cx, ay: hero.cy, s: hero.s, th: 0, ph: 0, rl: 0 }; }
  // each layer is viewed head-on, but the yaw, pitch and roll it is reached at depend on the shots taken on the way (multiples of π / 2π)
  const thL = [0], phL = [0], rlL = [0], shots = [null], shotWin = [];
  function poseLayer(k) { const m = narrow(); const s = m ? Math.min(W * 0.5, H * 0.3 / (spanK(k) + 0.4)) : Math.min(W * 0.36, H * 0.58 / (spanK(k) + 0.45)); return { fx: k, fy: 0, ax: W / 2, ay: m ? H * 0.27 : H * 0.5, s, th: thL[k], ph: phL[k], rl: rlL[k] }; }
  function poseNeuron(k, i) { const p = poseLayer(k); p.fy = 0.7 * byL[k][i].y; return p; }
  function poseClose(k, i, mul) { const p = poseLayer(k), nd = byL[k][i]; p.fx = nd.x; p.fy = nd.y; p.s *= mul; return p; }
  const lerpPose = (a, b, f) => ({ fx: mix(a.fx, b.fx, f), fy: mix(a.fy, b.fy, f), ax: mix(a.ax, b.ax, f), ay: mix(a.ay, b.ay, f), s: Math.exp(mix(Math.log(a.s), Math.log(b.s), f)), th: mix(a.th, b.th, f), ph: mix(a.ph || 0, b.ph || 0, f), rl: mix(a.rl || 0, b.rl || 0, f) });
  // the shots between layers, picked at random on every visit: swivel (half turn either way), loop (a full vertical turn), arc (a swivel
  // that lifts over the top), roll (a full turn about the view axis), dive (a plunge over the layer and back out), orbit (a full turn
  // round the vertical axis), ride (zoom into the last neuron, follow the new string, zoom out at the next one). Every layer still
  // lands upright with its first neuron on top. The first move is the ride from the burst beads to the first research neuron, so it has no shot.
  { const pick = (arr, avoid) => { let v; do { v = arr[Math.floor(Math.random() * arr.length)]; } while (v === avoid && arr.length > 1); return v; };
    const SHOTS = ['swivel', 'swivel-', 'loop', 'arc', 'ride', 'roll', 'dive', 'orbit'];
    shots[1] = 'zoom'; for (let k = 2; k < NLy; k++) shots[k] = pick(SHOTS, shots[k - 1]);
    if (NLy > 2 && !shots.includes('ride')) shots[2 + Math.floor(Math.random() * (NLy - 2))] = 'ride';
    for (let k = 1; k < NLy; k++) { const sh = shots[k]; thL[k] = thL[k - 1] + (sh === 'swivel' || sh === 'arc' ? Math.PI : sh === 'swivel-' ? -Math.PI : sh === 'orbit' ? 2 * Math.PI : 0); phL[k] = phL[k - 1] + (sh === 'loop' ? 2 * Math.PI : 0); rlL[k] = rlL[k - 1] + (sh === 'roll' ? 2 * Math.PI * (k % 2 ? 1 : -1) : 0); } }
  // keyframes along the scroll, in beats. Leaving home: the text collapses and the input beads burst out of it (to HOLD) while the
  // camera swings round to show their depth; strings grow from the beads to the first research neuron and the camera rides over
  // (to HOLD + STR + ZOOM). In a layer: each next neuron is created while the camera holds on the previous one, then the camera
  // moves to it and it bursts. Between layers: the card closes, the next layer's first neuron is created (strings from the whole
  // previous layer), then the shot, which sways on every axis.
  const kfs = [], layerStart = [], pois = [0]; let total = 0; const HOLD = 0.5, STR = 0.4, SHOT = 0.9, ZOOM = 0.9; const IN0 = 0.18, INW = 0.3;
  { kfs.push({ u: 0, f: poseHero });
    kfs.push({ u: IN0, f: poseHero });
    kfs.push({ u: HOLD, f: () => { const p = poseHero(); p.th = 0.55; p.ph = 0.22; p.s *= 0.88; return p; } });
    kfs.push({ u: HOLD + STR, f: () => { const B = byL[1][0], L = poseLayer(1); return { fx: 0.5, fy: B.y * 0.5, ax: W / 2, ay: narrow() ? H * 0.3 : H * 0.5, s: Math.min(L.s * 0.85, hero.s * 1.6), th: 0.3, ph: 0.1, rl: 0 }; } });
    let S0 = HOLD + STR, prevF = kfs[kfs.length - 1].f;
    for (let k = 1; k < NLy; k++) { const n = counts[k]; const uE = S0 + (k === 1 ? ZOOM : SHOT); layerStart[k] = uE; const sh = shots[k]; shotWin[k] = [S0, uE];
      if (sh === 'zoom') { /* the ride over from the beads is the shot */ }
      else if (sh === 'ride') { const A = byL[k - 1][counts[k - 1] - 1], B = byL[k][0]; const kk = k;
        kfs.push({ u: S0 + 0.2 * SHOT, f: () => poseClose(kk - 1, A.i, 3) });
        kfs.push({ u: S0 + 0.55 * SHOT, f: () => { const p = poseLayer(kk); p.fx = kk - 0.5; p.fy = (A.y + B.y) / 2; p.s *= 1.7; p.th = thL[kk - 1] + 0.6; p.ph = phL[kk - 1] + 0.25; p.rl = rlL[kk - 1] + 0.2; return p; } });
        kfs.push({ u: S0 + 0.82 * SHOT, f: () => poseClose(kk, 0, 3) }); }
      else { // two mid-frames so the move sways on every axis (zoom, pitch, a sideways and vertical drift) on top of the turn itself
        const SW = { 'swivel': [0.45, 0.5, 0.35, -0.25, 1], 'swivel-': [0.45, 0.5, 0.35, -0.25, -1], 'loop': [0.45, 0.5, 0, 0, 1], 'arc': [0.38, 0.45, 0.75, 0.4, 1], 'roll': [0.5, 0.55, 0.3, -0.2, -1], 'dive': [2.0, 1.4, 0.9, -0.5, 1], 'orbit': [0.42, 0.42, 0.5, -0.5, 1] }[sh];
        const mid = (f, z, dp, dx) => ((pf, kk, dive) => () => { const m = lerpPose(pf(), poseLayer(kk), f); m.s *= z; m.ph += dp; m.ax += dx * W; m.ay += (f < 0.5 ? -0.04 : 0.03) * H; if (dive) m.fy -= 0.3 * Math.sin(Math.PI * f); return m; })(prevF, k, sh === 'dive');
        kfs.push({ u: S0 + 0.33 * SHOT, f: mid(0.33, SW[0], SW[2], 0.06 * SW[4]) }); kfs.push({ u: S0 + 0.66 * SHOT, f: mid(0.66, SW[1], SW[3], -0.05 * SW[4]) }); }
      kfs.push({ u: uE, f: k === 1 ? ((kk) => () => poseNeuron(kk, 0))(k) : ((kk) => () => poseLayer(kk))(k) });
      for (let i = 0; i < n; i++) { if (i > 0) kfs.push({ u: uE + i, f: ((kk, ii) => () => poseNeuron(kk, ii))(k, i - 1) }); kfs.push({ u: uE + i + 0.5, f: ((kk, ii) => () => poseNeuron(kk, ii))(k, i) }); pois.push(uE + i + 0.5);
        byL[k][i].c0 = i > 0 ? uE + i - 0.45 : (k === 1 ? HOLD : S0 - 0.45); }
      const B = uE + n - 0.5; prevF = ((kk, ii) => () => poseNeuron(kk, ii))(k, n - 1);
      if (k < Lmax) { S0 = B + 0.75; kfs.push({ u: S0, f: prevF }); } else { total = B + 0.9; kfs.push({ u: total, f: prevF }); pois.push(total); } } }
  // the network contorts through every shot: a wobble that peaks mid-shot
  function shotWob(u) { for (let k = 2; k < NLy; k++) { const w = shotWin[k]; if (w && u >= w[0] && u <= w[1]) return 0.7 * Math.sin(Math.PI * (u - w[0]) / (w[1] - w[0])); } return 0; }
  const BEAT = () => H * 0.8;
  const spacer = document.getElementById('spacer');
  function layoutSpacer() { if (spacer) spacer.style.height = Math.round(total * BEAT() + H) + 'px'; }
  function poseAt(u) { if (u <= kfs[0].u) return kfs[0].f(); for (let j = 1; j < kfs.length; j++) { if (u <= kfs[j].u) { const a = kfs[j - 1], b = kfs[j]; const f = smooth((u - a.u) / Math.max(1e-6, b.u - a.u)); return lerpPose(a.f(), b.f(), f); } } return kfs[kfs.length - 1].f(); }
  const burstOf = (k, i, u) => { if (k === 0) return 0; const local = u - (layerStart[k] + i); if (local < 0) return 0; if (k === Lmax) return backOut(local / 0.32); if (local >= 1) return 0; return backOut(local / 0.32) * (1 - smooth((local - 0.7) / 0.3)); };
  const layerWeight = (k, u) => k === 0 ? 0 : smooth((u - (layerStart[k] - 1.0)) / 0.5) * (k === Lmax ? 1 : 1 - smooth((u - (layerStart[k] + counts[k] + 0.2)) / 0.45));
  // creation along the scroll: the input beads burst out of the collapsing text (IN0 to IN0 + INW); every other neuron is created at its
  // own moment (nd.c0, set with the keyframes): strings first, then the pop. Scrolling back reverses all of it
  function journeyC(nd, u) { return nd.k === 0 ? clamp((u - IN0) / INW) : clamp((u - nd.c0) / 0.45); }
  window.jumpToLayer = (id) => { const k = LAYERS.findIndex(L => L.id === id); if (k < 1) return; startWarp(layerStart[k] + 0.5, byL[k][0]); };
  window.jumpToNeuron = (k, i) => { if (k < 1 || k >= NLy || i >= counts[k]) return; startWarp(layerStart[k] + i + 0.5, byL[k][i]); };
  window.warpHome = () => { if (warp.on) return; if (sv / BEAT() < 0.05) { shootNeurons(3); return; } startWarp(0, null); };
  // the fidget on arriving home: a handful of the floating architectures light up together
  function lightUp() { const picks = flos.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(flos.length, 3 + Math.floor(Math.random() * 3))); picks.forEach((f, j) => { f.nextPass = tNow + j * 0.12; }); }
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
  // home it zooms into a random neuron, pulls back to the home pose, and the beads fold back into the text as it returns ─────────
  const warp = { on: false, t0: 0, dur: 1.8, from: 0, to: 0, F: null, T: null, path: [], dir: 1, pdir: 1, P0: null, PT: null, thEnd: 0, phEnd: 0, rlEnd: 0, sRide: 100, homeFrom: false, homeTo: false };
  const nearestTurn = (a, target) => a + 2 * Math.PI * Math.round((target - a) / (2 * Math.PI)); const atHome = (u) => u < 0.05;
  function focusNode(u) { let best = null, bb = 0.05; nodes.forEach(nd => { if (nd.k === 0) return; const b = burstOf(nd.k, nd.i, u); if (b > bb) { bb = b; best = nd; } }); if (best) return best; let last = null; nodes.forEach(nd => { if (nd.k > 0 && nd.c0 <= u && (!last || nd.c0 > last.c0)) last = nd; }); return last || byL[1][0]; }
  function startWarp(toU, Tnode) {
    if (mode() !== 'journey' || warp.on) return; const fromU = sv / BEAT(); if (Math.abs(fromU - toU) < 0.05) return;
    if (reduced) { window.scrollTo(0, Math.round(toU * BEAT())); sv = toU * BEAT(); Object.assign(cam, poseAt(toU)); return; }
    cancelTween(); clearTimeout(settleTimer); nodes.forEach(nd => { nd.cStart = nd.c; }); const r = Math.random;
    warp.homeFrom = atHome(fromU); warp.homeTo = atHome(toU);
    const F = warp.homeFrom ? byL[0][Math.floor(r() * counts[0])] : focusNode(fromU);
    const T = Tnode || (() => { const cand = nodes.filter(nd => nd.k > 0); return cand[Math.floor(r() * cand.length)]; })();
    // the path rides the wires: one neuron per layer in between (via a neighbouring layer when both are in the same one)
    const path = [F]; const step = Math.sign(T.k - F.k); if (step === 0) { const kv = F.k < Lmax ? F.k + 1 : F.k - 1; path.push(byL[kv][Math.floor(r() * counts[kv])]); } else for (let k = F.k + step; k !== T.k; k += step) path.push(byL[k][Math.floor(r() * counts[k])]); path.push(T);
    const P0 = Object.assign({}, cam), PT = warp.homeTo ? poseHero() : poseAt(toU), dir = r() < 0.5 ? -1 : 1;
    warp.thEnd = nearestTurn(PT.th, P0.th + Math.PI * dir); warp.phEnd = nearestTurn(PT.ph, P0.ph); warp.rlEnd = nearestTurn(PT.rl || 0, P0.rl || 0); warp.dir = dir; warp.pdir = r() < 0.5 ? -1 : 1;
    warp.sRide = Math.max(warp.homeTo ? PT.s * 3 : poseLayer(T.k).s * 1.3, 150); warp.P0 = P0; warp.PT = PT; warp.F = F; warp.T = T; warp.path = path;
    warp.on = true; warp.t0 = tNow; warp.from = fromU; warp.to = toU; warp.dur = 1.8;
  }
  function pathPoint(q) { const p = warp.path, n = p.length - 1; if (n <= 0) return { x: p[0].x, y: p[0].y }; const sq = clamp(q) * n, j = Math.min(n - 1, Math.floor(sq)), f = sq - j; return { x: mix(p[j].x, p[j + 1].x, f), y: mix(p[j].y, p[j + 1].y, f) }; }
  function warpState(t) {
    const wt = clamp((t - warp.t0) / warp.dur), from = warp.from, to = warp.to, P0 = warp.P0, hf = warp.homeFrom, ht = warp.homeTo, m = narrow();
    const PT = ht ? poseHero() : warp.PT; const ride = smooth((wt - 0.1) / 0.68); const ayC = m ? H * 0.4 : H * 0.5; let pose;
    if (wt < 0.1) pose = P0;
    else if (wt < 0.78) { const q = pathPoint(ride), sIn = smooth((wt - 0.1) / 0.2); pose = { fx: q.x, fy: q.y, ax: mix(P0.ax, W / 2, sIn), ay: mix(P0.ay, ayC, sIn), s: Math.exp(mix(Math.log(P0.s), Math.log(warp.sRide), sIn)), th: mix(P0.th, warp.thEnd, ride) + 0.45 * Math.sin(Math.PI * ride) * warp.dir, ph: mix(P0.ph, warp.phEnd, ride) + 0.55 * Math.sin(Math.PI * ride) * warp.pdir, rl: mix(P0.rl || 0, warp.rlEnd, ride) + 0.35 * Math.sin(Math.PI * ride) * warp.dir }; }
    else { const T = warp.T, A = { fx: T.x, fy: T.y, ax: W / 2, ay: ayC, s: warp.sRide, th: warp.thEnd, ph: warp.phEnd, rl: warp.rlEnd }, E = Object.assign({}, PT, { th: warp.thEnd, ph: warp.phEnd, rl: warp.rlEnd });
      if (ht) { const C = { fx: T.x, fy: T.y, ax: PT.ax, ay: PT.ay, s: PT.s * 2.2, th: warp.thEnd, ph: warp.phEnd, rl: warp.rlEnd }; pose = wt < 0.88 ? lerpPose(A, C, smooth((wt - 0.78) / 0.1)) : lerpPose(C, E, smooth((wt - 0.88) / 0.12)); }
      else pose = lerpPose(A, E, smooth((wt - 0.78) / 0.22)); }
    const zk = (u) => smooth((u - 0.5) / 0.7);
    return { wt, pose, done: wt >= 1, hf, ht, wob: Math.sin(Math.PI * clamp((wt - 0.08) / 0.8)),
      mk: hf ? smooth(wt / 0.15) : ht ? 1 - smooth((wt - 0.86) / 0.14) : 1,
      flo: hf ? 1 - smooth(wt / 0.25) : ht ? smooth((wt - 0.84) / 0.16) : 0,
      heroK: hf ? 1 - smooth(wt / 0.15) : ht ? smooth((wt - 0.86) / 0.14) : 0,
      zoomK: mix(zk(from), zk(to), smooth((wt - 0.1) / 0.3)),
      lw: (kk) => mix(layerWeight(kk, from), layerWeight(kk, to), smooth((wt - 0.3) / 0.4)),
      // leaving home the beads burst out first (the input column forms before the rest); coming home they fold back last
      c: (nd) => { const form = clamp((wt - 0.04 - nd.x * 0.03) / 0.16), cB = Math.max(nd.cStart, form); const un = clamp((wt - 0.74 - (Lmax - nd.x) * 0.02) / 0.16); return mix(cB, Math.min(cB, journeyC(nd, to)), un); },
      burst: (kk, i) => burstOf(kk, i, from) * (1 - smooth(wt / 0.12)) + burstOf(kk, i, to) * smooth((wt - 0.86) / 0.14) };
  }
  function endWarp() { const to = warp.to; warp.on = false; window.scrollTo(0, Math.round(to * BEAT())); sv = to * BEAT(); lastY = window.scrollY; Object.assign(cam, poseAt(to)); if (to === 0) lightUp(); }
  window.__warp = () => warp.on ? { wt: +((tNow - warp.t0) / warp.dur).toFixed(2), from: +warp.from.toFixed(2), to: +warp.to.toFixed(2), path: warp.path.map(nd => [nd.k, nd.i]) } : null;
  const pop = (t) => { t = clamp(t); const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  // ───────── pointer: beads on strings, and the floating field (hover to push, press to light, drag to move, tap to break) ─────────
  const ptr = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, vx: 0, vy: 0, nx: 0, down: false, t: 0 }; let dragNode = null, dragFlo = null, downAt = { x: 0, y: 0, t: 0 };
  const interactive = (t) => !!(t && t.closest && t.closest('a, button, details, summary, input, label, select, .jcard, .top, .focus, .tldr'));
  window.addEventListener('pointermove', (e) => { ptr.px = ptr.x; ptr.py = ptr.y; ptr.x = e.clientX; ptr.y = e.clientY; ptr.nx = (e.clientX / W) * 2 - 1; const now = performance.now(); const dt = Math.max(8, now - ptr.t) / 1000; ptr.vx = (ptr.x - ptr.px) / dt; ptr.vy = (ptr.y - ptr.py) / dt; ptr.t = now;
    if (dragNode) { const sc = dragNode.p.s || cam.s; dragNode.ox += (ptr.x - ptr.px) / sc; dragNode.oy += (ptr.y - ptr.py) / sc; dragNode.vx = dragNode.vy = 0; pluck(dragNode, clamp(Math.hypot(ptr.vx, ptr.vy) / sc * 0.05, 0, 0.14)); }
    if (dragFlo) { dragFlo.cx = ptr.x - dragFlo.gx; dragFlo.cy = ptr.y - dragFlo.gy; } }, { passive: true });
  window.addEventListener('pointerdown', (e) => { if (e.button !== 0 || interactive(e.target)) return; ptr.x = e.clientX; ptr.y = e.clientY; ptr.down = true; downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    let best = null, bd = 26; nodes.forEach(nd => { if (nd.vis < 0.5) return; const d = Math.hypot(nd.p.x - e.clientX, nd.p.y - e.clientY); if (d < bd) { bd = d; best = nd; } });
    if (best) { dragNode = best; pluck(best, 0.08); e.preventDefault(); return; }
    if (floAlpha > 0.3) { let fb = null, fd = 1e9; flos.forEach(f => { if (f.state !== 'float') return; const d = Math.hypot(f.cx - e.clientX, f.cy - e.clientY); if (d < f.sz * 2.2 && d < fd) { fd = d; fb = f; } });
      if (fb) { floPass(fb); dragFlo = fb; fb.drag = true; fb.gx = e.clientX - fb.cx; fb.gy = e.clientY - fb.cy; fb.nodes.forEach(nd => { nd.vx += (Math.random() - 0.5) * 140; nd.vy += (Math.random() - 0.5) * 140; }); e.preventDefault(); } } });
  window.addEventListener('pointerup', (e) => { ptr.down = false; const moved = Math.hypot(ptr.x - downAt.x, ptr.y - downAt.y), held = performance.now() - downAt.t;
    if (dragNode) { const sc = dragNode.p.s || cam.s; if (moved < 5 && held < 350) { dragNode.vy -= 0.6; } else { dragNode.vx = ptr.vx / sc * 0.6; dragNode.vy = ptr.vy / sc * 0.6; pluck(dragNode, clamp(0.04 + Math.hypot(ptr.vx, ptr.vy) / sc * 0.08, 0.04, 0.22)); } dragNode = null; }
    else if (dragFlo) { dragFlo.drag = false; if (moved < 6 && held < 400) breakFlo(dragFlo, e.clientX, e.clientY); dragFlo = null; } });
  window.addEventListener('pointerleave', () => { ptr.x = ptr.y = -1e4; ptr.vx = ptr.vy = 0; });
  document.addEventListener('mouseleave', () => { ptr.x = ptr.y = -1e4; ptr.vx = ptr.vy = 0; });
  window.addEventListener('pointercancel', () => { ptr.down = false; dragNode = null; if (dragFlo) dragFlo.drag = false; dragFlo = null; });
  function pluck(nd, amp) { adj.get(nd).forEach(e => { if (e.amp * Math.exp(-2.2 * (tNow - e.t0)) < amp) { e.amp = amp; e.t0 = tNow; } }); }
  let tNow = 0;

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
  const heroCopy = document.getElementById('hero-copy'), heroL = document.querySelector('.hero-l'), heroR = document.querySelector('.hero-r');
  let sv = 0, avoid = [];
  function drawJourney(t, dt) {
    ptr.vx *= Math.exp(-dt * 9); ptr.vy *= Math.exp(-dt * 9);
    const target = window.scrollY; sv += (target - sv) * (reduced ? 1 : 1 - Math.exp(-dt * 14)); if (Math.abs(target - sv) < 0.3) sv = target;
    // the hinge: the centre of the hero text is the world origin at home, at a scale that fits the input layer to the text block
    if (heroCopy) { const rc = heroCopy.getBoundingClientRect(); hero.cx = rc.left + rc.width / 2; hero.cy = rc.top + rc.height / 2; hero.s = clamp(heroCopy.offsetHeight * 0.75 / 1.5, 70, narrow() ? W * 0.4 : W * 0.13); }
    const u = sv / BEAT(); const Wp = warp.on ? warpState(t) : null; const p = Wp ? Wp.pose : poseAt(u);
    if (!camInit || Wp) { Object.assign(cam, p); camInit = true; } else { const k = 1 - Math.exp(-dt * 10); cam.fx += (p.fx - cam.fx) * k; cam.fy += (p.fy - cam.fy) * k; cam.ax += (p.ax - cam.ax) * k; cam.ay += (p.ay - cam.ay) * k; cam.s = Math.exp(Math.log(cam.s) + (Math.log(p.s) - Math.log(cam.s)) * k); cam.th += (p.th - cam.th) * k; cam.ph += (p.ph - cam.ph) * k; cam.rl += ((p.rl || 0) - cam.rl) * k; }
    const heroK = Wp ? Wp.heroK : 1 - smooth((u - 0.1) / 0.7), zoomK = Wp ? Wp.zoomK : smooth((u - 0.7) / 0.8);
    // the text collapses to its centre (mk) as the beads burst out of it; the floating field fades as the camera rides away (floA)
    const mk = Wp ? Wp.mk : smooth((u - 0.05) / 0.3), floA = Wp ? Wp.flo : 1 - smooth((u - 0.15) / 0.35); floAlpha = floA;
    tilt += (((narrow() || ptr.x < 0) ? 0 : 0.07 * ptr.nx * zoomK) - tilt) * (1 - Math.exp(-dt * 3));
    if (heroCopy) { const sc = 1 - 0.97 * mk * mk; heroCopy.style.opacity = (1 - smooth((mk - 0.45) / 0.5)).toFixed(3); heroCopy.style.transform = `scale(${sc.toFixed(4)})`; heroCopy.style.visibility = mk > 0.985 ? 'hidden' : ''; }
    avoid = (heroK > 0.5 && mk < 0.1 && heroL && heroR) ? [heroL.getBoundingClientRect(), heroR.getBoundingClientRect()] : [];
    const lw = counts.map((_, k) => Wp ? Wp.lw(k) : layerWeight(k, u)); let activeK = -1, aw = 0.25; lw.forEach((w, k) => { if (w > aw) { aw = w; activeK = k; } });
    const bOf = (k, i) => Wp ? Wp.burst(k, i) : burstOf(k, i, u);
    // physics: beads spring home, the pointer pushes what it passes, strings ring down. The input beads sit at the origin until they
    // burst, then fly out to their places in 3D, one after another
    nodes.forEach(nd => { if (nd === dragNode) return; const dx = nd.p.x - ptr.x, dy = nd.p.y - ptr.y, d = Math.hypot(dx, dy); let fx = -30 * nd.ox - 4.5 * nd.vx, fy = -30 * nd.oy - 4.5 * nd.vy;
      if (d < 70 && d > 0.1 && !ptr.down && nd.vis > 0.5) { const f = (1 - d / 70) * 130 / Math.max(40, nd.p.s); fx += dx / d * f; fy += dy / d * f; if (Math.random() < 0.08) pluck(nd, 0.03); }
      nd.vx += fx * dt; nd.vy += fy * dt; nd.ox += nd.vx * dt; nd.oy += nd.vy * dt;
      const hv = d < 90 && nd.vis > 0.5 ? 1 - d / 90 : 0; nd.hov += (hv - nd.hov) * (1 - Math.exp(-dt * 8));
      nd.c = Wp ? Wp.c(nd) : journeyC(nd, u); nd.vr = clamp((nd.c - 0.25) / 0.75); nd.vis = pop(nd.vr); if (nd.c >= 0.99) { if (nd.doneT < 0) nd.doneT = t; } else nd.doneT = -1;
      const bk = nd.k === 0 ? smooth(clamp((nd.c - stag(nd) * 0.2) / 0.8)) : 1; const wob = Wp ? Wp.wob : shotWob(u);
      proj(nd.x * bk + nd.ox + wob * 0.16 * Math.sin(nd.y * 4 + t * 7 + nd.k), nd.y * bk + nd.oy + wob * 0.12 * Math.cos(nd.x * 3 + t * 6), nd.z * bk + wob * 0.35 * Math.sin(nd.x * 2 + nd.y * 3 + t * 5), nd.p); });
    g.clearRect(0, 0, W, H); if (floA > 0.01) stepFlos(t, dt, floA); g.lineWidth = 1;
    // strings
    edges.forEach(e => { const ev = Math.min(clamp(e.B.c / 0.85), clamp(e.A.c * 2)); if (ev <= 0.001) return; const A = e.A.p, B = e.B.p; const inFocus = Math.max(lw[e.k - 1] || 0, lw[e.k] || 0); const depth = clamp(1 - (A.z + B.z) * 0.22, 0.3, 1.2);
      if (ev < 0.999) { // being drawn: a line growing out of the previous neuron, with a bright tip
        const ex = mix(A.x, B.x, ev), ey = mix(A.y, B.y, ev); g.strokeStyle = col.ink; g.globalAlpha = (0.1 + 0.1 * Math.abs(e.w)) * depth; g.lineWidth = 1; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(ex, ey); g.stroke();
        g.fillStyle = col.accent; g.globalAlpha = 0.7 * depth * Math.sin(Math.PI * ev); g.beginPath(); g.arc(ex, ey, 1.8, 0, 6.2832); g.fill(); return; }
      g.strokeStyle = col.ink; g.globalAlpha = (0.06 + 0.08 * Math.abs(e.w) + 0.14 * inFocus * zoomK + 0.12 * Math.max(e.A.hov, e.B.hov)) * depth; g.lineWidth = 1; g.beginPath();
      const age = t - e.t0, ampS = Math.min(42, e.amp * cam.s) * Math.exp(-2.2 * age);
      if (ampS > 0.35) { const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; for (let j = 0; j <= 16; j++) { const s = j / 16; const off = ampS * (Math.sin(Math.PI * s) * Math.cos(2 * Math.PI * 2.1 * age + e.ph) + 0.45 * Math.sin(2 * Math.PI * s) * Math.cos(2 * Math.PI * 3.3 * age) * Math.exp(-0.8 * age)); const x = A.x + dx * s + nx * off, y = A.y + dy * s + ny * off; if (j === 0) g.moveTo(x, y); else g.lineTo(x, y); } }
      else { g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); }
      g.stroke();
      if (zoomK > 0.05 && lw[e.k] > 0.05) { g.fillStyle = col.accent; for (let j = 0; j < 2; j++) { const s = (t * 0.22 + j * 0.5 + e.ph * 0.1) % 1; g.globalAlpha = 0.45 * lw[e.k] * zoomK * Math.sin(Math.PI * s); g.beginPath(); g.arc(mix(A.x, B.x, s), mix(A.y, B.y, s), 1.6, 0, 6.2832); g.fill(); } } });
    g.lineWidth = 1;
    // a faint dashed trace to where the next neuron will appear, a hint that there is more to scroll: the moment a neuron is created it
    // draws itself out over half a second and ends in a ghost ring; it fades once the next neuron is created
    if (zoomK > 0.02 && !Wp) { g.setLineDash([3, 6]); g.strokeStyle = col.ink;
      for (let k = 1; k < NLy; k++) { const w = lw[k] * zoomK; if (w < 0.02) continue; byL[k].forEach((nd, i) => { const nx = i + 1 < counts[k] ? byL[k][i + 1] : (k < Lmax ? byL[k + 1][0] : null); if (!nx || nd.doneT < 0) return; const tp = reduced ? 1 : clamp((t - nd.doneT) / 0.5), te = 1 - Math.pow(1 - tp, 3); const a = 0.3 * w * (1 - smooth(nx.c * 2)); if (a < 0.01) return;
        const A = nd.p, B = nx.p; g.globalAlpha = a; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(mix(A.x, B.x, te), mix(A.y, B.y, te)); g.stroke(); const ra = clamp((tp - 0.7) / 0.3); if (ra > 0.01) { g.globalAlpha = a * ra; g.beginPath(); g.arc(B.x, B.y, clamp(0.045 * B.s, 3, 24) * (0.5 + 0.4 * ra), 0, 6.2832); g.stroke(); } }); }
      g.setLineDash([]); }
    // the burst itself: rays from the hinge point to each input bead while they fly out, and a ripple spreading from it
    { const c0 = byL[0].reduce((a, nd) => a + nd.c, 0) / counts[0]; if (c0 > 0.001 && c0 < 0.999) { proj(0, 0, 0, _q); const hx = _q.x, hy = _q.y;
      g.strokeStyle = col.accent; g.lineWidth = 1; byL[0].forEach(nd => { if (nd.c <= 0.001) return; g.globalAlpha = 0.45 * Math.sin(Math.PI * clamp(nd.c)); g.beginPath(); g.moveTo(hx, hy); g.lineTo(nd.p.x, nd.p.y); g.stroke(); });
      const rr = smooth(c0) * hero.s * 1.15; g.globalAlpha = 0.5 * (1 - smooth(c0)); g.lineWidth = 1.5; g.beginPath(); g.arc(hx, hy, rr, 0, 6.2832); g.stroke(); g.fillStyle = col.accent; g.globalAlpha = 0.07 * (1 - c0); g.fill(); g.lineWidth = 1; } }
    // beads (far first), bursts, names
    const Rb = Math.min(W, H) * 0.14; const bursts = []; g.textBaseline = 'middle';
    const order = nodes.slice().sort((a, b) => b.p.z - a.p.z);
    order.forEach(nd => { if (nd.vis < 0.01) return; const s = nd.p; const r0 = clamp(0.045 * s.s * (nd.out ? 1.5 : nd.k === 0 ? 1.4 : 1), 3, 24), r = r0 * nd.vis; const b = bOf(nd.k, nd.i); const focus = lw[nd.k]; const bb = clamp(b);
      if (bb > 0.05 && nd.bPrev <= 0.05) pluck(nd, 0.07); nd.bPrev = bb;
      if (bb > 0.002) { bursts.push({ nd, b: bb, s, R: r + b * Rb }); g.fillStyle = col.accent; g.globalAlpha = 0.07 * bb; g.beginPath(); g.arc(s.x, s.y, r + b * Rb, 0, 6.2832); g.fill(); g.strokeStyle = col.accent; g.globalAlpha = 0.55 * bb; g.beginPath(); g.arc(s.x, s.y, r + b * Rb, 0, 6.2832); g.stroke(); }
      const depth = clamp(1 - s.z * 0.3, 0.45, 1.2);
      if (nd.vr > 0.01 && nd.vr < 0.99) { g.strokeStyle = col.accent; g.globalAlpha = 0.5 * (1 - nd.vr) * depth; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, r0 * (0.5 + 1.5 * nd.vr), 0, 6.2832); g.stroke(); }
      sphere(s.x, s.y, r, focus * zoomK, Math.max(bb, nd.k === 0 ? 0.35 * (1 - nd.vr) : 0), (0.4 + 0.5 * focus * zoomK + 0.4 * bb) * depth);
      if (nd.hov > 0.05) { g.strokeStyle = col.accent; g.globalAlpha = nd.hov * 0.5; g.beginPath(); g.arc(s.x, s.y, r + 5 * nd.hov, 0, 6.2832); g.stroke(); }
      const la = focus * zoomK * (1 - bb) * nd.vr * (cam.s > 160 ? 1 : 0); if (la > 0.03 && nd.short) { g.fillStyle = col.ink; g.globalAlpha = 0.65 * la; g.font = `500 12px ${SANS}`; g.textAlign = narrow() ? 'center' : 'left'; g.fillText(nd.short, narrow() ? s.x : s.x + r + 9, narrow() ? s.y + r + 11 : s.y); } });
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
    window.__J = { u: +u.toFixed(2), activeK, zoomK: +zoomK.toFixed(2), heroK: +heroK.toFixed(2), bursts: bursts.map(x => [x.nd.k, x.nd.i, +x.b.toFixed(2)]), cam: { fx: +cam.fx.toFixed(2), fy: +cam.fy.toFixed(2), ax: Math.round(cam.ax), ay: Math.round(cam.ay), s: Math.round(cam.s), th: +cam.th.toFixed(2), ph: +cam.ph.toFixed(2) }, dragging: !!dragNode, maxAmp: +Math.max(0, ...edges.map(e => e.amp * Math.exp(-2.2 * (t - e.t0)))).toFixed(3), maxOff: +Math.max(...nodes.map(n => Math.hypot(n.ox, n.oy))).toFixed(3), total: +total.toFixed(2), beat: Math.round(BEAT()), pois, ls: layerStart, nav: navOn, built: counts.map((_, k) => byL[k].filter(nd => nd.vr > 0.99).length), partial: nodes.filter(nd => nd.c > 0.01 && nd.c < 0.99).map(nd => [nd.k, nd.i, +nd.c.toFixed(2)]), input: byL[0].map(nd => ({ c: +nd.c.toFixed(2), x: Math.round(nd.p.x), y: Math.round(nd.p.y), vis: +nd.vis.toFixed(2) })), traces: nodes.filter(nd => nd.doneT >= 0 && nd.k > 0).map(nd => [nd.k, nd.i, +Math.min(9, t - nd.doneT).toFixed(2)]), shots, mk: +mk.toFixed(2), floA: +floA.toFixed(2), flos: flos.length, lit: flos.filter(f => f.pass).length, broken: flos.filter(f => f.state !== 'float').length, rl: +cam.rl.toFixed(2), hero: { x: Math.round(hero.cx), y: Math.round(hero.cy), s: Math.round(hero.s) }, warp: window.__warp(), zspread: +(Math.max(...nodes.map(n => n.p.z)) - Math.min(...nodes.map(n => n.p.z))).toFixed(2) };
    window.__nodeScreen = (k, i) => ({ x: byL[k][i].p.x, y: byL[k][i].p.y });
  }

  // ───────── the home field: small MLPs floating behind the home page. They drift, turn in fake 3D and light up along a random
  // path now and then. The cursor is a field: beads near it are pushed aside and glow, a whole architecture eases away from
  // it, and a fast swipe knocks it. They can be dragged, and a tap breaks one: its beads fly out from the tap and fall, and
  // the ones they hit are knocked, spun and jostled, but hold together; the debris bounces off and falls out of the screen,
  // and the field is topped up from an edge ─────────
  let flos = [], floAlpha = 1, nursery = null; const volleys = []; const CAP = () => (narrow() ? 12 : 24);
  function layoutFlo(f) { const c = Math.cos(f.yaw), sn = Math.sin(f.yaw); let R = 0; f.nodes.forEach(nd => { const zr = nd.lx * sn; const k = 2.6 / (2.6 + Math.max(-1.2, zr)); nd.rx = f.cx + nd.lx * c * f.sz * k; nd.ry = f.cy + nd.ly * f.sz * k; nd.d = k; R = Math.max(R, Math.hypot(nd.rx - f.cx, nd.ry - f.cy)); }); f.rad = R + 8; }
  function makeFlo(fromEdge, at) { const r = Math.random, m = narrow(); const nl = 2 + Math.floor(r() * 4); const layers = Array.from({ length: nl }, () => 2 + Math.floor(r() * 5)); const nodes = [], byLayer = [];
    layers.forEach((n, k) => { const row = []; for (let i = 0; i < n; i++) { const nd = { k, i, lx: k - (nl - 1) / 2, ly: (i - (n - 1) / 2) * 0.72, x: 0, y: 0, vx: 0, vy: 0, rx: 0, ry: 0, d: 1, lit: 0, hv: 0 }; nodes.push(nd); row.push(nd); } byLayer.push(row); });
    const edges = []; for (let k = 0; k < nl - 1; k++) byLayer[k].forEach(A => byLayer[k + 1].forEach(B => edges.push({ A, B })));
    const sz = (m ? 14 : 17) + (m ? 13 : 22) * r(); const yawV = (r() < 0.5 ? -1 : 1) * (0.1 + 0.16 * r());
    const f = { layers, nodes, byLayer, edges, cx: at ? at.x : W * (0.04 + 0.92 * r()), cy: at ? at.y : H * (0.06 + 0.88 * r()), vx0: (r() - 0.5) * 14, vy0: (r() - 0.5) * 10, vx: 0, vy: 0, sz, rad: sz * 2, mass: 0.5 + nodes.length / 12, yaw: r() * 6.28, yawV, yawV0: yawV, pass: null, nextPass: tNow + 0.5 + r() * 6, born: tNow, state: 'float', drag: false, gx: 0, gy: 0, brokeT: 0, linkA: 1 };
    f.vx = f.vx0; f.vy = f.vy0; if (fromEdge) { const side = r(); if (side < 0.5) f.cy = -sz * 2.5; else if (side < 0.75) f.cx = -sz * 2.5; else f.cx = W + sz * 2.5; }
    layoutFlo(f); f.nodes.forEach(nd => { nd.x = nd.rx; nd.y = nd.ry; }); return f; }
  function seedFlos() { flos = []; nursery = null; volleys.length = 0; const m = narrow(), n = m ? 10 : 22, cols = m ? 3 : 6, rows = 4; const cells = []; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) cells.push([i, j]); cells.sort(() => Math.random() - 0.5);
    for (let q = 0; q < n; q++) { const [i, j] = cells[q % cells.length]; const cw = W / cols, ch = (H - HEAD()) / rows; flos.push(makeFlo(false, { x: (i + 0.15 + 0.7 * Math.random()) * cw, y: HEAD() + (j + 0.15 + 0.7 * Math.random()) * ch })); } }
  // the nursery: pressing the mark at home shoots neurons out of it. Each lands at its place in a planned architecture that stands
  // alone, half-built, its strings drawn only between the neurons that have arrived; later presses complete it, and then it joins
  // the field and lights up. The oldest floating one breaks when the field is full.
  function planNursery() { const f = makeFlo(false); f.state = 'grow'; f.vx0 *= 0.5; f.vy0 *= 0.5; f.yawV *= 0.6; f.yawV0 = f.yawV; f.nextPass = 1e9; f.nodes.forEach(nd => { nd.here = 0; nd.hereT = -1; nd.shot = false; }); flos.push(f); nursery = f; return f; }
  function markCentre() { const m = document.querySelector('.brand .mark'); const r = m ? m.getBoundingClientRect() : null; return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 40, y: HEAD() / 2 }; }
  function shootNeurons(n) { if (!nursery || nursery.state !== 'grow' || nursery.nodes.every(nd => nd.shot)) planNursery(); const c0 = markCentre(); let j = 0;
    for (const nd of nursery.nodes) { if (nd.hereT >= 0 || nd.shot) continue; if (j >= n) break; nd.shot = true; volleys.push({ f: nursery, nd, t0: tNow + j * 0.1, dur: 0.6 + Math.random() * 0.2, x0: c0.x, y0: c0.y, bend: (Math.random() - 0.5) * 300, trail: [] }); j++; } }
  window.shootNeurons = shootNeurons; window.__shoot = shootNeurons; window.__nursery = () => nursery ? { state: nursery.state, here: nursery.nodes.filter(nd => nd.hereT >= 0).length, total: nursery.nodes.length, shots: volleys.length } : null;
  function floPass(f) { if (f.state !== 'float') return; f.pass = { t0: tNow, path: f.byLayer.map(row => row[Math.floor(Math.random() * row.length)]) }; }
  // a break: every bead flies out from the point of the tap (the nearer, the harder), with a little lift, and falls
  function breakFlo(f, px, py) { if (f.state !== 'float') return; f.state = 'broken'; f.brokeT = tNow; f.drag = false; const ox = px == null ? f.cx : px, oy = py == null ? f.cy : py;
    f.nodes.forEach(nd => { const dx = nd.x - ox, dy = nd.y - oy, d = Math.hypot(dx, dy) || 1; const v = 160 + 420 * clamp(1 - d / (f.rad * 1.5)); nd.vx += dx / d * v + f.vx + (Math.random() - 0.5) * 90; nd.vy += dy / d * v - 110 - Math.random() * 120 + f.vy; }); }
  // a hit on a floating architecture: the piece bounces off its edge, the whole thing is knocked back and spun a little, and the
  // beads near the impact are jostled; nothing breaks
  function knock(o, x, y, vx, vy, nx, ny, vn) { const e = 0.45, j = -(1 + e) * vn; const m = o.mass; o.vx -= j * nx * 0.22 / m; o.vy -= j * ny * 0.22 / m; o.yawV += (nx * vy - ny * vx) / 900 * clamp(-vn / 500) * (Math.random() < 0.5 ? -1 : 1);
    o.nodes.forEach(q => { const qd = Math.hypot(q.x - x, q.y - y); const w = Math.max(0, 1 - qd / (o.sz * 1.6)); if (w > 0) { q.vx += vx * 0.5 * w; q.vy += vy * 0.5 * w; } }); return j; }
  window.__flos = () => flos.map(f => ({ x: Math.round(f.cx), y: Math.round(f.cy), layers: f.layers, lit: !!f.pass, state: f.state, here: f.nodes.filter(nd => nd.hereT >= 0).length, spread: +Math.max(...f.nodes.map(nd => Math.hypot(nd.x - nd.rx, nd.y - nd.ry))).toFixed(1), v: +Math.hypot(f.vx, f.vy).toFixed(0) }));
  window.__breakFlo = (j, x, y) => breakFlo(flos[j], x, y); window.__floPass = (j) => floPass(flos[j]);
  function stepFlos(t, dt, alpha) {
    const wrapW = W + 200, wrapH = H + 200, RH = narrow() ? 64 : 96, live = (f) => f.state === 'float' || f.state === 'grow';
    flos.forEach(f => { if (!live(f)) return;
      if (!f.drag) { f.vx += (f.vx0 - f.vx) * 0.8 * dt; f.vy += (f.vy0 - f.vy) * 0.8 * dt;
        // the cursor field: the whole architecture eases away from the pointer, and a fast pointer passing through knocks it
        const dx = f.cx - ptr.x, dy = f.cy - ptr.y, d = Math.hypot(dx, dy), R = f.rad + RH * 0.6; if (d < R && d > 0.1 && ptr.x > -1000) { const w = 1 - d / R; f.vx += dx / d * w * 55 * dt; f.vy += dy / d * w * 55 * dt; const sp = Math.hypot(ptr.vx, ptr.vy); if (sp > 900) { f.vx += ptr.vx * 0.012 * w / f.mass; f.vy += ptr.vy * 0.012 * w / f.mass; } }
        // the text columns are kept clear: an architecture that drifts behind one eases out the nearest way
        avoid.forEach(rc => { const pad = f.rad * 0.5; if (f.cx > rc.left - pad && f.cx < rc.right + pad && f.cy > rc.top - pad && f.cy < rc.bottom + pad) { const dl = f.cx - (rc.left - pad), dr = (rc.right + pad) - f.cx, dtp = f.cy - (rc.top - pad), db = (rc.bottom + pad) - f.cy; const mn = Math.min(dl, dr, dtp, db); if (mn === dl) f.vx -= 120 * dt; else if (mn === dr) f.vx += 120 * dt; else if (mn === dtp) f.vy -= 120 * dt; else f.vy += 120 * dt; } });
        const sp = Math.hypot(f.vx, f.vy); if (sp > 260) { f.vx *= 260 / sp; f.vy *= 260 / sp; }
        f.cx += f.vx * dt; f.cy += f.vy * dt; let sx = 0, sy = 0; if (f.cx < -100) sx = wrapW; else if (f.cx > W + 100) sx = -wrapW; if (f.cy < -100) sy = wrapH; else if (f.cy > H + 100) sy = -wrapH; if (sx || sy) { f.cx += sx; f.cy += sy; f.nodes.forEach(nd => { nd.x += sx; nd.y += sy; }); } }
      f.yawV += (f.yawV0 - f.yawV) * 1.1 * dt; f.yaw += f.yawV * dt; layoutFlo(f); });
    // gentle bumps between floating neighbours, the lighter one giving way
    for (let a = 0; a < flos.length; a++) for (let b = a + 1; b < flos.length; b++) { const A = flos[a], B = flos[b]; if (!live(A) || !live(B)) continue; const dx = B.cx - A.cx, dy = B.cy - A.cy, d = Math.hypot(dx, dy) || 1, min = (A.rad + B.rad) * 0.9; if (d < min) { const push = (min - d) * 1.8 * dt, nx = dx / d, ny = dy / d, tm = A.mass + B.mass; if (!A.drag) { A.cx -= nx * push * B.mass / tm; A.cy -= ny * push * B.mass / tm; } if (!B.drag) { B.cx += nx * push * A.mass / tm; B.cy += ny * push * A.mass / tm; } } }
    flos.forEach(f => {
      if (!f.pass && t > f.nextPass) floPass(f); const pt = f.pass ? (t - f.pass.t0) / 0.32 : -1; const fade = f.pass ? 1 - smooth((t - f.pass.t0 - 0.32 * f.layers.length - 0.9) / 0.8) : 0; if (f.pass && fade <= 0) { f.pass = null; f.nextPass = t + 2.5 + Math.random() * 6; }
      const grow = f.state === 'grow', broken = f.state === 'broken'; f.linkA += ((broken ? 0 : 1) - f.linkA) * (1 - Math.exp(-dt * (broken ? 14 : 2.2)));
      let below = 0, near = 0;
      f.nodes.forEach(nd => {
        if (broken) { nd.vy += 820 * dt; nd.vx *= Math.exp(-dt * 0.35); nd.x += nd.vx * dt; nd.y += nd.vy * dt; if (nd.x < 4 || nd.x > W - 4) { nd.vx *= -0.55; nd.x = clamp(nd.x, 4, W - 4); } if (nd.y > H + 60) below++;
          // debris meets a floating architecture: it bounces off the edge and the architecture takes the hit
          if (Math.hypot(nd.vx, nd.vy) > 40) flos.forEach(o => { if (o === f || !live(o)) return; const dx = nd.x - o.cx, dy = nd.y - o.cy, d = Math.hypot(dx, dy), R = o.rad; if (d < R && d > 0.1) { const nx = dx / d, ny = dy / d, vn = nd.vx * nx + nd.vy * ny; if (vn < 0) { const vx0 = nd.vx, vy0 = nd.vy; const j = knock(o, nd.x, nd.y, vx0, vy0, nx, ny, vn); nd.vx += j * nx; nd.vy += j * ny; nd.x = o.cx + nx * R; nd.y = o.cy + ny * R; } } }); }
        else { if (grow) { nd.here = nd.hereT < 0 ? 0 : clamp((t - nd.hereT) / 0.4); if (nd.hereT < 0) { nd.x = nd.rx; nd.y = nd.ry; return; } }
          const k = f.drag ? 90 : 55; nd.vx += ((nd.rx - nd.x) * k - 7.5 * nd.vx) * dt; nd.vy += ((nd.ry - nd.y) * k - 7.5 * nd.vy) * dt;
          // the cursor field: beads near the pointer are pushed aside and glow
          const dx = nd.x - ptr.x, dy = nd.y - ptr.y, d = Math.hypot(dx, dy); let hv = 0; if (d < RH && d > 0.1 && ptr.x > -1000) { const w = 1 - d / RH; hv = w; near++; nd.vx += (dx / d * w * 1500 + ptr.vx * 0.05 * w) * dt; nd.vy += (dy / d * w * 1500 + ptr.vy * 0.05 * w) * dt; }
          nd.hv += (hv - nd.hv) * (1 - Math.exp(-dt * 9)); nd.x += nd.vx * dt; nd.y += nd.vy * dt; }
        const on = f.pass && f.pass.path[nd.k] === nd; nd.lit = on ? smooth(pt - nd.k) * fade : 0; });
      if (broken && (below === f.nodes.length || t - f.brokeT > 6)) f.state = 'gone';
      // whatever still overlaps a text column is dimmed so the text stays readable
      let inText = 0; if (avoid.length) f.nodes.forEach(nd => { if (avoid.some(rc => nd.x > rc.left && nd.x < rc.right && nd.y > rc.top && nd.y < rc.bottom)) inText++; });
      const a0 = alpha * (narrow() ? 0.5 : 0.85) * clamp((t - f.born) / 0.9) * (1 - 0.65 * inText / f.nodes.length), hover = near > 0;
      g.strokeStyle = col.ink; g.lineWidth = 1;
      if (grow) { f.edges.forEach(e => { if (e.A.hereT < 0 || e.B.hereT < 0) return; const [Pn, Qn] = e.A.hereT <= e.B.hereT ? [e.A, e.B] : [e.B, e.A]; const q = Math.min(e.A.here, e.B.here); g.globalAlpha = 0.11 * a0; g.beginPath(); g.moveTo(Pn.x, Pn.y); g.lineTo(mix(Pn.x, Qn.x, q), mix(Pn.y, Qn.y, q)); g.stroke(); if (q < 0.999) { g.fillStyle = col.accent; g.globalAlpha = 0.7 * a0 * Math.sin(Math.PI * q); g.beginPath(); g.arc(mix(Pn.x, Qn.x, q), mix(Pn.y, Qn.y, q), 1.8, 0, 6.2832); g.fill(); } }); }
      else { g.beginPath(); f.edges.forEach(e => { g.moveTo(e.A.x, e.A.y); g.lineTo(e.B.x, e.B.y); }); g.globalAlpha = (0.09 + 0.05 * (hover ? 1 : 0)) * a0 * f.linkA; g.stroke(); }
      if (f.pass) { const P = f.pass.path; g.strokeStyle = col.accent; g.lineWidth = 1.4; for (let k = 0; k < P.length - 1; k++) { const sg = clamp(pt - k); if (sg <= 0) break; const A = P[k], B = P[k + 1]; g.globalAlpha = 0.85 * a0 * fade * Math.max(f.linkA, 0.15); g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(mix(A.x, B.x, sg), mix(A.y, B.y, sg)); g.stroke(); if (sg < 1) { g.fillStyle = col.accent; g.beginPath(); g.arc(mix(A.x, B.x, sg), mix(A.y, B.y, sg), 2.2, 0, 6.2832); g.fill(); } } g.lineWidth = 1; }
      f.nodes.forEach(nd => { if (grow && nd.hereT < 0) return; const glow = Math.max(nd.lit, nd.hv * 0.8); const r = 2.3 * nd.d * (1 + 0.5 * glow) * (grow ? pop(nd.here) : 1); if (r <= 0.05) return; g.fillStyle = glow > 0.01 ? mixc('bg', 'accent', glow) : col.bg; g.globalAlpha = a0; g.beginPath(); g.arc(nd.x, nd.y, r, 0, 6.2832); g.fill(); g.strokeStyle = glow > 0.3 ? col.accent : col.ink; g.globalAlpha = (0.38 + 0.5 * glow) * a0 * clamp(nd.d, 0.5, 1); g.beginPath(); g.arc(nd.x, nd.y, r, 0, 6.2832); g.stroke(); if (glow > 0.05) { g.fillStyle = col.accent; g.globalAlpha = 0.18 * glow * a0; g.beginPath(); g.arc(nd.x, nd.y, r + 5, 0, 6.2832); g.fill(); } }); });
    const gone = flos.filter(f => f.state === 'gone').length; if (gone) { flos = flos.filter(f => f.state !== 'gone'); for (let j = 0; j < gone; j++) flos.push(makeFlo(true)); }
    // the shots: neurons flying out of the mark along a bent path, with a short trail; each lands with a pop and joins the nursery
    for (let j = volleys.length - 1; j >= 0; j--) { const sh = volleys[j]; if (t < sh.t0) continue; const q = clamp((t - sh.t0) / sh.dur), e = smooth(q); const nd = sh.nd, tx = nd.rx, ty = nd.ry;
      const mx = (sh.x0 + tx) / 2, my = (sh.y0 + ty) / 2, dx = tx - sh.x0, dy = ty - sh.y0, L = Math.hypot(dx, dy) || 1; const cx = mx - dy / L * sh.bend, cy = my + dx / L * sh.bend; const u = 1 - e;
      const x = u * u * sh.x0 + 2 * u * e * cx + e * e * tx, y = u * u * sh.y0 + 2 * u * e * cy + e * e * ty; sh.trail.push([x, y]); if (sh.trail.length > 9) sh.trail.shift();
      g.strokeStyle = col.accent; g.lineWidth = 1.4; for (let i = 1; i < sh.trail.length; i++) { g.globalAlpha = alpha * 0.55 * i / sh.trail.length; g.beginPath(); g.moveTo(sh.trail[i - 1][0], sh.trail[i - 1][1]); g.lineTo(sh.trail[i][0], sh.trail[i][1]); g.stroke(); }
      g.fillStyle = col.accent; g.globalAlpha = alpha; g.beginPath(); g.arc(x, y, 3, 0, 6.2832); g.fill(); g.globalAlpha = alpha * 0.2; g.beginPath(); g.arc(x, y, 8, 0, 6.2832); g.fill(); g.lineWidth = 1;
      if (q >= 1) { nd.hereT = t; nd.here = 0; nd.x = tx; nd.y = ty; nd.vx = (Math.random() - 0.5) * 120; nd.vy = (Math.random() - 0.5) * 120; volleys.splice(j, 1); const f = sh.f;
        if (f.state === 'grow' && f.nodes.every(n => n.hereT >= 0)) { f.state = 'float'; f.born = t - 0.9; f.nextPass = t + 0.45; if (nursery === f) nursery = null; const floating = flos.filter(o => o.state === 'float' && o !== f); if (floating.length + 1 > CAP()) breakFlo(floating[0]); } } }
    g.globalAlpha = 1;
  }

  // ───────── loop ─────────
  let last = 0;
  function frame(now) { const t = now / 1000, dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now; tNow = t; drawJourney(t, dt); requestAnimationFrame(frame); }
  window.addEventListener('resize', resize); resize(); requestAnimationFrame(frame);
})();
