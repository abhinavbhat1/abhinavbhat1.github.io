/* The ball on the loss landscape is the protagonist.
   main.js tells us where the ball should be (window.J.target), what the page is doing
   (window.J.mode: hero | travel | sub | final | finalsub) and how many stops were visited.
   We move the camera, roll the ball, burst rings when panels open/close, and in the finale
   pull the camera up so every visited stop pours into the converged point. */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

const canvas = document.getElementById('landscape');
if (!canvas) throw new Error('no landscape canvas');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch (e) { canvas.style.display = 'none'; throw e; }
const narrow = () => window.innerWidth < 900;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow() ? 1.5 : 1.75));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
const group = new THREE.Group(); scene.add(group);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── loss function + descent path ──
const BUMPS = [{ a: -2.4, x: 2.2, y: -1.6, s: 2.4 }, { a: -1.0, x: -2.6, y: 1.8, s: 1.6 }, { a: 0.9, x: -0.3, y: -0.2, s: 1.4 }, { a: 0.6, x: 1.0, y: 2.6, s: 1.1 }];
function f(x, y) { let v = 0.07 * (x * x + y * y); for (const b of BUMPS) { const dx = x - b.x, dy = y - b.y; v += b.a * Math.exp(-(dx * dx + dy * dy) / b.s); } return v + 0.05 * Math.sin(1.7 * x) * Math.cos(1.5 * y); }
function grad(x, y) { const h = 1e-3; return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)]; }
const raw = [[-3.4, 3.6]]; let v = [0, 0];
for (let i = 0; i < 900; i++) { const [x, y] = raw[raw.length - 1]; const g = grad(x, y); v = [0.9 * v[0] + g[0], 0.9 * v[1] + g[1]]; raw.push([x - 0.06 * v[0], y - 0.06 * v[1]]); if (i > 120 && Math.hypot(g[0], g[1]) < 1e-3 && Math.hypot(v[0], v[1]) < 1e-3) break; }
const lens = [0]; for (let i = 1; i < raw.length; i++) lens.push(lens[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
const total = lens[lens.length - 1], NP = 400, path = [];
for (let k = 0; k < NP; k++) { const t = (k / (NP - 1)) * total; let i = 1; while (i < lens.length - 1 && lens[i] < t) i++; const u = (t - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1); path.push([raw[i - 1][0] + u * (raw[i][0] - raw[i - 1][0]), raw[i - 1][1] + u * (raw[i][1] - raw[i - 1][1])]); }
const ZS = 1.0;
const pathPoint = (p) => { const k = Math.max(0, Math.min(1, p)) * (NP - 1), i = Math.floor(k), u = k - i, p0 = path[i], p1 = path[Math.min(NP - 1, i + 1)]; const x = p0[0] + u * (p1[0] - p0[0]), y = p0[1] + u * (p1[1] - p0[1]); return new THREE.Vector3(x, f(x, y) * ZS, y); };

// ── surface ──
const SIZE = 16, SEG = narrow() ? 60 : 100;
const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
const pos = geo.attributes.position, col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3); geo.setAttribute('color', col);
let zmin = Infinity, zmax = -Infinity; const zs = new Float32Array(pos.count);
for (let i = 0; i < pos.count; i++) { const z = f(pos.getX(i), pos.getZ(i)); zs[i] = z; zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); pos.setY(i, z * ZS); }
pos.needsUpdate = true;
const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, wireframe: true, transparent: true, opacity: 0.4 })); group.add(wire);
const dots = new THREE.Points(geo, new THREE.PointsMaterial({ vertexColors: true, size: 0.04, transparent: true, opacity: 0.85 })); group.add(dots);
const pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.map(p => new THREE.Vector3(p[0], f(p[0], p[1]) * ZS + 0.03, p[1]))), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 })); group.add(pathLine);

// ── the ball ──
const ballMat = new THREE.MeshBasicMaterial();
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), ballMat); group.add(ball);
const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.18 })); group.add(glow);
const halo = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; group.add(halo);
// ring bursts (open / close transitions)
const ringGeo = new THREE.RingGeometry(0.9, 1.0, 64); const rings = [];
function burst(kind) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  m.material.color.copy(ballMat.color); m.rotation.x = -Math.PI / 2; m.position.copy(ball.position); m.position.y += 0.02; group.add(m);
  rings.push({ m, t: 0, kind }); ballKick = kind === 'open' ? 1 : 0.6;
}
let ballKick = 0;
window.ballEvent = (kind) => { if (!reduced) burst(kind); };

// ── stop nodes: one per section, lit once visited; pour into the ball in the finale ──
const stopsGroup = new THREE.Group(); group.add(stopsGroup);
let stopMeshes = [];
function buildStops(n) {
  stopMeshes.forEach(m => stopsGroup.remove(m)); stopMeshes = [];
  for (let i = 0; i < n; i++) { const p = pathPoint((i + 1) / n); const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 14), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.25 })); m.position.copy(p); m.position.y += 0.08; stopsGroup.add(m); stopMeshes.push(m); }
}
const NPART = narrow() ? 220 : 420;
const partGeo = new THREE.BufferGeometry(); const partPos = new Float32Array(NPART * 3); partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
const parts = new THREE.Points(partGeo, new THREE.PointsMaterial({ size: 0.06, transparent: true, opacity: 0, depthWrite: false })); group.add(parts);
const partState = Array.from({ length: NPART }, (_, i) => ({ node: 0, t: Math.random(), speed: 0.004 + Math.random() * 0.006, lift: 0.4 + Math.random() * 1.2, wob: Math.random() * 6.28 }));

// ── colours ──
const lo = new THREE.Color(), hi = new THREE.Color(), tmp = new THREE.Color();
function theme() {
  const cs = getComputedStyle(document.documentElement);
  const dark = (window.currentTheme ? window.currentTheme() : 'light') === 'dark';
  lo.set('#57068c'); hi.set(dark ? '#cba4ff' : '#b388ff');
  if (!dark) { lo.lerp(new THREE.Color('#ffffff'), 0.15); hi.lerp(new THREE.Color('#ffffff'), 0.2); }
  for (let i = 0; i < pos.count; i++) { const u = (zs[i] - zmin) / (zmax - zmin || 1); tmp.copy(lo).lerp(hi, Math.pow(u, 0.8)); col.setXYZ(i, tmp.r, tmp.g, tmp.b); }
  col.needsUpdate = true;
  const bc = new THREE.Color(cs.getPropertyValue('--ball').trim() || '#8900e1');
  pathLine.material.color.copy(bc); ballMat.color.copy(bc); glow.material.color.copy(bc); halo.material.color.copy(bc); parts.material.color.copy(bc);
  stopMeshes.forEach(m => m.material.color.copy(bc));
  wire.material.opacity = dark ? 0.42 : 0.3; dots.material.opacity = dark ? 0.9 : 0.7;
}
window.addEventListener('themechange', theme);

// ── camera choreography ──
const J = () => window.J || { target: 0, mode: 'hero', visited: 0, stops: 8 };
const look = new THREE.Vector3(), camTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3(), off = new THREE.Vector3();
let shown = 0, shownShift = 0, shownLift = 0, lastStops = 0, partAlpha = 0, finalK = 0;
const v3 = new THREE.Vector3();
window.ballScreen = () => { v3.copy(ball.position); group.localToWorld(v3); v3.project(camera); return { x: (v3.x + 1) / 2 * window.innerWidth, y: (1 - v3.y) / 2 * window.innerHeight }; };
function update() {
  const j = J(), mode = j.mode, nr = narrow();
  if (j.stops !== lastStops) { lastStops = j.stops; buildStops(j.stops); theme(); }
  const p = j.target;
  shown += (p - shown) * (reduced ? 1 : 0.045); if (Math.abs(p - shown) < 1e-4) shown = p;
  const bp = pathPoint(shown); const lift = 0.13 + 0.07 * Math.max(0, ballKick);
  ball.position.set(bp.x, bp.y + lift, bp.z); glow.position.copy(ball.position); halo.position.set(bp.x, bp.y + 0.02, bp.z);
  const s = 1 + 0.55 * ballKick; ball.scale.setScalar(s); glow.scale.setScalar(1 + 0.9 * ballKick); ballKick *= 0.9;
  halo.scale.setScalar(1 + 0.12 * Math.sin(performance.now() / 300)); halo.rotation.z += 0.01;
  // rings
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += 0.028; const k = r.kind === 'open' ? r.t : 1 - r.t; r.m.scale.setScalar(0.15 + 2.6 * k); r.m.material.opacity = 0.9 * (1 - r.t); if (r.t >= 1) { group.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); } }
  // camera offset per mode
  const isFinal = mode === 'final' || mode === 'finalsub';
  finalK += ((isFinal ? 1 : 0) - finalK) * 0.05;
  if (mode === 'sub') off.set(0, nr ? 4.2 : 3.4, nr ? 6.2 : 4.8); else off.set(0, nr ? 6.5 : 5.4, nr ? 9.5 : 7.2);
  const wide = new THREE.Vector3(0, nr ? 15 : 12.5, nr ? 9 : 8.5);
  off.lerp(wide, finalK);
  lookTarget.copy(ball.position); if (finalK > 0.001) { const c = pathPoint(0.5); lookTarget.lerp(new THREE.Vector3(c.x, c.y - 1.5, c.z), finalK * 0.6); }
  look.lerp(lookTarget, reduced ? 1 : 0.08);
  camTarget.copy(look).add(off); camera.position.lerp(camTarget, reduced ? 1 : 0.07);
  camera.lookAt(look.x, look.y - 0.6 * (1 - finalK), look.z);
  group.rotation.y = -0.25 + 0.35 * shown;
  const W = window.innerWidth, Hh = window.innerHeight;
  const sh = nr ? 0 : (mode === 'hero' ? -0.4 : mode === 'travel' ? -0.62 : mode === 'sub' ? (window.SUBSHIFT ?? 0.55) : mode === 'finalsub' ? 0.5 : 0);
  const lf = nr ? (mode === 'hero' ? -0.25 : (mode === 'sub' || mode === 'finalsub') ? 0.12 : 0) : (mode === 'travel' ? -0.1 : 0.02);
  shownShift += (sh - shownShift) * 0.08; shownLift += (lf - shownLift) * 0.08;
  camera.setViewOffset(W, Hh, shownShift * W * 0.5, shownLift * Hh, W, Hh);
  // stops + particles
  stopMeshes.forEach((m, i) => { const vis = i < j.visited; const target = isFinal ? 1 : vis ? 0.75 : 0.22; m.material.opacity += (target - m.material.opacity) * 0.08; m.scale.setScalar(isFinal ? 1.6 + 0.3 * Math.sin(performance.now() / 250 + i) : 1); });
  partAlpha += ((isFinal ? 0.9 : 0) - partAlpha) * 0.06; parts.material.opacity = partAlpha;
  if (partAlpha > 0.01 && stopMeshes.length) {
    const end = ball.position;
    for (let i = 0; i < NPART; i++) { const ps = partState[i]; ps.t += ps.speed; if (ps.t > 1) { ps.t = 0; ps.node = Math.floor(Math.random() * stopMeshes.length); } const a = stopMeshes[ps.node].position; const t = ps.t, e = t * t * (3 - 2 * t); const x = a.x + (end.x - a.x) * e, z = a.z + (end.z - a.z) * e; const y = a.y + (end.y - a.y) * e + Math.sin(t * Math.PI) * ps.lift + 0.05 * Math.sin(ps.wob + t * 12); partPos[i * 3] = x; partPos[i * 3 + 1] = y; partPos[i * 3 + 2] = z; }
    partGeo.attributes.position.needsUpdate = true;
  }
  renderer.render(scene, camera);
  const b = window.ballScreen(); document.documentElement.style.setProperty('--bx', b.x.toFixed(0) + 'px'); document.documentElement.style.setProperty('--by', b.y.toFixed(0) + 'px');
  return Math.abs(p - shown) > 1e-4 || rings.length > 0 || ballKick > 0.01 || partAlpha > 0.01 || camera.position.distanceTo(camTarget) > 0.01;
}
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); update(); }
window.addEventListener('resize', resize);
let raf = 0, idle = 0;
function loop() { const moving = update(); idle = moving ? 0 : idle + 1; if (idle < 90 && !document.hidden) raf = requestAnimationFrame(loop); else raf = 0; }
function kick() { idle = 0; if (!raf) raf = requestAnimationFrame(loop); }
window.addEventListener('scroll', kick, { passive: true }); document.addEventListener('visibilitychange', kick); window.addEventListener('themechange', kick); window.addEventListener('journeychange', kick);
setInterval(kick, 900); // keep the halo breathing even when nothing else moves
buildStops(J().stops); theme();
const start = pathPoint(0); look.copy(start); camera.position.copy(start).add(new THREE.Vector3(0, 5.4, 7.2));
resize(); kick();
