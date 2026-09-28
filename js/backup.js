// Backups: download/import a file, or save to and restore from Google Drive.
//
// Everything the app keeps is backed up: journal, to-do lists, habits and their
// check-offs, countdowns, focus history, stations, sound mix and settings.
// Drive uses the narrow `drive.file` scope, so the app can only see the files
// it created itself.
(function () {
  'use strict';
  const L = window.Lofi, U = L.util, P = L.store.PREFIX;
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FOLDER = 'Lofi Focus';
  const FILES = {
    backup: { name: 'lofi-focus-backup.json', mime: 'application/json', key: 'driveBackupId' },
    journal: { name: 'Journal.md', mime: 'text/markdown', key: 'driveJournalId' },
    todos: { name: 'To-do.md', mime: 'text/markdown', key: 'driveTodosId' },
    habits: { name: 'Habits.md', mime: 'text/markdown', key: 'driveHabitsId' },
  };

  const B = { SCOPE };
  B.WHAT = 'journal, to-do lists, habits, countdowns, focus history, stations, sound mix and settings';

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

  // Readable copies for looking at in Drive (the JSON is what restores).
  B.todosMarkdown = () => {
    const data = L.store.load('todos', { lists: [] });
    return ['# To-do lists', '', ...data.lists.flatMap((l) => [
      `## ${l.name}`, '',
      ...(l.items.length ? l.items.map((it, i) => `${i + 1}. [${it.done ? 'x' : ' '}] ${it.text}${it.done && it.doneAt ? ` _(done ${it.doneAt})_` : ''}`) : ['_Empty_']),
      '',
    ])].join('\n');
  };
  B.habitsMarkdown = () => {
    const days = Array.from({ length: 14 }, (_, i) => U.addDays(new Date(), i - 13));
    const lines = ['# Habits', '', `Last two weeks, oldest → newest (${U.fmtDate(days[0])} – ${U.fmtDate(days[13])}). ✓ = done.`, ''];
    L.Habits.list().forEach((h, i) => {
      const marks = days.map((d) => (L.Habits.isDone(h.id, U.dayKey(d)) ? '✓' : '·')).join(' ');
      lines.push(`${i + 1}. **${h.name}** — ${marks} — streak ${L.Habits.streak(h.id)} day(s)`);
    });
    if (!L.Habits.list().length) lines.push('_No habits yet._');
    return lines.join('\n') + '\n';
  };

  B.downloadJournal = () => U.download(`journal-${U.dayKey()}.md`, L.Journal.markdown(), 'text/markdown');
  B.downloadBackup = () => U.download(`lofi-focus-backup-${U.dayKey()}.json`, JSON.stringify(B.snapshot(), null, 2), 'application/json');
  B.importFile = async (file) => {
    try {
      const obj = JSON.parse(await file.text());
      if (confirm(`Replace what’s in this browser (${B.WHAT}) with this backup?`)) B.restore(obj);
    } catch (e) {
      U.toast(e instanceof SyntaxError ? 'That file isn’t valid JSON.' : e.message, 6000);
    }
  };

  // ---------- Google Drive ----------
  const api = (method, url, opts) => L.Google.fetch(SCOPE, method, url, opts);
  B.clientId = () => L.Google.clientId();
  B.preload = () => L.Google.preload();

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
  async function upsert(file, content, parent) {
    const boundary = 'lofi' + U.uid();
    const multipart = (meta) => [
      `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(meta),
      `--${boundary}`, `Content-Type: ${file.mime}; charset=UTF-8`, '', content, `--${boundary}--`,
    ].join('\r\n');
    const headers = { 'Content-Type': `multipart/related; boundary=${boundary}` };
    const id = L.store.load(file.key, null);
    if (id) {
      try {
        return await api('PATCH', `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`, { body: multipart({ name: file.name }), headers });
      } catch (e) { if (e.status !== 404) throw e; }
    }
    const f = await api('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { body: multipart({ name: file.name, mimeType: file.mime, parents: [parent] }), headers });
    L.store.save(file.key, f.id);
    return f;
  }

  let busy = false;
  B.saveToDrive = async ({ quiet = false } = {}) => {
    if (busy) return;
    busy = true;
    B.renderStatus('Saving to Google Drive…');
    try {
      const parent = await folderId();
      await upsert(FILES.backup, JSON.stringify(B.snapshot(), null, 2), parent);
      await upsert(FILES.journal, L.Journal.markdown(), parent);
      await upsert(FILES.todos, B.todosMarkdown(), parent);
      await upsert(FILES.habits, B.habitsMarkdown(), parent);
      L.store.save('driveLastSync', Date.now());
      if (!quiet) U.toast(`Saved to Google Drive → “${FOLDER}” folder (${B.WHAT})`, 6000);
    } catch (e) {
      if (!quiet) U.toast(e.message, 7000);
    } finally {
      busy = false;
      B.renderStatus();
    }
  };

  B.restoreFromDrive = async () => {
    try {
      let id = L.store.load(FILES.backup.key, null);
      if (!id) { // e.g. on a new computer: find the backup this app saved before
        const q = encodeURIComponent(`name='${FILES.backup.name}' and trashed=false`);
        const found = await api('GET', `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&fields=files(id,modifiedTime)`);
        if (!found.files.length) return U.toast('No Lofi Focus backup found in your Google Drive yet.', 6000);
        id = found.files[0].id;
      }
      const obj = JSON.parse(await api('GET', `https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { raw: true }));
      const when = new Date(obj.exported).toLocaleString();
      if (confirm(`Restore the Google Drive backup from ${when}? This replaces what’s in this browser.`)) {
        L.store.save(FILES.backup.key, id);
        B.restore(obj);
      }
    } catch (e) {
      U.toast(e.message, 7000);
    }
  };

  // Keep Drive up to date while signed in (tokens last an hour; after that the
  // next manual save signs in again).
  let autoTimer = null;
  L.store.onSave = (key) => {
    if (key.startsWith('drive') || !L.store.load('driveAuto', false) || !L.Google.hasToken(SCOPE)) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => B.saveToDrive({ quiet: true }), 30000);
  };

  B.renderStatus = (msg) => {
    const last = L.store.load('driveLastSync', null);
    const text = msg || (last ? `Last saved to Drive ${new Date(last).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : B.clientId() ? 'Not saved to Drive yet' : null);
    U.$$('.j-sync').forEach((e) => { e.textContent = text || 'Google isn’t set up yet — see Settings → Google'; });
    U.$$('.drive-status').forEach((e) => { e.textContent = text || 'Add your Client ID under “Google setup” to turn this on.'; });
  };

  L.Backup = B;
})();
