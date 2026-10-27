(() => {
  const PX_PER_CM = 50;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const barMQ = matchMedia('(max-width: 1023px)');

  const sections = [...document.querySelectorAll('[data-tape]')];
  const names = sections.map(s => s.dataset.tape);
  const rail = document.getElementById('rail');
  const track = document.getElementById('rail-track');
  const strip = document.getElementById('rail-strip');
  const map = document.getElementById('rail-map');
  const win = document.getElementById('rail-window');
  const needle = document.getElementById('rail-needle');
  const readout = document.getElementById('rail-read');
  const dockTop = document.getElementById('dock-top');
  const dockBottom = document.getElementById('dock-bottom');

  // current section name on the phone bar
  const railNow = document.createElement('p');
  railNow.className = 'rail-now';
  railNow.setAttribute('aria-hidden', 'true');
  rail.prepend(railNow);

  // rolling digits for the 000% readout
  const digitCols = [...readout.querySelectorAll('.dg-col')];
  digitCols.forEach(col => { col.innerHTML = '0123456789'.split('').map(d => `<i>${d}</i>`).join(''); });

  let bar = false, docH = 0, vh = 0, size = 0, base = 0, span = 0;
  let tops = [], labels = [], mapMarks = [];
  let prevPct = -1, current = -1, dockKey = '';

  /* ---------- build ---------- */
  function build() {
    bar = barMQ.matches;
    track.setAttribute('aria-orientation', bar ? 'horizontal' : 'vertical');
    docH = document.documentElement.scrollHeight;
    vh = innerHeight;
    size = bar ? track.clientWidth : track.clientHeight;
    const pad = bar ? 10 : 28;
    base = pad;
    span = Math.max(1, size - pad * 2);
    tops = sections.map(s => s.getBoundingClientRect().top + scrollY);

    // the ruler: ticks, numbers and section names, laid out in page pixels
    strip.textContent = '';
    strip.style.height = docH + 'px';
    const frag = document.createDocumentFragment();
    for (let y = PX_PER_CM * 5; y < docH; y += PX_PER_CM * 5) {
      const n = document.createElement('span');
      n.className = 'rail-num';
      n.style.top = y + 'px';
      n.textContent = y / PX_PER_CM;
      frag.appendChild(n);
    }
    labels = sections.map((s, i) => {
      const l = document.createElement('span');
      l.className = 'rail-label';
      l.style.top = tops[i] + 'px';
      l.textContent = names[i];
      frag.appendChild(l);
      return l;
    });
    strip.appendChild(frag);

    // the overview: whole page squeezed into the rail
    map.querySelectorAll('.map-mark').forEach(m => m.remove());
    mapMarks = sections.map((s, i) => {
      const m = document.createElement('div');
      m.className = 'map-mark';
      m.style[bar ? 'left' : 'top'] = (base + tops[i] / docH * span) + 'px';
      m.innerHTML = `<span>${names[i]}</span>`;
      map.appendChild(m);
      return m;
    });
    const winSize = Math.max(6, vh / docH * span) + 'px';
    win.style.height = bar ? '' : winSize;
    win.style.width = bar ? winSize : '';

    current = -1; dockKey = ''; prevPct = -1;
    update();
  }

  /* ---------- every scroll frame ---------- */
  function update() {
    const s = scrollY;
    const max = Math.max(1, docH - vh);
    const f = Math.min(1, Math.max(0, s / max));

    if (!bar) strip.style.transform = `translate3d(0,${-s}px,0)`;

    const b = base + f * span;
    needle.style.transform = bar ? `translate3d(${b}px,0,0)` : `translate3d(0,${b}px,0)`;
    readout.classList.toggle('is-above', bar ? b > size - 50 : b > size - 26);
    const w = base + s / docH * span;
    win.style.transform = bar ? `translate3d(${w}px,0,0)` : `translate3d(0,${w}px,0)`;

    const pct = Math.round(f * 100);
    if (pct !== prevPct) {
      prevPct = pct;
      String(pct).padStart(3, '0').split('').forEach((d, i) => { digitCols[i].style.transform = `translateY(${-d}em)`; });
    }

    // a section is "reached" once its top touches the top of the screen
    let cur = 0;
    tops.forEach((t, i) => { if (t <= s + 4) cur = i; });
    if (s >= max - 2) cur = sections.length - 1;

    // names riding the ruler fade out as they arrive at the top dock
    labels.forEach((l, i) => {
      const y = tops[i] - s;
      l.style.opacity = i <= cur ? 0 : Math.min(1, Math.max(0, (y - 20) / 140));
    });

    if (cur !== current) {
      current = cur;
      mapMarks.forEach((m, i) => m.classList.toggle('is-now', i === cur));
      railNow.textContent = names[cur];
      track.setAttribute('aria-valuetext', `${names[cur]}, ${pct} percent`);
    }
    track.setAttribute('aria-valuenow', pct);

    // docks: reached sections stack at the top, the ones still below the screen wait at the bottom
    const reached = names.map((_, i) => i).filter(i => i <= cur).slice(-2);
    const ahead = names.map((_, i) => i).filter(i => i > cur && tops[i] > s + vh - 10).slice(0, 2);
    const key = reached.join() + '|' + ahead.join();
    if (key !== dockKey) {
      dockKey = key;
      syncDock(dockTop, reached, cur);
      syncDock(dockBottom, ahead, -1);
    }
  }

  function syncDock(dock, ids, now) {
    const have = new Map([...dock.children].map(a => [+a.dataset.i, a]));
    have.forEach((a, i) => { if (!ids.includes(i)) a.remove(); });
    ids.forEach((i, k) => {
      let a = have.get(i);
      if (!a) {
        a = document.createElement('a');
        a.href = '#' + sections[i].id;
        a.dataset.i = i;
        a.textContent = names[i];
        a.addEventListener('click', e => { e.preventDefault(); goTo(tops[i]); });
      }
      a.classList.toggle('is-now', i === now);
      if (dock.children[k] !== a) dock.insertBefore(a, dock.children[k] || null);
    });
  }

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  }, { passive: true });

  /* ---------- scrolling helpers ---------- */
  const clampY = y => Math.max(0, Math.min(y, docH - vh));
  function goTo(y) { scrollTo({ top: clampY(y), behavior: reduced ? 'instant' : 'smooth' }); }
  function scrubTo(clientPos) {
    const r = track.getBoundingClientRect();
    const p = (bar ? clientPos.x - r.left : clientPos.y - r.top);
    const f = Math.min(1, Math.max(0, (p - base) / span));
    scrollTo({ top: f * (docH - vh), behavior: 'instant' });
  }

  /* ---------- the tape is a slider: hover to see the map, drag to scrub ---------- */
  let dragging = false, hovering = false;
  const setZoom = () => rail.classList.toggle('is-zoom', !bar && (dragging || hovering || track === document.activeElement));

  track.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hovering = true; setZoom(); } });
  track.addEventListener('pointerleave', () => { hovering = false; setZoom(); });
  track.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragging = true;
    track.setPointerCapture(e.pointerId);
    rail.classList.add('is-drag');
    setZoom();
    scrubTo({ x: e.clientX, y: e.clientY });
  });
  track.addEventListener('pointermove', e => { if (dragging) scrubTo({ x: e.clientX, y: e.clientY }); });
  const endDrag = () => { if (!dragging) return; dragging = false; rail.classList.remove('is-drag'); setZoom(); };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('focus', setZoom);
  track.addEventListener('blur', setZoom);

  track.addEventListener('keydown', e => {
    const step = (docH - vh) / 50;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight') scrollTo({ top: clampY(scrollY + step), behavior: 'instant' });
    else if (k === 'ArrowUp' || k === 'ArrowLeft') scrollTo({ top: clampY(scrollY - step), behavior: 'instant' });
    else if (k === 'PageDown') goTo(tops[Math.min(current + 1, tops.length - 1)]);
    else if (k === 'PageUp') goTo(tops[Math.max(scrollY > tops[current] + 4 ? current : current - 1, 0)]);
    else if (k === 'Home') goTo(0);
    else if (k === 'End') goTo(docH);
    else return;
    e.preventDefault();
  });

  /* ---------- in-page links ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const el = document.querySelector(a.getAttribute('href'));
      if (!el) return;
      e.preventDefault();
      goTo(el.getBoundingClientRect().top + scrollY);
    });
  });

  /* ---------- the parrot switcher ---------- */
  const gifs = [
    { src: 'gifs/parrot.gif', alt: 'A dancing parrot', text: 'Default mode: vibing.' },
    { src: 'gifs/autonomousparrot.gif', alt: 'A party parrot driving a car', text: 'My agent, deploying itself at 3 AM.', px: true },
    { src: 'gifs/coffeeparrot.gif', alt: 'A party parrot drinking coffee', text: 'Exam season fuel.', px: true },
    { src: 'gifs/confusedparrot.gif', alt: 'A confused party parrot', text: 'Reading my own code from last week.', px: true },
    { src: 'gifs/everythingsfineparrot.gif', alt: 'A party parrot sitting in a room on fire', text: 'No, I am not fine.', px: true },
    { src: 'gifs/dealwithitparrot.gif', alt: 'A party parrot putting on sunglasses', text: 'Shipped it anyway.', px: true },
  ];
  const gifBtn = document.getElementById('gif-btn');
  const gifImg = document.getElementById('gif-img');
  const gifText = document.getElementById('gif-text');
  const gifN = document.getElementById('gif-n');
  let gi = 0;
  gifs.slice(1).forEach(g => { const i = new Image(); i.src = g.src; });
  gifBtn.addEventListener('click', () => {
    gi = (gi + 1) % gifs.length;
    const g = gifs[gi];
    gifImg.classList.add('is-swap');
    setTimeout(() => {
      gifImg.src = g.src;
      gifImg.alt = g.alt;
      gifImg.classList.toggle('px', !!g.px);
      gifText.textContent = g.text;
      gifN.textContent = gi + 1;
      gifImg.classList.remove('is-swap');
    }, reduced ? 0 : 150);
  });

  /* ---------- reveal ---------- */
  const groups = new Map();
  document.querySelectorAll('[data-reveal]').forEach(el => {
    const g = el.parentElement;
    const n = groups.get(g) || 0;
    el.style.setProperty('--d', Math.min(n, 6) * 75 + 'ms');
    groups.set(g, n + 1);
  });
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    document.querySelectorAll('[data-reveal], .sec').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('[data-reveal], .sec').forEach(el => el.classList.add('in'));
  }

  /* ---------- start ---------- */
  barMQ.addEventListener('change', build);
  let resizeT;
  new ResizeObserver(() => { clearTimeout(resizeT); resizeT = setTimeout(build, 120); }).observe(document.body);
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(build, 120); });
  build();
  if (document.fonts) document.fonts.ready.then(build);
})();
