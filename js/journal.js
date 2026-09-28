// Journal: dated entries with a title and free text, saved as you type.
// Backups (download, Google Drive) live in backup.js.
(function () {
  'use strict';
  const L = window.Lofi, U = L.util, { el } = U;

  let entries = L.store.load('journal', []); // [{ id, date: 'YYYY-MM-DD', title, body, created, updated }]
  let current = null, root = null, query = '', saveTimer = null;

  const PROMPTS = [
    'How did today go?', 'What are you grateful for today?', 'What’s one thing you learned?',
    'What drained you, and what gave you energy?', 'What would make tomorrow great?',
    'What’s on your mind right now?', 'What did you get done today?', 'What are you looking forward to?',
  ];

  const J = { onChange: null };
  J.entries = () => entries;
  J.onDay = (key) => entries.filter((e) => e.date === key);
  const sorted = () => [...entries].sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created));
  const titleOf = (e) => e.title.trim() || e.body.trim().split('\n')[0].slice(0, 60) || 'Untitled';

  function persist() {
    L.store.save('journal', entries);
    if (J.onChange) J.onChange();
  }

  function create(date = U.dayKey()) {
    const e = { id: U.uid(), date, title: '', body: '', created: Date.now(), updated: Date.now() };
    entries.push(e);
    persist();
    return e;
  }

  function select(e) {
    current = e;
    renderList();
    renderEditor();
  }

  function renderList() {
    if (!root) return;
    const q = query.toLowerCase();
    const shown = sorted().filter((e) => !q || (e.title + ' ' + e.body).toLowerCase().includes(q));
    let lastMonth = '';
    const items = [];
    for (const e of shown) {
      const d = U.fromKey(e.date), month = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (month !== lastMonth) { items.push(el('li', { class: 'j-month', text: month })); lastMonth = month; }
      items.push(el('li', {}, el('button', {
        type: 'button', class: 'j-item' + (e === current ? ' active' : ''), onclick: () => select(e),
      }, el('span', { class: 'j-date', text: U.fmtDate(d) }), el('span', { class: 'j-title', text: titleOf(e) }))));
    }
    U.$('.j-list', root).replaceChildren(...items);
    U.$('.j-none', root).hidden = shown.length > 0;
    U.$('.j-none', root).textContent = entries.length ? 'No entries match.' : 'No entries yet.';
  }

  function renderEditor() {
    if (!root) return;
    const ed = U.$('.j-editor', root), empty = U.$('.j-blank', root);
    ed.hidden = !current;
    empty.hidden = !!current;
    if (!current) return;
    U.$('.j-when', root).value = current.date;
    U.$('.j-title-in', root).value = current.title;
    const body = U.$('.j-body', root);
    body.value = current.body;
    body.placeholder = PROMPTS[(current.created / 1000 | 0) % PROMPTS.length];
    updateMeta('Saved');
  }

  function updateMeta(status) {
    const words = (current.body.match(/\S+/g) || []).length;
    U.$('.j-meta', root).textContent = `${words} word${words === 1 ? '' : 's'} · ${status}`;
  }

  // Save shortly after typing stops.
  function edited(field, value) {
    current[field] = value;
    current.updated = Date.now();
    updateMeta('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { persist(); renderList(); updateMeta('Saved'); }, 400);
  }

  J.open = (id) => {
    const e = entries.find((x) => x.id === id);
    L.ui.openPanel('journal');
    if (e) select(e);
  };
  J.newFor = (key) => {
    L.ui.openPanel('journal');
    select(create(key));
    U.$('.j-body', root).focus();
  };

  J.init = (container) => {
    root = container;
    const search = el('input', { type: 'search', placeholder: 'Search entries', 'aria-label': 'Search journal' });
    search.addEventListener('input', () => { query = search.value; renderList(); });
    const when = el('input', { type: 'date', class: 'j-when', 'aria-label': 'Entry date' });
    when.addEventListener('change', () => { if (when.value) { edited('date', when.value); } });
    const title = el('input', { type: 'text', class: 'j-title-in', placeholder: 'Title', maxlength: 120, 'aria-label': 'Entry title' });
    title.addEventListener('input', () => edited('title', title.value));
    const body = el('textarea', { class: 'j-body', 'aria-label': 'Journal entry' });
    body.addEventListener('input', () => edited('body', body.value));

    root.append(
      el('div', { class: 'j-side' },
        el('button', { type: 'button', class: 'pill j-new', text: '+ New entry', onclick: () => { select(create()); body.focus(); } }),
        search,
        el('ul', { class: 'j-list' }),
        el('p', { class: 'hint j-none' })),
      el('div', { class: 'j-main' },
        el('div', { class: 'j-blank' },
          el('p', { text: 'Pick an entry, or start a new one.' }),
          el('button', { type: 'button', class: 'pill', text: 'Write today’s entry', onclick: () => {
            const today = J.onDay(U.dayKey())[0];
            select(today || create());
            body.focus();
          } })),
        el('div', { class: 'j-editor' },
          el('div', { class: 'j-top' }, when,
            U.iconBtn('trash', { class: 'icon-btn del', title: 'Delete entry', 'aria-label': 'Delete entry', onclick: () => {
              if (!confirm(`Delete “${titleOf(current)}”? This can’t be undone (unless you have a backup).`)) return;
              entries = entries.filter((x) => x !== current);
              U.forget(current.id);
              persist();
              select(null);
            } })),
          title, body,
          el('div', { class: 'j-meta hint' }))),
      el('div', { class: 'j-backup' },
        el('span', { class: 'hint j-sync' }),
        el('button', { type: 'button', class: 'pill small', text: 'Save to Google Drive', onclick: () => L.Backup.saveToDrive() }),
        el('button', { type: 'button', class: 'pill small ghost', text: 'Download', title: 'Download the journal as a Markdown file', onclick: () => L.Backup.downloadJournal() })),
    );
    renderList();
    renderEditor();
  };
  // New data arrived from another device (sync). Keep the open entry open, and
  // don't touch the editor while you're typing in it.
  J.reload = () => {
    entries = L.store.load('journal', []);
    const id = current && current.id;
    current = id ? entries.find((e) => e.id === id) || null : null;
    if (!root) return;
    renderList();
    const typing = [U.$('.j-body', root), U.$('.j-title-in', root)].includes(document.activeElement);
    if (!typing) renderEditor();
  };

  J.onOpen = () => {
    renderList();
    if (!current) { const latest = sorted()[0]; if (latest) select(latest); else renderEditor(); }
    if (L.Backup) L.Backup.renderStatus();
  };

  // Markdown export of every entry, newest first.
  J.markdown = () => ['# Journal', '', ...sorted().flatMap((e) => [
    `## ${U.fmtDate(U.fromKey(e.date), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}${e.title.trim() ? ` — ${e.title.trim()}` : ''}`,
    '', e.body.trim(), '', '---', '',
  ])].join('\n');

  L.Journal = J;
})();
