/* Theme, the two modes (journey / boring), the cards that neurons burst into, the pixel-melt home transition,
   focus re-weighting, and the small experiments. The drawing and the scroll journey live in scene.js. */
(function () {
  'use strict';
  const root = document.documentElement, $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ── Theme ──
  function currentTheme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  window.currentTheme = currentTheme;
  function setTheme(t) { root.setAttribute('data-theme', t); try { localStorage.setItem('theme', t); } catch (e) {} window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } })); }
  $('theme-toggle').addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));

  // ── Layers and cards: every entry in the document is one neuron; in journey mode it lives in a card ──
  const cardsHost = $('cards');
  const LAYERS = Array.from(document.querySelectorAll('.sec[data-layer]')).map(sec => ({
    id: sec.id, name: sec.dataset.layer, sec,
    cards: Array.from(sec.querySelectorAll('.entry')).map(entry => { const el = document.createElement('div'); el.className = 'jcard'; cardsHost.appendChild(el); return { el, entry, short: entry.dataset.short || '', home: entry.parentElement, next: entry.nextElementSibling }; })
  }));
  window.LAYERS = LAYERS;
  function currentMode() { return root.getAttribute('data-mode') === 'boring' ? 'boring' : 'journey'; }
  window.currentMode = currentMode;
  function placeEntries(mode) { LAYERS.forEach(L => L.cards.forEach(c => { if (mode === 'journey') { if (c.entry.parentElement !== c.el) c.el.appendChild(c.entry); } else if (c.entry.parentElement !== c.home) { c.home.insertBefore(c.entry, c.next && c.next.parentElement === c.home ? c.next : null); } })); }
  function setMode(m, keepScroll) { root.setAttribute('data-mode', m); try { localStorage.setItem('mode', m); } catch (e) {} placeEntries(m); if (!keepScroll) window.scrollTo(0, 0); window.dispatchEvent(new CustomEvent('modechange', { detail: { mode: m } })); }
  placeEntries(currentMode());
  $('mode-toggle').addEventListener('click', () => setMode(currentMode() === 'journey' ? 'boring' : 'journey'));
  window.setMode = setMode;

  // ── Nav: in journey mode a link jumps to that layer; in boring mode it scrolls to the section ──
  document.querySelectorAll('.nav a[href^="#"]').forEach(a => a.addEventListener('click', (e) => { const id = a.getAttribute('href').slice(1); if (currentMode() === 'journey' && window.jumpToLayer) { e.preventDefault(); window.jumpToLayer(id); } else { const el = $(id); if (el) { e.preventDefault(); window.scrollTo({ top: el.offsetTop - 70, behavior: reduced ? 'auto' : 'smooth' }); } } }));

  // ── Experiments run once when their panel is opened ──
  document.querySelectorAll('details.try[data-auto]').forEach(d => { d.addEventListener('toggle', () => { if (!d.open || d.dataset.played) return; d.dataset.played = '1'; const fn = window.AUTO && window.AUTO[d.dataset.auto]; const badge = d.querySelector('[data-auto-badge]'); if (fn) setTimeout(() => fn(() => { if (badge) { badge.textContent = 'try it yourself'; badge.classList.add('done'); } }), 200); }); });

  // ── Home: the page melts away pixel by pixel into black, then un-melts onto the top of the page ──
  let melting = false;
  const melt = (() => {
    const host = $('melt'), c = host.querySelector('canvas'), g = c.getContext('2d'); let cols = 0, rows = 0, cells = null; const S = 10;
    function setup() { const dpr = Math.min(window.devicePixelRatio || 1, 2); c.width = Math.ceil(window.innerWidth * dpr); c.height = Math.ceil(window.innerHeight * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); cols = Math.ceil(window.innerWidth / S); rows = Math.ceil(window.innerHeight / S); const r = rng((Date.now() & 0xffff) + 7); cells = new Float32Array(cols * rows); const drip = Array.from({ length: cols }, () => r()); for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells[j * cols + i] = 0.12 * (j / rows) + 0.55 * r() + 0.3 * drip[i]; }
    function draw(u) { const W = window.innerWidth, H = window.innerHeight; g.clearRect(0, 0, W, H); g.fillStyle = '#0b0b0c';
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const k = (u * 1.3 - cells[j * cols + i]) / 0.3; if (k <= 0) continue; const e = Math.min(1, k); g.fillRect(i * S, j * S - 1, S + 1, S * e + e * S * 2.4); }
      const fade = Math.max(0, (u - 0.82) / 0.18); if (fade > 0) { g.globalAlpha = fade; g.fillRect(0, 0, W, H); g.globalAlpha = 1; } }
    return function run(mid) { if (melting) return; melting = true; host.classList.add('on'); setup(); const t0 = performance.now(); const OUT = 720, HOLD = 140, IN = 720;
      function step(now) { const el = now - t0;
        if (el < OUT) { const u = el / OUT; draw(u * u * (3 - 2 * u)); }
        else if (el < OUT + HOLD) { if (!step.mid) { step.mid = true; draw(1); mid(); } }
        else if (el < OUT + HOLD + IN) { const u = 1 - (el - OUT - HOLD) / IN; draw(u * u * (3 - 2 * u)); }
        else { host.classList.remove('on'); g.clearRect(0, 0, window.innerWidth, window.innerHeight); melting = false; return; }
        requestAnimationFrame(step); }
      requestAnimationFrame(step); };
  })();
  const goHome = (e) => { e.preventDefault(); if (reduced) { window.scrollTo(0, 0); return; } melt(() => { window.scrollTo(0, 0); if (window.resetJourney) window.resetJourney(); }); };
  $('brand').addEventListener('click', goHome); $('to-top').addEventListener('click', goHome);
  window.meltHome = () => $('brand').click();

  // ── "What are you looking for?" ── every line carries data-w="ml,health,data,swe,lead" in [0,1]
  const TOPICS = ['ml', 'health', 'data', 'swe'];
  const NAMES = { ml: 'machine learning', health: 'healthcare AI', data: 'data engineering', swe: 'software engineering' };
  const lines = Array.from(document.querySelectorAll('.lines li[data-w]'));
  lines.forEach(li => { li._w = li.dataset.w.split(',').map(Number); });
  const note = $('focus-note');
  function applyFocus(f) {
    if (f === 'all') { lines.forEach(li => { li.classList.remove('hi', 'lo'); li.style.opacity = ''; }); note.textContent = 'Pick a focus and the page re-weights to it.'; return; }
    const k = TOPICS.indexOf(f); const scores = lines.map(li => li._w[k]);
    const mx = Math.max(...scores); const ex = scores.map(s => Math.exp(6 * (s - mx))); const Z = ex.reduce((a, b) => a + b, 0); const att = ex.map(e => e / Z); const amax = Math.max(...att);
    let kept = 0;
    lines.forEach((li, i) => { const rel = att[i] / amax; li.classList.toggle('hi', rel > 0.55); li.classList.toggle('lo', rel < 0.2); li.style.opacity = rel < 0.2 ? '' : (0.55 + 0.45 * rel).toFixed(2); if (rel > 0.55) kept++; });
    note.textContent = `Re-weighted for ${NAMES[f]}: ${kept} points highlighted.`;
  }
  document.querySelectorAll('#focus-chips .chip').forEach(c => c.addEventListener('click', () => { document.querySelectorAll('#focus-chips .chip').forEach(x => x.setAttribute('aria-pressed', 'false')); c.setAttribute('aria-pressed', 'true'); applyFocus(c.dataset.f); }));

  window.AUTO = {};
  const tween = (from, to, ms, step, done) => { const t0 = performance.now(); (function f(now) { const k = Math.max(0, Math.min(1, (now - t0) / ms)); step(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); else if (done) done(); })(t0); };

  // ── helpers ──
  const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
  const redraw = []; window.addEventListener('themechange', () => redraw.forEach(fn => fn()));
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const fmtN = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + ' billion' : n >= 1e6 ? (n / 1e6).toFixed(0) + ' million' : n >= 1e3 ? Math.round(n / 1e3).toLocaleString() + ' thousand' : String(Math.round(n));

  // ── JEPA: hide part of a scan, predict it from the rest ──
  (function () {
    const svg = $('jepa-svg'); if (!svg) return;
    const G = 8, C = 22, r0 = rng(7);
    const img = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const x = i / (G - 1), y = j / (G - 1); const v = 0.42 + 0.22 * Math.sin(3 * x + 1) * Math.cos(2.3 * y) + 0.55 * Math.exp(-((x - 0.6) ** 2 + (y - 0.4) ** 2) / 0.03) - 0.2 * Math.exp(-((x - 0.2) ** 2 + (y - 0.75) ** 2) / 0.06); img.push(Math.max(0, Math.min(1, v + 0.03 * gauss(r0)))); }
    const targets = new Set(); { const r = rng(101); let g = 0; while (targets.size < 18 && g++ < 100) { const w = 2 + Math.floor(r() * 2), h = 2 + Math.floor(r() * 2), x0 = Math.floor(r() * (G - w + 1)), y0 = Math.floor(r() * (G - h + 1)); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (targets.size < 18) targets.add(y * G + x); } }
    let prog = 0;
    svg.setAttribute('viewBox', `0 0 ${G * C * 2 + 44} ${G * C + 18}`);
    function draw() {
      svg.innerHTML = ''; const bg = css('--surface-2'), hl = css('--accent-2'), ar = css('--accent');
      const shade = (v) => { const a = Math.round(30 + v * 200); return `rgb(${a},${a},${a})`; };
      const r = rng(900);
      el('text', { x: 0, y: 10 }, svg).textContent = 'Scan with hidden blocks';
      el('text', { x: G * C + 44, y: 10 }, svg).textContent = `Prediction · ${Math.round(prog * 100)}% trained`;
      for (let k = 0; k < G * G; k++) {
        const x = (k % G) * C, y = Math.floor(k / G) * C + 16, hid = targets.has(k);
        el('rect', { x, y, width: C - 2, height: C - 2, rx: 3, fill: hid ? bg : shade(img[k]), stroke: hid ? hl : null, 'stroke-width': 1.5, 'stroke-dasharray': hid ? '3 2' : null }, svg);
        let v = img[k]; if (hid) { const guess = 0.5 + 0.35 * gauss(r); v = Math.max(0, Math.min(1, guess + (img[k] - guess) * Math.min(1, prog * 1.15))); }
        el('rect', { x: x + G * C + 44, y, width: C - 2, height: C - 2, rx: 3, fill: shade(v), stroke: hid ? hl : null, 'stroke-width': 1.2, 'stroke-opacity': 0.8 }, svg);
      }
      el('path', { d: `M${G * C + 8},${G * C / 2 + 16} h26 m-6,-6 l6,6 l-6,6`, stroke: ar, 'stroke-width': 2, fill: 'none' }, svg);
      $('jepa-val').textContent = Math.round(prog * 100) + '%';
      $('jepa-out').innerHTML = prog < 0.05 ? 'Untrained: the hidden blocks are guesses.' : prog < 0.85 ? 'Learning what the hidden anatomy <b>should</b> look like from its surroundings.' : 'Trained: hidden blocks are predicted from context. On real scans this is done in 3D and in a learned feature space, so the model captures anatomy rather than noise.';
    }
    $('jepa-prog').addEventListener('input', e => { prog = +e.target.value; draw(); });
    window.AUTO.jepa = (done) => { prog = 0; draw(); tween(0, 0.92, 1800, v => { prog = v; $('jepa-prog').value = v.toFixed(2); draw(); }, done); };
    draw(); redraw.push(draw);
  })();

  // ── Wearables volume: raw minute-level readings vs daily derived values ──
  (function () {
    const svg = $('vol-svg'); if (!svg) return;
    let n = 1000;
    function draw() {
      const raw = n * 525600, daily = n * 365; // one heart-rate reading per minute vs one value per day
      svg.innerHTML = ''; const W = 440, H = 64; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const lmax = Math.log10(5.3e9), x = (v) => 150 + (Math.log10(Math.max(1, v)) / lmax) * (W - 160);
      [['Raw archive', raw, css('--accent-2')], ['Daily derivation', daily, css('--accent')]].forEach(([lab, v, c], i) => {
        const y = 8 + i * 28;
        el('text', { x: 0, y: y + 12 }, svg).textContent = lab;
        el('rect', { x: 150, y, width: W - 160, height: 16, rx: 8, fill: css('--surface-2') }, svg);
        el('rect', { x: 150, y, width: Math.max(6, x(v) - 150), height: 16, rx: 8, fill: c }, svg);
        const inside = x(v) > W - 120; const t = el('text', { x: inside ? x(v) - 8 : x(v) + 6, y: y + 12, 'text-anchor': inside ? 'end' : 'start', 'font-weight': 600 }, svg); t.textContent = fmtN(v) + ' rows / yr'; if (inside) t.style.fill = '#fff';
      });
      el('text', { x: 150, y: H - 2, 'font-size': 9 }, svg).textContent = 'log scale';
      $('vol-val').textContent = n.toLocaleString();
      $('vol-out').innerHTML = `Minute-level heart rate alone is <b>${fmtN(raw)}</b> rows a year for ${n.toLocaleString()} patients. The archive keeps every reading as delivered; the derivation step turns them into one value per patient, metric and day for approved types only, which is the only route into the OMOP record.`;
    }
    $('vol-n').addEventListener('input', e => { n = Math.round(Math.pow(10, +e.target.value) / 10) * 10; draw(); });
    window.AUTO.vol = (done) => tween(2, 4.3, 1800, v => { n = Math.round(Math.pow(10, v) / 10) * 10; $('vol-n').value = v.toFixed(2); draw(); }, done);
    draw(); redraw.push(draw);
  })();

  // ── Bandit: learn which approved option keeps patients on their medication ──
  (function () {
    const host = $('bandit-svg'); if (!host) return;
    const ARMS = ['SMS reminder', 'Pharmacist call', 'App nudge', 'Caregiver alert'], TRUE = [0.52, 0.47, 0.71, 0.38];
    let ab, rounds, approved = [true, true, true, true], rnd;
    function reset() { ab = ARMS.map(() => [1, 1]); rounds = 0; rnd = rng((Date.now() & 0xffff) + 1); draw(); }
    function beta(a, b) { const g = (k) => { if (k < 1) return g(k + 1) * Math.pow(rnd(), 1 / k); const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d); for (;;) { let x, v; do { x = gauss(rnd); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rnd(); if (u < 1 - 0.0331 * x ** 4) return d * v; if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; } }; const x = g(a), y = g(b); return x / (x + y); }
    function play(n) { for (let t = 0; t < n; t++) { const allowed = ARMS.map((_, i) => i).filter(i => approved[i]); if (!allowed.length) break; let best = -1, bv = -1; allowed.forEach(i => { const v = beta(ab[i][0], ab[i][1]); if (v > bv) { bv = v; best = i; } }); ab[best][rnd() < TRUE[best] ? 0 : 1]++; rounds++; } draw(); }
    function draw() {
      host.innerHTML = ''; const W = 440, H = 104; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
      let bestI = -1, bestM = -1;
      ARMS.forEach((a, i) => { const [al, be] = ab[i]; const m = al / (al + be), k = al + be - 2, ok = approved[i], y = 4 + i * 25; if (ok && k > 0 && m > bestM) { bestM = m; bestI = i; }
        el('text', { x: 0, y: y + 12, opacity: ok ? 1 : 0.4 }, host).textContent = a;
        el('rect', { x: 118, y: y + 3, width: 250, height: 12, rx: 6, fill: css('--surface-2') }, host);
        el('rect', { x: 118, y: y + 3, width: 250 * m, height: 12, rx: 6, fill: css('--accent'), opacity: ok ? 0.95 : 0.2 }, host);
        const sd = Math.sqrt(al * be / ((al + be) ** 2 * (al + be + 1)));
        el('line', { x1: 118 + 250 * Math.max(0, m - sd), x2: 118 + 250 * Math.min(1, m + sd), y1: y + 9, y2: y + 9, stroke: css('--ink'), 'stroke-width': 1.5, opacity: ok ? 0.55 : 0.1 }, host);
        el('text', { x: 376, y: y + 12, opacity: ok ? 1 : 0.4 }, host).textContent = `${Math.round(m * 100)}% · ${k} tried`;
      });
      $('bandit-out').innerHTML = rounds === 0 ? 'Every option starts equally uncertain. Bars are the estimated chance a patient stays on their medication; the dark line is how unsure the system still is.' : `After <b>${rounds}</b> patients the system favours <b>${bestI >= 0 ? ARMS[bestI] : 'nothing (no approved options)'}</b>. Unticked options are never chosen, however good they might be: the clinician's approved set is a hard limit. Simulated patients, not clinical data.`;
    }
    document.querySelectorAll('#bandit-ok input').forEach(c => c.addEventListener('change', e => { approved[+e.target.dataset.i] = e.target.checked; draw(); }));
    $('bandit-play').addEventListener('click', () => play(40)); $('bandit-reset').addEventListener('click', reset);
    window.AUTO.bandit = (done) => { reset(); let i = 0; const go = () => { play(5); if (++i < 8) setTimeout(go, 160); else if (done) done(); }; setTimeout(go, 200); };
    reset(); redraw.push(draw);
  })();

  // ── Threshold: accuracy vs patients actually found ──
  (function () {
    const host = $('metrics-svg'); if (!host) return;
    let thr = 0.78; const prev = 0.28, mn = 0.42, mp = 0.58, sd = 0.14;
    function draw() {
      host.innerHTML = ''; const W = 440, H = 110, M = { l: 6, r: 6, t: 14, b: 16 }; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const x = (t) => M.l + t * (W - M.l - M.r), pdf = (mu) => (t) => Math.exp(-0.5 * ((t - mu) / sd) ** 2), ymax = (1 - prev) * 1.05, y = (v) => H - M.b - (v / ymax) * (H - M.t - M.b);
      [[mn, 1 - prev, css('--accent'), 'not depressed'], [mp, prev, css('--accent-2'), 'depressed']].forEach(([mu, w, c, lab]) => {
        let d = ''; for (let t = 0; t <= 1.0001; t += 0.01) d += (t === 0 ? 'M' : 'L') + x(t).toFixed(1) + ',' + y(w * pdf(mu)(t)).toFixed(1) + ' ';
        el('path', { d: d + `L${x(1)},${y(0)} L${x(0)},${y(0)} Z`, fill: c, opacity: 0.15 }, host); el('path', { d, fill: 'none', stroke: c, 'stroke-width': 2 }, host);
        el('text', { x: x(mu), y: y(w) - 3, 'text-anchor': 'middle' }, host).textContent = lab;
      });
      el('line', { x1: x(thr), x2: x(thr), y1: M.t - 6, y2: H - M.b, stroke: css('--ink'), 'stroke-width': 2 }, host);
      el('text', { x: x(thr) + 4, y: H - 4 }, host).textContent = `threshold ${thr.toFixed(2)} → "depressed"`;
      const tpr = 1 - Phi((thr - mp) / sd), fpr = 1 - Phi((thr - mn) / sd), acc = prev * tpr + (1 - prev) * (1 - fpr);
      $('m-acc').textContent = (acc * 100).toFixed(0) + '%'; $('m-rec').textContent = (tpr * 100).toFixed(0) + '%';
      $('m-rec-ro').className = 'ro ' + (tpr < 0.3 ? 'bad' : tpr > 0.65 ? 'good' : '');
      $('metrics-out').innerHTML = tpr < 0.2 ? `Accuracy looks fine at <b>${(acc * 100).toFixed(0)}%</b>, yet only <span class="bad">${(tpr * 100).toFixed(0)}%</span> of depressed patients are found. The model is mostly saying "not depressed" to everyone.` : `Now <span class="good">${(tpr * 100).toFixed(0)}%</span> of depressed patients are found and accuracy barely moved. That is why we report per-class recall, not accuracy alone.`;
    }
    $('m-thr').addEventListener('input', e => { thr = +e.target.value; draw(); });
    window.AUTO.metrics = (done) => { thr = 0.5; draw(); tween(0.5, 0.8, 1700, v => { thr = v; $('m-thr').value = v.toFixed(2); draw(); }, done); };
    draw(); redraw.push(draw);
  })();

  // ── Silent data corruption ──
  (function () {
    const host = $('drift-svg'); if (!host) return;
    let mode = 'none'; const r = rng(3), ref = Array.from({ length: 1500 }, () => 50 + 10 * gauss(r));
    function batch() { const q = rng(99), out = { vals: [], nulls: 0 }; for (let i = 0; i < 400; i++) { let v = 50 + 10 * gauss(q); if (mode === 'unit') v *= 1000; if (mode === 'shift') v += 14; if (mode === 'null' && q() < 0.3) { out.nulls++; continue; } out.vals.push(v); } return out; }
    const sorted = ref.slice().sort((a, b) => a - b), edges = Array.from({ length: 11 }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(i / 10 * sorted.length))]);
    function shares(vals) { const c = new Array(10).fill(0); vals.forEach(v => { let b = 0; while (b < 9 && v >= edges[b + 1]) b++; c[b]++; }); const n = vals.length || 1; return c.map(x => Math.max(x / n, 1e-4)); }
    const pr = shares(ref);
    function draw() {
      const b = batch(), q = shares(b.vals), psi = pr.reduce((a, p, i) => a + (p - q[i]) * Math.log(p / q[i]), 0);
      host.innerHTML = ''; const W = 300, H = 70; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const lo = Math.min(0, ...b.vals), hi = Math.max(100, ...b.vals), nb = 22, bw = (W - 6) / nb;
      const hist = (vals) => { const c = new Array(nb).fill(0); vals.forEach(v => { c[Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / (hi - lo) * nb)))]++; }); const n = vals.length || 1; return c.map(x => x / n); };
      const hr = hist(ref), hb = hist(b.vals), ymax = Math.max(...hr, ...hb) || 1;
      for (let k = 0; k < nb; k++) { el('rect', { x: 3 + k * bw + 1, y: H - 14 - hr[k] / ymax * (H - 22), width: bw / 2 - 1.5, height: hr[k] / ymax * (H - 22), rx: 2, fill: css('--accent'), opacity: 0.55 }, host); el('rect', { x: 3 + k * bw + bw / 2, y: H - 14 - hb[k] / ymax * (H - 22), width: bw / 2 - 1.5, height: hb[k] / ymax * (H - 22), rx: 2, fill: css('--accent-2') }, host); }
      el('text', { x: 3, y: H - 2, 'font-size': 9 }, host).textContent = `■ last month   ■ today   (values ${lo.toFixed(0)} → ${hi >= 1000 ? (hi / 1000).toFixed(0) + 'k' : hi.toFixed(0)})`;
      const inRange = b.vals.every(v => v >= 0 && v <= 100);
      const checks = [['No missing values', b.nulls / 400 < 0.01, (b.nulls / 4).toFixed(1) + '% missing'], ['Values within 0–100', inRange, inRange ? 'ok' : 'out of range'], ['Same distribution as last month', psi < 0.2, 'drift ' + psi.toFixed(2)]];
      $('drift-checks').innerHTML = checks.map(([l, ok, v]) => `<div class="${ok ? 'pass' : 'fail'}"><span class="ic">${ok ? '✓' : '✕'}</span>${l}<span class="v">${ok ? 'pass' : 'fail'}</span></div>`).join('');
      $('drift-out').innerHTML = mode === 'none' ? 'A healthy day: every check passes.' : mode === 'unit' ? 'Someone upstream changed units. Nothing crashed and nothing is missing, so only the range and distribution checks notice. This is the kind of silent corruption my validation frameworks catch before release.' : mode === 'null' ? 'A spike of missing values: caught by the simplest check, before it reaches a report or a model.' : 'The values quietly drifted upward. Only the distribution check fires, and a model trained on last month would now be wrong without anyone noticing.';
    }
    const setMode = (m) => { document.querySelectorAll('#drift-mode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === m ? 'true' : 'false')); mode = m; draw(); };
    document.querySelectorAll('#drift-mode button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.v)));
    window.AUTO.drift = (done) => { setMode('none'); setTimeout(() => setMode('unit'), 900); setTimeout(() => { if (done) done(); }, 1500); };
    draw(); redraw.push(draw);
  })();
})();
