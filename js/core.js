// Shared namespace + tiny localStorage wrapper. Everything is saved in the
// browser only — there is no server, account, or tracking.
window.Lofi = window.Lofi || {};

(function () {
  'use strict';
  const PREFIX = 'lofi.';
  const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

  Lofi.store = {
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
    },
  };
})();
