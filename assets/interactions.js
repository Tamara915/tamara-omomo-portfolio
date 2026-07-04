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
  // sessionStorage throws in some mobile contexts (Safari private tabs, in-app
  // browsers like Instagram/LinkedIn webviews) — never let that take the page down.
  const safeStorage = {
    get(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } },
    set(key, val) { try { sessionStorage.setItem(key, val); } catch (e) { /* ignore */ } },
  };
  // Every effect below runs as sequential top-level code in one wrapper function —
  // an uncaught error in any single one (a quirky mobile webview, an unsupported
  // API) must never be able to silently kill everything defined after it.
  function safeRun(name, fn) {
    try { fn(); } catch (e) { console.error('[interactions] ' + name + ' failed:', e); }
  }

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
    // screen readers get the intact sentence; the split chars below are decorative
    h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());

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
      line.setAttribute('aria-hidden', 'true');
      $$('.hchar', line).forEach(c => chars.push({ c, em: c.classList.contains('em') }));
    });

    // entrance: characters cascade up on load (runs on touch devices too)
    if (!reduced) {
      chars.forEach((o, i) => {
        o.c.style.opacity = '0';
        o.c.style.transform = 'translateY(16px)';
        setTimeout(() => {
          o.c.style.transition = 'opacity .5s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1)';
          o.c.style.opacity = '';
          o.c.style.transform = '';
        }, 180 + i * 16);
      });
      // clear inline transitions so the cursor-reactive frame() can take over cleanly
      setTimeout(() => chars.forEach(o => { o.c.style.transition = ''; }), 180 + chars.length * 16 + 750);
    }

    if (reduced) return;

    const CREAM = [240, 223, 203], EMBER = [248, 127, 35];
    const mix = (a, b, t) => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
    const RANGE = 200, PAD = 70;
    let pts = [];
    const reflow = () => { pts = chars.map(o => { const r = o.c.getBoundingClientRect(); return { o, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); };
    reflow();
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, { passive: true });

    // Recalculate after reveal animation settles (h1 starts with translateY(20px) before .in)
    setTimeout(reflow, 900);

    function rest(o) { o.c.style.transform = ''; o.c.style.color = ''; }
    function paint(sx, sy) {
      const inside = sx !== null;
      for (const p of pts) {
        let ease = 0;
        if (inside) {
          const dx = p.x - sx, dy = p.y - sy, d = Math.sqrt(dx * dx + dy * dy);
          const t = clamp(1 - d / RANGE, 0, 1);
          ease = t * t * (3 - 2 * t);
        }
        if (ease < 0.01) { rest(p.o); continue; }
        p.o.c.style.transform = `translateY(${(-ease * 9).toFixed(1)}px) scale(${(1 + ease * 0.07).toFixed(3)})`;
        p.o.c.style.color = p.o.em ? mix(EMBER, CREAM, ease) : mix(CREAM, EMBER, ease);
      }
    }

    if (finePointer) {
      // desktop: the swirl follows the real cursor
      let mx = -9999, my = -9999, raf = null;
      function frame() {
        const rect = h1.getBoundingClientRect();
        const inside = mx > rect.left - PAD && mx < rect.right + PAD && my > rect.top - PAD && my < rect.bottom + PAD;
        paint(inside ? mx : null, my);
        raf = null;
      }
      window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
      document.addEventListener('mouseleave', () => { mx = my = -9999; if (!raf) raf = requestAnimationFrame(frame); });
    } else {
      // touch devices: no cursor to react to, so auto-sweep the same lift+colour
      // effect across the headline on a loop, only while it's on screen.
      const SWEEP_MS = 2600, PAUSE_MS = 1500, CYCLE = SWEEP_MS + PAUSE_MS;
      let visible = false, raf = null, t0 = null;
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => { visible = e.isIntersecting; });
        if (visible && !raf) raf = requestAnimationFrame(tick);
        if (!visible) chars.forEach(o => rest(o));
      }, { threshold: 0.25 });
      io.observe(h1);
      function tick(now) {
        if (!visible) { raf = null; return; }
        if (t0 === null) t0 = now;
        const elapsed = (now - t0) % CYCLE;
        if (elapsed <= SWEEP_MS) {
          const rect = h1.getBoundingClientRect();
          const e = clamp(elapsed / SWEEP_MS, 0, 1);
          const ease = e * e * (3 - 2 * e);
          const sx = lerp(rect.left - PAD, rect.right + PAD, ease);
          paint(sx, rect.top + rect.height / 2);
        } else {
          paint(null, 0);
        }
        raf = requestAnimationFrame(tick);
      }
    }
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
    if (el.classList.contains('scramble') && !el.classList.contains('onload') && !reduced) scramble(el);
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
  safeRun('mobileNav', function mobileNav() {
    if (!nav) return;
    const btn = document.createElement('button');
    btn.className = 'mob-menu-btn';
    btn.setAttribute('aria-label', 'Open menu');
    btn.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(btn);

    const overlay = document.createElement('div');
    overlay.className = 'mob-menu';
    overlay.setAttribute('aria-hidden', 'true');

    const links = [
      { href: 'index.html', label: 'Home' },
      { href: 'builds.html', label: 'Case Studies' },
      { href: 'writing.html', label: 'Thoughts' },
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
  });

  /* -------------------------------------------------- marquee */
  safeRun('marquee', function marquee() {
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
  });

  /* -------------------------------------------------- vertical rail */
  safeRun('verticalRail', function verticalRail() {
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
  });

  /* -------------------------------------------------- GTM architecture flow pulse */
  safeRun('archFlow', function archFlow() {
    const arrows = $$('.arch-arrow');
    if (!arrows.length || reduced) return;
    let i = 0;
    setInterval(() => { arrows.forEach(a => a.classList.remove('flow')); arrows[i].classList.add('flow'); i = (i + 1) % arrows.length; }, 520);
  });

  /* -------------------------------------------------- logo marquee */
  safeRun('logoMarquee', function logoMarquee() {
    const track = $('#logoTrack');
    if (!track) return;
    if (!track.dataset.cloned) {
      track.innerHTML += track.innerHTML;
      track.dataset.cloned = '1';
      // the cloned half exists only for the seamless loop — hide it from screen readers
      Array.from(track.children).slice(track.children.length / 2).forEach(el => el.setAttribute('aria-hidden', 'true'));
    }
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
  });

  /* -------------------------------------------------- work rows: accent-rail colour + "View case" CTA */
  safeRun('workRows', function workRows() {
    $$('.work-row').forEach(row => {
      if (row.dataset.color) row.style.setProperty('--g', row.dataset.color);
      if (!$('.wview', row)) {
        const v = document.createElement('span');
        v.className = 'wview';
        v.innerHTML = 'View case <span class="wv-arr" aria-hidden="true">→</span>';
        ($('.wmeta', row) || row).appendChild(v);
      }
    });
  });

  /* -------------------------------------------------- workflow live runs
     Animates each .flow diagram like a running system: the signal travels
     node → arrow → node while the diagram is in view. */
  safeRun('flowRunner', function flowRunner() {
    const flows = $$('.flow');
    if (!flows.length || reduced) return;
    flows.forEach(flow => {
      const steps = $$('.fnode, .farr', flow);
      if (steps.length < 3) return;
      let i = -1, timer = null;
      const tick = () => {
        steps.forEach(s => s.classList.remove('run'));
        i = (i + 1) % (steps.length + 3); // 3-beat rest between runs
        if (i < steps.length) {
          steps[i].classList.add('run');
          // keep the previous node lit while its arrow fires
          if (steps[i].classList.contains('farr') && steps[i - 1]) steps[i - 1].classList.add('run');
        }
      };
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) { if (!timer) timer = setInterval(tick, 520); }
          else { clearInterval(timer); timer = null; i = -1; steps.forEach(s => s.classList.remove('run')); }
        });
      }, { threshold: 0.35 });
      io.observe(flow);
    });
  });

  /* -------------------------------------------------- scroll progress bar */
  safeRun('progressBar', function progressBar() {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    let raf = null;
    const upd = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.transform = `scaleX(${max > 0 ? (window.scrollY / max).toFixed(4) : 0})`;
      raf = null;
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    window.addEventListener('resize', upd);
    upd();
  });

  /* -------------------------------------------------- flip cards (builds grid)
     Desktop: hovering flips the card, clicking it opens the build.
     Touch: tap flips, tapping the View-build link navigates. */
  safeRun('flipCards', function flipCards() {
    const cards = $$('.bcard');
    let current = null; // only one card is ever flipped at a time

    const flip = (card, on) => {
      if (on === card.classList.contains('flipped')) return;
      // promote to its own layer only while animating, then release it
      card.classList.add('flipping');
      const inner = $('.bc-inner', card);
      if (inner) {
        const clear = () => { card.classList.remove('flipping'); inner.removeEventListener('transitionend', clear); };
        inner.addEventListener('transitionend', clear);
      }
      card.classList.toggle('flipped', on);
      card.setAttribute('aria-expanded', String(on));
    };
    const show = card => { if (current && current !== card) flip(current, false); flip(card, true); current = card; };
    const hideAll = () => { if (current) { flip(current, false); current = null; } };

    cards.forEach(card => {
      const hint = $('.bflip', card);
      if (finePointer && !reduced) {
        if (hint) hint.innerHTML = '<span class="ico">↻</span> Hover to flip · click to open';
        card.addEventListener('mouseenter', () => show(card));
        card.addEventListener('mouseleave', () => { flip(card, false); if (current === card) current = null; });
        card.addEventListener('click', e => {
          if (e.target.closest('a')) return;
          const link = $('.bview', card);
          if (link) window.location.href = link.getAttribute('href');
        });
      } else {
        if (hint) hint.innerHTML = '<span class="ico">↻</span> Tap for the story';
        card.addEventListener('click', e => {
          if (e.target.closest('a')) return; // let the View build link navigate
          card.classList.contains('flipped') ? hideAll() : show(card);
        });
      }
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.contains('flipped') ? hideAll() : show(card); }
      });
    });

    // touch devices have no hover, so a card's flip side is invisible until someone
    // taps it — demo the mechanic once by auto-peeking the first two cards as the
    // grid scrolls into view, then get out of the way of real taps.
    if (!finePointer && !reduced && cards.length) {
      let userActed = false;
      cards.forEach(card => card.addEventListener('click', () => { userActed = true; }, { once: true }));
      // watch the first card itself, not the whole (much taller) grid — a tall
      // grid's total area can never clear a percentage threshold on one screenful
      const firstCard = cards[0];
      if (firstCard) {
        const peekIO = new IntersectionObserver((entries, obs) => {
          entries.forEach(e => {
            if (!e.isIntersecting || userActed) return;
            obs.disconnect();
            const toPeek = cards.slice(0, 2);
            let i = 0;
            const step = () => {
              if (userActed || i >= toPeek.length) return;
              const card = toPeek[i];
              flip(card, true);
              setTimeout(() => { if (!userActed) flip(card, false); }, 900);
              i++;
              setTimeout(step, 1300);
            };
            setTimeout(step, 350);
          });
        }, { threshold: 0.4 });
        peekIO.observe(firstCard);
      }
    }
  });

  /* -------------------------------------------------- entry gate (home only)
     Shows the mark + a counter; when it reaches 100 an Enter button appears.
     The site's entrance animations wait for the click (gateWait). */
  let gateWait = Promise.resolve();
  (function entryGate() {
    let release = null;
    try {
      const pl = document.getElementById('preloader');
      if (!pl) return;
      // show the gate once per session
      if (safeStorage.get('entered')) { pl.remove(); return; }
      const finish = () => { pl.classList.add('done'); setTimeout(() => pl.remove(), 700); };
      if (reduced) { finish(); return; }
      gateWait = new Promise(res => { release = res; });
      // safety net: never let a broken gate permanently block the rest of the page
      const failSafe = setTimeout(() => { try { finish(); } catch (e) {} release(); }, 8000);
      const count = $('.pl-count', pl);
      const btn = $('.pl-enter', pl);
      const dur = 1400, t0 = performance.now();
      (function tick(now) {
        const t = clamp((now - t0) / dur, 0, 1);
        const e = 1 - Math.pow(1 - t, 2);
        if (count) count.textContent = Math.round(e * 100);
        if (t < 1) requestAnimationFrame(tick);
        else { pl.classList.add('ready'); if (btn) btn.focus({ preventScroll: true }); }
      })(performance.now());
      const enter = () => {
        if (!pl.classList.contains('ready')) return;
        clearTimeout(failSafe);
        safeStorage.set('entered', '1');
        finish(); release();
      };
      if (btn) btn.addEventListener('click', e => { e.stopPropagation(); enter(); });
      pl.addEventListener('click', enter); // the whole screen is clickable once ready
      pl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } });
    } catch (err) {
      // whatever went wrong, never let it block the rest of the page from loading
      const pl = document.getElementById('preloader');
      if (pl) pl.remove();
      if (typeof release === 'function') release();
    }
  })();

  /* -------------------------------------------------- hero cursor spotlight (desktop) */
  safeRun('heroSpotlight', function heroSpotlight() {
    const hero = $('.hero-statement');
    const spot = hero && $('.hero-spotlight', hero);
    if (!hero || !spot || !finePointer || reduced) return;
    let mx = 0, my = 0, raf = null;
    hero.addEventListener('pointerenter', () => hero.classList.add('spot-on'));
    hero.addEventListener('pointerleave', () => hero.classList.remove('spot-on'));
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(() => { spot.style.setProperty('--sx', mx + 'px'); spot.style.setProperty('--sy', my + 'px'); raf = null; });
    }, { passive: true });
  });

  /* -------------------------------------------------- live Berlin clock (footer) */
  safeRun('berlinClock', function berlinClock() {
    const footer = $('.footer');
    if (!footer) return;
    const chip = document.createElement('span');
    chip.className = 'footer-time';
    footer.appendChild(chip);
    const tick = () => {
      try {
        const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
        chip.innerHTML = '<span class="ft-dot"></span>Berlin · ' + t;
      } catch (e) { chip.textContent = ''; }
    };
    tick(); setInterval(tick, 1000);
  });

  /* -------------------------------------------------- magnetic buttons (desktop only) */
  if (finePointer && !reduced) safeRun('magneticButtons', function () {
    $$('.mag').forEach(m => {
      const strength = parseFloat(m.dataset.mag || 0.4);
      m.addEventListener('mousemove', e => {
        const r = m.getBoundingClientRect();
        m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
      });
      m.addEventListener('mouseleave', () => { m.style.transform = ''; });
    });
  });

  /* -------------------------------------------------- custom cursor (desktop only) */
  if (finePointer && !reduced) safeRun('customCursor', function () {
    document.body.classList.add('cursor-on');
    const cur = document.createElement('div');
    cur.className = 'cur dotmode';
    cur.innerHTML = '<span class="vlabel">View</span>';
    document.body.appendChild(cur);
    // Position via transform (compositor-only) so the cursor stays smooth even
    // while cards are running their 3D flip; left/top would thrash layout each frame.
    let cxRaw = -100, cyRaw = -100, curRaf = null;
    const paint = () => { cur.style.transform = `translate3d(${cxRaw}px, ${cyRaw}px, 0)`; curRaf = null; };
    window.addEventListener('mousemove', e => {
      cxRaw = e.clientX; cyRaw = e.clientY;
      if (!curRaf) curRaf = requestAnimationFrame(paint);
    }, { passive: true });
    const setMode = m => { cur.className = 'cur ' + m; };
    $$('a, button, .cta, .chip').forEach(el => { el.addEventListener('mouseenter', () => setMode('ring')); el.addEventListener('mouseleave', () => setMode('dotmode')); });
    $$('.work-row').forEach(el => { el.addEventListener('mouseenter', () => setMode('ring')); el.addEventListener('mouseleave', () => setMode('dotmode')); });
  });

  /* -------------------------------------------------- rotating words */
  safeRun('rotators', function rotators() {
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
  });

  /* -------------------------------------------------- boot */
  function boot() {
    safeRun('heroType', heroType);
    safeRun('statementHeadline', statementHeadline);
    $$('.scramble.onload').forEach(s => { s.dataset.text = s.textContent; });
    // Immediately reveal above-the-fold hero elements (mobile IntersectionObserver may miss them)
    $$('.hero-statement .r, .ab-hero .r').forEach(triggerReveal);
    checkReveal();
    requestAnimationFrame(checkReveal);
    setTimeout(checkReveal, 100);
    setTimeout(checkReveal, 400);
  }

  const fontsReady = (document.fonts && document.fonts.ready)
    ? document.fonts.ready
    : new Promise(res => window.addEventListener('load', res));
  Promise.all([fontsReady, gateWait]).then(() => safeRun('boot', boot)); // hold the entrance until the gate is clicked
  window.addEventListener('load', () => { setTimeout(checkReveal, 300); });

  /* -------------------------------------------------- first-party analytics beacon
     No cookies, no third party. Logs a pageview + a few key clicks to
     /.netlify/functions/track, which a private /admin dashboard reads back. */
  safeRun('analytics', function analytics() {
    if (/admin/i.test(location.pathname)) return; // don't track visits to the dashboard itself
    if (navigator.doNotTrack === '1') return;

    const send = (type, label) => {
      try {
        const payload = JSON.stringify({ type, path: location.pathname, label: label || '', ref: document.referrer });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/.netlify/functions/track', new Blob([payload], { type: 'application/json' }));
        } else {
          fetch('/.netlify/functions/track', { method: 'POST', body: payload, keepalive: true });
        }
      } catch (e) { /* analytics must never break the page */ }
    };

    send('pageview');

    document.addEventListener('click', (e) => {
      const el = e.target.closest('a, button');
      if (!el) return;
      let label = '';
      if (el.href && el.href.includes('calendly.com')) label = 'book-call';
      else if (el.href && el.href.startsWith('mailto:')) label = 'email-click';
      else if (el.closest('.socials')) label = 'social: ' + el.textContent.trim();
      else if (el.matches('.bview')) label = 'case-read: ' + (el.closest('.bcard')?.querySelector('.bt')?.textContent.trim() || '');
      else if (el.matches('.wview') || el.classList.contains('feat-link')) label = 'work-view';
      else if (el.matches('.cta')) label = 'cta: ' + el.textContent.trim();
      if (label) send('click', label.slice(0, 120));
    }, { passive: true });
  });
})();
