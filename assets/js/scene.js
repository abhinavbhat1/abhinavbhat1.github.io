/* Two quiet drawings.
   The hero is a live neural network: nodes drift, the pointer wakes the nodes it passes and bends the ones nearby,
   and a click (or a pause) runs a forward pass: the input activations feed through the hidden layers, every link
   carries a signal in proportion to its weight, the strongest route lights up, and the output neuron reports its value.
   Contact ends on the output neuron released into a loss bowl, settling at the global minimum under damped physics. */
(function () {
  'use strict';
  const root = document.documentElement; const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)); const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); }; const mix = (a, b, k) => a + (b - a) * k;
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const col = { ink: '#141414', accent: '#2b5bd7', bg: '#fbfbf9' };
  function theme() { const cs = getComputedStyle(root); col.ink = cs.getPropertyValue('--ink').trim() || col.ink; col.accent = cs.getPropertyValue('--accent').trim() || col.accent; col.bg = cs.getPropertyValue('--bg').trim() || col.bg; }
  theme(); window.addEventListener('themechange', theme);
  const narrow = () => window.innerWidth < 900;
  function fit(c) { const r = c.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2); c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr)); const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, W: r.width, H: r.height }; }

  // ───────── the live network ─────────
  const net = document.getElementById('net');
  if (net) {
    const LAY = [4, 7, 7, 4, 1], L = LAY.length - 1; const r0 = rng(11);
    const nodes = []; LAY.forEach((n, k) => { for (let i = 0; i < n; i++) nodes.push({ k, i, n, jx: (r0() - 0.5) * 0.05, jy: (r0() - 0.5) * 0.06, ph: r0() * 6.28, x: 0, y: 0, rx: 0, ry: 0, vx: 0, vy: 0, a: 0, hov: 0, out: k === L }); });
    const OUT = nodes.length - 1; const byL = Array.from({ length: L + 1 }, (_, k) => nodes.filter(n => n.k === k));
    const edges = []; { const r = rng(1234); for (let k = 0; k < L; k++) byL[k].forEach(A => byL[k + 1].forEach(B => edges.push({ a: nodes.indexOf(A), b: nodes.indexOf(B), w: (r() - 0.5) * 2, k: k + 1, s: 0 }))); }
    let g, W = 1, H = 1; const ptr = { x: -1e4, y: -1e4, t: 0 };
    function layout() { ({ g, W, H } = fit(net)); const m = narrow(); const x0 = m ? 0.08 : 0.54, x1 = m ? 0.92 : 0.95; const yTop = m ? 28 : H * 0.16, yBot = m ? Math.min(H * 0.42, window.innerHeight * 0.38) : H * 0.84; nodes.forEach(nd => { nd.rx = W * (x0 + (x1 - x0) * nd.k / L + nd.jx); nd.ry = yTop + (yBot - yTop) * ((nd.i + 0.5) / nd.n + nd.jy * (nd.n > 1 ? 1 : 0)); if (!nd.x) { nd.x = nd.rx; nd.y = nd.ry; } }); }
    layout(); new ResizeObserver(layout).observe(net);
    net.addEventListener('pointermove', (e) => { const r = net.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.t = performance.now(); }, { passive: true });
    net.addEventListener('pointerleave', () => { ptr.x = -1e4; ptr.y = -1e4; });
    net.addEventListener('pointerdown', (e) => { const r = net.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; fire(true); lastFire = performance.now(); });
    // a forward pass: activations layer by layer, the strongest route, and signals on every link
    const pass = { on: false, t0: 0, acts: null, path: null, y: 0 }; let lastFire = performance.now() + 1500;
    const readout = document.getElementById('readout');
    function fire(fromPointer) {
      const acts = [byL[0].map(nd => { const d = Math.hypot(nd.x - ptr.x, nd.y - ptr.y); const h = fromPointer ? Math.exp(-((d / 140) ** 2)) : 0; return clamp(0.15 + 0.85 * h + (fromPointer ? 0 : Math.random() * 0.8)); })];
      let yOut = 0.5;
      for (let k = 1; k <= L; k++) { const prev = acts[k - 1]; const raw = byL[k].map((nd) => { let s = 0; edges.forEach(e => { if (e.k === k && nodes[e.b] === nd) s += prev[nodes[e.a].i] * e.w; }); return s; }); if (k === L) { yOut = 1 / (1 + Math.exp(-1.6 * raw[0])); acts.push([0.35 + 0.65 * yOut]); } else { const cur = raw.map(v => Math.max(0, v)); const m = Math.max(...cur, 1e-6); acts.push(cur.map(v => v / m)); } }
      const path = acts.map(a => a.indexOf(Math.max(...a)));
      pass.on = true; pass.t0 = performance.now(); pass.acts = acts; pass.path = path; pass.y = yOut;
    }
    window.__fire = () => fire(false);
    const STEP = 0.42; // seconds per layer
    let last = 0;
    function frame(now) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now; const t = now / 1000;
      if (!reduced && now - lastFire > 7000 && document.visibilityState === 'visible') { fire(false); lastFire = now; }
      const el = pass.on ? (now - pass.t0) / 1000 : 99; const pt = el / STEP; // layers reached so far
      if (pass.on && el > STEP * (L + 1) + 2.4) pass.on = false;
      // physics: spring to rest, gentle drift, pointer bend; hover wakes nodes
      nodes.forEach(nd => {
        const tx = nd.rx + Math.sin(t * 0.5 + nd.ph) * 5, ty = nd.ry + Math.cos(t * 0.4 + nd.ph * 1.3) * 5;
        let fx = (tx - nd.x) * 6, fy = (ty - nd.y) * 6;
        const dx = nd.x - ptr.x, dy = nd.y - ptr.y, d = Math.hypot(dx, dy) || 1; if (d < 120) { const f = (1 - d / 120) * 900; fx += dx / d * f; fy += dy / d * f; }
        nd.vx = (nd.vx + fx * dt) * Math.exp(-dt * 4); nd.vy = (nd.vy + fy * dt) * Math.exp(-dt * 4); nd.x += nd.vx * dt; nd.y += nd.vy * dt;
        const hv = d < 110 ? 1 - d / 110 : 0; nd.hov += (hv - nd.hov) * (1 - Math.exp(-dt * 8));
        let a = 0; if (pass.on) { const reach = clamp(pt - nd.k); a = pass.acts[nd.k][nd.i] * smooth(reach) * (1 - smooth((el - STEP * (L + 1) - 1.2) / 1.2)); }
        nd.a += (Math.max(a, nd.hov * 0.6) - nd.a) * (1 - Math.exp(-dt * 10));
      });
      g.clearRect(0, 0, W, H);
      // links: faint by weight; carrying a signal while the pass crosses them; the strongest route in the accent
      g.lineWidth = 1;
      edges.forEach(e => { const A = nodes[e.a], B = nodes[e.b]; const onPath = pass.on && pass.path[e.k - 1] === A.i && pass.path[e.k] === B.i && pt > e.k - 1 + 0.5;
        const sig = pass.on ? pass.acts[e.k - 1][A.i] * Math.abs(e.w) * smooth(pt - (e.k - 1)) * (1 - smooth((el - STEP * (L + 1) - 1.2) / 1.2)) : 0;
        g.strokeStyle = onPath ? col.accent : col.ink; g.globalAlpha = onPath ? 0.85 : 0.06 + 0.1 * Math.abs(e.w) + 0.35 * sig + 0.25 * Math.max(A.hov, B.hov) * 0.5; g.lineWidth = onPath ? 1.6 : 1;
        g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
        if (sig > 0.08 && pt > e.k - 1 && pt < e.k + 0.4) { const u = clamp(pt - (e.k - 1)); const x = mix(A.x, B.x, u), y = mix(A.y, B.y, u); g.globalAlpha = sig; g.fillStyle = col.accent; g.beginPath(); g.arc(x, y, 1.6 + 1.6 * sig, 0, 6.2832); g.fill(); } });
      g.lineWidth = 1;
      nodes.forEach(nd => { const r = (nd.out ? 7 : 4.2) * (1 + 0.35 * nd.a); const onPath = pass.on && pass.path[nd.k] === nd.i && pt > nd.k + 0.5;
        g.globalAlpha = 1; g.fillStyle = col.bg; g.beginPath(); g.arc(nd.x, nd.y, r, 0, 6.2832); g.fill();
        g.strokeStyle = onPath ? col.accent : col.ink; g.globalAlpha = 0.55 + 0.45 * nd.a; g.beginPath(); g.arc(nd.x, nd.y, r, 0, 6.2832); g.stroke();
        if (nd.a > 0.02) { g.fillStyle = onPath ? col.accent : col.ink; g.globalAlpha = nd.a * (onPath ? 1 : 0.75); g.beginPath(); g.arc(nd.x, nd.y, r * nd.a, 0, 6.2832); g.fill(); }
        if (nd.hov > 0.05) { g.strokeStyle = col.accent; g.globalAlpha = nd.hov * 0.5; g.beginPath(); g.arc(nd.x, nd.y, r + 5 * nd.hov, 0, 6.2832); g.stroke(); } });
      g.globalAlpha = 1;
      // the output's readout
      if (readout) { const o = nodes[OUT]; const show = pass.on && pt > L + 0.6 && el < STEP * (L + 1) + 1.6; readout.classList.toggle('show', show); if (show) { readout.textContent = `output ${pass.y.toFixed(2)}`; readout.style.left = (net.offsetLeft + o.x) + 'px'; readout.style.top = (net.offsetTop + o.y + 16) + 'px'; } }
      window.__net = { on: pass.on, el: +el.toFixed(2), y: pass.on ? +pass.y.toFixed(2) : null, lit: nodes.filter(n => n.a > 0.3).length, hov: nodes.filter(n => n.hov > 0.3).length, out: { x: Math.round(nodes[OUT].x), y: Math.round(nodes[OUT].y) }, in0: { x: Math.round(nodes[0].x), y: Math.round(nodes[0].y) } };
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ───────── the global minimum ─────────
  const mc = document.getElementById('minimum');
  if (mc) {
    let g, W = 1, H = 1; function layout() { ({ g, W, H } = fit(mc)); } layout(); new ResizeObserver(layout).observe(mc);
    const m = { u: 0, v: 0, du: 0, dv: 0, on: false, t0: 0 }; const OM = 2.0, MU = 0.95, R = 1;
    function release() { m.on = true; m.t0 = performance.now(); m.u = R * 0.9; m.v = 0; m.du = -0.25; m.dv = 0.62 * OM * R * 0.9; }
    const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting && !m.on) release(); }), { threshold: 0.5 }); io.observe(mc);
    const toScreen = (u, v, h) => { const cx = W * 0.5, cy = H * 0.5, s = Math.min(W, H) * 0.4; return { x: cx + u * s, y: cy + v * s * 0.46 - h * s * 0.55 }; };
    const bowl = (u, v) => 0.5 * (u * u + v * v) - 0.5; // the well: zero at the rim, −0.5 at the minimum
    mc.addEventListener('pointerdown', (e) => { const r = mc.getBoundingClientRect(); const p = toScreen(m.u, m.v, bowl(m.u, m.v)); const dx = e.clientX - r.left - p.x, dy = e.clientY - r.top - p.y; if (!m.on) release(); const d = Math.hypot(dx, dy); if (d < 44) { const k = 1.4 / Math.max(d, 8); m.du -= dx * k; m.dv -= dy * k * 1.6; } });
    window.__release = release;
    let last = 0;
    function frame(now) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      if (m.on && !reduced) { for (let s = 0; s < 2; s++) { const h = dt / 2; m.du += (-OM * OM * m.u - MU * m.du) * h; m.dv += (-OM * OM * m.v - MU * m.dv) * h; m.u += m.du * h; m.v += m.dv * h; const rr = Math.hypot(m.u, m.v); if (rr > R * 1.08) { const k = R * 1.08 / rr; m.u *= k; m.v *= k; const nu = m.u / rr, nv = m.v / rr, vn = m.du * nu + m.dv * nv; if (vn > 0) { m.du -= 1.5 * vn * nu; m.dv -= 1.5 * vn * nv; } } } } else if (reduced) { m.u = m.v = 0; }
      g.clearRect(0, 0, W, H); g.lineWidth = 1;
      // contour rings of the bowl
      for (let q = 1; q <= 7; q++) { const r = R * q / 7; g.strokeStyle = col.ink; g.globalAlpha = 0.12 + 0.22 * (1 - q / 7); g.beginPath(); for (let i = 0; i <= 72; i++) { const a = i / 72 * 6.2832; const p = toScreen(r * Math.cos(a), r * Math.sin(a), bowl(r * Math.cos(a), r * Math.sin(a))); if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); } g.stroke(); }
      // the descent trail from where it was released
      const rim = toScreen(R * 0.9, 0, 0); g.strokeStyle = col.ink; g.globalAlpha = 0.25; g.setLineDash([2, 5]); g.beginPath(); g.moveTo(rim.x, Math.max(6, rim.y - H * 0.42)); g.lineTo(rim.x, rim.y); g.stroke(); g.setLineDash([]);
      // the marble and its shadow
      const h = bowl(m.u, m.v); const p = toScreen(m.u, m.v, h), sh = toScreen(m.u, m.v, h - 0.02); const rad = Math.min(W, H) * 0.028;
      g.fillStyle = col.ink; g.globalAlpha = 0.14; g.beginPath(); g.ellipse(sh.x + rad * 0.3, sh.y + rad * 0.9, rad * 1.1, rad * 0.4, 0, 0, 6.2832); g.fill();
      g.fillStyle = col.accent; g.globalAlpha = 1; g.beginPath(); g.arc(p.x, p.y, rad, 0, 6.2832); g.fill();
      g.strokeStyle = col.accent; g.globalAlpha = 0.35; g.beginPath(); g.arc(p.x, p.y, rad * 1.8, 0, 6.2832); g.stroke();
      // the label at the minimum
      const c = toScreen(0, 0, -0.5); g.globalAlpha = 0.55; g.fillStyle = col.ink; g.font = `11px ui-monospace, Menlo, monospace`; g.textAlign = 'center'; g.fillText('global minimum', c.x, c.y + rad * 2.6 + 12);
      g.globalAlpha = 1;
      window.__min = { on: m.on, u: +m.u.toFixed(3), v: +m.v.toFixed(3), r: +Math.hypot(m.u, m.v).toFixed(3), ball: { x: Math.round(p.x), y: Math.round(p.y) } };
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();
