/* The network is built while you read.
   Intro: every neuron flies in from behind the viewer, the layers wire up with curved edges,
   a forward pass fires, then the network settles into a faint ghost behind the home page.
   Scroll: each topic is a layer; every card collapses into a neuron that locks into its slot;
   layers wire up as you move on. Contact: the output neuron descends into a soft gradient well
   and settles at the minimum. Fidget mode lets you poke neurons, edges and the output neuron. */
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
const easeBack = (t) => { t = clamp(t); const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const UP = new THREE.Vector3(0, 1, 0);

// ───────── organic layout ─────────
const LAYERS = (window.LAYERS && window.LAYERS.length) ? window.LAYERS : [3, 3, 3, 3, 3, 3, 2];
const NL = LAYERS.length, GAP = 2.3, SPREAD = 1.25;
const nodes = []; const r0 = rng(7);
LAYERS.forEach((n, k) => { for (let i = 0; i < n; i++) nodes.push({ k, i, n, ph: r0() * 6.28, s1: r0(), s2: r0(), s3: r0(), size: 0.86 + r0() * 0.28 }); });
nodes.push({ k: NL, i: 0, n: 1, ph: r0() * 6.28, s1: 0.5, s2: 0.5, s3: 0.5, size: 1.15, out: true });
const OUT = nodes.length - 1;
function slotOf(nd) {
  const { k, i, n } = nd; const jy = (nd.s1 - 0.5) * 0.6, jz = (nd.s2 - 0.5) * 1.5, jx = (nd.s3 - 0.5) * 0.5;
  if (narrow()) { if (nd.out) return new THREE.Vector3(0, (3 - k) * 1.9 - 0.2, 0); return new THREE.Vector3((i - (n - 1) / 2) * 1.15 + jy * 0.5, (3 - k) * 1.9 + jx * 0.5, jz * 0.6); }
  if (nd.out) return new THREE.Vector3((k - 3) * GAP + 0.3, 0.1, 0.2);
  return new THREE.Vector3((k - 3) * GAP + jx, (i - (n - 1) / 2) * SPREAD + jy, jz - 0.1 * Math.pow(k - 3, 2));
}
function relayout() { nodes.forEach(nd => { nd.slot = slotOf(nd); }); }
relayout();
const edges = []; { let base = 0; for (let k = 0; k < NL; k++) { const n = LAYERS[k], m = k < NL - 1 ? LAYERS[k + 1] : 1; for (let a = 0; a < n; a++) for (let b = 0; b < m; b++) { const r = rng(1000 + edges.length); edges.push({ a: base + a, b: base + n + b, k: k + 1, bend: new THREE.Vector3((r() - 0.5) * 0.3, (r() - 0.5) * 0.5, (r() - 0.5) * 0.9) }); } base += n; } }
const center = () => { const c = new THREE.Vector3(); nodes.forEach(n => c.add(n.slot)); return c.multiplyScalar(1 / nodes.length); };
function layerCenter(k) { const c = new THREE.Vector3(); let n = 0; nodes.forEach(nd => { if (nd.k === k) { c.add(nd.slot); n++; } }); return c.multiplyScalar(1 / Math.max(1, n)); }

// ───────── meshes ─────────
const net = new THREE.Group(); scene.add(net);
const nodeGeo = new THREE.SphereGeometry(0.17, 28, 28);
nodes.forEach(nd => { nd.mesh = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 })); nd.mesh.renderOrder = nd.out ? 4 : 2; nd.off = new THREE.Vector3(); nd.vel = new THREE.Vector3(); net.add(nd.mesh); });
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false })); glow.scale.setScalar(1.6); net.add(glow);
// curved edges: SEGS segments per edge, drawn progressively from source to target
const SEGS = 8; const ePos = new Float32Array(edges.length * SEGS * 6), eCol = new Float32Array(edges.length * SEGS * 6);
const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3)); eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
const eLines = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({ vertexColors: true })); eLines.frustumCulled = false; net.add(eLines);
const _q = new THREE.Vector3();
function bez(A, B, bend, t, out) { // quadratic bezier with a control point at the midpoint plus the edge's bend
  _q.lerpVectors(A, B, 0.5).add(bend); const u = 1 - t;
  return out.set(u * u * A.x + 2 * u * t * _q.x + t * t * B.x, u * u * A.y + 2 * u * t * _q.y + t * t * B.y, u * u * A.z + 2 * u * t * _q.z + t * t * B.z);
}
const NP = Math.min(edges.length, 140); const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(NP * 3); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pulse = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, transparent: true, opacity: 0, depthWrite: false })); pulse.frustumCulled = false; net.add(pulse);
const pEdge = (() => { const r = rng(9); return Array.from({ length: NP }, () => Math.floor(r() * edges.length)); })();

// ───────── the gradient well (a soft loss surface around the minimum) ─────────
const well = new THREE.Group(); scene.add(well); well.visible = false;
const WR = 2.3, WA = 0.34; const wellH = (u, v) => WA * (u * u + v * v);
let wellSurf, wellRings = [], wellGlow, wellShadow, descent, descentState = [];
{ const R2 = 26, S2 = 72, sv = [], sc = [], si = [];
  for (let i = 0; i <= R2; i++) for (let j = 0; j <= S2; j++) { const r = WR * i / R2, a = j / S2 * 6.2832; sv.push(r * Math.cos(a), wellH(r, 0), r * Math.sin(a)); sc.push(0, 0, 0); }
  for (let i = 0; i < R2; i++) for (let j = 0; j < S2; j++) { const p = i * (S2 + 1) + j; si.push(p, p + S2 + 1, p + 1, p + 1, p + S2 + 1, p + S2 + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3)); g.setIndex(si);
  wellSurf = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false, depthTest: false })); wellSurf.renderOrder = -3; well.add(wellSurf);
  for (let q = 1; q <= 7; q++) { const r = WR * (0.12 + 0.88 * (q / 7)); const pts = []; for (let j = 0; j <= 96; j++) { const a = j / 96 * 6.2832; pts.push(new THREE.Vector3(r * Math.cos(a), wellH(r, 0) + 0.006, r * Math.sin(a))); } const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); ln.userData.base = 0.32 * (1 - r / WR) + 0.05; ln.renderOrder = -2; ln.material.depthTest = false; well.add(ln); wellRings.push(ln); }
  wellGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); wellGlow.scale.setScalar(2.6); wellGlow.position.y = 0.05; wellGlow.renderOrder = -3; well.add(wellGlow);
  wellShadow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); wellShadow.scale.setScalar(0.7); wellShadow.renderOrder = -1; well.add(wellShadow);
  const ND = narrow() ? 110 : 190; const dg = new THREE.BufferGeometry(); const dp = new Float32Array(ND * 3); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  descent = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.05, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); descent.frustumCulled = false; descent.renderOrder = -1; well.add(descent);
  const r = rng(77); descentState = Array.from({ length: ND }, () => ({ a: r() * 6.28, r: WR * (0.1 + 0.9 * r()), sp: 0.35 + r() * 0.5, dr: (r() - 0.5) * 0.8 }));
}
const neuron = { u: 0, v: 0, du: 0, dv: 0 }; // fidget offset on top of the scroll-driven descent

// ───────── colours ─────────
const C = { node: new THREE.Color(), node2: new THREE.Color(), bg: new THREE.Color(), edge: new THREE.Color(), well: new THREE.Color() };
function theme() {
  const dark = (window.currentTheme ? window.currentTheme() : 'light') === 'dark';
  C.node.set(dark ? '#7fb0ff' : '#4b8cf7'); C.node2.set(dark ? '#dbe9ff' : '#a9cdff'); C.bg.set(dark ? '#0c1020' : '#fafbfd'); C.edge.set(dark ? '#5e80bf' : '#9db9ea'); C.well.set(dark ? '#3f6fd0' : '#8fb6f6');
  glow.material.color.copy(C.node2); pulse.material.color.copy(C.node2);
  const col = wellSurf.geometry.attributes.color; const pos = wellSurf.geometry.attributes.position; const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const r = clamp(Math.hypot(pos.getX(i), pos.getZ(i)) / WR); tmp.copy(C.bg).lerp(C.well, Math.pow(1 - r, 1.7)); col.setXYZ(i, tmp.r, tmp.g, tmp.b); }
  col.needsUpdate = true;
  wellRings.forEach(l => l.material.color.copy(C.edge)); wellGlow.material.color.copy(dark ? C.well : C.node2); descent.material.color.copy(dark ? C.node2 : C.node);
}
window.addEventListener('themechange', theme);

// ───────── camera poses ─────────
const want = { pos: new THREE.Vector3(), target: new THREE.Vector3() }, camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();
function poseHero(out) { const c = center(); if (narrow()) { out.pos.set(c.x, c.y + 5.6, 34); out.target.set(c.x, c.y + 4.8, 0); } else { out.pos.set(c.x - 11.2, 0.6, 36); out.target.set(c.x - 11.2, -0.2, 0); } return out; }
function poseIntro(out) { const c = center(); if (narrow()) { out.pos.set(c.x, c.y, 22); out.target.set(c.x, c.y, 0); } else { out.pos.set(c.x, 0.2, 17.5); out.target.set(c.x, 0, 0); } return out; }
function poseLayer(out, kf, wide) {
  wide = wide || 0; const k0 = Math.floor(clamp(kf, 0, NL - 1)), k1 = Math.min(NL - 1, k0 + 1), f = clamp(kf - k0);
  const c = layerCenter(k0).lerp(layerCenter(k1), f);
  if (narrow()) { out.pos.set(c.x, c.y - 2.0 + 1.2 * wide, 9.2 + 5 * wide); out.target.set(c.x, c.y - 2.6 + 1.2 * wide, 0); }
  else { const ox = 4.1 - 2.6 * wide; out.pos.set(c.x + ox, c.y - 0.15, 11.2 + 6.5 * wide); out.target.set(c.x + ox, c.y - 0.35, 0); }
  return out;
}
function poseFinal(out) { const w = well.position; if (narrow()) { out.pos.set(w.x, w.y + 4.8, w.z + 8.2); out.target.set(w.x, w.y - 1.35, w.z); } else { out.pos.set(w.x + 1.5, w.y + 4.3, 8.2); out.target.set(w.x + 2.0, w.y + 0.75, 0); } return out; }
function screenToWorldZ0(sx, sy) { const v = new THREE.Vector3((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5).unproject(camera); const d = v.sub(camera.position).normalize(); const t = -camera.position.z / d.z; return camera.position.clone().addScaledVector(d, t); }
const lerpPose = (a, b, k) => { a.pos.lerp(b.pos, k); a.target.lerp(b.target, k); };
const alt = { pos: new THREE.Vector3(), target: new THREE.Vector3() };

// ───────── intro state ─────────
let introT0 = null, introDone = false, introSkipped = false;
const ui = document.getElementById('intro-ui'), capEl = document.getElementById('intro-cap');
const CAPS = ['Initialising weights…', 'Warming up the neurons…', 'Propagating…'];
function finishIntro() { if (introDone) return; introDone = true; document.documentElement.classList.remove('intro'); document.documentElement.classList.add('ready'); if (ui) { ui.classList.add('out'); setTimeout(() => ui.remove(), 700); } window.dispatchEvent(new CustomEvent('introdone')); }
window.introSkip = () => { introSkipped = true; finishIntro(); };
document.getElementById('intro-skip')?.addEventListener('click', window.introSkip);
{ const r = rng(31); const cz = narrow() ? 22 : 17.5; nodes.forEach(nd => { nd.from = new THREE.Vector3((r() - 0.5) * 24, (r() - 0.5) * 14, cz + 2.5 + r() * 13); nd.stagger = nd.k * 0.11 + r() * 0.3; }); }

// ───────── pointer: parallax + gentle response, and fidget pokes ─────────
const ptr = { x: 0, y: 0, nx: 0, ny: 0, active: false, t: 0 }; let ptrDown = false, lastPtr = null;
window.addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.nx = (e.clientX / window.innerWidth) * 2 - 1; ptr.ny = (e.clientY / window.innerHeight) * 2 - 1; ptr.active = e.pointerType !== 'touch'; ptr.t = performance.now(); }, { passive: true });
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
function nudge(e, strength) {
  if (!window.FIDGET) return;
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(nodes.map(n => n.mesh).filter(m => m.visible), false);
  if (hits.length) { const nd = nodes.find(n => n.mesh === hits[0].object); if (!nd) return;
    if (nd.out && well.visible) { const dir = _a.copy(hits[0].point).sub(nd.mesh.position); neuron.du += dir.x * -2.2 * strength + (Math.random() - 0.5) * 0.6 * strength; neuron.dv += dir.z * -2.2 * strength; }
    else { const dir = _a.copy(hits[0].point).sub(nd.mesh.position).normalize(); nd.vel.addScaledVector(dir, -1.6 * strength); nd.vel.y += 0.6 * strength; } return; }
  const sx = e.clientX, sy = e.clientY; let best = null;
  edges.forEach(ed => { const A = nodes[ed.a].mesh, B = nodes[ed.b].mesh; if (!A.visible || !B.visible) return; const pa = A.position.clone().project(camera), pb = B.position.clone().project(camera); const ax = (pa.x + 1) / 2 * window.innerWidth, ay = (1 - pa.y) / 2 * window.innerHeight, bx = (pb.x + 1) / 2 * window.innerWidth, by = (1 - pb.y) / 2 * window.innerHeight; const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1; const t = clamp(((sx - ax) * vx + (sy - ay) * vy) / L2); const d = Math.hypot(ax + vx * t - sx, ay + vy * t - sy); if (d < 16 && (!best || d < best.d)) best = { ed, d, t }; });
  if (best) { const A = nodes[best.ed.a], B = nodes[best.ed.b]; const jolt = (Math.random() - 0.5) * 1.2 * strength; A.vel.y += jolt * (1 - best.t); B.vel.y += jolt * best.t; A.vel.x += (Math.random() - 0.5) * 0.5 * strength; B.vel.x += (Math.random() - 0.5) * 0.5 * strength; }
}
canvas.addEventListener('pointermove', (e) => { if (!window.FIDGET) return; if (!lastPtr || Math.hypot(e.clientX - lastPtr.x, e.clientY - lastPtr.y) > 6) { nudge(e, ptrDown ? 0.9 : 0.35); lastPtr = { x: e.clientX, y: e.clientY }; } });
canvas.addEventListener('pointerdown', (e) => { ptrDown = true; nudge(e, 1.6); });
window.addEventListener('pointerup', () => { ptrDown = false; });

// ───────── per-frame ─────────
const T = () => window.T || { phase: 'hero', kf: 0, wide: 0, finalU: 0, heroK: 1 };
let lastNow = 0, camInit = false, wellK = 0, lastW = 0, par = { x: 0, y: 0 };
const tmpC = new THREE.Color(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
function update(now) {
  const t = now / 1000, dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60; lastNow = now;
  if (window.innerWidth !== lastW) { lastW = window.innerWidth; relayout(); }
  const tj = T(), NODES = window.NODES || [], EDGES = window.EDGES || [];
  let ghost = 1, edgeK = () => 1, pulseA = 0, lit = () => 0, outK = 0, fin = 0, it = 99;
  if (!introDone) {
    if (introT0 === null) introT0 = t; it = reduced || introSkipped ? 99 : t - introT0;
    nodes.forEach(nd => { nd.fly = easeBack((it - 0.15 - nd.stagger) / 1.5); });
    edgeK = (k) => clamp((it - 1.55 - (k - 1) * 0.09) / 0.55);
    const pu = clamp((it - 2.4) / 0.95); lit = (k) => pu > 0 && pu < 1 ? Math.max(0, 1 - Math.abs(pu * (NL + 1.6) - k - 0.5) * 1.2) : 0; pulseA = pu > 0 && pu < 1 ? 0.9 : 0;
    const go = smooth((it - 3.3) / 0.9); ghost = go; outK = 1;
    poseIntro(want); poseHero(alt); lerpPose(want, alt, go);
    if (capEl) { const c = CAPS[Math.min(CAPS.length - 1, Math.floor(it / 1.2))]; if (capEl.textContent !== c) capEl.textContent = c; }
    if (it >= 3.45 && !document.documentElement.classList.contains('ready')) document.documentElement.classList.add('ready');
    if (it >= 4.2) finishIntro();
  } else {
    nodes.forEach(nd => { nd.fly = 1; }); ghost = 1;
    if (tj.phase === 'final') { fin = tj.finalU; outK = smooth(fin / 0.22); poseLayer(want, NL - 1, 0); poseFinal(alt); lerpPose(want, alt, smooth((fin - 0.14) / 0.3)); }
    else { poseLayer(want, tj.kf || 0, tj.wide || 0); if (tj.heroK > 0) { poseHero(alt); lerpPose(want, alt, tj.heroK); } }
  }
  // pointer parallax (desktop only), stronger on the opening views
  const parS = narrow() || !ptr.active ? 0 : (!introDone || (tj.heroK || 0) > 0.5 ? 0.9 : 0.3);
  par.x += (ptr.nx * parS - par.x) * (1 - Math.exp(-dt * 3)); par.y += (ptr.ny * parS - par.y) * (1 - Math.exp(-dt * 3));
  want.pos.x += par.x * 0.7; want.pos.y -= par.y * 0.4; want.target.x += par.x * 0.3; want.target.y -= par.y * 0.18;
  if (!camInit) { camPos.copy(want.pos); camTarget.copy(want.target); camInit = true; }
  const kc = reduced ? 1 : 1 - Math.exp(-dt * (introDone ? 5.5 : 14)); camPos.lerp(want.pos, kc); camTarget.lerp(want.target, kc);
  camera.position.copy(camPos); camera.lookAt(camTarget); camera.updateMatrixWorld();
  camRight.setFromMatrixColumn(camera.matrixWorld, 0); camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  // ── well placement: the output slot sits on its rim ──
  const outNd = nodes[OUT]; const rimU = 0.9 * WR;
  if (narrow()) well.position.set(outNd.slot.x, outNd.slot.y - 2.0, outNd.slot.z - rimU); else well.position.set(outNd.slot.x - rimU + 0.2, outNd.slot.y - 2.0, outNd.slot.z + 0.4);
  wellK += (((introDone && tj.phase === 'final') ? smooth((fin - 0.2) / 0.25) : 0) - wellK) * (1 - Math.exp(-dt * 8));
  well.visible = wellK > 0.003; well.scale.setScalar(0.35 + 0.65 * wellK);
  wellSurf.material.opacity = 0.48 * wellK; wellRings.forEach(l => l.material.opacity = l.userData.base * wellK); wellGlow.material.opacity = 0.35 * wellK; descent.material.opacity = 0.65 * wellK;
  if (wellK > 0.01) { const arr = descent.geometry.attributes.position.array; descentState.forEach((d, i) => { d.r -= d.sp * dt * (0.2 + d.r / WR); d.a += d.dr * dt * (0.4 + d.r / WR); if (d.r < 0.07) { d.r = WR * (0.86 + Math.random() * 0.12); d.a = Math.random() * 6.28; } arr[i * 3] = d.r * Math.cos(d.a); arr[i * 3 + 1] = wellH(d.r, 0) + 0.025; arr[i * 3 + 2] = d.r * Math.sin(d.a); }); descent.geometry.attributes.position.needsUpdate = true; }
  // descent path (scroll-driven, reversible) + fidget physics
  const rollT = clamp((fin - 0.47) / 0.45) * 3.4, decay = Math.exp(-1.15 * rollT);
  let mu = rimU * decay * Math.cos(2.7 * rollT), mv = 0.45 * rimU * decay * Math.sin(2.7 * rollT);
  if (fin < 0.47) { mu = rimU; mv = 0; }
  if (narrow()) { const t2 = mu; mu = mv; mv = t2; }
  const drop = smooth((fin - 0.36) / 0.11);
  if (wellK > 0.01) { const g = 2 * WA * 9.0; neuron.du += (-g * neuron.u - 1.6 * neuron.du) * dt; neuron.dv += (-g * neuron.v - 1.6 * neuron.dv) * dt; neuron.u += neuron.du * dt; neuron.v += neuron.dv * dt; const rr = Math.hypot(neuron.u + mu, neuron.v + mv); if (rr > WR * 0.95) { const s = WR * 0.95 / rr; neuron.u = (neuron.u + mu) * s - mu; neuron.v = (neuron.v + mv) * s - mv; neuron.du *= -0.4; neuron.dv *= -0.4; } } else { neuron.u = neuron.v = neuron.du = neuron.dv = 0; }
  const tu = mu + neuron.u, tv = mv + neuron.v;
  // ── nodes ──
  const ghostScale = 0.42, ghostA = 0.24;
  const hoverOn = ptr.active && (performance.now() - ptr.t) < 1500 && (!introDone || (tj.heroK || 0) > 0.5);
  nodes.forEach(nd => {
    const m = nd.mesh; let built = 1; const p = _a.copy(nd.slot);
    if (!introDone) p.lerpVectors(nd.from, nd.slot, nd.fly);
    else if (nd.out) built = outK;
    else { const rec = (NODES[nd.k] || [])[nd.i]; built = rec ? rec.b : 0; if (rec && built > 0 && built < 1) { const w = screenToWorldZ0(rec.sx, rec.sy); const e = smooth(built); p.lerpVectors(w, nd.slot, e); p.y += Math.sin(e * Math.PI) * 0.6; } }
    const g = introDone ? (1 - built) : ghost;
    // organic float
    const fl = introDone ? 1 : clamp(nd.fly); p.x += Math.sin(t * 0.9 + nd.ph) * 0.05 * fl; p.y += Math.sin(t * 1.3 + nd.ph * 1.7) * 0.06 * fl; p.z += Math.cos(t * 0.7 + nd.ph) * 0.06 * fl;
    const heroBoost = (introDone && (tj.heroK || 0) > 0.5) ? (narrow() ? 1 : 1.7) : 1; const heroFade = (introDone && (tj.heroK || 0) > 0.5 && narrow()) ? 0.5 : 1;
    let sc = (1 - (1 - ghostScale) * g) * (g > 0.5 ? heroBoost : 1) * nd.size; let al = (1 - (1 - ghostA) * g) * (g > 0.5 ? heroFade : 1);
    if (nd.out) { if (!introDone) { sc = (1 - (1 - ghostScale) * ghost) * nd.size; al = 1 - (1 - ghostA) * ghost; } else { sc = (0.2 + 0.8 * outK) * nd.size; al = outK; } }
    if (nd.out && wellK > 0.01) { const wp = new THREE.Vector3(tu, wellH(tu, tv) + 0.2 * well.scale.x, tv).multiplyScalar(well.scale.x).add(well.position); p.lerp(wp, drop); p.y += Math.sin(drop * Math.PI) * 0.5; sc = (1 + 0.45 * drop) * nd.size; wellShadow.position.set(tu, wellH(tu, tv) + 0.02, tv); wellShadow.material.opacity = 0.14 * wellK * drop; }
    // gentle pointer response (always on while the network is the hero) and fidget springs
    if (hoverOn && m.visible) { const sp = m.position.clone().project(camera); const sx = (sp.x + 1) / 2 * window.innerWidth, sy = (1 - sp.y) / 2 * window.innerHeight; const d = Math.hypot(sx - ptr.x, sy - ptr.y); if (d < 120 && d > 0.5) { const f = (1 - d / 120) * 1.4 * dt; nd.vel.addScaledVector(camRight, (sx - ptr.x) / d * f).addScaledVector(camUp, -(sy - ptr.y) / d * f); } }
    if (nd.vel.lengthSq() > 1e-8 || nd.off.lengthSq() > 1e-8) { nd.vel.addScaledVector(nd.off, -24 * dt); nd.vel.multiplyScalar(Math.exp(-dt * 3.0)); nd.off.addScaledVector(nd.vel, dt); if (nd.off.lengthSq() < 1e-6 && nd.vel.lengthSq() < 1e-6) { nd.off.set(0, 0, 0); nd.vel.set(0, 0, 0); } }
    m.position.copy(p).add(nd.off);
    const l = lit(nd.k); m.material.color.copy(C.node).lerp(C.node2, l); m.scale.setScalar(sc * (1 + 0.55 * l)); m.material.opacity = al; m.visible = al > 0.01;
    if (nd.out) { m.rotation.y += (neuron.du + 0.3) * dt * 2; m.rotation.x += neuron.dv * dt * 2; }
  });
  glow.position.copy(nodes[OUT].mesh.position); glow.material.opacity = (introDone ? outK : 0.6 * (1 - ghost)) * (0.5 - 0.2 * wellK); glow.scale.setScalar(1.5 + 1.3 * wellK);
  // ── edges: grow along their curve by the layer's progress; faint ghost otherwise ──
  const gl = introDone ? 0.07 : 0;
  edges.forEach((ed, e) => {
    const A = nodes[ed.a].mesh.position, B = nodes[ed.b].mesh.position; const both = nodes[ed.a].mesh.visible && nodes[ed.b].mesh.visible;
    const kk = introDone ? (EDGES[ed.k] || 0) : edgeK(ed.k); const len = introDone ? (kk > 0 ? kk : 1) : kk;
    const alpha = both ? (introDone ? (gl + (0.42 - gl) * kk) : 0.42 * kk * (1 - 0.86 * ghost)) : 0;
    for (let s = 0; s < SEGS; s++) { const t0 = Math.min(len, s / SEGS), t1 = Math.min(len, (s + 1) / SEGS); bez(A, B, ed.bend, t0, _a); bez(A, B, ed.bend, t1, _b); const o = (e * SEGS + s) * 6; ePos[o] = _a.x; ePos[o + 1] = _a.y; ePos[o + 2] = _a.z; ePos[o + 3] = _b.x; ePos[o + 4] = _b.y; ePos[o + 5] = _b.z; tmpC.copy(C.bg).lerp(C.edge, alpha); eCol[o] = eCol[o + 3] = tmpC.r; eCol[o + 1] = eCol[o + 4] = tmpC.g; eCol[o + 2] = eCol[o + 5] = tmpC.b; }
  });
  eGeo.attributes.position.needsUpdate = true; eGeo.attributes.color.needsUpdate = true;
  if (pulseA > 0) { const pu = clamp((it - 2.4) / 0.95); for (let i = 0; i < NP; i++) { const ed = edges[pEdge[i]]; const s = clamp(pu * (NL + 1.6) - ed.k + 1 - (i % 7) * 0.05); bez(nodes[ed.a].mesh.position, nodes[ed.b].mesh.position, ed.bend, s, _p); pPos[i * 3] = _p.x; pPos[i * 3 + 1] = _p.y; pPos[i * 3 + 2] = _p.z; } pGeo.attributes.position.needsUpdate = true; }
  pulse.material.opacity = pulseA;
  renderer.render(scene, camera);
  window.__ball = nodes[OUT].mesh.position.clone().project(camera);
  window.__nodeOff = nodes.map(n => +n.off.length().toFixed(3)); window.__marble = { u: +neuron.u.toFixed(3), v: +neuron.v.toFixed(3) };
  window.__screen = (i) => { const v = nodes[i].mesh.position.clone().project(camera); return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, vis: nodes[i].mesh.visible }; };
}
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); relayout(); }
window.addEventListener('resize', resize);
theme(); resize();
let running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(loop); });
function loop(now) { if (!running) return; update(now); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
