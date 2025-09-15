(function () {
  const STYLE_ID = 'sym-photo-scroller-style';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .sym-photo-scroller{padding-bottom: 2em;position:relative;overflow:hidden;width:100%;user-select:none;-webkit-user-select:none;touch-action:pan-y}
      .sym-photo-scroller .sym-track{display:flex;align-items:center;gap:var(--gap,16px);will-change:transform;animation-timing-function:linear;animation-iteration-count:infinite;cursor:grab}
      .sym-photo-scroller.dragging .sym-track{cursor:grabbing}
      .sym-photo-scroller[data-dir="left"] .sym-track{animation-name:sym-scroll-left}
      .sym-photo-scroller[data-dir="right"] .sym-track{animation-name:sym-scroll-right}
      .sym-photo-scroller .sym-segment{display:flex;align-items:center;gap:var(--gap,16px)}
      .sym-photo-item{display:flex;flex-direction:column;align-items:center;justify-content:center}
      .sym-photo-item img{width:var(--size,128px);height:var(--size,128px);object-fit:cover;border-radius:var(--radius,50%);display:block;background:#efefef;cursor:pointer;transition:transform .15s ease}
      .sym-photo-item img:hover{transform:scale(1.03)}
      .sym-photo-item .sym-caption{font-size:.8rem;margin-top:6px;white-space:nowrap;color:#FFF6F0}
      .sym-photo-scroller.paused .sym-track{animation-play-state:paused}
      @keyframes sym-scroll-left{from{transform:translateX(0)}to{transform:translateX(var(--distance,-2000px))}}
      @keyframes sym-scroll-right{from{transform:translateX(var(--distance,-2000px))}to{transform:translateX(0)}}
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function readContent() {
    try {
      if (typeof window !== 'undefined' && Array.isArray(window.scrollerContent)) return window.scrollerContent;
      // eslint-disable-next-line no-undef
      if (typeof scrollerContent !== 'undefined' && Array.isArray(scrollerContent)) return scrollerContent;
    } catch (_) {}
    return [];
  }

  function readOptions(root) {
    const defaults = {
      speed: 30,       // pixels per second
      gap: 16,         // px
      imgSize: 128,     // px
      direction: 'left',
      pauseOnHover: true,
      borderRadius: '50%' // circle by default
    };
    return { ...defaults};
  }

  // Normalize names for robust matching (case/diacritics/whitespace)
  function normalizeName(s) {
    if(!s) return '';
    return s.split("<br>").map(part => part
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
    );
  } 

  // Build presenter => [titles] index from window.SESSIONS
  function buildSessionsIndex() {
    const index = {};
    try {
      const data = (typeof window !== 'undefined' && window.SESSIONS) || {};
      Object.keys(data).forEach(day => {
        const slots = data[day] || {};
        Object.keys(slots).forEach(slot => {
          const s = slots[slot];
          if (!s || !s.presenter || !s.title) return;
          const keys = normalizeName(s.presenter);
          keys.forEach(key =>
            (index[key] ||= []).push(s.title)
          );
        });
      });
    } catch (_) {}
    return index;
  }

  function buildItem({ photo, name }, titlesByPresenter) {
    const item = document.createElement('div');
    item.className = 'sym-photo-item';
    const img = document.createElement('img');
    img.alt = name || 'Presenter';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = photo;
    img.draggable = false; // avoid native drag ghost interfering with tap detection

    const names = normalizeName(name);
    const titles = [];
    names.forEach(norm => {
      const ts = titlesByPresenter[norm] || [];
      titles.push(...ts);
    });
    if (titles.length) {
      img.title = titles.join('\n');
      img.setAttribute('aria-label', `${name}: ${titles.join(', ')}`);
    } else {
      img.title = name || '';
    }

    const cap = document.createElement('div');
    cap.className = 'sym-caption';
    cap.textContent = name || '';
    // Fallback if image fails
    img.addEventListener('error', () => { img.style.background = '#ddd'; img.style.objectFit = 'contain'; img.src = ''; });
    item.appendChild(img);
    item.appendChild(cap);
    return item;
  }

  // Helper: read current translateX (px) from computed transform matrix
  function getTranslateX(el) {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    // matrix(a,b,c,d,tx,ty) or matrix3d(...)
    if (t.startsWith('matrix3d(')) {
      try { return new DOMMatrixReadOnly(t).m41 || 0; } catch (_) { /* fallback below */ }
    }
    const m = t.match(/matrix\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(',').map(Number);
      return parts[4] || 0;
    }
    try { return new DOMMatrixReadOnly(t).m41 || 0; } catch (_) { return 0; }
  }

  // Helper: wrap a translateX into the single-loop range
  function normalizeTranslate(x, distance) {
    const minX = Math.min(0, distance);
    const range = Math.abs(distance) || 1;
    // wrap into [minX, minX+range)
    return ((x - minX) % range + range) % range + minX;
  }

  function measureAndAnimate(wrapper, track, segment, speed, direction) {
    // Measure the width of a single segment (one full copy of items)
    const segWidth = segment.getBoundingClientRect().width;
    if (segWidth === 0) return { segWidth: 0, distance: 0, duration: 0 };

    const distance = direction === 'left' ? -segWidth : segWidth;
    track.style.setProperty('--distance', `${distance}px`);
    const duration = Math.max(0.001, segWidth / Math.max(1, speed)); // seconds
    track.style.animationDuration = `${duration}s`;
    return { segWidth, distance, duration };
  }

  function highlightPresenter(name) {
    const norm = normalizeName(name);
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // Smooth scroll to the agenda
    calendarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // After scrolling starts, highlight matching sessions
    const doHighlight = () => {
      const presenterEls = Array.from(document.querySelectorAll('.session-presenter'));
      const targets = presenterEls
        .filter(el => normalizeName(el.innerHTML).includes(norm[0]))
        .map(el => el.closest('.fc-event, .fc-list-event'))
        .filter(Boolean);

      targets.forEach(el => {
        el.classList.remove('flash-highlight');
        // restart animation
        void el.offsetWidth;
        el.classList.add('flash-highlight');
        setTimeout(() => { if (el) el.classList.remove('flash-highlight'); }, 3500);
      });

      if (targets[0]) {
        // Ensure the first highlighted event is in view
        targets[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    // small delay to allow scroll and potential layout adjustments
    setTimeout(doHighlight, 350);
  }

  function initScroller(mountEl, content, opts, titlesByPresenter) {
    if (!content || !content.length) {
      // No content; leave the original element in place but hide it
      mountEl.style.display = 'none';
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'sym-photo-scroller';
    wrapper.setAttribute('aria-label', 'Presenters');
    wrapper.dataset.dir = (opts.direction === 'right') ? 'right' : 'left';
    wrapper.style.setProperty('--gap', `${opts.gap}px`);
    wrapper.style.setProperty('--size', `${opts.imgSize}px`);
    wrapper.style.setProperty('--radius', opts.borderRadius);

    const track = document.createElement('div');
    track.className = 'sym-track';

    // Build one segment with all items
    const seg1 = document.createElement('div');
    seg1.className = 'sym-segment';
    content.forEach(item => seg1.appendChild(buildItem(item, titlesByPresenter)));

    // Duplicate the segment for seamless loop
    const seg2 = seg1.cloneNode(true);

    track.appendChild(seg1);
    track.appendChild(seg2);
    wrapper.appendChild(track);

    // Replace the mount
    mountEl.replaceWith(wrapper);

    // Pause on hover
    if (opts.pauseOnHover) {
      wrapper.addEventListener('mouseenter', () => wrapper.classList.add('paused'));
      wrapper.addEventListener('mouseleave', () => wrapper.classList.remove('paused'));
    }

    // Compute metrics and start animation
    let metrics = { segWidth: 0, distance: 0, duration: 0 };
    const recalc = () => {
      metrics = measureAndAnimate(wrapper, track, seg1, opts.speed, wrapper.dataset.dir);
    };
    // Initial async to ensure in DOM
    requestAnimationFrame(recalc);
    // Recompute on resize
    window.addEventListener('resize', recalc);
    // Save CPU when tab hidden
    document.addEventListener('visibilitychange', () => {
      track.style.animationPlayState = document.hidden ? 'paused' : 'running';
    });

    // Drag-to-scroll with tap detection to trigger highlight reliably (works for cloned nodes too)
    let isPointerDown = false;
    let dragging = false;
    let startX = 0;
    let startTranslate = 0;
    let downImgName = null;
    let lastTriggerTs = 0;
    const DRAG_THRESHOLD = 5; // px

    function triggerHighlightOnce(name) {
      const now = Date.now();
      if (now - lastTriggerTs < 250) return; // debounce double fire from pointer+click
      lastTriggerTs = now;
      highlightPresenter(name);
    }

    function nameFromTarget(target) {
      const img = target && target.closest ? target.closest('.sym-photo-item img') : null;
      if (!img) return null;
      const cap = img.parentElement && img.parentElement.querySelector ? img.parentElement.querySelector('.sym-caption') : null;
      const name = (cap && cap.textContent) || img.alt || '';
      return name.trim() || null;
    }

    function nameFromPoint(x, y) {
      const el = document.elementFromPoint(x, y);
      return nameFromTarget(el);
    }

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return; // only primary button
      isPointerDown = true;
      dragging = false;
      startX = e.clientX;
      startTranslate = getTranslateX(track);
      downImgName = nameFromTarget(e.target);
    }

    function onPointerMove(e) {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) > DRAG_THRESHOLD) {
        if (!metrics.segWidth) recalc();
        const current = getTranslateX(track);
        track.style.animationName = 'none';
        track.style.transform = `translateX(${current}px)`;
        dragging = true;
        downImgName = null; // do not treat as a tap anymore
        wrapper.classList.add('dragging');
        try { track.setPointerCapture(e.pointerId); } catch (_) {}
      }
      if (dragging) {
        const proposed = startTranslate + dx;
        const x = normalizeTranslate(proposed, metrics.distance);
        track.style.transform = `translateX(${x}px)`;
        e.preventDefault();
      }
    }

    function onPointerUp(e) {
      if (!isPointerDown) return;
      isPointerDown = false;

      if (dragging) {
        dragging = false;
        try { track.releasePointerCapture(e.pointerId); } catch (_) {}
        const x = getTranslateX(track);
        const d = metrics.distance;
        const dur = metrics.duration || 0.001;

        // Compute progress along the current keyframes [0..1)
        let p;
        if (d < 0) {
          // from 0 to d (negative)
          p = x / d;
        } else {
          // from d (positive) to 0
          p = 1 - (x / d);
        }
        // normalize to [0,1)
        p = ((p % 1) + 1) % 1;

        // Restore CSS animation and jump to the right progress using negative delay
        track.style.transform = '';
        track.style.animationName = ''; // re-enable the CSS-defined animation-name
        track.style.animationDelay = `-${p * dur}s`;
        wrapper.classList.remove('dragging');
      } else {
        // Treat as a tap/click; if we didn't capture the name on down (due to movement), resolve by point now
        const resolvedName = downImgName || nameFromPoint(e.clientX, e.clientY);
        if (resolvedName) {
          triggerHighlightOnce(resolvedName);
        }
      }
      downImgName = null;
    }

    // Delegated click fallback to catch cases where pointer events may not fire as expected
    track.addEventListener('click', (e) => {
      const name = nameFromTarget(e.target);
      if (!name) return;
      triggerHighlightOnce(name);
    });

    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', onPointerUp);
    track.addEventListener('pointercancel', onPointerUp);
    // Also listen at window level so we still get pointerup if the animated track moves under the pointer
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function boot() {
    ensureStyles();
    const content = readContent();
    const titlesByPresenter = buildSessionsIndex();
    const mounts = document.querySelectorAll('.photoscroller');
    mounts.forEach(el => {
      const opts = readOptions();
      initScroller(el, content, opts, titlesByPresenter);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
