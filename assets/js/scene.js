/* The network is the CV.
   Intro: every neuron flies in from behind you, the whole network wires up across the screen and fires once,
   then dissolves into the home page. Reading: a faint scaffold of the same network sits behind the cards;
   as each card slides past, its neuron rises out of the text, glides into its layer and lights its links.
   The profile is the input layer, every topic is a hidden layer, Contact is the output neuron.
   Contact: everything else fades, the output neuron drops into a gradient well and rolls to the global
   minimum with marble physics. Fidget: poke any neuron, pluck any link, tap a layer name, flick the marble. */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

const canvas = document.getElementById('landscape');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => window.innerWidth < 900;
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch (e) { canvas.style.display = 'none'; window.introSkip && window.introSkip(); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow() ? 1.5 : 2));
const scene = new THREE.Scene();
const FOV = 38, D = 20;
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 200);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeBack = (t) => { t = clamp(t); const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ───────── the network: input layer (profile), one hidden layer per topic, one output neuron ─────────
const HID = (window.LAYERS && window.LAYERS.length) ? window.LAYERS : [4, 3, 3, 3, 3, 3, 3, 2];
const NAMES = window.LAYER_NAMES || [];
const NL = HID.length + 1;
const nodes = []; const r0 = rng(7);
HID.forEach((n, k) => { for (let i = 0; i < n; i++) nodes.push({ k, i, n, ph: r0() * 6.28, s1: r0(), s2: r0(), s3: r0(), f1: r0(), f2: r0(), f3: r0(), size: 0.9 + r0() * 0.25, lit: 0, alpha: 0, flashT: -9 }); });
nodes.push({ k: NL - 1, i: 0, n: 1, ph: 0, s1: 0.5, s2: 0.5, s3: 0.5, f1: 0.5, f2: 0.5, f3: 0.6, size: 1.25, out: true, lit: 0, alpha: 0, flashT: -9 });
const OUT = nodes.length - 1;
const byLayer = Array.from({ length: NL }, (_, k) => nodes.filter(nd => nd.k === k));
const frustum = () => { const hh = D * Math.tan(FOV * Math.PI / 360); return { hh, hw: hh * camera.aspect }; };
let spreadK = 1; // 1 = the intro fills the whole screen; 0 = the reading layout, clear of the header, the layer names and (on phones) the cards
const mix = (a, b, k) => a + (b - a) * k;
function slotOf(nd, out) {
  const { hh, hw } = frustum(); const { k, i, n } = nd; const L = NL - 1; const sk = spreadK;
  const jx = (nd.s3 - 0.5) * 0.5, jy = (nd.s1 - 0.5) * 0.7, jz = (nd.s2 - 0.5) * 3;
  if (narrow()) {
    const yTop = mix(0.66, 0.84, sk) * hh, yBot = mix(0.2, -0.84, sk) * hh; const y = yTop + (yBot - yTop) * k / L;
    const xa = mix(-0.42, -0.92, sk), xb = mix(0.86, 0.92, sk); const fx = nd.out ? 0.5 : (i + 0.5) / n;
    return out.set((xa + (xb - xa) * fx) * hw + jx * 0.3, y + jy * 0.18, jz * 0.5);
  }
  const x = (k / L - 0.5) * mix(1.7, 1.86, sk) * hw, yTop = mix(0.56, 0.86, sk) * hh, yBot = mix(-0.62, -0.84, sk) * hh;
  return out.set(x + jx, nd.out ? (yTop + yBot) / 2 : yTop + (yBot - yTop) * (i + 0.5) / n + jy * mix(1, 1.4, sk), jz);
}
nodes.forEach(nd => { nd.slot = new THREE.Vector3(); nd.from = new THREE.Vector3(); nd.dir = new THREE.Vector3((nd.f1 - 0.5) * 2, (nd.f2 - 0.5) * 2, 0.8 + nd.f3).normalize(); nd.stagger = nd.k * 0.1 + nd.f3 * 0.3; });
function relayout() { const { hh, hw } = frustum(); nodes.forEach(nd => { slotOf(nd, nd.slot); nd.from.set((nd.f1 - 0.5) * 3.4 * hw, (nd.f2 - 0.5) * 3.4 * hh, D + 3 + nd.f3 * 14); }); }
const edges = [];
for (let k = 0; k < NL - 1; k++) byLayer[k].forEach(a => byLayer[k + 1].forEach(b => { const r = rng(1000 + edges.length); edges.push({ a: nodes.indexOf(a), b: nodes.indexOf(b), k: k + 1, bend: new THREE.Vector3((r() - 0.5) * 0.5, (r() - 0.5) * 1.1, (r() - 0.5) * 1.6), wob: new THREE.Vector3(), wv: new THREE.Vector3(), alpha: 0 }); }));

// ───────── meshes ─────────
const net = new THREE.Group(); scene.add(net);
const nodeGeo = new THREE.SphereGeometry(0.17, 28, 28);
nodes.forEach(nd => { nd.mesh = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 })); nd.mesh.renderOrder = nd.out ? 4 : 2; nd.off = new THREE.Vector3(); nd.vel = new THREE.Vector3(); net.add(nd.mesh); });
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false })); glow.scale.setScalar(1.6); net.add(glow);
const SEGS = 8; const ePos = new Float32Array(edges.length * SEGS * 6), eCol = new Float32Array(edges.length * SEGS * 6);
const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3)); eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
const eLines = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false })); eLines.frustumCulled = false; eLines.renderOrder = 1; net.add(eLines);
const _q = new THREE.Vector3();
function bez(A, B, ed, t, out) { // quadratic bezier: control point at the midpoint plus the link's bend and its fidget wobble
  _q.lerpVectors(A, B, 0.5).add(ed.bend).add(ed.wob); const u = 1 - t;
  return out.set(u * u * A.x + 2 * u * t * _q.x + t * t * B.x, u * u * A.y + 2 * u * t * _q.y + t * t * B.y, u * u * A.z + 2 * u * t * _q.z + t * t * B.z);
}
const NP = Math.min(edges.length, 120); const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(NP * 3); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pulse = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, transparent: true, opacity: 0, depthWrite: false })); pulse.frustumCulled = false; pulse.renderOrder = 3; net.add(pulse);
const pEdge = (() => { const r = rng(9); return Array.from({ length: NP }, () => Math.floor(r() * edges.length)); })();

// layer names, faint, under each column (left of each row on phones)
const labelHost = document.getElementById('llabels'); const labels = [];
if (labelHost) for (let k = 0; k < NL; k++) { const el = document.createElement('span'); el.className = 'llabel'; el.textContent = NAMES[k] || (k === NL - 1 ? 'Output' : 'Layer ' + k); el.addEventListener('pointerdown', () => joltLayer(k)); labelHost.appendChild(el); labels.push(el); }

// ───────── the gradient well: a soft loss surface with a mesh over it ─────────
const well = new THREE.Group(); scene.add(well); well.visible = false;
const WR = 2.3, WA = 0.34, G = 9.0, MU = 0.8, OMEGA = Math.sqrt(2 * WA * G); const wellH = (u, v) => WA * (u * u + v * v);
let wellSurf, wellMesh, wellGlow, wellShadow, descent, descentState = [];
{ const R2 = 26, S2 = 72, sv = [], sc = [], si = [];
  for (let i = 0; i <= R2; i++) for (let j = 0; j <= S2; j++) { const r = WR * i / R2, a = j / S2 * 6.2832; sv.push(r * Math.cos(a), wellH(r, 0), r * Math.sin(a)); sc.push(0, 0, 0); }
  for (let i = 0; i < R2; i++) for (let j = 0; j < S2; j++) { const p = i * (S2 + 1) + j; si.push(p, p + S2 + 1, p + 1, p + 1, p + S2 + 1, p + S2 + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3)); g.setIndex(si);
  wellSurf = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.46, side: THREE.DoubleSide, depthWrite: false, depthTest: false })); wellSurf.renderOrder = -3; well.add(wellSurf);
  // mesh: contour rings plus radial spokes, fading toward the rim
  const mv = [], mc = [];
  const push = (r, a) => { mv.push(r * Math.cos(a), wellH(r, 0) + 0.006, r * Math.sin(a)); mc.push(1 - r / WR); };
  for (let q = 1; q <= 9; q++) { const r = WR * (0.1 + 0.9 * q / 9); for (let j = 0; j < 96; j++) { push(r, j / 96 * 6.2832); push(r, (j + 1) / 96 * 6.2832); } }
  for (let j = 0; j < 18; j++) { const a = j / 18 * 6.2832; for (let s = 0; s < 14; s++) { push(WR * (0.1 + 0.9 * s / 14), a); push(WR * (0.1 + 0.9 * (s + 1) / 14), a); } }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mv, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(mv.length), 3)); mg.userData.fade = mc;
  wellMesh = new THREE.LineSegments(mg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); wellMesh.renderOrder = -2; well.add(wellMesh);
  wellGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); wellGlow.scale.setScalar(2.6); wellGlow.position.y = 0.05; wellGlow.renderOrder = -3; well.add(wellGlow);
  wellShadow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); wellShadow.scale.setScalar(0.7); wellShadow.renderOrder = -1; well.add(wellShadow);
  const ND = narrow() ? 110 : 190; const dg = new THREE.BufferGeometry(); const dp = new Float32Array(ND * 3); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  descent = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.05, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); descent.frustumCulled = false; descent.renderOrder = -1; well.add(descent);
  const r = rng(77); descentState = Array.from({ length: ND }, () => ({ a: r() * 6.28, r: WR * (0.1 + 0.9 * r()), sp: 0.35 + r() * 0.5, dr: (r() - 0.5) * 0.8 }));
}
const marble = { u: 0, v: 0, du: 0, dv: 0, on: false }; // the output neuron's state on the well surface

// ───────── colours ─────────
const C = { node: new THREE.Color(), node2: new THREE.Color(), scaf: new THREE.Color(), bg: new THREE.Color(), edge: new THREE.Color(), well: new THREE.Color() };
function theme() {
  const dark = (window.currentTheme ? window.currentTheme() : 'light') === 'dark';
  C.node.set(dark ? '#7fb0ff' : '#4b8cf7'); C.node2.set(dark ? '#dbe9ff' : '#a9cdff'); C.scaf.set(dark ? '#4a608f' : '#b7cbea'); C.bg.set(dark ? '#0c1020' : '#fafbfd'); C.edge.set(dark ? '#5e80bf' : '#9db9ea'); C.well.set(dark ? '#3f6fd0' : '#8fb6f6');
  glow.material.color.copy(C.node2); pulse.material.color.copy(dark ? C.node2 : C.node);
  const col = wellSurf.geometry.attributes.color; const pos = wellSurf.geometry.attributes.position; const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const r = clamp(Math.hypot(pos.getX(i), pos.getZ(i)) / WR); tmp.copy(C.bg).lerp(C.well, Math.pow(1 - r, 1.7)); col.setXYZ(i, tmp.r, tmp.g, tmp.b); }
  col.needsUpdate = true;
  const mcol = wellMesh.geometry.attributes.color, fade = wellMesh.geometry.userData.fade;
  for (let i = 0; i < mcol.count; i++) { tmp.copy(C.bg).lerp(C.edge, 0.2 + 0.8 * fade[i]); mcol.setXYZ(i, tmp.r, tmp.g, tmp.b); }
  mcol.needsUpdate = true;
  wellGlow.material.color.copy(dark ? C.well : C.node2); descent.material.color.copy(dark ? C.node2 : C.node);
}
window.addEventListener('themechange', theme);

// ───────── camera ─────────
const want = { pos: new THREE.Vector3(), target: new THREE.Vector3() }, camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();
function poseMain(out, z) { out.pos.set(0, 0, z || D); out.target.set(0, 0, 0); return out; }
function poseFinal(out) { const w = well.position; if (narrow()) { out.pos.set(w.x, w.y + 4.8, w.z + 8.2); out.target.set(w.x, w.y - 1.35, w.z); } else { out.pos.set(w.x + 1.5, w.y + 4.3, w.z + 8.2); out.target.set(w.x + 2.0, w.y + 0.75, w.z); } return out; }
function screenToWorldZ0(sx, sy) { const v = new THREE.Vector3((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5).unproject(camera); const d = v.sub(camera.position).normalize(); const t = -camera.position.z / d.z; return camera.position.clone().addScaledVector(d, t); }
const lerpPose = (a, b, k) => { a.pos.lerp(b.pos, k); a.target.lerp(b.target, k); };
const alt = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
const _s = new THREE.Vector3(); function toScreen(v, out) { _s.copy(v).project(camera); out.x = (_s.x + 1) / 2 * window.innerWidth; out.y = (1 - _s.y) / 2 * window.innerHeight; return out; }

// ───────── intro state ─────────
let introT0 = null, introDone = false, introSkipped = false;
const ui = document.getElementById('intro-ui'), capEl = document.getElementById('intro-cap');
const CAPS = ['Initialising weights…', 'Warming up the neurons…', 'Propagating…'];
function finishIntro() { if (introDone) return; introDone = true; document.documentElement.classList.remove('intro'); document.documentElement.classList.add('ready'); if (ui) { ui.classList.add('out'); setTimeout(() => ui.remove(), 700); } window.dispatchEvent(new CustomEvent('introdone')); }
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
    for (let s = 0; s <= K; s++) { bez(A, B, ed, s / K, _p); toScreen(_p, _sb); if (s > 0) { const vx = _sb.x - px, vy = _sb.y - py, L2 = vx * vx + vy * vy || 1; const tt = clamp(((sx - px) * vx + (sy - py) * vy) / L2); const d = Math.hypot(px + vx * tt - sx, py + vy * tt - sy); if (d < 13 && (!best || d < best.d)) best = { ed, d, t: (s - 1 + tt) / K }; } px = _sb.x; py = _sb.y; } });
  return best;
}
function nudge(h, strength) {
  if (!h) return;
  if (h.nd) { const nd = h.nd;
    if (nd.out && marble.on) { const dir = _a.copy(h.point).sub(nd.mesh.position); marble.du += -dir.x * 3.2 * strength + (Math.random() - 0.5) * 0.5 * strength; marble.dv += -dir.z * 3.2 * strength + (Math.random() - 0.5) * 0.5 * strength; return; }
    const dir = _a.copy(h.point).sub(nd.mesh.position).normalize(); nd.vel.addScaledVector(dir, -1.7 * strength); nd.vel.y += 0.5 * strength; return; }
  const ed = h.ed, A = nodes[ed.a], B = nodes[ed.b]; const j = (Math.random() < 0.5 ? -1 : 1) * 2.6 * strength;
  ed.wv.addScaledVector(camUp, j).addScaledVector(camRight, (Math.random() - 0.5) * 1.4 * strength);
  A.vel.y += j * 0.1 * (1 - h.t); B.vel.y += j * 0.1 * h.t;
}
function joltLayer(k) { (byLayer[k] || []).forEach(nd => { nd.vel.x += (Math.random() - 0.5) * 2.2; nd.vel.y += (Math.random() - 0.5) * 2.2; nd.vel.z += Math.random() * 1.2; }); edges.forEach(ed => { if (ed.k === k || ed.k === k + 1) ed.wv.addScaledVector(camUp, (Math.random() - 0.5) * 2.5); }); }
canvas.addEventListener('pointermove', (e) => { if (!lastPtr || Math.hypot(e.clientX - lastPtr.x, e.clientY - lastPtr.y) > 4) { const h = hitTest(e.clientX, e.clientY); window.__hoverNet = !!h; if (h) nudge(h, ptrDown ? 0.9 : 0.3); lastPtr = { x: e.clientX, y: e.clientY }; } });
canvas.addEventListener('pointerdown', (e) => { ptrDown = true; nudge(hitTest(e.clientX, e.clientY), 1.6); });
canvas.addEventListener('pointerleave', () => { window.__hoverNet = false; });
window.addEventListener('pointerup', () => { ptrDown = false; });

// ───────── per-frame ─────────
const T = () => window.T || { phase: 'hero', finalU: 0, heroK: 1, scaf: 0, curK: -1 };
let lastNow = 0, camInit = false, wellK = 0, lastW = 0, lastH = 0, par = { x: 0, y: 0 };
const tmpC = new THREE.Color();
function update(now) {
  const t = now / 1000, dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60; lastNow = now;
  const tj = T(), NODES = window.NODES || [];
  const fin = (introDone && tj.phase === 'final') ? tj.finalU : 0;
  const home = introDone && (tj.heroK || 0) > 0.5;
  spreadK += ((introDone ? 0 : 1) - spreadK) * (1 - Math.exp(-dt * 4));
  if (window.innerWidth !== lastW || window.innerHeight !== lastH || spreadK > 0.001) { lastW = window.innerWidth; lastH = window.innerHeight; relayout(); }
  const nodeK = narrow() ? mix(0.74, 1.15, spreadK) : mix(1, 1.3, spreadK);
  let it = 99, dis = 0, scaf = introDone ? (tj.scaf || 0) : 0, edgeK = () => 1, pulseA = 0, litK = () => 0;
  if (!introDone) {
    if (introT0 === null) introT0 = t; it = reduced || introSkipped ? 99 : t - introT0;
    nodes.forEach(nd => { nd.fly = easeBack((it - 0.1 - nd.stagger) / 1.35); });
    edgeK = (k) => clamp((it - 1.3 - (k - 1) * 0.1) / 0.5);
    const pu = clamp((it - 2.55) / 1.0); litK = (k) => pu > 0 && pu < 1 ? Math.max(0, 1 - Math.abs(pu * (NL + 1.6) - k - 0.5) * 1.2) : 0; pulseA = pu > 0 && pu < 1 ? 0.9 : 0;
    dis = smooth((it - 3.55) / 0.8);
    poseMain(want, D * (1.16 - 0.16 * smooth(it / 2.8)));
    if (capEl) { const c = CAPS[Math.min(CAPS.length - 1, Math.floor(it / 1.2))]; if (capEl.textContent !== c) capEl.textContent = c; }
    if (it >= 3.65 && !document.documentElement.classList.contains('ready')) document.documentElement.classList.add('ready');
    if (it >= 4.4) finishIntro();
    window.__it = it;
  } else {
    nodes.forEach(nd => { nd.fly = 1; });
    poseMain(want);
    if (fin > 0) { poseFinal(alt); lerpPose(want, alt, smooth((fin - 0.12) / 0.3)); }
  }
  // pointer parallax (desktop only), stronger on the opening views
  const parS = narrow() || !ptr.active ? 0 : (!introDone || home ? 0.9 : fin > 0 ? 0.2 : 0.35);
  par.x += (ptr.nx * parS - par.x) * (1 - Math.exp(-dt * 3)); par.y += (ptr.ny * parS - par.y) * (1 - Math.exp(-dt * 3));
  want.pos.x += par.x * 0.7; want.pos.y -= par.y * 0.4; want.target.x += par.x * 0.3; want.target.y -= par.y * 0.18;
  if (!camInit) { camPos.copy(want.pos); camTarget.copy(want.target); camInit = true; }
  const kc = reduced ? 1 : 1 - Math.exp(-dt * (introDone ? 5.5 : 14)); camPos.lerp(want.pos, kc); camTarget.lerp(want.target, kc);
  camera.position.copy(camPos); camera.lookAt(camTarget); camera.updateMatrixWorld();
  camRight.setFromMatrixColumn(camera.matrixWorld, 0); camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  // ── the well: its rim sits exactly on the output slot, so the neuron is already on the edge when the well appears ──
  const outNd = nodes[OUT]; const rimU = 0.9 * WR;
  wellK += (((introDone && fin > 0) ? smooth((fin - 0.18) / 0.26) : 0) - wellK) * (1 - Math.exp(-dt * 8));
  well.visible = wellK > 0.003; const ws = 0.35 + 0.65 * wellK; well.scale.setScalar(ws);
  well.position.set(outNd.slot.x - rimU * ws, outNd.slot.y - (wellH(rimU, 0) + 0.2) * ws, outNd.slot.z + 0.4);
  wellSurf.material.opacity = 0.46 * wellK; wellMesh.material.opacity = 0.9 * wellK; wellGlow.material.opacity = 0.35 * wellK; descent.material.opacity = 0.65 * wellK;
  if (wellK > 0.01) { const arr = descent.geometry.attributes.position.array; descentState.forEach((d, i) => { d.r -= d.sp * dt * (0.2 + d.r / WR); d.a += d.dr * dt * (0.4 + d.r / WR); if (d.r < 0.07) { d.r = WR * (0.86 + Math.random() * 0.12); d.a = Math.random() * 6.28; } arr[i * 3] = d.r * Math.cos(d.a); arr[i * 3 + 1] = wellH(d.r, 0) + 0.025; arr[i * 3 + 2] = d.r * Math.sin(d.a); }); descent.geometry.attributes.position.needsUpdate = true; }
  // ── marble physics on the surface: released at the rim with a sideways roll, damped, so it spirals and settles at the minimum ──
  const drop = smooth((fin - 0.42) / 0.1);
  if (drop > 0.01 && !marble.on) { marble.on = true; marble.u = rimU; marble.v = 0; marble.du = -0.4; marble.dv = 0.72 * OMEGA * rimU; }
  if (drop <= 0.01) marble.on = false;
  if (marble.on) { for (let s = 0; s < 2; s++) { const h = dt / 2; marble.du += (-2 * WA * G * marble.u - MU * marble.du) * h; marble.dv += (-2 * WA * G * marble.v - MU * marble.dv) * h; marble.u += marble.du * h; marble.v += marble.dv * h; const rr = Math.hypot(marble.u, marble.v); if (rr > WR * 0.95) { const k = WR * 0.95 / rr; marble.u *= k; marble.v *= k; const nu = marble.u / rr, nv = marble.v / rr, vn = marble.du * nu + marble.dv * nv; if (vn > 0) { marble.du -= 1.5 * vn * nu; marble.dv -= 1.5 * vn * nv; } } } }
  const outK = introDone ? smooth(fin / 0.2) : 0;
  // ── nodes ──
  const hoverOn = ptr.active && (performance.now() - ptr.t) < 1500; const hoverS = (!introDone || home) ? 1.4 : 0.7;
  nodes.forEach(nd => {
    const m = nd.mesh; const p = _a.copy(nd.slot); let lit = 0, alpha = 0, sc = 1;
    if (!introDone) { p.lerpVectors(nd.from, nd.slot, nd.fly); p.addScaledVector(nd.dir, dis * 2.2); lit = clamp(nd.fly); alpha = clamp(nd.fly * 2) * (1 - dis); sc = (0.4 + 0.6 * clamp(nd.fly)) * (1 - 0.6 * dis); }
    else if (nd.out) { lit = outK; alpha = Math.max(scaf * 0.36, outK); sc = 0.55 + 0.45 * outK; }
    else { const rec = (NODES[nd.k] || [])[nd.i]; lit = rec ? rec.b : 0;
      if (rec && lit > 0 && lit < 1) { const w = screenToWorldZ0(rec.sx, rec.sy); const e = smooth(lit); p.lerpVectors(w, nd.slot, e); p.y += Math.sin(e * Math.PI) * 0.5; }
      alpha = scaf * (0.36 + 0.64 * lit); sc = 0.5 + 0.5 * lit; }
    if (lit >= 0.98 && nd.lit < 0.98) nd.flashT = t; nd.lit = lit;
    const flash = Math.max(0, 0.5 * Math.exp(-(t - nd.flashT) * 3));
    // organic float
    const fl = clamp(nd.fly); p.x += Math.sin(t * 0.9 + nd.ph) * 0.05 * fl; p.y += Math.sin(t * 1.3 + nd.ph * 1.7) * 0.06 * fl; p.z += Math.cos(t * 0.7 + nd.ph) * 0.06 * fl;
    sc *= nd.size * nodeK * (1 + flash);
    if (nd.out && wellK > 0.01) { const wp = _b.set(marble.u, wellH(marble.u, marble.v) + 0.2, marble.v).multiplyScalar(ws).add(well.position); p.lerp(wp, drop); sc = (1 + 0.45 * drop) * nd.size; wellShadow.position.set(marble.u, wellH(marble.u, marble.v) + 0.02, marble.v); wellShadow.material.opacity = 0.14 * wellK * drop; }
    // gentle pointer response and fidget springs
    if (hoverOn && m.visible && alpha > 0.08) { toScreen(m.position, _sa); const d = Math.hypot(_sa.x - ptr.x, _sa.y - ptr.y); if (d < 120 && d > 0.5) { const f = (1 - d / 120) * hoverS * dt; nd.vel.addScaledVector(camRight, (_sa.x - ptr.x) / d * f).addScaledVector(camUp, -(_sa.y - ptr.y) / d * f); } }
    if (nd.vel.lengthSq() > 1e-8 || nd.off.lengthSq() > 1e-8) { nd.vel.addScaledVector(nd.off, -24 * dt); nd.vel.multiplyScalar(Math.exp(-dt * 3.0)); nd.off.addScaledVector(nd.vel, dt); if (nd.off.lengthSq() < 1e-6 && nd.vel.lengthSq() < 1e-6) { nd.off.set(0, 0, 0); nd.vel.set(0, 0, 0); } }
    m.position.copy(p).add(nd.off);
    const l = introDone ? 0 : litK(nd.k); m.material.color.copy(C.scaf).lerp(C.node, lit).lerp(C.node2, l); m.scale.setScalar(sc * (1 + 0.55 * l)); m.material.opacity = alpha; m.visible = alpha > 0.01; nd.alpha = alpha;
  });
  glow.position.copy(outNd.mesh.position); glow.material.opacity = outK * (0.5 - 0.2 * wellK); glow.scale.setScalar(1.5 + 1.3 * wellK);
  // ── links: faint scaffold, lit progressively from source to target as the target neuron arrives; wobble springs ──
  edges.forEach((ed, e) => {
    if (ed.wv.lengthSq() > 1e-8 || ed.wob.lengthSq() > 1e-8) { ed.wv.addScaledVector(ed.wob, -20 * dt); ed.wv.multiplyScalar(Math.exp(-dt * 2.6)); ed.wob.addScaledVector(ed.wv, dt); if (ed.wob.length() > 1.3) ed.wob.setLength(1.3); if (ed.wob.lengthSq() < 1e-6 && ed.wv.lengthSq() < 1e-6) { ed.wob.set(0, 0, 0); ed.wv.set(0, 0, 0); } }
    const A = nodes[ed.a], B = nodes[ed.b]; const both = A.mesh.visible && B.mesh.visible;
    const la = introDone ? Math.min(A.lit, B.lit) : edgeK(ed.k); const len = introDone ? 1 : la;
    ed.alpha = both ? (introDone ? scaf * (0.09 + 0.38 * la) : 0.46 * la * (1 - dis)) : 0;
    for (let s = 0; s < SEGS; s++) {
      const t0 = Math.min(len, s / SEGS), t1 = Math.min(len, (s + 1) / SEGS); bez(A.mesh.position, B.mesh.position, ed, t0, _a); bez(A.mesh.position, B.mesh.position, ed, t1, _b);
      const o = (e * SEGS + s) * 6; ePos[o] = _a.x; ePos[o + 1] = _a.y; ePos[o + 2] = _a.z; ePos[o + 3] = _b.x; ePos[o + 4] = _b.y; ePos[o + 5] = _b.z;
      const al = !both ? 0 : introDone ? scaf * (0.09 + 0.38 * clamp(la * (SEGS + 1.5) - s)) : 0.46 * (1 - dis);
      tmpC.copy(C.bg).lerp(C.edge, al); eCol[o] = eCol[o + 3] = tmpC.r; eCol[o + 1] = eCol[o + 4] = tmpC.g; eCol[o + 2] = eCol[o + 5] = tmpC.b;
    }
  });
  eGeo.attributes.position.needsUpdate = true; eGeo.attributes.color.needsUpdate = true;
  // ── activity: the forward pass during the intro; afterwards small signals travel along every lit link ──
  if (!introDone) { if (pulseA > 0) { const pu = clamp((it - 2.55) / 1.0); for (let i = 0; i < NP; i++) { const ed = edges[pEdge[i]]; const s = clamp(pu * (NL + 1.6) - ed.k + 1 - (i % 7) * 0.05); bez(nodes[ed.a].mesh.position, nodes[ed.b].mesh.position, ed, s, _p); pPos[i * 3] = _p.x; pPos[i * 3 + 1] = _p.y; pPos[i * 3 + 2] = _p.z; } pGeo.attributes.position.needsUpdate = true; } pulse.material.opacity = pulseA; }
  else { for (let i = 0; i < NP; i++) { const ed = edges[pEdge[i]]; const A = nodes[ed.a], B = nodes[ed.b]; if (Math.min(A.lit, B.lit) > 0.99 && A.mesh.visible && B.mesh.visible) { const s = (t * 0.22 * (0.7 + (i % 5) * 0.15) + i * 0.137) % 1; bez(A.mesh.position, B.mesh.position, ed, s, _p); pPos[i * 3] = _p.x; pPos[i * 3 + 1] = _p.y; pPos[i * 3 + 2] = _p.z; } else { pPos[i * 3] = 0; pPos[i * 3 + 1] = 1e4; pPos[i * 3 + 2] = 0; } } pGeo.attributes.position.needsUpdate = true; pulse.material.opacity = 0.55 * scaf; }
  // ── layer names ──
  if (labels.length) { const { hw } = frustum(); labels.forEach((el, k) => { const col = byLayer[k]; let cx = 0, cy = 0, miny = 1e9, ll = 0; col.forEach(nd => { cx += nd.slot.x; cy += nd.slot.y; miny = Math.min(miny, nd.slot.y); ll += nd.lit; }); cx /= col.length; cy /= col.length; ll /= col.length;
    if (narrow()) _p.set(-0.96 * hw, cy, 0); else _p.set(cx, miny - 0.8, 0); toScreen(_p, _sa);
    const op = introDone ? scaf * (0.45 + 0.5 * ll) : 0; el.style.transform = `translate(${_sa.x.toFixed(1)}px, ${_sa.y.toFixed(1)}px) translate(${narrow() ? '0' : '-50%'}, -50%)`; el.style.opacity = op.toFixed(3); el.classList.toggle('on', (tj.curK + 1) === k && op > 0.1); el.style.pointerEvents = op > 0.2 ? 'auto' : 'none'; }); }
  renderer.render(scene, camera);
  window.__ball = outNd.mesh.position.clone().project(camera);
  window.__nodeOff = nodes.map(n => +n.off.length().toFixed(3)); window.__marble = { u: +marble.u.toFixed(3), v: +marble.v.toFixed(3), on: marble.on }; window.__edgeWob = edges.map(e => +e.wob.length().toFixed(3));
  window.__screen = (i) => { const v = nodes[i].mesh.position.clone().project(camera); return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, vis: nodes[i].mesh.visible, alpha: +nodes[i].alpha.toFixed(2) }; };
  window.__edgeMid = (e) => { const ed = edges[e]; bez(nodes[ed.a].mesh.position, nodes[ed.b].mesh.position, ed, 0.5, _p); const o = { x: 0, y: 0 }; toScreen(_p, o); o.alpha = +ed.alpha.toFixed(2); return o; };
}
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); relayout(); }
window.addEventListener('resize', resize);
theme(); resize();
let running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(loop); });
function loop(now) { if (!running) return; update(now); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
