// Pomodoro timer. Uses wall-clock end times (not a countdown of ticks) so it
// stays accurate when the tab is in the background, and survives a reload.
(function () {
  'use strict';
  const L = window.Lofi;
  const DEFAULTS = { focus: 25, short: 5, long: 15, longEvery: 4, autoBreak: true, autoFocus: false, chime: 0.6, notify: false };
  const LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };

  const today = () => new Date().toDateString();
  const freshStats = () => ({ date: today(), sessions: 0, minutes: 0 });

  const T = {
    LABEL,
    settings: L.store.load('timer', DEFAULTS),
    mode: 'focus',
    running: false,
    endAt: 0,
    remaining: 0,
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
    L.store.save('timerState', { mode: T.mode, running: T.running, endAt: T.endAt, remaining: T.remaining, cycle: T.cycle });
  }
  function emit() { save(); if (T.onChange) T.onChange(); }

  function refreshStats() {
    const s = L.store.load('stats', null);
    T.stats = s && s.date === today() ? s : freshStats();
  }
  function addStats(minutes) {
    refreshStats();
    T.stats.sessions++;
    T.stats.minutes += minutes;
    L.store.save('stats', T.stats);
  }
  T.resetStats = () => { T.stats = freshStats(); L.store.save('stats', T.stats); emit(); };

  function complete(silent, skipped) {
    const was = T.mode;
    let next;
    if (was === 'focus') {
      if (!skipped) { T.cycle++; addStats(T.settings.focus); }
      next = !skipped && T.cycle % T.settings.longEvery === 0 ? 'long' : 'short';
    } else {
      next = 'focus';
    }
    const auto = !silent && !skipped && (next === 'focus' ? T.settings.autoFocus : T.settings.autoBreak);
    T.mode = next;
    T.remaining = T.duration();
    T.running = auto;
    if (auto) T.endAt = Date.now() + T.remaining;
    emit();
    if (!silent && !skipped && T.onComplete) T.onComplete(was, next);
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
    T.running = true;
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
  T.reset = () => { T.running = false; T.remaining = T.duration(); emit(); };
  T.skip = () => complete(true, true);
  T.setMode = (mode) => { T.mode = mode; T.running = false; T.remaining = T.duration(); emit(); };

  T.updateSettings = (patch) => {
    const wasFull = !T.running && T.remaining === T.duration();
    Object.assign(T.settings, patch);
    L.store.save('timer', T.settings);
    if (wasFull) T.remaining = T.duration();
    else T.remaining = Math.min(T.remaining, T.duration());
    emit();
  };

  T.init = () => {
    refreshStats();
    const s = L.store.load('timerState', null);
    if (s && LABEL[s.mode]) {
      T.mode = s.mode;
      T.cycle = s.cycle || 0;
      if (s.running && s.endAt > Date.now()) {
        T.running = true;
        T.endAt = s.endAt;
        T.remaining = s.endAt - Date.now();
      } else if (s.running) {
        complete(true, false); // finished while the page was closed
      } else {
        T.remaining = s.remaining > 0 && s.remaining <= T.duration() ? s.remaining : T.duration();
      }
    } else {
      T.remaining = T.duration();
    }
    emit();
    setInterval(tick, 250);
  };

  L.Timer = T;
})();
