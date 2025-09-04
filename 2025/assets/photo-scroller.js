(function () {
  const STYLE_ID = 'sym-photo-scroller-style';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .sym-photo-scroller{position:relative;overflow:hidden;width:100%;}
      .sym-photo-scroller .sym-track{display:flex;align-items:center;gap:var(--gap,16px);will-change:transform;animation-timing-function:linear;animation-iteration-count:infinite}
      .sym-photo-scroller[data-dir="left"] .sym-track{animation-name:sym-scroll-left}
      .sym-photo-scroller[data-dir="right"] .sym-track{animation-name:sym-scroll-right}
      .sym-photo-scroller .sym-segment{display:flex;align-items:center;gap:var(--gap,16px)}
      .sym-photo-item{display:flex;flex-direction:column;align-items:center;justify-content:center}
      .sym-photo-item img{width:var(--size,64px);height:var(--size,64px);object-fit:cover;border-radius:var(--radius,50%);display:block;background:#efefef}
      .sym-photo-item .sym-caption{font-size:.8rem;margin-top:6px;white-space:nowrap;color:#333}
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
    return { ...defaults, ...fromGlobal, ...Object.fromEntries(Object.entries(fromData).filter(([,v]) => v !== undefined)) };
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

  function measureAndAnimate(wrapper, track, segment, speed, direction) {
    // Measure the width of a single segment (one full copy of items)
    const segWidth = segment.getBoundingClientRect().width;
    if (segWidth === 0) return;

    const distance = direction === 'left' ? -segWidth : segWidth;
    track.style.setProperty('--distance', `${distance}px`);
    const duration = Math.max(0.001, segWidth / Math.max(1, speed)); // seconds
    track.style.animationDuration = `${duration}s`;
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
    const recalc = () => measureAndAnimate(wrapper, track, seg1, opts.speed, wrapper.dataset.dir);
    // Initial async to ensure in DOM
    requestAnimationFrame(recalc);
    // Recompute on resize
    window.addEventListener('resize', recalc);
    // Save CPU when tab hidden
    document.addEventListener('visibilitychange', () => {
      track.style.animationPlayState = document.hidden ? 'paused' : 'running';
    });
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
