/* Opening: a 3D MLP assembles on white, fires a forward pass, then the camera
   flies into one output neuron, which fills the screen and becomes the page. */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

const box = document.getElementById('intro'), canvas = document.getElementById('intro-canvas');
if (!box || !canvas) throw new Error('no intro');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let finished = false;
function finish() { if (finished) return; finished = true; box.classList.add('out'); document.body.classList.add('ready'); setTimeout(() => { box.remove(); renderer && renderer.dispose(); }, 900); }
window.introSkip = finish;
let renderer;
if (reduced) { finish(); }
else {
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); } catch (e) { finish(); }
}
if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0xffffff, 1);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xffffff, 11, 20);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
  const V = new THREE.Color('#57068c'), V2 = new THREE.Color('#8900e1'), WHITE = new THREE.Color('#ffffff');
  const layers = [4, 6, 7, 6, 3], nodes = [], edges = [];
  const r = () => Math.random();
  layers.forEach((n, li) => { for (let k = 0; k < n; k++) { const ang = (k / n) * Math.PI * 2 + li * 0.4, rad = n === 1 ? 0 : 0.55 + 0.42 * Math.sqrt(n); nodes.push({ li, k, target: new THREE.Vector3((li - (layers.length - 1) / 2) * 2.1, Math.cos(ang) * rad * 0.75, Math.sin(ang) * rad * 0.75), from: new THREE.Vector3((r() - 0.5) * 16, (r() - 0.5) * 10, (r() - 0.5) * 10), ph: r() * 6.28 }); } });
  let base = 0; layers.forEach((n, li) => { if (li < layers.length - 1) for (let a = 0; a < n; a++) for (let b = 0; b < layers[li + 1]; b++) edges.push([base + a, base + n + b]); base += n; });
  const sphereGeo = new THREE.SphereGeometry(0.12, 24, 24);
  const meshes = nodes.map(n => { const m = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: V.clone() })); m.position.copy(n.from); scene.add(m); return m; });
  const ePos = new Float32Array(edges.length * 6); const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  const eLines = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({ color: V, transparent: true, opacity: 0 })); scene.add(eLines);
  // signal particles travelling along edges
  const NP = Math.min(edges.length, 160); const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(NP * 3); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: V2, size: 0.09, transparent: true, opacity: 0 })); scene.add(pts);
  const pEdge = Array.from({ length: NP }, () => Math.floor(r() * edges.length));
  const out = meshes[meshes.length - 2]; // the neuron we fly into
  function size() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  size(); window.addEventListener('resize', size);
  const t0 = performance.now(); const ease = (t) => 1 - Math.pow(1 - t, 3), clamp = (v) => Math.max(0, Math.min(1, v));
  const cap = box.querySelector('.cap');
  const camFrom = new THREE.Vector3(0, 2.2, 11.5), tmp = new THREE.Vector3(); const R = () => innerWidth < 700 ? 15 : 11.5;
  function frame(now) {
    if (finished) return;
    const t = (now - t0) / 1000;
    const a = ease(clamp((t - 0.35) / 1.2));           // scatter → assembled
    const pulse = clamp((t - 1.5) / 1.1);              // forward pass sweep
    const fly = ease(clamp((t - 2.7) / 1.05));          // fly into the neuron
    nodes.forEach((n, i) => { const m = meshes[i]; tmp.copy(n.from).lerp(n.target, a); tmp.y += Math.sin(t * 2 + n.ph) * 0.03 * (1 - fly); m.position.copy(tmp); const lit = pulse > 0 && pulse < 1 ? Math.max(0, 1 - Math.abs(pulse * (layers.length + 0.5) - n.li - 0.5) * 1.2) : 0; m.material.color.copy(V).lerp(V2, lit).lerp(WHITE, 0.0); m.scale.setScalar(0.6 + 0.4 * a + 0.5 * lit); });
    edges.forEach(([i, j], e) => { const p = meshes[i].position, q = meshes[j].position; ePos[e * 6] = p.x; ePos[e * 6 + 1] = p.y; ePos[e * 6 + 2] = p.z; ePos[e * 6 + 3] = q.x; ePos[e * 6 + 4] = q.y; ePos[e * 6 + 5] = q.z; });
    eGeo.attributes.position.needsUpdate = true; eLines.material.opacity = 0.35 * a * (1 - fly);
    for (let i = 0; i < NP; i++) { const [a1, b1] = edges[pEdge[i]]; const s = clamp(pulse * (layers.length) - nodes[a1].li - (i % 7) * 0.04); const p = meshes[a1].position, q = meshes[b1].position; pPos[i * 3] = p.x + (q.x - p.x) * s; pPos[i * 3 + 1] = p.y + (q.y - p.y) * s; pPos[i * 3 + 2] = p.z + (q.z - p.z) * s; }
    pGeo.attributes.position.needsUpdate = true; pts.material.opacity = (pulse > 0 && pulse < 1 ? 0.9 : 0) * (1 - fly);
    // camera: slow orbit, then dive into the output neuron
    const orbit = 0.38 + Math.sin(t * 0.45) * 0.22; camFrom.set(Math.sin(orbit) * R(), 2.6 + Math.sin(t * 0.5) * 0.4, Math.cos(orbit) * R());
    const dive = out.position.clone().add(new THREE.Vector3(0.35, 0.05, 0.05).multiplyScalar(0.42 - 0.41 * fly));
    camera.position.copy(camFrom).lerp(dive, fly); camera.lookAt(fly > 0.02 ? out.position : new THREE.Vector3(0, 0, 0));
    out.material.color.lerp(V2, fly * 0.6); out.scale.setScalar(1 + fly * 1.2);
    if (cap) cap.textContent = t < 1.5 ? 'assembling…' : t < 2.7 ? 'forward pass' : '';
    renderer.render(scene, camera);
    if (t > 3.75) finish(); else requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => window.addEventListener(ev, (e) => { if (e.target && e.target.closest && e.target.closest('#intro-skip')) return; finish(); }, { once: true, passive: true }));
