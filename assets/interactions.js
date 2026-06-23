/* ============================================================
   interactions.js — the kinetic / interactive type layer
   Vanilla JS. No deps. Respects prefers-reduced-motion.
   ============================================================ */
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  document.documentElement.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* -------------------------------------------------- logo image fallback (global — called from onerror) */
  window.logoFallback = function (img) {
    const tile = img.parentElement;
    if (!tile) return;
    const mark = document.createElement('span');
    mark.className = 'lmark' + (img.dataset.ink ? ' ink' : '');
    mark.style.setProperty('--c', img.dataset.c || '#888');
    mark.textContent = img.dataset.m || '?';
    tile.replaceChild(mark, img);
  };

  /* -------------------------------------------------- split text into chars */
  function splitChars(el) {
    if (el.dataset.split) return;
    el.dataset.split = '1';
    const text = el.textContent;
    el.textContent = '';
    const wrap = document.createElement('span');
    wrap.className = 'split';
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'char' + (ch === ' ' ? ' space' : '');
      s.textContent = ch === ' ' ? ' ' : ch;
      s.style.setProperty('--w', 400);
      wrap.appendChild(s);
    }
    el.appendChild(wrap);
    return $$('.char', wrap);
  }

  /* -------------------------------------------------- hero: variable-weight wave + magnetic (for #heroName variant) */
  function heroType() {
    const h1 = $('#heroName');
    if (!h1) return;
    const lines = $$('.line .fill', h1);
    let chars = [];
    lines.forEach(l => { chars = chars.concat(splitChars(l)); });
    h1.classList.add('live');

    const restChar = (c) => { c.style.opacity = ''; c.style.color = ''; c.style.webkitTextStrokeColor = ''; c.style.setProperty('--w', 400); };
    if (!reduced) {
      chars.forEach(c => { c.style.opacity = '0'; c.style.setProperty('--w', 320); });
      const t0 = performance.now(), per = 64, cdur = 540, total = per * chars.length + cdur + 700;
      (function entr(now) {
        const el = now - t0;
        chars.forEach((c, i) => {
          const local = el - i * per;
          const appear = clamp(local / cdur, 0, 1);
          const e = 1 - Math.pow(1 - appear, 3);
          c.style.opacity = String(e);
          const pulse = clamp(1 - Math.abs(local - cdur * 0.55) / (cdur * 0.95), 0, 1);
          c.style.color = `rgba(248,127,35,${pulse.toFixed(3)})`;
          c.style.webkitTextStrokeColor = `rgba(240,223,203,${(0.5 * (1 - pulse * 0.7)).toFixed(3)})`;
          c.style.setProperty('--w', Math.round(lerp(320, 400, e)));
        });
        if (el < total) requestAnimationFrame(entr);
        else chars.forEach(restChar);
      })(performance.now());
      setTimeout(() => chars.forEach(restChar), total + 300);
    }

    if (reduced || !finePointer) return;
    let mx = -9999, my = -9999, raf = null;
    const RANGE = 260;
    const positions = () => chars.map(c => { const r = c.getBoundingClientRect(); return { c, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    let pts = positions();
    window.addEventListener('resize', () => { pts = positions(); });
    window.addEventListener('scroll', () => { pts = positions(); }, { passive: true });
    function frame() {
      for (const p of pts) {
        const dx = p.x - mx, dy = p.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        const t = clamp(1 - d / RANGE, 0, 1);
        const ease = t * t * (3 - 2 * t);
        if (ease < 0.01) { p.c.style.setProperty('--w', 400); p.c.style.color = ''; p.c.style.webkitTextStrokeColor = ''; continue; }
        p.c.style.color = `rgba(248,127,35,${ease.toFixed(3)})`;
        p.c.style.webkitTextStrokeColor = `rgba(240,223,203,${(0.5 * (1 - ease)).toFixed(3)})`;
        p.c.style.setProperty('--w', Math.round(lerp(400, 680, ease)));
      }
      raf = null;
    }
    window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(frame); });
    document.addEventListener('mouseleave', () => { mx = my = -9999; if (!raf) raf = requestAnimationFrame(frame); });
  }

  /* -------------------------------------------------- statement headline: cursor-reactive per-char lift + colour swap */
  function statementHeadline() {
    const h1 = $('.hs-head');
    if (!h1 || h1.dataset.react) return;
    h1.dataset.react = '1';

    // split each line into per-char spans, preserving the .hs-em (ember) wrapper
    const mkChar = (ch, em) => {
      const s = document.createElement('span');
      s.className = 'hchar' + (em ? ' em' : '') + (ch === ' ' ? ' space' : '');
      s.textContent = ch === ' ' ? ' ' : ch;
      return s;
    };
    const chars = [];
    $$('.l', h1).forEach(line => {
      const frag = document.createDocumentFragment();
      Array.from(line.childNodes).forEach(node => {
        if (node.nodeType === 3) {
          for (const ch of node.textContent) frag.appendChild(mkChar(ch, false));
        } else {
          const em = document.createElement('span');
          em.className = node.className;
          for (const ch of node.textContent) em.appendChild(mkChar(ch, true));
          frag.appendChild(em);
        }
      });
      line.textContent = '';
      line.appendChild(frag);
      $$('.hchar', line).forEach(c => chars.push({ c, em: c.classList.contains('em') }));
    });

    if (reduced || !finePointer) return;

    const CREAM = [240, 223, 203], EMBER = [248, 127, 35];
    const mix = (a, b, t) => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
    const RANGE = 200, PAD = 70;
    let mx = -9999, my = -9999, raf = null, pts = [];
    const reflow = () => { pts = chars.map(o => { const r = o.c.getBoundingClientRect(); return { o, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); };
    reflow();
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, { passive: true });

    function rest(o) { o.c.style.transform = ''; o.c.style.color = ''; }
    function frame() {
      const rect = h1.getBoundingClientRect();
      const inside = mx > rect.left - PAD && mx < rect.right + PAD && my > rect.top - PAD && my < rect.bottom + PAD;
      for (const p of pts) {
        let ease = 0;
        if (inside) {
          const dx = p.x - mx, dy = p.y - my, d = Math.sqrt(dx * dx + dy * dy);
          const t = clamp(1 - d / RANGE, 0, 1);
          ease = t * t * (3 - 2 * t);
        }
        if (ease < 0.01) { rest(p.o); continue; }
        p.o.c.style.transform = `translateY(${(-ease * 9).toFixed(1)}px) scale(${(1 + ease * 0.07).toFixed(3)})`;
        p.o.c.style.color = p.o.em ? mix(EMBER, CREAM, ease) : mix(CREAM, EMBER, ease);
      }
      raf = null;
    }
    window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    document.addEventListener('mouseleave', () => { mx = my = -9999; if (!raf) raf = requestAnimationFrame(frame); });
  }

  /* -------------------------------------------------- scramble */
  const GLYPHS = '!<>-_\\/[]{}—=+*^?#________';
  function scramble(el, opts = {}) {
    const finalText = el.dataset.text || el.textContent;
    el.dataset.text = finalText;
    const dur = opts.dur || 700;
    const start = performance.now();
    el.classList.add('scrambling');
    const queue = finalText.split('').map(ch => ({
      ch, from: Math.floor(Math.random() * dur * 0.4), to: Math.floor(dur * 0.4 + Math.random() * dur * 0.6)
    }));
    function tick(now) {
      const elapsed = now - start;
      let out = '', done = 0;
      for (const q of queue) {
        if (elapsed >= q.to) { out += q.ch; done++; }
        else if (elapsed >= q.from) { out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]; }
        else { out += q.ch === ' ' ? ' ' : ''; }
      }
      el.textContent = out;
      if (done < queue.length) requestAnimationFrame(tick);
      else { el.textContent = finalText; el.classList.remove('scrambling'); }
    }
    requestAnimationFrame(tick);
  }

  /* -------------------------------------------------- gentle word swap */
  function softSwap(el, text) {
    if (reduced) { el.textContent = text; el.dataset.text = text; return; }
    const outDur = 190, inDur = 300, t0 = performance.now();
    (function out(now) {
      const t = clamp((now - t0) / outDur, 0, 1);
      el.style.opacity = String(1 - t);
      el.style.transform = `translateY(${(-7 * t).toFixed(1)}px)`;
      if (t < 1) requestAnimationFrame(out);
      else {
        el.textContent = text; el.dataset.text = text;
        const t1 = performance.now();
        (function inn(now2) {
          const u = clamp((now2 - t1) / inDur, 0, 1), e = 1 - Math.pow(1 - u, 3);
          el.style.opacity = String(e);
          el.style.transform = `translateY(${(8 * (1 - e)).toFixed(1)}px)`;
          if (u < 1) requestAnimationFrame(inn);
          else { el.style.opacity = ''; el.style.transform = ''; }
        })(performance.now());
      }
    })(performance.now());
  }

  /* -------------------------------------------------- count-up */
  function countUp(el) {
    if (reduced) { el.textContent = el.dataset.count; return; }
    const target = parseFloat(el.dataset.count);
    const dec = (el.dataset.count.split('.')[1] || '').length;
    const prefix = el.dataset.prefix || '', suffix = el.dataset.suffix || '';
    const dur = 1400, start = performance.now();
    function tick(now) {
      const t = clamp((now - start) / dur, 0, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const val = (target * ease).toFixed(dec);
      el.textContent = prefix + Number(val).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* -------------------------------------------------- scroll reveal
     CSS keyframe animation (reliable on mobile); JS adds .in class.
     Nuclear fallback: after 1.5s force-reveal anything still hidden.  */
  const revealEls = $$('.r, .scramble, [data-count], .quote');
  const done = new WeakSet();

  function triggerReveal(el) {
    if (done.has(el)) return;
    done.add(el);
    el.classList.add('in');
    $$('[data-count]', el).forEach(countUp);
    if (el.hasAttribute('data-count')) countUp(el);
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { triggerReveal(e.target); io.unobserve(e.target); } });
    }, { threshold: 0, rootMargin: '0px 0px 0px 0px' });
    revealEls.forEach(el => io.observe(el));
  }

  function checkReveal() {
    const limit = window.innerHeight * 0.98;
    for (const el of revealEls) {
      if (!done.has(el) && el.getBoundingClientRect().top < limit) triggerReveal(el);
    }
  }
  window.addEventListener('scroll', checkReveal, { passive: true });
  window.addEventListener('resize', checkReveal);

  // Nuclear fallback: force-reveal anything still hidden after 1.5s
  setTimeout(() => { revealEls.forEach(el => { if (!done.has(el)) triggerReveal(el); }); }, 1500);

  /* -------------------------------------------------- nav scrolled state */
  const nav = $('.nav');
  const onScrollNav = () => nav && nav.classList.toggle('scrolled', window.scrollY > 40);
  onScrollNav();
  window.addEventListener('scroll', onScrollNav, { passive: true });

  /* -------------------------------------------------- mobile nav */
  (function mobileNav() {
    if (!nav) return;
    const btn = document.createElement('button');
    btn.className = 'mob-menu-btn';
    btn.setAttribute('aria-label', 'Open menu');
    btn.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(btn);

    const overlay = document.createElement('div');
    overlay.className = 'mob-menu';
    overlay.setAttribute('aria-hidden', 'true');

    const isHome = !window.location.pathname.includes('about') && !window.location.pathname.includes('work');
    const links = [
      { href: isHome ? '#top' : 'index.html', label: 'Home' },
      { href: isHome ? '#work' : 'work.html', label: 'Work' },
      { href: 'about.html', label: 'About' },
      { href: '#contact', label: 'Contact' },
    ];

    overlay.innerHTML = `
      <div class="mob-menu-inner">
        <nav class="mob-links">
          ${links.map((l, i) => `<a href="${l.href}" class="mob-link" style="--i:${i}">${l.label}</a>`).join('')}
        </nav>
        <div class="mob-socials">
          <a href="https://www.linkedin.com/in/tamara-omomo/" target="_blank" rel="noopener">LinkedIn</a>
          <a href="https://substack.com/@tamaraomomo" target="_blank" rel="noopener">Substack</a>
          <a href="mailto:omomo.oj@gmail.com">Email</a>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    let open = false;
    function toggleMenu(force) {
      open = force !== undefined ? force : !open;
      btn.classList.toggle('open', open);
      overlay.classList.toggle('open', open);
      overlay.setAttribute('aria-hidden', String(!open));
      document.body.style.overflow = open ? 'hidden' : '';
    }
    btn.addEventListener('click', () => toggleMenu());
    overlay.querySelectorAll('a').forEach(a => { a.addEventListener('click', () => toggleMenu(false)); });
    overlay.addEventListener('click', e => { if (e.target === overlay) toggleMenu(false); });
  })();

  /* -------------------------------------------------- marquee */
  (function marquee() {
    const tracks = $$('.marquee .track');
    if (!tracks.length || reduced) return;
    const state = tracks.map(t => ({ t, off: 0, half: t.scrollWidth / 2 }));
    window.addEventListener('resize', () => state.forEach(s => s.half = s.t.scrollWidth / 2));
    let last = window.scrollY, vel = 0;
    function loop() {
      const cur = window.scrollY;
      vel = lerp(vel, cur - last, 0.2); last = cur;
      const sk = clamp(vel * 0.25, -8, 8);
      state.forEach(s => {
        if (!s.half) s.half = s.t.scrollWidth / 2;
        s.off -= 0.7;
        if (s.half && s.off <= -s.half) s.off += s.half;
        s.t.style.transform = `translateX(${s.off.toFixed(2)}px) skewX(${sk.toFixed(2)}deg)`;
      });
      requestAnimationFrame(loop);
    }
    loop();
  })();

  /* -------------------------------------------------- vertical rail */
  (function verticalRail() {
    const track = $('.hs-rail-track');
    if (!track || reduced) return;
    let off = 0, half = track.scrollHeight / 2;
    window.addEventListener('resize', () => { half = track.scrollHeight / 2; });
    function loop() {
      if (!half) half = track.scrollHeight / 2;
      off += 0.45;
      if (half && off >= half) off -= half;
      track.style.transform = `translateY(${(off - half).toFixed(2)}px)`;
      requestAnimationFrame(loop);
    }
    loop();
  })();

  /* -------------------------------------------------- GTM architecture flow pulse */
  (function archFlow() {
    const arrows = $$('.arch-arrow');
    if (!arrows.length || reduced) return;
    let i = 0;
    setInterval(() => { arrows.forEach(a => a.classList.remove('flow')); arrows[i].classList.add('flow'); i = (i + 1) % arrows.length; }, 520);
  })();

  /* -------------------------------------------------- logo marquee */
  (function logoMarquee() {
    const track = $('#logoTrack');
    if (!track) return;
    if (!track.dataset.cloned) { track.innerHTML += track.innerHTML; track.dataset.cloned = '1'; }
    if (reduced) return;
    let off = 0, half = 0, paused = false;
    function getHalf() { return track.scrollWidth / 2; }
    half = getHalf();
    window.addEventListener('resize', () => { half = getHalf(); });
    const wrap = track.parentElement;
    wrap.addEventListener('pointerenter', () => { paused = true; });
    wrap.addEventListener('pointerleave', () => { paused = false; });
    function loop() {
      if (!half) half = getHalf();
      if (!paused) { off -= 1.1; if (half && off <= -half) off += half; }
      track.style.transform = `translateX(${off.toFixed(2)}px)`;
      requestAnimationFrame(loop);
    }
    loop();
  })();

  /* -------------------------------------------------- work rows: accent-rail colour + "View case" CTA */
  (function workRows() {
    $$('.work-row').forEach(row => {
      if (row.dataset.color) row.style.setProperty('--g', row.dataset.color);
      if (!$('.wview', row)) {
        const v = document.createElement('span');
        v.className = 'wview';
        v.innerHTML = 'View case <span class="wv-arr" aria-hidden="true">→</span>';
        ($('.wmeta', row) || row).appendChild(v);
      }
    });
  })();

  /* -------------------------------------------------- magnetic buttons (desktop only) */
  if (finePointer && !reduced) {
    $$('.mag').forEach(m => {
      const strength = parseFloat(m.dataset.mag || 0.4);
      m.addEventListener('mousemove', e => {
        const r = m.getBoundingClientRect();
        m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
      });
      m.addEventListener('mouseleave', () => { m.style.transform = ''; });
    });
  }

  /* -------------------------------------------------- custom cursor (desktop only) */
  if (finePointer && !reduced) {
    document.body.classList.add('cursor-on');
    const cur = document.createElement('div');
    cur.className = 'cur dotmode';
    cur.innerHTML = '<span class="vlabel">View</span>';
    document.body.appendChild(cur);
    let cx = -100, cy = -100, tx = cx, ty = cy;
    window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    (function ring() { cx = lerp(cx, tx, 0.22); cy = lerp(cy, ty, 0.22); cur.style.left = cx + 'px'; cur.style.top = cy + 'px'; requestAnimationFrame(ring); })();
    const setMode = m => { cur.className = 'cur ' + m; };
    $$('a, button, .cta').forEach(el => { el.addEventListener('mouseenter', () => setMode('ring')); el.addEventListener('mouseleave', () => setMode('dotmode')); });
    $$('.work-row').forEach(el => { el.addEventListener('mouseenter', () => setMode('view')); el.addEventListener('mouseleave', () => setMode('dotmode')); });
  }

  /* -------------------------------------------------- rotating words */
  (function rotators() {
    $$('[data-words]').forEach(el => {
      const words = (el.dataset.words || '').split('|');
      if (!words.length) return;
      el.style.display = 'inline-block';
      el.textContent = words[0];
      el.dataset.text = words[0];
      if (reduced || words.length < 2) return;
      let i = 0;
      const interval = parseInt(el.dataset.interval || '2600', 10);
      setTimeout(() => setInterval(() => { i = (i + 1) % words.length; softSwap(el, words[i]); }, interval), parseInt(el.dataset.delay || '0', 10));
    });
  })();

  /* -------------------------------------------------- boot */
  function boot() {
    heroType();
    statementHeadline();
    $$('.scramble.onload').forEach(s => { s.dataset.text = s.textContent; });
    // Immediately reveal above-the-fold hero elements (mobile IntersectionObserver may miss them)
    $$('.hero-statement .r, .ab-hero .r').forEach(triggerReveal);
    checkReveal();
    requestAnimationFrame(checkReveal);
    setTimeout(checkReveal, 100);
    setTimeout(checkReveal, 400);
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  else window.addEventListener('load', boot);
  window.addEventListener('load', () => { setTimeout(checkReveal, 300); });
})();
