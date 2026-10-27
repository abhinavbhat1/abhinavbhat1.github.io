/* The network is built while you read.
   Intro: the complete MLP flies in from behind the viewer, fires once, then settles into a ghost.
   Scroll: each section is a layer; every card collapses into a neuron that locks into its slot;
   layers wire up as you move on. Contact: the output neuron becomes a marble that rolls into a
   glass bowl and settles in the minimum. Fidget mode lets you poke nodes, edges and the marble. */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

const canvas = document.getElementById('landscape');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => window.innerWidth < 900;
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch (e) { canvas.style.display = 'none'; window.introSkip && window.introSkip(); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow() ? 1.5 : 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 4);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const UP = new THREE.Vector3(0, 1, 0);

// ───────── layout ─────────
const LAYERS = (window.LAYERS && window.LAYERS.length) ? window.LAYERS : [3, 3, 3, 3, 3, 3, 2];
const NL = LAYERS.length;
const GAP = 2.3, SPREAD = 1.25;
function slotOf(k, i, n) { // k = layer index (NL = output)
  if (narrow()) { const y = (3 - k) * 1.9; return new THREE.Vector3(k === NL ? 0 : (i - (n - 1) / 2) * 1.15, y, 0); }
  return new THREE.Vector3((k - 3) * GAP, k === NL ? 0 : (i - (n - 1) / 2) * SPREAD, 0);
}
const nodes = []; // { k, i, slot, mesh, from, off, vel, ph }
const r0 = rng(7);
LAYERS.forEach((n, k) => { for (let i = 0; i < n; i++) nodes.push({ k, i, n, ph: r0() * 6.28, seed: r0() }); });
nodes.push({ k: NL, i: 0, n: 1, ph: r0() * 6.28, seed: r0(), out: true });
const OUT = nodes.length - 1;
const edges = []; { let base = 0; for (let k = 0; k < NL; k++) { const n = LAYERS[k]; const m = k < NL - 1 ? LAYERS[k + 1] : 1; for (let a = 0; a < n; a++) for (let b = 0; b < m; b++) edges.push({ a: base + a, b: base + n + b, k: k + 1 }); base += n; } }
function relayout() { nodes.forEach(nd => { nd.slot = slotOf(nd.k, nd.i, nd.n); }); }
relayout();
const center = () => { const c = new THREE.Vector3(); nodes.forEach(n => c.add(n.slot)); return c.multiplyScalar(1 / nodes.length); };

// ───────── meshes ─────────
const net = new THREE.Group(); scene.add(net);
const nodeGeo = new THREE.SphereGeometry(0.17, 28, 28);
const spotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); const r = rng(5); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(r() * 256, r() * 256, 12 + r() * 18, 0, 6.28); g.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
nodes.forEach(nd => { nd.mesh = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, map: nd.out ? spotTex : null })); nd.off = new THREE.Vector3(); nd.vel = new THREE.Vector3(); net.add(nd.mesh); });
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false })); glow.scale.setScalar(1.6); net.add(glow);
const ePos = new Float32Array(edges.length * 6), eCol = new Float32Array(edges.length * 6);
const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3)); eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
const eLines = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({ vertexColors: true })); eLines.frustumCulled = false; net.add(eLines);
const NP = Math.min(edges.length, 140); const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(NP * 3); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pulse = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, transparent: true, opacity: 0, depthWrite: false })); pulse.frustumCulled = false; net.add(pulse);
const pEdge = (() => { const r = rng(9); return Array.from({ length: NP }, () => Math.floor(r() * edges.length)); })();

// ───────── the bowl (loss surface) ─────────
const bowl = new THREE.Group(); scene.add(bowl); bowl.visible = false;
const BR = 1.9, BA = 0.42; const bowlH = (u, v) => BA * (u * u + v * v);
{ const rings = 14, segs = 56, verts = [], cols = [];
  for (let i = 1; i <= rings; i++) { const r = BR * i / rings; for (let j = 0; j < segs; j++) { const a0 = j / segs * 6.2832, a1 = (j + 1) / segs * 6.2832; verts.push(r * Math.cos(a0), bowlH(r, 0), r * Math.sin(a0), r * Math.cos(a1), bowlH(r, 0), r * Math.sin(a1)); } }
  for (let j = 0; j < segs; j += 2) { const a = j / segs * 6.2832; for (let i = 0; i < rings; i++) { const r1 = BR * i / rings, r2 = BR * (i + 1) / rings; verts.push(r1 * Math.cos(a), bowlH(r1, 0), r1 * Math.sin(a), r2 * Math.cos(a), bowlH(r2, 0), r2 * Math.sin(a)); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  bowl.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 })));
  const surf = new THREE.BufferGeometry(); const sv = [], si = []; const R2 = 20, S2 = 40;
  for (let i = 0; i <= R2; i++) for (let j = 0; j <= S2; j++) { const r = BR * i / R2, a = j / S2 * 6.2832; sv.push(r * Math.cos(a), bowlH(r, 0), r * Math.sin(a)); }
  for (let i = 0; i < R2; i++) for (let j = 0; j < S2; j++) { const p = i * (S2 + 1) + j; si.push(p, p + S2 + 1, p + 1, p + 1, p + S2 + 1, p + S2 + 2); }
  surf.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3)); surf.setIndex(si); surf.computeVertexNormals();
  bowl.add(new THREE.Mesh(surf, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(BR, 0.012, 8, 96), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6 })); rim.rotation.x = Math.PI / 2; rim.position.y = bowlH(BR, 0); bowl.add(rim);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.name = 'shadow'; bowl.add(shadow);
}
const marble = { u: 0, v: 0, du: 0, dv: 0 }; // fidget offset on top of the scroll-driven path

// ───────── colours ─────────
const C = { node: new THREE.Color(), node2: new THREE.Color(), bg: new THREE.Color(), edge: new THREE.Color() };
function theme() {
  const dark = (window.currentTheme ? window.currentTheme() : 'light') === 'dark';
  C.node.set(dark ? '#b388ff' : '#57068c'); C.node2.set(dark ? '#e8d9ff' : '#8900e1'); C.bg.set(dark ? '#0e0a15' : '#fafafc'); C.edge.set(dark ? '#a98be0' : '#6b3fa0');
  glow.material.color.copy(C.node2); pulse.material.color.copy(C.node2);
  bowl.children.forEach(ch => { if (ch.name !== 'shadow') ch.material.color.copy(dark ? new THREE.Color('#b388ff') : new THREE.Color('#6b3fa0')); });
}
window.addEventListener('themechange', theme);

// ───────── camera poses ─────────
const want = { pos: new THREE.Vector3(), target: new THREE.Vector3() }, camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function layerCenter(k) { const c = new THREE.Vector3(); let n = 0; nodes.forEach(nd => { if (nd.k === k) { c.add(nd.slot); n++; } }); return c.multiplyScalar(1 / Math.max(1, n)); }
function poseHero(out) { const c = center(); if (narrow()) { out.pos.set(c.x, c.y + 5.6, 34); out.target.set(c.x, c.y + 4.8, 0); } else { out.pos.set(c.x - 11.2, 0.6, 36); out.target.set(c.x - 11.2, -0.2, 0); } return out; }
function poseIntro(out) { const c = center(); if (narrow()) { out.pos.set(c.x, c.y, 22); out.target.set(c.x, c.y, 0); } else { out.pos.set(c.x, 0.2, 17.5); out.target.set(c.x, 0, 0); } return out; }
function poseLayer(out, kf, wide) { // kf continuous layer index; wide pulls back to show the layers wiring up
  wide = wide || 0; const k0 = Math.floor(clamp(kf, 0, NL - 1)), k1 = Math.min(NL - 1, k0 + 1), f = clamp(kf - k0);
  const c = layerCenter(k0).lerp(layerCenter(k1), f);
  if (narrow()) { out.pos.set(c.x, c.y - 2.0 + 1.2 * wide, 9.2 + 5 * wide); out.target.set(c.x, c.y - 2.6 + 1.2 * wide, 0); }
  else { const ox = 4.1 - 2.6 * wide; out.pos.set(c.x + ox, c.y - 0.15, 11.2 + 6.5 * wide); out.target.set(c.x + ox, c.y - 0.35, 0); }
  return out;
}
function poseFinal(out) {
  const cb = bowl.position;
  if (narrow()) { out.pos.set(cb.x, cb.y + 4.8, cb.z + 8.2); out.target.set(cb.x, cb.y - 1.35, cb.z); }
  else { out.pos.set(cb.x + 1.5, cb.y + 4.3, 8.2); out.target.set(cb.x + 2.0, cb.y + 0.75, 0); }
  return out;
}
function screenToWorldZ0(sx, sy) { const v = new THREE.Vector3((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5).unproject(camera); const d = v.sub(camera.position).normalize(); const t = -camera.position.z / d.z; return camera.position.clone().addScaledVector(d, t); }

// ───────── intro state ─────────
let introT0 = null, introDone = false, introSkipped = false;
const ui = document.getElementById('intro-ui'), capEl = document.getElementById('intro-cap');
const CAPS = ['Initialising weights…', 'Warming up the neurons…', 'Propagating…'];
function finishIntro() { if (introDone) return; introDone = true; document.documentElement.classList.remove('intro'); document.documentElement.classList.add('ready'); if (ui) { ui.classList.add('out'); setTimeout(() => ui.remove(), 700); } window.dispatchEvent(new CustomEvent('introdone')); }
window.introSkip = () => { introSkipped = true; finishIntro(); };
document.getElementById('intro-skip')?.addEventListener('click', window.introSkip);
{ const r = rng(31); nodes.forEach(nd => { nd.from = new THREE.Vector3((r() - 0.5) * 14, (r() - 0.5) * 9, 18 + r() * 22); nd.stagger = r() * 0.9; }); }

// ───────── fidget (pointer) ─────────
const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let ptrDown = false, lastPtr = null;
function pointerWorld(e) { ptr.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera); return ray; }
function nudge(e, strength) {
  if (!window.FIDGET) return;
  const rc = pointerWorld(e); const hits = rc.intersectObjects(nodes.map(n => n.mesh).filter(m => m.visible), false);
  if (hits.length) { const nd = nodes.find(n => n.mesh === hits[0].object); if (nd) { if (nd.out && bowl.visible) { const dir = _a.copy(hits[0].point).sub(nd.mesh.position); marble.du += dir.x * -2.2 * strength; marble.dv += dir.z * -2.2 * strength; marble.du += (Math.random() - 0.5) * 0.6 * strength; } else { const dir = _a.copy(hits[0].point).sub(nd.mesh.position).normalize(); nd.vel.addScaledVector(dir, -1.6 * strength); nd.vel.y += 0.6 * strength; } } return; }
  // near an edge? wiggle both ends
  const sx = e.clientX, sy = e.clientY; let best = null;
  edges.forEach(ed => { const A = nodes[ed.a].mesh, B = nodes[ed.b].mesh; if (!A.visible || !B.visible) return; const pa = A.position.clone().project(camera), pb = B.position.clone().project(camera); const ax = (pa.x + 1) / 2 * window.innerWidth, ay = (1 - pa.y) / 2 * window.innerHeight, bx = (pb.x + 1) / 2 * window.innerWidth, by = (1 - pb.y) / 2 * window.innerHeight; const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1; const t = clamp(((sx - ax) * vx + (sy - ay) * vy) / L2); const dx = ax + vx * t - sx, dy = ay + vy * t - sy; const d = Math.hypot(dx, dy); if (d < 14 && (!best || d < best.d)) best = { ed, d, t }; });
  if (best) { const A = nodes[best.ed.a], B = nodes[best.ed.b]; const jolt = (Math.random() - 0.5) * 1.2 * strength; A.vel.y += jolt * (1 - best.t); B.vel.y += jolt * best.t; A.vel.x += (Math.random() - 0.5) * 0.5 * strength; B.vel.x += (Math.random() - 0.5) * 0.5 * strength; }
}
canvas.addEventListener('pointermove', (e) => { if (!window.FIDGET) return; if (!lastPtr || Math.hypot(e.clientX - lastPtr.x, e.clientY - lastPtr.y) > 6) { nudge(e, ptrDown ? 0.9 : 0.35); lastPtr = { x: e.clientX, y: e.clientY }; } });
canvas.addEventListener('pointerdown', (e) => { ptrDown = true; nudge(e, 1.6); });
window.addEventListener('pointerup', () => { ptrDown = false; });

// ───────── per-frame ─────────
const T = () => window.T || { phase: 'hero', k: -1, local: 0, finalU: 0 };
let lastNow = 0, camInit = false, ghostK = 0, bowlK = 0, lastW = 0;
const tmpC = new THREE.Color();
function update(now) {
  const t = now / 1000, dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60; lastNow = now;
  if (window.innerWidth !== lastW) { lastW = window.innerWidth; relayout(); }
  const tj = T(), NODES = window.NODES || [], EDGES = window.EDGES || [];
  // ── decide targets ──
  let assemble = 1, ghost = 1, edgeK = (k) => 1, pulseA = 0, lit = () => 0, outK = 0, fin = 0;
  if (!introDone) {
    if (introT0 === null) introT0 = t; const it = reduced || introSkipped ? 99 : t - introT0;
    nodes.forEach(nd => { nd.fly = easeOut((it - 0.1 - nd.stagger) / 1.35); });
    assemble = 1; const ek = clamp((it - 1.75) / 0.6); edgeK = () => ek;
    const pu = clamp((it - 2.25) / 0.95); lit = (k) => pu > 0 && pu < 1 ? Math.max(0, 1 - Math.abs(pu * (NL + 1.6) - k - 0.5) * 1.2) : 0; pulseA = pu > 0 && pu < 1 ? 0.9 : 0;
    const go = smooth((it - 3.1) / 0.9); ghost = go; outK = 1;
    poseIntro(want); const h = { pos: new THREE.Vector3(), target: new THREE.Vector3() }; poseHero(h); want.pos.lerp(h.pos, go); want.target.lerp(h.target, go);
    if (capEl) { const c = CAPS[Math.min(CAPS.length - 1, Math.floor(it / 1.15))]; if (capEl.textContent !== c) capEl.textContent = c; }
    if (it >= 3.25 && !document.documentElement.classList.contains('ready')) document.documentElement.classList.add('ready');
    if (it >= 4.0) finishIntro();
    if (!camInit) { camPos.copy(want.pos); camTarget.copy(want.target); camInit = true; }
    const ki = 1 - Math.exp(-dt * 22); camPos.lerp(want.pos, ki); camTarget.lerp(want.target, ki);
  } else {
    nodes.forEach(nd => { nd.fly = 1; });
    ghost = 1; outK = 0;
    if (tj.phase === 'hero') poseHero(want);
    else if (tj.phase === 'sec') { const kf = tj.local < 0 ? tj.k - 1 + (tj.local + 0.6) / 0.6 : tj.k; poseLayer(want, Math.max(0, kf), tj.wide || 0); }
    else { fin = tj.finalU; outK = smooth(fin / 0.22); const lk = { pos: new THREE.Vector3(), target: new THREE.Vector3() }; poseLayer(lk, NL - 1); poseFinal(want); const mix = smooth((fin - 0.14) / 0.3); want.pos.lerp(lk.pos, 1 - mix); want.target.lerp(lk.target, 1 - mix); }
    if (!camInit) { camPos.copy(want.pos); camTarget.copy(want.target); camInit = true; }
    const k = reduced ? 1 : 1 - Math.exp(-dt * 5.5); camPos.lerp(want.pos, k); camTarget.lerp(want.target, k);
  }
  camera.position.copy(camPos); camera.lookAt(camTarget); camera.updateMatrixWorld();
  // ── bowl placement: rim point coincides with the output slot ──
  const outNd = nodes[OUT]; const rimU = 0.82 * BR;
  if (narrow()) bowl.position.set(outNd.slot.x, outNd.slot.y - 2.1, outNd.slot.z - rimU); else bowl.position.set(outNd.slot.x - rimU + 0.2, outNd.slot.y - 2.1, outNd.slot.z + 0.4);
  bowlK += (((introDone && tj.phase === 'final') ? smooth((fin - 0.2) / 0.25) : 0) - bowlK) * (1 - Math.exp(-dt * 8));
  bowl.visible = bowlK > 0.003; bowl.scale.setScalar(0.3 + 0.7 * bowlK); bowl.children.forEach(ch => { if (ch.name === 'shadow') return; ch.material.opacity = (ch.geometry.type === 'TorusGeometry' ? 0.6 : ch.type === 'Mesh' ? 0.07 : 0.35) * bowlK; });
  // marble path (scroll-driven, reversible) + fidget physics
  const rollT = clamp((fin - 0.47) / 0.45) * 3.4; const decay = Math.exp(-1.15 * rollT);
  let mu = rimU * decay * Math.cos(2.7 * rollT), mv = 0.45 * rimU * decay * Math.sin(2.7 * rollT);
  if (fin < 0.47) { mu = rimU; mv = 0; }
  if (narrow()) { const t2 = mu; mu = mv; mv = t2; } // phones: enter the bowl from the near rim so the drop stays on screen
  const drop = smooth((fin - 0.36) / 0.11);
  if (bowlK > 0.01) { const gacc = 2 * BA * 9.0; marble.du += (-gacc * marble.u - 1.6 * marble.du) * dt; marble.dv += (-gacc * marble.v - 1.6 * marble.dv) * dt; marble.u += marble.du * dt; marble.v += marble.dv * dt; const rr = Math.hypot(marble.u + mu, marble.v + mv); if (rr > BR * 0.95) { const s = BR * 0.95 / rr; marble.u = (marble.u + mu) * s - mu; marble.v = (marble.v + mv) * s - mv; marble.du *= -0.4; marble.dv *= -0.4; } } else { marble.u = marble.v = marble.du = marble.dv = 0; }
  const tu = mu + marble.u, tv = mv + marble.v;
  // ── nodes ──
  const ghostScale = 0.42, ghostA = 0.22;
  nodes.forEach((nd, idx) => {
    const m = nd.mesh; let built = 1, p = _a.copy(nd.slot);
    if (!introDone) { p.lerpVectors(nd.from, nd.slot, nd.fly); built = 1; }
    else if (nd.out) { built = outK; }
    else { const rec = (NODES[nd.k] || [])[nd.i]; built = rec ? rec.b : 0; if (rec && built > 0 && built < 1) { const w = screenToWorldZ0(rec.sx, rec.sy); const e = smooth(built); p.lerpVectors(w, nd.slot, e); p.y += Math.sin(e * Math.PI) * 0.6; } }
    // ghost vs built blend; during the intro everything is "built" then fades to ghost
    const g = introDone ? (1 - built) : ghost;
    const heroBoost = (introDone && tj.phase === 'hero') ? (narrow() ? 1 : 1.7) : 1; const heroFade = (introDone && tj.phase === 'hero' && narrow()) ? 0.5 : 1;
    let sc = (1 - (1 - ghostScale) * g) * (g > 0.5 ? heroBoost : 1); let al = (1 - (1 - ghostA) * g) * (g > 0.5 ? heroFade : 1);
    if (nd.out) { if (!introDone) { sc = 1 - (1 - ghostScale) * ghost; al = 1 - (1 - ghostA) * ghost; } else { sc = 0.2 + 0.8 * outK; al = outK; } }
    // marble: the output neuron rolls in the bowl
    if (nd.out && bowlK > 0.01) { const bp = new THREE.Vector3(tu, bowlH(tu, tv) + 0.27 * bowl.scale.x, tv).multiplyScalar(bowl.scale.x).add(bowl.position); const arc = Math.sin(drop * Math.PI) * 0.5; p.lerp(bp, drop); p.y += arc; sc = 1 + 0.7 * drop; const sh = bowl.getObjectByName('shadow'); sh.position.set(tu, bowlH(tu, tv) + 0.015, tv); sh.material.opacity = 0.12 * bowlK; }
    // fidget spring
    if (nd.vel.lengthSq() > 1e-8 || nd.off.lengthSq() > 1e-8) { nd.vel.addScaledVector(nd.off, -28 * dt); nd.vel.multiplyScalar(Math.exp(-dt * 3.2)); nd.off.addScaledVector(nd.vel, dt); if (nd.off.lengthSq() < 1e-6 && nd.vel.lengthSq() < 1e-6) { nd.off.set(0, 0, 0); nd.vel.set(0, 0, 0); } }
    m.position.copy(p).add(nd.off); m.position.y += Math.sin(t * 1.3 + nd.ph) * 0.03 * (1 - g);
    const l = lit(nd.k); m.material.color.copy(C.node).lerp(C.node2, l); m.scale.setScalar(sc * (1 + 0.55 * l)); m.material.opacity = al; m.visible = al > 0.01;
    if (nd.out) { m.rotation.y += (marble.du + 0.4) * dt * 2; m.rotation.x += marble.dv * dt * 2; }
  });
  glow.position.copy(nodes[OUT].mesh.position); glow.material.opacity = (introDone ? outK : 0.6 * (1 - ghost)) * 0.5 * (1 + 0.5 * bowlK); glow.scale.setScalar((introDone ? 1.2 : 1.6) + 0.9 * bowlK);
  // ── edges: grow from source to target by the layer's connect progress; ghost otherwise ──
  edges.forEach((ed, e) => {
    const A = nodes[ed.a].mesh.position, B = nodes[ed.b].mesh.position;
    let kk = introDone ? (EDGES[ed.k] || 0) : edgeK(ed.k); const bA = nodes[ed.a].mesh.visible && nodes[ed.b].mesh.visible;
    const gl = introDone ? 0.05 : 0.0; // ghost alpha after the intro
    const grow = bA ? Math.max(kk, 0) : 0; const alpha = (introDone ? (gl + (0.42 - gl) * kk) : 0.42 * kk * (1 - 0.88 * ghost));
    const len = introDone && kk < 1 && kk > 0 ? kk : (kk > 0 || !introDone ? 1 : 1);
    _b.lerpVectors(A, B, introDone ? (kk > 0 ? kk : 1) : 1);
    ePos[e * 6] = A.x; ePos[e * 6 + 1] = A.y; ePos[e * 6 + 2] = A.z; ePos[e * 6 + 3] = _b.x; ePos[e * 6 + 4] = _b.y; ePos[e * 6 + 5] = _b.z;
    tmpC.copy(C.bg).lerp(C.edge, alpha * (bA ? 1 : 0)); eCol[e * 6] = eCol[e * 6 + 3] = tmpC.r; eCol[e * 6 + 1] = eCol[e * 6 + 4] = tmpC.g; eCol[e * 6 + 2] = eCol[e * 6 + 5] = tmpC.b;
  });
  eGeo.attributes.position.needsUpdate = true; eGeo.attributes.color.needsUpdate = true;
  // pulses (intro forward pass)
  if (pulseA > 0) { const pu = clamp((t - introT0 - 2.25) / 0.95); for (let i = 0; i < NP; i++) { const ed = edges[pEdge[i]]; const s = clamp(pu * (NL + 1.6) - ed.k + 1 - (i % 7) * 0.05); const p = nodes[ed.a].mesh.position, q = nodes[ed.b].mesh.position; pPos[i * 3] = p.x + (q.x - p.x) * s; pPos[i * 3 + 1] = p.y + (q.y - p.y) * s; pPos[i * 3 + 2] = p.z + (q.z - p.z) * s; } pGeo.attributes.position.needsUpdate = true; }
  pulse.material.opacity = pulseA;
  renderer.render(scene, camera);
  window.__ball = nodes[OUT].mesh.position.clone().project(camera);
  window.__nodeOff = nodes.map(n => +n.off.length().toFixed(3)); window.__marble = { u: +marble.u.toFixed(3), v: +marble.v.toFixed(3) };
  window.__screen = (i) => { const v = nodes[i].mesh.position.clone().project(camera); return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, vis: nodes[i].mesh.visible }; };
}
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); relayout(); }
window.addEventListener('resize', resize);
theme(); resize();
let running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(loop); });
function loop(now) { if (!running) return; update(now); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
