// Shared toolkit for the animated scenes, plus the scene registry.
//
// Each scene lives in its own file in js/scenes/ and calls Lofi.scenes.register({
//   id, name, outdoor, mix, create(W, H) -> { draw(c, t, dt, env) } })
//   outdoor – the app draws rain and wind over the whole frame; indoor scenes
//             draw them only through their windows (env.drawRain / env.drawWind)
//   mix     – suggested ambient sound volumes for the scene
//   env     – { tod, look, fx: { rain, wind, birds, crickets }, flash, drawRain, drawWind }
//
// Scenes are drawn on a low-resolution canvas (270px tall) that CSS scales up
// with crisp pixels. Lighting: env.tod is 'morning' | 'afternoon' | 'evening' |
// 'night'. A scene takes environment colours (sky, hills, walls…) from a
// per-phase palette, draws objects and people on a layer that gets the phase's
// colour grade (PHASES[tod].tint), then adds light sources scaled by .lights.
(function () {
  'use strict';
  const TAU = Math.PI * 2, PI = Math.PI;
  const { sin, cos, abs, max, round, random, pow } = Math;

  // ---------- time of day ----------
  const PHASES = {
    morning: {
      sky: [[0, '#7fb0dd'], [0.55, '#bcd6ea'], [0.85, '#f1dac8'], [1, '#fae3c6']],
      sun: { col: '#fff6dc', glow: [255, 226, 180], ga: 0.38, r: 15 },
      stars: 0, tint: [255, 214, 170, 0.08], lights: 0.1,
      cloud: ['#ffffff', '#dcd2dd'], cloudA: 0.9, vig: 0.22, rim: 'rgba(255,240,220,0.55)', flies: 0,
    },
    afternoon: {
      sky: [[0, '#3f8ed6'], [0.6, '#86bfe9'], [1, '#d2ebf5']],
      sun: { col: '#fffbea', glow: [255, 250, 220], ga: 0.45, r: 14 },
      stars: 0, tint: null, lights: 0,
      cloud: ['#ffffff', '#cfdeeb'], cloudA: 1, vig: 0.18, rim: 'rgba(255,255,255,0.5)', flies: 0,
    },
    evening: {
      sky: [[0, '#5b6aa8'], [0.45, '#e89a8c'], [0.8, '#f8c48f'], [1, '#fbe0a8']],
      sun: { col: '#fff1c4', glow: [255, 200, 140], ga: 0.45, r: 18 },
      stars: 0.2, tint: [255, 150, 90, 0.12], lights: 0.75,
      cloud: ['#fbd9c9', '#e7a49c'], cloudA: 1, vig: 0.3, rim: 'rgba(255,220,170,0.7)', flies: 0.4,
    },
    night: {
      sky: [[0, '#070a1f'], [0.6, '#141a3d'], [1, '#2a2552']],
      moon: true,
      stars: 1, tint: [18, 22, 58, 0.45], lights: 1,
      cloud: ['#2a2e56', '#1d2042'], cloudA: 0.5, vig: 0.55, rim: 'rgba(170,190,255,0.5)', flies: 1,
    },
  };
  const TOD = ['morning', 'afternoon', 'evening', 'night'];

  // ---------- drawing primitives ----------
  function rng(seed) { // deterministic layout per scene
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rect(c, x, y, w, h, col) { if (col) c.fillStyle = col; c.fillRect(round(x), round(y), round(w), round(h)); }
  function circle(c, x, y, r, col) { if (col) c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function ellipse(c, x, y, rx, ry, col, rot = 0) { if (col) c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); }
  function rrect(c, x, y, w, h, r, col) {
    if (col) c.fillStyle = col;
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
    c.fill();
  }
  function poly(c, pts, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fill();
  }
  function line(c, pts, col, w) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.stroke();
  }
  function vgrad(c, y0, y1, stops) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }
  function glow(c, x, y, r, rgb, a, mode = 'lighter') {
    if (r <= 0 || a <= 0) return;
    const s = rgb.join(','), g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${s},${a})`);
    g.addColorStop(1, `rgba(${s},0)`);
    c.save(); c.globalCompositeOperation = mode; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
  }
  // A glow squashed vertically — a pool of light on a floor or table.
  function pool(c, x, y, r, rgb, a, squash = 0.25) {
    c.save(); c.translate(x, y); c.scale(1, squash); glow(c, 0, 0, r, rgb, a); c.restore();
  }
  function vignette(c, W, H, a) {
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${a})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  function ridge(c, W, H, fn, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W + 2; x += 2) c.lineTo(x, fn(x));
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  function shade(hex, amt) { // amt < 0 darkens, > 0 lightens
    const n = parseInt(hex.slice(1), 16), f = (v) => round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // ---------- sky ----------
  function sky(c, x, y, w, h, stops) { c.fillStyle = vgrad(c, y, y + h, stops); c.fillRect(x, y, w, h); }
  function makeStars(r, n, x0, w, y0, h) { return Array.from({ length: n }, () => ({ x: x0 + r() * w, y: y0 + r() * h, s: 0.5 + r() * 2, p: r() * TAU, big: r() < 0.06 })); }
  function stars(c, list, t, a) {
    if (a <= 0) return;
    c.fillStyle = '#fff';
    for (const s of list) {
      c.globalAlpha = a * (s.fade || 1) * (0.3 + 0.7 * (0.5 + 0.5 * sin(t * s.s + s.p)));
      c.fillRect(round(s.x), round(s.y), 1, 1);
      if (s.big) { c.fillRect(round(s.x) - 1, round(s.y), 3, 1); c.fillRect(round(s.x), round(s.y) - 1, 1, 3); }
    }
    c.globalAlpha = 1;
  }
  function moon(c, x, y, r = 11) {
    glow(c, x, y, r * 4, [210, 215, 255], 0.25);
    circle(c, x, y, r, '#f0e9d0');
    circle(c, x + r * 0.27, y - r * 0.27, r * 0.23, '#ddd3b2');
    circle(c, x - r * 0.3, y + r * 0.3, r * 0.16, '#ddd3b2');
  }
  function sunOrMoon(c, P, x, y, r) {
    if (P.moon) return moon(c, x, y, r || 11);
    const R = r || P.sun.r;
    glow(c, x, y, R * 7, P.sun.glow, P.sun.ga);
    circle(c, x, y, R, P.sun.col);
  }
  function makeClouds(r, W, n, y0, y1) {
    return Array.from({ length: n }, () => ({
      x: r() * (W + 160), y: y0 + r() * (y1 - y0), s: 1.5 + r() * 3,
      parts: Array.from({ length: 4 + ((r() * 3) | 0) }, (_, i) => ({ dx: i * 9 - 12 + r() * 4, dy: -r() * 8, r: 6 + r() * 7 })),
    }));
  }
  function clouds(c, list, W, t, P, speed = 1) {
    if (!P.cloudA) return;
    c.globalAlpha = P.cloudA;
    for (const cl of list) {
      const x = ((cl.x + t * cl.s * speed) % (W + 160)) - 80;
      cl.parts.forEach((p) => circle(c, x + p.dx, cl.y + p.dy + 3, p.r, P.cloud[1]));
      cl.parts.forEach((p) => circle(c, x + p.dx, cl.y + p.dy, p.r, P.cloud[0]));
    }
    c.globalAlpha = 1;
  }
  function makeFlies(r, n, x0, w, y0, h) { return Array.from({ length: n }, () => ({ x: x0 + r() * w, y: y0 + r() * h, p: r() * TAU, s: 0.6 + r() * 1.2 })); }
  function fireflies(c, list, t, a) {
    if (a <= 0) return;
    for (const f of list) {
      const k = pow(max(0, sin(t * f.s + f.p)), 2) * a;
      if (k < 0.02) continue;
      const x = f.x + sin(t * 0.3 + f.p) * 12, y = f.y + cos(t * 0.4 + f.p) * 6;
      glow(c, x, y, 5, [200, 255, 120], 0.5 * k);
      c.globalAlpha = k; rect(c, x, y, 1, 1, '#eaffb0'); c.globalAlpha = 1;
    }
  }
  // Fireflies from the scene itself at night, plus more when crickets are playing.
  const fliesLevel = (P, env, base = 1) => max(P.flies * base, (env.fx.crickets || 0) * (P.lights > 0.5 ? 1 : 0));

  // Flocks of little birds crossing the sky now and then while bird sounds play.
  function makeFlock() { return { next: 1 + random() * 3, list: [] }; }
  function flock(c, F, t, dt, amount, x0, x1, y0, y1, col = '#4a3a4a') {
    if (amount > 0 && t > F.next) {
      F.next = t + (22 - 14 * amount) * (0.6 + random() * 0.8);
      const n = 2 + ((random() * 4) | 0), y = y0 + random() * (y1 - y0), dir = random() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) F.list.push({ x: (dir > 0 ? x0 - 10 : x1 + 10) - dir * i * 9, y: y + abs(i - n / 2) * 4, v: dir * (20 + random() * 6), ph: random() * TAU });
    }
    F.list = F.list.filter((b) => b.x > x0 - 80 && b.x < x1 + 80);
    for (const b of F.list) {
      b.x += b.v * dt;
      const w = sin(t * 9 + b.ph) * 2.5;
      line(c, [b.x - 4, b.y - w, b.x, b.y, b.x + 4, b.y - w], col, 1);
    }
  }

  // ---------- layer with colour grade ----------
  // Objects and people are drawn on this layer, graded with the phase tint,
  // then composited — so the grade never touches the sky or light sources.
  function makeLayer() {
    const cv = document.createElement('canvas');
    let lc = null;
    return {
      begin(W, H) {
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        lc = cv.getContext('2d');
        lc.clearRect(0, 0, W, H);
        return lc;
      },
      end(c, tint, scale = 1) {
        if (tint && tint[3] * scale > 0) {
          lc.save();
          lc.globalCompositeOperation = 'source-atop';
          lc.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3] * scale})`;
          lc.fillRect(0, 0, cv.width, cv.height);
          lc.restore();
        }
        c.drawImage(cv, 0, 0);
      },
    };
  }

  // ---------- customisation (env.look) ----------
  // Colours are optional overrides; null means "use the scene's own colour".
  const DEFAULT_LOOK = { outfit: null, hair: null, accent: null, furniture: null, tent: null, pet: 'cat', petColor: null, friend: false };
  const lookOf = (env) => ({ ...DEFAULT_LOOK, ...(env.look || {}) });
  const outfit = (lk, def) => ({ top: lk.outfit || def, shade: shade(lk.outfit || def, -0.25) });
  const PET_COLOR = { cat: '#3b3450', dog: '#b07a4a' };
  const FRIEND = { top: '#6f8fb8', shade: '#56729a', hair: '#231c24', skin: '#c98f68', pants: '#35354a' };

  // Pet sitting with its back to us. gy = the surface it sits on.
  function drawPet(c, lk, x, gy, t, colour) {
    if (lk.pet === 'none') return;
    const col = lk.petColor || colour || PET_COLOR[lk.pet], dark = shade(col, -0.3);
    if (lk.pet === 'dog') {
      line(c, [x + 8, gy - 5, x + 13 + sin(t * 12) * 3, gy - 13], col, 2.5); // wagging tail
      ellipse(c, x, gy - 9, 10, 9, col);
      circle(c, x, gy - 21, 7, col);
      ellipse(c, x - 6.5, gy - 20, 2.5, 5.5, dark, 0.25);
      ellipse(c, x + 6.5, gy - 20, 2.5, 5.5, dark, -0.25);
      rect(c, x - 4, gy - 15, 8, 2, '#c0504d'); // collar
      return;
    }
    ellipse(c, x, gy - 8, 9, 8, col);
    circle(c, x, gy - 19, 6, col);
    poly(c, [x - 6, gy - 21, x - 5, gy - 29, x - 1, gy - 24], col);
    poly(c, [x + 6, gy - 21, x + 5, gy - 29, x + 1, gy - 24], col);
    const sw = sin(t * 1.1) * 5;
    c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + 7, gy - 2); c.quadraticCurveTo(x + 22, gy - 1, x + 22 + sw * 0.5, gy - 11 - abs(sw) * 0.3); c.stroke();
  }

  // Small songbird that pecks and hops now and then. y = the perch.
  function perchBird(c, x, y, t, ph = 0, col = '#8a6a4a', flip = false) {
    const d = flip ? -1 : 1, peck = sin(t * 0.7 + ph) > 0.85 ? 2 : 0;
    const by = y - max(0, sin(t * 0.5 + ph * 2) - 0.97) * 60;
    poly(c, [x - 3 * d, by - 3, x - 8 * d, by - 5, x - 7 * d, by - 1], shade(col, -0.25));
    ellipse(c, x, by - 3, 4, 3, col);
    ellipse(c, x + d, by - 2, 2.5, 1.6, '#eadcc6');
    circle(c, x + 3 * d, by - 6 + peck, 2.2, col);
    rect(c, x + 5 * d, by - 6 + peck, 2 * d, 1, '#e8a040');
    rect(c, x + 3.5 * d, by - 7 + peck, 1, 1, '#111');
    rect(c, x - 1, by, 1, 2, '#5a4030'); rect(c, x + 1, by, 1, 2, '#5a4030');
  }

  // Owl with blinking yellow eyes. Draw it *after* the tint layer so the eyes glow.
  function owl(c, x, y, t, ph = 0) {
    const turn = sin(t * 0.3 + ph) > 0.8 ? 1 : 0; // turns its head now and then
    ellipse(c, x, y - 7, 5, 7, '#5a4636');
    poly(c, [x - 5 + turn, y - 12, x - 4 + turn, y - 16, x - 1 + turn, y - 13], '#5a4636');
    poly(c, [x + 5 + turn, y - 12, x + 4 + turn, y - 16, x + 1 + turn, y - 13], '#5a4636');
    ellipse(c, x, y - 4, 3, 3.5, '#7a6450');
    const eye = sin(t * 0.9 + ph) > 0.97 ? '#5a4636' : '#ffd24a';
    circle(c, x - 2 + turn, y - 10, 1.6, eye); circle(c, x + 2 + turn, y - 10, 1.6, eye);
    rect(c, x - 0.5 + turn, y - 9, 1, 2, '#d8a040');
  }

  // Seated person seen from behind (they're looking at the same view we are).
  // x = centre, y = shoulder line.
  function backFigure(c, x, y, o) {
    const hy = y - 17 + (o.bob || 0), torso = o.torso || 70;
    rrect(c, x - 33, y + 4 + (o.armL || 0), 12, 30, 6, o.shade);
    rrect(c, x + 21, y + 4 + (o.armR || 0), 12, 30, 6, o.shade);
    const g = c.createLinearGradient(x - 25, 0, x + 25, 0);
    g.addColorStop(0, o.top); g.addColorStop(1, o.shade);
    rrect(c, x - 25, y - 2, 50, torso, 12, g);
    ellipse(c, x, y + 3, 15, 6, o.shade); // hood
    rect(c, x - 5, hy + 8, 10, 10, o.skin || '#c99a7c');
    circle(c, x, hy, 15, o.hair);
    if (o.longHair) {
      rrect(c, x - 15, hy, 30, 26, 8, o.hair);
      for (let i = 0; i < 5; i++) rect(c, x - 14 + i * 6 + sin(o.t * 2 + i) * (1.2 + (o.wind || 0) * 2), hy + 24, 4, 3 + (i % 2), o.hair);
    }
    if (o.rim) {
      c.strokeStyle = o.rim; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, hy, 14.3, PI * 1.12, PI * 1.88); c.stroke();
    }
    if (o.phones) {
      c.strokeStyle = o.phones; c.lineWidth = 3;
      c.beginPath(); c.arc(x, hy, 16, PI * 1.08, PI * 1.92); c.stroke();
      rrect(c, x - 19, hy - 3, 6, 12, 2, o.phones);
      rrect(c, x + 13, hy - 3, 6, 12, 2, o.phones);
    }
  }

  // Lower legs hanging down below a seat (bench, pier), seen from behind.
  function legs(c, x, top, len, o = {}) {
    const pants = o.pants || '#3a3a55', shoe = o.shoe || '#241c1c';
    [[-7, 0], [7, 1.7]].forEach(([dx, ph]) => {
      const kick = o.swing ? sin(o.t * 1.3 + ph) * o.swing : 0;
      rect(c, x + dx - 3, top, 6, len * 0.6, pants);
      rect(c, x + dx - 3 + kick * 0.5, top + len * 0.6 - 1, 6, len * 0.4 + 1, pants);
      rrect(c, x + dx - 4 + kick, top + len, 8, 3, 1.5, shoe);
    });
  }

  // Campfire / fireplace flames.
  function flames(c, x, y, t, s = 1, lean = 0) {
    const layers = [['#e2451d', 17, 38], ['#ff8a2a', 12, 30], ['#ffc446', 8, 21], ['#fff2b0', 4, 11]];
    layers.forEach(([col, w, h], L) => {
      c.fillStyle = col;
      for (let k = -1; k <= 1; k++) {
        const f = 0.75 + 0.18 * sin(t * 9 + k * 2.1 + L * 1.3) + 0.1 * sin(t * 21.3 + k * 4.7 + L);
        const th = h * f * (k === 0 ? 1 : 0.72) * s, tw = w * (k === 0 ? 0.75 : 0.55) * s, ox = k * w * 0.45 * s;
        const sw = (sin(t * 6.3 + k * 1.7 + L) * 2 + lean * 6) * s;
        c.beginPath();
        c.moveTo(x + ox - tw, y);
        c.quadraticCurveTo(x + ox - tw * 0.9, y - th * 0.55, x + ox + sw, y - th);
        c.quadraticCurveTo(x + ox + tw * 0.9, y - th * 0.55, x + ox + tw, y);
        c.closePath(); c.fill();
      }
    });
  }

  // Rising steam from a mug. (x, y) = top of the drink.
  function steam(c, x, y, t, a = 0.3) {
    for (let i = 0; i < 3; i++) for (let k = 0; k < 14; k++) {
      const p = (t * 0.35 + i / 3 + k / 14) % 1;
      c.fillStyle = `rgba(255,255,255,${(1 - p) * a * (p > 0.05 ? 1 : 0)})`;
      c.fillRect(round(x + sin(p * 6 + t * 1.3 + i * 2) * 3 * p - 1 + i), round(y - p * 26), 1, 1);
    }
  }

  // Which phase "Auto" means right now, from the local clock.
  function autoPhase(date = new Date()) {
    const h = date.getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  const list = [], byId = {};
  window.Lofi.scenes = { list, byId, TOD, autoPhase, register(s) { list.push(s); byId[s.id] = s; } };
  window.Lofi.sceneKit = {
    TAU, PI, PHASES, rng, rect, circle, ellipse, rrect, poly, line, vgrad, glow, pool, vignette, ridge, shade,
    sky, makeStars, stars, moon, sunOrMoon, makeClouds, clouds, makeFlies, fireflies, fliesLevel, makeFlock, flock,
    makeLayer, lookOf, outfit, FRIEND, drawPet, perchBird, owl, backFigure, legs, flames, steam,
  };
})();
