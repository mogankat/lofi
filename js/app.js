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

  const LOOK = { outfit: null, hair: null, accent: null, tent: null, pet: 'cat', petColor: null, birds: false, friend: false };
  const prefs = L.store.load('prefs', { scene: 'study', fps: 30, idleFade: true, autoMix: false, task: '', lighting: 'auto', timerPos: null, weekStart: 0, look: LOOK });
  prefs.look = { ...LOOK, ...prefs.look };
  const savePrefs = () => L.store.save('prefs', prefs);
  const toast = U.toast;

  // ======================= Scene rendering =======================
  const canvas = $('#scene'), ctx = canvas.getContext('2d');
  const H = 270;
  let W = 480, t = 0, last = performance.now(), fadeStart = 0, snap = null;
  let scene = scenes.byId[prefs.scene] || scenes.list[0], inst = null, tod = null;
  const weather = { flash: 0, drops: [], key: '' };
  const currentTod = () => (prefs.lighting === 'auto' ? scenes.autoPhase() : prefs.lighting);

  const rainAmount = () => Math.min(1, Ambient.getVolume('rain') * 1.4);

  function drawRain(c, r, speed, dt) {
    const want = Math.round(rainAmount() * r.w * r.h / 160);
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

  function resize() {
    const aspect = innerWidth / innerHeight;
    W = Math.max(360, Math.round(H * (isFinite(aspect) && aspect > 0 ? aspect : 16 / 9)));
    canvas.width = W;
    canvas.height = H;
    inst = scene.create(W, H);
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
      renderThumbs();
    }
    const env = { tod, look: prefs.look, rain: rainAmount(), flash: weather.flash, drawRain: (c, r, speed) => drawRain(c, r, speed || 1, dt) };

    ctx.save();
    inst.draw(ctx, t, dt, env);
    ctx.restore();
    if (scene.outdoor) {
      if (env.rain > 0) {
        ctx.fillStyle = `rgba(25,30,60,${0.2 * env.rain})`;
        ctx.fillRect(0, 0, W, H);
        env.drawRain(ctx, { x: 0, y: 0, w: W, h: H });
      }
      if (weather.flash > 0) {
        ctx.fillStyle = `rgba(225,230,255,${weather.flash * 0.4})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (snap) { // cross-fade from the previous scene
      const a = 1 - (now - fadeStart) / 800;
      if (a <= 0) snap = null;
      else { ctx.globalAlpha = a; ctx.drawImage(snap, 0, 0); ctx.globalAlpha = 1; }
    }
  }

  Ambient.onLightning = (i) => {
    weather.flash = Math.max(weather.flash, 0.5 + 0.5 * i);
    setTimeout(() => { weather.flash = Math.max(weather.flash, 0.6 * i); }, 160);
  };

  function crossfade() {
    snap = document.createElement('canvas');
    snap.width = W; snap.height = H;
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
      const env = { tod: currentTod(), look: prefs.look, rain: 0, flash: 0, drawRain() {} }, i = th.scene.create(480, 270);
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

  // ---- scene customisation ----
  const SWATCHES = {
    outfit: ['#b86b77', '#d9a066', '#6f8fb8', '#7f9c8a', '#8a6aa8', '#e8dccb', '#3b3b4f', '#c8584a'],
    hair: ['#2b1d2a', '#4a2c2a', '#7a4a2a', '#c89a5a', '#e8d8b0', '#8a8a96', '#c0504d', '#5a7ad0'],
    accent: ['#d9d2ea', '#3a3548', '#c9574a', '#f0c05a', '#6fb0a0', '#e890b0', '#5a78c0', '#f4f4f4'],
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
  function buildLook() {
    $('#lookControls').append(
      colorRow('outfit', 'Outfit'), colorRow('hair', 'Hair'), colorRow('accent', 'Headphones & hat'), colorRow('tent', 'Tent'),
      U.el('div', { class: 'look-row' }, U.el('span', { class: 'look-label', text: 'Pet' }),
        U.el('div', { class: 'seg small', id: 'petSeg' }, ...[['none', 'None'], ['cat', 'Cat'], ['dog', 'Dog']].map(([v, t]) =>
          U.el('button', { type: 'button', 'data-pet': v, text: t, onclick: () => setLook('pet', v) })))),
      colorRow('petColor', 'Pet colour'),
      U.el('label', { class: 'check' }, U.el('input', { type: 'checkbox', id: 'lookBirds', onchange: (e) => setLook('birds', e.target.checked) }), 'Birds (an owl at night by the campfire)'),
      U.el('label', { class: 'check' }, U.el('input', { type: 'checkbox', id: 'lookFriend', onchange: (e) => setLook('friend', e.target.checked) }), 'A friend (park, campfire and dock)'),
      U.el('button', { type: 'button', class: 'link', text: 'Reset to defaults', onclick: () => { prefs.look = { ...LOOK }; savePrefs(); renderLook(); renderThumbs(); } }),
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
    $('#lookBirds').checked = prefs.look.birds;
    $('#lookFriend').checked = prefs.look.friend;
  }

  // ======================= Timer UI =======================
  function renderTimer() {
    const started = Timer.started;
    document.body.dataset.mode = Timer.mode;
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
  Timer.onComplete = (was, next) => {
    Ambient.chime(Timer.settings.chime, was === 'focus');
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

  // ---- drag the timer card around ----
  const timerEl = $('.timer');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const canDrag = () => innerWidth > 640 && !document.body.classList.contains('zen');
  function placeTimer(x, y) {
    timerEl.style.setProperty('--x', `${Math.round(x)}px`);
    timerEl.style.setProperty('--y', `${Math.round(y)}px`);
    timerEl.classList.add('moved');
  }
  function applyTimerPos() { // stored as a fraction of the free space so it survives window resizes
    const p = prefs.timerPos;
    if (!p) { timerEl.classList.remove('moved'); return; }
    placeTimer(p.x * Math.max(0, innerWidth - timerEl.offsetWidth), p.y * Math.max(0, innerHeight - timerEl.offsetHeight));
  }
  function resetTimerPos() { prefs.timerPos = null; savePrefs(); applyTimerPos(); }
  let drag = null;
  timerEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !canDrag() || e.target.closest('button, input, select, a')) return;
    const r = timerEl.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
    timerEl.setPointerCapture(e.pointerId);
    timerEl.classList.add('dragging');
  });
  timerEl.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    placeTimer(clamp(e.clientX - drag.dx, 0, innerWidth - timerEl.offsetWidth), clamp(e.clientY - drag.dy, 0, innerHeight - timerEl.offsetHeight));
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    timerEl.classList.remove('dragging');
    if (!timerEl.classList.contains('moved')) return;
    const r = timerEl.getBoundingClientRect();
    prefs.timerPos = { x: r.left / Math.max(1, innerWidth - r.width), y: r.top / Math.max(1, innerHeight - r.height) };
    savePrefs();
  };
  timerEl.addEventListener('pointerup', endDrag);
  timerEl.addEventListener('pointercancel', endDrag);
  $('#grip').addEventListener('dblclick', resetTimerPos);

  // ---- temperature under the clock ----
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
    const n = Ambient.activeCount();
    $('#soundBadge').textContent = n ? n : '';
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
    cid.addEventListener('change', () => { L.store.save('googleClientId', cid.value.trim()); L.Backup.preload(); L.Backup.renderStatus(); });
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

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]), textarea, select')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.key === ' ' && e.target.matches('input[type="checkbox"], summary')) return; // let Space tick boxes
    if (e.metaKey || e.ctrlKey || e.altKey || (e.repeat && !e.key.startsWith('Arrow'))) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); Timer.toggle(); }
    else if (k === 'r') Timer.reset();
    else if (k === 's') Timer.skip();
    else if (k === 'm') Music.toggle();
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
  L.Backup.preload();
  renderBadges();
  renderMusic();
  Timer.init();
  Weather.init();
  applyTimerPos();
  poke();
  requestAnimationFrame(frame);
})();
