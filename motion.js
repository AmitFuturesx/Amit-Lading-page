/*! Amitzur Digital — premium motion library (motion.js)
 *
 * Needs GSAP 3 + ScrollTrigger loaded first. Lenis is optional (smooth scroll).
 * Every module is opt-in through a data attribute, so a page only pays for what it uses.
 * The page must be fully readable with JS off: modules only ANIMATE content that is already in the HTML.
 *
 * Modules (attribute on the section root → what it does):
 *   [data-hero]            intro choreography: preloader → media mask reveal → title word-rise → steps in order → markers
 *   [data-split]           heading rises word by word when it enters the viewport
 *   [data-reveal]          fade + rise once ("stagger" value = animate direct children one after another)
 *   [data-scrub-words]     paragraph colours in word by word while scrolling (scrub)
 *   .mark                  highlighter marker that draws itself behind a word
 *   [data-count]           number counts up from 0 (the HTML keeps the final number for SEO / no-JS)
 *   [data-parallax="0.08"] gentle scroll parallax on media
 *   [data-mask]            circle | rect clip-path reveal on enter
 *   [data-arc-loop]        infinite scroll-snap carousel bent on an arc (cap shape)
 *   [data-arc-tabs]        tabs sitting on a dome; the active one rotates to the top, panel cross-fades
 *   [data-hscroll]         desktop: pinned section, vertical scroll moves a row sideways · mobile: native swipe
 *   [data-wheel]           cards on the rim of a huge wheel; drag / fling / dots rotate it
 *   [data-dome]            endless grid of work wrapped on a sphere; drag / glide to roam, click a card to open it
 *   [data-sticky-bounce]   sticky card stack; each card straightens on a spring and squashes when it lands
 *   [data-fan]             cards fanned like playing cards; hover / tap / arrow keys lift one
 *   [data-blur-stack]      sticky stack; each card blurs, shrinks and fades as the next one covers it
 *   [data-process-wheel]   desktop: pinned, a circle draws itself and steps swap at each dot · mobile: plain list
 *   [data-auto-process]    tabs with a filling progress bar that advance by themselves (starts in view)
 *   [data-line-draw]       SVG line draws between steps; each step lights up (grayscale → colour) when reached
 *   [data-spread]          a tilted pile of cards spreads into a row while scrolling (desktop)
 *   [data-bg]              page background eases to this colour while the section is in view
 *   [data-marquee]         single CSS marquee, content duplicated for a seamless loop (max ONE per page)
 *   [data-vcard]           vertical testimonial video card with play / mute
 *   [data-buybar]          sticky buy bar / floating price button that appears after [data-buybar-after]
 *   .site-header           gets .is-scrolled after the first scroll
 */
(function () {
  'use strict';

  var gsap = window.gsap, ST = window.ScrollTrigger;
  var html = document.documentElement;
  if (!gsap || !ST) { html.classList.remove('js'); return; }
  gsap.registerPlugin(ST);

  /* ── helpers ─────────────────────────────────────────── */
  var RTL = (html.getAttribute('dir') || getComputedStyle(html).direction) === 'rtl';
  var DIR = RTL ? -1 : 1;                       // physical sign of "forward" on the x axis
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DESKTOP = '(min-width: 1025px)';
  var MOBILE = '(max-width: 1024px)';
  var EASE = 'power4.out';                      // ≈ cubic-bezier(.22,1,.36,1)
  var mm = gsap.matchMedia();

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function clamp(x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.max(a, Math.min(b, x)); }
  function cssNum(el, prop, def) { var v = parseFloat(getComputedStyle(el).getPropertyValue(prop)); return isFinite(v) ? v : def; }
  function dataNum(el, key, def) { var v = parseFloat(el.dataset[key]); return isFinite(v) ? v : def; }
  function inView(el, cb, opts) {
    var io = new IntersectionObserver(function (entries) { entries.forEach(function (e) { cb(e.isIntersecting, e); }); }, opts || { threshold: 0 });
    io.observe(el); return io;
  }

  /* Split an element into word spans (.w > .wi). Children with class "line" are split recursively,
     any other child element (e.g. .mark, strong) is kept whole as one word. Hebrew is never split into letters. */
  function splitWords(el) {
    if (el.__words) return el.__words;
    var words = [];
    function walk(node, out) {
      var frag = document.createDocumentFragment();
      var kids = Array.prototype.slice.call(node.childNodes);
      while (node.firstChild) node.removeChild(node.firstChild);
      kids.forEach(function (child) {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span'); w.className = 'w';
            var i = document.createElement('span'); i.className = 'wi'; i.textContent = part;
            w.appendChild(i); frag.appendChild(w); out.push(i);
          });
        } else if (child.nodeType === 1 && child.classList.contains('line')) {
          walk(child, out); frag.appendChild(child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          var w2 = document.createElement('span'); w2.className = 'w';
          var i2 = document.createElement('span'); i2.className = 'wi';
          i2.appendChild(child); w2.appendChild(i2); frag.appendChild(w2); out.push(i2);
        } else { frag.appendChild(child); }
      });
      node.appendChild(frag);
    }
    walk(el, words);
    el.__words = words;
    return words;
  }

  /* ── smooth scroll (Lenis) ───────────────────────────── */
  function initSmoothScroll() {
    if (reduce || !window.Lenis) return;
    var lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
    // anchor links go through Lenis so they glide too
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href'); if (id.length < 2) return;
        var target = $(id); if (!target) return;
        e.preventDefault(); lenis.scrollTo(target, { offset: -90 });
      });
    });
  }

  /* ── header ──────────────────────────────────────────── */
  function initHeader() {
    var h = $('.site-header'); if (!h) return;
    var on = false;
    function check() { var s = window.scrollY > 20; if (s !== on) { on = s; h.classList.toggle('is-scrolled', s); } }
    window.addEventListener('scroll', check, { passive: true }); check();
    var toggle = $('[data-menu-toggle]', h);
    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = h.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (window.__lenis) open ? window.__lenis.stop() : window.__lenis.start();
      });
      $$('.site-header__nav a', h).forEach(function (a) { a.addEventListener('click', function () {
        h.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); if (window.__lenis) window.__lenis.start();
      }); });
    }
  }

  /* ── intro: preloader + hero choreography ────────────── */
  function initIntro() {
    var pre = $('.preloader');
    var hero = $('[data-hero]');
    var tl = gsap.timeline({ defaults: { ease: EASE } });
    var seen = false;
    try { seen = sessionStorage.getItem('intro-seen') === '1'; } catch (e) {}

    if (pre && !seen && !reduce) {
      var mark = $('.preloader__mark', pre) || pre;
      tl.fromTo(mark, { autoAlpha: 0, y: 14, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.55 })
        .to(mark, { autoAlpha: 0, y: -14, duration: 0.35 }, '+=0.3')
        .to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 0.7, ease: 'power3.inOut' }, '-=0.1')
        .set(pre, { display: 'none' });
      try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}
    } else if (pre) { pre.style.display = 'none'; }

    if (!hero) return;
    var media = $('[data-hero-media]', hero);
    var title = $('[data-hero-title]', hero);
    var steps = $$('[data-hero-step]', hero).sort(function (a, b) { return (+a.dataset.heroStep || 0) - (+b.dataset.heroStep || 0); });
    var marks = $$('.mark', hero);

    if (reduce) { gsap.set([title].concat(steps).filter(Boolean), { autoAlpha: 1 }); marks.forEach(function (m) { m.classList.add('is-in'); }); return; }

    // data-hero-order="text-first": the words come in first and the photo follows; data-hero-speed="1.6" speeds the whole intro up
    var textFirst = hero.dataset.heroOrder === 'text-first', speed = dataNum(hero, 'heroSpeed', 1);
    tl.addLabel('heroStart', pre && !seen ? '-=0.45' : 0);
    function addMedia(at) {
      var shape = media.dataset.heroMedia || 'circle';
      var from = shape === 'rect' ? 'inset(18% 18% 18% 18% round 40px)' : 'circle(0% at 50% 50%)';
      var to = shape === 'rect' ? 'inset(0% 0% 0% 0% round 0px)' : 'circle(75% at 50% 50%)';
      tl.fromTo(media, { clipPath: from }, { clipPath: to, duration: 1.1, ease: 'power3.inOut', clearProps: 'clipPath' }, at);
      var img = $('img, video, .ph', media);
      if (img) tl.fromTo(img, { scale: 1.12 }, { scale: 1, duration: 1.6, ease: 'power2.out' }, '<');
    }
    if (media && !textFirst) addMedia('heroStart');
    if (title) {
      var words = splitWords(title);
      tl.set(title, { autoAlpha: 1 }, media ? '-=0.55' : '>')
        .from(words, { yPercent: 115, duration: 0.95, stagger: 0.07 }, '<');
    }
    steps.forEach(function (s, i) { tl.fromTo(s, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7 }, i === 0 ? (textFirst ? 'heroStart' : '-=0.45') : '-=0.5'); });
    if (media && textFirst) addMedia('heroStart+=0.35');
    tl.add(function () { marks.forEach(function (m) { m.classList.add('is-in'); }); }, '-=0.3');
    if (speed !== 1) tl.timeScale(speed);
  }

  /* ── generic reveals ─────────────────────────────────── */
  function initReveals() {
    $$('[data-split]').forEach(function (el) {
      if (el.closest('[data-hero]')) return;
      var words = splitWords(el);
      if (reduce) return;
      gsap.from(words, { yPercent: 115, duration: 0.9, ease: EASE, stagger: 0.06, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
    $$('[data-reveal]').forEach(function (el) {
      if (reduce) return;
      var targets = el.dataset.reveal === 'stagger' ? Array.prototype.slice.call(el.children) : [el];
      gsap.from(targets, { autoAlpha: 0, y: 32, duration: 0.8, ease: EASE, stagger: 0.09, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
    $$('.mark').forEach(function (m) {
      if (m.closest('[data-hero]')) return;
      if (reduce) { m.classList.add('is-in'); return; }
      ST.create({ trigger: m, start: 'top 85%', once: true, onEnter: function () { m.classList.add('is-in'); } });
    });
    $$('[data-scrub-words]').forEach(function (el) {
      var words = splitWords(el);
      if (reduce) return;
      var from = cssNumColor(el, '--scrub-from'), to = cssNumColor(el, '--scrub-to');
      gsap.set(words, { color: from });
      gsap.to(words, { color: to, ease: 'none', stagger: 1, scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 45%', scrub: true } });
    });
    $$('[data-count]').forEach(function (el) {
      var target = parseFloat(el.dataset.count); if (!isFinite(target) || reduce) return;
      var decimals = (el.dataset.count.split('.')[1] || '').length;
      var prefix = el.dataset.prefix || '', suffix = el.dataset.suffix || '';
      var obj = { v: 0 };
      function paint() { el.textContent = prefix + obj.v.toLocaleString('he-IL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix; }
      ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () { gsap.to(obj, { v: target, duration: 1.6, ease: 'power2.out', onUpdate: paint }); } });
      obj.v = 0; paint();
    });
    $$('[data-parallax]').forEach(function (el) {
      if (reduce) return;
      var p = dataNum(el, 'parallax', 0.08) * 100;
      gsap.fromTo(el, { yPercent: -p }, { yPercent: p, ease: 'none', scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    $$('[data-mask]').forEach(function (el) {
      if (reduce || el.closest('[data-hero]')) return;
      var rect = el.dataset.mask === 'rect';
      gsap.fromTo(el, { clipPath: rect ? 'inset(15% 15% 15% 15% round 32px)' : 'circle(0% at 50% 50%)' },
        { clipPath: rect ? 'inset(0% 0% 0% 0% round 0px)' : 'circle(75% at 50% 50%)', duration: 1.2, ease: 'power3.inOut', clearProps: 'clipPath',
          scrollTrigger: { trigger: el, start: 'top 80%', once: true } });
    });
  }
  function cssNumColor(el, prop) { return getComputedStyle(el).getPropertyValue(prop).trim() || 'currentColor'; }

  /* ── arc loop carousel ───────────────────────────────── */
  function initArcLoop(root) {
    var track = $('[data-arc-track]', root); if (!track) return;
    var originals = Array.prototype.slice.call(track.children);
    var n = originals.length; if (n < 3) return;
    for (var k = 0; k < 2; k++) originals.forEach(function (o) {
      var c = o.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', '');
      track.appendChild(c);
    });
    var slides = Array.prototype.slice.call(track.children);
    var setW = 0, step = 0, raf = 0, timer = 0, paused = false, visible = false;

    function measure() {
      setW = Math.abs(slides[n].offsetLeft - slides[0].offsetLeft);
      step = Math.abs(slides[1].offsetLeft - slides[0].offsetLeft);
    }
    function pos() { return Math.abs(track.scrollLeft); }
    function jump(p) {
      track.style.scrollSnapType = 'none'; track.style.scrollBehavior = 'auto';
      track.scrollLeft = DIR * p;
      requestAnimationFrame(function () { track.style.scrollSnapType = ''; track.style.scrollBehavior = ''; });
    }
    function loop() { var p = pos(); if (p < setW * 0.5) jump(p + setW); else if (p > setW * 1.5) jump(p - setW); }
    function arc() {
      var r = track.getBoundingClientRect(), cx = r.left + r.width / 2, half = r.width / 2 || 1;
      var depth = cssNum(root, '--arc-depth', 70), rot = cssNum(root, '--arc-rotate', 9);
      slides.forEach(function (s) {
        var b = s.getBoundingClientRect(), d = clamp((b.left + b.width / 2 - cx) / half, -1.6, 1.6), a = Math.abs(d);
        gsap.set(s, { y: a * a * depth, rotation: d * rot, zIndex: Math.round(100 - a * 10) });
        s.classList.toggle('is-center', a < 0.2);
      });
    }
    var settle = 0;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf); raf = requestAnimationFrame(arc);
      clearTimeout(settle); settle = setTimeout(loop, 140);
    }, { passive: true });
    function next(dirSign) { track.scrollBy({ left: DIR * step * dirSign, behavior: 'smooth' }); }
    var prevBtn = $('[data-arc-prev]', root), nextBtn = $('[data-arc-next]', root);
    if (prevBtn) prevBtn.addEventListener('click', function () { next(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { next(1); });

    var every = dataNum(root, 'autoplay', 0);
    function tick() { if (!paused && visible && !document.hidden) next(1); }
    if (every && !reduce) {
      timer = setInterval(tick, every);
      ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, function () { paused = true; }, { passive: true }); });
      ['pointerleave', 'focusout'].forEach(function (ev) { root.addEventListener(ev, function () { paused = false; }); });
    }
    inView(root, function (v) { visible = v; });
    function setup() { measure(); jump(setW); arc(); }
    setup();
    window.addEventListener('resize', function () { setup(); });
    if (document.fonts) document.fonts.ready.then(setup);
  }

  /* ── dome / arc tabs ─────────────────────────────────── */
  function initArcTabs(root) {
    var items = $$('[data-arc-item]', root), panels = $$('[data-arc-panel]', root);
    if (!items.length) return;
    var current = Math.floor(items.length / 2);
    var ai = items.findIndex(function (i) { return i.getAttribute('aria-selected') === 'true'; });
    if (ai > -1) current = ai;

    function layout(animate) {
      var w = window.innerWidth;
      var span = w < 768 ? 150 : w < 1025 ? 120 : 124;
      // data-arc-all: space the items so every one stays on the arc from any position (few tabs, e.g. a 4-step process)
      var stepDeg = span / Math.max(1, (items.length - 1) * (root.hasAttribute('data-arc-all') ? 2 : 1));
      var R = cssNum(root, '--arc-r', 25) * w / 100;
      var idle = cssNum(root, '--idle-opacity', 0.4);
      items.forEach(function (it, i) {
        var deg = (i - current) * stepDeg, rad = deg * Math.PI / 180;
        var vis = Math.abs(deg) <= span / 2 + 0.01;
        // data-arc-all on a phone: no room for three items on one side of an arc → one straight row instead
        if (root.hasAttribute('data-arc-all') && w < 768) {
          var n = items.length, gap = Math.min(it.offsetWidth * 1.14, (root.clientWidth - it.offsetWidth) / Math.max(1, n - 1));
          gsap.to(it, { x: (i - (n - 1) / 2) * gap * (RTL ? -1 : 1), y: 0, rotation: 0, autoAlpha: 1, duration: animate && !reduce ? 0.5 : 0, ease: 'power3.out' });
          it.setAttribute('aria-selected', i === current ? 'true' : 'false'); it.tabIndex = i === current ? 0 : -1;
          return;
        }
        // forward (higher index) sits toward the inline-end side: right in LTR, left in RTL
        gsap.to(it, {
          x: Math.sin(rad) * R * (RTL ? -1 : 1),
          y: (1 - Math.cos(rad)) * R,
          rotation: deg * (RTL ? -1 : 1),
          autoAlpha: i === current ? 1 : vis ? idle : 0,
          duration: animate && !reduce ? 0.8 : 0, ease: 'power3.inOut'
        });
        it.setAttribute('aria-selected', i === current ? 'true' : 'false');
        it.tabIndex = i === current ? 0 : -1;
      });
      panels.forEach(function (p, i) {
        var on = i === current;
        if (on === p.classList.contains('is-active') && animate) return;
        p.classList.toggle('is-active', on);
        p.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (!animate || reduce) { gsap.set(p, { autoAlpha: on ? 1 : 0, y: 0 }); return; }
        if (on) gsap.fromTo(p, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.15, ease: EASE });
        else gsap.to(p, { autoAlpha: 0, y: -10, duration: 0.35 });
      });
    }
    function go(i) { current = (i + items.length) % items.length; layout(true); }
    items.forEach(function (it, i) {
      it.addEventListener('click', function () { go(i); });
      it.addEventListener('keydown', function (e) {
        var fwd = RTL ? 'ArrowLeft' : 'ArrowRight', back = RTL ? 'ArrowRight' : 'ArrowLeft';
        if (e.key === fwd) { e.preventDefault(); go(current + 1); items[current].focus(); }
        if (e.key === back) { e.preventDefault(); go(current - 1); items[current].focus(); }
      });
    });
    layout(false);
    window.addEventListener('resize', function () { layout(false); });
  }

  /* ── pinned horizontal scroll (desktop) ──────────────── */
  function initHScroll(root) {
    var track = $('[data-hscroll-track]', root); if (!track || reduce) return;
    var bar = $('[data-hscroll-progress]', root), counter = $('[data-hscroll-count]', root);
    var total = track.children.length;
    mm.add(DESKTOP, function () {
      var amount = function () { return Math.max(0, track.scrollWidth - root.clientWidth); };
      var speed = dataNum(root, 'speed', 1.4);
      gsap.to(track, {
        x: function () { return -DIR * amount(); }, ease: 'none',
        scrollTrigger: {
          trigger: root, pin: true, scrub: 0.6, start: 'top top', end: function () { return '+=' + amount() * speed; }, invalidateOnRefresh: true,
          onUpdate: function (self) {
            if (bar) bar.style.setProperty('--p', self.progress.toFixed(4));
            if (counter) counter.textContent = String(Math.min(total, Math.floor(self.progress * total) + 1)).padStart(2, '0');
          }
        }
      });
    });
  }

  /* ── radial wheel ────────────────────────────────────── */
  function initWheel(root) {
    var stage = $('[data-wheel-stage]', root), cards = $$('[data-wheel-card]', root);
    if (!stage || !cards.length) return;
    var stepDeg = dataNum(root, 'step', 16), dur = dataNum(root, 'duration', 0.8), dragK = dataNum(root, 'drag', 1);
    var st = { rot: 0 }, index = 0, n = cards.length;
    var dotsWrap = $('[data-wheel-dots]', root), dots = [];
    if (dotsWrap) cards.forEach(function (_, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'wheel__dot'; b.setAttribute('aria-label', 'כרטיס ' + (i + 1));
      b.addEventListener('click', function () { goTo(i); }); dotsWrap.appendChild(b); dots.push(b);
    });
    function apply() {
      var cw = cards[0].offsetWidth || 300, R = cssNum(root, '--wheel-radius', 4.2) * cw;
      cards.forEach(function (c, i) {
        var off = i * stepDeg - st.rot, a = Math.abs(off);
        c.style.transformOrigin = '50% ' + R + 'px';
        c.style.transform = 'rotate(' + (off * (RTL ? -1 : 1)) + 'deg)';
        c.style.opacity = clamp(1 - (a - stepDeg * 1.2) / (stepDeg * 2)).toFixed(3);
        c.style.pointerEvents = a > stepDeg * 2.5 ? 'none' : '';
        c.classList.toggle('is-active', a < stepDeg / 2);
      });
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); d.setAttribute('aria-current', i === index ? 'true' : 'false'); });
    }
    function goTo(i) {
      index = clamp(Math.round(i), 0, n - 1);
      gsap.to(st, { rot: index * stepDeg, duration: reduce ? 0 : dur, ease: 'power3.out', onUpdate: apply, overwrite: true });
    }
    var startX = 0, startRot = 0, lastX = 0, lastT = 0, vel = 0, dragging = false, moved = false;
    stage.addEventListener('pointerdown', function (e) {
      if (!dragK) return;
      dragging = true; moved = false; startX = lastX = e.clientX; lastT = performance.now(); startRot = st.rot; vel = 0;
      gsap.killTweensOf(st); stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var cw = cards[0].offsetWidth || 300, dx = e.clientX - startX;
      if (Math.abs(dx) > 6) moved = true;
      var raw = startRot - DIR * dx / cw * stepDeg * dragK, max = (n - 1) * stepDeg;
      st.rot = raw < 0 ? raw * 0.35 : raw > max ? max + (raw - max) * 0.35 : raw;
      var now = performance.now(), dt = Math.max(1, now - lastT);
      vel = -DIR * (e.clientX - lastX) / cw * stepDeg * dragK / dt; lastX = e.clientX; lastT = now;
      apply();
    });
    function end() {
      if (!dragging) return; dragging = false;
      var projected = st.rot + vel * dataNum(root, 'fling', 320);
      goTo(projected / stepDeg);
    }
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); return; }
      var c = e.target.closest('[data-wheel-card]'); if (c) { var i = cards.indexOf(c); if (i !== index) goTo(i); }
    }, true);
    root.addEventListener('keydown', function (e) {
      var fwd = RTL ? 'ArrowLeft' : 'ArrowRight', back = RTL ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd) goTo(index + 1); if (e.key === back) goTo(index - 1);
    });
    var start = dataNum(root, 'start', Math.floor(n / 2)); index = start; st.rot = start * stepDeg;
    apply(); window.addEventListener('resize', apply);
  }

  /* ── sticky bounce cards (spring physics) ────────────── */
  function initStickyBounce(root) {
    var cards = $$('[data-sb-card]', root); if (!cards.length) return;
    var cfg = { turnRange: dataNum(root, 'turnRange', 0.6), bounce: clamp(dataNum(root, 'bounce', 3), 0, 30) / 100, wobble: clamp(dataNum(root, 'wobble', 1), 0.2, 3) };
    var OMEGA = 13, VREF = 1.25, ZETA = clamp(0.62 / cfg.wobble, 0.15, 1);
    var anchors = cards.map(function (c, i) {
      c.style.setProperty('--i', i);
      var a = document.createElement('i'); a.className = 'sb-anchor'; a.setAttribute('aria-hidden', 'true');
      c.parentNode.insertBefore(a, c); return a;
    });
    var state = cards.map(function () { return { turn: 1, tv: 0, sq: 0, sv: 0, prev: null }; });
    var raf = 0, last = 0, running = false;
    function frame(t) {
      var dt = last ? Math.min(1 / 30, Math.max(0, (t - last) / 1000)) : 0; last = t;
      cards.forEach(function (c, i) {
        var s = state[i], h = c.offsetHeight || 1, stick = parseFloat(getComputedStyle(c).top) || 0;
        var dist = anchors[i].getBoundingClientRect().top - stick;
        var p = clamp(1 - dist / (cfg.turnRange * h)), target = p * p;
        if (s.prev === null) { s.prev = dist; s.turn = target; }
        if (reduce) { s.turn = target > 0.5 ? 1 : 0; s.sq = 0; }
        else if (dt > 0) {
          if (s.prev > 0 && dist <= 0) { var speed = (s.prev - dist) / dt / h; s.sv += cfg.bounce * Math.min(speed / VREF, 1.6) * OMEGA / 0.63; }
          s.tv += (-OMEGA * OMEGA * (s.turn - target) - 2 * ZETA * OMEGA * s.tv) * dt; s.turn += s.tv * dt;
          s.sv += (-OMEGA * OMEGA * s.sq - 2 * ZETA * OMEGA * s.sv) * dt; s.sq += s.sv * dt;
          if (Math.abs(s.turn - target) < 1e-4 && Math.abs(s.tv) < 1e-3) { s.turn = target; s.tv = 0; }
          if (Math.abs(s.sq) < 1e-4 && Math.abs(s.sv) < 1e-3) { s.sq = 0; s.sv = 0; }
        }
        s.prev = dist;
        c.style.setProperty('--turn', s.turn.toFixed(4));
        c.style.setProperty('--sx', (1 + s.sq).toFixed(4));
        c.style.setProperty('--sy', (1 - s.sq).toFixed(4));
      });
      if (running) raf = requestAnimationFrame(frame);
    }
    inView(root, function (v) {
      if (v && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
      else if (!v && running) { running = false; cancelAnimationFrame(raf); }
    }, { rootMargin: '20% 0px' });
  }

  /* ── fan cards ───────────────────────────────────────── */
  function initFan(root) {
    var cards = $$('[data-fan-card]', root); if (!cards.length) return;
    var mid = (cards.length - 1) / 2;
    function select(card) { cards.forEach(function (c) { var on = c === card; c.classList.toggle('is-selected', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
    cards.forEach(function (card, i) {
      card.style.setProperty('--fi', String(i - mid));
      if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
      card.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') select(card); });
      card.addEventListener('pointerdown', function (e) { if (e.isPrimary) select(card); });
      card.addEventListener('focus', function () { select(card); });
      card.addEventListener('keydown', function (e) {
        var keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']; if (keys.indexOf(e.key) < 0) return; e.preventDefault();
        var fwd = RTL ? 'ArrowLeft' : 'ArrowRight';
        var j = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : (i + (e.key === fwd ? 1 : -1) + cards.length) % cards.length;
        cards[j].focus();
      });
    });
    root.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') select(null); });
    var start = root.dataset.fanStart; if (start !== undefined) select(cards[+start] || null);
  }

  /* ── blur stack ──────────────────────────────────────── */
  function initBlurStack(root) {
    if (reduce) return;
    var wraps = $$('[data-blur-item]', root);
    var blur = getComputedStyle(root).getPropertyValue('--blur').trim() || '6px';
    var exitScale = cssNum(root, '--exit-scale', 0.84);
    wraps.forEach(function (w, i) {
      var next = wraps[i + 1]; if (!next) return;
      var card = w.firstElementChild || w;
      gsap.to(card, { filter: 'blur(' + blur + ')', scale: exitScale, autoAlpha: 0, ease: 'none',
        scrollTrigger: { trigger: next, start: 'top 60%', end: 'top 5%', scrub: true } });
    });
  }

  /* ── process wheel ───────────────────────────────────── */
  function initProcessWheel(root) {
    var arc = $('[data-pw-arc]', root), dots = $$('[data-pw-dot]', root), steps = $$('[data-pw-step]', root);
    if (!arc || !steps.length) return;
    mm.add(DESKTOP, function () {
      if (reduce) return;
      var LEN = arc.getTotalLength(), n = steps.length;
      root.classList.add('is-pinned');
      gsap.set(arc, { strokeDasharray: LEN, strokeDashoffset: LEN });
      gsap.set(steps, { autoAlpha: 0, y: 20 }); gsap.set(steps[0], { autoAlpha: 1, y: 0 });
      dots.forEach(function (d, i) { d.classList.toggle('is-on', i === 0); });
      var tl = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top top', end: '+=' + dataNum(root, 'length', 2200), scrub: true, pin: true, anticipatePin: 1 } });
      steps.forEach(function (s, i) {
        tl.to(arc, { strokeDashoffset: LEN * (1 - (i + 1) / n), duration: 2, ease: 'none' });
        tl.call(function () { dots.forEach(function (d, j) { d.classList.toggle('is-on', j <= Math.min(i + 1, n - 1)); }); });
        if (steps[i + 1]) {
          tl.to(s, { autoAlpha: 0, y: -16, duration: 0.5 }, '>')
            .to(steps[i + 1], { autoAlpha: 1, y: 0, duration: 0.5 }, '<0.2');
        }
      });
      return function () { root.classList.remove('is-pinned'); };
    });
  }

  /* ── auto-advancing process tabs ─────────────────────── */
  function initAutoProcess(root) {
    var tabs = $$('[data-ap-tab]', root), steps = $$('[data-ap-step]', root); if (!tabs.length) return;
    var DUR = dataNum(root, 'duration', 4), current = 0, tween = null, visible = false, started = false;
    function activate(i, auto) {
      current = i;
      if (tween) tween.kill();
      tabs.forEach(function (t, j) { t.classList.toggle('is-active', j === i); t.setAttribute('aria-selected', j === i ? 'true' : 'false'); t.style.setProperty('--progress', '0%'); });
      if (reduce || !auto) tabs[i].style.setProperty('--progress', '100%');
      steps.forEach(function (s, j) {
        if (j === i) { s.hidden = false; if (!reduce) gsap.fromTo(s, { autoAlpha: 0, y: 15 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }); }
        else { s.hidden = true; }
      });
      if (reduce || !auto) return;
      var o = { p: 0 };
      tween = gsap.to(o, { p: 100, duration: DUR, ease: 'none',
        onUpdate: function () { tabs[i].style.setProperty('--progress', o.p + '%'); },
        onComplete: function () { if (visible) activate((i + 1) % tabs.length, true); } });
      if (!visible) tween.pause();
    }
    tabs.forEach(function (t, i) { t.addEventListener('click', function () { activate(i, true); }); });
    activate(0, false);
    inView(root, function (v) {
      visible = v;
      if (v && !started) { started = true; activate(0, true); }
      else if (tween) { v ? tween.resume() : tween.pause(); }
    }, { threshold: 0.35 });
  }

  /* ── line draw process ───────────────────────────────── */
  function initLineDraw(root) {
    var lines = $$('[data-ld-line] path', root), steps = $$('[data-ld-step]', root); if (!steps.length) return;
    if (reduce) { steps.forEach(function (s) { s.classList.add('is-lit'); }); return; }
    mm.add({ desk: DESKTOP, mob: MOBILE }, function (ctx) {
      var desk = ctx.conditions.desk;
      root.classList.toggle('is-desk', !!desk);
      lines.forEach(function (p) { var L = p.getTotalLength(); gsap.set(p, { strokeDasharray: L, strokeDashoffset: L }); });
      gsap.set(steps, { opacity: 0.35, filter: 'grayscale(1)' });
      var tl = gsap.timeline({ scrollTrigger: { trigger: root, start: desk ? 'top top' : 'top 65%', end: desk ? '+=250%' : 'bottom 60%', pin: desk, scrub: 1 } });
      steps.forEach(function (step, i) {
        if (lines[i]) tl.to(lines[i], { strokeDashoffset: 0, duration: 1, ease: 'none' });
        tl.to(step, { opacity: 1, filter: 'grayscale(0)', duration: 0.5, ease: 'power1.inOut' }, lines[i] ? '-=0.2' : '>');
      });
    });
  }

  /* ── pile → row spread ───────────────────────────────── */
  function initSpread(root) {
    var cards = $$('[data-spread-card]', root); if (!cards.length || reduce) return;
    mm.add(DESKTOP, function () {
      var box = root.getBoundingClientRect();
      gsap.from(cards, {
        x: function (i, el) { var r = el.getBoundingClientRect(); return (box.left + box.width / 2) - (r.left + r.width / 2); },
        rotation: function (i) { return [-7, 5, -3, 8, -5, 4][i % 6]; },
        y: function (i) { return i * -6; },
        ease: 'none', stagger: 0,
        scrollTrigger: { trigger: root, start: 'top 85%', end: 'top 25%', scrub: 0.8, invalidateOnRefresh: true }
      });
    });
  }

  /* ── page background by section ──────────────────────── */
  function initBgSwitch() {
    var secs = $$('[data-bg]'); if (!secs.length) return;
    var base = getComputedStyle(document.body).backgroundColor;
    var baseFg = getComputedStyle(document.body).color;
    secs.forEach(function (s) {
      function on() { gsap.to(document.body, { backgroundColor: s.dataset.bg, color: s.dataset.fg || baseFg, duration: reduce ? 0 : 0.6, overwrite: 'auto' }); }
      function off() { gsap.to(document.body, { backgroundColor: base, color: baseFg, duration: reduce ? 0 : 0.6, overwrite: 'auto' }); }
      ST.create({ trigger: s, start: 'top 55%', end: 'bottom 45%', onEnter: on, onEnterBack: on, onLeave: off, onLeaveBack: off });
    });
  }

  /* ── marquee (duplicate once for a seamless loop) ────── */
  function initMarquee(root) {
    var track = $('[data-marquee-track]', root); if (!track || track.__dup) return;
    var clone = track.cloneNode(true); clone.setAttribute('aria-hidden', 'true'); clone.removeAttribute('data-marquee-track');
    track.parentNode.appendChild(clone); track.__dup = true;
  }

  /* ── vertical video testimonial card ─────────────────── */
  function initVCard(card) {
    var v = $('video', card), play = $('[data-vcard-play]', card), mute = $('[data-vcard-mute]', card);
    if (!v) return;
    v.muted = true; v.playsInline = true;
    function sync() { card.classList.toggle('is-playing', !v.paused); card.classList.toggle('is-muted', v.muted); }
    if (play) play.addEventListener('click', function () { v.paused ? v.play() : v.pause(); });
    if (mute) mute.addEventListener('click', function () { v.muted = !v.muted; sync(); });
    v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
    if (card.dataset.vcard === 'autoplay' && !reduce) inView(card, function (vis) { vis ? v.play().catch(function () {}) : v.pause(); }, { threshold: 0.6 });
  }

  /* ── sticky buy bar / floating price ─────────────────── */
  function initBuybar() {
    var bar = $('[data-buybar]'), after = $('[data-buybar-after]'); if (!bar || !after) return;
    ST.create({ trigger: after, start: 'bottom 15%', onEnter: function () { bar.classList.add('is-on'); }, onLeaveBack: function () { bar.classList.remove('is-on'); } });
    var stop = $('[data-buybar-stop]');
    if (stop) ST.create({ trigger: stop, start: 'top bottom', onEnter: function () { bar.classList.remove('is-on'); }, onLeaveBack: function () { bar.classList.add('is-on'); } });
  }

  /* ── dome gallery: an endless grid of work wrapped on a sphere — drag to roam, click a card to open it ──
     Source of truth is the list in the HTML ([data-dome-item] with img + name / meta / text / link), so SEO and
     JS-off stay intact; the tiles are a recycled visual pool. Desktop: free 2-axis drag with glide.
     Touch: horizontal drag only, the page scroll drifts the dome vertically, so a phone never gets trapped. */
  function initDome(root) {
    var txt = function (el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
    var src = $$('[data-dome-item]', root).map(function (el) {
      var img = $('img', el), a = $('a[href]', el);
      if (a) a.tabIndex = -1;                                          // the stage owns keyboard focus
      return { src: img ? (img.currentSrc || img.getAttribute('src')) : '', alt: img ? img.alt : '',
        name: txt($('[data-dome-name]', el)), meta: txt($('[data-dome-meta]', el)), text: txt($('[data-dome-text]', el)),
        href: a ? a.getAttribute('href') : '', cta: txt(a), ext: a ? a.target === '_blank' : false };
    }).filter(function (d) { return d.src; });
    var n = src.length; if (!n) return;

    var o = { curve: dataNum(root, 'curve', 1), dim: clamp(dataNum(root, 'dim', 0.65)), smooth: clamp(dataNum(root, 'smooth', 0.12), 0.02, 1),
      glide: clamp(dataNum(root, 'glide', 0.93), 0, 0.99), open: dataNum(root, 'open', 0.75) };
    var touch = matchMedia('(pointer: coarse)').matches;
    function mk(tag, cls, parent) { var el = document.createElement(tag); if (cls) el.className = cls; if (parent) parent.appendChild(el); return el; }

    var stage = mk('div', 'dome__stage', root);
    stage.tabIndex = 0; stage.setAttribute('role', 'application');
    stage.setAttribute('aria-label', root.getAttribute('aria-label') || 'גלריה — חיצים להזזה, Enter לפתיחה');
    var field = mk('div', 'dome__field', stage), veil = mk('div', 'dome__veil', stage);
    var probe = mk('div', 'dome__probe', stage);
    var hint = $('[data-dome-hint]', root); if (hint) stage.appendChild(hint);
    var live = mk('div', 'visually-hidden', stage); live.setAttribute('aria-live', 'polite');
    // the opened card: a panel that grows from the tile, the photo on the inline-start side, copy on the other
    var detail = mk('div', 'dome__detail', stage); detail.setAttribute('role', 'dialog'); detail.setAttribute('aria-hidden', 'true');
    var panel = mk('div', 'dome__panel', detail), copy = mk('div', 'dome__copy', panel);
    var dMeta = mk('p', 'dome__d-meta', copy), dName = mk('h3', 'dome__d-name h3', copy), dText = mk('p', 'dome__d-text', copy);
    var dLink = mk('a', 'btn btn--primary dome__d-link', copy);
    var photo = mk('div', 'dome__photo', detail), pImg = mk('img', '', photo), pShade = mk('span', 'dome__shade', photo);
    var close = mk('button', 'dome__close', detail); close.type = 'button'; close.setAttribute('aria-label', 'סגירה');
    close.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13"/></svg>';
    pImg.alt = ''; pImg.draggable = false;
    root.classList.add('dome--ready');

    var W = 1, H = 1, cw = 1, ch = 1, px = 1, py = 1, R = 0, cols = 0, rows = 0, tiles = [];
    var ox = 0, oy = 0, tx = 0, ty = 0, vx = 0, vy = 0, scrollY0 = 0, raf = 0, last = 0, visible = false, drag = null, open = null;
    var K = n === 3 ? 2 : Math.max(1, Math.floor(n / 2));             // row shift, so neighbours differ

    function layout() {
      var r = stage.getBoundingClientRect(); W = r.width || 1; H = r.height || 1;
      cw = probe.offsetWidth; ch = probe.offsetHeight; var gap = cssNum(probe, 'padding-inline-start', 0);
      cw -= gap; px = cw + gap; py = ch + gap;
      R = o.curve > 0.01 ? Math.max(W, H * 1.2) * 1.5 / o.curve : 0;
      field.style.perspective = Math.round(Math.max(W, H) * 1.2) + 'px';
      var span = R ? 1.8 : 1.2;
      cols = Math.min(24, Math.ceil(W * span / px) + 2); rows = Math.min(24, Math.ceil(H * span / py) + 2);
      while (tiles.length < cols * rows) {
        var el = mk('div', 'dome__tile', field), img = mk('img', '', el), sh = mk('span', 'dome__shade', el), lab = mk('div', 'dome__label', el);
        img.alt = ''; img.draggable = false; img.decoding = 'async'; el.setAttribute('aria-hidden', 'true');
        tiles.push({ el: el, img: img, shade: sh, name: mk('span', 'dome__name', lab), meta: mk('span', 'dome__meta', lab), idx: -1, u: 0, v: 0, s: 0 });
      }
      while (tiles.length > cols * rows) tiles.pop().el.remove();
      tiles.forEach(function (t) { t.el.style.width = cw + 'px'; t.el.style.height = ch + 'px'; });
      draw();
    }

    function draw() {
      var c0 = Math.round(-ox / px) - (cols >> 1), r0 = Math.round(-oy / py) - (rows >> 1), i = 0;
      for (var b = 0; b < rows; b++) for (var a = 0; a < cols; a++) {
        var t = tiles[i++], col = c0 + a, row = r0 + b, u = col * px + ox, v = row * py + oy;
        var idx = (((RTL ? -col : col) + row * K) % n + n) % n;      // RTL: the sequence reads right → left
        if (t.idx !== idx) { t.idx = idx; var d = src[idx]; t.img.src = d.src; t.name.textContent = d.name; t.meta.textContent = d.meta; }
        t.u = u; t.v = v; var tr, hide = open && open.tile === t;
        if (R) {
          var ax = u / R, ay = v / R; if (Math.abs(ax) > 1.35 || Math.abs(ay) > 1.35) hide = true;
          tr = 'translate3d(' + (R * Math.sin(ax) * Math.cos(ay)).toFixed(1) + 'px,' + (R * Math.sin(ay)).toFixed(1) + 'px,' +
            (R * (Math.cos(ax) * Math.cos(ay) - 1)).toFixed(1) + 'px) rotateY(' + ax.toFixed(4) + 'rad) rotateX(' + (-ay).toFixed(4) + 'rad)';
        } else tr = 'translate3d(' + u.toFixed(1) + 'px,' + v.toFixed(1) + 'px,0)';
        t.el.style.transform = tr; t.el.style.visibility = hide ? 'hidden' : '';
        var s = o.dim * clamp((Math.hypot(u / (W * 0.6), v / (H * 0.7)) - 0.15) / 0.65); t.s = s;
        t.shade.style.opacity = s.toFixed(3);
      }
    }

    function tick(now) {
      raf = 0; var dt = last ? clamp((now - last) / 16.667, 0.2, 3) : 1; last = now;
      if (!drag && !open) {
        if (reduce) vx = vy = 0;
        else { var f = Math.pow(o.glide, dt); vx *= f; vy *= f; if (Math.abs(vx) < 0.02) vx = 0; if (Math.abs(vy) < 0.02) vy = 0; tx += vx * dt; ty += vy * dt; }
      }
      var k = reduce ? 1 : 1 - Math.pow(1 - o.smooth, dt);
      ox += (tx - ox) * k; oy += (ty - oy) * k; draw();
      var settled = !drag && !vx && !vy && Math.abs(tx - ox) < 0.05 && Math.abs(ty - oy) < 0.05;
      if (settled) { ox = tx; oy = ty; last = 0; } else wake();       // sleeps when nothing moves
    }
    function wake() { if (!raf && visible) raf = requestAnimationFrame(tick); }

    /* opening: FLIP from the tile's projected rect to the target layout */
    function targets() {
      if (W >= 768) {
        var side = Math.min(H * 0.72, W * 0.42), tot = Math.min(side * 1.9, W * 0.88), top = (H - side) / 2, x0 = (W - tot) / 2;
        return { panel: { x: x0, y: top, w: tot, h: side }, photo: { x: RTL ? x0 + tot - side : x0, y: top, w: side, h: side },
          copy: { x: RTL ? 0 : side, y: 0, w: tot - side, h: side } };
      }
      var w = Math.min(W * 0.9, 460), ph = Math.min(w * 0.74, H * 0.42), chh = Math.min(H * 0.94 - ph, 400), y0 = (H - ph - chh) / 2, x1 = (W - w) / 2;   // phone: 4:3-ish photo on top, room for the copy below
      return { panel: { x: x1, y: y0, w: w, h: ph + chh }, photo: { x: x1, y: y0, w: w, h: ph }, copy: { x: 0, y: ph, w: w, h: chh } };
    }
    function rectOf(el) { var s = stage.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height }; }
    function mix(A, B, p) { return { x: A.x + (B.x - A.x) * p, y: A.y + (B.y - A.y) * p, w: A.w + (B.w - A.w) * p, h: A.h + (B.h - A.h) * p }; }
    // boxes are anchored at inline-start (right in RTL), so convert the screen x into an offset from that edge
    function sx(x, w, box) { return RTL ? x - (box - w) : x; }
    function place(el, r) { el.style.transform = 'translate(' + sx(r.x, r.w, W).toFixed(1) + 'px,' + r.y.toFixed(1) + 'px)'; el.style.width = r.w.toFixed(1) + 'px'; el.style.height = r.h.toFixed(1) + 'px'; }
    function drawOpen() {
      if (!open) return; var p = open.p, T = targets(), from = open.from;
      place(photo, mix(from, T.photo, p));
      var pn = mix(from, T.panel, Math.pow(p, open.closing ? 1.6 : 0.8)); place(panel, pn);   // panel leads on open, retracts first on close
      copy.style.transform = 'translate(' + sx(T.panel.x + T.copy.x - pn.x, T.copy.w, pn.w).toFixed(1) + 'px,' + (T.panel.y + T.copy.y - pn.y).toFixed(1) + 'px)';
      copy.style.width = T.copy.w + 'px'; copy.style.height = T.copy.h + 'px';
      copy.style.opacity = clamp((p - 0.45) / 0.4).toFixed(3); close.style.opacity = copy.style.opacity;
      var cs = close.offsetWidth || 44;   // close button rides the card's top inline-end corner
      close.style.transform = 'translate(' + sx(RTL ? T.panel.x + 14 : T.panel.x + T.panel.w - 14 - cs, cs, W).toFixed(1) + 'px,' + (T.panel.y + 14).toFixed(1) + 'px)';
      pShade.style.opacity = (open.s * (1 - p)).toFixed(3); veil.style.opacity = p.toFixed(3);
      var rad = cssNum(root, '--dome-r', 24), inner = (rad * (1 - p)).toFixed(1) + 'px', wide = W >= 768;   // the seam with the copy squares off as it opens
      photo.style.borderRadius = rad + 'px';
      if (wide) { photo.style.borderStartEndRadius = inner; photo.style.borderEndEndRadius = inner; }
      else { photo.style.borderEndStartRadius = inner; photo.style.borderEndEndRadius = inner; }
    }
    function openTile(t) {
      if (!t || open) return; var d = src[t.idx];
      // keep the opened card clear of a fixed header: nudge the stage below it first
      var hdr = document.querySelector('.site-header__bar'), top = stage.getBoundingClientRect().top, need = hdr ? hdr.getBoundingClientRect().bottom + 8 : 0;
      if (top < need) { var y = window.scrollY + top - need; if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); }
      pImg.src = d.src; pImg.alt = d.alt; dName.textContent = d.name; dMeta.textContent = d.meta; dText.textContent = d.text;
      dMeta.hidden = !d.meta; dText.hidden = !d.text; dLink.hidden = !d.href;
      if (d.href) { dLink.href = d.href; dLink.textContent = d.cta || 'לצפייה'; if (d.ext) { dLink.target = '_blank'; dLink.rel = 'noopener'; } else dLink.removeAttribute('target'); }
      vx = vy = 0; tx = ox; ty = oy;
      open = { tile: t, from: rectOf(t.el), s: t.s, p: 0, closing: false }; draw();
      detail.classList.add('is-on'); detail.setAttribute('aria-hidden', 'false'); detail.setAttribute('aria-label', d.name);
      root.classList.add('is-open'); live.textContent = d.name + (d.text ? '. ' + d.text : '');
      gsap.to(open, { p: 1, duration: reduce ? 0 : o.open, ease: 'power3.inOut', onUpdate: drawOpen, onComplete: drawOpen });
      close.focus({ preventScroll: true });
    }
    function closeOpen() {
      if (!open || open.closing) return; var st = open; st.closing = true; st.from = rectOf(st.tile.el);
      gsap.to(st, { p: 0, duration: reduce ? 0 : o.open * 0.85, ease: 'power3.inOut', overwrite: true, onUpdate: drawOpen, onComplete: function () {
        open = null; draw(); detail.classList.remove('is-on'); detail.setAttribute('aria-hidden', 'true'); veil.style.opacity = 0;
        root.classList.remove('is-open'); live.textContent = ''; stage.focus({ preventScroll: true });
      } });
    }
    // 3D tiles don't hit-test reliably, so pick geometrically: the visible tile under the point closest to the centre
    function tileAt(x, y) {
      var best = null, bd = Infinity;
      tiles.forEach(function (t) {
        if (t.el.style.visibility === 'hidden') return; var r = t.el.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) return; var d = t.u * t.u + t.v * t.v; if (d < bd) { bd = d; best = t; }
      });
      return best;
    }
    function nearest() { var best = null, bd = Infinity; tiles.forEach(function (t) { var d = t.u * t.u + t.v * t.v; if (d < bd) { bd = d; best = t; } }); return best; }

    stage.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || open) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, moved: false }; vx = vy = 0;
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.lx, dy = touch ? 0 : e.clientY - drag.ly;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
        drag.moved = true; stage.classList.add('is-dragging'); if (hint) hint.classList.add('is-gone');
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      }
      if (drag.moved) { tx += dx; ty += dy; var m = 16.667 / Math.max(4, e.timeStamp - drag.lt); vx = vx * 0.5 + dx * m * 0.5; vy = vy * 0.5 + dy * m * 0.5; wake(); }
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = e.timeStamp;
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return; var d = drag; drag = null; stage.classList.remove('is-dragging');
      if (e.type === 'pointercancel') { vx = vy = 0; return; }
      if (!d.moved) { vx = vy = 0; openTile(tileAt(e.clientX, e.clientY)); }
      else if (e.timeStamp - d.lt > 90) vx = vy = 0;                   // held still before release = no glide
      wake();
    }
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('dragstart', function (e) { e.preventDefault(); });
    veil.addEventListener('click', closeOpen); close.addEventListener('click', closeOpen);
    // a sideways trackpad swipe pans the dome; vertical wheel keeps scrolling the page
    stage.addEventListener('wheel', function (e) {
      if (open || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault(); tx -= e.deltaX; wake();
    }, { passive: false });
    stage.addEventListener('keydown', function (e) {
      if (open) { if (e.key === 'Escape') { e.preventDefault(); closeOpen(); } return; }
      var step = { ArrowLeft: [px * 0.5, 0], ArrowRight: [-px * 0.5, 0], ArrowUp: [0, py * 0.5], ArrowDown: [0, -py * 0.5] }[e.key];
      if (step) { e.preventDefault(); tx += step[0]; ty += step[1]; wake(); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTile(nearest()); }
    });
    detail.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeOpen(); }
      if (e.key === 'Tab') {                                            // keep focus inside the open card
        var f = [dLink, close].filter(function (x) { return !x.hidden; }), i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      }
    });

    // touch: the page scroll drifts the dome vertically instead of a vertical drag
    if (touch && !reduce) ST.create({ trigger: root, start: 'top bottom', end: 'bottom top', onUpdate: function (s) {
      var y = -(s.progress - 0.5) * py * 1.6; ty += y - scrollY0; scrollY0 = y; wake();
    } });
    inView(root, function (v) { visible = v; if (v) wake(); });
    if ('ResizeObserver' in window) new ResizeObserver(function () { layout(); if (open) drawOpen(); }).observe(stage);
    else window.addEventListener('resize', layout);
    layout();
    ox = tx = px / 2; oy = ty = py * 0.12;                              // start between two columns, a touch low
    if (!reduce) {                                                      // entrance: the dome swings in from the side and settles
      gsap.set(field, { autoAlpha: 0, scale: 0.86 });
      ST.create({ trigger: root, start: 'top 75%', once: true, onEnter: function () {
        ox += DIR * px * 0.9; oy -= py * 0.25; draw(); wake();
        gsap.to(field, { autoAlpha: 1, scale: 1, duration: 1.3, ease: EASE });
      } });
    }
    draw();
  }

  /* ── nav indicator: a pill slides under the hovered link and rests on the section in view (desktop);
        Esc closes the mobile menu ─────────────────────────── */
  function initNavSpy(nav) {
    var pill = $('[data-nav-pill]', nav), links = $$(':scope > a[href^="#"]', nav), active = null;
    if (!pill || !links.length) return;
    function moveTo(a) {
      links.forEach(function (l) { l.classList.toggle('is-pill', l === a); });
      if (!a) { pill.style.opacity = 0; return; }
      var n = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
      var x = RTL ? r.right - n.right : r.left - n.left;              // offset from the inline-start edge (negative in RTL)
      pill.style.inlineSize = r.width + 'px'; pill.style.translate = x + 'px 0'; pill.style.opacity = 1;
    }
    links.forEach(function (a) {
      a.addEventListener('mouseenter', function () { moveTo(a); });
      a.addEventListener('focus', function () { moveTo(a); });
    });
    nav.addEventListener('mouseleave', function () { moveTo(active); });
    links.forEach(function (a) {
      var sec = $(a.getAttribute('href')); if (!sec) return;
      ST.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', onToggle: function (s) {
        if (s.isActive) { active = a; } else if (active === a) { active = null; }
        links.forEach(function (l) { l.classList.toggle('is-active', l === active); if (l === active) l.setAttribute('aria-current', 'location'); else l.removeAttribute('aria-current'); });
        if (!nav.matches(':hover')) moveTo(active);
      } });
    });
    window.addEventListener('resize', function () { moveTo(active); });
    var header = nav.closest('.site-header'), toggle = header && $('[data-menu-toggle]', header);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header && header.classList.contains('is-open') && toggle) { toggle.click(); toggle.focus(); }
    });
  }

  /* ── lottie: [data-lottie="file.json"] plays a vector animation in place of its fallback icon.
        The player (lottie-web light, pinned) loads only when the first animation nears the viewport;
        each animation pauses off-screen; reduced motion = one still frame. ─────────────────── */
  var LOTTIE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie_light.min.js', lottieReady = null;
  function loadLottie() {
    if (window.lottie) return Promise.resolve(window.lottie);
    if (!lottieReady) lottieReady = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = LOTTIE_SRC; s.async = true;
      s.onload = function () { res(window.lottie); }; s.onerror = rej; document.head.appendChild(s);
    });
    return lottieReady;
  }
  function initLottie(el) {
    var anim = null, loading = false;
    inView(el, function (v) {
      if (v && !anim && !loading) {
        loading = true;
        loadLottie().then(function (lottie) {
          anim = lottie.loadAnimation({ container: el, renderer: 'svg', loop: !reduce, autoplay: !reduce, path: el.dataset.lottie,
            rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
          anim.addEventListener('DOMLoaded', function () {
            el.parentElement.classList.add('has-lottie');
            if (reduce) anim.goToAndStop(Math.round(anim.totalFrames * 0.6), true);
          });
        }).catch(function () { /* keep the fallback icon */ });
      } else if (anim && !reduce) { v ? anim.play() : anim.pause(); }
    }, { rootMargin: '200px 0px' });
  }

  /* ── boot ────────────────────────────────────────────── */
  function boot() {
    initSmoothScroll();
    initHeader();
    initIntro();
    initReveals();
    $$('[data-arc-loop]').forEach(initArcLoop);
    $$('[data-arc-tabs]').forEach(initArcTabs);
    $$('[data-hscroll]').forEach(initHScroll);
    $$('[data-wheel]').forEach(initWheel);
    $$('[data-dome]').forEach(initDome);
    $$('[data-nav]').forEach(initNavSpy);
    $$('[data-lottie]').forEach(initLottie);
    $$('[data-sticky-bounce]').forEach(initStickyBounce);
    $$('[data-fan]').forEach(initFan);
    $$('[data-blur-stack]').forEach(initBlurStack);
    $$('[data-process-wheel]').forEach(initProcessWheel);
    $$('[data-auto-process]').forEach(initAutoProcess);
    $$('[data-line-draw]').forEach(initLineDraw);
    $$('[data-spread]').forEach(initSpread);
    $$('[data-marquee]').forEach(initMarquee);
    $$('[data-vcard]').forEach(initVCard);
    initBgSwitch();
    initBuybar();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
    window.addEventListener('load', function () { ST.refresh(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
