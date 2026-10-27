/* One scene, one camera, one timeline.
   The intro dives into an output neuron of a 3D MLP; inside it is the loss landscape.
   The ball rolls down the landscape as the reader scrolls (main.js writes window.T).
   At the end the landscape folds back into the ball, which is the neuron again,
   and the network reassembles around it: the story closes where it began. */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

const canvas = document.getElementById('landscape');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => window.innerWidth < 900;
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch (e) { canvas.style.display = 'none'; window.introSkip && window.introSkip(); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow() ? 1.5 : 1.75));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const ease3 = (t) => 1 - Math.pow(1 - clamp(t), 3);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ───────── loss landscape + descent path ─────────
const BUMPS = [{ a: -2.4, x: 2.2, y: -1.6, s: 2.4 }, { a: -1.0, x: -2.6, y: 1.8, s: 1.6 }, { a: 0.9, x: -0.3, y: -0.2, s: 1.4 }, { a: 0.6, x: 1.0, y: 2.6, s: 1.1 }];
function f(x, y) { let v = 0.07 * (x * x + y * y); for (const b of BUMPS) { const dx = x - b.x, dy = y - b.y; v += b.a * Math.exp(-(dx * dx + dy * dy) / b.s); } return v + 0.05 * Math.sin(1.7 * x) * Math.cos(1.5 * y); }
function grad(x, y) { const h = 1e-3; return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)]; }
const raw = [[-3.4, 3.6]]; let vel = [0, 0];
for (let i = 0; i < 900; i++) { const [x, y] = raw[raw.length - 1]; const g = grad(x, y); vel = [0.9 * vel[0] + g[0], 0.9 * vel[1] + g[1]]; raw.push([x - 0.06 * vel[0], y - 0.06 * vel[1]]); if (i > 120 && Math.hypot(g[0], g[1]) < 1e-3 && Math.hypot(vel[0], vel[1]) < 1e-3) break; }
const lens = [0]; for (let i = 1; i < raw.length; i++) lens.push(lens[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
const total = lens[lens.length - 1], NP = 500, path = [];
for (let k = 0; k < NP; k++) { const t = (k / (NP - 1)) * total; let i = 1; while (i < lens.length - 1 && lens[i] < t) i++; const u = (t - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1); path.push([raw[i - 1][0] + u * (raw[i][0] - raw[i - 1][0]), raw[i - 1][1] + u * (raw[i][1] - raw[i - 1][1])]); }
const pathPoint = (p, out = new THREE.Vector3()) => { const k = clamp(p) * (NP - 1), i = Math.floor(k), u = k - i, p0 = path[i], p1 = path[Math.min(NP - 1, i + 1)]; const x = p0[0] + u * (p1[0] - p0[0]), y = p0[1] + u * (p1[1] - p0[1]); return out.set(x, f(x, y), y); };
const pathDir = (p, out = new THREE.Vector3()) => { const a = pathPoint(clamp(p - 0.02)), b = pathPoint(clamp(p + 0.02)); out.subVectors(b, a); out.y = 0; return out.lengthSq() > 1e-6 ? out.normalize() : out.set(0.73, 0, -0.68); };
const START = pathPoint(0), END = pathPoint(1);
const UP = new THREE.Vector3(0, 1, 0);

const land = new THREE.Group(); scene.add(land);
const SIZE = 16, SEG = narrow() ? 64 : 104;
const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
const pos = geo.attributes.position, col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3); geo.setAttribute('color', col);
let zmin = Infinity, zmax = -Infinity; const zs = new Float32Array(pos.count);
for (let i = 0; i < pos.count; i++) { const z = f(pos.getX(i), pos.getZ(i)); zs[i] = z; zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); pos.setY(i, z); }
pos.needsUpdate = true;
const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, wireframe: true, transparent: true, opacity: 0.32 })); land.add(wire);
const dots = new THREE.Points(geo, new THREE.PointsMaterial({ vertexColors: true, size: 0.04, transparent: true, opacity: 0.8 })); land.add(dots);
const pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.map(p => new THREE.Vector3(p[0], f(p[0], p[1]) + 0.025, p[1]))), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.85 })); land.add(pathLine);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; land.add(shadow);
let stopRings = [];
function buildStops(n) { stopRings.forEach(r => land.remove(r)); stopRings = []; for (let k = 1; k <= n; k++) { const p = pathPoint(k / n); const m = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(p.x, p.y + 0.02, p.z); land.add(m); stopRings.push(m); } }

// ───────── the ball (also the neuron we live inside) ─────────
const ballG = new THREE.Group(); scene.add(ballG);
const ballTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256); const r = rng(5); g.fillStyle = 'rgba(0,0,0,0.22)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(r() * 256, r() * 256, 14 + r() * 18, 0, 6.28); g.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
const ballMat = new THREE.MeshBasicMaterial({ map: ballTex });
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 32), ballMat); ball.renderOrder = 5; ballG.add(ball);
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.55, depthWrite: false })); glow.scale.setScalar(1.1); ballG.add(glow);

// ───────── the MLP ─────────
const net = new THREE.Group(); scene.add(net);
const layers = [4, 6, 7, 6, 3], nodes = [], edges = [];
{ const r = rng(2024); layers.forEach((n, li) => { for (let k = 0; k < n; k++) { const ang = (k / n) * Math.PI * 2 + li * 0.5, rad = 0.55 + 0.42 * Math.sqrt(n); nodes.push({ li, target: new THREE.Vector3((li - (layers.length - 1) / 2) * 2.1, Math.cos(ang) * rad * 0.72, Math.sin(ang) * rad * 0.72), from: new THREE.Vector3((r() - 0.5) * 18, (r() - 0.5) * 12, (r() - 0.5) * 12), ph: r() * 6.28 }); } });
  let base = 0; layers.forEach((n, li) => { if (li < layers.length - 1) for (let a = 0; a < n; a++) for (let b = 0; b < layers[li + 1]; b++) edges.push([base + a, base + n + b]); base += n; }); }
const OUT = nodes.length - 2; // the neuron we enter and return to
const nodeGeo = new THREE.SphereGeometry(0.13, 20, 20);
const nodeMeshes = nodes.map(() => { const m = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 })); net.add(m); return m; });
nodeMeshes[OUT].visible = false; // the ball stands in for it
const ePos = new Float32Array(edges.length * 6); const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
const eLines = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({ transparent: true, opacity: 0 })); eLines.frustumCulled = false; net.add(eLines);
const NPULSE = Math.min(edges.length, 170); const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(NPULSE * 3); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pulse = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, transparent: true, opacity: 0, depthWrite: false })); pulse.frustumCulled = false; net.add(pulse);
const pEdge = (() => { const r = rng(9); return Array.from({ length: NPULSE }, () => Math.floor(r() * edges.length)); })();
const netCenterLocal = new THREE.Vector3(0, 0, 0);
function anchorNet(worldPoint) { net.position.copy(worldPoint).sub(nodes[OUT].target); }
function layoutNet(assemble, lit, t, fromBall) {
  nodes.forEach((n, i) => { const m = nodeMeshes[i]; m.position.copy(fromBall ? nodes[OUT].target : n.from).lerp(n.target, assemble); m.position.y += Math.sin(t * 2 + n.ph) * 0.025; const l = lit(n.li); m.material.color.copy(C.net).lerp(C.net2, l); m.scale.setScalar(0.65 + 0.35 * assemble + 0.5 * l); });
  edges.forEach(([i, j], e) => { const p = nodeMeshes[i].position, q = nodeMeshes[j].position; ePos[e * 6] = p.x; ePos[e * 6 + 1] = p.y; ePos[e * 6 + 2] = p.z; ePos[e * 6 + 3] = q.x; ePos[e * 6 + 4] = q.y; ePos[e * 6 + 5] = q.z; });
  eGeo.attributes.position.needsUpdate = true;
}
function netAlpha(a) { nodeMeshes.forEach(m => m.material.opacity = a); eLines.material.opacity = 0.35 * a; net.visible = a > 0.005; }

// ───────── colours ─────────
const C = { lo: new THREE.Color(), hi: new THREE.Color(), ball: new THREE.Color(), net: new THREE.Color('#57068c'), net2: new THREE.Color('#8900e1') };
function theme() {
  const cs = getComputedStyle(document.documentElement);
  const dark = (window.currentTheme ? window.currentTheme() : 'light') === 'dark';
  C.lo.set('#57068c'); C.hi.set(dark ? '#cba4ff' : '#b388ff');
  if (!dark) { C.lo.lerp(new THREE.Color('#ffffff'), 0.15); C.hi.lerp(new THREE.Color('#ffffff'), 0.2); }
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const u = (zs[i] - zmin) / (zmax - zmin || 1); tmp.copy(C.lo).lerp(C.hi, Math.pow(u, 0.8)); col.setXYZ(i, tmp.r, tmp.g, tmp.b); }
  col.needsUpdate = true;
  C.ball.set(cs.getPropertyValue('--ball').trim() || '#8900e1');
  ballMat.color.copy(C.ball); glow.material.color.copy(C.ball); pathLine.material.color.copy(C.ball); pulse.material.color.copy(C.net2); eLines.material.color.copy(C.net);
  stopRings.forEach(r => r.material.color.copy(C.ball));
  C.net.set(dark ? '#b388ff' : '#57068c'); C.net2.set(dark ? '#e2cfff' : '#8900e1'); eLines.material.color.copy(C.net);
  wire.material.opacity = dark ? 0.4 : 0.32; dots.material.opacity = dark ? 0.85 : 0.75;
}
window.addEventListener('themechange', theme);

// ───────── camera poses ─────────
const _d = new THREE.Vector3(), _r = new THREE.Vector3(), _p = new THREE.Vector3(), _t = new THREE.Vector3();
function poseAt(ballP, kind, out) {
  const b = pathPoint(ballP, _p), d = pathDir(ballP, _d); const r = _r.set(-d.z, 0, d.x); const nr = narrow();
  const P = out.pos, T = out.target;
  if (kind === 'hero') {
    if (nr) { P.copy(b).addScaledVector(d, -6.4).addScaledVector(UP, 4.6); T.copy(b).addScaledVector(d, 1.0).addScaledVector(UP, 1.8); }
    else { P.copy(b).addScaledVector(d, -6.6).addScaledVector(UP, 4.3).addScaledVector(r, -0.6); T.copy(b).addScaledVector(d, 2.2).addScaledVector(r, -2.3); }
  } else if (kind === 'travel') {
    if (nr) { P.copy(b).addScaledVector(d, -5.6).addScaledVector(UP, 4.2); T.copy(b).addScaledVector(d, 1.2).addScaledVector(UP, -0.9); }
    else { P.copy(b).addScaledVector(d, -5.2).addScaledVector(UP, 3.3).addScaledVector(r, -0.3); T.copy(b).addScaledVector(d, 1.4).addScaledVector(r, -1.3); }
  } else { // content
    if (nr) { P.copy(b).addScaledVector(d, -4.8).addScaledVector(UP, 3.5); T.copy(b).addScaledVector(d, 0.4).addScaledVector(UP, -1.7); }
    else { P.copy(b).addScaledVector(d, -3.7).addScaledVector(UP, 2.25).addScaledVector(r, -0.5); T.copy(b).addScaledVector(d, 0.5).addScaledVector(r, 1.75); }
  }
  return out;
}
function mlpPose(out, angle, shiftRight, R, focusOut, upOff) {
  const c = _t.copy(netCenterLocal).add(net.position); const nr = narrow();
  R = R || (nr ? 19 : 10); if (nr && !focusOut) angle = 1.05;
  out.pos.set(c.x + Math.sin(angle) * R, c.y + 2.6, c.z + Math.cos(angle) * R);
  const anchor = focusOut ? _p.copy(nodes[OUT].target).add(net.position) : c;
  const fwd = _d.subVectors(anchor, out.pos).normalize(); const right = _r.crossVectors(fwd, UP).normalize();
  out.target.copy(anchor).addScaledVector(right, shiftRight || 0).addScaledVector(UP, upOff || 0);
  return out;
}
const want = { pos: new THREE.Vector3(), target: new THREE.Vector3() }, alt = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
let camInit = false;

// ───────── intro (time) + journey (scroll) ─────────
const T = () => window.T || { ballP: 0, kind: 'hero', finalU: 0, stops: 7, visited: 0 };
let introT0 = null, introDone = false, introSkipped = false;
const ui = document.getElementById('intro-ui'), cap = document.getElementById('intro-cap');
function finishIntro() { if (introDone) return; introDone = true; document.documentElement.classList.remove('intro'); document.documentElement.classList.add('ready'); if (ui) { ui.classList.add('out'); setTimeout(() => ui.remove(), 700); } window.dispatchEvent(new CustomEvent('introdone')); }
window.introSkip = () => { introSkipped = true; finishIntro(); };
document.getElementById('intro-skip')?.addEventListener('click', window.introSkip);
let lastBall = new THREE.Vector3(), rollAxis = new THREE.Vector3(1, 0, 0), ballQuat = new THREE.Quaternion();

let lastNow = 0;
function update(now) {
  const tj = T(); const t = now / 1000; const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 1 / 60; lastNow = now;
  if (tj.stops !== stopRings.length) { buildStops(tj.stops); theme(); }
  // ── timeline values ──
  let ballP = tj.ballP, kind = tj.kind, finalU = tj.finalU || 0;
  let landScale = 1, landAlpha = 1, netA = 0, assemble = 1, lit = () => 0, pulseA = 0, pivot = START, camKind = kind, mlpMix = 0, mlpAngle = 0.38, nodeAlphaOthers = 1;
  if (!introDone) {
    if (introT0 === null) introT0 = t; const it = reduced || introSkipped ? 99 : t - introT0;
    pivot = START; anchorNet(START);
    assemble = ease3((it - 0.3) / 1.25);
    const pu = clamp((it - 1.45) / 1.1); lit = (li) => pu > 0 && pu < 1 ? Math.max(0, 1 - Math.abs(pu * (layers.length + 0.6) - li - 0.5) * 1.3) : 0; pulseA = pu > 0 && pu < 1 ? 0.9 : 0;
    const dive = ease3((it - 2.45) / 1.0);               // camera dives into the output neuron
    const enter = smooth((it - 3.05) / 0.85);            // inside: the landscape unfolds, the network fades
    landScale = 0.02 + 0.98 * enter; landAlpha = enter; netA = 1 - smooth((it - 2.9) / 0.55); mlpAngle = 0.38 + Math.sin(it * 0.45) * 0.22;
    ballP = 0; camKind = 'hero'; mlpMix = 1 - enter;
    // camera: mlp orbit → dive pose → hero pose
    mlpPose(want, mlpAngle, 0, undefined, false, narrow() ? -0.8 : 0); const outW = _t.copy(START);
    const divePos = alt.pos.copy(want.pos).sub(outW).normalize().multiplyScalar(0.55).add(outW);
    want.pos.lerp(divePos, dive); want.target.lerp(outW, dive);
    poseAt(0, 'hero', alt); want.pos.lerp(alt.pos, enter); want.target.lerp(alt.target, enter);
    if (cap) cap.textContent = it < 1.45 ? 'assembling…' : it < 2.45 ? 'forward pass' : it < 3.05 ? 'into a neuron' : '';
    if (it >= 3.2 && !document.documentElement.classList.contains('ready')) document.documentElement.classList.add('ready');
    if (it >= 3.9) finishIntro();
    if (!camInit) { camPos.copy(want.pos); camTarget.copy(want.target); camInit = true; }
    const ki = 1 - Math.exp(-dt * 26); camPos.lerp(want.pos, ki); camTarget.lerp(want.target, ki);
  } else {
    poseAt(ballP, camKind === 'final' ? 'content' : camKind, want);
    if (kind === 'final') {
      pivot = END; anchorNet(END);
      const fold = smooth((finalU - 0.08) / 0.5);         // landscape folds back into the ball
      landScale = 1 - 0.98 * fold; landAlpha = 1 - fold;
      assemble = ease3((finalU - 0.3) / 0.5); netA = smooth((finalU - 0.22) / 0.3);
      mlpMix = smooth((finalU - 0.12) / 0.6); mlpAngle = 0.38 + Math.sin(t * 0.25) * 0.12;
      if (narrow()) mlpPose(alt, 1.4, 0, 10, true, -1.3); else mlpPose(alt, 0.95 + Math.sin(t * 0.25) * 0.06, 2.1, 13.5, true, 0.2);
      want.pos.lerp(alt.pos, mlpMix); want.target.lerp(alt.target, mlpMix);
    }
    // idle drift so the camera never feels locked
    want.pos.x += Math.sin(t * 0.37) * 0.06; want.pos.y += Math.sin(t * 0.29) * 0.04; want.pos.z += Math.cos(t * 0.31) * 0.05;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 4.5);
    if (!camInit) { camPos.copy(want.pos); camTarget.copy(want.target); camInit = true; }
    camPos.lerp(want.pos, k); camTarget.lerp(want.target, k);
  }
  // ── apply land scale about the pivot ──
  land.scale.setScalar(landScale); land.position.copy(pivot).multiplyScalar(1 - landScale);
  wire.material.opacity = (window.currentTheme && window.currentTheme() === 'dark' ? 0.4 : 0.32) * landAlpha; dots.material.opacity = 0.78 * landAlpha; pathLine.material.opacity = 0.85 * landAlpha; shadow.material.opacity = 0.16 * landAlpha;
  stopRings.forEach((r, i) => { const visited = i < (tj.visited || 0); r.material.opacity = (visited ? 0.6 : 0.22) * landAlpha; });
  land.visible = landAlpha > 0.003;
  // ── ball ──
  const bl = pathPoint(ballP, _p); const bw = land.localToWorld(bl.clone()); bw.y += 0.14 * landScale + 0.145;
  ballG.position.copy(bw);
  shadow.position.set(bl.x, bl.y + 0.012, bl.z);
  const step = bw.distanceTo(lastBall); if (step > 1e-5 && step < 1) { const dir = _d.subVectors(bw, lastBall).normalize(); rollAxis.crossVectors(UP, dir).normalize(); const q = new THREE.Quaternion().setFromAxisAngle(rollAxis, step / 0.14); ballQuat.premultiply(q); ball.quaternion.copy(ballQuat); } lastBall.copy(bw);
  ball.scale.setScalar(1 + 0.03 * Math.sin(t * 2.1)); glow.material.opacity = 0.45 + 0.12 * Math.sin(t * 1.7);
  // ── network ──
  netAlpha(netA); if (netA > 0.005) { layoutNet(assemble, lit, t, introDone); const ob = nodeMeshes[OUT]; ob.position.copy(nodes[OUT].target); }
  if (pulseA > 0) { for (let i = 0; i < NPULSE; i++) { const [a, b] = edges[pEdge[i]]; const s = clamp(clamp((t - introT0 - 1.45) / 1.1) * layers.length - nodes[a].li - (i % 7) * 0.04); const p = nodeMeshes[a].position, q = nodeMeshes[b].position; pPos[i * 3] = p.x + (q.x - p.x) * s; pPos[i * 3 + 1] = p.y + (q.y - p.y) * s; pPos[i * 3 + 2] = p.z + (q.z - p.z) * s; } pGeo.attributes.position.needsUpdate = true; }
  pulse.material.opacity = pulseA;
  // ── camera ──
  camera.position.copy(camPos); camera.lookAt(camTarget);
  renderer.render(scene, camera);
  // expose ball screen position for the DOM
  window.__ball = bw.clone().project(camera); const v = window.__ball; document.documentElement.style.setProperty('--bx', ((v.x + 1) / 2 * window.innerWidth).toFixed(0) + 'px'); document.documentElement.style.setProperty('--by', ((1 - v.y) / 2 * window.innerHeight).toFixed(0) + 'px');
}
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize);
buildStops(T().stops); theme(); resize();
let running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(loop); });
function loop(now) { if (!running) return; update(now); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
