// Calendar: month view of focus sessions, habits, finished tasks and journal
// entries. Pick a day to see the details, with links into the journal.
(function () {
  'use strict';
  const L = window.Lofi, U = L.util, { el } = U;

  let root = null, month = new Date(new Date().getFullYear(), new Date().getMonth(), 1), selected = U.dayKey();
  const Cal = {};

  function dayInfo(key) {
    const focus = L.Timer.history()[key] || { sessions: 0, minutes: 0 };
    const events = [...L.GCal.onDay(key)].sort((a, b) => (a.allDay ? 0 : a.sort) - (b.allDay ? 0 : b.sort));
    return { focus, habits: L.Habits.doneOn(key), tasks: L.Todos.doneOn(key), journal: L.Journal.onDay(key), events };
  }

  function render() {
    if (!root) return;
    const today = U.dayKey(), habitCount = L.Habits.list().length;
    U.$('.cal-title', root).textContent = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    U.$('.cal-today', root).hidden = month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear();
    renderGoogleBar();
    L.GCal.loadMonth(month);

    const first = U.weekStart(month);
    U.$('.cal-dow', root).replaceChildren(...Array.from({ length: 7 }, (_, i) => el('span', { text: U.addDays(first, i).toLocaleDateString(undefined, { weekday: 'short' }) })));

    const totals = { sessions: 0, minutes: 0, habits: 0, tasks: 0, journal: 0 };
    const cells = [];
    for (let d = first; cells.length < 42; d = U.addDays(d, 1)) {
      if (cells.length % 7 === 0 && cells.length && d.getMonth() !== month.getMonth()) break;
      const key = U.dayKey(d), inMonth = d.getMonth() === month.getMonth(), info = dayInfo(key);
      if (inMonth) {
        totals.sessions += info.focus.sessions; totals.minutes += info.focus.minutes;
        totals.habits += info.habits.length; totals.tasks += info.tasks.length; totals.journal += info.journal.length;
      }
      const marks = [];
      if (info.focus.sessions) marks.push(el('i', { class: 'm-focus', text: info.focus.sessions, title: `${info.focus.sessions} focus session(s)` }));
      if (info.habits.length) marks.push(el('i', { class: 'm-habit' + (habitCount && info.habits.length >= habitCount ? ' all' : ''), text: info.habits.length, title: `${info.habits.length} habit(s) done` }));
      if (info.tasks.length) marks.push(el('i', { class: 'm-task', text: info.tasks.length, title: `${info.tasks.length} task(s) done` }));
      if (info.events.length) marks.push(el('i', { class: 'm-gcal', text: info.events.length, title: `${info.events.length} Google Calendar event(s)` }));
      if (info.journal.length) marks.push(el('i', { class: 'm-journal', text: '✎', title: `${info.journal.length} journal entr${info.journal.length > 1 ? 'ies' : 'y'}` }));
      cells.push(el('button', {
        type: 'button',
        class: ['cal-day', inMonth ? '' : 'other', key === today ? 'today' : '', key === selected ? 'sel' : '', key > today ? 'future' : ''].join(' '),
        'aria-label': U.fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' }),
        'aria-pressed': key === selected,
        onclick: () => { selected = key; render(); },
      }, el('span', { class: 'num', text: d.getDate() }), el('span', { class: 'marks' }, marks)));
    }
    U.$('.cal-grid', root).replaceChildren(...cells);

    U.$('.cal-summary', root).textContent = [
      `${totals.sessions} focus sessions (${U.fmtMinutes(totals.minutes)})`,
      `${totals.habits} habit check-ins`, `${totals.tasks} tasks done`, `${totals.journal} journal entries`,
    ].join(' · ');
    renderDay();
  }

  function renderDay() {
    const d = U.fromKey(selected), info = dayInfo(selected), habits = L.Habits.list();
    const section = (title, ...kids) => el('section', {}, el('h4', { text: title }), ...kids);
    const none = (t) => el('p', { class: 'hint', text: t });

    U.$('.cal-detail', root).replaceChildren(
      el('h3', { text: U.fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }),
      L.GCal.cfg.show && L.GCal.cfg.linked ? section('📅 Google Calendar', info.events.length
        ? el('ul', { class: 'cal-events' }, info.events.map((e) => el('li', {},
          el('span', { class: 'ev-time', text: e.allDay ? 'All day' : e.time }),
          el('a', { href: e.link, target: '_blank', rel: 'noopener noreferrer', text: e.title, title: 'Open in Google Calendar' }))))
        : none(L.GCal.connected() ? 'No events.' : 'Connect above to see events.')) : null,
      section('🍅 Focus', info.focus.sessions
        ? el('p', { text: `${info.focus.sessions} session${info.focus.sessions > 1 ? 's' : ''} · ${U.fmtMinutes(info.focus.minutes)}` })
        : none('No focus sessions.')),
      section('✓ Habits', info.habits.length
        ? el('ul', { class: 'cal-habits' }, info.habits.map((h) => el('li', { class: 'done' }, el('span', { class: 'tick', text: '✓' }), h.name)))
        : none(habits.length ? 'No habits checked off.' : 'No habits set up yet.')),
      section('☑ Tasks done', info.tasks.length
        ? el('ul', {}, info.tasks.map((t) => el('li', {}, t.text, el('span', { class: 'muted', text: ` · ${t.list}` }))))
        : none('No tasks checked off.')),
      section('✎ Journal', info.journal.length
        ? el('ul', { class: 'cal-links' }, info.journal.map((e) => el('li', {}, el('button', {
          type: 'button', class: 'link', text: e.title.trim() || e.body.trim().split('\n')[0].slice(0, 50) || 'Untitled entry',
          onclick: () => L.Journal.open(e.id),
        }))))
        : none('No entries.'),
      selected <= U.dayKey() ? el('button', { type: 'button', class: 'pill small', text: info.journal.length ? '+ Another entry' : '+ Write an entry', onclick: () => L.Journal.newFor(selected) }) : null),
    );
  }

  function renderGoogleBar() {
    const G = L.GCal, bar = U.$('.gcal-bar', root), pending = G.pending();
    if (!G.cfg.show && !G.cfg.logFocus) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.replaceChildren(...(G.connected()
      ? [el('span', { class: 'gcal-dot on' }), el('span', { text: G.error || 'Google Calendar connected' }),
        el('button', { type: 'button', class: 'link', text: 'Refresh', onclick: () => G.refresh(month) })]
      : [el('span', { class: 'gcal-dot' }),
        el('span', { text: pending ? `${pending} focus session(s) waiting to be logged` : G.cfg.linked ? 'Google Calendar — sign in again to load events' : 'See your Google Calendar here' }),
        el('button', { type: 'button', class: 'pill small', text: 'Connect', onclick: () => G.connect() })]));
  }

  Cal.init = (container) => {
    root = container;
    L.GCal.onChange = () => { if (root) render(); };
    const shift = (n) => { month = new Date(month.getFullYear(), month.getMonth() + n, 1); render(); };
    root.append(
      el('div', { class: 'cal-main' },
        el('div', { class: 'gcal-bar' }),
        el('div', { class: 'cal-nav' },
          U.iconBtn('left', { 'aria-label': 'Previous month', onclick: () => shift(-1) }),
          el('span', { class: 'cal-title' }),
          U.iconBtn('right', { 'aria-label': 'Next month', onclick: () => shift(1) }),
          el('button', { type: 'button', class: 'link cal-today', text: 'Today', onclick: () => {
            month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            selected = U.dayKey();
            render();
          } })),
        el('div', { class: 'cal-dow' }),
        el('div', { class: 'cal-grid' }),
        el('div', { class: 'cal-legend' },
          el('span', {}, el('i', { class: 'm-focus' }), 'Focus sessions'),
          el('span', {}, el('i', { class: 'm-habit' }), 'Habits'),
          el('span', {}, el('i', { class: 'm-task' }), 'Tasks'),
          el('span', {}, el('i', { class: 'm-journal' }), 'Journal'),
          el('span', {}, el('i', { class: 'm-gcal' }), 'Google Calendar')),
        el('p', { class: 'hint cal-summary' })),
      el('div', { class: 'cal-detail' }),
    );
    render();
  };
  Cal.onOpen = render;

  L.Calendar = Cal;
})();
