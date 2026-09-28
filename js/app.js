// Wires the timer, music, ambient sounds and scenes to the page.
(function () {
  'use strict';
  const L = window.Lofi;
  const { Timer, Ambient, Music, Weather, scenes, util: U } = L;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const ICON = {
    play: '<svg class="fill" viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
    pause: '<svg class="fill" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  };

  const LOOK = { outfit: null, hair: null, gear: 'phones', accent: null, furniture: null, tent: null, pet: 'cat', petColor: null, friend: false };
  const prefs = L.store.load('prefs', {
    scene: 'study', fps: 30, idleFade: true, autoMix: false, task: '', lighting: 'auto', timerPos: null, weekStart: 0,
    look: LOOK, soundVisuals: true, timerOpen: true, clock: { on: true, fmt: '12', seconds: false }, clockPos: null,
  });
  prefs.look = { ...LOOK, ...prefs.look };
  delete prefs.look.birds; // birds now follow the bird sounds
  if (typeof prefs.look.gear === 'boolean') prefs.look.gear = prefs.look.gear ? 'phones' : 'none'; // was an on/off switch
  const savePrefs = () => L.store.save('prefs', prefs);
  const toast = U.toast;

  // ======================= Scene rendering =======================
  const canvas = $('#scene'), ctx = canvas.getContext('2d');
  const H = 270;
  let W = 480, t = 0, last = performance.now(), fadeStart = 0, snap = null;
  let scene = scenes.byId[prefs.scene] || scenes.list[0], inst = null, tod = null;
  const weather = { flash: 0, drops: [], key: '', gusts: [], gustKey: '' };
  const currentTod = () => (prefs.lighting === 'auto' ? scenes.autoPhase() : prefs.lighting);

  // How strongly each ambient sound shows up in the scene (0 when turned off).
  const NO_FX = { rain: 0, wind: 0, birds: 0, crickets: 0 };
  function soundFx() {
    if (!prefs.soundVisuals) return NO_FX;
    const v = (id) => Math.min(1, Ambient.getVolume(id) * 1.4);
    return { rain: v('rain'), wind: v('wind'), birds: v('birds'), crickets: v('crickets') };
  }

  function drawRain(c, r, speed, dt, amount) {
    const want = Math.round(amount * r.w * r.h / 160);
    const key = `${r.x},${r.y},${r.w},${r.h}`;
    if (key !== weather.key) { weather.key = key; weather.drops.length = 0; }
    const d = weather.drops;
    while (d.length < want) d.push({ x: r.x - 20 + Math.random() * (r.w + 20), y: r.y + Math.random() * r.h, v: 160 + Math.random() * 90, len: 4 + Math.random() * 6 });
    if (d.length > want) d.length = want;
    if (!want) return;
    c.fillStyle = 'rgba(190,210,240,0.38)';
    const len = 0.6 + 0.4 * speed;
    for (const p of d) {
      p.y += p.v * speed * dt;
      p.x += p.v * speed * 0.12 * dt;
      if (p.y > r.y + r.h) { p.y = r.y - p.len - Math.random() * 20; p.x = r.x - 20 + Math.random() * (r.w + 20); }
      c.fillRect(p.x | 0, p.y | 0, 1, Math.round(p.len * len));
    }
  }

  // Wind: leaves and streaks of air blowing across `r`.
  const GUST_LEAVES = ['#d98a40', '#c4543a', '#e3b04b', '#8aa05a', '#b86a3a'];
  function drawWind(c, r, dt, amount) {
    const want = Math.round(amount * r.w * r.h / 2200);
    const key = `${r.x},${r.y},${r.w},${r.h}`;
    if (key !== weather.gustKey) { weather.gustKey = key; weather.gusts.length = 0; }
    const g = weather.gusts;
    const spawn = (anywhere) => ({
      x: anywhere ? r.x + Math.random() * r.w : r.x - 10 - Math.random() * 40, y: r.y + Math.random() * r.h,
      v: 70 + Math.random() * 90, ph: Math.random() * 6.3, rot: Math.random() * 6.3, leaf: Math.random() < 0.55,
      col: GUST_LEAVES[(Math.random() * GUST_LEAVES.length) | 0], len: 6 + Math.random() * 10,
    });
    while (g.length < want) g.push(spawn(true));
    if (g.length > want) g.length = want;
    if (!want) return;
    const dim = tod === 'night' ? 0.5 : 1;
    for (const p of g) {
      p.x += p.v * (0.6 + amount) * dt;
      p.y += (Math.sin(t * 2 + p.ph) * 14 + 5) * dt;
      p.rot += dt * 7;
      if (p.x > r.x + r.w + 12 || p.y > r.y + r.h + 6) Object.assign(p, spawn(false));
      if (p.leaf) {
        c.globalAlpha = dim;
        const w = 1 + Math.abs(Math.cos(p.rot)) * 2.5;
        c.fillStyle = p.col; c.fillRect(p.x | 0, p.y | 0, Math.round(w), 2);
      } else {
        c.globalAlpha = 0.18 * dim;
        c.fillStyle = '#ffffff'; c.fillRect(p.x | 0, p.y | 0, Math.round(p.len), 1);
      }
    }
    c.globalAlpha = 1;
  }

  // Scenes are drawn in a 270px-tall band. On tall screens (a phone held
  // upright) the canvas is taller than the band: the whole scene width stays
  // visible and the band's top and bottom edges are stretched to fill the rest,
  // instead of cropping the sides away.
  let CH = H, bandY = 0;
  function resize() {
    const aspect = innerWidth / innerHeight, a = isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
    W = Math.max(360, Math.round(H * a));
    CH = Math.max(H, Math.round(W / a));
    bandY = Math.round((CH - H) * 0.55);
    canvas.width = W;
    canvas.height = CH;
    inst = scene.create(W, H);
  }
  // The extensions are filled with the *average* colours of the band's top and
  // bottom rows (in a few horizontal zones), re-read a few times a second, so
  // they're smooth fades rather than streaks of whatever sat on the edge.
  const EDGE = 4;
  let edgeCols = null, edgeAt = 0;
  const rowCanvas = document.createElement('canvas'); // small CPU-side copy, so the main canvas stays GPU-backed
  rowCanvas.height = 1;
  const rowCtx = rowCanvas.getContext('2d', { willReadFrequently: true });
  function sampleRow(y) {
    if (rowCanvas.width !== W) rowCanvas.width = W;
    rowCtx.drawImage(canvas, 0, y, W, 1, 0, 0, W, 1);
    const px = rowCtx.getImageData(0, 0, W, 1).data, zone = W / EDGE, out = [];
    for (let z = 0; z < EDGE; z++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let x = Math.floor(z * zone); x < Math.floor((z + 1) * zone); x++) { r += px[x * 4]; g += px[x * 4 + 1]; b += px[x * 4 + 2]; n++; }
      out.push(`rgb(${(r / n) | 0},${(g / n) | 0},${(b / n) | 0})`);
    }
    return out;
  }
  function fillZones(cols, y, h) {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    cols.forEach((col, i) => g.addColorStop((i + 0.5) / EDGE, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, h);
  }
  function extendBand(now) {
    const below = CH - bandY - H;
    if (!edgeCols || now - edgeAt > 250) {
      edgeCols = { top: sampleRow(bandY), bottom: sampleRow(bandY + H - 1) };
      edgeAt = now;
    }
    fillZones(edgeCols.top, 0, bandY);
    fillZones(edgeCols.bottom, bandY + H, below);
    const up = ctx.createLinearGradient(0, 0, 0, bandY);
    up.addColorStop(0, 'rgba(0,0,0,0.35)'); up.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = up; ctx.fillRect(0, 0, W, bandY);
    const down = ctx.createLinearGradient(0, bandY + H, 0, CH);
    down.addColorStop(0, 'rgba(0,0,0,0)'); down.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = down; ctx.fillRect(0, bandY + H, W, below);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < 1000 / prefs.fps - 2) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    weather.flash = Math.max(0, weather.flash - dt * 2.5);
    const nowTod = currentTod();
    if (nowTod !== tod) { // lighting changed (picked, or Auto crossed into a new part of the day)
      if (tod) crossfade();
      tod = nowTod;
      Ambient.setNight(tod === 'night'); // bird sounds become owl hoots
      renderThumbs();
    }
    const fx = soundFx();
    const env = {
      tod, look: prefs.look, fx, flash: weather.flash,
      drawRain: (c, r, speed) => drawRain(c, r, speed || 1, dt, fx.rain),
      drawWind: (c, r) => drawWind(c, r, dt, fx.wind),
    };

    ctx.save();
    ctx.translate(0, bandY);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    inst.draw(ctx, t, dt, env);
    ctx.restore();
    if (bandY) extendBand(now);
    if (scene.outdoor) {
      const all = { x: 0, y: 0, w: W, h: CH };
      if (fx.wind > 0) env.drawWind(ctx, all);
      if (fx.rain > 0) {
        ctx.fillStyle = `rgba(25,30,60,${0.2 * fx.rain})`;
        ctx.fillRect(0, 0, W, CH);
        env.drawRain(ctx, all);
      }
      if (weather.flash > 0) {
        ctx.fillStyle = `rgba(225,230,255,${weather.flash * 0.4})`;
        ctx.fillRect(0, 0, W, CH);
      }
    }
    if (snap) { // cross-fade from the previous scene
      const a = 1 - (now - fadeStart) / 800;
      if (a <= 0) snap = null;
      else { ctx.globalAlpha = a; ctx.drawImage(snap, 0, 0); ctx.globalAlpha = 1; }
    }
  }

  Ambient.onLightning = (i) => {
    if (!prefs.soundVisuals) return;
    weather.flash = Math.max(weather.flash, 0.5 + 0.5 * i);
    setTimeout(() => { weather.flash = Math.max(weather.flash, 0.6 * i); }, 160);
  };

  function crossfade() {
    snap = document.createElement('canvas');
    snap.width = W; snap.height = CH;
    snap.getContext('2d').drawImage(canvas, 0, 0);
    fadeStart = performance.now();
  }

  function setScene(id) {
    if (!scenes.byId[id]) return;
    crossfade();
    scene = scenes.byId[id];
    inst = scene.create(W, H);
    prefs.scene = id;
    savePrefs();
    $$('.scene-card').forEach((b) => b.classList.toggle('active', b.dataset.scene === id));
    if (prefs.autoMix) Ambient.setMix(scene.mix);
  }
  function nextScene() {
    const i = scenes.list.indexOf(scene);
    setScene(scenes.list[(i + 1) % scenes.list.length].id);
  }

  function setLighting(v) {
    prefs.lighting = v;
    savePrefs();
    Ambient.setNight(currentTod() === 'night'); // bird sounds become owl hoots at night
    $$('#lightingSeg button').forEach((b) => {
      const on = b.dataset.tod === v;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
    const auto = $('#lightingSeg [data-tod="auto"]');
    auto.textContent = v === 'auto' ? `Auto · ${scenes.autoPhase()[0].toUpperCase()}${scenes.autoPhase().slice(1)}` : 'Auto';
  }
  function cycleLighting() {
    const opts = ['auto', ...scenes.TOD];
    setLighting(opts[(opts.indexOf(prefs.lighting) + 1) % opts.length]);
  }

  const thumbs = [];
  function renderThumbs() {
    for (const th of thumbs) {
      const env = { tod: currentTod(), look: prefs.look, fx: NO_FX, flash: 0, drawRain() {}, drawWind() {} }, i = th.scene.create(480, 270);
      for (let k = 0; k < 20; k++) { th.c.save(); i.draw(th.c, 4 + k * 0.1, 0.1, env); th.c.restore(); } // warm up particles
    }
  }

  function buildSceneGrid() {
    const grid = $('#sceneGrid');
    for (const s of scenes.list) {
      const b = document.createElement('button');
      b.className = 'scene-card' + (s === scene ? ' active' : '');
      b.dataset.scene = s.id;
      const cv = document.createElement('canvas');
      cv.width = 480; cv.height = 270;
      thumbs.push({ scene: s, c: cv.getContext('2d') });
      const label = document.createElement('span');
      label.textContent = s.name;
      b.append(cv, label);
      b.addEventListener('click', () => setScene(s.id));
      grid.append(b);
    }
    $$('#lightingSeg button').forEach((b) => b.addEventListener('click', () => setLighting(b.dataset.tod)));
    setLighting(prefs.lighting);
    setInterval(() => { if (prefs.lighting === 'auto') setLighting('auto'); }, 60000); // keep the "Auto · …" label current
    const auto = $('#autoMix');
    auto.checked = prefs.autoMix;
    auto.addEventListener('change', () => {
      prefs.autoMix = auto.checked;
      savePrefs();
      if (auto.checked) Ambient.setMix(scene.mix);
    });
  }

  // ---- scene customisation (its own panel, in collapsible sections) ----
  const SWATCHES = {
    outfit: ['#b86b77', '#d9a066', '#6f8fb8', '#7f9c8a', '#8a6aa8', '#e8dccb', '#3b3b4f', '#c8584a'],
    hair: ['#2b1d2a', '#4a2c2a', '#7a4a2a', '#c89a5a', '#e8d8b0', '#8a8a96', '#c0504d', '#5a7ad0'],
    accent: ['#d9d2ea', '#3a3548', '#c9574a', '#f0c05a', '#6fb0a0', '#e890b0', '#5a78c0', '#f4f4f4'],
    furniture: ['#3d3a4a', '#6a3a4a', '#9b6440', '#3f6f8f', '#5a7a5a', '#c8a878', '#2a2830', '#a8584a'],
    tent: ['#5a4637', '#c0504d', '#3f6f8f', '#6a8a4a', '#e0a040', '#7a5a9a'],
    petColor: ['#3b3450', '#e8e2d8', '#d98a40', '#8a8a96', '#6a4a30', '#1a1a22'],
  };
  function setLook(key, value) {
    prefs.look[key] = value;
    savePrefs();
    renderLook();
    renderThumbs();
  }
  function colorRow(key, label) {
    const custom = U.el('input', { type: 'color', class: 'swatch-custom', title: 'Pick any colour', 'aria-label': `${label}: custom colour` });
    custom.addEventListener('input', () => setLook(key, custom.value));
    return U.el('div', { class: 'look-row', 'data-key': key },
      U.el('span', { class: 'look-label', text: label }),
      U.el('div', { class: 'swatches' },
        U.el('button', { type: 'button', class: 'swatch auto', text: 'Auto', title: 'Scene’s own colour', 'data-value': '', onclick: () => setLook(key, null) }),
        ...SWATCHES[key].map((c) => U.el('button', { type: 'button', class: 'swatch', style: `--c:${c}`, 'data-value': c, 'aria-label': `${label} ${c}`, onclick: () => setLook(key, c) })),
        custom));
  }
  // A collapsible section; only one is open at a time (details[name]).
  function section(id, title, open, ...body) {
    return U.el('details', { class: 'acc', name: 'look', open, 'data-acc': id },
      U.el('summary', {}, U.el('span', { text: title }), U.el('span', { class: 'acc-peek' })),
      U.el('div', { class: 'acc-body' }, ...body));
  }
  function buildLook() {
    $('#lookControls').append(
      section('character', 'Character', true, colorRow('outfit', 'Outfit'), colorRow('hair', 'Hair'),
        U.el('div', { class: 'look-row' }, U.el('span', { class: 'look-label', text: 'On your head' }),
          U.el('div', { class: 'seg small', id: 'gearSeg' }, ...[['phones', 'Headphones'], ['hat', 'Hat'], ['none', 'None']].map(([v, text]) =>
            U.el('button', { type: 'button', 'data-gear': v, text, onclick: () => setLook('gear', v) })))),
        colorRow('accent', 'Headphones / hat colour')),
      section('pet', 'Pet', false,
        U.el('div', { class: 'seg small', id: 'petSeg' }, ...[['none', 'None'], ['cat', 'Cat'], ['dog', 'Dog']].map(([v, text]) =>
          U.el('button', { type: 'button', 'data-pet': v, text, onclick: () => setLook('pet', v) }))),
        colorRow('petColor', 'Colour')),
      section('things', 'Furniture & tent', false, colorRow('furniture', 'Chairs, stools, bench & dock'), colorRow('tent', 'Tent (campfire)')),
      section('company', 'Company', false,
        U.el('label', { class: 'check' }, U.el('input', { type: 'checkbox', id: 'lookFriend', onchange: (e) => setLook('friend', e.target.checked) }), 'Bring a friend'),
        U.el('p', { class: 'hint', text: 'They join you in every scene except the study desk.' })),
      section('sounds', 'Sounds in the scene', false,
        U.el('label', { class: 'check' }, U.el('input', { type: 'checkbox', id: 'soundVisuals', onchange: (e) => { prefs.soundVisuals = e.target.checked; savePrefs(); renderLook(); } }), 'Show ambient sounds in the scene'),
        U.el('ul', { class: 'fx-list hint' },
          U.el('li', { text: '🌧️ Rain → rain on screen or the window' }),
          U.el('li', { text: '⛈️ Thunder → lightning flashes' }),
          U.el('li', { text: '🍃 Wind → blowing leaves, swaying trees and curtains' }),
          U.el('li', { text: '🐦 Birds → birds about (owls at night)' }),
          U.el('li', { text: '🦗 Crickets → fireflies after dark' }))),
      U.el('button', { type: 'button', class: 'link reset-look', text: 'Reset to defaults', onclick: () => { prefs.look = { ...LOOK }; savePrefs(); renderLook(); renderThumbs(); } }),
    );
    renderLook();
  }
  function renderLook() {
    $$('.look-row[data-key]').forEach((row) => {
      const v = prefs.look[row.dataset.key] || '';
      row.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('active', b.dataset.value === v));
      const custom = row.querySelector('.swatch-custom');
      custom.classList.toggle('active', !!v && !SWATCHES[row.dataset.key].includes(v));
      if (v) custom.value = v;
    });
    $$('#petSeg button').forEach((b) => b.classList.toggle('active', b.dataset.pet === prefs.look.pet));
    $('.look-row[data-key="petColor"]').hidden = prefs.look.pet === 'none';
    $('#lookFriend').checked = prefs.look.friend;
    $$('#gearSeg button').forEach((b) => b.classList.toggle('active', b.dataset.gear === prefs.look.gear));
    $('.look-row[data-key="accent"]').hidden = prefs.look.gear === 'none';
    $('#soundVisuals').checked = prefs.soundVisuals;
    // Little previews in each closed section's header.
    const dot = (c) => U.el('i', { class: 'peek-dot' + (c ? '' : ' auto'), style: c ? `--c:${c}` : null });
    const peek = (id, ...kids) => $(`[data-acc="${id}"] .acc-peek`).replaceChildren(...kids);
    peek('character', dot(prefs.look.outfit), dot(prefs.look.hair), prefs.look.gear === 'none' ? '' : dot(prefs.look.accent));
    peek('pet', prefs.look.pet === 'none' ? 'None' : prefs.look.pet === 'cat' ? 'Cat' : 'Dog');
    peek('things', dot(prefs.look.furniture), dot(prefs.look.tent));
    peek('company', prefs.look.friend ? 'Friend' : 'Just you');
    peek('sounds', prefs.soundVisuals ? 'On' : 'Off');
  }

  function renderClockSettings() {
    $$('#clockFmt button').forEach((b) => b.classList.toggle('active', b.dataset.fmt === prefs.clock.fmt));
    $('#clockOpts').hidden = !prefs.clock.on;
  }

  // ======================= Standalone clock =======================
  const clockEl = $('#clockCard');
  function renderClock() {
    const cfg = prefs.clock, now = new Date();
    clockEl.hidden = !cfg.on;
    if (!cfg.on) return;
    const h24 = cfg.fmt === '24', h = now.getHours();
    const hh = h24 ? String(h).padStart(2, '0') : String(h % 12 || 12);
    const mm = String(now.getMinutes()).padStart(2, '0'), ss = String(now.getSeconds()).padStart(2, '0');
    $('#clockTime').textContent = cfg.seconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
    $('#clockAmpm').textContent = h24 ? '' : h < 12 ? 'AM' : 'PM';
    $('#clockDate').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  (function tickClock() { renderClock(); setTimeout(tickClock, 1000 - (Date.now() % 1000) + 5); })();

  // ======================= Timer UI =======================
  function renderTimer() {
    const started = Timer.started;
    document.body.dataset.mode = Timer.mode;
    document.body.classList.toggle('timer-running', Timer.running); // zen mode only shows the timer while it runs
    // While the timer is closed but running, the dock button shows the countdown.
    $('#timerBadge').textContent = !prefs.timerOpen && Timer.running ? Timer.format(Timer.remaining) : '';
    $('#time').textContent = Timer.format(Timer.remaining);
    $('#progressBar').style.width = (Math.min(1, Math.max(0, 1 - Timer.remaining / Timer.total)) * 100).toFixed(2) + '%';
    const label = Timer.LABEL[Timer.mode].toLowerCase();
    $('#minusBtn').title = started ? 'Take a minute off this session (Shift: 5)' : `Shorten ${label} by a minute (Shift: 5)`;
    $('#plusBtn').title = started ? 'Add a minute to this session (Shift: 5)' : `Lengthen ${label} by a minute (Shift: 5)`;
    for (const [id, key] of [['#setFocus', 'focus'], ['#setShort', 'short'], ['#setLong', 'long']]) {
      const el = $(id);
      if (document.activeElement !== el) el.value = Timer.settings[key];
    }
    $$('.modes button').forEach((b) => {
      const on = b.dataset.mode === Timer.mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
    $('#startBtn').textContent = Timer.running ? 'Pause' : started ? 'Resume' : 'Start';

    const n = Timer.settings.longEvery, filled = Timer.setProgress();
    const dots = $('#dots');
    if (dots.childElementCount !== n) dots.innerHTML = '<i></i>'.repeat(n);
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i < filled));
    const s = Timer.stats;
    $('#statsText').textContent = `${s.sessions} today · ${s.minutes >= 60 ? `${Math.floor(s.minutes / 60)}h ${s.minutes % 60}m` : `${s.minutes}m`}`;

    document.title = started ? `${Timer.format(Timer.remaining)} · ${Timer.LABEL[Timer.mode]}` : 'Lofi Focus';
  }

  Timer.onChange = renderTimer;
  Timer.onComplete = (was, next, length) => {
    Ambient.chime(Timer.settings.chime, was === 'focus');
    if (was === 'focus') L.GCal.logFocus(length, prefs.task.trim());
    const title = was === 'focus' ? 'Focus session done 🎉' : 'Break’s over';
    const body = next === 'focus' ? 'Time to get back to it.' : next === 'long' ? 'Enjoy a long break — you earned it.' : 'Take a short breather.';
    toast(`${title} ${body}`);
    if (Timer.settings.notify && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification(title, { body, silent: true }); } catch (e) { /* some browsers need a service worker */ }
    }
  };

  $$('.modes button').forEach((b) => b.addEventListener('click', () => Timer.setMode(b.dataset.mode)));
  $('#startBtn').addEventListener('click', () => Timer.toggle());
  $('#resetBtn').addEventListener('click', () => Timer.reset());
  $('#skipBtn').addEventListener('click', () => Timer.skip());

  // +/- buttons: click for 1 minute, Shift for 5, hold to keep going.
  for (const [id, sign] of [['#minusBtn', -1], ['#plusBtn', 1]]) {
    const btn = $(id);
    let hold = null;
    const stop = () => { clearTimeout(hold); clearInterval(hold); hold = null; };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const step = sign * (e.shiftKey ? 5 : 1);
      Timer.adjust(step);
      stop();
      hold = setTimeout(() => { hold = setInterval(() => Timer.adjust(step), 110); }, 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter') Timer.adjust(sign * (e.shiftKey ? 5 : 1)); });
  }

  // ---- drag the timer and clock cards around ----
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const canDrag = () => innerWidth > 640 && !document.body.classList.contains('zen');
  // Positions are stored as a fraction of the free space so they survive window resizes.
  function draggable(el, key) {
    const place = (x, y) => {
      el.style.setProperty('--x', `${Math.round(x)}px`);
      el.style.setProperty('--y', `${Math.round(y)}px`);
      el.classList.add('moved');
    };
    const apply = () => {
      const p = prefs[key];
      if (!p || el.hidden) { if (!p) el.classList.remove('moved'); return; }
      place(p.x * Math.max(0, innerWidth - el.offsetWidth), p.y * Math.max(0, innerHeight - el.offsetHeight));
    };
    const reset = () => { prefs[key] = null; savePrefs(); apply(); };
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !canDrag() || e.target.closest('button, input, select, a')) return;
      const r = el.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      el.classList.add('dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      place(clamp(e.clientX - drag.dx, 0, innerWidth - el.offsetWidth), clamp(e.clientY - drag.dy, 0, innerHeight - el.offsetHeight));
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      el.classList.remove('dragging');
      if (!el.classList.contains('moved')) return;
      const r = el.getBoundingClientRect();
      prefs[key] = { x: r.left / Math.max(1, innerWidth - r.width), y: r.top / Math.max(1, innerHeight - r.height) };
      savePrefs();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', (e) => { if (e.target.closest('.grip, .clock')) reset(); });
    return { apply, reset };
  }
  const timerDrag = draggable($('.timer'), 'timerPos');

  // ---- open / close the timer card ----
  function setTimerOpen(open) {
    prefs.timerOpen = open;
    savePrefs();
    document.body.classList.toggle('timer-closed', !open);
    const btn = $('#timerToggle');
    btn.classList.toggle('on', open);
    btn.setAttribute('aria-pressed', open);
    if (open) timerDrag.apply(); // it can't be measured while hidden
    renderTimer();
  }
  $('#timerClose').addEventListener('click', () => setTimerOpen(false));
  $('#timerToggle').addEventListener('click', () => setTimerOpen(!prefs.timerOpen));
  const clockDrag = draggable(clockEl, 'clockPos');
  const applyTimerPos = () => { timerDrag.apply(); clockDrag.apply(); };
  const resetTimerPos = () => { timerDrag.reset(); clockDrag.reset(); };

  // ---- temperature on the clock ----
  function renderWeather() {
    const cfg = Weather.cfg, line = $('#weather');
    const show = cfg.on && Weather.data;
    line.hidden = !show;
    if (show) {
      $('#weatherIcon').textContent = Weather.icon(Weather.data.code, Weather.data.day);
      $('#weatherTemp').textContent = Weather.format();
      const at = new Date(Weather.data.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      line.title = `${cfg.place} · updated ${at}`;
    }
    $('#setWeather').checked = cfg.on;
    $$('#unitSeg button').forEach((b) => b.classList.toggle('active', b.dataset.unit === cfg.unit));
    $('#weatherPlace').textContent = Weather.error && cfg.on
      ? Weather.error
      : !prefs.clock.on && cfg.on ? 'The temperature shows on the clock — turn the clock on above to see it.'
        : Weather.hasLocation() ? `Location: ${cfg.place}` : 'Set a city or use your current location.';
  }
  Weather.onChange = renderWeather;
  const task = $('#task');
  task.value = prefs.task || '';
  task.addEventListener('input', () => { prefs.task = task.value; savePrefs(); });
  task.addEventListener('keydown', (e) => { if (e.key === 'Enter') task.blur(); });

  // ======================= Music UI =======================
  const stationList = $('#stationList');
  function renderMusic() {
    const st = Music.current(), on = Music.playing || Music.loading, type = Music.activeType() || (st && st.type);
    $('#npPlay').innerHTML = on ? ICON.pause : ICON.play;
    $('#npPlay').setAttribute('aria-label', on ? 'Pause music' : 'Play music');
    $('#playSt').innerHTML = on ? ICON.pause : ICON.play;
    $('#playSt').setAttribute('aria-label', on ? 'Pause' : 'Play');
    const title = on ? Music.title || (st && st.name) : st ? st.name : 'Add a station';
    $('#npTitle').textContent = Music.loading && !Music.playing ? `Loading… ${title}` : title;
    $('#npTitle').title = title;

    const player = $('.player');
    player.classList.toggle('radio', type === 'stream');
    player.classList.toggle('empty', !Music.activeType() && type !== 'stream');
    player.classList.toggle('live', Music.playing);
    $('#radioName').textContent = type === 'stream' ? (st ? st.name : '') : 'Press play to start the music';

    stationList.innerHTML = '';
    Music.stations.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = i === Music.index ? 'active' : '';
      const play = document.createElement('button');
      play.className = 'st-play';
      const kind = document.createElement('span');
      kind.className = 'kind';
      kind.textContent = s.type === 'stream' ? 'RADIO' : 'YT';
      const name = document.createElement('span');
      name.textContent = s.name;
      play.append(kind, name);
      play.addEventListener('click', () => (i === Music.index && on ? Music.pause() : Music.play(i)));
      const del = document.createElement('button');
      del.className = 'st-del';
      del.title = 'Remove station';
      del.setAttribute('aria-label', `Remove ${s.name}`);
      del.innerHTML = ICON.x;
      del.addEventListener('click', () => Music.remove(i));
      li.append(play, del);
      stationList.append(li);
    });
  }
  Music.onChange = renderMusic;
  Music.onError = (msg) => toast(msg, 6000);

  $('#npPlay').addEventListener('click', () => Music.toggle());
  $('#playSt').addEventListener('click', () => Music.toggle());
  $('#prevSt').addEventListener('click', () => Music.prev());
  $('#nextSt').addEventListener('click', () => Music.next());
  const musicVol = $('#musicVol');
  musicVol.value = Music.volume;
  musicVol.addEventListener('input', () => Music.setVolume(+musicVol.value));
  $('#addStation').addEventListener('submit', (e) => {
    e.preventDefault();
    const i = Music.add($('#stUrl').value, $('#stName').value.trim());
    if (i < 0) return toast('Couldn’t recognise that link. Paste a YouTube URL or a direct stream URL.');
    $('#stUrl').value = '';
    $('#stName').value = '';
    Music.play(i);
  });
  $('#restoreStations').addEventListener('click', () => Music.restoreDefaults());

  // ======================= Ambient UI =======================
  const PRESETS = [
    ['This scene', () => scene.mix],
    ['Rainy night', () => ({ rain: 0.55, thunder: 0.3 })],
    ['Coffee shop', () => ({ cafe: 0.5, rain: 0.2 })],
    ['Forest', () => ({ birds: 0.35, wind: 0.25 })],
    ['Deep focus', () => ({ brown: 0.5 })],
    ['All off', () => ({})],
  ];
  function buildSounds() {
    const pre = $('#presets');
    for (const [label, mix] of PRESETS) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', () => Ambient.setMix(mix()));
      pre.append(b);
    }
    const list = $('#soundList');
    for (const s of Ambient.SOUNDS) {
      const row = document.createElement('label');
      row.className = 'sound-row';
      row.dataset.sound = s.id;
      row.innerHTML = `<span class="s-icon">${s.icon}</span><span class="s-name">${s.name}</span><input type="range" min="0" max="100" aria-label="${s.name} volume">`;
      const input = row.querySelector('input');
      input.addEventListener('input', () => Ambient.setVolume(s.id, input.value / 100));
      list.append(row);
    }
    const master = $('#ambientMaster');
    master.value = Math.round(Ambient.getMaster() * 100);
    master.addEventListener('input', () => Ambient.setMaster(master.value / 100));
    renderSounds();
  }
  function renderSounds() {
    $$('.sound-row[data-sound]').forEach((row) => {
      const v = Ambient.getVolume(row.dataset.sound), input = row.querySelector('input');
      if (document.activeElement !== input) input.value = Math.round(v * 100);
      row.classList.toggle('on', v > 0);
    });
  }
  Ambient.onChange = renderSounds;

  // ======================= Settings =======================
  function buildSettings() {
    const S = Timer.settings;
    const num = (id, key, lo, hi) => {
      const el = $(id);
      el.value = S[key];
      el.addEventListener('change', () => {
        const v = Math.round(Math.min(hi, Math.max(lo, +el.value || S[key])));
        el.value = v;
        Timer.updateSettings({ [key]: v });
      });
    };
    num('#setFocus', 'focus', 1, 180);
    num('#setShort', 'short', 1, 60);
    num('#setLong', 'long', 1, 90);
    num('#setEvery', 'longEvery', 1, 12);
    const check = (id, get, set) => { const el = $(id); el.checked = get(); el.addEventListener('change', () => set(el.checked, el)); };
    check('#setAutoBreak', () => S.autoBreak, (v) => Timer.updateSettings({ autoBreak: v }));
    check('#setAutoFocus', () => S.autoFocus, (v) => Timer.updateSettings({ autoFocus: v }));
    check('#setNotify', () => S.notify && 'Notification' in window && Notification.permission === 'granted', async (v, el) => {
      if (v && 'Notification' in window && Notification.permission !== 'granted') {
        const p = await Notification.requestPermission();
        if (p !== 'granted') { el.checked = false; toast('Notifications are blocked for this site in your browser settings.'); return; }
      } else if (v && !('Notification' in window)) {
        el.checked = false; toast('This browser doesn’t support notifications.'); return;
      }
      Timer.updateSettings({ notify: v });
    });
    check('#setIdle', () => prefs.idleFade, (v) => { prefs.idleFade = v; savePrefs(); });

    // clock
    const clockChanged = () => { savePrefs(); renderClock(); applyTimerPos(); renderWeather(); renderClockSettings(); };
    check('#setClock', () => prefs.clock.on, (v) => { prefs.clock.on = v; clockChanged(); });
    check('#setClockSec', () => prefs.clock.seconds, (v) => { prefs.clock.seconds = v; clockChanged(); });
    $$('#clockFmt button').forEach((b) => b.addEventListener('click', () => { prefs.clock.fmt = b.dataset.fmt; clockChanged(); }));
    renderClockSettings();

    // Google Calendar + automatic Drive saves
    check('#setGcalShow', () => L.GCal.cfg.show, (v) => L.GCal.setShow(v));
    check('#setGcalLog', () => L.GCal.cfg.logFocus, (v) => L.GCal.setLogFocus(v));
    $('#gcalConnect').addEventListener('click', () => L.GCal.connect());
    check('#setDriveAuto', () => L.store.load('driveAuto', false), (v) => L.store.save('driveAuto', v));
    $('#googleSignOut').addEventListener('click', () => { L.GCal.disconnect(); toast('Signed out of Google in this browser.'); });
    const chime = $('#setChime');
    chime.value = Math.round(S.chime * 100);
    chime.addEventListener('change', () => Timer.updateSettings({ chime: chime.value / 100 }));
    $('#testChime').addEventListener('click', () => Ambient.chime(chime.value / 100));
    const fps = $('#setFps');
    fps.value = String(prefs.fps);
    fps.addEventListener('change', () => { prefs.fps = +fps.value; savePrefs(); });
    $('#resetStats').addEventListener('click', () => Timer.resetStats());
    $('#resetPos').addEventListener('click', resetTimerPos);

    const week = $('#setWeekStart');
    week.value = String(prefs.weekStart || 0);
    week.addEventListener('change', () => { prefs.weekStart = +week.value; savePrefs(); });

    $('#downloadBackup').addEventListener('click', () => L.Backup.downloadBackup());
    $('#importBackup').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) L.Backup.importFile(f); e.target.value = ''; });
    $('#driveSave').addEventListener('click', () => L.Backup.saveToDrive());
    $('#driveRestore').addEventListener('click', () => L.Backup.restoreFromDrive());
    const cid = $('#setClientId');
    cid.value = L.store.load('googleClientId', '');
    cid.addEventListener('change', () => { L.store.save('googleClientId', cid.value.trim()); L.Google.preload(); L.Backup.renderStatus(); });
    if (!L.Backup.clientId()) $('.drive-setup').open = true;
    L.Backup.renderStatus();

    const locate = () => Weather.locate().catch((e) => { toast(e.message, 6000); $('#setCity').focus(); });
    $('#setWeather').addEventListener('change', (e) => {
      Weather.setOn(e.target.checked);
      if (e.target.checked && !Weather.hasLocation()) locate();
    });
    $$('#unitSeg button').forEach((b) => b.addEventListener('click', () => Weather.setUnit(b.dataset.unit)));
    $('#useLocation').addEventListener('click', () => { if (!Weather.cfg.on) Weather.setOn(true); locate(); });
    $('#cityForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#setCity').value.trim();
      if (!name) return;
      try {
        await Weather.setCity(name);
        if (!Weather.cfg.on) Weather.setOn(true);
        $('#setCity').value = '';
        $('#setCity').blur();
      } catch (err) { toast(err.message, 6000); }
    });
  }

  // ======================= Panels, zen, idle, keys =======================
  let openPanel = null;
  const MODULES = { habits: L.Habits, todos: L.Todos, clocks: L.Clocks, journal: L.Journal, calendar: L.Calendar };
  function togglePanel(name) {
    const next = openPanel === name ? null : name;
    const prev = MODULES[openPanel];
    if (prev && prev.onClose && openPanel !== next) prev.onClose();
    $$('.panel').forEach((p) => p.classList.toggle('open', p.id === 'panel-' + next));
    $$('.dock-btn[data-panel]').forEach((b) => b.classList.toggle('active', b.dataset.panel === next));
    openPanel = next;
    const mod = MODULES[next];
    if (mod && mod.onOpen) mod.onOpen();
  }
  L.ui = {
    openPanel: (name) => { if (openPanel !== name) togglePanel(name); },
    setTask(text) {
      task.value = text;
      prefs.task = text;
      savePrefs();
      toast(`Focusing on “${text}”. Press Start when you’re ready.`);
    },
  };

  function renderBadges() {
    $('#todoBadge').textContent = L.Todos.openCount() || '';
    $('#clockBadge').textContent = L.Clocks.runningCount() || '';
  }
  L.Todos.onChange = renderBadges;
  L.Clocks.onChange = renderBadges;
  $$('[data-panel]').forEach((b) => b.addEventListener('click', () => togglePanel(b.dataset.panel)));
  $$('.panel .close').forEach((b) => b.addEventListener('click', () => togglePanel(null)));
  document.addEventListener('pointerdown', (e) => {
    if (openPanel && !e.target.closest('.panel, .dock')) togglePanel(null);
  });

  function toggleZen(force) {
    const on = document.body.classList.toggle('zen', force);
    if (on) togglePanel(null);
  }
  $('#zenBtn').addEventListener('click', () => toggleZen(true));
  $('#zenExit').addEventListener('click', () => toggleZen(false));

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }
  $('#fsBtn').addEventListener('click', toggleFullscreen);

  let idleTimer = null;
  function poke() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const typing = document.activeElement && document.activeElement.matches('input, select, textarea');
      if (prefs.idleFade && !openPanel && !typing) document.body.classList.add('idle');
    }, 8000);
  }
  ['mousemove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, poke, { passive: true }));

  // Number keys follow the dock order; a few panels also get a memorable letter.
  const PANEL_KEYS = {
    1: 'music', 2: 'sounds', 3: 'scenes', 4: 'look', 5: 'todos', 6: 'habits', 7: 'clocks', 8: 'journal', 9: 'calendar', 0: 'settings',
    a: 'sounds', d: 'todos', h: 'habits', w: 'clocks', j: 'journal', ',': 'settings',
  };
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]), textarea, select')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.key === ' ' && e.target.matches('input[type="checkbox"], summary')) return; // let Space tick boxes
    if (e.metaKey || e.ctrlKey || e.altKey || (e.repeat && !e.key.startsWith('Arrow'))) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); Timer.toggle(); }
    else if (k === 't') setTimerOpen(!prefs.timerOpen);
    else if (k === 'c') { // show / hide the clock (and keep the Settings checkbox in step)
      prefs.clock.on = !prefs.clock.on;
      savePrefs(); renderClock(); applyTimerPos(); renderWeather(); renderClockSettings();
      $('#setClock').checked = prefs.clock.on;
    }
    else if (k === 'r') Timer.reset();
    else if (k === 's') Timer.skip();
    else if (k === 'm') Music.toggle();
    else if (PANEL_KEYS[k]) { // open or close a panel (leaving zen mode if needed)
      if (document.body.classList.contains('zen')) toggleZen(false);
      togglePanel(PANEL_KEYS[k]);
    }
    else if (k === 'n') nextScene();
    else if (k === 'l') cycleLighting();
    else if ((k === 'arrowup' || k === 'arrowdown') && !e.target.matches('input')) { e.preventDefault(); Timer.adjust((k === 'arrowup' ? 1 : -1) * (e.shiftKey ? 5 : 1)); }
    else if (k === 'z') toggleZen();
    else if (k === 'f') toggleFullscreen();
    else if (k === 'escape') { if (openPanel) togglePanel(null); else toggleZen(false); }
  });
  // Stop Space from also "clicking" whichever button has focus.
  document.addEventListener('keyup', (e) => { if (e.key === ' ' && e.target.matches('button')) e.preventDefault(); });

  // Browsers only allow audio after a user gesture.
  const unlock = () => Ambient.unlock();
  addEventListener('pointerdown', unlock, { once: true });
  addEventListener('keydown', unlock, { once: true });

  // ======================= Boot =======================
  let resizeTimer = null;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); applyTimerPos(); }, 150); });
  resize();
  buildSceneGrid();
  buildLook();
  buildSounds();
  buildSettings();
  L.Habits.init($('#habitsBody'));
  L.Todos.init($('#todosBody'));
  L.Clocks.init($('#clocksBody'));
  L.Journal.init($('#journalBody'));
  L.Calendar.init($('#calendarBody'));
  L.Google.preload();
  renderBadges();
  renderMusic();
  Timer.init();
  setTimerOpen(prefs.timerOpen !== false);
  Weather.init();
  applyTimerPos();
  poke();
  requestAnimationFrame(frame);
})();
