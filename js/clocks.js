// Stopwatch (with laps) and any number of labelled countdown timers.
// Both use wall-clock timestamps, so they keep time in background tabs and
// across reloads.
(function () {
  'use strict';
  const L = window.Lofi, U = L.util, { el } = U;

  const S = L.store.load('clocks', { sw: { running: false, startAt: 0, elapsed: 0, laps: [] }, timers: [] });
  let root = null, raf = 0;
  const views = new Map(); // countdown id -> { time, bar, play, row }

  const C = { onChange: null };
  const save = () => { L.store.save('clocks', S); if (C.onChange) C.onChange(); };
  C.runningCount = () => (S.sw.running ? 1 : 0) + S.timers.filter((t) => t.running).length;

  // ---------- stopwatch ----------
  const swTime = () => S.sw.elapsed + (S.sw.running ? Date.now() - S.sw.startAt : 0);
  function swToggle() {
    if (S.sw.running) { S.sw.elapsed = swTime(); S.sw.running = false; }
    else { S.sw.startAt = Date.now(); S.sw.running = true; }
    save(); renderStopwatch();
  }
  function swLap() { if (S.sw.running) { S.sw.laps.unshift(swTime()); save(); renderStopwatch(); } }
  function swReset() { S.sw = { running: false, startAt: 0, elapsed: 0, laps: [] }; save(); renderStopwatch(); }

  // ---------- countdowns ----------
  const left = (t) => (t.running ? Math.max(0, t.endAt - Date.now()) : t.remaining);

  // "10" = 10 min, "1:30" = 1 min 30 s, "1:00:00" = 1 hour
  function parseTime(s) {
    const parts = s.trim().split(':').map(Number);
    if (!parts.length || parts.some((n) => !isFinite(n) || n < 0)) return 0;
    if (parts.length === 1) return parts[0] * 60000;
    if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  function addTimer(label, ms, start) {
    const t = { id: U.uid(), label: label || U.fmtDuration(ms).replace(/^00:/, '') + ' timer', duration: ms, remaining: ms, endAt: 0, running: false, done: false };
    if (start) { t.running = true; t.endAt = Date.now() + ms; }
    S.timers.push(t);
    save(); renderTimers();
  }
  function toggleTimer(t) {
    if (t.done) { t.done = false; t.remaining = t.duration; }
    if (t.running) { t.remaining = left(t); t.running = false; }
    else { t.endAt = Date.now() + t.remaining; t.running = true; }
    save(); renderTimers();
  }
  function finish(t) {
    t.running = false; t.remaining = 0; t.done = true;
    save(); renderTimers();
    L.Ambient.chime(L.Timer.settings.chime || 0.6, true);
    U.toast(`⏰ ${t.label} is done`, 6000);
    if (L.Timer.settings.notify && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification(`⏰ ${t.label} is done`, { silent: true }); } catch (e) { /* needs a service worker in some browsers */ }
    }
  }
  setInterval(() => { for (const t of S.timers) if (t.running && t.endAt <= Date.now()) finish(t); }, 250);

  // ---------- rendering ----------
  function renderStopwatch() {
    if (!root) return;
    U.$('.sw-time', root).textContent = U.fmtDuration(swTime(), true);
    const play = U.$('.sw-play', root);
    play.textContent = S.sw.running ? 'Pause' : swTime() ? 'Resume' : 'Start';
    U.$('.sw-lap', root).disabled = !S.sw.running;
    U.$('.sw-reset', root).disabled = !swTime();
    const laps = S.sw.laps;
    U.$('.laps', root).replaceChildren(...laps.map((total, i) => el('li', {},
      el('span', { text: `Lap ${laps.length - i}` }),
      el('span', { text: U.fmtDuration(total - (laps[i + 1] || 0), true) }),
      el('span', { class: 'muted', text: U.fmtDuration(total, true) }))));
  }

  function renderTimers() {
    if (!root) return;
    views.clear();
    U.$('.cd-list', root).replaceChildren(...S.timers.map((t, i) => {
      const time = el('span', { class: 'cd-time' }), bar = el('div'), play = U.iconBtn(t.running ? 'pause' : 'play', {
        class: 'icon-btn cd-play', 'aria-label': t.running ? `Pause ${t.label}` : `Start ${t.label}`, onclick: () => toggleTimer(t),
      });
      const label = el('input', { class: 'cd-label', value: t.label, maxlength: 40, 'aria-label': 'Timer name' });
      label.addEventListener('change', () => { t.label = label.value.trim() || t.label; save(); });
      label.addEventListener('keydown', (e) => { if (e.key === 'Enter') label.blur(); });
      const row = el('li', { class: 'cd-row' + (t.done ? ' done' : '') + (t.running ? ' running' : '') },
        el('div', { class: 'cd-main' }, label, time),
        el('div', { class: 'cd-bar' }, bar),
        el('div', { class: 'cd-btns' }, play,
          U.iconBtn('reset', { 'aria-label': `Reset ${t.label}`, title: 'Reset', onclick: () => { Object.assign(t, { running: false, done: false, remaining: t.duration }); save(); renderTimers(); } }),
          U.iconBtn('x', { class: 'icon-btn del', 'aria-label': `Delete ${t.label}`, title: 'Delete', onclick: () => { S.timers.splice(i, 1); save(); renderTimers(); } })));
      views.set(t.id, { t, time, bar });
      return row;
    }));
    U.$('.cd-empty', root).hidden = S.timers.length > 0;
    tickViews();
  }

  function tickViews() {
    if (!root) return;
    U.$('.sw-time', root).textContent = U.fmtDuration(swTime(), true);
    for (const { t, time, bar } of views.values()) {
      const ms = left(t);
      time.textContent = t.done ? 'Done ✓' : U.fmtDuration(Math.ceil(ms / 1000) * 1000);
      bar.style.width = `${(1 - ms / t.duration) * 100}%`;
    }
  }
  function loop() { tickViews(); raf = requestAnimationFrame(loop); }

  C.init = (container) => {
    root = container;
    const label = el('input', { type: 'text', placeholder: 'Label (optional)', maxlength: 40, 'aria-label': 'Timer label' });
    const time = el('input', { type: 'text', placeholder: '10 or 1:30', inputmode: 'numeric', 'aria-label': 'Duration: minutes, or m:ss, or h:mm:ss' });
    root.append(
      el('h3', { text: 'Stopwatch' }),
      el('div', { class: 'sw' },
        el('div', { class: 'sw-time', text: '00:00.00' }),
        el('div', { class: 'sw-btns' },
          el('button', { type: 'button', class: 'pill sw-play', onclick: swToggle }),
          el('button', { type: 'button', class: 'pill ghost sw-lap', text: 'Lap', onclick: swLap }),
          el('button', { type: 'button', class: 'pill ghost sw-reset', text: 'Reset', onclick: swReset }))),
      el('ol', { class: 'laps' }),
      el('h3', { text: 'Countdowns' }),
      el('div', { class: 'presets' }, ...[1, 3, 5, 10, 15, 30, 60].map((m) => el('button', {
        type: 'button', text: m < 60 ? `${m} min` : '1 hour', title: `Start a ${m}-minute countdown`, onclick: () => addTimer(m < 60 ? `${m} min` : '1 hour', m * 60000, true),
      }))),
      el('form', { class: 'add-row cd-add', onsubmit: (e) => {
        e.preventDefault();
        const ms = parseTime(time.value);
        if (!ms) return U.toast('Enter a time like 10 (minutes), 1:30 or 1:00:00.');
        addTimer(label.value.trim(), ms, true);
        label.value = ''; time.value = '';
      } }, label, time, el('button', { type: 'submit', class: 'pill', text: 'Start' })),
      el('ul', { class: 'cd-list' }),
      el('p', { class: 'hint cd-empty', text: 'Tap a preset or enter your own time. You can run as many countdowns as you like — for tea, laundry, a stretch break…' }),
    );
    renderStopwatch();
    renderTimers();
  };
  C.onOpen = () => { renderStopwatch(); renderTimers(); cancelAnimationFrame(raf); loop(); };
  C.onClose = () => cancelAnimationFrame(raf);

  L.Clocks = C;
})();
