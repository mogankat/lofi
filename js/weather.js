// Local temperature from Open-Meteo (free, no API key, no account).
// Location comes from the browser's location prompt or a typed city name, is
// rounded to ~1 km, and is stored only in this browser.
(function () {
  'use strict';
  const L = window.Lofi;
  const cfg = L.store.load('weather', { on: false, unit: 'f', lat: null, lon: null, place: '' });
  const W = { cfg, data: null, error: null, onChange: null };
  let timer = null;

  const save = () => L.store.save('weather', cfg);
  const emit = () => W.onChange && W.onChange();
  const round2 = (n) => Math.round(n * 100) / 100;

  W.hasLocation = () => cfg.lat != null && cfg.lon != null;

  // WMO weather codes → emoji
  W.icon = (code, day) => {
    if (code === 0) return day ? '☀️' : '🌙';
    if (code <= 2) return day ? '🌤️' : '☁️';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code === 85 || code === 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌡️';
  };

  W.format = () => {
    if (!W.data) return '';
    const c = W.data.c, C = `${Math.round(c)}°C`, F = `${Math.round((c * 9) / 5 + 32)}°F`;
    return cfg.unit === 'c' ? C : cfg.unit === 'both' ? `${F} · ${C}` : F;
  };

  async function refresh() {
    if (!cfg.on || !W.hasLocation()) return;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${cfg.lat}&longitude=${cfg.lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const cur = (await res.json()).current;
      W.data = { c: cur.temperature_2m, code: cur.weather_code, day: !!cur.is_day, at: Date.now() };
      W.error = null;
    } catch (e) {
      W.error = 'Couldn’t reach the weather service (it may be blocked on this network).';
    }
    emit();
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    if (cfg.on && W.hasLocation()) {
      refresh();
      timer = setInterval(refresh, 15 * 60000);
    }
    emit();
  }

  W.setOn = (v) => { cfg.on = v; save(); schedule(); };
  W.setUnit = (u) => { cfg.unit = u; save(); emit(); };

  W.locate = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location isn’t available in this browser. Type a city instead.'));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        cfg.lat = round2(p.coords.latitude);
        cfg.lon = round2(p.coords.longitude);
        cfg.place = 'Your location';
        save(); schedule(); resolve();
      },
      (e) => reject(new Error(e.code === 1
        ? 'Location permission was denied. Type a city instead.'
        : 'Couldn’t get your location. Type a city instead.')),
      { timeout: 15000, maximumAge: 3600000 },
    );
  });

  W.setCity = async (name) => {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
    if (!res.ok) throw new Error('Couldn’t reach the location service.');
    const hit = ((await res.json()).results || [])[0];
    if (!hit) throw new Error(`Couldn’t find “${name}”. Try adding the state or country.`);
    cfg.lat = round2(hit.latitude);
    cfg.lon = round2(hit.longitude);
    cfg.place = [hit.name, hit.admin1, hit.country_code].filter(Boolean).join(', ');
    save(); schedule();
  };

  W.init = schedule;
  L.Weather = W;
})();
