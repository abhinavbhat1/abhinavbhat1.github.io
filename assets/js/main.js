/* Theme, the cards that neurons burst into, the TL;DR panel, the home and nav hooks, focus re-weighting, and the small
   experiments. The drawing, the floating field and the scroll journey live in scene.js. */
(function () {
  'use strict';
  const root = document.documentElement, $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ── Theme ──
  function currentTheme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  window.currentTheme = currentTheme;
  function setTheme(t) { root.setAttribute('data-theme', t); try { sessionStorage.setItem('theme', t); } catch (e) {} window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } })); }
  $('theme-toggle').addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));

  // ── Layers, rows, cards. Every section is one layer of the network and one panel in fun mode; every entry is one neuron, one row
  //    of that panel, and in the document one row of the section (a stage row, or a card). Each entry is split in two: the top (meta,
  //    title, org) stays with its row; the rest (logos, lines, experiment) sits in the stage card on desktop, inside the row elsewhere ──
  const cardsHost = $('cards'); const desk = () => window.innerWidth >= 900;
  const LAYERS = Array.from(document.querySelectorAll('[data-layer]')).map(sec => {
    const panel = document.createElement('div'); panel.className = 'jpanel frost'; panel.setAttribute('aria-label', sec.dataset.layer); cardsHost.appendChild(panel);
    const L = { id: sec.id, name: sec.dataset.layer, sub: sec.dataset.sub || '', sec, panel, cards: [], stage: sec.classList.contains('stage'), body: sec.querySelector('.sec-body'), cardsEl: sec.querySelector('.stage-cards'), active: -1 };
    L.cards = Array.from(sec.querySelectorAll('.entry')).map((entry, i) => {
      // split the entry
      const top = document.createElement('div'); top.className = 'e-top'; const rest = document.createElement('div'); rest.className = 'e-rest';
      const bodyEl = entry.querySelector(':scope > .body'); const meta = entry.querySelector(':scope > .meta'); if (meta) top.appendChild(meta);
      if (bodyEl) { Array.from(bodyEl.children).forEach(ch => { if (ch.tagName === 'H3' || ch.classList.contains('org')) top.appendChild(ch); else rest.appendChild(ch); }); bodyEl.remove(); }
      entry.appendChild(top); entry.appendChild(rest);
      const el = document.createElement('div'); el.className = 'jrow'; el.style.setProperty('--open', 0);
      const head = document.createElement('button'); head.type = 'button'; head.className = 'jrow-head'; head.setAttribute('aria-expanded', 'false');
      const date = top.querySelector('.meta .date'); const h3 = top.querySelector('h3');
      head.innerHTML = `<span class="jrow-i" aria-hidden="true"></span><span class="jrow-t">${(h3 ? h3.textContent : entry.dataset.short || '').trim()}</span><span class="jrow-m">${date ? date.textContent : ''}</span><svg class="jrow-c" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      const body = document.createElement('div'); body.className = 'jrow-body'; body.appendChild(entry);
      el.appendChild(head); el.appendChild(body);
      let scard = null; if (L.cardsEl) { scard = document.createElement('div'); scard.className = 'scard frost'; L.cardsEl.appendChild(scard); }
      return { el, head, body, entry, top, rest, scard, short: entry.dataset.short || '', k: 0, i };
    });
    L.sec.style.setProperty('--n', L.cards.length);
    const head = sec.querySelector('.sec-head'); head.classList.add('rv'); if (L.sub) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = L.sub; head.appendChild(p); }
    return L;
  });
  window.LAYERS = LAYERS;
  function currentMode() { return root.getAttribute('data-mode') === 'fun' ? 'journey' : 'normal'; }
  window.currentMode = currentMode;
  const resetExp = (entry) => { entry.querySelectorAll('details.try[open]').forEach(d => { d.open = false; }); entry.querySelectorAll('details.try[data-played]').forEach(d => { delete d.dataset.played; const bd = d.querySelector('[data-auto-badge]'); if (bd) { bd.textContent = 'auto-running'; bd.classList.remove('done'); } }); };
  function setRow(c, open) { c.el.classList.toggle('open', open); c.el.style.setProperty('--open', open ? '1' : '0'); c.head.setAttribute('aria-expanded', open ? 'true' : 'false'); if (c.scard) c.scard.classList.toggle('on', open); if (!open) { resetExp(c.rest); c.ran = false; } }
  // the experiment of the row in focus starts on its own, a beat after it arrives
  function autoRun(c) { if (reduced || c.ran) return; c.ran = true; const d = c.rest.querySelector('details.try'); if (!d || d.open || d.dataset.played) return; setTimeout(() => { if (c.el.classList.contains('open') && currentMode() === 'normal' && !d.open) d.open = true; }, 450); }
  function activate(L, i, run) { if (L.active !== i) { L.active = i; L.cards.forEach((c, j) => setRow(c, j === i)); } if (run && i >= 0) autoRun(L.cards[i]); }
  // where the pieces live: fun mode, the panel rows hold everything; the document on desktop, a stage row holds the top and its card the rest;
  // elsewhere the row holds everything
  let placed = '';
  function placeRows(m) { const key = m + (desk() ? ':d' : ':m'); if (key === placed) return; placed = key;
    LAYERS.forEach(L => { const host = m === 'journey' ? L.panel : L.body; L.active = -1;
      L.cards.forEach(c => { if (c.el.parentElement !== host) host.appendChild(c.el); const restHost = (m === 'normal' && L.stage && desk() && c.scard) ? c.scard : c.entry; if (c.rest.parentElement !== restHost) restHost.appendChild(c.rest);
        c.body.style.height = ''; c.b = 0; c.auto = false; resetExp(c.rest); setRow(c, false); });
      if (m === 'normal') { if (L.stage) activate(L, 0, false); else L.cards.forEach(c => setRow(c, true)); } }); }
  const modeSw = $('mode-toggle');
  function setMode(m, remember) { root.setAttribute('data-mode', m); if (remember) { try { localStorage.setItem('mode', m); } catch (e) { } }
    modeSw.setAttribute('aria-checked', m === 'fun' ? 'true' : 'false'); placeRows(m === 'fun' ? 'journey' : 'normal'); window.scrollTo(0, 0); root.classList.remove('scrolled');
    if (window.onModeChange) window.onModeChange(m === 'fun' ? 'journey' : 'normal'); }
  placeRows(currentMode()); modeSw.setAttribute('aria-checked', currentMode() === 'journey' ? 'true' : 'false');
  modeSw.addEventListener('click', () => setMode(currentMode() === 'journey' ? 'normal' : 'fun', true));
  const hint = $('fun-hint'); if (hint) hint.addEventListener('click', () => setMode(currentMode() === 'journey' ? 'normal' : 'fun', true));
  window.setMode = setMode;
  window.addEventListener('resize', () => placeRows(currentMode()));
  // the row heads: in fun mode they go to the neuron; on a desktop stage they scroll to the row's beat; elsewhere they toggle the row
  const stageTop = (L) => L.sec.getBoundingClientRect().top + window.scrollY;
  const beatOf = (L, i) => stageTop(L) + (i + 0.5) / L.cards.length * (L.sec.offsetHeight - window.innerHeight);
  LAYERS.forEach((L, j) => L.cards.forEach((c, i) => { c.k = j + 1;
    c.head.addEventListener('click', () => { if (currentMode() === 'journey') { if (window.goToNeuron) window.goToNeuron(c.k, c.i); return; } if (L.stage && desk()) { window.scrollTo({ top: Math.round(beatOf(L, i)), behavior: reduced ? 'auto' : 'smooth' }); return; } const open = !c.el.classList.contains('open'); if (open) activate(L, i, true); else { setRow(c, false); L.active = -1; } }); }));
  // ── Scroll: on desktop the stages pick their open row from how far they are scrolled; the statement lights up word by word ──
  const stmt = $('stmt'); const words = stmt ? stmt.textContent.trim().split(/\s+/) : []; if (stmt) stmt.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
  const wEls = stmt ? Array.from(stmt.children) : []; const stmtSec = stmt ? stmt.closest('.stmt') : null; let stmtQ = -1;
  let ticking = false;
  function scrollFrame() { ticking = false; if (currentMode() !== 'normal') return; const vh = window.innerHeight;
    if (stmtSec) { const r = stmtSec.getBoundingClientRect(); const total = stmtSec.offsetHeight - vh; const p = Math.max(0, Math.min(1, -r.top / Math.max(1, total))); const q = Math.round(p * 120); if (q !== stmtQ) { stmtQ = q; const n = words.length; const prog = Math.max(0, Math.min(1, (p - 0.12) / 0.7)); wEls.forEach((w, k) => w.style.setProperty('--lit', reduced ? 1 : Math.max(0, Math.min(1, prog * (n + 1.5) - k)).toFixed(2))); } }
    if (desk()) LAYERS.forEach(L => { if (!L.stage) return; const r = L.sec.getBoundingClientRect(); const total = L.sec.offsetHeight - vh; if (r.top > vh || r.bottom < 0) return; const p = Math.max(0, Math.min(0.999, -r.top / Math.max(1, total))); const i = Math.floor(p * L.cards.length); activate(L, i, r.top < vh * 0.4); }); }
  const onScroll = () => { const on = window.scrollY > 40; if (on !== scrolledOn) { scrolledOn = on; root.classList.toggle('scrolled', on); } if (!ticking) { ticking = true; requestAnimationFrame(scrollFrame); } };
  let scrolledOn = false; window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll); requestAnimationFrame(scrollFrame);
  // on phones a stage row opens as it reaches the middle of the screen
  const rowIO = new IntersectionObserver((es) => { if (currentMode() !== 'normal' || desk()) return; es.forEach(e => { if (!e.isIntersecting) return; const L = LAYERS.find(l => l.stage && l.cards.some(c => c.el === e.target)); if (!L) return; const i = L.cards.findIndex(c => c.el === e.target); activate(L, i, true); }); }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
  LAYERS.forEach(L => { if (L.stage) L.cards.forEach(c => rowIO.observe(c.el)); });
  // the nav follows the section on screen; chapter heads and cards rise in as they arrive; a fragment of the field lights up as each chapter arrives
  const navA = Array.from(document.querySelectorAll('.nav a'));
  const secIO = new IntersectionObserver((es) => { if (currentMode() !== 'normal') return; es.forEach(e => { if (!e.isIntersecting) return; navA.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }); }, { rootMargin: '-30% 0px -60% 0px' });
  LAYERS.forEach(L => secIO.observe(L.sec));
  LAYERS.forEach(L => { if (!L.stage) L.cards.forEach((c, i) => { c.el.classList.add('rv'); c.el.style.setProperty('--i', i); }); });
  const rvIO = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rvIO.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.02 });
  document.querySelectorAll('.rv').forEach(el => rvIO.observe(el));
  const headIO = new IntersectionObserver((es) => es.forEach(e => { if (!e.isIntersecting || currentMode() !== 'normal') return; const r = e.target.getBoundingClientRect(); if (window.__pulseAt) window.__pulseAt(r.left + r.width / 2, r.top + r.height / 2); }), { threshold: 0.5 });
  document.querySelectorAll('.sec-head').forEach(h => headIO.observe(h));
  // ── Nav: a link warps to that layer in fun mode, scrolls to the section in the document ──
  document.querySelectorAll('.nav a[href^="#"]').forEach(a => a.addEventListener('click', (e) => { const id = a.getAttribute('href').slice(1); e.preventDefault(); if (currentMode() === 'journey') { if (window.jumpToLayer) window.jumpToLayer(id); } else { const sec = document.getElementById(id); if (sec) sec.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); } }));

  // ── TL;DR: the whole thing on one card ──
  const tldr = $('tldr'), tcard = tldr.querySelector('.tldr-card'), tbtn = $('tldr-toggle'); let tldrWas = null, minimised = false, genieOn = null;
  tcard.setAttribute('tabindex', '-1');
  const sm = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  // the genie: the sheet is cut into horizontal strips, each a clipped copy of it, and the strip edges are mapped onto a funnel
  // that runs from the sheet to the TL;DR button. First the sheet's top edge is drawn along the funnel to the button while its
  // bottom stays put, so the sheet stretches into a tapering neck; then the whole sheet slides up the neck into the button.
  // Every strip is projected exactly onto its slice of the funnel (a trapezoid, via a 3D matrix), so neighbouring strips share
  // their edges and the sheet stays one smoothly bending surface. Played backwards it pours back out of the button
  const adj3 = (m) => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
  const mm3 = (a, b) => { const c = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let v = 0; for (let k = 0; k < 3; k++) v += a[3 * i + k] * b[3 * k + j]; c[3 * i + j] = v; } return c; };
  const mv3 = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const basis = (x1, y1, x2, y2, x3, y3, x4, y4) => { const m = [x1, x2, x3, y1, y2, y3, 1, 1, 1], v = mv3(adj3(m), [x4, y4, 1]); return mm3(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); };
  // the matrix that takes the rectangle (0,0)-(w,h) onto the quad p1 (top-left), p2 (top-right), p3 (bottom-left), p4 (bottom-right)
  function quadMatrix(w, h, p1, p2, p3, p4) { const S = basis(0, 0, w, 0, 0, h, w, h), D = basis(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], p4[0], p4[1]); const t = mm3(D, adj3(S)); for (let i = 0; i < 9; i++) t[i] /= t[8]; return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`; }
  function genie(reverse, done) {
    const rc = tcard.getBoundingClientRect(), bb = tbtn.getBoundingClientRect(); const bx = bb.left + bb.width / 2, by = bb.top + bb.height * 0.55, cx0 = rc.left + rc.width / 2, w = rc.width, h = rc.height, N = innerWidth < 900 ? 26 : 40, sh = h / N, wb = Math.max(0.03, bb.width / rc.width);
    const wrap = document.createElement('div'); wrap.className = 'genie'; wrap.style.cssText = `left:${rc.left}px;top:${rc.top}px;width:${w}px;height:${h}px`; const strips = [];
    for (let i = 0; i < N; i++) { const st = document.createElement('div'); st.className = 'genie-strip'; st.style.cssText = `top:${(i * sh).toFixed(3)}px;height:${sh.toFixed(3)}px`; const cl = tcard.cloneNode(true); cl.removeAttribute('id'); cl.removeAttribute('tabindex'); cl.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); cl.classList.add('genie-clone'); cl.style.cssText = `width:${w}px;height:${h}px;transform:translateY(${(-i * sh).toFixed(3)}px)`; st.appendChild(cl); wrap.appendChild(st); strips.push(st); }
    document.body.appendChild(wrap); const top0 = tcard.scrollTop; strips.forEach(st => { st.firstChild.scrollTop = top0; }); tcard.style.visibility = 'hidden';
    // the funnel: a row that has been pulled by q sits at fx(q), narrowed to fw(q) of the width; the path bends toward the button late, as a genie does
    const fx = (q) => (bx - cx0) * Math.pow(q, 1.7), fw = (q) => wb + (1 - wb) * Math.pow(1 - q, 2.4);
    const place = (p) => { const front = sm(Math.min(1, p / 0.62)), back = sm(Math.max(0, (p - 0.16) / 0.84)); const Y = [], X = [], S = [], Q = [];
      for (let j = 0; j <= N; j++) { const y = j / N, q = back + (front - back) * Math.pow(1 - y, 1.25); const ry = y * h; Q.push(q); Y.push(ry + (by - rc.top - ry) * q); X.push(w / 2 + fx(q)); S.push(fw(q) * w); }
      for (let i = 0; i < N; i++) { const y0 = i * sh, yt = Y[i], yb = Math.max(Y[i + 1], Y[i] + 0.4), wt = Math.max(S[i], 2), wbm = Math.max(S[i + 1], 2);
        strips[i].style.transform = quadMatrix(w, sh, [X[i] - wt / 2, yt - y0], [X[i] + wt / 2, yt - y0], [X[i + 1] - wbm / 2, yb - y0], [X[i + 1] + wbm / 2, yb - y0]);
        const q = (Q[i] + Q[i + 1]) / 2; strips[i].style.opacity = (1 - 0.7 * Math.pow(q, 6)).toFixed(3); } };
    const D = reverse ? 600 : 720, t0 = performance.now(); let raf = 0;
    const frame = (now) => { const k = Math.min(1, (now - t0) / D); const hold = window.__genieHold; const e = 0.65 * sm(k) + 0.35 * k; const p = hold != null ? hold : (reverse ? 1 - e : e); place(p); if (k < 1 || hold != null) raf = requestAnimationFrame(frame); else { wrap.remove(); tcard.style.visibility = ''; genieOn = null; if (done) done(); } };
    place(reverse ? 1 : 0); raf = requestAnimationFrame(frame); genieOn = { cancel: () => { cancelAnimationFrame(raf); wrap.remove(); tcard.style.visibility = ''; genieOn = null; } }; return genieOn; }
  function openTldr() { tldr.classList.add('open'); root.classList.add('tldr-open'); tldr.setAttribute('aria-hidden', 'false'); tldrWas = document.activeElement; tcard.focus({ preventScroll: true }); if (minimised && !reduced) { tldr.classList.add('genie'); requestAnimationFrame(() => tldr.classList.remove('genie')); genie(true); } minimised = false; }
  function finishClose() { tldr.classList.remove('open', 'genie'); root.classList.remove('tldr-open'); tldr.setAttribute('aria-hidden', 'true'); if (tldrWas && tldrWas.focus) tldrWas.focus(); }
  function closeTldr() { if (genieOn) genieOn.cancel(); finishClose(); }
  function minimiseTldr() { if (reduced) { closeTldr(); minimised = true; return; } if (genieOn) return; tldr.classList.add('genie'); genie(false, () => { finishClose(); minimised = true; tbtn.classList.remove('bounce'); void tbtn.offsetWidth; tbtn.classList.add('bounce'); setTimeout(() => tbtn.classList.remove('bounce'), 500); }); }
  tbtn.addEventListener('click', () => (tldr.classList.contains('open') ? minimiseTldr() : openTldr()));
  $('tldr-close').addEventListener('click', closeTldr); $('tldr-min').addEventListener('click', minimiseTldr);
  window.__tldr = () => ({ open: tldr.classList.contains('open'), minimised, animating: !!genieOn, strips: document.querySelectorAll('.genie-strip').length });
  tldr.addEventListener('click', (e) => { if (e.target === tldr) closeTldr(); });
  ['wheel', 'touchmove'].forEach(ev => tldr.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && tldr.classList.contains('open')) closeTldr(); });
  window.openTldr = openTldr; window.closeTldr = closeTldr;

  // ── Experiments run once when their panel is opened ──
  document.querySelectorAll('details.try[data-auto]').forEach(d => { d.addEventListener('toggle', () => { if (!d.open || d.dataset.played) return; d.dataset.played = '1'; const fn = window.AUTO && window.AUTO[d.dataset.auto]; const badge = d.querySelector('[data-auto-badge]'); if (fn) setTimeout(() => fn(() => { if (badge) { badge.textContent = 'try it yourself'; badge.classList.add('done'); } }), 200); }); });

  // ── The greeting keeps changing ──
  const hi = $('hello'); if (hi && !reduced) { const HI = ['Hello', 'नमस्ते', 'ನಮಸ್ಕಾರ', 'Hola', 'Bonjour', 'こんにちは', 'Ciao', '안녕하세요', 'Hallo', '你好', 'Olá', 'Привет', 'مرحبا', 'வணக்கம்', 'Γεια σου', 'สวัสดี', 'Hej', 'Salut']; let i = 0; setTimeout(() => setInterval(() => { if (document.visibilityState !== 'visible') return; hi.classList.add('swap'); setTimeout(() => { i = (i + 1) % HI.length; hi.textContent = HI[i]; hi.classList.remove('swap'); }, 330); }, 2600), 2200); }

  // ── Home: the mark warps home; pressed at home it shoots neurons that build up architectures in the field ──
  const goHome = (e) => { e.preventDefault(); if (currentMode() === 'journey' && window.warpHome) window.warpHome(); else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); };
  $('brand').addEventListener('click', goHome); $('to-top').addEventListener('click', goHome);
  // the beacon: straight to what's latest (the PACD neuron, or its row in the document)
  const beacon = $('beacon'); if (beacon) beacon.addEventListener('click', (e) => { e.preventDefault(); if (currentMode() === 'journey') { if (window.jumpToNeuron) window.jumpToNeuron(1, 2); return; } const L = LAYERS[0], c = L && L.cards[2]; if (!c) return; if (desk()) window.scrollTo({ top: Math.round(beatOf(L, 2)), behavior: reduced ? 'auto' : 'smooth' }); else { activate(L, 2, true); c.el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); } });

  // ── "What are you looking for?" ── every line carries data-w="ml,health,data,swe,lead" in [0,1]
  const TOPICS = ['ml', 'health', 'data', 'swe'];
  const NAMES = { ml: 'machine learning', health: 'healthcare AI', data: 'data engineering', swe: 'software engineering' };
  const lines = Array.from(document.querySelectorAll('.lines li[data-w]'));
  lines.forEach(li => { li._w = li.dataset.w.split(',').map(Number); });
  const note = $('focus-q'); const skills = Array.from(document.querySelectorAll('.tags span[data-f]'));
  function applyFocus(f) {
    skills.forEach(sp => { const on = f !== 'all' && sp.dataset.f.split(' ').includes(f); sp.classList.toggle('on', on); sp.classList.toggle('off', f !== 'all' && !on); });
    if (f === 'all') { lines.forEach(li => { li.classList.remove('hi', 'lo'); li.style.opacity = ''; }); note.textContent = 'What are you looking for?'; note.classList.remove('set'); return; }
    const k = TOPICS.indexOf(f); const scores = lines.map(li => li._w[k]);
    const mx = Math.max(...scores); const ex = scores.map(s => Math.exp(6 * (s - mx))); const Z = ex.reduce((a, b) => a + b, 0); const att = ex.map(e => e / Z); const amax = Math.max(...att);
    let kept = 0;
    lines.forEach((li, i) => { const rel = att[i] / amax; li.classList.toggle('hi', rel > 0.55); li.classList.toggle('lo', rel < 0.2); li.style.opacity = rel < 0.2 ? '' : (0.55 + 0.45 * rel).toFixed(2); if (rel > 0.55) kept++; });
    note.textContent = `${kept} points for ${NAMES[f]} ·`; note.classList.add('set');
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
