/* PITCHER · fundo da história
   Bolas de beisebol em line art, grandes e médias, girando em 3D
   e passando devagar atrás do texto. Bem transparentes.
   De vez em quando um raio ciano percorre a borda de uma delas.
*/
(function () {
  'use strict';

  const section = document.querySelector('.story');
  if (!section) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cv = document.createElement('canvas');
  cv.className = 'story-bg';
  cv.setAttribute('aria-hidden', 'true');
  section.prepend(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0;

  /* ---------- a costura em 3D (mesma curva da bola do cursor) ---------- */
  const SEAM_N = 200;
  const seam = [];
  for (let i = 0; i < SEAM_N; i++) {
    const t = i / SEAM_N * Math.PI * 4;
    const A = 0.4;
    const lat = Math.PI / 2 - (Math.PI / 2 - A) * Math.cos(t);
    const lon = t / 2 + A * Math.sin(2 * t);
    seam.push([Math.sin(lat) * Math.cos(lon), Math.sin(lat) * Math.sin(lon), Math.cos(lat)]);
  }
  // pontos de linha: a cada 4 pontos, um tique cruzando a costura
  const stitches = [];
  for (let i = 0; i < SEAM_N; i += 4) {
    const p = seam[i], q = seam[(i + 1) % SEAM_N], o = seam[(i - 1 + SEAM_N) % SEAM_N];
    const t = norm([q[0] - o[0], q[1] - o[1], q[2] - o[2]]);
    const b = norm(cross(t, p));
    stitches.push([
      norm([p[0] + b[0] * 0.09 - t[0] * 0.03, p[1] + b[1] * 0.09 - t[1] * 0.03, p[2] + b[2] * 0.09 - t[2] * 0.03]),
      norm([p[0] - b[0] * 0.09 + t[0] * 0.03, p[1] - b[1] * 0.09 + t[1] * 0.03, p[2] - b[2] * 0.09 + t[2] * 0.03])
    ]);
  }

  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  // rotação de Rodrigues em torno de um eixo unitário
  function rotate(p, k, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const kx = k[0], ky = k[1], kz = k[2];
    const dot = kx * p[0] + ky * p[1] + kz * p[2];
    const cr = cross(k, p);
    return [
      p[0] * c + cr[0] * s + kx * dot * (1 - c),
      p[1] * c + cr[1] * s + ky * dot * (1 - c),
      p[2] * c + cr[2] * s + kz * dot * (1 - c)
    ];
  }

  /* ---------- as bolas ---------- */
  const balls = [];
  function makeBall(fresh) {
    const big = Math.random() < 0.4;
    const r = big ? 150 + Math.random() * 110 : 60 + Math.random() * 60;
    const b = {
      r,
      x: Math.random() * W,
      y: fresh ? Math.random() * H : (Math.random() < 0.5 ? -r : H + r),
      vx: (Math.random() - 0.5) * 6,              // px/s
      vy: (Math.random() < 0.5 ? 1 : -1) * (4 + Math.random() * 6),
      axis: norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]),
      ang: Math.random() * Math.PI * 2,
      spin: (Math.random() < 0.5 ? 1 : -1) * (0.08 + Math.random() * 0.12),   // rad/s
      alpha: big ? 0.07 : 0.1
    };
    return b;
  }

  function resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const rect = section.getBoundingClientRect();
    W = rect.width; H = rect.height;
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const want = Math.max(5, Math.round(W * H / 220000));
    while (balls.length < want) balls.push(makeBall(true));
    balls.length = Math.min(balls.length, want);
  }

  /* ---------- raios ciano na borda ---------- */
  const sparks = [];
  let nextSpark = 0;

  function midpointBolt(ax, ay, bx, by, depth, sway) {
    const pts = [{ x: ax, y: ay }, { x: bx, y: by }];
    let disp = Math.hypot(bx - ax, by - ay) * sway;
    for (let d = 0; d < depth; d++) {
      for (let i = pts.length - 1; i > 0; i--) {
        const p = pts[i - 1], q = pts[i];
        const dx = q.x - p.x, dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const j = (Math.random() - 0.5) * 2 * disp;
        pts.splice(i, 0, { x: (p.x + q.x) / 2 - dy / len * j, y: (p.y + q.y) / 2 + dx / len * j });
      }
      disp *= 0.5;
    }
    return pts;
  }

  function spawnSpark(now) {
    nextSpark = now + 900 + Math.random() * 2200;
    const b = balls[Math.floor(Math.random() * balls.length)];
    if (!b) return;
    // dois pontos na borda, 25 a 70 graus de distância; o raio corre por fora do contorno
    const a1 = Math.random() * Math.PI * 2;
    const a2 = a1 + (0.45 + Math.random() * 0.8) * (Math.random() < 0.5 ? 1 : -1);
    const rr = b.r * 1.02;
    sparks.push({ b, a1, a2, rr, life: 5, max: 5 });
  }

  function drawSparks() {
    if (!sparks.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      const b = s.b;
      // segue a borda em 3 ou 4 trechos, cada um com o serrilhado do raio
      const steps = 3 + Math.floor(Math.random() * 2);
      const pts = [];
      for (let k = 0; k <= steps; k++) {
        const a = s.a1 + (s.a2 - s.a1) * k / steps;
        pts.push({ x: b.x + Math.cos(a) * s.rr, y: b.y + Math.sin(a) * s.rr });
      }
      let path = [];
      for (let k = 0; k < steps; k++) {
        const seg = midpointBolt(pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y, 3, 0.22);
        path = path.concat(k ? seg.slice(1) : seg);
      }
      const al = (s.life / s.max) * (0.55 + Math.random() * 0.45);
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let j = 1; j < path.length; j++) ctx.lineTo(path[j].x, path[j].y);
      ctx.shadowColor = 'rgba(80,230,255,1)';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(80,230,255,' + (0.22 * al) + ')';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = 'rgba(210,248,255,' + (0.55 * al) + ')';
      ctx.stroke();
      if (--s.life <= 0) sparks.splice(i, 1);
    }
    ctx.restore();
  }

  /* ---------- desenho ---------- */
  function drawBall(b) {
    const { x, y, r } = b;
    ctx.save();
    ctx.translate(x, y);

    // contorno
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(239,232,216,' + b.alpha + ')';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // costura: só a metade virada para a gente (z > 0)
    ctx.strokeStyle = 'rgba(226,75,47,' + (b.alpha * 1.6) + ')';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= SEAM_N; i++) {
      const p = rotate(seam[i % SEAM_N], b.axis, b.ang);
      if (p[2] > 0.02) {
        const sx = p[0] * r, sy = p[1] * r;
        if (pen) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
        pen = true;
      } else {
        pen = false;
      }
    }
    ctx.stroke();

    // pontos de linha
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (const st of stitches) {
      const p = rotate(st[0], b.axis, b.ang), q = rotate(st[1], b.axis, b.ang);
      if (p[2] > 0.05 && q[2] > 0.05) {
        ctx.moveTo(p[0] * r, p[1] * r);
        ctx.lineTo(q[0] * r, q[1] * r);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  let last = performance.now();
  let visible = true;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (visible) {
      ctx.clearRect(0, 0, W, H);
      for (const b of balls) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.ang += b.spin * dt;
        // saiu por um lado, volta pelo outro
        if (b.y < -b.r - 10) { b.y = H + b.r; b.x = Math.random() * W; }
        if (b.y > H + b.r + 10) { b.y = -b.r; b.x = Math.random() * W; }
        if (b.x < -b.r) b.x = W + b.r;
        if (b.x > W + b.r) b.x = -b.r;
        drawBall(b);
      }
      if (now > nextSpark) spawnSpark(now);
      drawSparks();
    }
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(section);

  if (reduceMotion) {
    balls.forEach(drawBall);
    return;
  }
  // só gasta quadro quando a história está na tela
  if (window.IntersectionObserver) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { rootMargin: '200px' }).observe(section);
  }
  requestAnimationFrame(frame);
})();
