/* The network is the CV.
   Intro: every neuron flies in from behind you, the whole network wires up across the screen and fires once,
   then dissolves into the home page. Reading: a faint scaffold of the same network sits behind the cards;
   the camera zooms onto the layer you are reading and pulls back between layers. As each card slides past,
   its neuron rises out of the text, glides into its layer and lights its links. About is the input layer,
   Research / Experience / Education / Skills are the hidden layers, Contact is the output neuron.
   Contact: a space-time mesh envelops the page and warps under the output neuron as it falls into the global
   minimum, while the network floats behind it with signals pulsing down its links into the neuron.
   Fidget: poke any neuron, pluck any link, tap a layer name, flick the neuron in the well. */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

const canvas = document.getElementById('landscape');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => window.innerWidth < 900;
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch (e) { canvas.style.display = 'none'; window.introSkip && window.introSkip(); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow() ? 1.5 : 2));
const scene = new THREE.Scene();
const FOV = 38, D = 20, TANF = Math.tan(FOV * Math.PI / 360);
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 200);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeBack = (t) => { t = clamp(t); const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const mix = (a, b, k) => a + (b - a) * k;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ───────── the network: About (input), one hidden layer per topic (any width), one output neuron ─────────
const HID = (window.LAYERS && window.LAYERS.length) ? window.LAYERS : [4, 9, 3, 3, 2];
const NAMES = window.LAYER_NAMES || [];
const NL = HID.length + 1;
const nodes = []; const r0 = rng(7);
HID.forEach((n, k) => { for (let i = 0; i < n; i++) nodes.push({ k, i, n, ph: r0() * 6.28, s1: r0(), s2: r0(), s3: r0(), f1: r0(), f2: r0(), f3: r0(), size: 0.9 + r0() * 0.25, lit: 0, alpha: 0, flashT: -9 }); });
nodes.push({ k: NL - 1, i: 0, n: 1, ph: 0, s1: 0.5, s2: 0.5, s3: 0.5, f1: 0.5, f2: 0.5, f3: 0.6, size: 1.25, out: true, lit: 0, alpha: 0, flashT: -9 });
const OUT = nodes.length - 1;
const byLayer = Array.from({ length: NL }, (_, k) => nodes.filter(nd => nd.k === k));
const frustum = (z) => { const hh = (z || D) * TANF; return { hh, hw: hh * camera.aspect }; };
let spreadK = 1; // 1 = the intro fills the whole screen; 0 = the reading layout, clear of the header, the layer names and (on phones) the cards
function slotOf(nd, out) {
  const { hh, hw } = frustum(); const { k, i, n } = nd; const L = NL - 1; const sk = spreadK;
  const jx = (nd.s3 - 0.5) * (n > 5 ? 0.9 : 0.5), jy = (nd.s1 - 0.5) * (n > 5 ? 0.3 : 0.7), jz = (nd.s2 - 0.5) * 3;
  if (narrow()) {
    const yTop = mix(0.66, 0.84, sk) * hh, yBot = mix(0.2, -0.84, sk) * hh; const y = yTop + (yBot - yTop) * k / L;
    const xa = mix(-0.42, -0.92, sk), xb = mix(0.86, 0.92, sk); const fx = nd.out ? 0.5 : (i + 0.5) / n;
    return out.set((xa + (xb - xa) * fx) * hw + jx * 0.3, y + jy * 0.18, jz * 0.5);
  }
  const x = (k / L - 0.5) * mix(1.7, 1.86, sk) * hw, yTop = mix(0.56, 0.86, sk) * hh, yBot = mix(-0.62, -0.84, sk) * hh;
  return out.set(x + jx, nd.out ? (yTop + yBot) / 2 : yTop + (yBot - yTop) * (i + 0.5) / n + jy * mix(1, 1.4, sk), jz);
}
nodes.forEach(nd => { nd.slot = new THREE.Vector3(); nd.from = new THREE.Vector3(); nd.dir = new THREE.Vector3((nd.f1 - 0.5) * 2, (nd.f2 - 0.5) * 2, 0.8 + nd.f3).normalize(); nd.stagger = nd.k * 0.12 + nd.f3 * 0.3; });
const edges = [];
for (let k = 0; k < NL - 1; k++) byLayer[k].forEach(a => byLayer[k + 1].forEach(b => { const r = rng(1000 + edges.length); edges.push({ a: nodes.indexOf(a), b: nodes.indexOf(b), k: k + 1, bend: new THREE.Vector3((r() - 0.5) * 0.5, (r() - 0.5) * 1.1, (r() - 0.5) * 1.6), wob: new THREE.Vector3(), wv: new THREE.Vector3(), alpha: 0 }); }));
const outEdges = edges.map((e, i) => i).filter(i => nodes[edges[i].b].out);

// ───────── meshes ─────────
const net = new THREE.Group(); scene.add(net);
const nodeGeo = new THREE.SphereGeometry(0.17, 28, 28);
nodes.forEach(nd => { nd.mesh = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 })); nd.mesh.renderOrder = nd.out ? 4 : 2; nd.off = new THREE.Vector3(); nd.vel = new THREE.Vector3(); net.add(nd.mesh); });
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false })); glow.scale.setScalar(1.6); glow.renderOrder = 3; net.add(glow);
const SEGS = 8; const ePos = new Float32Array(edges.length * SEGS * 6), eCol = new Float32Array(edges.length * SEGS * 6);
const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3)); eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
const eLines = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false })); eLines.frustumCulled = false; eLines.renderOrder = 1; net.add(eLines);
const _q = new THREE.Vector3();
function bez(A, B, ed, t, out) { // quadratic bezier: control point at the midpoint plus the link's bend and its fidget wobble
  _q.lerpVectors(A, B, 0.5).add(ed.bend).add(ed.wob); const u = 1 - t;
  return out.set(u * u * A.x + 2 * u * t * _q.x + t * t * B.x, u * u * A.y + 2 * u * t * _q.y + t * t * B.y, u * u * A.z + 2 * u * t * _q.z + t * t * B.z);
}
// signals: most ride random links; the last few always ride the links into the output neuron, so the finale pulses into the minimum
const NP = 132, NPO = 24; const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(NP * 3); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pulse = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); pulse.frustumCulled = false; pulse.renderOrder = 3; net.add(pulse);
const pEdge = (() => { const r = rng(9); return Array.from({ length: NP }, (_, i) => i < NP - NPO ? Math.floor(r() * edges.length) : outEdges[(i - (NP - NPO)) % outEdges.length]); })();

// layer names, faint, under each column (left of each row on phones)
const labelHost = document.getElementById('llabels'); const labels = [];
if (labelHost) for (let k = 0; k < NL; k++) { const el = document.createElement('span'); el.className = 'llabel'; el.textContent = NAMES[k] || (k === NL - 1 ? 'Output' : 'Layer ' + k); el.addEventListener('pointerdown', () => joltLayer(k)); labelHost.appendChild(el); labels.push(el); }

// ───────── the space-time sheet: a grid behind the network that bends toward the global minimum and dents under the neuron ─────────
const ZS = -2.5, NX = 60, NY = 36, PULL = 0.45, ZDEP = 5.0, OMEGA = 2.2, MU = 0.95;
const NV = (NX + 1) * (NY + 1); const gx = new Float32Array(NV), gy = new Float32Array(NV);
const segA = [], segB = []; for (let j = 0; j <= NY; j++) for (let i = 0; i < NX; i++) { segA.push(j * (NX + 1) + i); segB.push(j * (NX + 1) + i + 1); } for (let i = 0; i <= NX; i++) for (let j = 0; j < NY; j++) { segA.push(j * (NX + 1) + i); segB.push((j + 1) * (NX + 1) + i); }
const NSEG = segA.length; const sPos = new Float32Array(NSEG * 6), sCol = new Float32Array(NSEG * 6); const vx = new Float32Array(NV), vy = new Float32Array(NV), vz = new Float32Array(NV), va = new Float32Array(NV);
const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
const sheet = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthTest: false, depthWrite: false })); sheet.frustumCulled = false; sheet.renderOrder = -4; sheet.visible = false; scene.add(sheet);
const minGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false })); minGlow.scale.setScalar(7); minGlow.renderOrder = -5; scene.add(minGlow);
const G = new THREE.Vector3(), RIM = new THREE.Vector3(); let R0 = 5, SIG = 3.4;
const marble = { u: 0, v: 0, du: 0, dv: 0, on: false }; let fallS = 0;
function relayout() {
  const { hh, hw } = frustum(); nodes.forEach(nd => { slotOf(nd, nd.slot); nd.from.set((nd.f1 - 0.5) * 3.4 * hw, (nd.f2 - 0.5) * 3.4 * hh, D + 3 + nd.f3 * 14); });
  if (narrow()) G.set(0, 0.3 * hh, ZS); else G.set(-0.36 * hw, -0.1 * hh, ZS);
  R0 = Math.min(5, 1.1 * hw); SIG = 0.68 * R0;
  const dir = narrow() ? { x: 0.95, y: 0.3 } : { x: 0.45, y: 0.9 }; RIM.set(G.x + R0 * dir.x, G.y + R0 * dir.y, 0);
  const SX = 2.0 * hw, SY = 1.8 * hh; for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const v = j * (NX + 1) + i; gx[v] = -SX + 2 * SX * i / NX; gy[v] = -SY + 2 * SY * j / NY; }
  minGlow.position.set(G.x, G.y, ZS - 0.5);
}

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
function poseWide(out, z) { out.pos.set(0, 0, z || D * 1.05); out.target.set(0, 0, 0); return out; }
function layerPose(k, out) { // zoom onto one layer: closer for small layers, and framed so the cards do not cover it
  const col = byLayer[clamp(k, 0, NL - 1)]; let cx = 0, cy = 0; col.forEach(nd => { cx += nd.slot.x; cy += nd.slot.y; }); cx /= col.length; cy /= col.length;
  const z = D * mix(0.66, 1.0, clamp((col.length - 2) / 7)); const { hh, hw } = frustum(z);
  if (narrow()) { out.pos.set(0, cy - 0.5 * hh, z); out.target.set(0, cy - 0.5 * hh, 0); }
  else { out.pos.set(cx + 0.42 * hw, cy * 0.5, z); out.target.set(cx + 0.42 * hw, cy * 0.5, 0); }
  return out;
}
function poseLayer(out, kf) { const k0 = Math.floor(kf), f = kf - k0; layerPose(k0, lp0); layerPose(Math.min(NL - 1, k0 + 1), lp1); out.pos.lerpVectors(lp0.pos, lp1.pos, f); out.target.lerpVectors(lp0.target, lp1.target, f); return out; }
function poseFinal(out) { if (narrow()) { out.pos.set(G.x, G.y + 7, D); out.target.set(G.x, G.y - 1.5, ZS); } else { out.pos.set(G.x + 1.0, G.y + 8.5, D + 1); out.target.set(G.x + 2.2, G.y - 1.0, ZS); } return out; }
function screenToWorldZ0(sx, sy) { const v = new THREE.Vector3((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5).unproject(camera); const d = v.sub(camera.position).normalize(); const t = -camera.position.z / d.z; return camera.position.clone().addScaledVector(d, t); }
const lerpPose = (a, b, k) => { a.pos.lerp(b.pos, k); a.target.lerp(b.target, k); };
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
    for (let s = 0; s <= K; s++) { bez(A, B, ed, s / K, _p); toScreen(_p, _sb); if (s > 0) { const vx2 = _sb.x - px, vy2 = _sb.y - py, L2 = vx2 * vx2 + vy2 * vy2 || 1; const tt = clamp(((sx - px) * vx2 + (sy - py) * vy2) / L2); const d = Math.hypot(px + vx2 * tt - sx, py + vy2 * tt - sy); if (d < 13 && (!best || d < best.d)) best = { ed, d, t: (s - 1 + tt) / K }; } px = _sb.x; py = _sb.y; } });
  return best;
}
function nudge(h, strength) {
  if (!h) return;
  if (h.nd) { const nd = h.nd;
    if (nd.out && marble.on) { const dir = _a.copy(h.point).sub(nd.mesh.position); marble.du += -dir.x * 3.6 * strength + (Math.random() - 0.5) * 0.5 * strength; marble.dv += -dir.y * 3.6 * strength + (Math.random() - 0.5) * 0.5 * strength; return; }
    const dir = _a.copy(h.point).sub(nd.mesh.position).normalize(); nd.vel.addScaledVector(dir, -1.7 * strength); nd.vel.y += 0.5 * strength; return; }
  const ed = h.ed, A = nodes[ed.a], B = nodes[ed.b]; const j = (Math.random() < 0.5 ? -1 : 1) * 2.6 * strength;
  ed.wv.addScaledVector(camUp, j).addScaledVector(camRight, (Math.random() - 0.5) * 1.4 * strength);
  A.vel.y += j * 0.1 * (1 - h.t); B.vel.y += j * 0.1 * h.t;
}
function joltLayer(k) { (byLayer[k] || []).forEach(nd => { nd.vel.x += (Math.random() - 0.5) * 2.2; nd.vel.y += (Math.random() - 0.5) * 2.2; nd.vel.z += Math.random() * 1.2; }); edges.forEach(ed => { if (ed.k === k || ed.k === k + 1) ed.wv.addScaledVector(camUp, (Math.random() - 0.5) * 2.5); }); }
canvas.addEventListener('pointermove', (e) => { if (!lastPtr || Math.hypot(e.clientX - lastPtr.x, e.clientY - lastPtr.y) > 4) { const h = hitTest(e.clientX, e.clientY); canvas.style.cursor = h ? 'pointer' : ''; window.__hoverNet = !!h; if (h) nudge(h, ptrDown ? 0.9 : 0.3); lastPtr = { x: e.clientX, y: e.clientY }; } });
canvas.addEventListener('pointerdown', (e) => { ptrDown = true; nudge(hitTest(e.clientX, e.clientY), 1.6); });
canvas.addEventListener('pointerleave', () => { canvas.style.cursor = ''; window.__hoverNet = false; });
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
  spreadK += ((introDone ? 0 : 1) - spreadK) * (1 - Math.exp(-dt * 4));
  if (window.innerWidth !== lastW || window.innerHeight !== lastH || spreadK > 0.001) { lastW = window.innerWidth; lastH = window.innerHeight; relayout(); }
  const nodeK = narrow() ? mix(0.74, 1.15, spreadK) : mix(1, 1.3, spreadK);
  let it = 99, dis = 0, scaf = introDone ? (tj.scaf || 0) : 0, edgeK = () => 1, pulseA = 0, litK = () => 0;
  if (!introDone) {
    if (introT0 === null) introT0 = t; it = reduced || introSkipped ? 99 : t - introT0;
    nodes.forEach(nd => { nd.fly = easeBack((it - 0.1 - nd.stagger) / 1.35); });
    edgeK = (k) => clamp((it - 1.3 - (k - 1) * 0.12) / 0.5);
    const pu = clamp((it - 2.55) / 1.0); litK = (k) => pu > 0 && pu < 1 ? Math.max(0, 1 - Math.abs(pu * (NL + 1.6) - k - 0.5) * 1.2) : 0; pulseA = pu > 0 && pu < 1 ? 0.9 : 0;
    dis = smooth((it - 3.55) / 0.8);
    poseWide(want, D * (1.16 - 0.16 * smooth(it / 2.8)));
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
  want.pos.x += par.x * 0.7; want.pos.y -= par.y * 0.4; want.target.x += par.x * 0.3; want.target.y -= par.y * 0.18;
  if (!camInit) { camPos.copy(want.pos); camTarget.copy(want.target); camInit = true; }
  const kc = reduced ? 1 : 1 - Math.exp(-dt * (introDone ? 4.5 : 14)); camPos.lerp(want.pos, kc); camTarget.lerp(want.target, kc);
  camera.position.copy(camPos); camera.lookAt(camTarget); camera.updateMatrixWorld();
  camRight.setFromMatrixColumn(camera.matrixWorld, 0); camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  // ── the finale: the sheet appears, the neuron glides to the rim of the basin, is released, and rolls to the minimum under damped physics ──
  const sheetK = fin > 0 ? smooth((fin - 0.1) / 0.25) : 0, toRim = smooth((fin - 0.2) / 0.22), drop = smooth((fin - 0.42) / 0.08);
  if (drop > 0.01 && !marble.on) { marble.on = true; marble.u = RIM.x - G.x; marble.v = RIM.y - G.y; const L = Math.hypot(marble.u, marble.v) || 1; marble.du = -marble.v / L * 0.62 * OMEGA * L - marble.u / L * 0.5; marble.dv = marble.u / L * 0.62 * OMEGA * L - marble.v / L * 0.5; }
  if (drop <= 0.01) { marble.on = false; }
  if (marble.on) { for (let s = 0; s < 2; s++) { const h = dt / 2; marble.du += (-OMEGA * OMEGA * marble.u - MU * marble.du) * h; marble.dv += (-OMEGA * OMEGA * marble.v - MU * marble.dv) * h; marble.u += marble.du * h; marble.v += marble.dv * h; const rr = Math.hypot(marble.u, marble.v); if (rr > R0 * 1.15) { const k = R0 * 1.15 / rr; marble.u *= k; marble.v *= k; const nu = marble.u / rr, nv = marble.v / rr, vn = marble.du * nu + marble.dv * nv; if (vn > 0) { marble.du -= 1.5 * vn * nu; marble.dv -= 1.5 * vn * nv; } } } }
  fallS += (((marble.on ? clamp(1 - Math.hypot(marble.u, marble.v) / R0) : 0) * drop) - fallS) * (1 - Math.exp(-dt * 3));
  const depthK = sheetK * (0.3 + 0.7 * fallS); const gauss = (dx, dy) => Math.exp(-(dx * dx + dy * dy) / (2 * SIG * SIG));
  const nx = G.x + marble.u, ny = G.y + marble.v;
  sheet.visible = sheetK > 0.003; minGlow.material.opacity = 0.42 * depthK;
  if (sheet.visible) {
    for (let v = 0; v < NV; v++) {
      const dx = gx[v] - G.x, dy = gy[v] - G.y; const g = gauss(dx, dy); let px = gx[v] - dx * PULL * depthK * g, py = gy[v] - dy * PULL * depthK * g, pz = ZS - ZDEP * depthK * g;
      if (marble.on) { const ex = gx[v] - nx, ey = gy[v] - ny; const gn = Math.exp(-(ex * ex + ey * ey) / 1.3); px -= ex * 0.3 * gn * drop; py -= ey * 0.3 * gn * drop; pz -= 1.4 * gn * drop; }
      vx[v] = px; vy[v] = py; vz[v] = pz; va[v] = g;
    }
    for (let s = 0; s < NSEG; s++) { const a = segA[s], b = segB[s], o = s * 6; sPos[o] = vx[a]; sPos[o + 1] = vy[a]; sPos[o + 2] = vz[a]; sPos[o + 3] = vx[b]; sPos[o + 4] = vy[b]; sPos[o + 5] = vz[b];
      for (let e = 0; e < 2; e++) { const g = e ? va[b] : va[a]; tmpC.copy(C.bg).lerp(C.edge, sheetK * (0.16 + 0.6 * g)).lerp(C.node, 0.5 * g * g * depthK); const oo = o + e * 3; sCol[oo] = tmpC.r; sCol[oo + 1] = tmpC.g; sCol[oo + 2] = tmpC.b; } }
    sGeo.attributes.position.needsUpdate = true; sGeo.attributes.color.needsUpdate = true;
  }
  const outK = introDone ? smooth(fin / 0.2) : 0;
  // ── nodes ──
  const hoverOn = ptr.active && (performance.now() - ptr.t) < 1500; const hoverS = (!introDone || home) ? 1.4 : 0.7;
  const outNd = nodes[OUT];
  nodes.forEach(nd => {
    const m = nd.mesh; const p = _a.copy(nd.slot); let lit = 0, alpha = 0, sc = 1;
    if (!introDone) { p.lerpVectors(nd.from, nd.slot, nd.fly); p.addScaledVector(nd.dir, dis * 2.2); lit = clamp(nd.fly); alpha = clamp(nd.fly * 2) * (1 - dis); sc = (0.4 + 0.6 * clamp(nd.fly)) * (1 - 0.6 * dis); }
    else if (nd.out) { lit = outK; alpha = Math.max(scaf * 0.36, outK); sc = 0.55 + 0.45 * outK;
      if (fin > 0) { p.lerp(RIM, toRim); if (marble.on || drop > 0) { const g = gauss(marble.u, marble.v); _b.set(nx, ny, ZS - ZDEP * depthK * g - 1.4 * drop + 0.38); p.lerp(_b, drop); } sc = (1 + 0.5 * drop) * (0.55 + 0.45 * outK); } }
    else { const rec = (NODES[nd.k] || [])[nd.i]; lit = rec ? rec.b : 0;
      if (rec && lit > 0 && lit < 1) { const w = screenToWorldZ0(rec.sx, rec.sy); const e = smooth(lit); p.lerpVectors(w, nd.slot, e); p.y += Math.sin(e * Math.PI) * 0.5; }
      alpha = scaf * (0.36 + 0.64 * lit); sc = 0.5 + 0.5 * lit; }
    if (lit >= 0.98 && nd.lit < 0.98) nd.flashT = t; nd.lit = lit;
    const flash = Math.max(0, 0.5 * Math.exp(-(t - nd.flashT) * 3));
    // organic float, freer in the finale
    const fl = clamp(nd.fly) * (nd.out && fin > 0 ? 0 : 1 + 1.6 * finA); p.x += Math.sin(t * 0.9 + nd.ph) * 0.05 * fl; p.y += Math.sin(t * 1.3 + nd.ph * 1.7) * 0.06 * fl; p.z += Math.cos(t * 0.7 + nd.ph) * 0.06 * fl;
    sc *= nd.size * nodeK * (1 + flash);
    // gentle pointer response and fidget springs
    if (hoverOn && m.visible && alpha > 0.08) { toScreen(m.position, _sa); const d = Math.hypot(_sa.x - ptr.x, _sa.y - ptr.y); if (d < 120 && d > 0.5) { const f = (1 - d / 120) * hoverS * dt; nd.vel.addScaledVector(camRight, (_sa.x - ptr.x) / d * f).addScaledVector(camUp, -(_sa.y - ptr.y) / d * f); } }
    if (nd.vel.lengthSq() > 1e-8 || nd.off.lengthSq() > 1e-8) { nd.vel.addScaledVector(nd.off, -24 * dt); nd.vel.multiplyScalar(Math.exp(-dt * 3.0)); nd.off.addScaledVector(nd.vel, dt); if (nd.off.lengthSq() < 1e-6 && nd.vel.lengthSq() < 1e-6) { nd.off.set(0, 0, 0); nd.vel.set(0, 0, 0); } }
    m.position.copy(p).add(nd.off);
    const l = introDone ? 0 : litK(nd.k); m.material.color.copy(C.scaf).lerp(C.node, lit).lerp(C.node2, l); m.scale.setScalar(sc * (1 + 0.55 * l)); m.material.opacity = alpha; m.visible = alpha > 0.01; nd.alpha = alpha;
  });
  glow.position.copy(outNd.mesh.position); glow.material.opacity = outK * (0.5 + 0.2 * drop); glow.scale.setScalar(1.5 + 1.6 * drop);
  // ── links: faint scaffold, lit progressively from source to target as the target neuron arrives; wobble springs ──
  edges.forEach((ed, e) => {
    if (ed.wv.lengthSq() > 1e-8 || ed.wob.lengthSq() > 1e-8) { ed.wv.addScaledVector(ed.wob, -20 * dt); ed.wv.multiplyScalar(Math.exp(-dt * 2.6)); ed.wob.addScaledVector(ed.wv, dt); if (ed.wob.length() > 1.3) ed.wob.setLength(1.3); if (ed.wob.lengthSq() < 1e-6 && ed.wv.lengthSq() < 1e-6) { ed.wob.set(0, 0, 0); ed.wv.set(0, 0, 0); } }
    const A = nodes[ed.a], B = nodes[ed.b]; const both = A.mesh.visible && B.mesh.visible;
    const la = introDone ? Math.min(A.lit, B.lit) : edgeK(ed.k); const len = introDone ? 1 : la;
    const base = B.out ? Math.max(scaf, outK * 0.9) : scaf; // the links into the output neuron stay bright while it sinks
    ed.alpha = both ? (introDone ? base * (0.09 + 0.38 * la) : 0.46 * la * (1 - dis)) : 0;
    for (let s = 0; s < SEGS; s++) {
      const t0 = Math.min(len, s / SEGS), t1 = Math.min(len, (s + 1) / SEGS); bez(A.mesh.position, B.mesh.position, ed, t0, _a); bez(A.mesh.position, B.mesh.position, ed, t1, _b);
      const o = (e * SEGS + s) * 6; ePos[o] = _a.x; ePos[o + 1] = _a.y; ePos[o + 2] = _a.z; ePos[o + 3] = _b.x; ePos[o + 4] = _b.y; ePos[o + 5] = _b.z;
      const al = !both ? 0 : introDone ? base * (0.09 + 0.38 * clamp(la * (SEGS + 1.5) - s)) : 0.46 * (1 - dis);
      tmpC.copy(C.bg).lerp(C.edge, al); eCol[o] = eCol[o + 3] = tmpC.r; eCol[o + 1] = eCol[o + 4] = tmpC.g; eCol[o + 2] = eCol[o + 5] = tmpC.b;
    }
  });
  eGeo.attributes.position.needsUpdate = true; eGeo.attributes.color.needsUpdate = true;
  // ── signals: the forward pass during the intro; afterwards small signals travel forward along every lit link, and in the finale they pour into the minimum ──
  if (!introDone) { if (pulseA > 0) { const pu = clamp((it - 2.55) / 1.0); for (let i = 0; i < NP; i++) { const ed = edges[pEdge[i]]; const s = clamp(pu * (NL + 1.6) - ed.k + 1 - (i % 7) * 0.05); bez(nodes[ed.a].mesh.position, nodes[ed.b].mesh.position, ed, s, _p); pPos[i * 3] = _p.x; pPos[i * 3 + 1] = _p.y; pPos[i * 3 + 2] = _p.z; } pGeo.attributes.position.needsUpdate = true; } pulse.material.opacity = pulseA; }
  else { const sp = 0.22 * (1 + 1.2 * finA); for (let i = 0; i < NP; i++) { const ed = edges[pEdge[i]]; const A = nodes[ed.a], B = nodes[ed.b]; if (Math.min(A.lit, B.lit) > 0.99 && A.mesh.visible && B.mesh.visible) { const s = (t * sp * (0.7 + (i % 5) * 0.15) + i * 0.137) % 1; bez(A.mesh.position, B.mesh.position, ed, s, _p); pPos[i * 3] = _p.x; pPos[i * 3 + 1] = _p.y; pPos[i * 3 + 2] = _p.z; } else { pPos[i * 3] = 0; pPos[i * 3 + 1] = 1e4; pPos[i * 3 + 2] = 0; } } pGeo.attributes.position.needsUpdate = true; pulse.material.opacity = Math.max(0.55 * scaf, 0.85 * finA); pulse.material.size = 0.09 + 0.05 * finA; }
  // ── layer names ──
  if (labels.length) { const { hw } = frustum(); labels.forEach((el, k) => { const col = byLayer[k]; let cx = 0, cy = 0, miny = 1e9, ll = 0; col.forEach(nd => { cx += nd.slot.x; cy += nd.slot.y; miny = Math.min(miny, nd.slot.y); ll += nd.lit; }); cx /= col.length; cy /= col.length; ll /= col.length;
    if (narrow()) _p.set(-0.96 * hw, cy, 0); else _p.set(cx, miny - 0.8, 0); toScreen(_p, _sa);
    const op = introDone ? scaf * (0.45 + 0.5 * ll) * (1 - 0.8 * finA) : 0; el.style.transform = `translate(${_sa.x.toFixed(1)}px, ${_sa.y.toFixed(1)}px) translate(${narrow() ? '0' : '-50%'}, -50%)`; el.style.opacity = op.toFixed(3); el.classList.toggle('on', (tj.curK + 1) === k && op > 0.1); el.style.pointerEvents = op > 0.2 ? 'auto' : 'none'; }); }
  renderer.render(scene, camera);
  window.__ball = outNd.mesh.position.clone().project(camera);
  window.__cam = { z: +camera.position.z.toFixed(2), x: +camera.position.x.toFixed(2), y: +camera.position.y.toFixed(2) }; window.__well = { depth: +depthK.toFixed(3), sheet: +sheetK.toFixed(3), fall: +fallS.toFixed(3), r: +Math.hypot(marble.u, marble.v).toFixed(3) };
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
