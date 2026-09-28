// Keep your journal, habits, to-dos and focus history in sync across devices,
// through a file in your own Google Drive ("Lofi Focus/lofi-focus-sync.json").
//
// Each synced key has a version number in Drive that goes up with every write,
// and this device remembers which version it last matched and whether it has
// changed the key since. (Versions, not clock times: phones and computers
// rarely agree on the exact time.) On every sync:
//   • only this device changed it → upload it
//   • only the other device changed it → take theirs
//   • both changed it → merge item by item (newest wins per item), so nothing
//     added on either device is lost; deletions are remembered (util.forget)
//     so a deleted item doesn't come back from the other copy.
//
// Signing in to Google turns it on. Google's browser sign-in lasts an hour and
// can't renew in the background, so after opening the page, or once the hour
// is up, the next click signs in again (a quick popup that usually closes by
// itself), and the dock's cloud button can always sync on demand.
(function () {
  'use strict';
  const L = window.Lofi, U = L.util, P = L.store.PREFIX;
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FILE = { name: 'lofi-focus-sync.json', mime: 'application/json', key: 'driveSyncId' };
  // What syncs. Layout, scene, volumes, stations and running timers stay per device.
  const KEYS = ['deletedIds', 'journal', 'habits', 'habitLog', 'todos', 'todoArchive', 'focusLog', 'stats'];

  // 'drive…' keys are left out of backups: they describe this device's link to Drive.
  // on: syncing. off: you turned it off (so signing in doesn't turn it back on).
  // dirty[key]: set when changed on this device since the last sync. rev[key]: the Drive version last matched.
  // file: the Drive file those versions belong to.
  const meta = L.store.load('driveSyncMeta', { on: false, off: false, dirty: {}, rev: {}, last: 0, file: null });
  const saveMeta = () => L.store.save('driveSyncMeta', meta);
  const S = { state: meta.on ? 'signin' : 'off', error: null, onChange: null };
  const setState = (state, error = null) => { S.state = state; S.error = error; if (S.onChange) S.onChange(); };

  // ---------- merging ----------
  function byId(first, second, pick) { // items from `first`, then new ones from `second`
    const m = new Map();
    for (const x of first || []) m.set(x.id, x);
    for (const y of second || []) { const x = m.get(y.id); m.set(y.id, x ? pick(x, y) : y); }
    return [...m.values()];
  }
  const alive = (dead) => (x) => !(dead && dead[x.id]);
  const newer = (a, b) => ((b.updated || 0) > (a.updated || 0) ? b : a);
  const MERGE = { // (this device, Drive, deleted ids) → merged
    deletedIds: (l, r) => ({ ...(r || {}), ...(l || {}) }),
    journal: (l, r, dead) => byId(r, l, newer).filter(alive(dead)),
    habits: (l, r, dead) => byId(r, l, (a, b) => b).filter(alive(dead)),
    habitLog: (l, r) => {
      const out = { ...(r || {}) };
      for (const [d, ids] of Object.entries(l || {})) out[d] = [...new Set([...(out[d] || []), ...ids])];
      return out;
    },
    todos: (l, r, dead) => {
      l = l || { lists: [] }; r = r || { lists: [] };
      const lists = byId(r.lists, l.lists, (a, b) => ({ ...b, items: byId(a.items, b.items, (x, y) => y) }))
        .filter(alive(dead)).map((li) => ({ ...li, items: li.items.filter(alive(dead)) }));
      return { lists: lists.length ? lists : l.lists, active: l.active };
    },
    todoArchive: (l, r) => {
      const seen = new Set();
      return [...(r || []), ...(l || [])].filter((a) => { const k = `${a.text}|${a.doneAt}|${a.list}`; return !seen.has(k) && seen.add(k); });
    },
    focusLog: (l, r) => {
      const out = { ...(r || {}) };
      for (const [d, v] of Object.entries(l || {})) out[d] = out[d] ? { sessions: Math.max(out[d].sessions, v.sessions), minutes: Math.max(out[d].minutes, v.minutes) } : v;
      return out;
    },
    stats: (l, r) => {
      if (!l || !r) return l || r;
      if (l.date !== r.date) return new Date(l.date) > new Date(r.date) ? l : r;
      return { date: l.date, sessions: Math.max(l.sessions, r.sessions), minutes: Math.max(l.minutes, r.minutes) };
    },
  };

  // ---------- local storage ----------
  let applying = false;
  const readLocal = (k) => { try { const v = localStorage.getItem(P + k); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; } };
  const writeLocal = (k, v) => { applying = true; try { L.store.save(k, v); } finally { applying = false; } };

  let stamp = 0; // unique per change on this device, so a sync can tell if you edited during it
  L.store.listen((key) => {
    if (applying || !KEYS.includes(key)) return;
    meta.dirty[key] = ++stamp + Date.now();
    saveMeta();
    if (meta.on) schedule(4000);
  });

  // ---------- Drive ----------
  // The saved file is checked once per visit: it may have been deleted in Drive
  // (a trashed file still reads and writes fine, but other devices can't find it).
  let checked = false;
  async function fileId() {
    const saved = L.store.load(FILE.key, null);
    if (saved && (checked || await L.Backup.alive(saved))) { checked = true; return saved; }
    const id = await L.Backup.find(FILE.name); // made by another device, or none yet
    L.store.save(FILE.key, id);
    checked = !!id;
    return id;
  }
  async function readRemote(retry = true) {
    const id = await fileId();
    if (!id) return { id, doc: { app: 'lofi-focus-sync', version: 1, keys: {} } };
    try {
      const doc = JSON.parse(await L.Backup.api('GET', `https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { raw: true }));
      doc.keys = doc.keys || {};
      return { id, doc };
    } catch (e) {
      if (e.status !== 404 || !retry) throw e;
      L.store.save(FILE.key, null); // deleted for good: look again / start fresh
      checked = false;
      return readRemote(false);
    }
  }

  // ---------- sync ----------
  let busy = false, again = false, timer = null;
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(() => S.sync(), ms); }

  // interactive: allowed to open Google's sign-in popup (call it from a click).
  S.sync = async ({ interactive = false } = {}) => {
    if (!meta.on) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      if (!L.Google.hasToken(SCOPE)) {
        if (!interactive || !L.Google.clientId()) { setState('signin'); return; }
        setState('syncing');
        await L.Google.token(SCOPE); // must be requested straight from the click
      }
      setState('syncing');
      const { id, doc } = await readRemote(), R = doc.keys;
      if (meta.file !== id) { // first sync, or the Drive file was replaced: merge everything that's here
        meta.rev = {};
        for (const k of KEYS) if (readLocal(k) !== undefined) meta.dirty[k] = ++stamp + Date.now();
      }
      const dead = MERGE.deletedIds(readLocal('deletedIds'), R.deletedIds && R.deletedIds.value);
      const pulled = [];
      let push = false;
      const done = {}; // key → the change marker we've now accounted for
      for (const k of KEYS) {
        const r = R[k], local = readLocal(k), seen = meta.rev[k] || 0, mark = meta.dirty[k];
        const hasLocal = local !== undefined;
        const localChanged = hasLocal && !!mark, remoteChanged = !!r && r.rev !== seen;
        const put = (value) => { R[k] = { rev: (r ? r.rev : 0) + 1, at: Date.now(), value }; meta.rev[k] = R[k].rev; push = true; };
        if (!r && !hasLocal) continue;
        if (hasLocal && (!r || (localChanged && !remoteChanged))) { // upload ours
          put(local);
        } else if (r && (!hasLocal || (remoteChanged && !localChanged))) { // take theirs
          writeLocal(k, r.value);
          meta.rev[k] = r.rev; pulled.push(k);
        } else if (localChanged && remoteChanged) { // both changed: merge
          const v = MERGE[k](local, r.value, dead);
          writeLocal(k, v); put(v); pulled.push(k);
        }
        done[k] = mark;
      }
      if (push) {
        doc.updated = Date.now();
        await L.Backup.upsert(FILE, JSON.stringify(doc), L.Backup.folderId);
      }
      meta.file = push ? L.store.load(FILE.key, null) : id;
      // Clear "changed here" only if nothing new was edited while we synced.
      for (const [k, mark] of Object.entries(done)) if (meta.dirty[k] === mark) delete meta.dirty[k];
      meta.last = Date.now();
      saveMeta();
      if (pulled.length) refresh(pulled);
      setState('ok');
    } catch (e) {
      setState(e.status === 401 || /sign-in|closed|blocked/i.test(e.message) ? 'signin' : 'error', e.message);
    } finally {
      busy = false;
      if (again) { again = false; schedule(500); }
    }
  };

  // Show what just arrived from the other device.
  function refresh(keys) {
    const has = (k) => keys.includes(k);
    if (has('journal') && L.Journal.reload) L.Journal.reload();
    if ((has('habits') || has('habitLog')) && L.Habits.reload) L.Habits.reload();
    if (has('todos') && L.Todos.reload) L.Todos.reload();
    if (L.Calendar.refresh) L.Calendar.refresh();
    if (L.Timer.onChange) L.Timer.onChange();
  }

  S.isOn = () => meta.on;
  const enable = () => { meta.on = true; meta.off = false; saveMeta(); };
  // Sign in if needed, and sync now ("Sign in with Google", "Sync now", ☁). Call from a click.
  S.start = () => { enable(); return S.sync({ interactive: true }); };
  S.setOn = (on) => { // the checkbox
    if (on) return S.start();
    meta.on = false; meta.off = true; saveMeta();
    setState('off');
    return Promise.resolve();
  };
  S.stop = () => { meta.on = false; saveMeta(); armed = false; setState('off'); }; // signing out of Google
  S.statusText = () => {
    if (S.state === 'off') return 'Off';
    if (S.state === 'syncing') return 'Syncing…';
    if (S.state === 'signin') return 'Sign in to sync: click anywhere, or the ☁ button';
    if (S.state === 'error') return `Couldn’t sync: ${S.error || 'unknown error'}`;
    const mins = Math.round((Date.now() - meta.last) / 60000);
    return `Synced ${mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : new Date(meta.last).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  };

  // Signing in to Google (from anywhere: sync, Calendar, backups) turns sync
  // on, unless you turned it off. Then stay current: when the tab comes back
  // into view, and every minute while it's open.
  let armed = true; // may sign in again on the next click
  L.Google.onToken(() => {
    armed = true;
    if (!L.Google.hasToken(SCOPE)) return;
    if (!meta.on && !meta.off) {
      enable();
      U.toast('Sync is on: your journal, habits and to-dos now stay the same on every device where you sign in to Google.', 7000);
    }
    if (meta.on) S.sync();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && meta.on && L.Google.hasToken(SCOPE)) S.sync(); });
  setInterval(() => { if (meta.on && !document.hidden && L.Google.hasToken(SCOPE)) S.sync(); }, 60000);
  // When the page opens, or the hour-long sign-in runs out, the next click
  // signs in again (a click, not pointerdown, so phones allow the popup too).
  // Once per sign-in, so closing the popup doesn't bring it back.
  addEventListener('click', (e) => {
    if (!armed || !meta.on || L.Google.hasToken(SCOPE) || e.target.closest('#syncBtn, #setSync, #syncNow, .google-signin')) return;
    armed = false;
    S.sync({ interactive: true });
  }, true);

  L.Sync = S;
})();
