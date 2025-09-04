(function () {
  const STYLE_ID = 'sym-photo-scroller-style';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .sym-photo-scroller{position:relative;overflow:hidden;width:100%;user-select:none;-webkit-user-select:none;touch-action:pan-y}
      .sym-photo-scroller .sym-track{display:flex;align-items:center;gap:var(--gap,16px);will-change:transform;animation-timing-function:linear;animation-iteration-count:infinite;cursor:grab}
      .sym-photo-scroller.dragging .sym-track{cursor:grabbing}
      .sym-photo-scroller[data-dir="left"] .sym-track{animation-name:sym-scroll-left}
      .sym-photo-scroller[data-dir="right"] .sym-track{animation-name:sym-scroll-right}
      .sym-photo-scroller .sym-segment{display:flex;align-items:center;gap:var(--gap,16px)}
      .sym-photo-item{display:flex;flex-direction:column;align-items:center;justify-content:center}
      .sym-photo-item img{width:var(--size,128px);height:var(--size,128px);object-fit:cover;border-radius:var(--radius,50%);display:block;background:#efefef}
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
    const fromGlobal = (typeof window !== 'undefined' && window.scrollerOptions) || {};
    const fromData = {
      speed: root.dataset.speed ? Number(root.dataset.speed) : undefined,
      gap: root.dataset.gap ? Number(root.dataset.gap) : undefined,
      imgSize: root.dataset.imgSize ? Number(root.dataset.imgSize) : undefined,
      direction: root.dataset.direction,
      pauseOnHover: root.dataset.pauseOnHover ? root.dataset.pauseOnHover === 'true' : undefined,
      borderRadius: root.dataset.borderRadius
    };
    return { ...defaults}; //, ...fromGlobal, ...Object.fromEntries(Object.entries(fromData).filter(([,v]) => v !== undefined)) };
  }

  function buildItem({ photo, name }) {
    const item = document.createElement('div');
    item.className = 'sym-photo-item';
    const img = document.createElement('img');
    img.alt = name || 'Presenter';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = photo;
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
      // matrix3d(m1,...,m16) where tx = m13? Actually tx is m13? In 3d, tx is m13? More robustly create DOMMatrix
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

  function initScroller(mountEl, content, opts) {
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
    content.forEach(item => seg1.appendChild(buildItem(item)));

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

    // Drag to control position, resume from that point
    let dragging = false;
    let startX = 0;
    let startTranslate = 0;

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return; // only primary button
      if (!metrics.segWidth) recalc();
      if (!metrics.segWidth) return;

      // Ensure it continues after release even if hovered
      wrapper.classList.remove('paused');

      // Freeze at current frame and switch to manual transform
      const current = getTranslateX(track);
      track.style.animationName = 'none';
      track.style.transform = `translateX(${current}px)`;

      dragging = true;
      startX = e.clientX;
      startTranslate = current;
      wrapper.classList.add('dragging');
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const proposed = startTranslate + dx;
      const x = normalizeTranslate(proposed, metrics.distance);
      track.style.transform = `translateX(${x}px)`;
    }

    function onPointerUp(e) {
      if (!dragging) return;
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
    }

    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', onPointerUp);
    track.addEventListener('pointercancel', onPointerUp);
  }

  function boot() {
    ensureStyles();
    const content = readContent();
    const mounts = document.querySelectorAll('.photoscroller');
    mounts.forEach(el => {
      const opts = readOptions(el);
      initScroller(el, content, opts);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
