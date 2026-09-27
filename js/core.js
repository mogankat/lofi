// Shared namespace, localStorage wrapper and small UI helpers. Everything is
// saved in the browser only — there is no server, account, or tracking.
window.Lofi = window.Lofi || {};

(function () {
  'use strict';
  const PREFIX = 'lofi.';
  const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

  Lofi.store = {
    PREFIX,
    load(key, def) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw == null) return clone(def);
        const v = JSON.parse(raw);
        // Merge plain objects over defaults so new settings get sane values.
        if (def && typeof def === 'object' && !Array.isArray(def) && v && typeof v === 'object') {
          return { ...clone(def), ...v };
        }
        return v;
      } catch (e) {
        return clone(def);
      }
    },
    save(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* private mode */ }
      if (Lofi.store.onSave) Lofi.store.onSave(key);
    },
    onSave: null, // set by backup.js for automatic Drive saves
  };

  const pad = (n) => String(n).padStart(2, '0');

  const U = {
    $: (s, root = document) => root.querySelector(s),
    $$: (s, root = document) => [...root.querySelectorAll(s)],

    // el('button', { class: 'x', text: 'Hi', onclick: fn }, child, …)
    el(tag, attrs = {}, ...children) {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (k in e && typeof v !== 'string') e[k] = v;
        else e.setAttribute(k, v === true ? '' : v);
      }
      for (const c of children.flat()) if (c != null && c !== false) e.append(c);
      return e;
    },

    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),

    // Dates are stored as local "YYYY-MM-DD" keys.
    dayKey: (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    fromKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); },
    addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; },
    weekStart(d) {
      const start = Lofi.store.load('prefs', {}).weekStart || 0; // 0 = Sunday, 1 = Monday
      return U.addDays(d, -((d.getDay() - start + 7) % 7));
    },
    fmtDate: (d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => d.toLocaleDateString(undefined, opts),
    fmtDuration(ms, cs = false) {
      const neg = ms < 0; ms = Math.abs(ms);
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
      let out = h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
      if (cs) out += `.${pad(Math.floor((ms % 1000) / 10))}`;
      return (neg ? '-' : '') + out;
    },
    fmtMinutes: (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`),

    // Re-render inside `root` without losing keyboard focus: the focused
    // control is found again afterwards by its aria-label.
    keepFocus(root, render) {
      const a = document.activeElement, label = a && root.contains(a) && a.getAttribute('aria-label');
      render();
      if (label) { const again = root.querySelector(`[aria-label="${CSS.escape(label)}"]`); if (again) again.focus(); }
    },

    move(arr, from, to) { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); return arr; },

    toast(msg, ms = 4500) {
      const el = document.getElementById('toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(U.toast.t);
      U.toast.t = setTimeout(() => el.classList.remove('show'), ms);
    },

    download(name, text, type = 'text/plain') {
      const a = U.el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    // Reorder the children of `list` by dragging their `.drag-handle`, or by
    // focusing a handle and pressing ↑/↓. Children need a data-idx attribute.
    sortable(list, onMove) {
      list.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle || e.button !== 0) return;
        const items = [...list.children], item = handle.closest('[data-idx]'), from = items.indexOf(item);
        if (from < 0) return;
        e.preventDefault();
        const rects = items.map((i) => i.getBoundingClientRect());
        const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
        const step = rects[from].height + gap, startY = e.clientY;
        let to = from;
        handle.setPointerCapture(e.pointerId);
        item.classList.add('dragging');
        const onMoveEv = (ev) => {
          const dy = ev.clientY - startY, mid = rects[from].top + rects[from].height / 2 + dy;
          to = rects.findIndex((r) => mid < r.bottom);
          if (to < 0) to = items.length - 1;
          item.style.transform = `translateY(${dy}px)`;
          items.forEach((it, i) => {
            if (i === from) return;
            const shift = from < to && i > from && i <= to ? -step : from > to && i >= to && i < from ? step : 0;
            it.style.transform = shift ? `translateY(${shift}px)` : '';
          });
        };
        const done = () => {
          handle.removeEventListener('pointermove', onMoveEv);
          items.forEach((it) => { it.style.transform = ''; });
          item.classList.remove('dragging');
          if (to !== from) onMove(from, to);
        };
        handle.addEventListener('pointermove', onMoveEv);
        handle.addEventListener('pointerup', done, { once: true });
        handle.addEventListener('pointercancel', done, { once: true });
      });
      list.addEventListener('keydown', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        e.stopPropagation();
        const items = [...list.children], from = items.indexOf(handle.closest('[data-idx]'));
        const to = from + (e.key === 'ArrowUp' ? -1 : 1);
        if (from < 0 || to < 0 || to >= items.length) return;
        onMove(from, to);
        const again = list.children[to] && list.children[to].querySelector('.drag-handle');
        if (again) again.focus();
      });
    },

    ICON: {
      grip: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg>',
      x: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
      trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
      play: '<svg class="fill" viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
      pause: '<svg class="fill" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
      reset: '<svg viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
      left: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
      right: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
      plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
      focus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
    },
  };

  // Tiny helper: element whose innerHTML is an icon.
  U.iconBtn = (name, attrs = {}) => U.el('button', { type: 'button', class: 'icon-btn', html: U.ICON[name], ...attrs });

  Lofi.util = U;
})();
