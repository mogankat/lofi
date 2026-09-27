// Animated backgrounds. Each scene is drawn procedurally onto a low-resolution
// canvas (270px tall) which CSS scales up with crisp pixels for a lofi look.
//
// Scene shape:  { id, name, outdoor, mix, create(W, H) -> { draw(c, t, dt, env) } }
//   outdoor  – app draws rain/lightning over the whole frame; indoor scenes do it themselves
//   mix      – suggested ambient sound volumes for the scene
//   env      – { tod, rain: 0..1, flash: 0..1, drawRain(c, rect, speed) }
//
// Lighting: env.tod is 'morning' | 'afternoon' | 'evening' | 'night'. Each scene
// picks environment colours (sky, hills, water…) from a per-phase palette, draws
// objects and people onto a separate layer that gets a colour grade (PHASES.tint),
// and then adds light sources (lamps, fire, lighthouse) scaled by PHASES.lights.
(function () {
  'use strict';
  const TAU = Math.PI * 2, PI = Math.PI;
  const { sin, cos, abs, max, min, round, random, pow } = Math;

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

  // ---------- drawing helpers ----------
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

  function sky(c, x, y, w, h, stops) { c.fillStyle = vgrad(c, y, y + h, stops); c.fillRect(x, y, w, h); }
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
  function clouds(c, list, W, t, P) {
    if (!P.cloudA) return;
    c.globalAlpha = P.cloudA;
    for (const cl of list) {
      const x = ((cl.x + t * cl.s) % (W + 160)) - 80;
      cl.parts.forEach((p) => circle(c, x + p.dx, cl.y + p.dy + 3, p.r, P.cloud[1]));
      cl.parts.forEach((p) => circle(c, x + p.dx, cl.y + p.dy, p.r, P.cloud[0]));
    }
    c.globalAlpha = 1;
  }
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
      for (let i = 0; i < 5; i++) rect(c, x - 14 + i * 6 + sin(o.t * 2 + i) * 1.2, hy + 24, 4, 3 + (i % 2), o.hair);
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

  // ==========================================================
  // 1. Study desk by a city window
  // ==========================================================
  const BULBS = [['#ffd27f', [255, 210, 127]], ['#ff9d8a', [255, 157, 138]], ['#9fd3ff', [159, 211, 255]], ['#c6f2a4', [198, 242, 164]]];
  const ROOM = {
    morning: {
      wall: ['#aea4c4', '#9186ab'], frame: '#e4dcea', curtain: '#d4919a', fold: '#bf7d88', rod: '#8a7060',
      sill: '#e8e0ee', sillHi: '#f8f4fb', deskTop: '#b07d53', deskEdge: '#8c5f3b', desk: ['#7f5438', '#65422d'],
      cat: '#463d55', far: '#a9b8d2', near: '#7a87a6', win: 'rgba(230,240,255,0.45)',
      sun: [0.2, 0.3, 12], beam: [255, 236, 200, 0.14], beamX: -40,
    },
    afternoon: {
      wall: ['#b7a9c9', '#9a8cb0'], frame: '#ece6f2', curtain: '#d98f8f', fold: '#c77b7e', rod: '#8a7060',
      sill: '#efe8f2', sillHi: '#ffffff', deskTop: '#b98356', deskEdge: '#94633d', desk: ['#8a5a3a', '#6e4630'],
      cat: '#4a4058', far: '#b3c6de', near: '#8190ad', win: 'rgba(235,245,255,0.5)',
      sun: null, beam: [255, 250, 235, 0.12], beamX: 0,
    },
    evening: {
      wall: ['#7a5f86', '#5a4466'], frame: '#b8a0b8', curtain: '#b86a78', fold: '#a05a6a', rod: '#6b5a4a',
      sill: '#b89fb8', sillHi: '#cfb6cc', deskTop: '#9a6440', deskEdge: '#744a30', desk: ['#5c3c2a', '#40291d'],
      cat: '#35294a', far: '#8f6f8f', near: '#4d3b5e', win: 'rgba(255,200,150,0.3)',
      sun: [0.8, 0.36, 14], beam: [255, 170, 110, 0.16], beamX: 50,
    },
    night: {
      wall: ['#231f3d', '#17142b'], frame: '#3d365f', curtain: '#473768', fold: '#3a2d57', rod: '#6b5a4a',
      sill: '#4b4272', sillHi: '#5d538a', deskTop: '#7a5238', deskEdge: '#5a3a28', desk: ['#3d281d', '#2a1b14'],
      cat: '#2a2540', far: '#29245a', near: '#15122f', win: null,
      sun: null, beam: null, beamX: 0,
    },
  };

  const study = {
    id: 'study', name: 'Study desk', outdoor: false,
    mix: { rain: 0.45, thunder: 0.18 },
    create(W, H) {
      const r = rng(11), cx = round(W / 2), dy = 198, layer = makeLayer();
      const win = { x: cx - 150, y: 36, w: 300, h: 138 };
      const base = win.y + win.h;
      const starList = Array.from({ length: 45 }, () => ({ x: win.x + r() * win.w, y: win.y + r() * win.h * 0.55, p: r() * TAU, s: 0.5 + r() * 2 }));
      const skyline = (minH, maxH, minW, maxW, density) => {
        const out = [];
        let x = win.x - 4;
        while (x < win.x + win.w) {
          const w = (minW + r() * (maxW - minW)) | 0, h = (minH + r() * (maxH - minH)) | 0, wins = [];
          for (let yy = 6; yy < h - 4; yy += 6) for (let xx = 3; xx < w - 3; xx += 5) if (r() < density) wins.push({ x: xx, y: yy, p: r() * TAU, s: 0.04 + r() * 0.2 });
          out.push({ x, w, h, wins, ant: r() < 0.2 });
          x += w + ((r() * 3) | 0);
        }
        return out;
      };
      const far = skyline(40, 95, 12, 24, 0.25), near = skyline(18, 62, 16, 34, 0.4);
      const bulbs = [];
      const l0 = win.x - 40, l1 = win.x + win.w + 40;
      for (let x = l0; x <= l1; x += 11) {
        const f = (((x - l0) / (l1 - l0)) * 3) % 1;
        const [col, rgb] = BULBS[bulbs.length % 4];
        bulbs.push({ x, y: 16 + sin(f * PI) * 9, col, rgb });
      }

      function drawSkyline(c, list, col, lit, day, lights, t) {
        for (const b of list) {
          rect(c, b.x, base - b.h, b.w, b.h, col);
          if (b.ant) {
            rect(c, b.x + b.w / 2, base - b.h - 7, 1, 7, col);
            if (lights > 0.5 && sin(t * 2 + b.x) > 0.6) rect(c, b.x + b.w / 2, base - b.h - 8, 1, 1, '#ff5a5a');
          }
          if (day) { c.fillStyle = day; for (const w of b.wins) c.fillRect(b.x + w.x, base - b.h + w.y, 2, 2); }
          if (lights > 0) {
            c.globalAlpha = lights; c.fillStyle = lit;
            for (const w of b.wins) if (sin(t * w.s + w.p) > -0.2 + (1 - lights) * 0.8) c.fillRect(b.x + w.x, base - b.h + w.y, 2, 2);
            c.globalAlpha = 1;
          }
        }
      }

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], R = ROOM[env.tod], lights = P.lights;

          // view through the window
          c.save();
          c.beginPath(); c.rect(win.x, win.y, win.w, win.h); c.clip();
          sky(c, win.x, win.y, win.w, win.h, P.sky);
          stars(c, starList, t, P.stars);
          if (P.moon) moon(c, win.x + win.w - 58, win.y + 30, 10);
          else if (R.sun) sunOrMoon(c, P, win.x + win.w * R.sun[0], win.y + win.h * R.sun[1], R.sun[2]);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.55})`; c.fillRect(win.x, win.y, win.w, win.h); }
          drawSkyline(c, far, R.far, 'rgba(255,214,140,0.45)', R.win, lights, t);
          drawSkyline(c, near, R.near, '#ffd27f', R.win, lights, t);
          env.drawRain(c, win, 0.55);
          c.restore();

          // wall (around the window)
          c.fillStyle = vgrad(c, 0, H, [[0, R.wall[0]], [1, R.wall[1]]]);
          c.fillRect(0, 0, W, win.y); c.fillRect(0, base, W, H - base);
          c.fillRect(0, win.y, win.x, win.h); c.fillRect(win.x + win.w, win.y, W - win.x - win.w, win.h);
          c.fillStyle = 'rgba(255,255,255,0.025)';
          for (let x = cx % 16; x < W; x += 16) { c.fillRect(x, 0, 8, win.y); c.fillRect(x, base, 8, dy - base); if (x < win.x || x > win.x + win.w) c.fillRect(x, win.y, 8, win.h); }

          // frame, muntins, curtains, sill
          c.strokeStyle = R.frame; c.lineWidth = 6; c.strokeRect(win.x - 3, win.y - 3, win.w + 6, win.h + 6);
          rect(c, cx - 2, win.y, 4, win.h, R.frame);
          rect(c, win.x, win.y + win.h * 0.45 - 2, win.w, 4, R.frame);
          rect(c, win.x - 46, win.y - 17, win.w + 92, 3, R.rod);
          circle(c, win.x - 46, win.y - 15.5, 3, R.rod); circle(c, win.x + win.w + 46, win.y - 15.5, 3, R.rod);
          for (const [x0, dir] of [[win.x - 36, 1], [win.x + win.w - 6, -1]]) {
            rect(c, x0, win.y - 14, 42, win.h + 44, R.curtain);
            for (let i = 0; i < 5; i++) rect(c, x0 + 3 + i * 8 + (dir > 0 ? 0 : 1), win.y - 14, 3, win.h + 44, R.fold);
          }
          rect(c, win.x - 14, base + 3, win.w + 28, 6, R.sill);
          rect(c, win.x - 14, base + 3, win.w + 28, 1, R.sillHi);

          // cat on the sill, watching the city
          const kx = win.x + 44, ky = base + 3, cc = R.cat;
          ellipse(c, kx, ky - 8, 9, 8, cc);
          circle(c, kx, ky - 19, 6, cc);
          poly(c, [kx - 6, ky - 21, kx - 5, ky - 29, kx - 1, ky - 24], cc);
          poly(c, [kx + 6, ky - 21, kx + 5, ky - 29, kx + 1, ky - 24], cc);
          const sw = sin(t * 1.1) * 5;
          c.strokeStyle = cc; c.lineWidth = 3; c.lineCap = 'round';
          c.beginPath(); c.moveTo(kx + 7, ky - 2); c.quadraticCurveTo(kx + 22, ky - 1, kx + 22 + sw * 0.5, ky - 11 - abs(sw) * 0.3); c.stroke();

          // fairy lights (string + bulbs; their glow comes later)
          c.strokeStyle = 'rgba(40,34,60,0.8)'; c.lineWidth = 1;
          c.beginPath(); bulbs.forEach((b, i) => (i ? c.lineTo(b.x, b.y) : c.moveTo(b.x, b.y))); c.stroke();
          bulbs.forEach((b) => rect(c, b.x - 1, b.y + 1, 2, 3, b.col));

          // desk
          rect(c, 0, dy, W, 5, R.deskTop);
          rect(c, 0, dy + 5, W, 3, R.deskEdge);
          c.fillStyle = vgrad(c, dy + 8, H, [[0, R.desk[0]], [1, R.desk[1]]]);
          c.fillRect(0, dy + 8, W, H - dy - 8);

          // ---- objects layer ----
          const f = layer.begin(W, H);
          const bx = cx - 168;
          rect(f, bx - 16, dy - 6, 32, 6, '#7c4a5c'); rect(f, bx - 14, dy - 11, 28, 5, '#46708a'); rect(f, bx - 15, dy - 17, 30, 6, '#b08a4c');
          rect(f, bx + 14, dy - 5, 1, 4, '#e8dcc4'); rect(f, bx + 13, dy - 10, 1, 3, '#e8dcc4');
          const gx = cx - 112;
          rect(f, gx - 5, dy - 12, 10, 12, '#e9d9bd');
          rect(f, gx - 5, dy - 12, 10, 2, '#d4c2a2');
          f.strokeStyle = '#e9d9bd'; f.lineWidth = 2; f.beginPath(); f.arc(gx + 6, dy - 6, 3, -PI / 2, PI / 2); f.stroke();
          const px = cx + 170;
          poly(f, [px - 9, dy - 14, px + 9, dy - 14, px + 7, dy, px - 7, dy], '#b5654a');
          rect(f, px - 10, dy - 16, 20, 3, '#c97a5c');
          for (let i = 0; i < 7; i++) {
            const a = -PI / 2 + (i - 3) * 0.38 + sin(t * 0.8 + i) * 0.05;
            ellipse(f, px + cos(a) * 12, dy - 18 + sin(a) * 12, 7, 2.5, i % 2 ? '#5f8f5a' : '#4c7a4c', a);
          }
          rect(f, cx - 36, dy - 40, 72, 40, '#1d1c26');
          f.fillStyle = vgrad(f, dy - 37, dy - 3, [[0, '#c6dbff'], [1, '#8fa9ea']]);
          f.fillRect(cx - 33, dy - 37, 66, 34);
          rect(f, cx - 40, dy - 2, 80, 3, '#9a9aaa');
          backFigure(f, cx, 180, {
            t, torso: 100, top: '#b86b77', shade: '#8e4f5e', hair: '#2b1d2a', phones: '#d9d2ea',
            rim: P.moon ? 'rgba(170,200,255,0.6)' : P.rim, bob: sin(t * TAU * 75 / 60) * 0.8,
            armL: round(sin(t * 9) * 0.8), armR: round(sin(t * 9 + 1.7) * 0.8),
          });
          const lx = cx + 118;
          ellipse(f, lx, dy, 12, 3, '#2d2a3a');
          line(f, [lx, dy, lx + 6, dy - 30, lx - 10, dy - 48], '#2d2a3a', 3);
          f.save(); f.translate(lx - 14, dy - 46); f.rotate(0.55);
          poly(f, [-6, -5, 6, -5, 10, 6, -10, 6], '#c8584a');
          f.restore();
          layer.end(c, P.tint, 0.6);

          // ---- light ----
          for (let i = 0; i < 3; i++) for (let k = 0; k < 14; k++) { // steam
            const p = (t * 0.35 + i / 3 + k / 14) % 1;
            c.fillStyle = `rgba(255,255,255,${(1 - p) * 0.3 * (p > 0.05 ? 1 : 0)})`;
            c.fillRect(round(gx + sin(p * 6 + t * 1.3 + i * 2) * 3 * p - 1 + i), round(dy - 14 - p * 26), 1, 1);
          }
          if (R.beam) { // daylight pooling on the desk
            const [br, bg, bb, ba] = R.beam;
            c.save(); c.translate(cx + R.beamX, dy + 4); c.scale(1, 0.3); glow(c, 0, 0, 200, [br, bg, bb], ba * 1.6); c.restore();
          }
          bulbs.forEach((b, i) => glow(c, b.x, b.y + 2, 9, b.rgb, 0.35 * (0.55 + 0.45 * sin(t * 1.3 + i * 1.7)) * (0.25 + 0.75 * lights)));
          glow(c, cx, dy - 22, 80, [140, 180, 255], 0.2 * (0.3 + 0.7 * lights));
          if (lights > 0.05) {
            glow(c, lx - 22, dy - 38, 110, [255, 180, 110], 0.22 * lights);
            c.save(); c.translate(lx - 26, dy - 1); c.scale(1, 0.25); glow(c, 0, 0, 60, [255, 200, 130], 0.4 * lights); c.restore();
          }

          vignette(c, W, H, P.vig);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.08})`; c.fillRect(0, 0, W, H); }
        },
      };
    },
  };

  // ==========================================================
  // 2. Park bench
  // ==========================================================
  const LEAF = ['#e07a3f', '#e3a33b', '#c4543a', '#f0c05a'];
  const PARK = {
    morning: {
      far: '#9db4c9', bgTree: '#6f8f78', near: '#8fae78', ground: ['#8fb265', '#6a9148'], path: '#dcc8a4',
      leaf: ['#4f7048', '#6f9656', '#b8cf7a'], trunk: '#5c4038', grass: '#5f8a45', sun: [-55, 112],
    },
    afternoon: {
      far: '#93b4bd', bgTree: '#5f8a5a', near: '#86ac5e', ground: ['#8dbb5a', '#62943f'], path: '#e2cfa6',
      leaf: ['#4b7040', '#6a9a4c', '#a9cc68'], trunk: '#5c4038', grass: '#5a8a3a', sun: [90, 40],
    },
    evening: {
      far: '#c48e98', bgTree: '#7f8a66', near: '#9a9468', ground: ['#8fa05c', '#5f7a43'], path: '#d9bc92',
      leaf: ['#4d6a42', '#6f8f50', '#a5b565'], trunk: '#5c4038', grass: '#5a7a40', sun: [115, 150],
    },
    night: {
      far: '#23254a', bgTree: '#1a2334', near: '#1d2940', ground: ['#1f2c30', '#141e22'], path: '#3a3b4c',
      leaf: ['#111b24', '#19282f', '#27403f'], trunk: '#1c171e', grass: '#17241f', sun: [-110, 48],
    },
  };

  function drawTree(c, x, gy, s, t, ph, pal) {
    rect(c, x - 4 * s, gy - 70 * s, 8 * s, 70 * s + 4, pal.trunk);
    line(c, [x, gy - 45 * s, x + 14 * s, gy - 62 * s], pal.trunk, 3 * s);
    const blobs = [[-20, -78, 22], [18, -82, 24], [0, -102, 25], [-12, -60, 16], [16, -60, 17], [-28, -92, 15], [28, -100, 15]];
    const sway = blobs.map((b, i) => sin(t * 0.9 + ph + i) * 1.3);
    blobs.forEach((b, i) => circle(c, x + (b[0] + sway[i]) * s - 2, gy + b[1] * s + 3, b[2] * s, pal.leaf[0]));
    blobs.forEach((b, i) => circle(c, x + (b[0] + sway[i]) * s, gy + b[1] * s, b[2] * s, pal.leaf[1]));
    blobs.forEach((b, i) => circle(c, x + (b[0] + sway[i] + 5) * s, gy + (b[1] - 5) * s, b[2] * s * 0.55, pal.leaf[2]));
  }

  const park = {
    id: 'park', name: 'Park bench', outdoor: true,
    mix: { birds: 0.35, wind: 0.22 },
    create(W, H) {
      const r = rng(21), cx = round(W / 2), gy = 205, layer = makeLayer();
      const cloudList = makeClouds(r, W, 6, 20, 100);
      const newLeaf = (init) => ({ x: random() * W * 1.1 - W * 0.1, y: init ? random() * H : -5, v: 8 + random() * 10, ph: random() * TAU, rot: random() * TAU, col: LEAF[(random() * 4) | 0] });
      const leaves = Array.from({ length: 26 }, () => newLeaf(true));
      const tufts = Array.from({ length: round(W / 8) }, () => ({ x: r() * W, y: 244 + r() * 26, h: 3 + r() * 5 }));
      const bgTrees = Array.from({ length: round(W / 30) }, () => ({ x: r() * W, r: 6 + r() * 7 }));
      const trees = [[cx - 150, 1.15, 0], [cx + 180, 0.95, 2], [cx - 275, 0.9, 4], [cx + 305, 1.1, 1]];
      const starList = Array.from({ length: round(W * 0.25) }, () => ({ x: r() * W, y: r() * 150, s: 0.5 + r() * 2, p: r() * TAU }));
      const flies = Array.from({ length: 12 }, () => ({ x: r() * W, y: 175 + r() * 50, p: r() * TAU, s: 0.6 + r() * 1.2 }));
      const birds = { next: 3, list: [] };
      const nearHill = (x) => 190 - 9 * sin(x * 0.018 + 2) - 4 * sin(x * 0.05);

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], K = PARK[env.tod];
          sky(c, 0, 0, W, gy, P.sky);
          stars(c, starList, t, P.stars);
          sunOrMoon(c, P, cx + K.sun[0], K.sun[1]);
          clouds(c, cloudList, W, t, P);

          ridge(c, W, H, (x) => 172 - 14 * sin(x * 0.012 + 1) - 6 * sin(x * 0.033), K.far);
          for (const b of bgTrees) circle(c, b.x, nearHill(b.x) - b.r * 0.5, b.r, K.bgTree);
          ridge(c, W, H, nearHill, K.near);
          c.fillStyle = vgrad(c, gy, H, [[0, K.ground[0]], [1, K.ground[1]]]);
          c.fillRect(0, gy, W, H - gy);
          rect(c, 0, 228, W, 12, K.path); rect(c, 0, 228, W, 1, 'rgba(255,255,255,0.18)'); rect(c, 0, 240, W, 1, 'rgba(0,0,0,0.12)');
          for (const [x, s, ph] of trees) drawTree(c, x, gy + 6, s, t, ph, K);

          // ---- objects layer: lamp post, bench, person ----
          const f = layer.begin(W, H);
          const lp = cx - 78, on = P.lights > 0.3;
          rect(f, lp - 1, 150, 3, 80, '#2f2b3b'); rect(f, lp - 5, 146, 11, 6, '#2f2b3b');
          rect(f, lp - 3, 152, 7, 5, on ? '#ffe2a6' : '#cfd3d8'); rect(f, lp - 4, 226, 9, 4, '#2f2b3b');
          const bx = cx + 10;
          rect(f, bx - 46, 213, 92, 4, '#9b6440');
          rect(f, bx - 42, 217, 3, 13, '#2f2b3b'); rect(f, bx + 39, 217, 3, 13, '#2f2b3b');
          backFigure(f, bx - 4, 184, {
            t, torso: 32, top: '#d9a066', shade: '#b07c48', hair: '#4a2c2a', longHair: true,
            phones: '#3a3548', rim: P.rim, bob: sin(t * 1.3) * 0.6,
          });
          rect(f, bx - 48, 192, 96, 5, '#a36b45'); rect(f, bx - 48, 196, 96, 1, '#7d4f33');
          rect(f, bx - 48, 201, 96, 5, '#a36b45'); rect(f, bx - 48, 205, 96, 1, '#7d4f33');
          rect(f, bx - 44, 188, 3, 30, '#2f2b3b'); rect(f, bx + 41, 188, 3, 30, '#2f2b3b');
          layer.end(c, P.tint);
          if (on) {
            glow(c, lp + 1, 155, 34, [255, 220, 160], 0.4 * P.lights);
            c.save(); c.translate(lp + 1, 230); c.scale(1, 0.25); glow(c, 0, 0, 50, [255, 210, 150], 0.3 * P.lights); c.restore();
          }

          // falling leaves
          c.globalAlpha = P.moon ? 0.55 : 1;
          for (const l of leaves) {
            l.y += l.v * dt;
            l.x += (8 + sin(t * 0.7 + l.ph) * 12) * dt;
            l.rot += dt * (2 + l.v * 0.1);
            if (l.y > H + 4 || l.x > W + 4) Object.assign(l, newLeaf(false));
            const w = 1 + abs(cos(l.rot)) * 2.5;
            rect(c, l.x - w / 2, l.y, w, 2, l.col);
          }
          c.globalAlpha = 1;

          // birds crossing now and then (not at night)
          if (t > birds.next) {
            birds.next = t + 15 + random() * 20;
            const n = 3 + ((random() * 3) | 0), y0 = 40 + random() * 50;
            if (!P.moon) for (let i = 0; i < n; i++) birds.list.push({ x: -10 - i * 9, y: y0 + abs(i - n / 2) * 4, v: 22 + random() * 3, ph: random() * TAU });
          }
          birds.list = birds.list.filter((b) => b.x < W + 10);
          for (const b of birds.list) {
            b.x += b.v * dt;
            const w = sin(t * 9 + b.ph) * 2.5;
            line(c, [b.x - 4, b.y - w, b.x, b.y, b.x + 4, b.y - w], '#5a4050', 1);
          }

          c.strokeStyle = K.grass; c.lineWidth = 1;
          for (const g of tufts) {
            const s = sin(t * 1.5 + g.x * 0.05) * 1.5;
            c.beginPath();
            for (const d of [-2, 0, 2]) { c.moveTo(g.x + d, g.y); c.lineTo(g.x + d * 1.5 + s, g.y - g.h); }
            c.stroke();
          }
          fireflies(c, flies, t, P.flies);
          vignette(c, W, H, P.vig);
        },
      };
    },
  };

  // ==========================================================
  // 3. Campfire, playing guitar
  // ==========================================================
  const CAMP = {
    morning: { mtn: '#8ea3c2', pines: '#4a7060', big: '#30503f', ground: ['#7d8a5c', '#5e6c46'], sun: [-150, 70], fire: 0.35 },
    afternoon: { mtn: '#86a2c4', pines: '#437058', big: '#2c5238', ground: ['#83955a', '#617445'], sun: [90, 35], fire: 0.3 },
    evening: { mtn: '#8a6a8e', pines: '#4a4660', big: '#322e46', ground: ['#6a5652', '#4a3c3e'], sun: [150, 150], fire: 0.7 },
    night: { mtn: '#191c3c', pines: '#0e1128', big: '#080a18', ground: ['#16121f', '#0f0c16'], sun: [-130, 45], fire: 1 },
  };

  function pine(c, x, base, h, col) {
    poly(c, [x, base - h, x - h * 0.25, base - h * 0.45, x + h * 0.25, base - h * 0.45], col);
    poly(c, [x, base - h * 0.75, x - h * 0.32, base - h * 0.18, x + h * 0.32, base - h * 0.18], col);
    poly(c, [x, base - h * 0.5, x - h * 0.38, base, x + h * 0.38, base], col);
  }

  function flames(c, x, y, t) {
    const layers = [['#e2451d', 17, 38], ['#ff8a2a', 12, 30], ['#ffc446', 8, 21], ['#fff2b0', 4, 11]];
    layers.forEach(([col, w, h], L) => {
      c.fillStyle = col;
      for (let k = -1; k <= 1; k++) {
        const f = 0.75 + 0.18 * sin(t * 9 + k * 2.1 + L * 1.3) + 0.1 * sin(t * 21.3 + k * 4.7 + L);
        const th = h * f * (k === 0 ? 1 : 0.72), tw = w * (k === 0 ? 0.75 : 0.55), ox = k * w * 0.45, sw = sin(t * 6.3 + k * 1.7 + L) * 2;
        c.beginPath();
        c.moveTo(x + ox - tw, y);
        c.quadraticCurveTo(x + ox - tw * 0.9, y - th * 0.55, x + ox + sw, y - th);
        c.quadraticCurveTo(x + ox + tw * 0.9, y - th * 0.55, x + ox + tw, y);
        c.closePath(); c.fill();
      }
    });
  }

  function guitarist(c, x, seat, t) {
    const skin = '#f1c7a3', sweater = '#6f8fb8', sleeve = '#5a78a0', hair = '#3a2420';
    const bob = sin(t * TAU * 0.6) * 0.8;
    rect(c, x - 12, seat - 3, 10, 7, '#3a3a55'); rect(c, x + 2, seat - 3, 10, 7, '#3a3a55');
    rect(c, x - 11, seat + 4, 8, 13, '#2f2f48'); rect(c, x + 3, seat + 4, 8, 13, '#2f2f48');
    rect(c, x - 12, seat + 16, 10, 3, '#241c1c'); rect(c, x + 2, seat + 16, 10, 3, '#241c1c');
    rrect(c, x - 13, seat - 38 + bob * 0.3, 26, 38, 8, sweater);
    const hx = x, hy = seat - 48 + bob;
    rect(c, x - 3, hy + 8, 6, 5, '#d9ab8a');
    circle(c, hx, hy, 11, skin);
    c.fillStyle = hair; c.beginPath(); c.arc(hx, hy - 1, 11.5, PI * 0.95, PI * 2.05); c.fill();
    rect(c, hx - 12, hy - 2, 4, 12, hair); rect(c, hx + 8, hy - 2, 4, 12, hair);
    c.fillStyle = '#c9574a'; c.beginPath(); c.arc(hx, hy - 4, 12, PI, 0); c.fill();
    rect(c, hx - 12.5, hy - 6, 25, 4, '#a94639');
    circle(c, hx, hy - 16, 3, '#e8d9c8');
    rect(c, hx - 6, hy + 2, 3, 1, hair); rect(c, hx + 3, hy + 2, 3, 1, hair); // eyes closed, enjoying it
    c.globalAlpha = 0.5; rect(c, hx - 8, hy + 4, 3, 2, '#f08a7a'); rect(c, hx + 5, hy + 4, 3, 2, '#f08a7a'); c.globalAlpha = 1;
    rect(c, hx - 1, hy + 6, 2, 1, '#b5705f');

    c.save(); c.translate(x - 8, seat - 12); c.rotate(-0.45);
    rect(c, 8, -2, 34, 4, '#5e3a24'); rect(c, 42, -3, 7, 6, '#3e2618');
    ellipse(c, -2, 0, 11, 9, '#c7803f'); ellipse(c, 8, 0, 8, 7, '#c7803f');
    circle(c, 4, 0, 3, '#3a2010'); rect(c, -9, -1.5, 3, 3, '#3a2010');
    rect(c, -8, -0.5, 52, 1, 'rgba(255,240,220,0.35)');
    c.restore();

    const strum = sin(t * TAU * 1.1) * 3, chord = (Math.floor(t / 2) % 2) * 3;
    line(c, [x - 12, seat - 34, x - 18, seat - 20, x - 4, seat - 16 + strum], sleeve, 5);
    circle(c, x - 4, seat - 16 + strum, 2.5, skin);
    line(c, [x + 12, seat - 34, x + 21, seat - 19, x + 13 + chord, seat - 22 - chord * 0.4], sleeve, 5);
    circle(c, x + 13 + chord, seat - 22 - chord * 0.4, 2.5, skin);
  }

  const campfire = {
    id: 'campfire', name: 'Campfire guitar', outdoor: true,
    mix: { fire: 0.6, crickets: 0.3, wind: 0.12 },
    create(W, H) {
      const r = rng(31), cx = round(W / 2), fx = cx - 10, fy = 230, gx = cx + 62, layer = makeLayer();
      const starList = Array.from({ length: round(W * 0.35) }, () => ({ x: r() * W, y: r() * 175, s: 0.5 + r() * 2.5, p: r() * TAU, big: r() < 0.07 }));
      const pines = [];
      for (let x = -10; x < W + 10; x += 7 + r() * 14) pines.push({ x, h: 26 + r() * 40 });
      const bigPines = [[cx - 235, 150], [cx - 200, 115], [cx + 215, 125], [cx + 255, 160]];
      const flies = Array.from({ length: 14 }, () => ({ x: r() * W, y: 150 + r() * 60, p: r() * TAU, s: 0.6 + r() * 1.2 }));
      const stones = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * TAU + 0.2, r: 2.5 + r() * 1.5 }));
      const cloudList = makeClouds(r, W, 5, 20, 90);
      const shoot = { next: 5, on: false, x: 0, y: 0, life: 0 };
      const embers = [], notes = [];
      let noteNext = 1;

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], K = CAMP[env.tod];
          sky(c, 0, 0, W, 200, P.sky);
          stars(c, starList, t, P.stars);

          if (P.moon && !shoot.on && t > shoot.next) Object.assign(shoot, { on: true, x: W * (0.3 + random() * 0.6), y: 10 + random() * 50, life: 0 });
          if (shoot.on) {
            shoot.life += dt;
            const p = shoot.life / 0.9;
            if (p >= 1) { shoot.on = false; shoot.next = t + 10 + random() * 20; }
            else {
              const hx = shoot.x - p * 90, hy = shoot.y + p * 36, g = c.createLinearGradient(hx, hy, hx + 24, hy - 10);
              g.addColorStop(0, `rgba(255,255,255,${1 - p})`); g.addColorStop(1, 'rgba(255,255,255,0)');
              c.strokeStyle = g; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 24, hy - 9.6); c.stroke();
            }
          }
          sunOrMoon(c, P, cx + K.sun[0], K.sun[1]);
          if (!P.moon) clouds(c, cloudList, W, t, P);

          ridge(c, W, H, (x) => 172 - 28 * abs(sin(x * 0.011 + 0.4)) - 8 * sin(x * 0.037 + 1), K.mtn);
          for (const p of pines) pine(c, p.x, 204, p.h, K.pines);
          c.fillStyle = vgrad(c, 200, H, [[0, K.ground[0]], [1, K.ground[1]]]);
          c.fillRect(0, 200, W, H - 200);
          for (const [x, h] of bigPines) pine(c, x, 245, h, K.big);

          const fl = 1 + 0.06 * sin(t * 11) + 0.04 * sin(t * 17.3);
          c.save(); c.translate(fx, fy); c.scale(1, 0.32); glow(c, 0, 0, 170 * fl, [255, 130, 60], 0.35 * K.fire); c.restore();

          // ---- objects layer: tent, back of the fire pit, log seat, guitarist ----
          const f = layer.begin(W, H);
          const tx = cx - 125;
          poly(f, [tx, 172, tx - 46, 226, tx + 46, 226], '#5a4637');
          poly(f, [tx, 172, tx + 46, 226, tx, 226], `rgba(255,160,90,${0.18 * K.fire})`);
          poly(f, [tx, 184, tx - 14, 226, tx + 14, 226], '#1c1418');
          poly(f, [tx, 184, tx + 14, 226, tx + 22, 226, tx + 3, 190], '#6e5542');
          rect(f, tx - 1, 169, 2, 4, '#3a2a20');
          line(f, [tx - 46, 226, tx - 58, 232], '#2a2020', 1);
          const ring = (cc, front) => stones.forEach((s) => {
            if ((sin(s.a) > 0) !== front) return;
            const x = fx + cos(s.a) * 22, y = fy + sin(s.a) * 5;
            ellipse(cc, x, y, s.r + 1.5, s.r, '#4a4550'); rect(cc, x - 1, y - s.r + 0.5, 3, 1, '#6a6070');
          });
          ring(f, false);
          for (const a of [0.28, -0.28]) { f.save(); f.translate(fx, fy - 2); f.rotate(a); rect(f, -18, -2.5, 36, 5, '#4d2e1d'); f.restore(); }
          rect(f, gx - 26, 222, 52, 9, '#5a3a26');
          ellipse(f, gx + 26, 226.5, 3, 4.5, '#7a5236');
          guitarist(f, gx, 222, t);
          layer.end(c, P.tint);
          glow(c, tx - 3, 216, 14, [255, 200, 120], 0.25 * P.lights);

          flames(c, fx, fy - 2, t);
          ring(c, true);

          if (dt > 0 && random() < dt * 10) embers.push({ x: fx + (random() - 0.5) * 16, y: fy - 8, vx: (random() - 0.5) * 8, vy: -18 - random() * 22, life: 0, max: 1 + random() * 1.8 });
          for (let i = embers.length - 1; i >= 0; i--) {
            const e = embers[i];
            e.life += dt;
            if (e.life > e.max) { embers.splice(i, 1); continue; }
            e.x += (e.vx + sin(t * 3 + e.y * 0.1) * 6) * dt;
            e.y += e.vy * dt;
            const a = 1 - e.life / e.max;
            c.globalAlpha = a; rect(c, e.x, e.y, 1, 1, a > 0.5 ? '#ffd27a' : '#ff7a2a');
          }
          c.globalAlpha = 1;

          if (t > noteNext) { noteNext = t + 1.2 + random() * 2; notes.push({ x: gx + 12, y: 168, life: 0, ph: random() * TAU }); }
          for (let i = notes.length - 1; i >= 0; i--) {
            const n = notes[i];
            n.life += dt;
            if (n.life > 4) { notes.splice(i, 1); continue; }
            n.y -= 7 * dt;
            n.x += sin(t * 2 + n.ph) * 6 * dt;
            c.globalAlpha = min(1, n.life * 2) * (1 - n.life / 4);
            ellipse(c, n.x, n.y, 2, 1.5, P.moon ? '#ffe6b0' : '#fff6e0', -0.4);
            rect(c, n.x + 1.5, n.y - 7, 1, 7); rect(c, n.x + 1.5, n.y - 7, 3, 1);
          }
          c.globalAlpha = 1;

          glow(c, fx, fy - 14, 150 * fl, [255, 140, 60], 0.28 * K.fire);
          fireflies(c, flies, t, P.flies);
          vignette(c, W, H, P.vig);
        },
      };
    },
  };

  // ==========================================================
  // 4. Fishing off a dock, lighthouse in the distance
  // ==========================================================
  const SEA = {
    morning: {
      water: [[0, '#f2dccb'], [0.15, '#a9c6dc'], [0.5, '#6f99bd'], [1, '#3f6892']], island: '#6d7b98',
      tower: '#f0eaf0', stripe: '#c24e5a', refl: [255, 240, 210, 0.5], glint: [255, 255, 255, 0.35],
      streak: ['rgba(255,255,255,0.65)', 'rgba(235,215,225,0.5)'], hz: 'rgba(255,240,220,0.6)', sun: [-120, 80],
    },
    afternoon: {
      water: [[0, '#cfe7f2'], [0.15, '#7fb8dc'], [0.5, '#3f8bbd'], [1, '#1f5c8c']], island: '#566a86',
      tower: '#f4f0f4', stripe: '#c24e5a', refl: [255, 255, 240, 0.35], glint: [255, 255, 255, 0.4],
      streak: ['rgba(255,255,255,0.75)', 'rgba(215,230,245,0.6)'], hz: 'rgba(255,255,255,0.5)', sun: [30, 35],
    },
    evening: {
      sky: [[0, '#1f2150'], [0.35, '#4f3a78'], [0.65, '#b3668a'], [0.85, '#ec9a86'], [1, '#fbcf9a']],
      water: [[0, '#e8a08e'], [0.15, '#a86b8a'], [0.5, '#5a4a80'], [1, '#26284f']], island: '#2e2346',
      tower: '#ece4ea', stripe: '#c24e5a', refl: [255, 220, 170, 0.55], glint: [255, 215, 215, 0.35],
      streak: ['rgba(240,150,150,0.55)', 'rgba(200,110,140,0.5)'], hz: 'rgba(255,220,190,0.6)', sun: [-70, 163], sunR: 24,
    },
    night: {
      water: [[0, '#2b2f5c'], [0.15, '#1e2350'], [0.5, '#151a40'], [1, '#0b0e26']], island: '#101228',
      tower: '#6c6a88', stripe: '#6a3a50', refl: [215, 220, 255, 0.4], glint: [190, 200, 255, 0.25],
      streak: ['rgba(60,62,110,0.5)', 'rgba(40,42,85,0.45)'], hz: 'rgba(150,160,220,0.3)', sun: [-100, 45],
    },
  };

  const seaside = {
    id: 'seaside', name: 'Fishing dock', outdoor: true,
    mix: { waves: 0.55, wind: 0.15 },
    create(W, H) {
      const r = rng(41), cx = round(W / 2), hz = 165, lx = cx + 175, dockEnd = cx + 42, layer = makeLayer();
      const starList = Array.from({ length: 70 }, () => { const y = r() * 120; return { x: r() * W, y, s: 0.5 + r() * 2, p: r() * TAU, fade: 1 - y / 130 }; });
      const glints = Array.from({ length: round(W / 6) }, () => {
        const y = hz + 3 + pow(r(), 1.6) * (H - hz - 3);
        return { x: r() * W, y, w: (2 + r() * 6) * (0.5 + (y - hz) / (H - hz)), p: r() * TAU, s: 0.5 + r() * 1.5 };
      });
      const streaks = Array.from({ length: 5 }, () => ({ x: r() * (W + 200), y: 60 + r() * 80, w: 40 + r() * 70, s: 0.8 + r() * 1.2 }));

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], K = SEA[env.tod], sx = cx + K.sun[0], sy = K.sun[1];
          sky(c, 0, 0, W, hz, K.sky || P.sky);
          stars(c, starList, t, P.stars);
          sunOrMoon(c, P, sx, sy, K.sunR);
          for (const s of streaks) {
            const x = ((s.x + t * s.s) % (W + 200)) - 100;
            rrect(c, x, s.y, s.w, 3, 1.5, K.streak[0]);
            rrect(c, x + 10, s.y + 3, s.w * 0.6, 2, 1, K.streak[1]);
          }

          // island + lighthouse with sweeping beam
          poly(c, [cx + 120, hz, cx + 140, hz - 8, cx + 160, hz - 11, cx + 185, hz - 9, cx + 205, hz - 4, cx + 225, hz], K.island);
          const ly = hz - 10, lamp = P.lights > 0.3;
          poly(c, [lx - 6, ly, lx + 6, ly, lx + 4, ly - 36, lx - 4, ly - 36], K.tower);
          rect(c, lx - 5.5, ly - 12, 11, 5, K.stripe); rect(c, lx - 4.8, ly - 26, 9.6, 5, K.stripe);
          rect(c, lx - 6, ly - 38, 12, 2, '#3a2a40'); rect(c, lx - 3, ly - 44, 6, 6, lamp ? '#ffe9a8' : '#cfd6dc');
          poly(c, [lx - 5, ly - 44, lx + 5, ly - 44, lx, ly - 50], '#3a2a40');
          if (lamp) {
            const a = t * 0.8, dir = cos(a), facing = pow(max(0, sin(a)), 4), by0 = ly - 41, len = 260 * abs(dir);
            if (len > 4) {
              const ex = lx + Math.sign(dir) * len, spread = 4 + 10 * abs(dir), g = c.createLinearGradient(lx, 0, ex, 0);
              g.addColorStop(0, `rgba(255,240,190,${0.35 * P.lights})`); g.addColorStop(1, 'rgba(255,240,190,0)');
              c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g;
              c.beginPath(); c.moveTo(lx, by0 - 1); c.lineTo(ex, by0 - spread); c.lineTo(ex, by0 + spread); c.lineTo(lx, by0 + 1); c.closePath(); c.fill();
              c.restore();
            }
            glow(c, lx, by0, 10 + 30 * facing, [255, 235, 180], (0.5 + 0.5 * facing) * P.lights);
          }

          // sea
          c.fillStyle = vgrad(c, hz, H, K.water);
          c.fillRect(0, hz, W, H - hz);
          rect(c, 0, hz, W, 1, K.hz);
          const [rr, rg, rb, ra] = K.refl;
          for (let y = hz + 2; y < hz + 70; y += 2) {
            const d = (y - hz) / 70, w = (22 - d * 10) * (0.55 + 0.45 * sin(t * 1.7 + y * 0.9));
            c.fillStyle = `rgba(${rr},${rg},${rb},${ra * (1 - d)})`;
            c.fillRect(round(sx - w / 2 + sin(t * 1.1 + y * 0.35) * 2), y, round(w), 1);
          }
          c.fillStyle = 'rgba(20,20,40,0.3)'; c.fillRect(cx + 130, hz + 1, 85, 3);
          const [gr, gg, gb, ga] = K.glint;
          for (const g of glints) {
            c.fillStyle = `rgba(${gr},${gg},${gb},${(0.5 + 0.5 * sin(t * g.s + g.p)) * ga})`;
            c.fillRect(round(g.x + sin(t * 0.3 + g.p) * 4), round(g.y), round(g.w), 1);
          }

          // ---- objects layer: dock, lantern, person, rod ----
          const f = layer.begin(W, H);
          for (let x = 12; x < dockEnd; x += 44) {
            const px = min(x, dockEnd - 6);
            rect(f, px, 222, 5, 32, '#2e2230');
            f.fillStyle = 'rgba(20,15,30,0.35)'; f.fillRect(round(px + sin(t * 2 + x) * 1), 254, 5, 10);
            rect(f, px - 3, 254, 11, 1, 'rgba(255,220,200,0.25)');
          }
          rect(f, 0, 216, dockEnd, 4, '#7a5642'); rect(f, 0, 220, dockEnd, 3, '#523a31');
          for (let x = 4; x < dockEnd; x += 10) rect(f, x, 216, 1, 4, '#654535');
          const lnx = cx - 16;
          rect(f, lnx - 3, 208, 6, 8, '#2e2230'); rect(f, lnx - 2, 210, 4, 5, P.lights > 0.3 ? '#ffd88a' : '#d8d2c0');
          backFigure(f, cx + 14, 190, {
            t, torso: 26, top: '#7f9c8a', shade: '#5f7a6b', hair: '#4a2e28',
            rim: P.moon ? 'rgba(200,210,255,0.5)' : P.rim, bob: sin(t * 0.9) * 0.5,
          });
          const tipX = cx + 80, tipY = 150 + sin(t * 0.9) * 1.5, bbx = cx + 104, bby = 246 + sin(t * 1.6) * 0.8;
          line(f, [cx + 30, 210, tipX, tipY], '#2a1e1e', 1.5);
          layer.end(c, P.tint);
          glow(c, lnx, 212, 26, [255, 200, 120], 0.4 * (0.92 + 0.08 * sin(t * 7)) * P.lights);

          // fishing line, bobber, ripples
          c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.7;
          c.beginPath(); c.moveTo(tipX, tipY); c.quadraticCurveTo(tipX + 18, tipY + 40, bbx, bby); c.stroke();
          for (let k = 0; k < 2; k++) {
            const q = (t * 5 + k * 9) % 18;
            c.strokeStyle = `rgba(255,230,220,${0.4 * (1 - q / 18)})`; c.lineWidth = 1;
            c.beginPath(); c.ellipse(bbx, bby + 1, q, q * 0.25, 0, 0, TAU); c.stroke();
          }
          rect(c, bbx - 1, bby - 2, 3, 2, '#e64a4a'); rect(c, bbx - 1, bby, 3, 1, '#fff');

          if (!P.moon) for (let i = 0; i < 2; i++) { // gulls
            const gx = cx + cos(t * 0.12 + i * 3) * 140, gy = 55 + sin(t * 0.2 + i * 2) * 14 + i * 20;
            const w = sin(t * 0.5 + i) > 0.5 ? sin(t * 8) * 2.5 : 1.2;
            line(c, [gx - 5, gy - w, gx - 2, gy, gx, gy - 1, gx + 2, gy, gx + 5, gy - w], '#2a2040', 1);
          }

          vignette(c, W, H, P.vig * 0.7);
        },
      };
    },
  };

  // Which phase "Auto" means right now, from the local clock.
  function autoPhase(date = new Date()) {
    const h = date.getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  const list = [study, park, campfire, seaside];
  window.Lofi.scenes = { list, byId: Object.fromEntries(list.map((s) => [s.id, s])), TOD, autoPhase };
})();
