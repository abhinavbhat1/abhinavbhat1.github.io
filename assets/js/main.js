/* Theme, the modes, the rows and the stage cards, the document's scroll-driven pieces (the lit statement, the pinned stages),
   the TL;DR and its genie, the greeting, the focus lens, and the five experiments. The drawing, the floating field and the
   scroll journey live in scene.js. */
(function () {
  'use strict';
  const root = document.documentElement, $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Theme ──
  function currentTheme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  window.currentTheme = currentTheme;
  function setTheme(t) { root.setAttribute('data-theme', t); try { sessionStorage.setItem('theme', t); } catch (e) {} window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } })); }
  $('theme-toggle').addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));

  // ── Experiments: closed by default behind "Visualize it". Opening one runs the simulation once ("Simulating", then "Your turn");
  //    closing it, or closing its row, resets it so it simulates again next time ──
  window.AUTO = {};
  function runExp(d, delay) { if (!d || d.dataset.played) return; d.dataset.played = '1'; d.classList.add('played'); const badge = d.querySelector('[data-auto-badge]'); const fn = window.AUTO[d.dataset.auto];
    const done = () => { if (badge) { badge.textContent = 'Your turn'; badge.classList.add('done'); } };
    if (badge) { badge.textContent = 'Simulating'; badge.classList.remove('done'); }
    if (!fn || reduced) { done(); return; }
    clearTimeout(d._t); d._t = setTimeout(() => { if (d.dataset.played) d._cancel = fn(done); }, delay == null ? 350 : delay); }
  function resetExp(scope) { scope.querySelectorAll('.try').forEach(d => { clearTimeout(d._t); if (d._cancel) { d._cancel(); d._cancel = null; } delete d.dataset.played; d.classList.remove('played', 'open'); const h = d.querySelector('.try-h'); if (h) h.setAttribute('aria-expanded', 'false'); const bd = d.querySelector('[data-auto-badge]'); if (bd) { bd.textContent = ''; bd.classList.remove('done'); } }); }
  function openExp(d, open) { if (open) { d.classList.add('open'); d.querySelector('.try-h').setAttribute('aria-expanded', 'true'); runExp(d, 300); } else resetExp(d.parentElement); }
  document.querySelectorAll('.try').forEach(d => d.querySelector('.try-h').addEventListener('click', () => openExp(d, !d.classList.contains('open'))));
  window.runExp = runExp; window.resetExp = resetExp; window.openExp = openExp;

  // ── Layers, rows, cards. Every section is one layer of the network and one panel in fun mode; every entry is one neuron, one row
  //    of that panel, and in the document one row of the section (a stage row, or a card). Each entry is split in two: the top (meta,
  //    title, org) stays with its row; the rest (logos, lines, experiment) sits in the stage card on desktop, inside the row elsewhere ──
  const cardsHost = $('cards'); const desk = () => window.innerWidth >= 900;
  const LAYERS = Array.from(document.querySelectorAll('[data-layer]')).map(sec => {
    const panel = document.createElement('div'); panel.className = 'jpanel frost'; panel.setAttribute('aria-label', sec.dataset.layer); cardsHost.appendChild(panel);
    const L = { id: sec.id, name: sec.dataset.layer, sub: sec.dataset.sub || '', sec, panel, cards: [], stage: sec.classList.contains('stage'), body: sec.querySelector('.sec-body'), cardsEl: sec.querySelector('.stage-cards'), active: -1 };
    L.cards = Array.from(sec.querySelectorAll('.entry')).map((entry, i) => {
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
      let scard = null; if (L.cardsEl) { scard = document.createElement('div'); scard.className = 'scard frost'; if (!rest.querySelector('.try') && rest.querySelectorAll('.lines li').length <= 1) scard.classList.add('slim'); L.cardsEl.appendChild(scard); }
      return { el, head, body, entry, top, rest, scard, short: entry.dataset.short || '', k: 0, i, ran: false };
    });
    L.sec.style.setProperty('--n', L.cards.length);
    const head = sec.querySelector('.sec-head'); head.classList.add('rv'); if (L.sub) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = L.sub; head.appendChild(p); }
    return L;
  });
  window.LAYERS = LAYERS;
  function currentMode() { return root.getAttribute('data-mode') === 'fun' ? 'journey' : 'normal'; }
  window.currentMode = currentMode;
  function setRow(c, open) { c.el.classList.toggle('open', open); c.el.style.setProperty('--open', open ? '1' : '0'); c.head.setAttribute('aria-expanded', open ? 'true' : 'false'); if (c.scard) c.scard.classList.toggle('on', open); if (!open) { resetExp(c.rest); c.ran = false; } }
  function activate(L, i) { if (L.active !== i) { L.active = i; L.cards.forEach((c, j) => setRow(c, j === i)); } }
  // where the pieces live. Fun mode: the panel rows hold everything and the heads go to the neuron. The document on a desktop: a stage
  // row holds the top, its card the rest, and the heads scroll to the row's beat. Everywhere else the rows are cards: in a `.toggle`
  // chapter they are closed and open on a click; otherwise they are plain cards, all open, with static heads. An entry marked
  // data-only="fun" is a neuron of the journey but not a card of the document
  let placed = '';
  function placeRows(m) { const key = m + (desk() ? ':d' : ':m'); if (key === placed) return; placed = key;
    LAYERS.forEach(L => { const host = m === 'journey' ? L.panel : L.body; L.active = -1; const kind = m === 'journey' || (L.stage && desk()) ? 'live' : L.sec.classList.contains('toggle') ? 'toggle' : 'static'; L.kind = kind;
      L.cards.forEach(c => { if (c.el.parentElement !== host) host.appendChild(c.el); const restHost = (m === 'normal' && L.stage && desk() && c.scard) ? c.scard : c.entry; if (c.rest.parentElement !== restHost) restHost.appendChild(c.rest);
        c.body.style.height = ''; c.b = 0; c.auto = false; setRow(c, false); c.el.classList.toggle('card', kind !== 'live'); c.el.classList.toggle('static', kind === 'static'); c.el.classList.toggle('toggle', kind === 'toggle'); c.head.tabIndex = kind === 'static' ? -1 : 0; c.el.hidden = m === 'normal' && c.entry.dataset.only === 'fun'; });
      if (m === 'normal') { if (kind === 'live') activate(L, 0); else if (kind === 'static') L.cards.forEach(c => setRow(c, true)); } }); }
  const modeSw = $('mode-toggle');
  function setMode(m, remember) { root.setAttribute('data-mode', m); if (remember) { try { localStorage.setItem('mode', m); } catch (e) { } }
    modeSw.setAttribute('aria-checked', m === 'fun' ? 'true' : 'false'); placeRows(m === 'fun' ? 'journey' : 'normal'); window.scrollTo(0, 0); root.classList.remove('scrolled');
    if (window.onModeChange) window.onModeChange(m === 'fun' ? 'journey' : 'normal'); }
  placeRows(currentMode()); modeSw.setAttribute('aria-checked', currentMode() === 'journey' ? 'true' : 'false');
  modeSw.addEventListener('click', () => setMode(currentMode() === 'journey' ? 'normal' : 'fun', true));
  window.setMode = setMode;
  window.addEventListener('resize', () => placeRows(currentMode()));

  const stageTop = (L) => L.sec.getBoundingClientRect().top + window.scrollY;
  const beatOf = (L, i) => stageTop(L) + (i + 0.5) / L.cards.length * (L.sec.offsetHeight - window.innerHeight);
  LAYERS.forEach((L, j) => L.cards.forEach((c, i) => { c.k = j + 1;
    c.head.addEventListener('click', () => { if (currentMode() === 'journey') { if (window.goToNeuron) window.goToNeuron(c.k, c.i); return; } if (L.kind === 'toggle') { setRow(c, !c.el.classList.contains('open')); return; } if (L.stage && desk()) window.scrollTo({ top: Math.round(beatOf(L, i)), behavior: reduced ? 'auto' : 'smooth' }); }); }));
  // ── Scroll: on a desktop the stages pick their open row from how far they are scrolled; the statement lights up word by word ──
  const stmt = $('stmt'); const words = stmt ? stmt.textContent.trim().split(/\s+/) : []; if (stmt) stmt.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
  const wEls = stmt ? Array.from(stmt.children) : []; const stmtSec = stmt ? stmt.closest('.stmt') : null; let stmtQ = -1;
  let ticking = false;
  function scrollFrame() { ticking = false; if (currentMode() !== 'normal') return; const vh = window.innerHeight;
    if (stmtSec) { const r = stmtSec.getBoundingClientRect(); if (r.bottom >= 0 && r.top <= vh) { const total = stmtSec.offsetHeight - vh; const p = Math.max(0, Math.min(1, -r.top / Math.max(1, total))); const q = Math.round(p * 160); if (q !== stmtQ) { stmtQ = q; const n = words.length; const prog = Math.max(0, Math.min(1, (p - 0.1) / 0.72)); wEls.forEach((w, k) => w.style.setProperty('--lit', reduced ? 1 : Math.max(0, Math.min(1, prog * (n + 1.5) - k)).toFixed(2))); } } }
    if (desk()) LAYERS.forEach(L => { if (!L.stage) return; const r = L.sec.getBoundingClientRect(); const total = L.sec.offsetHeight - vh; if (r.top > vh || r.bottom < 0) return; const p = Math.max(0, Math.min(0.999, -r.top / Math.max(1, total))); const i = Math.floor(p * L.cards.length); activate(L, i); }); }
  let scrolledOn = false;
  const onScroll = () => { const on = window.scrollY > 40; if (on !== scrolledOn) { scrolledOn = on; root.classList.toggle('scrolled', on); } if (!ticking) { ticking = true; requestAnimationFrame(scrollFrame); } };
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll); requestAnimationFrame(scrollFrame);
  // the nav follows the section on screen; chapter heads and cards rise in as they arrive; a fragment of the field lights up as each chapter arrives
  const navA = Array.from(document.querySelectorAll('.nav a'));
  const secIO = new IntersectionObserver((es) => { if (currentMode() !== 'normal') return; es.forEach(e => { if (!e.isIntersecting) return; navA.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }); }, { rootMargin: '-30% 0px -60% 0px' });
  LAYERS.forEach(L => secIO.observe(L.sec));
  LAYERS.forEach(L => L.cards.forEach((c, i) => { c.el.classList.add('rv'); c.el.style.setProperty('--i', L.stage ? 0 : i); }));
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

  // ── The greeting keeps changing ──
  const hi = $('hello'); if (hi && !reduced) { const HI = ['Hello', 'नमस्ते', 'ನಮಸ್ಕಾರ', 'Hola', 'Bonjour', 'こんにちは', 'Ciao', '안녕하세요', 'Hallo', '你好', 'Olá', 'Привет', 'مرحبا', 'வணக்கம்', 'Γεια σου', 'สวัสดี', 'Hej', 'Salut']; let i = 0; setTimeout(() => setInterval(() => { if (document.visibilityState !== 'visible') return; hi.classList.add('swap'); setTimeout(() => { i = (i + 1) % HI.length; hi.textContent = HI[i]; hi.classList.remove('swap'); }, 330); }, 2600), 2200); }

  // ── Home: the mark warps home; pressed at home it shoots neurons that build up architectures in the field ──
  const goHome = (e) => { e.preventDefault(); if (currentMode() === 'journey' && window.warpHome) { window.warpHome(); return; } if (window.scrollY < 40 && window.shootNeurons && e.currentTarget.id === 'brand') { window.shootNeurons(); return; } window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); };
  $('brand').addEventListener('click', goHome); $('to-top').addEventListener('click', goHome);
  // the beacon: straight to what's latest (the PACD neuron, or its row in the document)
  const beacon = $('beacon'); if (beacon) beacon.addEventListener('click', (e) => { e.preventDefault(); if (currentMode() === 'journey') { if (window.jumpToNeuron) window.jumpToNeuron(1, 2); return; } const L = LAYERS[0], c = L && L.cards[2]; if (!c) return; if (desk()) window.scrollTo({ top: Math.round(beatOf(L, 2)), behavior: reduced ? 'auto' : 'smooth' }); else c.el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); });

  // ── The experiments. Each one builds its picture once and then only moves what changes, so a slider or a self-run is one smooth
  //    motion; the discrete ones (the bandit's rounds, the corruption modes) glide through CSS transitions on their bars ──
  const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
  const redraw = []; window.addEventListener('themechange', () => redraw.forEach(fn => fn()));
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const setA = (e, attrs) => { for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); };
  const fmtN = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + ' billion' : n >= 1e6 ? (n / 1e6).toFixed(0) + ' million' : n >= 1e3 ? Math.round(n / 1e3).toLocaleString() + ' thousand' : String(Math.round(n));
  // a cancellable ease-out tween; returns the cancel
  const tween = (from, to, ms, step, done) => { let raf = 0; const t0 = performance.now(); const f = (now) => { const k = Math.max(0, Math.min(1, (now - t0) / ms)); step(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(f); else if (done) done(); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); };
  // a cancellable sequence of timed steps
  const seq = (steps) => { const ts = steps.map(([ms, fn]) => setTimeout(fn, ms)); return () => ts.forEach(clearTimeout); };

  // ── JEPA: hide part of a scan, predict it from the rest ──
  (function () {
    const svg = $('jepa-svg'); if (!svg) return;
    const G = 8, C = 22, r0 = rng(7);
    const img = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const x = i / (G - 1), y = j / (G - 1); const v = 0.42 + 0.22 * Math.sin(3 * x + 1) * Math.cos(2.3 * y) + 0.55 * Math.exp(-((x - 0.6) ** 2 + (y - 0.4) ** 2) / 0.03) - 0.2 * Math.exp(-((x - 0.2) ** 2 + (y - 0.75) ** 2) / 0.06); img.push(Math.max(0, Math.min(1, v + 0.03 * gauss(r0)))); }
    const targets = new Set(); { const r = rng(101); let g = 0; while (targets.size < 18 && g++ < 100) { const w = 2 + Math.floor(r() * 2), h = 2 + Math.floor(r() * 2), x0 = Math.floor(r() * (G - w + 1)), y0 = Math.floor(r() * (G - h + 1)); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (targets.size < 18) targets.add(y * G + x); } }
    const guess = []; { const r = rng(900); for (let k = 0; k < G * G; k++) guess.push(0.5 + 0.35 * gauss(r)); }
    let prog = 0; const shade = (v) => { const a = Math.round(30 + v * 200); return `rgb(${a},${a},${a})`; };
    svg.setAttribute('viewBox', `0 0 ${G * C * 2 + 44} ${G * C + 18}`);
    el('text', { x: 0, y: 10 }, svg).textContent = 'Scan with hidden blocks'; const tR = el('text', { x: G * C + 44, y: 10 }, svg);
    const left = [], right = [];
    for (let k = 0; k < G * G; k++) { const x = (k % G) * C, y = Math.floor(k / G) * C + 16, hid = targets.has(k);
      left.push(el('rect', { x, y, width: C - 2, height: C - 2, rx: 3, 'stroke-width': 1.5, 'stroke-dasharray': hid ? '3 2' : null, 'data-hid': hid ? 1 : null }, svg));
      right.push(el('rect', { x: x + G * C + 44, y, width: C - 2, height: C - 2, rx: 3, 'stroke-width': 1.2, 'stroke-opacity': 0.8, 'data-hid': hid ? 1 : null, fill: shade(img[k]) }, svg)); }
    const arrow = el('path', { d: `M${G * C + 8},${G * C / 2 + 16} h26 m-6,-6 l6,6 l-6,6`, 'stroke-width': 2, fill: 'none' }, svg);
    function paint() { const bg = css('--surface-2'), hl = css('--accent-2'); arrow.setAttribute('stroke', css('--accent')); for (let k = 0; k < G * G; k++) { const hid = targets.has(k); setA(left[k], { fill: hid ? bg : shade(img[k]), stroke: hid ? hl : 'none' }); setA(right[k], { stroke: hid ? hl : 'none' }); } }
    function draw() { tR.textContent = `Prediction · ${Math.round(prog * 100)}% trained`; const m = Math.min(1, prog * 1.15);
      targets.forEach(k => right[k].setAttribute('fill', shade(Math.max(0, Math.min(1, guess[k] + (img[k] - guess[k]) * m)))));
      $('jepa-val').textContent = Math.round(prog * 100) + '%';
      $('jepa-out').innerHTML = prog < 0.05 ? 'Untrained: the hidden blocks are guesses.' : prog < 0.85 ? 'Learning what the hidden anatomy <b>should</b> look like from its surroundings.' : 'Trained: hidden blocks are predicted from context. On real scans this is done in 3D and in a learned feature space, so the model captures anatomy rather than noise.'; }
    $('jepa-prog').addEventListener('input', e => { prog = +e.target.value; draw(); });
    window.AUTO.jepa = (done) => { prog = 0; draw(); return tween(0, 0.92, 2000, v => { prog = v; $('jepa-prog').value = v.toFixed(2); draw(); }, done); };
    paint(); draw(); redraw.push(paint);
  })();

  // ── Wearables volume: raw minute-level readings vs daily derived values ──
  (function () {
    const svg = $('vol-svg'); if (!svg) return;
    let n = 1000; const W = 440, H = 64, X0 = 150; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const lmax = Math.log10(5.3e9), x = (v) => X0 + (Math.log10(Math.max(1, v)) / lmax) * (W - X0 - 10);
    const rows = [['Raw archive', '--accent-2'], ['Daily derivation', '--accent']].map(([lab, c], i) => { const y = 8 + i * 28; el('text', { x: 0, y: y + 12 }, svg).textContent = lab; const bg = el('rect', { x: X0, y, width: W - X0 - 10, height: 16, rx: 8 }, svg); const bar = el('rect', { x: X0, y, width: 6, height: 16, rx: 8 }, svg); const t = el('text', { x: X0 + 6, y: y + 12, 'font-weight': 600 }, svg); return { c, bg, bar, t }; });
    el('text', { x: X0, y: H - 2, 'font-size': 9 }, svg).textContent = 'log scale';
    function paint() { rows.forEach(r => { r.bg.setAttribute('fill', css('--surface-2')); r.bar.setAttribute('fill', css(r.c)); }); }
    function draw() { const raw = n * 525600, daily = n * 365; // one heart-rate reading per minute vs one value per day
      [raw, daily].forEach((v, i) => { const r = rows[i], xe = x(v), inside = xe > W - 120; r.bar.setAttribute('width', Math.max(6, xe - X0)); setA(r.t, { x: inside ? xe - 8 : xe + 6, 'text-anchor': inside ? 'end' : 'start' }); r.t.textContent = fmtN(v) + ' rows / yr'; r.t.style.fill = inside ? '#fff' : ''; });
      $('vol-val').textContent = n.toLocaleString();
      $('vol-out').innerHTML = `Minute-level heart rate alone is <b>${fmtN(raw)}</b> rows a year for ${n.toLocaleString()} patients. The archive keeps every reading as delivered; the derivation step turns them into one value per patient, metric and day for approved types only, which is the only route into the OMOP record.`; }
    $('vol-n').addEventListener('input', e => { n = Math.round(Math.pow(10, +e.target.value) / 10) * 10; draw(); });
    window.AUTO.vol = (done) => tween(2, 4.3, 2000, v => { n = Math.round(Math.pow(10, v) / 10) * 10; $('vol-n').value = v.toFixed(2); draw(); }, done);
    paint(); draw(); redraw.push(paint);
  })();

  // ── Bandit: learn which approved option keeps patients on their medication ──
  (function () {
    const host = $('bandit-svg'); if (!host) return;
    const ARMS = ['SMS reminder', 'Pharmacist call', 'App nudge', 'Caregiver alert'], TRUE = [0.52, 0.47, 0.71, 0.38];
    let ab, rounds, approved = [true, true, true, true], rnd; const W = 440, H = 104, X0 = 118, BW = 250; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const rows = ARMS.map((a, i) => { const y = 4 + i * 25; const name = el('text', { x: 0, y: y + 12 }, host); name.textContent = a; const bg = el('rect', { x: X0, y: y + 3, width: BW, height: 12, rx: 6 }, host); const bar = el('rect', { class: 'tr', x: X0, y: y + 3, width: BW * 0.5, height: 12, rx: 6 }, host); const sd = el('rect', { class: 'tr', x: X0, y: y + 8, width: 0, height: 2, rx: 1 }, host); const val = el('text', { x: 376, y: y + 12 }, host); return { name, bg, bar, sd, val }; });
    function paint() { rows.forEach(r => { r.bg.setAttribute('fill', css('--surface-2')); r.bar.setAttribute('fill', css('--accent')); r.sd.setAttribute('fill', css('--ink')); }); }
    function reset() { ab = ARMS.map(() => [1, 1]); rounds = 0; rnd = rng((Date.now() & 0xffff) + 1); draw(); }
    function beta(a, b) { const g = (k) => { if (k < 1) return g(k + 1) * Math.pow(rnd(), 1 / k); const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d); for (;;) { let x, v; do { x = gauss(rnd); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rnd(); if (u < 1 - 0.0331 * x ** 4) return d * v; if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; } }; const x = g(a), y = g(b); return x / (x + y); }
    function play(n) { for (let t = 0; t < n; t++) { const allowed = ARMS.map((_, i) => i).filter(i => approved[i]); if (!allowed.length) break; let best = -1, bv = -1; allowed.forEach(i => { const v = beta(ab[i][0], ab[i][1]); if (v > bv) { bv = v; best = i; } }); ab[best][rnd() < TRUE[best] ? 0 : 1]++; rounds++; } draw(); }
    function draw() { let bestI = -1, bestM = -1;
      ARMS.forEach((a, i) => { const [al, be] = ab[i]; const m = al / (al + be), k = al + be - 2, ok = approved[i]; if (ok && k > 0 && m > bestM) { bestM = m; bestI = i; } const r = rows[i];
        r.name.setAttribute('opacity', ok ? 1 : 0.4); r.val.setAttribute('opacity', ok ? 1 : 0.4); setA(r.bar, { width: BW * m, opacity: ok ? 0.95 : 0.2 });
        const sd = Math.sqrt(al * be / ((al + be) ** 2 * (al + be + 1))); const lo = Math.max(0, m - sd), hi = Math.min(1, m + sd); setA(r.sd, { x: X0 + BW * lo, width: BW * (hi - lo), opacity: ok ? 0.55 : 0.1 });
        r.val.textContent = `${Math.round(m * 100)}% · ${k} tried`; });
      $('bandit-out').innerHTML = rounds === 0 ? 'Every option starts equally uncertain. Bars are the estimated chance a patient stays on their medication; the dark line is how unsure the system still is.' : `After <b>${rounds}</b> patients the system favours <b>${bestI >= 0 ? ARMS[bestI] : 'nothing (no approved options)'}</b>. Unticked options are never chosen, however good they might be: the clinician's approved set is a hard limit. Simulated patients, not clinical data.`; }
    document.querySelectorAll('#bandit-ok input').forEach(c => c.addEventListener('change', e => { approved[+e.target.dataset.i] = e.target.checked; draw(); }));
    $('bandit-play').addEventListener('click', () => play(40)); $('bandit-reset').addEventListener('click', reset);
    window.AUTO.bandit = (done) => { reset(); const steps = []; for (let i = 0; i < 10; i++) steps.push([250 + i * 150, () => play(4)]); steps.push([250 + 10 * 150, () => { if (done) done(); }]); return seq(steps); };
    paint(); reset(); redraw.push(paint);
  })();

  // ── Threshold: accuracy vs patients actually found ──
  (function () {
    const host = $('metrics-svg'); if (!host) return;
    let thr = 0.78; const prev = 0.28, mn = 0.42, mp = 0.58, sd = 0.14;
    const W = 440, H = 110, M = { l: 6, r: 6, t: 14, b: 16 }; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = (t) => M.l + t * (W - M.l - M.r), pdf = (mu) => (t) => Math.exp(-0.5 * ((t - mu) / sd) ** 2), ymax = (1 - prev) * 1.05, y = (v) => H - M.b - (v / ymax) * (H - M.t - M.b);
    const curves = [[mn, 1 - prev, '--accent', 'not depressed'], [mp, prev, '--accent-2', 'depressed']].map(([mu, w, c, lab]) => {
      let d = ''; for (let t = 0; t <= 1.0001; t += 0.01) d += (t === 0 ? 'M' : 'L') + x(t).toFixed(1) + ',' + y(w * pdf(mu)(t)).toFixed(1) + ' ';
      const fill = el('path', { d: d + `L${x(1)},${y(0)} L${x(0)},${y(0)} Z`, opacity: 0.15 }, host); const line = el('path', { d, fill: 'none', 'stroke-width': 2 }, host);
      el('text', { x: x(mu), y: y(w) - 3, 'text-anchor': 'middle' }, host).textContent = lab; return { c, fill, line }; });
    const cut = el('line', { y1: M.t - 6, y2: H - M.b, 'stroke-width': 2 }, host); const cutT = el('text', { y: H - 4 }, host);
    function paint() { curves.forEach(c => { c.fill.setAttribute('fill', css(c.c)); c.line.setAttribute('stroke', css(c.c)); }); cut.setAttribute('stroke', css('--ink')); }
    function draw() { setA(cut, { x1: x(thr), x2: x(thr) }); const flip = thr > 0.6; setA(cutT, { x: x(thr) + (flip ? -4 : 4), 'text-anchor': flip ? 'end' : 'start' }); cutT.textContent = flip ? `"depressed" ← threshold ${thr.toFixed(2)}` : `threshold ${thr.toFixed(2)} → "depressed"`;
      const tpr = 1 - Phi((thr - mp) / sd), fpr = 1 - Phi((thr - mn) / sd), acc = prev * tpr + (1 - prev) * (1 - fpr);
      $('m-acc').textContent = (acc * 100).toFixed(0) + '%'; $('m-rec').textContent = (tpr * 100).toFixed(0) + '%';
      $('m-rec-ro').className = 'ro ' + (tpr < 0.3 ? 'bad' : tpr > 0.65 ? 'good' : '');
      $('metrics-out').innerHTML = tpr < 0.2 ? `Accuracy looks fine at <b>${(acc * 100).toFixed(0)}%</b>, yet only <span class="bad">${(tpr * 100).toFixed(0)}%</span> of depressed patients are found. The model is mostly saying "not depressed" to everyone.` : `Now <span class="good">${(tpr * 100).toFixed(0)}%</span> of depressed patients are found and accuracy barely moved. That is why we report per-class recall, not accuracy alone.`; }
    $('m-thr').addEventListener('input', e => { thr = +e.target.value; draw(); });
    window.AUTO.metrics = (done) => { thr = 0.5; draw(); return tween(0.5, 0.8, 1800, v => { thr = v; $('m-thr').value = v.toFixed(2); draw(); }, done); };
    paint(); draw(); redraw.push(paint);
  })();

  // ── Silent data corruption: last month's values against today's, on last month's scale; anything off the scale piles up at the edge ──
  (function () {
    const host = $('drift-svg'); if (!host) return;
    let mode = 'none'; const r = rng(3), ref = Array.from({ length: 1500 }, () => 50 + 10 * gauss(r));
    function batch() { const q = rng(99), out = { vals: [], nulls: 0 }; for (let i = 0; i < 400; i++) { let v = 50 + 10 * gauss(q); if (mode === 'unit') v *= 1000; if (mode === 'shift') v += 14; if (mode === 'null' && q() < 0.3) { out.nulls++; continue; } out.vals.push(v); } return out; }
    const sorted = ref.slice().sort((a, b) => a - b), edges = Array.from({ length: 11 }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(i / 10 * sorted.length))]);
    function shares(vals) { const c = new Array(10).fill(0); vals.forEach(v => { let b = 0; while (b < 9 && v >= edges[b + 1]) b++; c[b]++; }); const n = vals.length || 1; return c.map(x => Math.max(x / n, 1e-4)); }
    const pr = shares(ref);
    const W = 300, H = 70, NB = 20, X0 = 3, PW = W - 6 - 28, bw = PW / NB, OX = X0 + PW + 6; host.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const hist = (vals) => { const c = new Array(NB + 1).fill(0); vals.forEach(v => { c[v < 0 || v > 100 ? NB : Math.min(NB - 1, Math.floor(v / 100 * NB))]++; }); const n = vals.length || 1; return c.map(x => x / n); };
    const hr = hist(ref), ymax = Math.max(...hr) || 1; const bh = (p) => Math.min(H - 22, p / ymax * (H - 22));
    const bars = []; for (let k = 0; k <= NB; k++) { const x0 = k < NB ? X0 + k * bw : OX; const a = el('rect', { class: 'tr', x: x0 + 1, y: H - 14 - bh(hr[k]), width: bw / 2 - 1.5, height: bh(hr[k]), rx: 2, opacity: 0.55 }, host); const b = el('rect', { class: 'tr', x: x0 + bw / 2, y: H - 14, width: bw / 2 - 1.5, height: 0, rx: 2 }, host); bars.push([a, b]); }
    const legend = el('text', { x: X0, y: H - 2, 'font-size': 9 }, host); const offT = el('text', { x: OX + bw / 2, y: H - 2, 'font-size': 9, 'text-anchor': 'middle' }, host); offT.textContent = 'off scale';
    const checks = $('drift-checks'); const CHK = [['No missing values'], ['Values within 0–100'], ['Same distribution as last month']].map(([l]) => { const d = document.createElement('div'); d.innerHTML = `<span class="ic"></span><span class="l">${l}</span><span class="v"></span>`; checks.appendChild(d); return { d, ic: d.querySelector('.ic'), v: d.querySelector('.v') }; });
    function paint() { bars.forEach(([a, b]) => { a.setAttribute('fill', css('--accent')); b.setAttribute('fill', css('--accent-2')); }); }
    function draw() { const b = batch(), q = shares(b.vals), psi = pr.reduce((a, p, i) => a + (p - q[i]) * Math.log(p / q[i]), 0); const hb = hist(b.vals);
      bars.forEach(([, bar], k) => setA(bar, { y: H - 14 - bh(hb[k]), height: bh(hb[k]) }));
      legend.textContent = `■ last month   ■ today`;
      const inRange = b.vals.every(v => v >= 0 && v <= 100);
      [[b.nulls / 400 < 0.01, (b.nulls / 4).toFixed(1) + '% missing'], [inRange, inRange ? 'all in range' : 'out of range'], [psi < 0.2, 'drift ' + psi.toFixed(2)]].forEach(([ok, v], i) => { const c = CHK[i]; c.d.className = ok ? 'pass' : 'fail'; c.ic.textContent = ok ? '✓' : '✕'; c.v.textContent = v; });
      $('drift-out').innerHTML = mode === 'none' ? 'A healthy day: every check passes.' : mode === 'unit' ? 'Someone upstream changed units. Nothing crashed and nothing is missing, so only the range and distribution checks notice. This is the kind of silent corruption my validation frameworks catch before release.' : mode === 'null' ? 'A spike of missing values: caught by the simplest check, before it reaches a report or a model.' : 'The values quietly drifted upward. Only the distribution check fires, and a model trained on last month would now be wrong without anyone noticing.'; }
    const setMode = (m) => { document.querySelectorAll('#drift-mode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === m ? 'true' : 'false')); mode = m; draw(); };
    document.querySelectorAll('#drift-mode button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.v)));
    window.AUTO.drift = (done) => { setMode('none'); return seq([[1100, () => setMode('unit')], [2600, () => setMode('shift')], [3400, () => { if (done) done(); }]]); };
    paint(); draw(); redraw.push(paint);
  })();
})();
