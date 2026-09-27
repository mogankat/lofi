// Google Calendar: show your events in the Calendar panel, and optionally log
// finished focus sessions as events. Uses your primary calendar.
// Events are fetched when needed and kept in memory only.
(function () {
  'use strict';
  const L = window.Lofi, U = L.util;
  const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
  const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  const cfg = L.store.load('gcal', { show: true, logFocus: false, linked: false });
  const Gc = { cfg, onChange: null, error: null };
  const events = {}; // 'YYYY-MM-DD' -> [{ title, time, allDay, link }]
  const loaded = new Set(); // month keys already fetched
  const emit = () => Gc.onChange && Gc.onChange();
  const save = () => L.store.save('gcal', cfg);

  Gc.connected = () => L.Google.hasToken(SCOPE);
  Gc.onDay = (key) => (cfg.show ? events[key] || [] : []);

  // Sign in (from a click), then send any focus sessions that were waiting.
  Gc.connect = async () => {
    try {
      await L.Google.token(SCOPE);
      cfg.linked = true; save();
      Gc.error = null;
      loaded.clear();
      await flushQueue();
      emit();
    } catch (e) {
      U.toast(e.message, 7000);
    }
  };
  Gc.disconnect = () => {
    L.Google.signOut();
    cfg.linked = false; save();
    for (const k of Object.keys(events)) delete events[k];
    loaded.clear();
    emit();
  };
  Gc.setShow = (v) => { cfg.show = v; save(); emit(); };
  Gc.setLogFocus = (v) => { cfg.logFocus = v; save(); emit(); };

  // Fetch events for the month containing `date` (plus the days shown around it).
  Gc.loadMonth = async (date) => {
    if (!cfg.show || !Gc.connected()) return;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (loaded.has(key)) return;
    loaded.add(key);
    const from = U.addDays(new Date(date.getFullYear(), date.getMonth(), 1), -7);
    const to = U.addDays(new Date(date.getFullYear(), date.getMonth() + 1, 1), 14);
    try {
      const q = new URLSearchParams({
        timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime',
        maxResults: '500', fields: 'items(id,summary,start,end,htmlLink,status)',
      });
      const res = await L.Google.fetch(SCOPE, 'GET', `${API}?${q}`);
      for (let d = from; d < to; d = U.addDays(d, 1)) delete events[U.dayKey(d)];
      for (const ev of res.items || []) {
        if (ev.status === 'cancelled') continue;
        const item = { title: ev.summary || '(No title)', link: ev.htmlLink, allDay: !!ev.start.date };
        if (item.allDay) { // all-day events can span several days; end.date is exclusive
          for (let d = U.fromKey(ev.start.date), end = U.fromKey(ev.end.date); d < end; d = U.addDays(d, 1)) (events[U.dayKey(d)] ||= []).push(item);
        } else {
          const start = new Date(ev.start.dateTime);
          item.time = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          item.sort = start.getTime();
          (events[U.dayKey(start)] ||= []).push(item);
        }
      }
      Gc.error = null;
    } catch (e) { // stays marked as loaded so a failure doesn't retry in a loop; Refresh clears it
      Gc.error = e.status === 401 ? 'Google sign-in expired — connect again.' : 'Couldn’t load Google Calendar events.';
    }
    emit();
  };
  Gc.refresh = (date) => { loaded.clear(); return Gc.loadMonth(date); };

  // ---- logging focus sessions ----
  const queue = () => L.store.load('gcalQueue', []);
  async function insert(ev) {
    await L.Google.fetch(SCOPE, 'POST', API, { body: JSON.stringify(ev), headers: { 'Content-Type': 'application/json' } });
  }
  async function flushQueue() {
    const q = queue();
    if (!q.length || !Gc.connected()) return;
    const left = [];
    for (const ev of q) { try { await insert(ev); } catch (e) { left.push(ev); } }
    L.store.save('gcalQueue', left);
    if (q.length > left.length) U.toast(`Logged ${q.length - left.length} focus session(s) to Google Calendar`);
  }

  Gc.logFocus = async (lengthMs, task) => {
    if (!cfg.logFocus) return;
    const end = new Date(), start = new Date(end.getTime() - lengthMs);
    const ev = {
      summary: `🍅 Focus${task ? ` — ${task}` : ''}`,
      description: 'Logged by Lofi Focus',
      start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() },
      transparency: 'transparent', // don't show as busy
    };
    if (Gc.connected()) {
      try { await insert(ev); loaded.clear(); emit(); return; } catch (e) { /* fall through to the queue */ }
    }
    L.store.save('gcalQueue', [...queue(), ev]);
    U.toast('Focus session saved — it’ll be added to Google Calendar next time you connect (Calendar panel).', 6000);
  };
  Gc.pending = () => queue().length;

  L.GCal = Gc;
})();
