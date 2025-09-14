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
    const key = normalizePath();
    if (!key) return;
    const session = findSessionData(key);
    if (session) updateTitles(session);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
