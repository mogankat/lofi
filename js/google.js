// Google sign-in shared by Drive backups and Google Calendar.
//
// Uses Google Identity Services' token model: the browser gets a short-lived
// (1 hour) access token straight from Google — no server, and nothing secret
// is stored. It needs an OAuth Client ID; see "Google setup" in the README.
(function () {
  'use strict';
  const L = window.Lofi, U = L.util;
  const G = {};
  let gis = null, token = null, expires = 0, granted = new Set();
  const tokenListeners = [];
  G.onToken = (fn) => tokenListeners.push(fn); // after every successful sign-in

  G.clientId = () => (L.store.load('googleClientId', '') || (L.config && L.config.googleClientId) || '').trim();

  // Load Google's script ahead of time so the sign-in popup can open straight
  // from a click (browsers block popups that open after a delay).
  G.preload = () => {
    if (gis || !G.clientId()) return gis;
    gis = new Promise((resolve, reject) => {
      const s = U.el('script', { src: 'https://accounts.google.com/gsi/client', async: true });
      s.onload = resolve;
      s.onerror = () => { gis = null; reject(new Error('Couldn’t load Google sign-in — it may be blocked on this network.')); };
      document.head.append(s);
    });
    return gis;
  };

  G.hasToken = (scope) => !!token && Date.now() < expires - 60000 && granted.has(scope);

  // Get a token that includes `scope`. Call from a click handler. `also`: more
  // permissions to ask for in the same popup (optional: they can be unticked).
  // Anything granted before comes back too (include_granted_scopes).
  let pending = null; // one popup at a time; everyone waiting shares it
  G.token = (scope, also = []) => {
    if (G.hasToken(scope)) return Promise.resolve(token);
    if (!G.clientId()) {
      window.open('google-setup.html', '_blank', 'noopener');
      return Promise.reject(new Error('Google isn’t set up yet. The setup guide opened in a new tab. Paste your Client ID there or in Settings → Google.'));
    }
    const ask = () => new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: G.clientId(),
        scope: [scope, ...also].join(' '),
        include_granted_scopes: true,
        callback: (r) => {
          if (r.error) return reject(new Error(`Google sign-in failed: ${r.error_description || r.error}`));
          token = r.access_token;
          expires = Date.now() + r.expires_in * 1000;
          granted = new Set((r.scope || '').split(' '));
          resolve();
          setTimeout(() => tokenListeners.forEach((fn) => fn()), 0);
        },
        error_callback: (e) => reject(new Error(
          e.type === 'popup_closed' ? 'Google sign-in was closed.'
            : e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google sign-in popup — allow popups for this site.'
              : 'Google sign-in failed.')),
      });
      client.requestAccessToken();
    });
    if (!pending) {
      pending = window.google && window.google.accounts ? ask() : G.preload().then(ask);
      const done = () => { pending = null; };
      pending.then(done, done);
    }
    return pending.then(() => {
      if (!granted.has(scope)) throw new Error('Google access wasn’t granted — tick the permission box in the sign-in window.');
      return token;
    });
  };

  // fetch() with the token attached. Errors carry .status.
  G.fetch = async (scope, method, url, { body, headers = {}, raw = false } = {}) => {
    const res = await fetch(url, { method, body, headers: { Authorization: `Bearer ${await G.token(scope)}`, ...headers } });
    if (res.status === 401) token = null;
    if (!res.ok) {
      const err = new Error(`Google error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return raw ? res.text() : res.json();
  };

  G.signOut = () => {
    if (token && window.google && window.google.accounts) window.google.accounts.oauth2.revoke(token, () => {});
    token = null; expires = 0; granted = new Set();
  };

  L.Google = G;
})();
