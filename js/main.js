/* PITCHER · Ray Yani
   - pontos da ficha (●●●○○)
   - vórtice do Nimbus no hero, com controle de potência
     exposto em window.pitcherVortex.set(0..1) para os efeitos
*/
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- pontos ---------- */
  document.querySelectorAll('.dots').forEach(el => {
    const v = parseInt(el.dataset.v, 10) || 0;
    const max = parseInt(el.dataset.max, 10) || 5;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', v + ' de ' + max);
    for (let i = 0; i < max; i++) {
      const dot = document.createElement('i');
      if (i < v) dot.classList.add('on');
      el.appendChild(dot);
    }
  });

  /* ---------- vórtice (Nimbus) ---------- */
  const canvas = document.getElementById('vortex');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, cx = 0, cy = 0;

  const BASE_N = 260;      // partículas em repouso
  const MAX_N = 3200;      // partículas em potência máxima
  let level = 0;           // 0 = hero normal, 1 = potência máxima
  let collapse = 0;        // 0 = normal, 1 = tudo sugado para o centro (Espaço)
  let energy = 0;          // 0 = nada, 1 = raios saltando entre as partículas (Forças)
  let target = BASE_N;
  let speed = 1;
  let holeR = 0;           // raio atual do buraco (abre e fecha suavemente)
  let centerShift = 0;     // 0 = olho do vórtice à direita (hero), 1 = no meio da tela
  let parts = [];
  const bolts = [];

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    aim();
  }

  // centro desliza da direita (hero) para o meio
  function aim() {
    cx = W * (0.72 - 0.22 * Math.max(level, centerShift));
    cy = H * 0.5;
  }

  function spawn(p, fresh) {
    const maxR = Math.max(W, H) * 0.8;
    p.r = fresh ? maxR * (0.25 + Math.random() * 0.75) : maxR;
    p.a = Math.random() * Math.PI * 2;
    p.s = 0.6 + Math.random() * 1.4;
    p.warm = Math.random() < 0.18;
    p.alpha = 0.25 + Math.random() * 0.5;
    return p;
  }

  function step(p) {
    p.a += 260 / (p.r + 40) * 0.012 * speed * (1 + collapse * 2);
    p.r -= (0.35 + 40 / (p.r + 10)) * speed * (1 + collapse * 40);
    if (p.r < 18 + holeR * 0.7) {      // some dentro da zona esfumaçada da borda
      if (collapse > 0) p.dead = true;   // caiu no buraco, não volta
      else spawn(p, false);
    }
  }

  function pos(p) {
    return { x: cx + Math.cos(p.a) * p.r, y: cy + Math.sin(p.a) * p.r * 0.55 };
  }

  function draw(p, boost) {
    const { x, y } = pos(p);
    const a = Math.min(1, p.alpha * boost);
    ctx.fillStyle = p.warm ? 'rgba(255,182,72,' + a + ')' : 'rgba(239,232,216,' + (a * 0.7) + ')';
    ctx.fillRect(x, y, p.s, p.s);
  }

  /* ---------- raios entre partículas ---------- */
  // deslocamento de ponto médio: a cada subdivisão o desvio cai pela metade,
  // o que dá a forma fractal de um raio real (grandes curvas + serrilhado fino)
  function bolt(ax, ay, bx, by, depth, sway) {
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

  // ramos curtos que saem do caminho principal
  function branches(pts) {
    const out = [];
    const n = Math.random() < 0.55 ? 1 + Math.floor(Math.random() * 2) : 0;
    for (let k = 0; k < n; k++) {
      const i = 1 + Math.floor(Math.random() * (pts.length - 2));
      const p = pts[i], q = pts[i + 1];
      const ang = Math.atan2(q.y - p.y, q.x - p.x) + (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.7);
      const len = 12 + Math.random() * 30;
      out.push(bolt(p.x, p.y, p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len, 2, 0.25));
    }
    return out;
  }

  function spawnBolts() {
    if (energy <= 0 || parts.length < 2) return;
    // poucos raios por quadro, só entre bolinhas longe do olho do vórtice
    const MIN_R = 110;
    const tries = Math.random() < energy * 0.9 ? 1 : 0;
    for (let k = 0; k < tries; k++) {
      const a = parts[Math.floor(Math.random() * parts.length)];
      if (a.r < MIN_R) continue;
      const A = pos(a);
      let B;
      for (let i = 0; i < 8; i++) {
        const b = parts[Math.floor(Math.random() * parts.length)];
        if (b === a || b.r < MIN_R) continue;
        const P = pos(b);
        if (Math.hypot(P.x - A.x, P.y - A.y) < 150) { B = P; break; }
      }
      if (!B) continue;
      const main = bolt(A.x, A.y, B.x, B.y, 4, 0.22);
      const max = 3 + Math.floor(Math.random() * 4);
      bolts.push({
        pts: main,
        sub: branches(main),
        life: max, max,
        hot: Math.random() < 0.25     // alguns são bem mais brilhantes
      });
    }
  }

  function strokePath(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.stroke();
  }

  function drawBolts() {
    if (!bolts.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';      // luz soma, não cobre
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      // vida decai com cintilação: pisca antes de apagar
      const a = (b.life / b.max) * (0.65 + Math.random() * 0.35) * (b.hot ? 1.35 : 1);

      // 1. halo largo e muito desfocado
      ctx.shadowColor = 'rgba(255,160,50,1)';
      ctx.shadowBlur = 22;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255,170,60,' + (0.10 * a) + ')';
      strokePath(b.pts);

      // 2. brilho médio
      ctx.shadowBlur = 9;
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(255,200,110,' + (0.35 * a) + ')';
      strokePath(b.pts);
      for (const s of b.sub) { ctx.lineWidth = 1.4; strokePath(s); }

      // 3. núcleo fino, quase branco, sem desfoque
      ctx.shadowBlur = 0;
      ctx.lineWidth = b.hot ? 1.4 : 0.9;
      ctx.strokeStyle = 'rgba(255,246,225,' + Math.min(1, a) + ')';
      strokePath(b.pts);
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = 'rgba(255,240,210,' + (0.7 * a) + ')';
      for (const s of b.sub) strokePath(s);

      if (--b.life <= 0) bolts.splice(i, 1);
    }
    ctx.restore();
  }

  function frame() {
    // população segue o alvo aos poucos
    if (collapse > 0) {
      parts = parts.filter(p => !p.dead);
    } else if (parts.length < target) {
      const add = Math.min(60, target - parts.length);
      for (let i = 0; i < add; i++) parts.push(spawn({}, true));
    } else if (parts.length > target) {
      parts.length = Math.max(target, parts.length - 60);
    }

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,' + (0.22 - 0.1 * level) + ')';   // rastro mais longo com potência
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const boost = 1 + level * 0.6;
    for (const p of parts) { step(p); draw(p, boost); }
    spawnBolts();
    drawBolts();
    drawHole();
    requestAnimationFrame(frame);
  }

  /* ---------- o buraco (Espaço) ---------- */
  function drawHole() {
    const targetR = collapse * Math.min(W, H) * 0.26;
    holeR += (targetR - holeR) * (targetR > holeR ? 0.06 : 0.1);
    if (holeR < 0.5) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.55);                       // mesmo achatamento do vórtice
    // miolo sólido até 40% do raio, depois uma borda longa esfumaçada
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, holeR);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.4, 'rgba(0,0,0,1)');
    g.addColorStop(0.62, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.8, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, holeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < BASE_N; i++) parts.push(spawn({}, true));

  if (reduceMotion) {
    for (let i = 0; i < 30; i++) parts.forEach(step);
    parts.forEach(p => draw(p, 1.4));
  } else {
    requestAnimationFrame(frame);
  }

  window.pitcherVortex = {
    set(l) {
      level = Math.max(0, Math.min(1, l));
      target = Math.round(BASE_N + (MAX_N - BASE_N) * level * level);
      speed = 1 + level * 2.6;
      aim();
    },
    collapse(c) { collapse = Math.max(0, Math.min(1, c)); },
    energy(e) { energy = Math.max(0, Math.min(1, e)); },
    center(s) { centerShift = Math.max(0, Math.min(1, s)); aim(); },
    count() { return parts.length; },
    resize
  };
})();
