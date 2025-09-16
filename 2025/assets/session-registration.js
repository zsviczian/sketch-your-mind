(function () {
  function relPageLink() {
    const path = window.location.pathname || '';
    const idx = path.indexOf('/2025/');
    let rel = idx >= 0 ? path.slice(idx + 6) : path; // after "/2025/"
    rel = rel.replace(/^\/+/, '').replace(/index\.html?$/i, '').replace(/\/$/, '');
    return rel || '';
  }

  function findSession(rel) {
    const sessionsByDay = (window.SESSIONS || {});
    let found = null;

    const dayKeys = Object.keys(sessionsByDay).sort((a, b) => Number(a) - Number(b));
    outer: for (const dayKey of dayKeys) {
      const day = sessionsByDay[dayKey] || {};
      const slotKeys = Object.keys(day).sort((a, b) => Number(a) - Number(b));
      for (const slotKey of slotKeys) {
        const s = day[slotKey];
        if (!s || !s.link) continue;
        if (rel === s.link || rel.startsWith(s.link)) {
          found = { dayKey: Number(dayKey), slotKey: Number(slotKey), session: s };
          break outer;
        }
      }
    }
    return found;
  }

  function computeSessionStart(base, dayIndex, slotIndex) {
    // slotIndex: 1-based; slots are 1h long with 30m breaks => 90m steps
    const start = new Date(base);
    const startDay = window.addDays ? window.addDays(start, dayIndex) : new Date(start.getTime() + dayIndex * 24 * 60 * 60 * 1000);
    const minutesOffset = (Number(slotIndex) - 1) * 90;
    return new Date(startDay.getTime() + minutesOffset * 60 * 1000);
  }

  function formatDateRange(start, end) {
    const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const startStr = start.toLocaleString(undefined, opts);
    const endStr = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${startStr} – ${endStr}`;
  }

  function buildSectionContent(info) {
    const section = document.createElement('section');
    section.className = 'section-card';
    section.setAttribute('aria-labelledby', 'session-time-title');

    const h2 = document.createElement('h2');
    h2.id = 'session-time-title';
    h2.className = 'section-title';
    h2.textContent = 'Session Time & Registration';
    section.appendChild(h2);

    if (!info) {
      const p = document.createElement('p');
      p.textContent = 'Session details are not available for this page.';
      section.appendChild(p);
      return section;
    }

    const { start, end, zoomLink } = info;

    const pTime = document.createElement('p');
    pTime.className = 'session-time';
    pTime.textContent = `Session time: ${formatDateRange(start, end)} (1 hour)`;
    section.appendChild(pTime);

    const pTz = document.createElement('p');
    pTz.className = 'tz-message';
    // timeZoneMessage returns HTML with a <br>
    pTz.innerHTML = (typeof window.timeZoneMessage === 'function') ? window.timeZoneMessage() : '';
    section.appendChild(pTz);

    const btn = document.createElement('button');
    btn.className = 'register-button';
    const REG_OPEN = new Date(2025, 8, 20); // Sat, 20 Sep 2025 (local)
    const now = new Date();
    const hasLink = typeof zoomLink === 'string' && zoomLink.trim().length > 0;
    const isOpen = now >= REG_OPEN;

    if (hasLink && isOpen) {
      btn.textContent = 'Register on Zoom';
      btn.addEventListener('click', () => window.open(zoomLink, '_blank', 'noopener'));
    } else {
      btn.disabled = true;
      if (!hasLink) {
        btn.textContent = 'Registration unavailable';
        btn.title = 'Zoom registration link is not available yet.';
      } else {
        btn.textContent = 'Registration opens Sat, 20 Sep';
        btn.title = 'Registration not open yet.';
        const note = document.createElement('p');
        note.style.marginTop = '0.5rem';
        note.textContent = 'Registration opens on Saturday, 20 September.';
        section.appendChild(note);
      }
    }

    section.appendChild(btn);
    return section;
  }

  function insertAfterAuthor(sectionEl) {
    // Support multiple author sections: insert after the last one.
    const authorTitles = Array.from(document.querySelectorAll('#author-title'));
    if (!authorTitles.length) return false;

    let lastSection = null;
    for (const titleEl of authorTitles) {
      const sec = titleEl.closest('section') || titleEl;
      if (sec) lastSection = sec;
    }
    if (!lastSection) return false;
    lastSection.insertAdjacentElement('afterend', sectionEl);
    return true;
  }

  function init() {
    if (!window.CONFERENCE_START || !window.SESSIONS) return;

    const rel = relPageLink();
    const found = findSession(rel);

    let info = null;
    if (found) {
      const start = computeSessionStart(window.CONFERENCE_START, found.dayKey, found.slotKey);
      const end = (typeof window.addHours === 'function') ? window.addHours(start, 1) : new Date(start.getTime() + 60 * 60 * 1000);
      info = {
        start,
        end,
        zoomLink: found.session.zoomLink
      };
    }

    const section = buildSectionContent(info);
    if (!insertAfterAuthor(section)) {
      // Fallback: insert before the back link if author section not found
      const backLink = document.querySelector('a.back-link');
      if (backLink && backLink.parentNode) {
        backLink.parentNode.insertBefore(section, backLink);
      } else {
        document.body.appendChild(section);
      }
    }
  }

  // If included at end of body, DOM is ready; still guard for safety.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
