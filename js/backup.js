// Backups: download/import a file, or save to and restore from Google Drive.
//
// Drive uses Google's browser sign-in (Google Identity Services) with the
// narrow `drive.file` scope: the app can only see files it created itself.
// It needs an OAuth Client ID — see "Google Drive setup" in the README.
(function () {
  'use strict';
  const L = window.Lofi, U = L.util, P = L.store.PREFIX;
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FOLDER = 'Lofi Focus', JOURNAL_FILE = 'Journal.md', BACKUP_FILE = 'lofi-focus-backup.json';

  const B = {};

  // ---------- local ----------
  // Everything the app stores, except Drive bookkeeping (file ids differ per device).
  B.snapshot = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.startsWith(P) || k.startsWith(P + 'drive')) continue;
      try { data[k.slice(P.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* skip junk */ }
    }
    return { app: 'lofi-focus', version: 1, exported: new Date().toISOString(), data };
  };

  B.restore = (obj) => {
    if (!obj || obj.app !== 'lofi-focus' || !obj.data) throw new Error('That file isn’t a Lofi Focus backup.');
    for (const [k, v] of Object.entries(obj.data)) localStorage.setItem(P + k, JSON.stringify(v));
    location.reload();
  };

  B.downloadJournal = () => U.download(`journal-${U.dayKey()}.md`, L.Journal.markdown(), 'text/markdown');
  B.downloadBackup = () => U.download(`lofi-focus-backup-${U.dayKey()}.json`, JSON.stringify(B.snapshot(), null, 2), 'application/json');
  B.importFile = async (file) => {
    try {
      const obj = JSON.parse(await file.text());
      if (confirm('Replace your current habits, to-dos, journal and settings with this backup?')) B.restore(obj);
    } catch (e) {
      U.toast(e instanceof SyntaxError ? 'That file isn’t valid JSON.' : e.message, 6000);
    }
  };

  // ---------- Google Drive ----------
  B.clientId = () => (L.store.load('googleClientId', '') || (L.config && L.config.googleClientId) || '').trim();
  let gis = null, token = null, tokenExp = 0;

  // Load Google's sign-in script ahead of time so the sign-in popup can open
  // straight from the click (browsers block popups opened after a delay).
  B.preload = () => {
    if (gis || !B.clientId()) return gis;
    gis = new Promise((resolve, reject) => {
      const s = U.el('script', { src: 'https://accounts.google.com/gsi/client', async: true });
      s.onload = resolve;
      s.onerror = () => { gis = null; reject(new Error('Couldn’t load Google sign-in — it may be blocked on this network.')); };
      document.head.append(s);
    });
    return gis;
  };

  function getToken() {
    if (token && Date.now() < tokenExp - 60000) return Promise.resolve(token);
    if (!B.clientId()) return Promise.reject(new Error('Add a Google OAuth Client ID in Settings → Your data first (see the README).'));
    const ask = () => new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: B.clientId(),
        scope: SCOPE,
        callback: (r) => {
          if (r.error) return reject(new Error(`Google sign-in failed: ${r.error_description || r.error}`));
          token = r.access_token;
          tokenExp = Date.now() + r.expires_in * 1000;
          resolve(token);
        },
        error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Google sign-in was closed.' : e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google sign-in popup — allow popups for this site.' : 'Google sign-in failed.')),
      });
      client.requestAccessToken();
    });
    if (window.google && window.google.accounts) return ask();
    return B.preload().then(ask);
  }

  async function api(method, url, { body, headers = {}, raw = false } = {}) {
    const res = await fetch(url, { method, body, headers: { Authorization: `Bearer ${await getToken()}`, ...headers } });
    if (res.status === 401) { token = null; }
    if (!res.ok) {
      const err = new Error(`Google Drive error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return raw ? res.text() : res.json();
  }

  async function folderId() {
    const saved = L.store.load('driveFolder', null);
    if (saved) {
      try {
        const f = await api('GET', `https://www.googleapis.com/drive/v3/files/${saved}?fields=id,trashed`);
        if (!f.trashed) return saved;
      } catch (e) { if (e.status !== 404) throw e; }
    }
    const f = await api('POST', 'https://www.googleapis.com/drive/v3/files', {
      body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
      headers: { 'Content-Type': 'application/json' },
    });
    L.store.save('driveFolder', f.id);
    return f.id;
  }

  // Create the file the first time, then keep updating the same one.
  async function upsert(name, mime, content, key, parent) {
    const boundary = 'lofi' + U.uid();
    const multipart = (meta) => [
      `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(meta),
      `--${boundary}`, `Content-Type: ${mime}; charset=UTF-8`, '', content, `--${boundary}--`,
    ].join('\r\n');
    const headers = { 'Content-Type': `multipart/related; boundary=${boundary}` };
    const id = L.store.load(key, null);
    if (id) {
      try {
        return await api('PATCH', `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`, { body: multipart({ name }), headers });
      } catch (e) { if (e.status !== 404) throw e; }
    }
    const f = await api('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { body: multipart({ name, mimeType: mime, parents: [parent] }), headers });
    L.store.save(key, f.id);
    return f;
  }

  let busy = false;
  B.saveToDrive = async () => {
    if (busy) return;
    busy = true;
    B.renderStatus('Saving to Google Drive…');
    try {
      const parent = await folderId();
      await upsert(JOURNAL_FILE, 'text/markdown', L.Journal.markdown(), 'driveJournalId', parent);
      await upsert(BACKUP_FILE, 'application/json', JSON.stringify(B.snapshot(), null, 2), 'driveBackupId', parent);
      L.store.save('driveLastSync', Date.now());
      U.toast(`Saved to Google Drive → “${FOLDER}” folder`);
    } catch (e) {
      U.toast(e.message, 7000);
    } finally {
      busy = false;
      B.renderStatus();
    }
  };

  B.restoreFromDrive = async () => {
    try {
      let id = L.store.load('driveBackupId', null);
      if (!id) { // e.g. on a new computer: find the backup this app saved before
        const q = encodeURIComponent(`name='${BACKUP_FILE}' and trashed=false`);
        const found = await api('GET', `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&fields=files(id,modifiedTime)`);
        if (!found.files.length) return U.toast('No Lofi Focus backup found in your Google Drive yet.', 6000);
        id = found.files[0].id;
      }
      const obj = JSON.parse(await api('GET', `https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { raw: true }));
      const when = new Date(obj.exported).toLocaleString();
      if (confirm(`Restore the Google Drive backup from ${when}? This replaces what’s in this browser.`)) {
        L.store.save('driveBackupId', id);
        B.restore(obj);
      }
    } catch (e) {
      U.toast(e.message, 7000);
    }
  };

  B.renderStatus = (msg) => {
    const last = L.store.load('driveLastSync', null);
    const text = msg || (last ? `Last saved to Drive ${new Date(last).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : B.clientId() ? 'Not saved to Drive yet' : null);
    U.$$('.j-sync').forEach((e) => { e.textContent = text || 'Google Drive isn’t set up yet — see Settings → Your data'; });
    U.$$('.drive-status').forEach((e) => { e.textContent = text || 'Add your Client ID under “Google Drive setup” to turn this on.'; });
  };

  L.Backup = B;
})();
