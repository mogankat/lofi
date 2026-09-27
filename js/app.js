// Wires the timer, music, ambient sounds and scenes to the page.
(function () {
  'use strict';
  const L = window.Lofi;
  const { Timer, Ambient, Music, scenes } = L;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const ICON = {
    play: '<svg class="fill" viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
    pause: '<svg class="fill" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  };

  const prefs = L.store.load('prefs', { scene: 'study', fps: 30, idleFade: true, autoMix: false, task: '' });
  const savePrefs = () => L.store.save('prefs', prefs);

  function toast(msg, ms = 4500) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ======================= Scene rendering =======================
  const canvas = $('#scene'), ctx = canvas.getContext('2d');
  const H = 270;
  let W = 480, t = 0, last = performance.now(), fadeStart = 0, snap = null;
  let scene = scenes.byId[prefs.scene] || scenes.list[0], inst = null;
  const weather = { flash: 0, drops: [], key: '' };

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
    const env = { rain: rainAmount(), flash: weather.flash, drawRain: (c, r, speed) => drawRain(c, r, speed || 1, dt) };

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

  function setScene(id) {
    if (!scenes.byId[id]) return;
    snap = document.createElement('canvas');
    snap.width = W; snap.height = H;
    snap.getContext('2d').drawImage(canvas, 0, 0);
    fadeStart = performance.now();
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

  function buildSceneGrid() {
    const grid = $('#sceneGrid');
    const env = { rain: 0, flash: 0, drawRain() {} };
    for (const s of scenes.list) {
      const b = document.createElement('button');
      b.className = 'scene-card' + (s === scene ? ' active' : '');
      b.dataset.scene = s.id;
      const cv = document.createElement('canvas');
      cv.width = 480; cv.height = 270;
      const c = cv.getContext('2d'), i = s.create(480, 270);
      for (let k = 0; k < 20; k++) { c.save(); i.draw(c, 4 + k * 0.1, 0.1, env); c.restore(); } // warm up particles
      const label = document.createElement('span');
      label.textContent = s.name;
      b.append(cv, label);
      b.addEventListener('click', () => setScene(s.id));
      grid.append(b);
    }
    const auto = $('#autoMix');
    auto.checked = prefs.autoMix;
    auto.addEventListener('change', () => {
      prefs.autoMix = auto.checked;
      savePrefs();
      if (auto.checked) Ambient.setMix(scene.mix);
    });
  }

  // ======================= Timer UI =======================
  function renderTimer() {
    const full = Timer.duration(), started = Timer.running || Timer.remaining < full;
    document.body.dataset.mode = Timer.mode;
    $('#time').textContent = Timer.format(Timer.remaining);
    $('#progressBar').style.width = ((1 - Timer.remaining / full) * 100).toFixed(2) + '%';
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
  }

  // ======================= Panels, zen, idle, keys =======================
  let openPanel = null;
  function togglePanel(name) {
    const next = openPanel === name ? null : name;
    $$('.panel').forEach((p) => p.classList.toggle('open', p.id === 'panel-' + next));
    $$('.dock-btn[data-panel]').forEach((b) => b.classList.toggle('active', b.dataset.panel === next));
    openPanel = next;
  }
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
      const typing = document.activeElement && document.activeElement.matches('input, select');
      if (prefs.idleFade && !openPanel && !typing) document.body.classList.add('idle');
    }, 8000);
  }
  ['mousemove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, poke, { passive: true }));

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input[type="text"], input[type="number"], select')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); Timer.toggle(); }
    else if (k === 'r') Timer.reset();
    else if (k === 's') Timer.skip();
    else if (k === 'm') Music.toggle();
    else if (k === 'n') nextScene();
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
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });
  resize();
  buildSceneGrid();
  buildSounds();
  buildSettings();
  renderMusic();
  Timer.init();
  poke();
  requestAnimationFrame(frame);
})();
