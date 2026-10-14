/* PITCHER · efeitos
   1. Energia cinética: letras perto do mouse tremem.
   2. "force" → a página some, o vórtice do hero toma a tela e ganha
                potência até FORÇAS ●●●. Depois volta ao normal.
   3. "space" → igual, mas no pico tudo é sugado para um ponto e
                some. Fica só ESPAÇO ●●●.
*/
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.querySelector('main');
  if (!root) return;

  /* ============================================================
     divide todo o texto de <main> em palavras e letras
     ============================================================ */
  const SKIP = new Set(['SCRIPT', 'STYLE', 'CANVAS']);

  function splitTextNode(node) {
    const text = node.nodeValue;
    if (!text.trim()) return;
    const frag = document.createDocumentFragment();
    text.split(/(\s+)/).forEach(tok => {
      if (!tok) return;
      if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(tok)); return; }
      const w = document.createElement('span');
      w.className = 'w';
      for (const c of tok) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        w.appendChild(s);
      }
      frag.appendChild(w);
    });
    node.parentNode.replaceChild(frag, node);
  }

  function collectTextNodes(el, out) {
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 3) out.push(n);
      else if (n.nodeType === 1 && !SKIP.has(n.tagName) && !n.classList.contains('dots')) collectTextNodes(n, out);
    }
  }

  root.querySelectorAll('.dropcap').forEach(p => {
    const first = p.firstChild;
    if (!first || first.nodeType !== 3) return;
    const cap = document.createElement('span');
    cap.className = 'cap ch';
    cap.textContent = first.nodeValue.charAt(0);
    first.nodeValue = first.nodeValue.slice(1);
    p.insertBefore(cap, first);
  });

  root.querySelectorAll('*').forEach(el => {
    const d = getComputedStyle(el).display;
    if (d !== 'flex' && d !== 'inline-flex' && d !== 'grid') return;
    Array.from(el.childNodes).forEach(n => {
      if (n.nodeType === 3 && n.nodeValue.trim()) {
        const wrap = document.createElement('span');
        wrap.className = 't';
        el.replaceChild(wrap, n);
        wrap.appendChild(n);
      }
    });
  });

  const nodes = [];
  collectTextNodes(root, nodes);
  nodes.forEach(splitTextNode);

  /* ============================================================
     utilidades
     ============================================================ */
  function shake(ch, k, c) {
    ch.style.setProperty('--k', k.toFixed(2));
    ch.style.setProperty('--c', c.toFixed(1));
    ch.classList.add('kin');
  }
  function calm(ch) {
    ch.classList.remove('kin');
    ch.style.removeProperty('--k');
    ch.style.removeProperty('--c');
  }

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
     1. tremor cinético perto do mouse
     ============================================================ */
  const RADIUS = 150;
  let hot = new Set();
  let pending = null;
  let fxRunning = false;

  function kinetic(x, y) {
    const el = document.elementFromPoint(x, y);
    const next = new Set();
    if (el) {
      const block = el.closest('p, h1, h2, h3, li, dt, dd, .t');
      const blocks = block ? [block.previousElementSibling, block, block.nextElementSibling].filter(Boolean) : [];
      for (const b of blocks) {
        for (const ch of b.querySelectorAll('.ch')) {
          const r = ch.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
          if (d < RADIUS) {
            const e = Math.pow(1 - d / RADIUS, 1.6);
            shake(ch, 0.4 + e * 2.8, e * 60);
            next.add(ch);
          }
        }
      }
    }
    for (const ch of hot) if (!next.has(ch)) calm(ch);
    hot = next;
  }

  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('mousemove', e => {
      if (pending || fxRunning) return;
      pending = requestAnimationFrame(() => { pending = null; kinetic(e.clientX, e.clientY); });
    });
    document.addEventListener('mouseleave', () => kinetic(-9999, -9999));
  }

  function clearHot() { for (const ch of hot) calm(ch); hot = new Set(); }

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
    clearHot();

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
     3. "space" → o vórtice ganha potência e é sugado para um ponto
        → fica só ESPAÇO ●●●
     ============================================================ */
  function spaceEffect() {
    if (fxRunning || !window.pitcherVortex) return;
    fxRunning = true;
    clearHot();

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
