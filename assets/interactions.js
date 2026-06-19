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
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.style.setProperty('--w', 400);
      wrap.appendChild(s);
    }
    el.appendChild(wrap);
    return $$('.char', wrap);
  }

  /* -------------------------------------------------- hero: variable-weight wave + magnetic */
  function heroType() {
    const h1 = $('#heroName');
    if (!h1) return;
    const lines = $$('.line .fill', h1);
    let chars = [];
    lines.forEach(l => { chars = chars.concat(splitChars(l)); });
    h1.classList.add('live');

    // entrance: rAF-driven (this environment freezes the CSS clock). Letters fade
    // in while a bright ember fill-sweep travels across them, then settle to their
    // hollow outline rest state. Inline styles are cleared at the end so the giant
    // name stays capture-clean (no inline transform).
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
          // travelling highlight: fills bright as the letter lands, then drains to outline
          const pulse = clamp(1 - Math.abs(local - cdur * 0.55) / (cdur * 0.95), 0, 1);
          c.style.color = `rgba(248,127,35,${pulse.toFixed(3)})`;
          c.style.webkitTextStrokeColor = `rgba(240,223,203,${(0.5 * (1 - pulse * 0.7)).toFixed(3)})`;
          c.style.setProperty('--w', Math.round(lerp(320, 400, e)));
        });
        if (el < total) requestAnimationFrame(entr);
        else chars.forEach(restChar);
      })(performance.now());
      // safety net in case rAF is interrupted
      setTimeout(() => chars.forEach(restChar), total + 300);
    }

    if (reduced || !finePointer) return;
    let mx = -9999, my = -9999, raf = null;
    const RANGE = 260;          // px radius of influence
    const positions = () => chars.map(c => { const r = c.getBoundingClientRect(); return { c, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    let pts = positions();
    const reflow = () => { pts = positions(); };
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, { passive: true });

    function frame() {
      for (const p of pts) {
        const dx = p.x - mx, dy = p.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        const t = clamp(1 - d / RANGE, 0, 1);          // 1 near cursor → 0 far
        const ease = t * t * (3 - 2 * t);
        if (ease < 0.01) {                              // rest = hollow outline (capture-clean)
          p.c.style.setProperty('--w', 400); p.c.style.color = ''; p.c.style.webkitTextStrokeColor = '';
          continue;
        }
        // fill the outline with solid ember + bloom the weight as the cursor nears
        p.c.style.color = `rgba(248,127,35,${ease.toFixed(3)})`;
        p.c.style.webkitTextStrokeColor = `rgba(240,223,203,${(0.5 * (1 - ease)).toFixed(3)})`;
        p.c.style.setProperty('--w', Math.round(lerp(400, 680, ease)));
      }
      raf = null;
    }
    window.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(frame);
    });
    document.addEventListener('mouseleave', () => { mx = my = -9999; if (!raf) raf = requestAnimationFrame(frame); });
  }

  /* -------------------------------------------------- scramble / decode text */
  const GLYPHS = '!<>-_\\/[]{}—=+*^?#________';
  function scramble(el, opts = {}) {
    const finalText = el.dataset.text || el.textContent;
    el.dataset.text = finalText;
    const dur = opts.dur || 700;
    const start = performance.now();
    el.classList.add('scrambling');
    const queue = finalText.split('').map((ch, i) => ({
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
  /* -------------------------------------------------- gentle word swap (calm fade+slide; replaces the glitchy scramble) */
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
    const dur = 1400; const start = performance.now();
    function tick(now) {
      const t = clamp((now - start) / dur, 0, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const val = (target * ease).toFixed(dec);
      el.textContent = prefix + Number(val).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* -------------------------------------------------- scroll reveal + triggers */
  // Scroll-driven (more reliable than IO under programmatic scroll + exports):
  // reveals any element whose top crosses 88% of the viewport, once.
  const revealEls = $$('.r, .scramble, [data-count], .quote');
  const done = new WeakSet();
  function triggerReveal(el) {
    if (done.has(el)) return;
    done.add(el);
    el.classList.add('in');
    if (!reduced) {
      const t0 = performance.now(), dur = 850;
      (function step(now) {
        const tt = clamp((now - t0) / dur, 0, 1);
        const e = 1 - Math.pow(1 - tt, 3);
        el.style.opacity = String(e);
        el.style.transform = 'translateY(' + ((1 - e) * 24).toFixed(1) + 'px)';
        if (tt < 1) requestAnimationFrame(step);
        else { el.style.opacity = ''; el.style.transform = ''; }   // rest = capture-clean
      })(performance.now());
      // safety: guarantee the final visible/clean state even if rAF is interrupted
      setTimeout(() => { el.style.opacity = ''; el.style.transform = ''; }, dur + 300);
    }
    $$('[data-count]', el).forEach(countUp);
    if (el.hasAttribute('data-count')) countUp(el);
  }
  function checkReveal() {
    const trigger = window.innerHeight * 0.88;
    for (const el of revealEls) {
      if (done.has(el)) continue;
      if (el.getBoundingClientRect().top < trigger) triggerReveal(el);
    }
  }
  window.addEventListener('scroll', checkReveal, { passive: true });
  window.addEventListener('resize', checkReveal);

  /* -------------------------------------------------- nav scrolled state */
  const nav = $('.nav');
  const onScrollNav = () => nav && nav.classList.toggle('scrolled', window.scrollY > 40);
  onScrollNav(); window.addEventListener('scroll', onScrollNav, { passive: true });

  /* -------------------------------------------------- marquee (rAF: translateX + velocity skew) */
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

  /* -------------------------------------------------- vertical rail (rAF: scrolls the side name-strip downward) */
  (function verticalRail() {
    const track = $('.hs-rail-track');
    if (!track || reduced) return;
    let off = 0, half = track.scrollHeight / 2;
    window.addEventListener('resize', () => half = track.scrollHeight / 2);
    function loop() {
      if (!half) half = track.scrollHeight / 2;
      off += 0.45;                       // moves downward
      if (half && off >= half) off -= half;
      track.style.transform = `translateY(${(off - half).toFixed(2)}px)`;
      requestAnimationFrame(loop);
    }
    loop();
  })();

  /* -------------------------------------------------- GTM architecture flow pulse (timer-driven; reliable) */
  (function archFlow() {
    const arrows = $$('.arch-arrow');
    if (!arrows.length || reduced) return;
    let i = 0;
    setInterval(() => {
      arrows.forEach(a => a.classList.remove('flow'));
      arrows[i].classList.add('flow');
      i = (i + 1) % arrows.length;
    }, 520);
  })();

  /* -------------------------------------------------- full-stack logo marquee (rAF translateX, clones for seamless loop) */
  (function logoMarquee() {
    const track = $('#logoTrack');
    if (!track) return;
    track.innerHTML += track.innerHTML;   // duplicate set for a seamless wrap
    if (reduced) return;
    let off = 0, half = track.scrollWidth / 2, paused = false;
    window.addEventListener('resize', () => half = track.scrollWidth / 2);
    const wrap = track.parentElement;
    wrap.addEventListener('mouseenter', () => paused = true);
    wrap.addEventListener('mouseleave', () => paused = false);
    function loop() {
      if (!half) half = track.scrollWidth / 2;
      if (!paused) { off -= 1.1; if (half && off <= -half) off += half; }
      track.style.transform = `translateX(${off.toFixed(2)}px)`;
      requestAnimationFrame(loop);
    }
    loop();
  })();

  /* -------------------------------------------------- magnetic buttons */
  if (finePointer && !reduced) {
    $$('.mag').forEach(m => {
      const strength = parseFloat(m.dataset.mag || 0.4);
      m.addEventListener('mousemove', e => {
        const r = m.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        m.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      m.addEventListener('mouseleave', () => { m.style.transform = ''; });
    });
  }

  /* -------------------------------------------------- custom cursor */
  if (finePointer && !reduced) {
    document.body.classList.add('cursor-on');
    const cur = document.createElement('div');
    cur.className = 'cur dotmode';
    cur.innerHTML = '<span class="vlabel">View</span>';
    document.body.appendChild(cur);
    let cx = -100, cy = -100, tx = cx, ty = cy;
    window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    (function ring() {
      cx = lerp(cx, tx, 0.22); cy = lerp(cy, ty, 0.22);
      cur.style.left = cx + 'px'; cur.style.top = cy + 'px';
      requestAnimationFrame(ring);
    })();
    const setMode = (m) => { cur.className = 'cur ' + m; };
    $$('a, button, .cta, .chip').forEach(el => {
      el.addEventListener('mouseenter', () => setMode('ring'));
      el.addEventListener('mouseleave', () => setMode('dotmode'));
    });
    $$('.work-row').forEach(el => {
      el.addEventListener('mouseenter', () => setMode('view'));
      el.addEventListener('mouseleave', () => setMode('dotmode'));
    });
  }

  /* -------------------------------------------------- work row cursor-follow preview */
  (function workPeek() {
    const peek = $('#workPeek');
    if (!peek) return;
    const rows = $$('.work-row');
    let tx = 0, ty = 0, x = 0, y = 0, active = false;
    rows.forEach(row => {
      row.addEventListener('mouseenter', () => {
        active = true;
        const ph = peek.querySelector('.ph');
        ph.style.background = row.dataset.color || '#cc3711';
        ph.textContent = row.dataset.peek || 'Case study';
        peek.classList.add('show');
      });
      row.addEventListener('mouseleave', () => { active = false; peek.classList.remove('show'); });
    });
    window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    (function loop() {
      x = lerp(x, tx, 0.14); y = lerp(y, ty, 0.14);
      if (active) { peek.style.left = x + 'px'; peek.style.top = y + 'px'; }
      requestAnimationFrame(loop);
    })();
  })();

  /* -------------------------------------------------- rotating / scrambling words */
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
      const startDelay = parseInt(el.dataset.delay || '0', 10);
      setTimeout(() => setInterval(() => {
        i = (i + 1) % words.length;
        softSwap(el, words[i]);
      }, interval), startDelay);
    });
  })();

  /* -------------------------------------------------- kick off */
  function boot() {
    heroType();
    // decode the hero meta labels + nav on load
    $$('.scramble.onload').forEach((s) => { s.dataset.text = s.textContent; });
    checkReveal();
    requestAnimationFrame(checkReveal);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  else window.addEventListener('load', boot);
})();
