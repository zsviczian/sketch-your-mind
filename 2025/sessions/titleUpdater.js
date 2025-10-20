(function() {
  function normalizePath() {
    const path = window.location.pathname; // e.g. /2025/sessions/jorge/  or /2025/sessions/jorge/index.html
    const parts = path.split('/').filter(Boolean);
    const sessionsIdx = parts.indexOf('sessions');
    if (sessionsIdx === -1 || sessionsIdx === parts.length - 1) return null;
    // slug is the segment right after 'sessions'
    const slug = parts[sessionsIdx + 1];
    if (!slug) return null;
    return `sessions/${slug}`;
  }

  function findSessionData(linkKey) {
    if (!window.SESSIONS) return null;
    for (const dayKey in window.SESSIONS) {
      const day = window.SESSIONS[dayKey];
      for (const sessionKey in day) {
        const session = day[sessionKey];
        if (session && session.link === linkKey) {
          return session;
        }
      }
    }
    return null;
  }

  function updateTitles(session) {
    const h1 = document.querySelector('h1.session-title');
    const p = document.querySelector('p.session-subtitle');
    if (h1 && session.title) h1.innerText = session.title;
    if (p && session.subTitle) p.innerText = session.subTitle;
  }

  function init() {
    // New: always initialize the font toggle
    createFontToggle();

    // Existing: update session title/subtitle if available
    const key = normalizePath();
    if (key) {
      const session = findSessionData(key);
      if (session) updateTitles(session);
    }
  }

  // New: Font toggle (Excalifont <-> Arial)
  const FONT_KEY = 'sym-font';

  function injectFontToggleStyles() {
    if (document.getElementById('font-toggle-styles')) return;
    const style = document.createElement('style');
    style.id = 'font-toggle-styles';
    style.textContent = `
:root.font-readable body,
:root.font-readable #calendar-title,
:root.font-readable #calendar * {
  font-family: Arial, sans-serif !important;
}

#sym-font-toggle {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 9999;
  background: #FFC857;
  color: #0D2B2F;
  border: 2px solid rgba(13,43,47,0.2);
  border-radius: 999px;
  padding: 6px 10px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,0.25);
}
#sym-font-toggle:hover { background: #FFD680; }
    `;
    document.head.appendChild(style);
  }

  function applySavedFontPreference() {
    const pref = localStorage.getItem(FONT_KEY) || 'hand';
    if (pref === 'readable') {
      document.documentElement.classList.add('font-readable');
    } else {
      document.documentElement.classList.remove('font-readable');
    }
    const btn = document.getElementById('sym-font-toggle');
    if (btn) btn.setAttribute('aria-pressed', pref === 'readable' ? 'true' : 'false');
  }

  function createFontToggle() {
    if (document.getElementById('sym-font-toggle')) return;
    injectFontToggleStyles();
    const btn = document.createElement('button');
    btn.id = 'sym-font-toggle';
    btn.type = 'button';
    btn.title = 'Toggle font: Hand-drawn / Readable';
    btn.setAttribute('aria-label', 'Toggle font');
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = 'Aa';
    btn.addEventListener('click', () => {
      const isReadable = document.documentElement.classList.toggle('font-readable');
      localStorage.setItem(FONT_KEY, isReadable ? 'readable' : 'hand');
      btn.setAttribute('aria-pressed', isReadable ? 'true' : 'false');
    });
    document.body.appendChild(btn);
    applySavedFontPreference();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
