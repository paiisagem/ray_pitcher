/* PITCHER · efeitos
   1. Giroscópio no cursor: uma bola de beisebol em Three.js no lugar
      do mouse, três anéis de partículas ao redor e raios ciano de vez
      em quando. Acelera quando o mouse se move rápido.
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
        - anéis de partículas em canvas 2D, bem transparentes
        - raios ciano ocasionais entre partículas de um anel
        - bola de beisebol em Three.js no centro (cai para 2D sem WebGL)
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
        dots.push({ ring: ri, th: i / rg.n * Math.PI * 2 + Math.random() * 0.2, warm: Math.random() < rg.warm, s: 1.2 + Math.random() * 1.2, x: 0, y: 0 });
      }
    });

    let mx = -999, my = -999;      // mouse (onde a bola fica)
    let px = -999, py = -999;      // centro dos anéis (segue com atraso)
    let inside = false;
    let lastMove = 0;
    let spin = 0, boost = 0, vis = 0;
    let last = performance.now();

    document.documentElement.classList.add('has-ball');   // esconde o cursor nativo

    document.addEventListener('mousemove', e => {
      if (!inside) { px = e.clientX; py = e.clientY; }
      mx = e.clientX; my = e.clientY;
      inside = true;
      lastMove = performance.now();
    });
    document.addEventListener('mouseleave', () => { inside = false; });

    /* ---------- raios ciano nos anéis ---------- */
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
      // intervalo aleatório; mais frequente com o mouse em movimento
      nextSpark = now + 500 + Math.random() * 1400 / (1 + boost);
      const a = dots[Math.floor(Math.random() * dots.length)];
      const same = dots.filter(d => d.ring === a.ring && d !== a);
      let b = null, best = 1e9;
      // vizinha a uns 15 a 40px, no mesmo anel
      for (let i = 0; i < 6; i++) {
        const c = same[Math.floor(Math.random() * same.length)];
        const dist = Math.hypot(c.x - a.x, c.y - a.y);
        if (dist > 14 && dist < 42 && dist < best) { b = c; best = dist; }
      }
      if (!b) return;
      sparks.push({ a, b, pts: null, life: 4, max: 4 });
    }

    function drawSparks() {
      if (!sparks.length) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        // o raio acompanha as duas partículas enquanto vive, e reforma a cada quadro
        s.pts = midpointBolt(s.a.x, s.a.y, s.b.x, s.b.y, 3, 0.3);
        const al = (s.life / s.max) * (0.6 + Math.random() * 0.4) * vis;
        ctx.beginPath();
        ctx.moveTo(s.pts[0].x, s.pts[0].y);
        for (let j = 1; j < s.pts.length; j++) ctx.lineTo(s.pts[j].x, s.pts[j].y);
        ctx.shadowColor = 'rgba(80,230,255,1)';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(80,230,255,' + (0.35 * al) + ')';
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(225,250,255,' + al + ')';
        ctx.stroke();
        if (--s.life <= 0) sparks.splice(i, 1);
      }
      ctx.restore();
    }

    /* ---------- a bola de beisebol ---------- */
    const BALL_PX = 13;            // diâmetro na tela
    const ballEl = document.createElement('canvas');
    ballEl.id = 'cursor-ball';
    document.body.appendChild(ballEl);
    let ball3d = null;

    if (window.THREE && window.WebGLRenderingContext) {
      try { ball3d = makeBall3D(ballEl, BALL_PX); } catch (e) { ball3d = null; }
    }
    if (!ball3d) ball3d = makeBall2D(ballEl, BALL_PX);

    function makeBall3D(canvas, px) {
      const T = window.THREE;
      const size = px * 1.6;     // margem para a bola não cortar nas bordas
      const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(size, size, false);
      canvas.style.width = canvas.style.height = size + 'px';
      canvas.style.marginLeft = canvas.style.marginTop = (-size / 2) + 'px';

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(30, 1, 0.1, 20);
      camera.position.set(0, 0, 4.6);
      scene.add(new T.AmbientLight(0xfff2dc, 0.55));
      const key = new T.DirectionalLight(0xfff0d0, 0.95);
      key.position.set(-2, 3, 4);
      scene.add(key);
      const rim = new T.DirectionalLight(0xffb648, 0.35);
      rim.position.set(3, -2, -2);
      scene.add(rim);

      const ball = new T.Group();
      scene.add(ball);

      // couro
      const leather = new T.Mesh(
        new T.SphereGeometry(1, 48, 32),
        new T.MeshStandardMaterial({ color: 0xf1ebdd, roughness: 0.85, metalness: 0 })
      );
      ball.add(leather);

      // costura: curva clássica de bola de beisebol sobre a esfera
      const seamPts = [];
      const A = 0.4, N = 240;
      for (let i = 0; i <= N; i++) {
        const t = i / N * Math.PI * 4;
        const lat = Math.PI / 2 - (Math.PI / 2 - A) * Math.cos(t);
        const lon = t / 2 + A * Math.sin(2 * t);
        seamPts.push(new T.Vector3(Math.sin(lat) * Math.cos(lon), Math.sin(lat) * Math.sin(lon), Math.cos(lat)).multiplyScalar(1.005));
      }
      const seamCurve = new T.CatmullRomCurve3(seamPts, true);
      const seam = new T.Mesh(
        new T.TubeGeometry(seamCurve, 400, 0.028, 6, true),
        new T.MeshStandardMaterial({ color: 0xc8322b, roughness: 0.7 })
      );
      ball.add(seam);

      // pontos de linha cruzando a costura
      const stitchGeo = new T.BufferGeometry();
      const sv = [];
      const S = 108;
      for (let i = 0; i < S; i++) {
        const u = i / S;
        const p = seamCurve.getPointAt(u);
        const tan = seamCurve.getTangentAt(u).normalize();
        const nrm = p.clone().normalize();
        const bin = new T.Vector3().crossVectors(tan, nrm).normalize();
        const a = p.clone().add(bin.clone().multiplyScalar(0.085)).add(tan.clone().multiplyScalar(-0.03)).multiplyScalar(1.012);
        const b = p.clone().add(bin.clone().multiplyScalar(-0.085)).add(tan.clone().multiplyScalar(0.03)).multiplyScalar(1.012);
        sv.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      stitchGeo.setAttribute('position', new T.Float32BufferAttribute(sv, 3));
      ball.add(new T.LineSegments(stitchGeo, new T.LineBasicMaterial({ color: 0xb02a24 })));

      ball.rotation.set(0.5, 0.3, 0);
      const axis = new T.Vector3();

      return {
        // rola na direção do movimento do mouse, e gira devagar parada
        update(dx, dy, dt) {
          const dist = Math.hypot(dx, dy);
          if (dist > 0.01) {
            axis.set(-dy, dx, 0).normalize();
            ball.rotateOnWorldAxis(axis, dist / (px / 2) * 0.35);
          }
          ball.rotateOnWorldAxis(axis.set(0.3, 1, 0.2).normalize(), dt * 0.6);
          renderer.render(scene, camera);
        },
        el: canvas
      };
    }

    function makeBall2D(canvas, px) {
      const size = px * 1.6;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.height = Math.floor(size * dpr);
      canvas.style.width = canvas.style.height = size + 'px';
      canvas.style.marginLeft = canvas.style.marginTop = (-size / 2) + 'px';
      const c = canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      let rot = 0;
      const R = px / 2;
      return {
        update(dx, dy, dt) {
          rot += dt * 0.8 + Math.hypot(dx, dy) * 0.02;
          c.clearRect(0, 0, size, size);
          c.save();
          c.translate(size / 2, size / 2);
          c.rotate(rot);
          const g = c.createRadialGradient(-2, -2, 1, 0, 0, R);
          g.addColorStop(0, '#fbf8f0');
          g.addColorStop(1, '#cfc8b8');
          c.fillStyle = g;
          c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
          c.strokeStyle = '#c8322b';
          c.lineWidth = 1.2;
          const sr = R * 1.45, off = R * 1.55, span = 0.62;
          c.beginPath(); c.arc(-off, 0, sr, -span, span); c.stroke();
          c.beginPath(); c.arc(off, 0, sr, Math.PI - span, Math.PI + span); c.stroke();
          c.restore();
        },
        el: canvas
      };
    }

    let lastBx = -999, lastBy = -999;

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;

      // os anéis ficam cravados na bola; a velocidade do mouse vira impulso de rotação
      const dx = mx - px, dy = my - py;
      px = mx; py = my;
      const v = Math.hypot(dx, dy);
      boost += (Math.min(4, v / 18) - boost) * 0.1;
      spin += dt * (1 + boost);

      // visível com o mouse na página, mais apagado parado, some nos efeitos
      const idle = now - lastMove > 1800;
      const target = (!inside || fxRunning) ? 0 : (idle ? 0.5 : 1);
      vis += (target - vis) * 0.08;

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
          d.x = px + lx * Math.cos(phi) - ly * Math.sin(phi);
          d.y = py + lx * Math.sin(phi) + ly * Math.cos(phi);
          const depth = 0.5 + 0.5 * (Math.sin(a) + 1) / 2;
          // opacidade bem baixa: os anéis não podem brigar com o texto
          const al = vis * depth * (d.warm ? 0.26 : 0.16);
          ctx.fillStyle = d.warm ? 'rgba(255,182,72,' + al + ')' : 'rgba(239,232,216,' + al + ')';
          ctx.fillRect(d.x - d.s / 2, d.y - d.s / 2, d.s, d.s);
        }
        if (now > nextSpark && !idle) spawnSpark(now);
        drawSparks();
      }

      // a bola fica exatamente no mouse
      const showBall = inside && !fxRunning;
      ball3d.el.style.opacity = showBall ? '1' : '0';
      if (showBall) {
        ball3d.el.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        const bdx = lastBx > -900 ? mx - lastBx : 0;
        const bdy = lastBy > -900 ? my - lastBy : 0;
        ball3d.update(bdx, bdy, dt);
        lastBx = mx; lastBy = my;
      } else {
        lastBx = lastBy = -999;
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
