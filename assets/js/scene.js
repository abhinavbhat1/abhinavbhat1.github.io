/* The network is the CV, and it is a landscape.
   A space-time sheet lies flat under everything. The network stands on it in 3D: About at the back, then one
   layer per topic, the output neuron at the front. Every neuron is a marble: when its card slides past, it rises
   out of the text, lands on the rim of its own local minimum and rolls in under damped physics, denting the sheet
   where it rests. The output neuron owns the global minimum, the deepest well, at the bottom of the page.
   Intro: every neuron flies in from behind you, the network wires up across the screen and fires once, then
   dissolves into the home page. Reading: the camera zooms onto the layer you are reading and pulls back between
   layers. Contact: the output neuron is released into the global minimum while signals pulse down every link
   into it. Fidget: flick any marble around its well, pluck any link, tap a layer name. */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

const canvas = document.getElementById('landscape');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => window.innerWidth < 900;
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch (e) { canvas.style.display = 'none'; window.introSkip && window.introSkip(); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow() ? 1.5 : 2));
const scene = new THREE.Scene();
const FOV = 38, TANF = Math.tan(FOV * Math.PI / 360);
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 300);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeBack = (t) => { t = clamp(t); const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const mix = (a, b, k) => a + (b - a) * k;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ───────── the network: About (input) at the back, one layer per topic, the output neuron at the front ─────────
const HID = (window.LAYERS && window.LAYERS.length) ? window.LAYERS : [4, 8, 2, 2, 1];
const NAMES = window.LAYER_NAMES || [];
const NL = HID.length + 1;
const ZB = -12, ZF = 10; // back and front rows of the sheet
const nodes = []; const r0 = rng(7);
HID.forEach((n, k) => { for (let i = 0; i < n; i++) nodes.push({ k, i, n, ph: r0() * 6.28, s1: r0(), s2: r0(), s3: r0(), f1: r0(), f2: r0(), f3: r0(), size: 0.9 + r0() * 0.25, lit: 0, alpha: 0, flashT: -9, dd: k === 0 ? 0.9 : 1.3, ds: 1.1, R: 1.5, om: 2.6, mu: 1.1 }); });
nodes.push({ k: NL - 1, i: 0, n: 1, ph: 0, s1: 0.5, s2: 0.5, s3: 0.5, f1: 0.5, f2: 0.5, f3: 0.6, size: 1.3, out: true, lit: 0, alpha: 0, flashT: -9, dd: 3.4, ds: 2.6, R: 3.2, om: 1.7, mu: 1.0 });
const OUT = nodes.length - 1, outNd = nodes[OUT];
const byLayer = Array.from({ length: NL }, (_, k) => nodes.filter(nd => nd.k === k));
nodes.forEach(nd => { nd.slot = new THREE.Vector3(); nd.from = new THREE.Vector3(); nd.rim = new THREE.Vector3(); nd.m = { u: 0, v: 0, du: 0, dv: 0, on: false }; const a = nd.f1 * 6.2832; nd.dirx = Math.cos(a); nd.dirz = Math.sin(a); nd.dir = new THREE.Vector3((nd.f1 - 0.5) * 2, 0.8 + nd.f3, (nd.f2 - 0.5) * 2).normalize(); nd.stagger = nd.k * 0.12 + nd.f3 * 0.3; });
if (outNd) { outNd.dirx = narrow() ? 0.95 : 0.55; outNd.dirz = narrow() ? -0.3 : -0.83; }
function slotOf(nd, out) {
  const { k, i, n } = nd; const L = NL - 1; const zk = ZB + (ZF - ZB) * k / L;
  const gx = narrow() ? (n > 5 ? 1.3 : 2.0) : (n > 5 ? 2.4 : 3.2);
  if (nd.out) return out.set(0, 0, ZF);
  return out.set((i - (n - 1) / 2) * gx + (nd.s3 - 0.5) * 0.5, 0, zk + (nd.s2 - 0.5) * 1.4);
}
function relayout() { nodes.forEach(nd => { slotOf(nd, nd.slot); nd.rim.set(nd.slot.x + nd.R * nd.dirx, 0, nd.slot.z + nd.R * nd.dirz); nd.from.set((nd.f1 - 0.5) * 70, 4 + nd.f2 * 22, 34 + nd.f3 * 18); }); }
relayout();
const edges = [];
for (let k = 0; k < NL - 1; k++) byLayer[k].forEach(a => byLayer[k + 1].forEach(b => { const r = rng(1000 + edges.length); edges.push({ a: nodes.indexOf(a), b: nodes.indexOf(b), k: k + 1, bend: new THREE.Vector3((r() - 0.5) * 0.6, 0.9 + r() * 1.3, (r() - 0.5) * 0.6), wob: new THREE.Vector3(), wv: new THREE.Vector3(), alpha: 0 }); }));
const outEdges = edges.map((e, i) => i).filter(i => nodes[edges[i].b].out);

// ───────── meshes ─────────
const net = new THREE.Group(); scene.add(net);
const nodeGeo = new THREE.SphereGeometry(0.19, 28, 28);
nodes.forEach(nd => { nd.mesh = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 })); nd.mesh.renderOrder = nd.out ? 4 : 2; net.add(nd.mesh); });
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false })); glow.scale.setScalar(1.8); glow.renderOrder = 3; net.add(glow);
const SEGS = 8; const ePos = new Float32Array(edges.length * SEGS * 6), eCol = new Float32Array(edges.length * SEGS * 6);
const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3)); eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
const eLines = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false })); eLines.frustumCulled = false; eLines.renderOrder = 1; net.add(eLines);
const _q = new THREE.Vector3();
function bez(A, B, ed, t, out) { // quadratic bezier arching over the sheet: control point at the midpoint plus the link's bend and its fidget wobble
  _q.lerpVectors(A, B, 0.5).add(ed.bend).add(ed.wob); const u = 1 - t;
  return out.set(u * u * A.x + 2 * u * t * _q.x + t * t * B.x, u * u * A.y + 2 * u * t * _q.y + t * t * B.y, u * u * A.z + 2 * u * t * _q.z + t * t * B.z);
}
const NP = 132, NPO = 24; const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(NP * 3); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pulse = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.1, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); pulse.frustumCulled = false; pulse.renderOrder = 3; net.add(pulse);
const pEdge = (() => { const r = rng(9); return Array.from({ length: NP }, (_, i) => i < NP - NPO ? Math.floor(r() * edges.length) : outEdges[(i - (NP - NPO)) % outEdges.length]); })();

// layer names at the left end of each row
const labelHost = document.getElementById('llabels'); const labels = [];
if (labelHost) for (let k = 0; k < NL; k++) { const el = document.createElement('span'); el.className = 'llabel'; el.textContent = NAMES[k] || (k === NL - 1 ? 'Output' : 'Layer ' + k); el.addEventListener('pointerdown', () => joltLayer(k)); labelHost.appendChild(el); labels.push(el); }

// ───────── the sheet: a flat grid that every resting neuron dents; the output's dent is the global minimum ─────────
const SX = 30, ZN = -46, ZX = 24, NX = 56, NZ = 56;
const NV = (NX + 1) * (NZ + 1); const gx = new Float32Array(NV), gz = new Float32Array(NV);
for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const v = j * (NX + 1) + i; gx[v] = -SX + 2 * SX * i / NX; gz[v] = ZN + (ZX - ZN) * j / NZ; }
const segA = [], segB = []; for (let j = 0; j <= NZ; j++) for (let i = 0; i < NX; i++) { segA.push(j * (NX + 1) + i); segB.push(j * (NX + 1) + i + 1); } for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) { segA.push(j * (NX + 1) + i); segB.push((j + 1) * (NX + 1) + i); }
const NSEG = segA.length; const sPos = new Float32Array(NSEG * 6), sCol = new Float32Array(NSEG * 6); const vh = new Float32Array(NV);
const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
const sheet = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthTest: false, depthWrite: false })); sheet.frustumCulled = false; sheet.renderOrder = -4; sheet.visible = false; scene.add(sheet);
const minGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); minGlow.scale.setScalar(9); minGlow.renderOrder = -5; scene.add(minGlow);
const dents = []; // rebuilt every frame: { x, z, a, inv, r3 }
function sheetH(x, z) { let h = 0; for (let i = 0; i < dents.length; i++) { const d = dents[i]; const dx = x - d.x, dz = z - d.z; if (dx > d.r3 || dx < -d.r3 || dz > d.r3 || dz < -d.r3) continue; h -= d.a * Math.exp(-(dx * dx + dz * dz) * d.inv); } return h; }
let fallS = 0;
// marble physics in the sheet plane: a damped harmonic well around the local minimum, released at the rim with a sideways roll
function launch(nd) { const m = nd.m, R = nd.R; m.u = R * nd.dirx; m.v = R * nd.dirz; m.du = -nd.dirz * 0.62 * nd.om * R - nd.dirx * 0.5; m.dv = nd.dirx * 0.62 * nd.om * R - nd.dirz * 0.5; m.on = true; }
function stepMarble(nd, dt) { const m = nd.m; for (let s = 0; s < 2; s++) { const h = dt / 2; m.du += (-nd.om * nd.om * m.u - nd.mu * m.du) * h; m.dv += (-nd.om * nd.om * m.v - nd.mu * m.dv) * h; m.u += m.du * h; m.v += m.dv * h; const rr = Math.hypot(m.u, m.v), rmax = nd.R * 1.25; if (rr > rmax) { const k = rmax / rr; m.u *= k; m.v *= k; const nu = m.u / rr, nv = m.v / rr, vn = m.du * nu + m.dv * nv; if (vn > 0) { m.du -= 1.5 * vn * nu; m.dv -= 1.5 * vn * nv; } } } }

// ───────── colours ─────────
const C = { node: new THREE.Color(), node2: new THREE.Color(), scaf: new THREE.Color(), bg: new THREE.Color(), edge: new THREE.Color(), well: new THREE.Color() };
function theme() {
  const dark = (window.currentTheme ? window.currentTheme() : 'light') === 'dark';
  C.node.set(dark ? '#7fb0ff' : '#4b8cf7'); C.node2.set(dark ? '#dbe9ff' : '#a9cdff'); C.scaf.set(dark ? '#4a608f' : '#b7cbea'); C.bg.set(dark ? '#0c1020' : '#fafbfd'); C.edge.set(dark ? '#5e80bf' : '#9db9ea'); C.well.set(dark ? '#3f6fd0' : '#8fb6f6');
  glow.material.color.copy(C.node2); pulse.material.color.copy(dark ? C.node2 : C.node); minGlow.material.color.copy(dark ? C.well : C.node2);
}
window.addEventListener('themechange', theme);

// ───────── camera ─────────
const want = { pos: new THREE.Vector3(), target: new THREE.Vector3() }, camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();
const alt = { pos: new THREE.Vector3(), target: new THREE.Vector3() }, lp0 = { pos: new THREE.Vector3(), target: new THREE.Vector3() }, lp1 = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
function poseWide(out, k) { k = k || 1; if (narrow()) { out.target.set(0, -3, -4); out.pos.set(0, 17 * k, 30 * k); } else { out.target.set(0, -0.5, -2); out.pos.set(0, 13 * k, 23 * k); } return out; }
function layerPose(k, out) { // zoom onto one row: closer for small rows, framed so the cards do not cover it
  const col = byLayer[clamp(k, 0, NL - 1)]; let cz = 0, cx = 0, right = -1e9; col.forEach(nd => { cz += nd.slot.z; cx += nd.slot.x; right = Math.max(right, nd.slot.x); }); cz /= col.length; cx /= col.length;
  const n = col.length; const L = (narrow() ? 9 + 2.0 * (n - 1) : 12 + 2.4 * (n - 1)); const hw = L * TANF * camera.aspect;
  if (narrow()) { out.target.set(cx, -2.6, cz - 2); out.pos.set(cx, -2.6 + 0.7 * L, cz - 2 + 0.75 * L); }
  else { const fr = 0.28 + 0.22 * clamp((n - 1) / 7); const tx = right + (0.5 - fr) * 2 * hw; out.target.set(tx, -0.5, cz - 1); out.pos.set(tx, -0.5 + 0.55 * L, cz - 1 + 0.84 * L); } // the row's right end sits at screen fraction fr, clear of the cards
  return out;
}
function poseLayer(out, kf) { const k0 = Math.floor(kf), f = kf - k0; layerPose(k0, lp0); layerPose(Math.min(NL - 1, k0 + 1), lp1); out.pos.lerpVectors(lp0.pos, lp1.pos, f); out.target.lerpVectors(lp0.target, lp1.target, f); return out; }
function poseFinal(out) { const g = outNd.slot; if (narrow()) { out.target.set(g.x, -3, g.z + 3); out.pos.set(g.x, 20, g.z + 16); } else { out.target.set(g.x + 3.5, -1.5, g.z - 3); out.pos.set(g.x + 3.5, 11, g.z + 15); } return out; }
function screenToWorldY(sx, sy, yPlane) { const v = new THREE.Vector3((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5).unproject(camera); const d = v.sub(camera.position).normalize(); let t = (yPlane - camera.position.y) / d.y; if (!(t > 0.5)) t = 12; return camera.position.clone().addScaledVector(d, t); }
const lerpPose = (a, b, k) => { a.pos.lerp(b.pos, k); a.target.lerp(b.target, k); };
const _s = new THREE.Vector3(); function toScreen(v, out) { _s.copy(v).project(camera); out.x = (_s.x + 1) / 2 * window.innerWidth; out.y = (1 - _s.y) / 2 * window.innerHeight; return out; }

// ───────── intro state ─────────
let introT0 = null, introDone = false, introSkipped = false;
const ui = document.getElementById('intro-ui'), capEl = document.getElementById('intro-cap');
const CAPS = ['Initialising weights…', 'Warming up the neurons…', 'Propagating…'];
function finishIntro() { if (introDone) return; introDone = true; nodes.forEach(nd => { nd.m.on = false; nd.m.u = nd.m.v = nd.m.du = nd.m.dv = 0; }); document.documentElement.classList.remove('intro'); document.documentElement.classList.add('ready'); if (ui) { ui.classList.add('out'); setTimeout(() => ui.remove(), 700); } window.dispatchEvent(new CustomEvent('introdone')); }
window.introSkip = () => { introSkipped = true; finishIntro(); };
document.getElementById('intro-skip')?.addEventListener('click', window.introSkip);

// ───────── pointer: parallax, gentle response, and fidget (always on wherever the network is) ─────────
const ptr = { x: 0, y: 0, nx: 0, ny: 0, active: false, t: 0 }; let ptrDown = false, lastPtr = null;
window.addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.nx = (e.clientX / window.innerWidth) * 2 - 1; ptr.ny = (e.clientY / window.innerHeight) * 2 - 1; ptr.active = e.pointerType !== 'touch'; ptr.t = performance.now(); }, { passive: true });
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const _sb = { x: 0, y: 0 }, _sa = { x: 0, y: 0 };
const camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
function hitTest(sx, sy) {
  ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const vis = []; nodes.forEach(nd => { if (nd.mesh.visible && nd.alpha > 0.08) vis.push(nd.mesh); });
  const hits = ray.intersectObjects(vis, false);
  if (hits.length) { const nd = nodes.find(n => n.mesh === hits[0].object); return nd ? { nd, point: hits[0].point } : null; }
  let best = null;
  edges.forEach(ed => { if (ed.alpha < 0.05) return; const A = nodes[ed.a].mesh.position, B = nodes[ed.b].mesh.position; const K = 5; let px = 0, py = 0;
    for (let s = 0; s <= K; s++) { bez(A, B, ed, s / K, _p); toScreen(_p, _sb); if (s > 0) { const vx2 = _sb.x - px, vy2 = _sb.y - py, L2 = vx2 * vx2 + vy2 * vy2 || 1; const tt = clamp(((sx - px) * vx2 + (sy - py) * vy2) / L2); const d = Math.hypot(px + vx2 * tt - sx, py + vy2 * tt - sy); if (d < 13 && (!best || d < best.d)) best = { ed, d, t: (s - 1 + tt) / K }; } px = _sb.x; py = _sb.y; } });
  return best;
}
function flick(nd, dx, dz, strength) { const m = nd.m; if (!m.on) { m.on = true; } m.du += dx * 3.2 * strength + (Math.random() - 0.5) * 0.4 * strength; m.dv += dz * 3.2 * strength + (Math.random() - 0.5) * 0.4 * strength; }
function nudge(h, strength) {
  if (!h) return;
  if (h.nd) { const nd = h.nd; const dir = _a.copy(nd.mesh.position).sub(h.point); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0); dir.normalize(); flick(nd, dir.x, dir.z, strength); return; }
  const ed = h.ed, A = nodes[ed.a], B = nodes[ed.b]; const j = (Math.random() < 0.5 ? -1 : 1) * 2.6 * strength;
  ed.wv.addScaledVector(camUp, j).addScaledVector(camRight, (Math.random() - 0.5) * 1.4 * strength);
  if (A.m.on) flick(A, (Math.random() - 0.5), (Math.random() - 0.5), 0.25 * strength * (1 - h.t)); if (B.m.on) flick(B, (Math.random() - 0.5), (Math.random() - 0.5), 0.25 * strength * h.t);
}
function joltLayer(k) { (byLayer[k] || []).forEach(nd => { if (nd.m.on) flick(nd, Math.random() - 0.5, Math.random() - 0.5, 1.4); }); edges.forEach(ed => { if (ed.k === k || ed.k === k + 1) ed.wv.addScaledVector(camUp, (Math.random() - 0.5) * 2.5); }); }
canvas.addEventListener('pointermove', (e) => { if (!lastPtr || Math.hypot(e.clientX - lastPtr.x, e.clientY - lastPtr.y) > 4) { const h = hitTest(e.clientX, e.clientY); canvas.style.cursor = h ? 'pointer' : ''; if (h) nudge(h, ptrDown ? 0.9 : 0.25); lastPtr = { x: e.clientX, y: e.clientY }; } });
canvas.addEventListener('pointerdown', (e) => { ptrDown = true; nudge(hitTest(e.clientX, e.clientY), 1.6); });
canvas.addEventListener('pointerleave', () => { canvas.style.cursor = ''; });
window.addEventListener('pointerup', () => { ptrDown = false; });

// ───────── per-frame ─────────
const T = () => window.T || { phase: 'hero', finalU: 0, heroK: 1, scaf: 0, curK: -1, camWide: 1 };
let lastNow = 0, camInit = false, lastW = 0, lastH = 0, par = { x: 0, y: 0 };
const tmpC = new THREE.Color();
function update(now) {
  const t = now / 1000, dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60; lastNow = now;
  const tj = T(), NODES = window.NODES || [];
  const fin = (introDone && tj.phase === 'final') ? tj.finalU : 0; const finA = smooth(fin / 0.3);
  const home = introDone && (tj.heroK || 0) > 0.5;
  if (window.innerWidth !== lastW || window.innerHeight !== lastH) { lastW = window.innerWidth; lastH = window.innerHeight; relayout(); }
  let it = 99, dis = 0, scaf = introDone ? (tj.scaf || 0) : 0, edgeK = () => 1, pulseA = 0, litK = () => 0, introSheet = 0;
  if (!introDone) {
    if (introT0 === null) introT0 = t; it = reduced || introSkipped ? 99 : t - introT0;
    nodes.forEach(nd => { nd.fly = easeBack((it - 0.1 - nd.stagger) / 1.35); if (nd.fly >= 1 && !nd.m.on) { nd.m.on = true; nd.m.u = nd.m.v = nd.m.du = nd.m.dv = 0; } });
    edgeK = (k) => clamp((it - 1.3 - (k - 1) * 0.12) / 0.5);
    const pu = clamp((it - 2.55) / 1.0); litK = (k) => pu > 0 && pu < 1 ? Math.max(0, 1 - Math.abs(pu * (NL + 1.6) - k - 0.5) * 1.2) : 0; pulseA = pu > 0 && pu < 1 ? 0.9 : 0;
    dis = smooth((it - 3.55) / 0.8); introSheet = smooth((it - 0.4) / 1.2) * (1 - dis);
    poseWide(want, 1.16 - 0.16 * smooth(it / 2.8));
    if (capEl) { const c = CAPS[Math.min(CAPS.length - 1, Math.floor(it / 1.2))]; if (capEl.textContent !== c) capEl.textContent = c; }
    if (it >= 3.65 && !document.documentElement.classList.contains('ready')) document.documentElement.classList.add('ready');
    if (it >= 4.4) finishIntro();
    window.__it = it;
  } else {
    nodes.forEach(nd => { nd.fly = 1; });
    if (fin > 0) { poseWide(want); poseFinal(alt); lerpPose(want, alt, smooth((fin - 0.1) / 0.32)); }
    else if (tj.phase === 'sec') { poseLayer(want, (tj.kf || 0) + 1); poseWide(alt); lerpPose(want, alt, clamp(tj.camWide == null ? 0 : tj.camWide)); }
    else poseWide(want);
  }
  // pointer parallax (desktop only), stronger on the opening views
  const parS = narrow() || !ptr.active ? 0 : (!introDone || home ? 0.9 : fin > 0 ? 0.25 : 0.3);
  par.x += (ptr.nx * parS - par.x) * (1 - Math.exp(-dt * 3)); par.y += (ptr.ny * parS - par.y) * (1 - Math.exp(-dt * 3));
  want.pos.x += par.x * 0.9; want.pos.y -= par.y * 0.5; want.target.x += par.x * 0.4; want.target.y -= par.y * 0.2;
  if (!camInit) { camPos.copy(want.pos); camTarget.copy(want.target); camInit = true; }
  const kc = reduced ? 1 : 1 - Math.exp(-dt * (introDone ? 4.5 : 14)); camPos.lerp(want.pos, kc); camTarget.lerp(want.target, kc);
  camera.position.copy(camPos); camera.lookAt(camTarget); camera.updateMatrixWorld();
  camRight.setFromMatrixColumn(camera.matrixWorld, 0); camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  // ── lighting state per neuron, marble launches, and the dents they make ──
  const sheetK = introDone ? Math.max(scaf * 0.7, smooth((fin - 0.05) / 0.25)) : introSheet;
  const toRim = smooth((fin - 0.2) / 0.22), drop = smooth((fin - 0.42) / 0.08);
  const outK = introDone ? smooth(fin / 0.2) : 0;
  if (introDone) {
    nodes.forEach(nd => {
      let lit;
      if (nd.out) { lit = outK; if (drop > 0.01 && !nd.m.on) launch(nd); if (drop <= 0.01) nd.m.on = false; }
      else { const rec = (NODES[nd.k] || [])[nd.i]; lit = rec ? rec.b : 0; if (lit >= 0.98 && !nd.m.on) launch(nd); if (lit < 0.98) nd.m.on = false; }
      if (lit >= 0.98 && nd.lit < 0.98) nd.flashT = t; nd.lit = lit;
    });
  } else nodes.forEach(nd => { nd.lit = clamp(nd.fly); });
  nodes.forEach(nd => { if (nd.m.on) stepMarble(nd, dt); else { nd.m.u = nd.m.v = nd.m.du = nd.m.dv = 0; } });
  fallS += (((outNd.m.on ? clamp(1 - Math.hypot(outNd.m.u, outNd.m.v) / outNd.R) : 0) * drop) - fallS) * (1 - Math.exp(-dt * 3));
  dents.length = 0;
  nodes.forEach(nd => {
    const dk = introDone ? (nd.out ? smooth((fin - 0.05) / 0.3) * (0.3 + 0.7 * fallS) : smooth((nd.lit - 0.55) / 0.45)) : clamp(nd.fly) * (1 - dis);
    nd.dentK = dk; if (dk < 0.01) return;
    dents.push({ x: nd.slot.x, z: nd.slot.z, a: nd.dd * dk, inv: 1 / (2 * nd.ds * nd.ds), r3: 3 * nd.ds });
    if (nd.m.on) dents.push({ x: nd.slot.x + nd.m.u, z: nd.slot.z + nd.m.v, a: 0.3 * nd.size * dk, inv: 1 / (2 * 0.55 * 0.55), r3: 1.7 }); // the marble's own mass
  });
  // ── the sheet ──
  sheet.visible = sheetK > 0.003; minGlow.position.set(outNd.slot.x, -1.2, outNd.slot.z); minGlow.material.opacity = 0.4 * (outNd.dentK || 0) * sheetK;
  if (sheet.visible) {
    for (let v = 0; v < NV; v++) vh[v] = sheetH(gx[v], gz[v]);
    for (let s = 0; s < NSEG; s++) { const a = segA[s], b = segB[s], o = s * 6; sPos[o] = gx[a]; sPos[o + 1] = vh[a]; sPos[o + 2] = gz[a]; sPos[o + 3] = gx[b]; sPos[o + 4] = vh[b]; sPos[o + 5] = gz[b];
      for (let e = 0; e < 2; e++) { const h = -(e ? vh[b] : vh[a]); const far = clamp(1 - ((e ? gz[b] : gz[a]) - ZN) / 14); tmpC.copy(C.bg).lerp(C.edge, sheetK * (0.16 + 0.42 * clamp(h / 1.6)) * (1 - 0.8 * far)).lerp(C.node, 0.45 * clamp(h / 3.2) * clamp(h / 3.2) * sheetK); const oo = o + e * 3; sCol[oo] = tmpC.r; sCol[oo + 1] = tmpC.g; sCol[oo + 2] = tmpC.b; } }
    sGeo.attributes.position.needsUpdate = true; sGeo.attributes.color.needsUpdate = true;
  }
  // ── neurons ──
  const hoverOn = ptr.active && (performance.now() - ptr.t) < 1500; const hoverS = (!introDone || home) ? 1.2 : 0.6;
  nodes.forEach(nd => {
    const m = nd.mesh; const p = _a.copy(nd.slot); let alpha = 0, sc = 1; const lit = nd.lit; const rad = 0.19 * nd.size;
    const rest = () => { p.set(nd.slot.x + nd.m.u, 0, nd.slot.z + nd.m.v); p.y = sheetH(p.x, p.z) + rad * 1.05; };
    if (!introDone) { if (nd.m.on) rest(); else { p.copy(nd.slot); p.y += rad; p.lerpVectors(nd.from, p, nd.fly); } p.addScaledVector(nd.dir, dis * 3); alpha = clamp(nd.fly * 2) * (1 - dis); sc = (0.4 + 0.6 * clamp(nd.fly)) * (1 - 0.6 * dis); }
    else if (nd.out) { alpha = Math.max(scaf * 0.36, outK); sc = 0.55 + 0.45 * outK;
      p.y = 0.6; if (fin > 0) { _b.copy(nd.rim); _b.y = 0.6 + sheetH(_b.x, _b.z) * 0.3; p.lerp(_b, toRim); if (nd.m.on) { const q = _p; q.set(nd.slot.x + nd.m.u, 0, nd.slot.z + nd.m.v); q.y = sheetH(q.x, q.z) + rad * 1.05; p.lerp(q, drop); } sc = (1 + 0.35 * drop) * (0.55 + 0.45 * outK); } }
    else { const rec = (NODES[nd.k] || [])[nd.i]; alpha = scaf * (0.36 + 0.64 * lit); sc = 0.5 + 0.5 * lit;
      if (nd.m.on) rest();
      else if (rec && lit > 0) { const w = screenToWorldY(rec.sx, rec.sy, 3.5); const e = smooth(lit / 0.98); _b.copy(nd.rim); _b.y = sheetH(_b.x, _b.z) + rad * 1.05; p.lerpVectors(w, _b, e); p.y += Math.sin(e * Math.PI) * 1.6; }
      else p.y = 0.6; }
    const flash = Math.max(0, 0.5 * Math.exp(-(t - nd.flashT) * 3));
    // gentle hover float for anything not resting in its well
    if (!nd.m.on) { const fl = clamp(nd.fly) * (1 + 1.2 * finA); p.x += Math.sin(t * 0.9 + nd.ph) * 0.05 * fl; p.y += Math.sin(t * 1.3 + nd.ph * 1.7) * 0.06 * fl; p.z += Math.cos(t * 0.7 + nd.ph) * 0.05 * fl; }
    sc *= nd.size * (1 + flash);
    if (hoverOn && m.visible && alpha > 0.08 && nd.m.on) { toScreen(m.position, _sa); const d = Math.hypot(_sa.x - ptr.x, _sa.y - ptr.y); if (d < 110 && d > 0.5) { const f = (1 - d / 110) * hoverS * dt; _b.copy(camRight).multiplyScalar((_sa.x - ptr.x) / d).addScaledVector(camUp, -(_sa.y - ptr.y) / d); nd.m.du += _b.x * f * 2.5; nd.m.dv += _b.z * f * 2.5; } }
    m.position.copy(p);
    const l = introDone ? 0 : litK(nd.k); m.material.color.copy(C.scaf).lerp(C.node, lit).lerp(C.node2, l); m.scale.setScalar(sc * (1 + 0.55 * l)); m.material.opacity = alpha; m.visible = alpha > 0.01; nd.alpha = alpha;
  });
  glow.position.copy(outNd.mesh.position); glow.material.opacity = outK * (0.5 + 0.2 * drop); glow.scale.setScalar(1.6 + 1.8 * drop);
  // ── links: faint scaffold, lit progressively from source to target as the target neuron arrives; wobble springs ──
  edges.forEach((ed, e) => {
    if (ed.wv.lengthSq() > 1e-8 || ed.wob.lengthSq() > 1e-8) { ed.wv.addScaledVector(ed.wob, -20 * dt); ed.wv.multiplyScalar(Math.exp(-dt * 2.6)); ed.wob.addScaledVector(ed.wv, dt); if (ed.wob.length() > 1.3) ed.wob.setLength(1.3); if (ed.wob.lengthSq() < 1e-6 && ed.wv.lengthSq() < 1e-6) { ed.wob.set(0, 0, 0); ed.wv.set(0, 0, 0); } }
    const A = nodes[ed.a], B = nodes[ed.b]; const both = A.mesh.visible && B.mesh.visible;
    const la = introDone ? Math.min(A.lit, B.lit) : edgeK(ed.k); const len = introDone ? 1 : la;
    const base = B.out ? Math.max(scaf, outK * 0.9) : scaf;
    ed.alpha = both ? (introDone ? base * (0.09 + 0.38 * la) : 0.46 * la * (1 - dis)) : 0;
    for (let s = 0; s < SEGS; s++) {
      const t0 = Math.min(len, s / SEGS), t1 = Math.min(len, (s + 1) / SEGS); bez(A.mesh.position, B.mesh.position, ed, t0, _a); bez(A.mesh.position, B.mesh.position, ed, t1, _b);
      const o = (e * SEGS + s) * 6; ePos[o] = _a.x; ePos[o + 1] = _a.y; ePos[o + 2] = _a.z; ePos[o + 3] = _b.x; ePos[o + 4] = _b.y; ePos[o + 5] = _b.z;
      const al = !both ? 0 : introDone ? base * (0.09 + 0.38 * clamp(la * (SEGS + 1.5) - s)) : 0.46 * (1 - dis);
      tmpC.copy(C.bg).lerp(C.edge, al); eCol[o] = eCol[o + 3] = tmpC.r; eCol[o + 1] = eCol[o + 4] = tmpC.g; eCol[o + 2] = eCol[o + 5] = tmpC.b;
    }
  });
  eGeo.attributes.position.needsUpdate = true; eGeo.attributes.color.needsUpdate = true;
  // ── signals: the forward pass during the intro; afterwards signals travel forward along every lit link, and in the finale they pour into the global minimum ──
  if (!introDone) { if (pulseA > 0) { const pu = clamp((it - 2.55) / 1.0); for (let i = 0; i < NP; i++) { const ed = edges[pEdge[i]]; const s = clamp(pu * (NL + 1.6) - ed.k + 1 - (i % 7) * 0.05); bez(nodes[ed.a].mesh.position, nodes[ed.b].mesh.position, ed, s, _p); pPos[i * 3] = _p.x; pPos[i * 3 + 1] = _p.y; pPos[i * 3 + 2] = _p.z; } pGeo.attributes.position.needsUpdate = true; } pulse.material.opacity = pulseA; }
  else { const sp = 0.22 * (1 + 1.2 * finA); for (let i = 0; i < NP; i++) { const ed = edges[pEdge[i]]; const A = nodes[ed.a], B = nodes[ed.b]; if (Math.min(A.lit, B.lit) > 0.97 && A.mesh.visible && B.mesh.visible) { const s = (t * sp * (0.7 + (i % 5) * 0.15) + i * 0.137) % 1; bez(A.mesh.position, B.mesh.position, ed, s, _p); pPos[i * 3] = _p.x; pPos[i * 3 + 1] = _p.y; pPos[i * 3 + 2] = _p.z; } else { pPos[i * 3] = 0; pPos[i * 3 + 1] = 1e4; pPos[i * 3 + 2] = 0; } } pGeo.attributes.position.needsUpdate = true; pulse.material.opacity = Math.max(0.55 * scaf, 0.85 * finA); pulse.material.size = 0.1 + 0.05 * finA; }
  // ── layer names at the left end of each row ──
  if (labels.length) labels.forEach((el, k) => { const col = byLayer[k]; let cz = 0, minx = 1e9, ll = 0; col.forEach(nd => { cz += nd.slot.z; minx = Math.min(minx, nd.slot.x); ll += nd.lit; }); cz /= col.length; ll /= col.length;
    _p.set(minx - (narrow() ? 1.2 : 1.8), 0.1, cz); toScreen(_p, _sa);
    const op = introDone ? scaf * (0.45 + 0.5 * ll) * (1 - 0.8 * finA) : 0; el.style.transform = `translate(${_sa.x.toFixed(1)}px, ${_sa.y.toFixed(1)}px) translate(-100%, -50%)`; el.style.opacity = op.toFixed(3); el.classList.toggle('on', (tj.curK + 1) === k && op > 0.1); el.style.pointerEvents = op > 0.2 ? 'auto' : 'none'; });
  renderer.render(scene, camera);
  window.__ball = outNd.mesh.position.clone().project(camera);
  window.__cam = { z: +camera.position.z.toFixed(2), x: +camera.position.x.toFixed(2), y: +camera.position.y.toFixed(2) }; window.__well = { depth: +(outNd.dentK || 0).toFixed(3), sheet: +sheetK.toFixed(3), fall: +fallS.toFixed(3), r: +Math.hypot(outNd.m.u, outNd.m.v).toFixed(3), dents: dents.length };
  window.__nodeOff = nodes.map(n => +Math.hypot(n.m.u, n.m.v).toFixed(3)); window.__marble = { u: +outNd.m.u.toFixed(3), v: +outNd.m.v.toFixed(3), on: outNd.m.on }; window.__edgeWob = edges.map(e => +e.wob.length().toFixed(3));
  window.__screen = (i) => { const v = nodes[i].mesh.position.clone().project(camera); return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, vis: nodes[i].mesh.visible, alpha: +nodes[i].alpha.toFixed(2), on: nodes[i].m.on }; };
  window.__edgeMid = (e) => { const ed = edges[e]; bez(nodes[ed.a].mesh.position, nodes[ed.b].mesh.position, ed, 0.5, _p); const o = { x: 0, y: 0 }; toScreen(_p, o); o.alpha = +ed.alpha.toFixed(2); return o; };
}
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); relayout(); }
window.addEventListener('resize', resize);
theme(); resize();
let running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(loop); });
function loop(now) { if (!running) return; update(now); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
