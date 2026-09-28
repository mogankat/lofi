// Music: YouTube (via the official IFrame player) or plain internet-radio
// streams through an <audio> element. Stations are editable and saved locally.
(function () {
  'use strict';
  const L = window.Lofi;

  // All of these play in an embedded player. (Lofi Girl's two main streams,
  // "beats to relax/study to" and "beats to sleep/chill to", refuse embedding,
  // so they aren't included.)
  const DEFAULT_STATIONS = [
    { name: 'Chillhop Radio · jazzy & lofi beats', type: 'youtube', video: '5yx6BWlEVcY' },
    { name: 'Lofi Girl · sad lofi for rainy days', type: 'youtube', video: 'CwPCy1GLS38' },
    { name: 'Lofi Girl · asian lofi radio', type: 'youtube', video: '1Tl2FtV06qo' },
    { name: 'Lofi Girl · synthwave radio', type: 'youtube', video: '4xDzrJKXOOY' },
    { name: 'Lofi Girl · dark ambient radio', type: 'youtube', video: 'S_MOd40zlYU' },
    { name: 'Lofi Girl · deep sleep ambient', type: 'youtube', video: 'nI725iVsyoQ' },
    { name: 'SomaFM Fluid · instrumental hip-hop', type: 'stream', url: 'https://ice6.somafm.com/fluid-128-mp3' },
    { name: 'SomaFM Groove Salad · downtempo', type: 'stream', url: 'https://ice6.somafm.com/groovesalad-128-mp3' },
    { name: 'SomaFM Drone Zone · ambient', type: 'stream', url: 'https://ice6.somafm.com/dronezone-128-mp3' },
  ];

  // Seasonal stations only appear during their months (1 = January), at the top
  // of the list. They aren't saved with your own list, so they come back each
  // year; removing one hides it until "Restore default stations".
  const SEASONAL = [
    { name: '🎄 Lofi Girl · Christmas lofi radio', type: 'youtube', video: 'XSXEaikz0Bc', months: [12] },
    { name: '🎃 Lofi Girl · Halloween lofi radio', type: 'youtube', video: '3GQY80jyysQ', months: [10] },
    { name: '🍂 Chill Village · autumn lofi for deep focus', type: 'youtube', video: 'Vc5S0hAAujc', months: [9, 10, 11] },
  ];
  const SEASONAL_IDS = new Set(SEASONAL.map((s) => s.video));
  const isSeasonal = (st) => SEASONAL_IDS.has(st.video) && !st.custom; // a pasted link is yours to keep
  const inSeason = (st, month = new Date().getMonth() + 1) => st.months.includes(month);
  function withSeason(own) {
    const hidden = new Set(L.store.load('hiddenSeasonal', []));
    const extra = SEASONAL.filter((s) => inSeason(s) && !hidden.has(s.video)).map((s) => ({ ...s }));
    return [...extra, ...own.filter((s) => !isSeasonal(s))];
  }

  const M = {
    stations: withSeason(L.store.load('stations', DEFAULT_STATIONS)),
    index: L.store.load('stationIndex', 0),
    volume: L.store.load('musicVolume', 60),
    playing: false,
    loading: false,
    title: '',
    onChange: null,
    onError: null,
  };
  if (!(M.index < M.stations.length)) M.index = 0;

  let yt = null, ytApi = null, audio = null, active = null, loadedKey = null;
  const emit = () => M.onChange && M.onChange();
  const fail = (msg) => { M.playing = false; M.loading = false; emit(); if (M.onError) M.onError(msg); };
  const keyOf = (st) => st.list || st.video;
  const saveStations = () => L.store.save('stations', M.stations.filter((s) => !isSeasonal(s)));

  M.current = () => M.stations[M.index];
  M.activeType = () => active;

  // ---------- YouTube ----------
  function loadApi() {
    if (ytApi) return ytApi;
    ytApi = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) return resolve();
      const blocked = () => { ytApi = null; reject(new Error('Couldn’t reach YouTube — it may be blocked on this network. Try a radio stream instead.')); };
      window.onYouTubeIframeAPIReady = resolve;
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = blocked;
      document.head.appendChild(s);
      setTimeout(() => { if (!(window.YT && window.YT.Player)) blocked(); }, 15000);
    });
    return ytApi;
  }

  const YT_ERRORS = {
    2: 'That YouTube link looks invalid.',
    5: 'This video can’t play in an embedded player.',
    100: 'Video not found — it may have been removed or made private.',
    101: 'This video’s owner blocks playback on other sites. Try another station.',
    150: 'This video’s owner blocks playback on other sites. Try another station.',
    153: 'YouTube needs this page served over http(s), not opened as a file. See the README.',
  };

  function getPlayer() {
    if (yt) return Promise.resolve(yt);
    return loadApi().then(() => new Promise((resolve) => {
      const p = new window.YT.Player('ytPlayer', {
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: () => { yt = p; resolve(p); },
          onStateChange: (e) => {
            if (active !== 'youtube') return;
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) {
              M.playing = true; M.loading = false;
              const d = p.getVideoData ? p.getVideoData() : null;
              if (d && d.title) {
                M.title = d.title;
                const st = M.current();
                if (st && st.autoName) { st.name = d.title; delete st.autoName; saveStations(); }
              }
              emit();
            } else if (e.data === S.PAUSED) {
              M.playing = false; M.loading = false; emit();
            } else if (e.data === S.BUFFERING) {
              M.loading = true; emit();
            } else if (e.data === S.ENDED) {
              const st = M.current();
              if (st && !st.list) { p.seekTo(0); p.playVideo(); } // loop single videos
            }
          },
          onError: (e) => fail(YT_ERRORS[e.data] || `YouTube error ${e.data}.`),
        },
      });
    }));
  }

  // ---------- streams ----------
  function getAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('playing', () => { if (active === 'stream') { M.playing = true; M.loading = false; emit(); } });
    audio.addEventListener('pause', () => { if (active === 'stream') { M.playing = false; M.loading = false; emit(); } });
    audio.addEventListener('waiting', () => { if (active === 'stream') { M.loading = true; emit(); } });
    audio.addEventListener('error', () => { if (active === 'stream' && audio.getAttribute('src')) fail('Couldn’t load that stream.'); });
    return audio;
  }

  // ---------- controls ----------
  M.play = async function (i = M.index) {
    M.index = i;
    L.store.save('stationIndex', i);
    const st = M.current();
    if (!st) return;
    M.title = st.name;
    M.loading = true;
    emit();

    if (st.type === 'stream') {
      if (yt && yt.pauseVideo) yt.pauseVideo();
      active = 'stream';
      const a = getAudio();
      a.src = st.url; // always reconnect so a paused live stream resumes "live"
      a.volume = M.volume / 100;
      try { await a.play(); } catch (e) { if (e.name !== 'AbortError') fail('Couldn’t play that stream.'); }
      return;
    }

    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    active = 'youtube';
    emit();
    try {
      const p = await getPlayer();
      if (active !== 'youtube' || M.current() !== st) return; // user switched meanwhile
      p.setVolume(M.volume);
      if (loadedKey !== keyOf(st)) {
        loadedKey = keyOf(st);
        if (st.list) { p.loadPlaylist({ list: st.list, listType: 'playlist' }); p.setLoop(true); }
        else p.loadVideoById(st.video);
      } else {
        p.playVideo();
      }
    } catch (e) {
      fail(e.message);
    }
  };

  M.pause = () => {
    if (active === 'stream' && audio) audio.pause();
    if (active === 'youtube' && yt && yt.pauseVideo) yt.pauseVideo();
    M.playing = false;
    M.loading = false;
    emit();
  };
  M.toggle = () => (M.playing || M.loading ? M.pause() : M.play());
  M.next = () => M.play((M.index + 1) % M.stations.length);
  M.prev = () => M.play((M.index - 1 + M.stations.length) % M.stations.length);

  M.setVolume = (v) => {
    M.volume = v;
    L.store.save('musicVolume', v);
    if (audio) audio.volume = v / 100;
    if (yt && yt.setVolume) yt.setVolume(v);
  };

  // Accepts YouTube video / live / playlist links, a bare video id, or any http(s) audio stream URL.
  M.parse = function (input) {
    const s = input.trim();
    if (/^[\w-]{11}$/.test(s)) return { type: 'youtube', video: s };
    let u;
    try { u = new URL(s); } catch (e) { return null; }
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
      const list = u.searchParams.get('list');
      let video = u.searchParams.get('v');
      if (!video) {
        const m = u.pathname.match(/\/(?:embed|live|shorts|v)\/([\w-]{11})/) || (host === 'youtu.be' && u.pathname.match(/^\/([\w-]{11})/));
        if (m) video = m[1];
      }
      if (list && !/^RD/.test(list)) return { type: 'youtube', list }; // RD… = auto-mixes, not embeddable as playlists
      if (video) return { type: 'youtube', video };
      return null;
    }
    if (u.protocol === 'https:' || u.protocol === 'http:') return { type: 'stream', url: s };
    return null;
  };

  M.add = function (input, name) {
    const src = M.parse(input);
    if (!src) return -1;
    const st = { ...src, custom: true, name: name || (src.type === 'stream' ? new URL(src.url).hostname : src.list ? 'YouTube playlist' : 'YouTube video') };
    if (!name && src.type === 'youtube') st.autoName = true;
    M.stations.push(st);
    saveStations();
    emit();
    return M.stations.length - 1;
  };

  M.remove = function (i) {
    if (i === M.index) M.pause();
    if (isSeasonal(M.stations[i])) L.store.save('hiddenSeasonal', [...L.store.load('hiddenSeasonal', []), M.stations[i].video]);
    M.stations.splice(i, 1);
    if (i < M.index) M.index--;
    M.index = Math.max(0, Math.min(M.index, M.stations.length - 1));
    L.store.save('stationIndex', M.index);
    saveStations();
    emit();
  };

  M.restoreDefaults = function () {
    M.pause();
    L.store.save('hiddenSeasonal', []);
    M.stations = withSeason(JSON.parse(JSON.stringify(DEFAULT_STATIONS)));
    M.index = 0;
    L.store.save('stationIndex', 0);
    saveStations();
    emit();
  };

  L.Music = M;
})();
