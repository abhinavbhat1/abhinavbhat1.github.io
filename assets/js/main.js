/* Page behaviour: theme, reveal, the attention "focus" re-weighting, and the small concept demos. */
(function () {
  'use strict';
  const root = document.documentElement, $ = (id) => document.getElementById(id);

  // ── Theme ──
  function currentTheme() { const t = root.getAttribute('data-theme'); if (t) return t; return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  window.currentTheme = currentTheme;
  function setTheme(t) { root.setAttribute('data-theme', t); try { localStorage.setItem('theme', t); } catch (e) {} window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } })); }
  $('theme-toggle').addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));

  // ── Reveal ──
  const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ── Attention over the CV ──
  // Every CV line carries data-w="ml,health,data,swe,lead" relevance scores in [0,1].
  // Picking a focus turns those scores into softmax attention weights; sharpness is 1/temperature.
  const TOPICS = ['ml', 'health', 'data', 'swe', 'lead'];
  const lines = Array.from(document.querySelectorAll('.lines li[data-w]'));
  lines.forEach(li => { li._w = li.dataset.w.split(',').map(Number); const s = document.createElement('span'); s.className = 'att'; li.appendChild(s); li._att = s; });
  const state = { focus: 'all', sharp: 1 };
  const note = $('focus-note');
  const NOTE = {
    all: 'Pick what you are hiring for and the CV re-weights itself. This is <b>attention</b>: every line gets a score for the topic, scores go through a softmax, and the result decides how much each line stands out. Sharpness is the softmax temperature.',
    ml: 'Showing the lines most relevant to <b>machine learning</b>: representation learning, bandits, evaluation and the research that uses them.',
    health: 'Showing the lines most relevant to <b>healthcare AI</b>: imaging, adherence, clinical collaborations and publications.',
    data: 'Showing the lines most relevant to <b>data engineering</b>: Snowflake, dbt, validation frameworks, pipelines and data quality.',
    swe: 'Showing the lines most relevant to <b>software engineering</b>: CI/CD, testing, performance, Kubernetes and APIs.',
    lead: 'Showing the lines most relevant to <b>leadership</b>: leading engineers, national board work and grants.',
  };
  function applyFocus() {
    document.body.classList.toggle('focusing', state.focus !== 'all');
    if (state.focus === 'all') { lines.forEach(li => { li.classList.remove('hi', 'lo'); li._att.textContent = ''; }); note.innerHTML = NOTE.all; return; }
    const k = TOPICS.indexOf(state.focus);
    const scores = lines.map(li => li._w[k]);
    const beta = state.sharp * 6; // inverse temperature
    const mx = Math.max(...scores); const ex = scores.map(s => Math.exp(beta * (s - mx))); const Z = ex.reduce((a, b) => a + b, 0);
    const att = ex.map(e => e / Z); const amax = Math.max(...att);
    lines.forEach((li, i) => {
      const rel = att[i] / amax; // 1 for the top lines
      li.classList.toggle('hi', rel > 0.55); li.classList.toggle('lo', rel < 0.2);
      li.style.opacity = rel < 0.2 ? '' : (0.55 + 0.45 * rel).toFixed(2);
      li._att.textContent = rel > 0.55 ? 'α ' + att[i].toFixed(2) : '';
    });
    const kept = att.filter((a, i) => a / amax > 0.55).length;
    note.innerHTML = NOTE[state.focus] + ` <b>${kept}</b> of ${lines.length} lines carry most of the attention mass at this sharpness.`;
  }
  document.querySelectorAll('#focus-chips .chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll('#focus-chips .chip').forEach(x => x.setAttribute('aria-pressed', 'false')); c.setAttribute('aria-pressed', 'true');
    state.focus = c.dataset.f; applyFocus();
  }));
  $('sharp').addEventListener('input', e => { state.sharp = +e.target.value; $('sharp-val').textContent = state.sharp.toFixed(1); applyFocus(); });
  applyFocus();
  // sticky state for the focus bar: compact once it has stuck to the top
  const sentinel = $('focus-sentinel'), focusBar = $('focus');
  if (sentinel && focusBar) new IntersectionObserver(es => focusBar.classList.toggle('stuck', !es[0].isIntersecting), { rootMargin: '-57px 0px 0px 0px' }).observe(sentinel);
  const hudX = $('hud-x'); if (hudX) hudX.addEventListener('click', () => $('hud').classList.add('hidden'));

  // ── Small helpers for the concept demos ──
  const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
  const redraw = []; window.addEventListener('themechange', () => redraw.forEach(fn => fn()));
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

  // ── JEPA demo: predict the hidden patches of a "scan" from the visible ones ──
  (function jepa() {
    const svg = $('jepa-svg'); if (!svg) return;
    const G = 8, C = 24, r0 = rng(7);
    const img = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const x = i / (G - 1), y = j / (G - 1); const v = 0.42 + 0.22 * Math.sin(3 * x + 1) * Math.cos(2.3 * y) + 0.55 * Math.exp(-((x - 0.6) ** 2 + (y - 0.4) ** 2) / 0.03) - 0.2 * Math.exp(-((x - 0.2) ** 2 + (y - 0.75) ** 2) / 0.06); img.push(Math.max(0, Math.min(1, v + 0.03 * gauss(r0)))); }
    let targets = new Set(), seed = 1, prog = 0;
    function masks() { const r = rng(100 + seed); targets = new Set(); let guard = 0; while (targets.size < 20 && guard++ < 100) { const w = 2 + Math.floor(r() * 2), h = 2 + Math.floor(r() * 2), x0 = Math.floor(r() * (G - w + 1)), y0 = Math.floor(r() * (G - h + 1)); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (targets.size < 20) targets.add(y * G + x); } }
    svg.setAttribute('viewBox', `0 0 ${G * C * 2 + 40} ${G * C + 18}`);
    function draw() {
      svg.innerHTML = '';
      const ink = css('--text'), bg = css('--surface-2'), or = css('--s2'), bl = css('--accent');
      const shade = (v) => { const a = Math.round(v * 255); return `rgb(${a},${a},${a})`; };
      const r = rng(900 + seed);
      el('text', { x: 0, y: 10, 'font-size': 9 }, svg).textContent = 'INPUT · hidden blocks';
      el('text', { x: G * C + 40, y: 10, 'font-size': 9 }, svg).textContent = `PREDICTION · ${Math.round(prog * 100)}% trained`;
      for (let k = 0; k < G * G; k++) {
        const x = (k % G) * C, y = Math.floor(k / G) * C + 16, hid = targets.has(k);
        el('rect', { x, y, width: C - 2, height: C - 2, rx: 3, fill: hid ? bg : shade(img[k]), stroke: hid ? or : 'none', 'stroke-width': 1.5, 'stroke-dasharray': hid ? '3 2' : null }, svg);
        // prediction: hidden patches blend from noise to the truth as training progresses; visible ones are copied
        let v = img[k]; if (hid) { const guess = 0.5 + 0.35 * gauss(r); v = guess + (img[k] - guess) * Math.min(1, prog * 1.15); v = Math.max(0, Math.min(1, v)); }
        el('rect', { x: x + G * C + 40, y, width: C - 2, height: C - 2, rx: 3, fill: shade(v), stroke: hid ? or : 'none', 'stroke-width': hid ? 1.2 : 0, 'stroke-opacity': 0.8 }, svg);
      }
      el('path', { d: `M${G * C + 6},${G * C / 2 + 16} h26 m-6,-6 l6,6 l-6,6`, stroke: bl, 'stroke-width': 2, fill: 'none' }, svg);
      const err = [...targets].reduce((a, k) => { const guess = 0.5; const v = guess + (img[k] - guess) * Math.min(1, prog * 1.15); return a + (v - img[k]) ** 2; }, 0) / Math.max(1, targets.size);
      $('jepa-out').innerHTML = prog < 0.05 ? 'Before training the predictor only knows the average grey, so the hidden blocks are guesses.' : prog < 0.85 ? `Training progress ${Math.round(prog * 100)}%: the predictor is learning what the hidden anatomy <b>should</b> look like from its surroundings.` : `Trained: hidden blocks are predicted from context. The real model does this on 3D MRI volumes and in <b>latent space</b>, not pixels, so it learns anatomy rather than noise.`;
    }
    $('jepa-prog').addEventListener('input', e => { prog = +e.target.value; draw(); });
    $('jepa-mask').addEventListener('click', () => { seed++; masks(); draw(); });
    masks(); draw(); redraw.push(draw);
  })();

  // ── Bandit demo: which adherence intervention for which patient, inside an approved set ──
  (function bandit() {
    const host = $('bandit-svg'); if (!host) return;
    const ARMS = ['SMS reminder', 'Pharmacist call', 'App nudge', 'Caregiver alert'];
    const TRUE = [[0.55, 0.45, 0.72, 0.35], [0.33, 0.66, 0.28, 0.74]];
    let ctx = 0, ab, rounds, approved = [true, true, true, true], rnd;
    function reset() { ab = [0, 1].map(() => ARMS.map(() => [1, 1])); rounds = 0; rnd = rng(Date.now() & 0xffff); draw(); }
    function sampleBeta(a, b) { const g = (k) => { if (k < 1) return g(k + 1) * Math.pow(rnd(), 1 / k); const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d); for (;;) { let x, v; do { x = gauss(rnd); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rnd(); if (u < 1 - 0.0331 * x ** 4) return d * v; if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; } }; const x = g(a), y = g(b); return x / (x + y); }
    function round(n) { for (let t = 0; t < n; t++) { const allowed = ARMS.map((_, i) => i).filter(i => approved[i]); if (!allowed.length) return; let best = -1, bv = -1; allowed.forEach(i => { const v = sampleBeta(ab[ctx][i][0], ab[ctx][i][1]); if (v > bv) { bv = v; best = i; } }); const rew = rnd() < TRUE[ctx][best] ? 1 : 0; ab[ctx][best][rew ? 0 : 1]++; rounds++; } draw(); }
    function draw() {
      host.innerHTML = ''; const W = 420, H = 110; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const cols = [css('--accent'), css('--s2'), css('--s3'), css('--s4')];
      let bestI = -1, bestM = -1;
      ARMS.forEach((a, i) => { const [al, be] = ab[ctx][i]; const m = al / (al + be), n = al + be - 2; const y = 8 + i * 25; const ok = approved[i];
        if (ok && m > bestM) { bestM = m; bestI = i; }
        el('text', { x: 0, y: y + 11, 'font-size': 10, opacity: ok ? 1 : 0.4 }, host).textContent = a;
        el('rect', { x: 120, y: y + 3, width: 260, height: 10, rx: 5, fill: css('--grid') }, host);
        el('rect', { x: 120, y: y + 3, width: 260 * m, height: 10, rx: 5, fill: cols[i], opacity: ok ? 0.95 : 0.25 }, host);
        // credible interval (±1 sd of the Beta)
        const sd = Math.sqrt(al * be / ((al + be) ** 2 * (al + be + 1)));
        el('line', { x1: 120 + 260 * Math.max(0, m - sd), x2: 120 + 260 * Math.min(1, m + sd), y1: y + 8, y2: y + 8, stroke: css('--ink'), 'stroke-width': 1.5, opacity: ok ? 0.6 : 0.15 }, host);
        el('text', { x: 388, y: y + 11, 'font-size': 9, opacity: ok ? 1 : 0.4 }, host).textContent = `${Math.round(m * 100)}% · ${n}×`;
      });
      $('bandit-out').innerHTML = rounds === 0 ? 'Every option starts equally uncertain (bars at 50%). Press play to let the policy learn from simulated patients.' : `After <b>${rounds}</b> rounds for profile ${ctx === 0 ? 'A' : 'B'} the policy recommends <b>${bestI >= 0 ? ARMS[bestI] : 'nothing (no approved options)'}</b>. Bars are the estimated chance the patient stays on their medication; lines are the uncertainty. Unticked options are never chosen, however good they might be: the clinician's approved set is a hard constraint.`;
    }
    document.querySelectorAll('#bandit-ctx button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#bandit-ctx button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); ctx = +b.dataset.v; draw(); }));
    document.querySelectorAll('#bandit-ok input').forEach(c => c.addEventListener('change', e => { approved[+e.target.dataset.i] = e.target.checked; draw(); }));
    $('bandit-play').addEventListener('click', () => round(40));
    $('bandit-reset').addEventListener('click', reset);
    reset(); redraw.push(draw);
  })();

  // ── Evaluation demo: accuracy vs recall when the positive class is rare ──
  (function metrics() {
    const host = $('metrics-svg'); if (!host) return;
    let thr = 0.78; const prev = 0.28, mn = 0.42, mp = 0.58, sd = 0.14;
    function draw() {
      host.innerHTML = ''; const W = 420, H = 120, M = { l: 6, r: 6, t: 12, b: 16 }; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const x = (t) => M.l + t * (W - M.l - M.r); const pdf = (mu) => (t) => Math.exp(-0.5 * ((t - mu) / sd) ** 2);
      const ymax = Math.max((1 - prev), prev) * 1.05; const y = (v) => H - M.b - (v / ymax) * (H - M.t - M.b);
      [[mn, 1 - prev, css('--accent'), 'not depressed'], [mp, prev, css('--s2'), 'depressed']].forEach(([mu, w, c, lab]) => {
        let d = ''; for (let t = 0; t <= 1.0001; t += 0.01) d += (t === 0 ? 'M' : 'L') + x(t).toFixed(1) + ',' + y(w * pdf(mu)(t)).toFixed(1) + ' ';
        el('path', { d: d + `L${x(1)},${y(0)} L${x(0)},${y(0)} Z`, fill: c, opacity: 0.16 }, host); el('path', { d, fill: 'none', stroke: c, 'stroke-width': 2 }, host);
        el('text', { x: x(mu), y: y(w) - 3, 'text-anchor': 'middle', 'font-size': 9 }, host).textContent = lab;
      });
      el('line', { x1: x(thr), x2: x(thr), y1: M.t - 4, y2: H - M.b, stroke: css('--ink'), 'stroke-width': 2 }, host);
      el('text', { x: x(thr) + 4, y: H - 4, 'font-size': 9 }, host).textContent = `threshold ${thr.toFixed(2)} →  "depressed"`;
      const tpr = 1 - Phi((thr - mp) / sd), fpr = 1 - Phi((thr - mn) / sd);
      const acc = prev * tpr + (1 - prev) * (1 - fpr), bacc = 0.5 * (tpr + 1 - fpr);
      $('m-acc').textContent = (acc * 100).toFixed(0) + '%'; $('m-rec').textContent = (tpr * 100).toFixed(0) + '%'; $('m-bacc').textContent = (bacc * 100).toFixed(0) + '%';
      $('m-rec-ro').className = 'ro ' + (tpr < 0.3 ? 'bad' : tpr > 0.65 ? 'good' : '');
      $('metrics-out').innerHTML = tpr < 0.2 ? `Accuracy looks fine at <b>${(acc * 100).toFixed(0)}%</b>, but the model catches only <span class="bad">${(tpr * 100).toFixed(0)}%</span> of the depressed patients. It is mostly saying "not depressed" to everyone. This is the trap our benchmark exposed.` : `At this threshold the model finds <span class="good">${(tpr * 100).toFixed(0)}%</span> of depressed patients. Accuracy barely moved, which is why we report balanced accuracy and per-class recall instead.`;
    }
    $('m-thr').addEventListener('input', e => { thr = +e.target.value; draw(); });
    draw(); redraw.push(draw);
  })();

  // ── Drift demo: a silent data failure that only a distribution test catches ──
  (function drift() {
    const host = $('drift-svg'); if (!host) return;
    let mode = 'none';
    const r = rng(3); const ref = Array.from({ length: 1500 }, () => 50 + 10 * gauss(r));
    function batch() { const q = rng(99); const out = { vals: [], nulls: 0, strings: 0 }; for (let i = 0; i < 400; i++) { let v = 50 + 10 * gauss(q); if (mode === 'unit') v *= 1000; if (mode === 'shift') v += 14; if (mode === 'null' && q() < 0.3) { out.nulls++; continue; } if (mode === 'type' && q() < 0.5) { out.strings++; continue; } out.vals.push(v); } return out; }
    const sorted = ref.slice().sort((a, b) => a - b); const edges = Array.from({ length: 11 }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(i / 10 * sorted.length))]);
    function shares(vals) { const c = new Array(10).fill(0); vals.forEach(v => { let b = 0; while (b < 9 && v >= edges[b + 1]) b++; c[b]++; }); const n = vals.length || 1; return c.map(x => Math.max(x / n, 1e-4)); }
    const pr = shares(ref);
    function draw() {
      const b = batch(); const q = shares(b.vals); const psi = b.vals.length ? pr.reduce((a, p, i) => a + (p - q[i]) * Math.log(p / q[i]), 0) : 0;
      host.innerHTML = ''; const W = 420, H = 90; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const lo = Math.min(0, ...b.vals, 0), hi = Math.max(100, ...b.vals); const nb = 24; const bw = (W - 10) / nb;
      const hist = (vals) => { const c = new Array(nb).fill(0); vals.forEach(v => { const k = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / (hi - lo) * nb))); c[k]++; }); const n = vals.length || 1; return c.map(x => x / n); };
      const hr = hist(ref), hb = hist(b.vals); const ymax = Math.max(...hr, ...hb) || 1;
      for (let k = 0; k < nb; k++) { el('rect', { x: 5 + k * bw + 1, y: H - 14 - hr[k] / ymax * (H - 24), width: bw / 2 - 1.5, height: hr[k] / ymax * (H - 24), rx: 2, fill: css('--accent'), opacity: 0.75 }, host); el('rect', { x: 5 + k * bw + bw / 2, y: H - 14 - hb[k] / ymax * (H - 24), width: bw / 2 - 1.5, height: hb[k] / ymax * (H - 24), rx: 2, fill: css('--s2') }, host); }
      el('text', { x: 5, y: H - 2, 'font-size': 9 }, host).textContent = `■ reference  ■ today's batch   (x-axis ${lo.toFixed(0)} → ${hi >= 1000 ? (hi / 1000).toFixed(0) + 'k' : hi.toFixed(0)})`;
      const checks = [
        ['values are numeric', b.strings === 0, b.strings ? `${b.strings} strings` : 'ok'],
        ['null rate < 1%', b.nulls / 400 < 0.01, (b.nulls / 4).toFixed(1) + '%'],
        ['values within 0–100', b.vals.every(v => v >= 0 && v <= 100), b.vals.every(v => v >= 0 && v <= 100) ? 'ok' : 'out of range'],
        ['distribution stable (PSI < 0.2)', psi < 0.2, psi.toFixed(2)],
      ];
      $('drift-checks').innerHTML = checks.map(([l, ok, v]) => `<div class="${ok ? 'pass' : 'fail'}"><span class="ic">${ok ? '✓' : '✕'}</span>${l}<span class="v">${ok ? 'PASS' : 'FAIL'} · ${v}</span></div>`).join('');
      $('drift-out').innerHTML = mode === 'none' ? 'A healthy batch: every check passes.' : mode === 'unit' ? 'Someone upstream switched units. Nothing crashed, the column is still numeric and non-null, so only the <b>range</b> and <b>distribution</b> tests notice. This is the silent corruption my validation frameworks were built to catch.' : mode === 'shift' ? 'The mean drifted by 14 points. Only the distribution test (PSI) fires. A model trained on the reference would now be quietly wrong.' : mode === 'null' ? 'A null spike: the null-rate check catches it before the pipeline writes it downstream.' : 'A type change: half the values arrived as strings. Schema tests stop the release.';
    }
    document.querySelectorAll('#drift-mode button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#drift-mode button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); mode = b.dataset.v; draw(); }));
    draw(); redraw.push(draw);
  })();

  // ── Skills map: skills placed by similarity (a tiny embedding space) ──
  (function skills() {
    const host = $('skills-svg'); if (!host) return;
    const SK = [
      ['PyTorch', 'ml'], ['TensorFlow', 'ml'], ['scikit-learn', 'ml'], ['Transformers', 'ml'], ['JEPA', 'ml'], ['Computer vision', 'ml'], ['Contextual bandits', 'ml'], ['Model evaluation', 'ml'],
      ['Snowflake', 'data'], ['dbt', 'data'], ['Kafka', 'data'], ['ETL', 'data'], ['Data quality', 'data'], ['Power BI', 'data'],
      ['Docker', 'swe'], ['Kubernetes', 'swe'], ['REST APIs', 'swe'], ['CI/CD', 'swe'], ['Pytest', 'swe'], ['JMeter', 'swe'], ['Grafana', 'swe'], ['Great Expectations', 'swe'],
      ['Python', 'lang'], ['SQL', 'lang'], ['Java', 'lang'], ['C++', 'lang'], ['R', 'lang'], ['Bash', 'lang'],
    ];
    const Q = { ml: [0.25, 0.27], data: [0.75, 0.27], swe: [0.75, 0.75], lang: [0.25, 0.75] };
    const NAMES = { ml: 'Machine learning', data: 'Data engineering', swe: 'Engineering & DevOps', lang: 'Languages' };
    function draw() {
      host.innerHTML = ''; const W = 440, H = 320; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const cols = { ml: css('--accent'), data: css('--s2'), swe: css('--s3'), lang: css('--s4') };
      const r = rng(11);
      const pts = SK.map(([n, g]) => { const c = Q[g]; return { n, g, w: n.length * 5.6 + 14, x: (c[0] + (r() - 0.5) * 0.3) * W, y: (c[1] + (r() - 0.5) * 0.28) * H }; });
      for (let it = 0; it < 200; it++) {
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j]; let dx = b.x - a.x, dy = b.y - a.y;
          // treat each label as a box: the label text extends to the right of the dot
          const ox = (a.w + b.w) / 2 + 4 - Math.abs(dx + (b.w - a.w) / 2), oy = 15 - Math.abs(dy);
          if (ox > 0 && oy > 0) { if (oy < ox) { const sgn = dy >= 0 ? 1 : -1; a.y -= sgn * oy * 0.5; b.y += sgn * oy * 0.5; } else { const sgn = dx >= 0 ? 1 : -1; a.x -= sgn * ox * 0.5; b.x += sgn * ox * 0.5; } }
        }
        pts.forEach(p => { const c = Q[p.g]; const bx = [c[0] * W - W * 0.24, c[0] * W + W * 0.24 - p.w], by = [c[1] * H - H * 0.19, c[1] * H + H * 0.19]; p.x = Math.max(bx[0], Math.min(bx[1], p.x)); p.y = Math.max(by[0], Math.min(by[1], p.y)); });
      }
      Object.keys(Q).forEach(g => { const c = Q[g]; const top = c[1] < 0.5; el('text', { x: c[0] * W, y: top ? 10 : H - 4, 'text-anchor': 'middle', 'font-size': 9, fill: cols[g], 'letter-spacing': '0.12em' }, host).textContent = NAMES[g].toUpperCase(); });
      el('line', { x1: W / 2, x2: W / 2, y1: 16, y2: H - 14, stroke: css('--grid'), 'stroke-dasharray': '3 4' }, host);
      el('line', { x1: 8, x2: W - 8, y1: H / 2, y2: H / 2, stroke: css('--grid'), 'stroke-dasharray': '3 4' }, host);
      pts.forEach(p => { const g = el('g', { transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})` }, host); el('circle', { r: 4, fill: cols[p.g], stroke: css('--surface'), 'stroke-width': 1.5 }, g); const t = el('text', { x: 7, y: 3.5, 'font-size': 9.5 }, g); t.textContent = p.n; t.style.fill = css('--text'); });
    }
    draw(); redraw.push(draw);
  })();
})();
