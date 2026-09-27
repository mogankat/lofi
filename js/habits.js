// Habit tracker: a prioritised (drag to reorder) list of habits with a
// check-off grid for each day of the week.
(function () {
  'use strict';
  const L = window.Lofi, U = L.util, { el } = U;

  let habits = L.store.load('habits', []); // [{ id, name, created }]
  let log = L.store.load('habitLog', {}); // { 'YYYY-MM-DD': [habitId, …] }
  let weekOffset = 0, root = null;

  const H = { onChange: null };
  H.list = () => habits;
  H.isDone = (id, key) => (log[key] || []).includes(id);
  H.doneOn = (key) => habits.filter((h) => H.isDone(h.id, key));

  function save() {
    L.store.save('habits', habits);
    L.store.save('habitLog', log);
    if (root) U.keepFocus(root, render);
    if (H.onChange) H.onChange();
  }

  function toggle(id, key) {
    const ids = log[key] || (log[key] = []);
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.push(id);
    if (!ids.length) delete log[key];
    save();
  }

  // Consecutive days up to today (or yesterday, if today isn't checked yet).
  function streak(id) {
    let d = new Date(), n = 0;
    if (!H.isDone(id, U.dayKey(d))) d = U.addDays(d, -1);
    while (H.isDone(id, U.dayKey(d))) { n++; d = U.addDays(d, -1); }
    return n;
  }

  function render() {
    if (!root) return;
    const today = U.dayKey();
    const start = U.addDays(U.weekStart(new Date()), weekOffset * 7);
    const days = Array.from({ length: 7 }, (_, i) => U.addDays(start, i));
    const keys = days.map(U.dayKey);
    const short = { month: 'short', day: 'numeric' };

    U.$('.week-label', root).textContent = weekOffset === 0
      ? `This week · ${U.fmtDate(days[0], short)} – ${U.fmtDate(days[6], short)}`
      : `${U.fmtDate(days[0], short)} – ${U.fmtDate(days[6], short)}`;
    U.$('.next-week', root).disabled = weekOffset >= 0;
    U.$('.this-week', root).hidden = weekOffset === 0;

    const head = U.$('.habit-head', root);
    head.replaceChildren(
      el('span'), el('span'), el('span', { class: 'h-name-head', text: 'Habit' }),
      ...days.map((d, i) => el('span', { class: 'h-day' + (keys[i] === today ? ' today' : '') },
        d.toLocaleDateString(undefined, { weekday: 'narrow' }), el('small', { text: d.getDate() }))),
      el('span', { class: 'h-streak', text: '🔥', title: 'Current streak (days in a row)' }), el('span'),
    );
    head.hidden = !habits.length;

    const list = U.$('.habit-list', root);
    list.replaceChildren(...habits.map((h, i) => {
      const name = el('input', { class: 'h-name', value: h.name, maxlength: 60, 'aria-label': `Habit ${i + 1} name` });
      name.addEventListener('change', () => { h.name = name.value.trim() || h.name; save(); });
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
      const s = streak(h.id);
      return el('li', { class: 'habit-row', 'data-idx': i },
        el('button', { type: 'button', class: 'drag-handle', html: U.ICON.grip, title: 'Drag to change priority (or focus and press ↑/↓)', 'aria-label': `Reorder ${h.name}` }),
        el('span', { class: 'h-num', text: `${i + 1}.` }),
        name,
        ...keys.map((k, j) => el('label', { class: 'h-day' + (k === today ? ' today' : '') },
          el('input', {
            type: 'checkbox', checked: H.isDone(h.id, k), disabled: k > today,
            'aria-label': `${h.name}, ${U.fmtDate(days[j])}`, onchange: () => toggle(h.id, k),
          }))),
        el('span', { class: 'h-streak' + (s ? ' on' : ''), text: s || '·', title: s ? `${s}-day streak` : 'No streak yet' }),
        U.iconBtn('x', { class: 'icon-btn del', title: 'Delete habit', 'aria-label': `Delete ${h.name}`, onclick: () => {
          if (confirm(`Delete the habit “${h.name}”? Its check-offs will be removed from the calendar.`)) { habits.splice(i, 1); save(); }
        } }),
      );
    }));

    const checks = habits.reduce((n, h) => n + keys.filter((k) => H.isDone(h.id, k)).length, 0);
    const possible = habits.length * keys.filter((k) => k <= today).length;
    U.$('.summary', root).textContent = habits.length ? `${checks} of ${possible} check-ins ${weekOffset === 0 ? 'so far this week' : 'that week'}` : '';
    U.$('.empty', root).hidden = habits.length > 0;
  }

  H.init = (container) => {
    root = container;
    const input = el('input', { type: 'text', placeholder: 'New habit, e.g. Drink water', maxlength: 60, 'aria-label': 'New habit' });
    root.append(
      el('div', { class: 'week-nav' },
        U.iconBtn('left', { 'aria-label': 'Previous week', onclick: () => { weekOffset--; render(); } }),
        el('span', { class: 'week-label' }),
        U.iconBtn('right', { class: 'icon-btn next-week', 'aria-label': 'Next week', onclick: () => { weekOffset++; render(); } }),
        el('button', { type: 'button', class: 'link this-week', text: 'Back to this week', onclick: () => { weekOffset = 0; render(); } }),
      ),
      el('div', { class: 'habit-head' }),
      el('ol', { class: 'habit-list' }),
      el('p', { class: 'hint empty', text: 'Add a habit you want to build — like “Read 20 pages” or “Stretch”. Drag the handle to put the most important ones first.' }),
      el('form', { class: 'add-row', onsubmit: (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        habits.push({ id: U.uid(), name, created: U.dayKey() });
        input.value = '';
        save();
      } }, input, el('button', { type: 'submit', class: 'pill', text: 'Add' })),
      el('p', { class: 'hint summary' }),
    );
    U.sortable(U.$('.habit-list', root), (from, to) => { U.move(habits, from, to); save(); });
    render();
  };
  H.onOpen = render;

  L.Habits = H;
})();
