/* Page behaviour. Theme, the entrances, the nav's current section, the reading lens, the portrait that predicts its own
   hidden blocks, the five experiments (each runs once on its own when it comes into view, then hands over), and the small
   live details: the countdown to the talk, the time in New York, the greeting. Everything here degrades to the plain
   document when scripts are off. */
(function () {
  'use strict';
  const root = document.documentElement, $ = (id) => document.getElementById(id);
  root.classList.add('js');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();

  // ── Theme: follows the system until the visitor chooses ──
  const themeMeta = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  const redraw = [];
  function setTheme(t, remember) {
    root.setAttribute('data-theme', t);
    if (remember) { try { localStorage.setItem('theme', t); } catch (e) { } }
    themeMeta.forEach(m => m.setAttribute('content', css('--bg')));
    redraw.forEach(fn => fn());
  }
  $('theme-toggle').addEventListener('click', () => setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { let saved = null; try { saved = localStorage.getItem('theme'); } catch (err) { } if (!saved) setTheme(e.matches ? 'dark' : 'light', false); });
  themeMeta.forEach(m => m.setAttribute('content', css('--bg')));

  // ── Entrances: the parts of each section rise in turn as it arrives ──
  const groups = [
    ['.hero', ['h1', '.statement', '.actions', '.lens', '.portrait']],
    ['.sec-head', ['h2', '.statement']],
    ['.entry', ['.entry-text', '.exp']],
    ['.xp', ['.xp-roles', '.exp']],
    ['.schools', ['.school']],
    ['.honours', ['h3', '.lines']],
    ['.skills', ['.skill-group']],
    ['.contact-inner', ['h2', '.statement', '.contact-list']],
    ['.foot', ['.foot-name', '.foot-line']]
  ];
  const revealed = new Set();
  groups.forEach(([sel, parts]) => document.querySelectorAll(sel).forEach(g => { let i = 0; parts.forEach(p => g.querySelectorAll(':scope ' + p).forEach(el => { el.setAttribute('data-reveal', ''); el.style.setProperty('--i', i++); })); revealed.add(g); }));
  const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  revealed.forEach(g => io.observe(g));
  // whatever is already on screen shows at once; a section the visitor scrolled past before the script ran is never left hidden
  addEventListener('load', () => setTimeout(() => revealed.forEach(g => { if (g.getBoundingClientRect().top < innerHeight) g.classList.add('in'); }), 900));

  // ── Nav: the section on screen is the current one ──
  const navLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
  const secIO = new IntersectionObserver((es) => { es.forEach(e => { if (!e.isIntersecting) return; navLinks.forEach(a => { if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }); }, { rootMargin: '-40% 0px -55% 0px' });
  navLinks.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) secIO.observe(s); });
  const toTop = (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); };
  document.querySelector('.brand').addEventListener('click', toTop); $('to-top').addEventListener('click', toTop);

  // ── The lens: every line carries data-w="ml,health,data,swe,lead" in [0,1]; attention over the lines keeps the relevant ones in ink ──
  const TOPICS = ['ml', 'health', 'data', 'swe'];
  const NAMES = { ml: 'machine learning', health: 'healthcare AI', data: 'data engineering', swe: 'software engineering' };
  const lines = Array.from(document.querySelectorAll('.lines li[data-w]')); lines.forEach(li => { li._w = li.dataset.w.split(',').map(Number); });
  const skills = Array.from(document.querySelectorAll('.tags li[data-f]')); const lensQ = $('lens-q');
  function applyLens(f) {
    skills.forEach(sp => { const on = f !== 'all' && sp.dataset.f.split(' ').includes(f); sp.classList.toggle('on', on); sp.classList.toggle('off', f !== 'all' && !on); });
    if (f === 'all') { lines.forEach(li => li.classList.remove('hi', 'lo')); lensQ.textContent = 'Reading for'; return; }
    const k = TOPICS.indexOf(f), scores = lines.map(li => li._w[k]), mx = Math.max(...scores);
    const ex = scores.map(s => Math.exp(6 * (s - mx))), Z = ex.reduce((a, b) => a + b, 0), att = ex.map(e => e / Z), amax = Math.max(...att);
    let kept = 0; lines.forEach((li, i) => { const rel = att[i] / amax; li.classList.toggle('hi', rel > 0.55); li.classList.toggle('lo', rel < 0.2); if (rel > 0.55) kept++; });
    lensQ.textContent = kept + ' lines on ' + NAMES[f] + ', reading for';
  }
  document.querySelectorAll('#lens button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#lens button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); applyLens(b.dataset.f); }));

  // ── The portrait: hide blocks of it, then predict them back from their surroundings ──
  (function () {
    const mask = $('mask'), btn = $('portrait-btn'); if (!mask || !btn) return;
    const cells = []; for (let i = 0; i < 64; i++) { const c = document.createElement('i'); mask.appendChild(c); cells.push(c); }
    let timers = [], seed = 11;
    function rng() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    function run() {
      timers.forEach(clearTimeout); timers = [];
      const chosen = new Set(); let guard = 0;
      while (chosen.size < 14 && guard++ < 200) { const w = 1 + Math.floor(rng() * 2), h = 1 + Math.floor(rng() * 2), x0 = Math.floor(rng() * (8 - w + 1)), y0 = Math.floor(rng() * (8 - h + 1)); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (chosen.size < 14) chosen.add(y * 8 + x); }
      cells.forEach((c, i) => { c.style.transition = 'none'; c.classList.toggle('on', chosen.has(i)); });
      if (reduced) { timers.push(setTimeout(() => cells.forEach(c => c.classList.remove('on')), 1200)); return; }
      const order = Array.from(chosen).sort(() => rng() - 0.5);
      timers.push(setTimeout(() => { cells.forEach(c => { c.style.transition = 'opacity .55s cubic-bezier(.23,1,.32,1)'; }); order.forEach((i, k) => timers.push(setTimeout(() => cells[i].classList.remove('on'), 150 + k * 110))); }, 900));
    }
    btn.addEventListener('click', run);
    addEventListener('load', () => setTimeout(run, 300));
  })();

  // ── Now: the talk, counted from today ──
  (function () {
    const now = $('now'), talk = $('talk'); if (!now) return;
    const day = new Date(); day.setHours(0, 0, 0, 0); const d = Math.round((new Date(2026, 10, 9) - day) / 864e5);
    const when = d > 1 ? 'in ' + d + ' days' : d === 1 ? 'tomorrow' : d === 0 ? 'today' : null;
    if (when) now.innerHTML = '<a href="#pacd">Presenting PACD at AMIA 2026</a> in Dallas, ' + when + '.';
    else { now.innerHTML = '<a href="#pacd">Presented PACD at AMIA 2026</a> in Dallas, 9 November.'; if (talk) talk.innerHTML = 'Presented at the <a href="https://amia.org/education-events/amia-2026-annual-symposium" target="_blank" rel="noopener">AMIA 2026 Annual Symposium</a> in Dallas on 9 November.'; }
  })();

  // ── The time in New York, and a greeting that keeps changing ──
  (function () {
    const clock = $('clock'); if (!clock) return;
    const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    const tick = () => { clock.textContent = 'It is ' + fmt.format(new Date()).toLowerCase() + ' here.'; }; tick(); setInterval(tick, 15000);
    const hi = $('hello'); if (!hi || reduced) return;
    const HI = ['Hello.', 'नमस्ते.', 'ನಮಸ್ಕಾರ.', 'Hola.', 'Bonjour.', 'こんにちは.', 'Ciao.', '안녕하세요.', 'Hallo.', '你好.', 'Olá.', 'Привет.', 'مرحبا.', 'வணக்கம்.', 'Γεια σου.', 'สวัสดี.', 'Hej.', 'Salut.'];
    let i = 0; setInterval(() => { if (document.visibilityState !== 'visible') return; i = (i + 1) % HI.length; hi.textContent = HI[i]; }, 2600);
  })();

  // ── Experiments: each runs once on its own when it comes into view, then hands over ──
  const AUTO = {};
  const tween = (from, to, ms, step, done) => { if (reduced) { step(to); if (done) done(); return; } const t0 = performance.now(); (function f(now) { const k = Math.max(0, Math.min(1, (now - t0) / ms)); step(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); else if (done) done(); })(t0); };
  const exps = Array.from(document.querySelectorAll('.exp[data-exp]'));
  exps.forEach(x => { const s = document.createElement('p'); s.className = 'exp-status'; s.textContent = 'Runs on its own when you reach it'; x.appendChild(s); x._status = s;
    x.addEventListener('pointerdown', () => { if (!x.classList.contains('done')) return; x._status.textContent = 'Your turn'; }, { once: true }); });
  const expIO = new IntersectionObserver((es) => es.forEach(e => { if (!e.isIntersecting) return; expIO.unobserve(e.target); const x = e.target, fn = AUTO[x.dataset.exp]; if (!fn) return;
    x.classList.add('running'); x._status.textContent = 'Running on its own';
    setTimeout(() => fn(() => { x.classList.remove('running'); x.classList.add('done'); x._status.textContent = 'Your turn'; }), reduced ? 0 : 500); }), { threshold: 0.45 });
  exps.forEach(x => expIO.observe(x));

  // helpers
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const fmtN = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + ' billion' : n >= 1e6 ? (n / 1e6).toFixed(0) + ' million' : n >= 1e3 ? Math.round(n / 1e3).toLocaleString() + ' thousand' : String(Math.round(n));
  const tint = (k) => `color-mix(in srgb, var(--accent) ${k}%, var(--bg-2))`;

  // ── JEPA: hide part of a scan, predict it from the rest ──
  (function () {
    const svg = $('jepa-svg'); if (!svg) return;
    const G = 8, C = 22, r0 = rng(7);
    const img = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const x = i / (G - 1), y = j / (G - 1); const v = 0.42 + 0.22 * Math.sin(3 * x + 1) * Math.cos(2.3 * y) + 0.55 * Math.exp(-((x - 0.6) ** 2 + (y - 0.4) ** 2) / 0.03) - 0.2 * Math.exp(-((x - 0.2) ** 2 + (y - 0.75) ** 2) / 0.06); img.push(Math.max(0, Math.min(1, v + 0.03 * gauss(r0)))); }
    const targets = new Set(); { const r = rng(101); let g = 0; while (targets.size < 18 && g++ < 100) { const w = 2 + Math.floor(r() * 2), h = 2 + Math.floor(r() * 2), x0 = Math.floor(r() * (G - w + 1)), y0 = Math.floor(r() * (G - h + 1)); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (targets.size < 18) targets.add(y * G + x); } }
    let prog = 0;
    svg.setAttribute('viewBox', `0 0 ${G * C * 2 + 44} ${G * C + 20}`);
    function draw() {
      svg.innerHTML = ''; const ar = css('--accent');
      const shade = (v) => { const a = Math.round(30 + v * 200); return `rgb(${a},${a},${a})`; };
      const r = rng(900);
      el('text', { x: 0, y: 11 }, svg).textContent = 'Scan with hidden blocks';
      el('text', { x: G * C + 44, y: 11 }, svg).textContent = `Prediction, ${Math.round(prog * 100)}% trained`;
      for (let k = 0; k < G * G; k++) {
        const x = (k % G) * C, y = Math.floor(k / G) * C + 18, hid = targets.has(k);
        el('rect', { x, y, width: C - 2, height: C - 2, fill: hid ? tint(22) : shade(img[k]) }, svg);
        let v = img[k]; if (hid) { const guess = 0.5 + 0.35 * gauss(r); v = Math.max(0, Math.min(1, guess + (img[k] - guess) * Math.min(1, prog * 1.15))); }
        el('rect', { x: x + G * C + 44, y, width: C - 2, height: C - 2, fill: shade(v), stroke: hid ? ar : null, 'stroke-width': 1.5, 'stroke-opacity': hid ? 0.9 : 0 }, svg);
      }
      el('path', { d: `M${G * C + 8},${G * C / 2 + 18} h26 m-6,-6 l6,6 l-6,6`, stroke: ar, 'stroke-width': 2, fill: 'none' }, svg);
      $('jepa-val').textContent = Math.round(prog * 100) + '%';
      $('jepa-out').innerHTML = prog < 0.05 ? 'Untrained: the hidden blocks are guesses.' : prog < 0.85 ? 'Learning what the hidden anatomy <b>should</b> look like from its surroundings.' : 'Trained: the hidden blocks are predicted from context. On real scans this is done in 3D and in a learned feature space, so the model captures anatomy rather than noise.';
    }
    $('jepa-prog').addEventListener('input', e => { prog = +e.target.value; draw(); });
    AUTO.jepa = (done) => { prog = 0; draw(); tween(0, 0.92, 2200, v => { prog = v; $('jepa-prog').value = v.toFixed(2); draw(); }, done); };
    draw(); redraw.push(draw);
  })();

  // ── Wearables volume: raw minute-level readings against daily derived values ──
  (function () {
    const svg = $('vol-svg'); if (!svg) return;
    let n = 1000;
    function draw() {
      const raw = n * 525600, daily = n * 365;
      svg.innerHTML = ''; const W = 440, H = 72; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const lmax = Math.log10(5.3e9), x = (v) => 150 + (Math.log10(Math.max(1, v)) / lmax) * (W - 160);
      [['Raw archive', raw, tint(45)], ['Daily derivation', daily, css('--accent')]].forEach(([lab, v, c], i) => {
        const y = 8 + i * 30;
        el('text', { x: 0, y: y + 13 }, svg).textContent = lab;
        el('rect', { x: 150, y, width: W - 160, height: 18, fill: 'var(--bg-3)' }, svg);
        el('rect', { x: 150, y, width: Math.max(6, x(v) - 150), height: 18, fill: c }, svg);
        const inside = x(v) > W - 130; const t = el('text', { x: inside ? x(v) - 8 : x(v) + 6, y: y + 13, 'text-anchor': inside ? 'end' : 'start', 'font-weight': 600 }, svg); t.textContent = fmtN(v) + ' rows a year'; t.style.fill = inside ? '#fff' : 'var(--ink)';
      });
      el('text', { x: 150, y: H - 2, 'font-size': 10 }, svg).textContent = 'log scale';
      $('vol-val').textContent = n.toLocaleString();
      $('vol-out').innerHTML = `Minute-level heart rate alone is <b>${fmtN(raw)}</b> rows a year for ${n.toLocaleString()} patients. The archive keeps every reading as delivered; the derivation step turns them into one value per patient, metric and day for approved types only, which is the only route into the OMOP record.`;
    }
    $('vol-n').addEventListener('input', e => { n = Math.round(Math.pow(10, +e.target.value) / 10) * 10; draw(); });
    AUTO.vol = (done) => tween(2, 4.3, 2200, v => { n = Math.round(Math.pow(10, v) / 10) * 10; $('vol-n').value = v.toFixed(2); draw(); }, done);
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
      host.innerHTML = ''; const W = 440, H = 112; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
      let bestI = -1, bestM = -1;
      ARMS.forEach((a, i) => { const [al, be] = ab[i]; const m = al / (al + be), k = al + be - 2, ok = approved[i], y = 4 + i * 27; if (ok && k > 0 && m > bestM) { bestM = m; bestI = i; }
        el('text', { x: 0, y: y + 13, opacity: ok ? 1 : 0.4 }, host).textContent = a;
        el('rect', { x: 118, y: y + 3, width: 240, height: 14, fill: 'var(--bg-3)' }, host);
        el('rect', { x: 118, y: y + 3, width: 240 * m, height: 14, fill: css('--accent'), opacity: ok ? 0.95 : 0.2 }, host);
        const sd = Math.sqrt(al * be / ((al + be) ** 2 * (al + be + 1)));
        el('line', { x1: 118 + 240 * Math.max(0, m - sd), x2: 118 + 240 * Math.min(1, m + sd), y1: y + 10, y2: y + 10, stroke: css('--ink'), 'stroke-width': 2, opacity: ok ? 0.6 : 0.1 }, host);
        el('text', { x: 366, y: y + 13, opacity: ok ? 1 : 0.4 }, host).textContent = `${Math.round(m * 100)}%, ${k} tried`;
      });
      $('bandit-out').innerHTML = rounds === 0 ? 'Every option starts equally uncertain. Bars are the estimated chance a patient stays on their medication; the dark line is how unsure the system still is.' : `After <b>${rounds}</b> patients the system favours <b>${bestI >= 0 ? ARMS[bestI] : 'nothing (no approved options)'}</b>. Unticked options are never chosen, however good they might be: the clinician's approved set is a hard limit. Simulated patients, not clinical data.`;
    }
    document.querySelectorAll('#bandit-ok input').forEach(c => c.addEventListener('change', e => { approved[+e.target.dataset.i] = e.target.checked; draw(); }));
    $('bandit-play').addEventListener('click', () => play(40)); $('bandit-reset').addEventListener('click', reset);
    AUTO.bandit = (done) => { reset(); if (reduced) { play(40); if (done) done(); return; } let i = 0; const go = () => { play(5); if (++i < 8) setTimeout(go, 200); else if (done) done(); }; setTimeout(go, 200); };
    reset(); redraw.push(draw);
  })();

  // ── Threshold: accuracy against patients actually found ──
  (function () {
    const host = $('metrics-svg'); if (!host) return;
    let thr = 0.78; const prev = 0.28, mn = 0.42, mp = 0.58, sd = 0.14;
    function draw() {
      host.innerHTML = ''; const W = 440, H = 120, M = { l: 6, r: 6, t: 16, b: 18 }; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const x = (t) => M.l + t * (W - M.l - M.r), pdf = (mu) => (t) => Math.exp(-0.5 * ((t - mu) / sd) ** 2), ymax = (1 - prev) * 1.05, y = (v) => H - M.b - (v / ymax) * (H - M.t - M.b);
      [[mn, 1 - prev, css('--accent'), 'not depressed'], [mp, prev, css('--bad'), 'depressed']].forEach(([mu, w, c, lab]) => {
        let d = ''; for (let t = 0; t <= 1.0001; t += 0.01) d += (t === 0 ? 'M' : 'L') + x(t).toFixed(1) + ',' + y(w * pdf(mu)(t)).toFixed(1) + ' ';
        el('path', { d: d + `L${x(1)},${y(0)} L${x(0)},${y(0)} Z`, fill: c, opacity: 0.14 }, host); el('path', { d, fill: 'none', stroke: c, 'stroke-width': 2 }, host);
        el('text', { x: x(mu), y: y(w) - 4, 'text-anchor': 'middle' }, host).textContent = lab;
      });
      el('line', { x1: x(thr), x2: x(thr), y1: M.t - 6, y2: H - M.b, stroke: css('--ink'), 'stroke-width': 2 }, host);
      const lab = el('text', { x: x(thr) + (thr > 0.7 ? -5 : 5), y: H - 5, 'text-anchor': thr > 0.7 ? 'end' : 'start' }, host); lab.textContent = `threshold ${thr.toFixed(2)}: above it means "depressed"`;
      const tpr = 1 - Phi((thr - mp) / sd), fpr = 1 - Phi((thr - mn) / sd), acc = prev * tpr + (1 - prev) * (1 - fpr);
      $('m-acc').textContent = (acc * 100).toFixed(0) + '%'; $('m-rec').textContent = (tpr * 100).toFixed(0) + '%';
      $('m-rec-ro').className = 'ro ' + (tpr < 0.3 ? 'bad' : tpr > 0.65 ? 'good' : '');
      $('metrics-out').innerHTML = tpr < 0.2 ? `Accuracy looks fine at <b>${(acc * 100).toFixed(0)}%</b>, yet only <span class="bad">${(tpr * 100).toFixed(0)}%</span> of depressed patients are found. The model is mostly saying "not depressed" to everyone.` : `Now <span class="good">${(tpr * 100).toFixed(0)}%</span> of depressed patients are found and accuracy barely moved. That is why we report per-class recall, not accuracy alone.`;
    }
    $('m-thr').addEventListener('input', e => { thr = +e.target.value; draw(); });
    AUTO.metrics = (done) => { thr = 0.5; draw(); tween(0.5, 0.8, 2000, v => { thr = v; $('m-thr').value = v.toFixed(2); draw(); }, done); };
    draw(); redraw.push(draw);
  })();

  // ── Silent data corruption and the checks that catch it ──
  (function () {
    const host = $('drift-svg'); if (!host) return;
    let mode = 'none'; const r = rng(3), ref = Array.from({ length: 1500 }, () => 50 + 10 * gauss(r));
    function batch() { const q = rng(99), out = { vals: [], nulls: 0 }; for (let i = 0; i < 400; i++) { let v = 50 + 10 * gauss(q); if (mode === 'unit') v *= 1000; if (mode === 'shift') v += 14; if (mode === 'null' && q() < 0.3) { out.nulls++; continue; } out.vals.push(v); } return out; }
    const sorted = ref.slice().sort((a, b) => a - b), edges = Array.from({ length: 11 }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(i / 10 * sorted.length))]);
    function shares(vals) { const c = new Array(10).fill(0); vals.forEach(v => { let b = 0; while (b < 9 && v >= edges[b + 1]) b++; c[b]++; }); const n = vals.length || 1; return c.map(x => Math.max(x / n, 1e-4)); }
    const pr = shares(ref);
    function draw() {
      const b = batch(), q = shares(b.vals), psi = pr.reduce((a, p, i) => a + (p - q[i]) * Math.log(p / q[i]), 0);
      host.innerHTML = ''; const W = 440, H = 110; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const lo = Math.min(0, ...b.vals), hi = Math.max(100, ...b.vals), nb = 22, bw = (W - 6) / nb;
      const hist = (vals) => { const c = new Array(nb).fill(0); vals.forEach(v => { c[Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / (hi - lo) * nb)))]++; }); const n = vals.length || 1; return c.map(x => x / n); };
      const hr = hist(ref), hb = hist(b.vals), ymax = Math.max(...hr, ...hb) || 1;
      for (let k = 0; k < nb; k++) { el('rect', { x: 3 + k * bw + 1, y: H - 18 - hr[k] / ymax * (H - 26), width: bw / 2 - 1.5, height: hr[k] / ymax * (H - 26), fill: css('--ink'), opacity: 0.35 }, host); el('rect', { x: 3 + k * bw + bw / 2, y: H - 18 - hb[k] / ymax * (H - 26), width: bw / 2 - 1.5, height: hb[k] / ymax * (H - 26), fill: css('--accent') }, host); }
      el('rect', { x: 3, y: H - 10, width: 9, height: 9, fill: css('--ink'), opacity: 0.35 }, host); el('text', { x: 16, y: H - 2 }, host).textContent = 'last month';
      el('rect', { x: 86, y: H - 10, width: 9, height: 9, fill: css('--accent') }, host); el('text', { x: 99, y: H - 2 }, host).textContent = 'today';
      el('text', { x: W, y: H - 2, 'text-anchor': 'end' }, host).textContent = `values ${lo.toFixed(0)} to ${hi >= 1000 ? (hi / 1000).toFixed(0) + 'k' : hi.toFixed(0)}`;
      const inRange = b.vals.every(v => v >= 0 && v <= 100);
      const checks = [['No missing values', b.nulls / 400 < 0.01, (b.nulls / 4).toFixed(1) + '% missing'], ['Values within 0 to 100', inRange, inRange ? 'ok' : 'out of range'], ['Same distribution as last month', psi < 0.2, 'drift ' + psi.toFixed(2)]];
      $('drift-checks').innerHTML = checks.map(([l, ok, v]) => `<li class="${ok ? 'pass' : 'fail'}"><span class="ic" aria-hidden="true">${ok ? '✓' : '✕'}</span>${l}<span class="v">${ok ? 'pass' : 'fail'}<span class="sr"> (${v})</span></span></li>`).join('');
      $('drift-out').innerHTML = mode === 'none' ? 'A healthy day: every check passes.' : mode === 'unit' ? 'Someone upstream changed units. Nothing crashed and nothing is missing, so only the range and distribution checks notice. This is the kind of silent corruption my validation frameworks catch before release.' : mode === 'null' ? 'A spike of missing values: caught by the simplest check, before it reaches a report or a model.' : 'The values quietly drifted upward. Only the distribution check fires, and a model trained on last month would now be wrong without anyone noticing.';
    }
    const setMode = (m) => { document.querySelectorAll('#drift-mode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === m ? 'true' : 'false')); mode = m; draw(); };
    document.querySelectorAll('#drift-mode button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.v)));
    AUTO.drift = (done) => { setMode('none'); if (reduced) { setMode('unit'); if (done) done(); return; } setTimeout(() => setMode('unit'), 1100); setTimeout(() => setMode('shift'), 2600); setTimeout(() => { if (done) done(); }, 3400); };
    draw(); redraw.push(draw);
  })();

  // ── For whoever opens the console ──
  try { console.log('%cHello. If you are reading this, we should talk: abhinavbhat@nyu.edu', 'font: 14px -apple-system, system-ui, sans-serif; color: #2050d2;'); } catch (e) { }
})();
