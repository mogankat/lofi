// To-do lists: several named lists, drag to prioritise, check off items.
// Completion dates are kept so the calendar can show what got done each day.
(function () {
  'use strict';
  const L = window.Lofi, U = L.util, { el } = U;

  const DEFAULT = { lists: [{ id: 'todo', name: 'To-do', items: [] }], active: 'todo' };
  let data = L.store.load('todos', DEFAULT);
  let root = null;

  const T = { onChange: null };
  const active = () => data.lists.find((l) => l.id === data.active) || data.lists[0];
  T.openCount = () => data.lists.reduce((n, l) => n + l.items.filter((i) => !i.done).length, 0);
  T.doneOn = (key) => data.lists.flatMap((l) => l.items.filter((i) => i.done && i.doneAt === key).map((i) => ({ text: i.text, list: l.name })));

  function save() {
    L.store.save('todos', data);
    if (root) U.keepFocus(root, render);
    if (T.onChange) T.onChange();
  }

  function render() {
    if (!root) return;
    const list = active();
    data.active = list.id;

    U.$('.list-tabs', root).replaceChildren(
      ...data.lists.map((l) => el('button', {
        type: 'button', class: 'chip' + (l === list ? ' active' : ''),
        text: `${l.name}${l.items.some((i) => !i.done) ? ` · ${l.items.filter((i) => !i.done).length}` : ''}`,
        onclick: () => { data.active = l.id; save(); },
      })),
      el('button', { type: 'button', class: 'chip add', text: '+ List', title: 'New list', onclick: () => {
        const l = { id: U.uid(), name: 'New list', items: [] };
        data.lists.push(l);
        data.active = l.id;
        save();
        const title = U.$('.list-title', root);
        title.focus(); title.select();
      } }),
    );

    const title = U.$('.list-title', root);
    if (document.activeElement !== title) title.value = list.name;
    U.$('.del-list', root).hidden = data.lists.length < 2;

    U.$('.todo-list', root).replaceChildren(...list.items.map((item, i) => {
      const text = el('input', { class: 'todo-text', value: item.text, maxlength: 200, 'aria-label': `Task ${i + 1}` });
      text.addEventListener('change', () => { item.text = text.value.trim() || item.text; save(); });
      text.addEventListener('keydown', (e) => { if (e.key === 'Enter') text.blur(); });
      return el('li', { class: 'todo-row' + (item.done ? ' done' : ''), 'data-idx': i },
        el('button', { type: 'button', class: 'drag-handle', html: U.ICON.grip, title: 'Drag to change priority (or focus and press ↑/↓)', 'aria-label': `Reorder ${item.text}` }),
        el('span', { class: 'h-num', text: `${i + 1}.` }),
        el('input', { type: 'checkbox', checked: item.done, 'aria-label': `Done: ${item.text}`, onchange: (e) => {
          item.done = e.target.checked;
          item.doneAt = item.done ? U.dayKey() : null;
          save();
        } }),
        text,
        U.iconBtn('focus', { class: 'icon-btn focus-btn', title: 'Focus on this — sets it as the timer’s task', 'aria-label': `Focus on ${item.text}`, onclick: () => L.ui.setTask(item.text) }),
        U.iconBtn('x', { class: 'icon-btn del', title: 'Delete task', 'aria-label': `Delete ${item.text}`, onclick: () => { list.items.splice(i, 1); U.forget(item.id); save(); } }),
      );
    }));

    const done = list.items.filter((i) => i.done).length;
    U.$('.todo-count', root).textContent = list.items.length ? `${done} of ${list.items.length} done` : '';
    U.$('.clear-done', root).hidden = !done;
    U.$('.empty', root).hidden = list.items.length > 0;
  }

  T.init = (container) => {
    root = container;
    const input = el('input', { type: 'text', placeholder: 'Add a task…', maxlength: 200, 'aria-label': 'New task' });
    const title = el('input', { class: 'list-title', maxlength: 40, 'aria-label': 'List name' });
    title.addEventListener('change', () => { active().name = title.value.trim() || active().name; save(); });
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') title.blur(); });
    root.append(
      el('div', { class: 'list-tabs' }),
      el('div', { class: 'list-head' }, title,
        U.iconBtn('trash', { class: 'icon-btn del-list', title: 'Delete this list', 'aria-label': 'Delete this list', onclick: () => {
          const l = active();
          if (!confirm(`Delete the list “${l.name}” and its ${l.items.length} task(s)?`)) return;
          data.lists = data.lists.filter((x) => x !== l);
          U.forget(l.id);
          data.active = data.lists[0].id;
          save();
        } })),
      el('form', { class: 'add-row', onsubmit: (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        active().items.push({ id: U.uid(), text, done: false, doneAt: null, created: U.dayKey() });
        input.value = '';
        save();
      } }, input, el('button', { type: 'submit', class: 'pill', text: 'Add' })),
      el('ol', { class: 'todo-list' }),
      el('p', { class: 'hint empty', text: 'Nothing here yet. Add tasks above, then drag them into priority order. The ◎ button sends a task to the timer.' }),
      el('div', { class: 'todo-foot' },
        el('span', { class: 'todo-count hint' }),
        el('button', { type: 'button', class: 'link clear-done', text: 'Clear completed', onclick: () => {
          const l = active();
          // Keep a record of what was finished so the calendar still shows it.
          const archive = L.store.load('todoArchive', []);
          archive.push(...l.items.filter((i) => i.done).map((i) => ({ text: i.text, list: l.name, doneAt: i.doneAt })));
          L.store.save('todoArchive', archive);
          l.items.filter((i) => i.done).forEach((i) => U.forget(i.id));
          l.items = l.items.filter((i) => !i.done);
          save();
        } })),
    );
    U.sortable(U.$('.todo-list', root), (from, to) => { U.move(active().items, from, to); save(); });
    render();
  };
  T.onOpen = render;
  T.reload = () => { // new data arrived from another device (sync)
    data = L.store.load('todos', DEFAULT);
    if (root) U.keepFocus(root, render);
    if (T.onChange) T.onChange();
  };

  // Include cleared tasks too, so history isn't lost.
  const liveDoneOn = T.doneOn;
  T.doneOn = (key) => [...liveDoneOn(key), ...L.store.load('todoArchive', []).filter((a) => a.doneAt === key)];

  L.Todos = T;
})();
