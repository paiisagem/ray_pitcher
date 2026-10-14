/* PITCHER · efeitos
   1. Giroscópio no cursor: três anéis de partículas giram ao redor do
      mouse e aceleram quando ele se move rápido.
   2. "force" → a página some, o vórtice do hero toma a tela e ganha
                potência até FORÇAS ●●●. Depois volta ao normal.
   3. "space" → igual, mas o olho do vórtice vira um buraco que engole
                tudo. Fica só ESPAÇO ●●●.
*/
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fxRunning = false;

  const smooth = (a, b, x) => { const p = Math.min(1, Math.max(0, (x - a) / (b - a))); return p * p * (3 - 2 * p); };

  // ARCANA ●●● no centro da tela
  function arcanaLabel(name, level, clickable) {
    const el = document.createElement('div');
    el.className = 'arcana' + (clickable ? ' clickable' : '');
    let dots = '';
    for (let i = 0; i < level; i++) dots += '<i></i>';
    el.innerHTML = '<h1>' + name + '</h1><div class="arcana-dots">' + dots + '</div>';
    document.body.appendChild(el);
    return el;
  }

  /* ============================================================
     1. giroscópio no cursor
     ============================================================ */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    const cv = document.createElement('canvas');
    cv.id = 'cursor-gyro';
    cv.className = 'fx-canvas';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0;

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // três anéis do gimbal: raio, achatamento, inclinação, velocidade, precessão, partículas
    const rings = [
      { R: 22, ry: 0.35, tilt: 0.4, w: 3.2, prec: 0.9, n: 12, warm: 0.5 },
      { R: 34, ry: 0.6, tilt: -1.1, w: -2.3, prec: -0.6, n: 16, warm: 0.2 },
      { R: 46, ry: 0.9, tilt: 1.6, w: 1.6, prec: 0.4, n: 20, warm: 0.1 }
    ];
    const dots = [];
    rings.forEach((rg, ri) => {
      for (let i = 0; i < rg.n; i++) {
        dots.push({ ring: ri, th: i / rg.n * Math.PI * 2 + Math.random() * 0.2, warm: Math.random() < rg.warm, s: 1.2 + Math.random() * 1.2 });
      }
    });

    let mx = -999, my = -999;      // mouse (onde a bola fica)
    let px = -999, py = -999;      // centro dos anéis (segue com atraso)
    let bx = -999, by = -999;      // onde a bola foi desenhada no quadro anterior
    let inside = false;
    let lastMove = 0;
    let spin = 0, boost = 0, vis = 0, ballRot = 0;
    let last = performance.now();

    document.documentElement.classList.add('has-ball');   // esconde o cursor nativo

    document.addEventListener('mousemove', e => {
      if (!inside) { px = e.clientX; py = e.clientY; }
      mx = e.clientX; my = e.clientY;
      inside = true;
      lastMove = performance.now();
    });
    document.addEventListener('mouseleave', () => { inside = false; });

    const BALL_R = 7;

    function drawBall(x, y, rot, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      // couro com leve sombra
      const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, BALL_R);
      g.addColorStop(0, '#fbf8f0');
      g.addColorStop(1, '#cfc8b8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = 'rgba(40,34,28,0.7)';
      ctx.stroke();
      // duas costuras curvas, uma de cada lado
      ctx.strokeStyle = '#c8322b';
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      const sr = BALL_R * 1.45, off = BALL_R * 1.55, span = 0.62;
      ctx.beginPath(); ctx.arc(-off, 0, sr, -span, span); ctx.stroke();
      ctx.beginPath(); ctx.arc(off, 0, sr, Math.PI - span, Math.PI + span); ctx.stroke();
      // pontinhos de linha ao longo das costuras
      ctx.lineWidth = 0.8;
      for (let i = -2; i <= 2; i++) {
        const a = i * span / 2.4;
        const x1 = -off + Math.cos(a) * sr, y1 = Math.sin(a) * sr;
        ctx.beginPath(); ctx.moveTo(x1 - 1.4, y1 - 0.9); ctx.lineTo(x1 + 1.4, y1 + 0.9); ctx.stroke();
        const x2 = off - Math.cos(a) * sr, y2 = Math.sin(a) * sr;
        ctx.beginPath(); ctx.moveTo(x2 - 1.4, y2 + 0.9); ctx.lineTo(x2 + 1.4, y2 - 0.9); ctx.stroke();
      }
      ctx.restore();
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;

      // o centro dos anéis persegue a bola; a distância vira impulso de rotação
      const dx = mx - px, dy = my - py;
      px += dx * 0.22; py += dy * 0.22;
      const v = Math.hypot(dx, dy);
      boost += (Math.min(4, v / 18) - boost) * 0.1;
      spin += dt * (1 + boost);
      ballRot += dt * (0.6 + boost * 2.2);

      // visível com o mouse na página, mais apagado parado, some nos efeitos
      const idle = now - lastMove > 1800;
      const target = (!inside || fxRunning) ? 0 : (idle ? 0.5 : 1);
      vis += (target - vis) * 0.08;

      // limpa a bola do quadro anterior por inteiro (sem rastro no cursor)
      ctx.clearRect(bx - BALL_R - 3, by - BALL_R - 3, BALL_R * 2 + 6, BALL_R * 2 + 6);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';

      if (vis > 0.01) {
        const grow = 1 + boost * 0.12;    // anéis abrem um pouco com velocidade
        for (const d of dots) {
          const rg = rings[d.ring];
          const a = d.th + spin * rg.w;
          const phi = rg.tilt + spin * rg.prec * 0.3;
          const R = rg.R * grow;
          const lx = Math.cos(a) * R, ly = Math.sin(a) * R * rg.ry;
          const x = px + lx * Math.cos(phi) - ly * Math.sin(phi);
          const y = py + lx * Math.sin(phi) + ly * Math.cos(phi);
          // a metade "de trás" do anel fica mais fraca: dá volume
          const depth = 0.5 + 0.5 * (Math.sin(a) + 1) / 2;
          // opacidade baixa de propósito: não pode brigar com o texto
          const al = vis * depth * (d.warm ? 0.42 : 0.28);
          ctx.fillStyle = d.warm ? 'rgba(255,182,72,' + al + ')' : 'rgba(239,232,216,' + al + ')';
          ctx.fillRect(x - d.s / 2, y - d.s / 2, d.s, d.s);
        }
      }

      if (inside && !fxRunning) {
        drawBall(mx, my, ballRot, 1);
        bx = mx; by = my;
      } else {
        bx = by = -999;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
     teclado: "space" e "force"
     ============================================================ */
  let buf = '';
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-5);
    if (buf.endsWith('space')) { buf = ''; spaceEffect(); }
    else if (buf.endsWith('force')) { buf = ''; forceEffect(); }
  });

  /* ============================================================
     foco no hero: a página some, a grade sai, o vórtice toma a tela
     ============================================================ */
  function focusHero(vortex) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.classList.add('focus');
    requestAnimationFrame(() => vortex.resize());
  }
  function releaseHero(vortex) {
    document.documentElement.classList.remove('focus');
    requestAnimationFrame(() => vortex.resize());
  }

  /* ============================================================
     2. "force" → o vórtice ganha potência → FORÇAS ●●● → volta
     ============================================================ */
  function forceEffect() {
    if (fxRunning || !window.pitcherVortex) return;
    fxRunning = true;

    const vortex = window.pitcherVortex;
    const RAMP_END = 5.1;    // potência chega ao máximo
    const LABEL_IN = 4.6;    // FORÇAS aparece
    const LABEL_OUT = 8.0;   // FORÇAS some
    const END = 10.0;        // tudo volta ao normal

    focusHero(vortex);
    const label = arcanaLabel('FORÇAS', 3, false);
    const t0 = performance.now();

    function frame(now) {
      const t = (now - t0) / 1000;

      let level = Math.pow(smooth(0.3, RAMP_END, t), 1.6);
      if (t > LABEL_OUT) level = Math.min(level, 1 - smooth(LABEL_OUT, END, t));
      vortex.set(level);
      vortex.energy(Math.pow(level, 1.5));   // raios só aparecem com potência de verdade

      if (t > LABEL_IN && t < LABEL_OUT) label.classList.add('on');
      else label.classList.remove('on');

      if (t < END) requestAnimationFrame(frame);
      else {
        vortex.set(0);
        vortex.energy(0);
        label.remove();
        releaseHero(vortex);
        fxRunning = false;
      }
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
     3. "space" → o olho do vórtice vira um buraco que engole tudo
        → fica só ESPAÇO ●●●
     ============================================================ */
  function spaceEffect() {
    if (fxRunning || !window.pitcherVortex) return;
    fxRunning = true;

    const vortex = window.pitcherVortex;
    const CENTER_END = 2.1;    // olho do vórtice chega ao meio da tela
    const COLLAPSE = 2.4;      // o buraco abre e começa a engolir
    const COLLAPSE_END = 5.0;  // nada mais sobra
    const LABEL_IN = 5.3;      // ESPAÇO aparece
    const LABEL_OUT = 8.2;     // ESPAÇO some, as bolinhas renascem
    const END = 10.0;          // página de volta

    focusHero(vortex);
    const label = arcanaLabel('ESPAÇO', 3, false);
    const t0 = performance.now();

    function frame(now) {
      const t = (now - t0) / 1000;

      if (t < LABEL_OUT) {
        // sem potência extra: só o vórtice em repouso, centralizado, e o buraco
        vortex.center(smooth(0.3, CENTER_END, t));
        if (t > COLLAPSE) vortex.collapse(smooth(COLLAPSE, COLLAPSE_END, t));
      } else {
        // o vazio devolve: buraco fecha e o vórtice volta a se povoar
        vortex.collapse(0);
        vortex.center(1 - smooth(LABEL_OUT, END, t));
      }

      if (t > LABEL_IN && t < LABEL_OUT) label.classList.add('on');
      else label.classList.remove('on');

      if (t < END) requestAnimationFrame(frame);
      else {
        label.remove();
        releaseHero(vortex);
        fxRunning = false;
      }
    }
    requestAnimationFrame(frame);
  }
})();
