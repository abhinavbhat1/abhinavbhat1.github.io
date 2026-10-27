/* Background: a loss landscape. The marker rolls along a precomputed
   gradient-descent path as the reader scrolls through the CV journey. */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

const canvas = document.getElementById('landscape');
if (!canvas) throw new Error('no landscape canvas');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
catch (e) { canvas.style.display = 'none'; throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const group = new THREE.Group(); scene.add(group);

const BUMPS = [
  { a: -2.4, x: 2.2, y: -1.6, s: 2.4 },  // global minimum: the end of the CV
  { a: -1.0, x: -2.6, y: 1.8, s: 1.6 },
  { a: 0.9, x: -0.3, y: -0.2, s: 1.4 },
  { a: 0.6, x: 1.0, y: 2.6, s: 1.1 },
];
function f(x, y) { let v = 0.07 * (x * x + y * y); for (const b of BUMPS) { const dx = x - b.x, dy = y - b.y; v += b.a * Math.exp(-(dx * dx + dy * dy) / b.s); } return v + 0.05 * Math.sin(1.7 * x) * Math.cos(1.5 * y); }
function grad(x, y) { const h = 1e-3; return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)]; }

// descent path, resampled to equal arc length so scrolling moves the ball at a steady pace
const raw = [[-3.4, 3.6]]; let v = [0, 0];
for (let i = 0; i < 900; i++) { const [x, y] = raw[raw.length - 1]; const g = grad(x, y); v = [0.9 * v[0] + g[0], 0.9 * v[1] + g[1]]; raw.push([x - 0.06 * v[0], y - 0.06 * v[1]]); if (i > 120 && Math.hypot(g[0], g[1]) < 1e-3 && Math.hypot(v[0], v[1]) < 1e-3) break; }
const lens = [0]; for (let i = 1; i < raw.length; i++) lens.push(lens[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
const total = lens[lens.length - 1], NP = 400, path = [];
for (let k = 0; k < NP; k++) { const t = (k / (NP - 1)) * total; let i = 1; while (i < lens.length - 1 && lens[i] < t) i++; const u = (t - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1); path.push([raw[i - 1][0] + u * (raw[i][0] - raw[i - 1][0]), raw[i - 1][1] + u * (raw[i][1] - raw[i - 1][1])]); }
const fStart = f(...path[0]), fEnd = f(...path[NP - 1]);

const SIZE = 16, SEG = window.innerWidth < 720 ? 64 : 100, ZS = 1.0;
const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
const pos = geo.attributes.position, col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3); geo.setAttribute('color', col);
let zmin = Infinity, zmax = -Infinity; const zs = new Float32Array(pos.count);
for (let i = 0; i < pos.count; i++) { const z = f(pos.getX(i), pos.getZ(i)); zs[i] = z; zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); pos.setY(i, z * ZS); }
pos.needsUpdate = true;
const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, wireframe: true, transparent: true, opacity: 0.4 })); group.add(wire);
const dots = new THREE.Points(geo, new THREE.PointsMaterial({ vertexColors: true, size: 0.04, transparent: true, opacity: 0.85 })); group.add(dots);
const pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.map(p => new THREE.Vector3(p[0], f(p[0], p[1]) * ZS + 0.03, p[1]))), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 })); group.add(pathLine);
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 18), new THREE.MeshBasicMaterial()); group.add(ball);
const halo = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.3, 32), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; group.add(halo);

const lo = new THREE.Color(), hi = new THREE.Color(), tmp = new THREE.Color();
function theme() {
  const cs = getComputedStyle(document.documentElement);
  const dark = (window.currentTheme ? window.currentTheme() : 'light') === 'dark';
  // NYU violet → lavender
  lo.set(dark ? '#57068c' : '#57068c'); hi.set(dark ? '#cba4ff' : '#b388ff');
  if (!dark) { lo.lerp(new THREE.Color('#ffffff'), 0.15); hi.lerp(new THREE.Color('#ffffff'), 0.2); }
  for (let i = 0; i < pos.count; i++) { const u = (zs[i] - zmin) / (zmax - zmin || 1); tmp.copy(lo).lerp(hi, Math.pow(u, 0.8)); col.setXYZ(i, tmp.r, tmp.g, tmp.b); }
  col.needsUpdate = true;
  const bc = new THREE.Color(cs.getPropertyValue('--ball').trim() || '#8900e1');
  pathLine.material.color.copy(bc); ball.material.color.copy(bc); halo.material.color.copy(bc);
  wire.material.opacity = dark ? 0.42 : 0.3; dots.material.opacity = dark ? 0.9 : 0.7;
}
window.addEventListener('themechange', theme); theme();

let shown = 0;
const camOff = new THREE.Vector3(0, 5.4, 7.2), look = new THREE.Vector3(), camTarget = new THREE.Vector3();
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lossV = document.getElementById('loss-v'), lossBar = document.getElementById('loss-bar');
function target() { return window.journeyProgress ? window.journeyProgress() : 0; }
function update() {
  const p = target();
  shown += (p - shown) * (reduced ? 1 : 0.1); if (Math.abs(p - shown) < 1e-4) shown = p;
  const k = shown * (NP - 1), i = Math.floor(k), u = k - i, p0 = path[i], p1 = path[Math.min(NP - 1, i + 1)];
  const x = p0[0] + u * (p1[0] - p0[0]), y = p0[1] + u * (p1[1] - p0[1]), z = f(x, y) * ZS + 0.13;
  ball.position.set(x, z, y); halo.position.set(x, z - 0.11, y);
  look.set(x, z, y); camTarget.copy(look).add(camOff);
  camera.position.lerp(camTarget, reduced ? 1 : 0.1); camera.lookAt(look.x, look.y - 0.6, look.z);
  group.rotation.y = -0.25 + 0.35 * shown;
  const lossNorm = Math.max(0, (f(x, y) - fEnd) / (fStart - fEnd));
  if (lossV) lossV.textContent = lossNorm.toFixed(2);
  if (lossBar) lossBar.style.transform = `scaleX(${lossNorm})`;
  renderer.render(scene, camera);
  return Math.abs(p - shown) > 1e-4;
}
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); camOff.set(0, w < 720 ? 6.5 : 5.4, w < 720 ? 9.5 : 7.2); update(); }
window.addEventListener('resize', resize);
let raf = 0, idle = 0;
function loop() { const moving = update(); idle = moving ? 0 : idle + 1; if (idle < 20 && !document.hidden) raf = requestAnimationFrame(loop); else raf = 0; }
function kick() { idle = 0; if (!raf) raf = requestAnimationFrame(loop); }
window.addEventListener('scroll', kick, { passive: true });
document.addEventListener('visibilitychange', kick);
window.addEventListener('themechange', kick);
window.addEventListener('journeychange', kick);
camera.position.set(path[0][0], f(...path[0]) + 0.13, path[0][1]).add(camOff);
resize(); kick();
