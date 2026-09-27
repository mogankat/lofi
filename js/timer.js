// Pomodoro timer. Uses wall-clock end times (not a countdown of ticks) so it
// stays accurate when the tab is in the background, and survives a reload.
(function () {
  'use strict';
  const L = window.Lofi;
  const DEFAULTS = { focus: 25, short: 5, long: 15, longEvery: 4, autoBreak: true, autoFocus: false, chime: 0.6, notify: false };
  const LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };
  const LIMITS = { focus: [1, 180], short: [1, 60], long: [1, 90] }; // minutes

  const today = () => new Date().toDateString();
  const freshStats = () => ({ date: today(), sessions: 0, minutes: 0 });

  const T = {
    LABEL,
    LIMITS,
    settings: L.store.load('timer', DEFAULTS),
    mode: 'focus',
    running: false,
    started: false, // true once the current session has been started (even if paused)
    endAt: 0,
    remaining: 0,
    total: 0, // length of the current session, including any +/- adjustments
    cycle: 0, // focus sessions completed
    stats: freshStats(),
    onChange: null,
    onComplete: null,
  };

  T.duration = (mode = T.mode) => T.settings[mode] * 60000;
  T.format = (ms) => {
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  // How many tomato dots are filled in the current set.
  T.setProgress = () => (T.mode === 'long' ? T.settings.longEvery : T.cycle % T.settings.longEvery);

  function save() {
    L.store.save('timerState', {
      mode: T.mode, running: T.running, started: T.started, endAt: T.endAt,
      remaining: T.remaining, total: T.total, cycle: T.cycle,
    });
  }
  function emit() { save(); if (T.onChange) T.onChange(); }
  function fresh() { T.started = false; T.remaining = T.total = T.duration(); }

  function refreshStats() {
    const s = L.store.load('stats', null);
    T.stats = s && s.date === today() ? s : freshStats();
  }
  // Per-day history for the calendar: { 'YYYY-MM-DD': { sessions, minutes } }
  T.history = () => L.store.load('focusLog', {});
  function addStats(minutes) {
    refreshStats();
    T.stats.sessions++;
    T.stats.minutes += minutes;
    L.store.save('stats', T.stats);
    const log = T.history(), key = L.util.dayKey();
    log[key] = { sessions: T.stats.sessions, minutes: T.stats.minutes };
    L.store.save('focusLog', log);
  }
  T.resetStats = () => {
    T.stats = freshStats();
    L.store.save('stats', T.stats);
    const log = T.history();
    delete log[L.util.dayKey()];
    L.store.save('focusLog', log);
    emit();
  };

  function complete(silent, skipped) {
    const was = T.mode, length = T.total;
    let next;
    if (was === 'focus') {
      if (!skipped) { T.cycle++; addStats(Math.max(1, Math.round(T.total / 60000))); }
      next = !skipped && T.cycle % T.settings.longEvery === 0 ? 'long' : 'short';
    } else {
      next = 'focus';
    }
    const auto = !silent && !skipped && (next === 'focus' ? T.settings.autoFocus : T.settings.autoBreak);
    T.mode = next;
    fresh();
    T.running = T.started = auto;
    if (auto) T.endAt = Date.now() + T.remaining;
    emit();
    if (!silent && !skipped && T.onComplete) T.onComplete(was, next, length);
  }

  function tick() {
    refreshStats();
    if (!T.running) return;
    T.remaining = Math.max(0, T.endAt - Date.now());
    if (T.remaining <= 0) complete(false, false);
    else if (T.onChange) T.onChange();
  }

  T.start = () => {
    if (T.running) return;
    T.running = T.started = true;
    T.endAt = Date.now() + T.remaining;
    emit();
  };
  T.pause = () => {
    if (!T.running) return;
    T.remaining = Math.max(0, T.endAt - Date.now());
    T.running = false;
    emit();
  };
  T.toggle = () => (T.running ? T.pause() : T.start());
  T.reset = () => { T.running = false; fresh(); emit(); };
  T.skip = () => complete(true, true);
  T.setMode = (mode) => { T.mode = mode; T.running = false; fresh(); emit(); };

  // +/- on the clock. Before a session starts it changes that mode's length
  // (same as Settings); during a session it only stretches or trims this one.
  T.adjust = (minutes) => {
    if (!T.started) {
      const [lo, hi] = LIMITS[T.mode];
      const v = Math.min(hi, Math.max(lo, T.settings[T.mode] + minutes));
      if (v !== T.settings[T.mode]) T.updateSettings({ [T.mode]: v });
      return;
    }
    const rem = T.running ? T.endAt - Date.now() : T.remaining;
    const next = Math.min(LIMITS[T.mode][1] * 60000, Math.max(5000, rem + minutes * 60000));
    T.total += next - rem;
    T.remaining = next;
    if (T.running) T.endAt = Date.now() + next;
    emit();
  };

  T.updateSettings = (patch) => {
    Object.assign(T.settings, patch);
    L.store.save('timer', T.settings);
    if (!T.started) fresh(); // a session in progress keeps its own length
    emit();
  };

  T.init = () => {
    refreshStats();
    const s = L.store.load('timerState', null);
    fresh();
    if (s && LABEL[s.mode]) {
      T.mode = s.mode;
      T.cycle = s.cycle || 0;
      fresh();
      const total = s.total > 0 ? s.total : T.duration();
      if (s.running && s.endAt > Date.now()) {
        T.running = T.started = true;
        T.endAt = s.endAt;
        T.total = total;
        T.remaining = s.endAt - Date.now();
      } else if (s.running) {
        T.total = total;
        complete(true, false); // finished while the page was closed
        return setInterval(tick, 250);
      } else if (s.remaining > 0 && (s.started || s.remaining < T.duration())) {
        T.started = true;
        T.total = Math.max(total, s.remaining);
        T.remaining = s.remaining;
      }
    }
    emit();
    setInterval(tick, 250);
  };

  L.Timer = T;
})();
