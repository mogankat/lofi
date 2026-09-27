// Animated backgrounds. Each scene is drawn procedurally onto a low-resolution
// canvas (270px tall) which CSS scales up with crisp pixels for a lofi look.
//
// Scene shape:  { id, name, outdoor, mix, create(W, H) -> { draw(c, t, dt, env) } }
//   outdoor  – app draws rain/lightning over the whole frame; indoor scenes do it themselves
//   mix      – suggested ambient sound volumes for the scene
//   env      – { rain: 0..1, flash: 0..1, drawRain(c, rect, speed) }
(function () {
  'use strict';
  const TAU = Math.PI * 2, PI = Math.PI;
  const { sin, cos, abs, max, min, round, random, pow } = Math;

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
  // 1. Late-night study — desk by a rainy city window
  // ==========================================================
  const BULBS = [['#ffd27f', [255, 210, 127]], ['#ff9d8a', [255, 157, 138]], ['#9fd3ff', [159, 211, 255]], ['#c6f2a4', [198, 242, 164]]];

  const study = {
    id: 'study', name: 'Late-night study', outdoor: false,
    mix: { rain: 0.45, thunder: 0.18 },
    create(W, H) {
      const r = rng(11), cx = round(W / 2), dy = 198;
      const win = { x: cx - 150, y: 36, w: 300, h: 138 };
      const base = win.y + win.h;
      const stars = Array.from({ length: 45 }, () => ({ x: win.x + r() * win.w, y: win.y + r() * win.h * 0.55, p: r() * TAU, s: 0.5 + r() * 2 }));
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

      function drawSkyline(c, list, col, lit, t) {
        for (const b of list) {
          rect(c, b.x, base - b.h, b.w, b.h, col);
          if (b.ant) {
            rect(c, b.x + b.w / 2, base - b.h - 7, 1, 7, col);
            if (sin(t * 2 + b.x) > 0.6) rect(c, b.x + b.w / 2, base - b.h - 8, 1, 1, '#ff5a5a');
          }
          c.fillStyle = lit;
          for (const w of b.wins) if (sin(t * w.s + w.p) > -0.2) c.fillRect(b.x + w.x, base - b.h + w.y, 2, 2);
        }
      }

      return {
        draw(c, t, dt, env) {
          // wall
          c.fillStyle = vgrad(c, 0, H, [[0, '#231f3d'], [1, '#17142b']]);
          c.fillRect(0, 0, W, H);
          c.fillStyle = 'rgba(255,255,255,0.018)';
          for (let x = cx % 16; x < W; x += 16) c.fillRect(x, 0, 8, dy);

          // view through the window
          c.save();
          c.beginPath(); c.rect(win.x, win.y, win.w, win.h); c.clip();
          c.fillStyle = vgrad(c, win.y, base, [[0, '#0a0f2e'], [0.6, '#1d1a4a'], [1, '#3a2a5e']]);
          c.fillRect(win.x, win.y, win.w, win.h);
          for (const s of stars) { c.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * sin(t * s.s + s.p)); rect(c, s.x, s.y, 1, 1, '#fff'); }
          c.globalAlpha = 1;
          const mx = win.x + win.w - 58, my = win.y + 30;
          glow(c, mx, my, 42, [200, 210, 255], 0.25);
          circle(c, mx, my, 10, '#f1ead0');
          circle(c, mx + 3, my - 2, 2.5, '#e2d9bb'); circle(c, mx - 3, my + 3, 1.5, '#e2d9bb');
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.55})`; c.fillRect(win.x, win.y, win.w, win.h); }
          drawSkyline(c, far, '#29245a', 'rgba(255,214,140,0.45)', t);
          drawSkyline(c, near, '#15122f', '#ffd27f', t);
          env.drawRain(c, win, 0.55);
          c.restore();

          // frame, muntins, curtains, sill
          c.strokeStyle = '#3d365f'; c.lineWidth = 6; c.strokeRect(win.x - 3, win.y - 3, win.w + 6, win.h + 6);
          rect(c, cx - 2, win.y, 4, win.h, '#3d365f');
          rect(c, win.x, win.y + win.h * 0.45 - 2, win.w, 4, '#3d365f');
          rect(c, win.x - 46, win.y - 17, win.w + 92, 3, '#6b5a4a');
          circle(c, win.x - 46, win.y - 15.5, 3, '#6b5a4a'); circle(c, win.x + win.w + 46, win.y - 15.5, 3, '#6b5a4a');
          for (const [x0, dir] of [[win.x - 36, 1], [win.x + win.w - 6, -1]]) {
            rect(c, x0, win.y - 14, 42, win.h + 44, '#473768');
            for (let i = 0; i < 5; i++) rect(c, x0 + 3 + i * 8 + (dir > 0 ? 0 : 1), win.y - 14, 3, win.h + 44, '#3a2d57');
          }
          rect(c, win.x - 14, base + 3, win.w + 28, 6, '#4b4272');
          rect(c, win.x - 14, base + 3, win.w + 28, 1, '#5d538a');

          // cat on the sill, watching the city
          const kx = win.x + 44, ky = base + 3, cc = '#2a2540';
          ellipse(c, kx, ky - 8, 9, 8, cc);
          circle(c, kx, ky - 19, 6, cc);
          poly(c, [kx - 6, ky - 21, kx - 5, ky - 29, kx - 1, ky - 24], cc);
          poly(c, [kx + 6, ky - 21, kx + 5, ky - 29, kx + 1, ky - 24], cc);
          const sw = sin(t * 1.1) * 5;
          c.strokeStyle = cc; c.lineWidth = 3; c.lineCap = 'round';
          c.beginPath(); c.moveTo(kx + 7, ky - 2); c.quadraticCurveTo(kx + 22, ky - 1, kx + 22 + sw * 0.5, ky - 11 - abs(sw) * 0.3); c.stroke();

          // fairy lights
          c.strokeStyle = '#3a3350'; c.lineWidth = 1;
          c.beginPath(); bulbs.forEach((b, i) => (i ? c.lineTo(b.x, b.y) : c.moveTo(b.x, b.y))); c.stroke();
          bulbs.forEach((b, i) => {
            const a = 0.55 + 0.45 * sin(t * 1.3 + i * 1.7);
            glow(c, b.x, b.y + 2, 9, b.rgb, 0.35 * a);
            rect(c, b.x - 1, b.y + 1, 2, 3, b.col);
          });

          // desk
          rect(c, 0, dy, W, 5, '#7a5238');
          rect(c, 0, dy + 5, W, 3, '#5a3a28');
          c.fillStyle = vgrad(c, dy + 8, H, [[0, '#3d281d'], [1, '#2a1b14']]);
          c.fillRect(0, dy + 8, W, H - dy - 8);

          // books
          const bx = cx - 168;
          rect(c, bx - 16, dy - 6, 32, 6, '#7c4a5c'); rect(c, bx - 14, dy - 11, 28, 5, '#46708a'); rect(c, bx - 15, dy - 17, 30, 6, '#b08a4c');
          rect(c, bx + 14, dy - 5, 1, 4, '#e8dcc4'); rect(c, bx + 13, dy - 10, 1, 3, '#e8dcc4');

          // mug + steam
          const gx = cx - 112;
          rect(c, gx - 5, dy - 12, 10, 12, '#e9d9bd');
          rect(c, gx - 5, dy - 12, 10, 2, '#d4c2a2');
          c.strokeStyle = '#e9d9bd'; c.lineWidth = 2; c.beginPath(); c.arc(gx + 6, dy - 6, 3, -PI / 2, PI / 2); c.stroke();
          for (let i = 0; i < 3; i++) for (let k = 0; k < 14; k++) {
            const p = (t * 0.35 + i / 3 + k / 14) % 1;
            c.fillStyle = `rgba(255,255,255,${(1 - p) * 0.3 * (p > 0.05 ? 1 : 0)})`;
            c.fillRect(round(gx + sin(p * 6 + t * 1.3 + i * 2) * 3 * p - 1 + i), round(dy - 14 - p * 26), 1, 1);
          }

          // plant
          const px = cx + 170;
          poly(c, [px - 9, dy - 14, px + 9, dy - 14, px + 7, dy, px - 7, dy], '#b5654a');
          rect(c, px - 10, dy - 16, 20, 3, '#c97a5c');
          for (let i = 0; i < 7; i++) {
            const a = -PI / 2 + (i - 3) * 0.38 + sin(t * 0.8 + i) * 0.05;
            ellipse(c, px + cos(a) * 12, dy - 18 + sin(a) * 12, 7, 2.5, i % 2 ? '#5f8f5a' : '#4c7a4c', a);
          }

          // laptop behind the figure
          rect(c, cx - 36, dy - 40, 72, 40, '#1d1c26');
          c.fillStyle = vgrad(c, dy - 37, dy - 3, [[0, '#c6dbff'], [1, '#8fa9ea']]);
          c.fillRect(cx - 33, dy - 37, 66, 34);
          rect(c, cx - 40, dy - 2, 80, 3, '#9a9aaa');
          glow(c, cx, dy - 22, 80, [140, 180, 255], 0.2);

          backFigure(c, cx, 180, {
            t, torso: 100, top: '#b86b77', shade: '#8e4f5e', hair: '#2b1d2a', phones: '#d9d2ea',
            rim: 'rgba(170,200,255,0.6)', bob: sin(t * TAU * 75 / 60) * 0.8,
            armL: round(sin(t * 9) * 0.8), armR: round(sin(t * 9 + 1.7) * 0.8),
          });

          // desk lamp
          const lx = cx + 118;
          ellipse(c, lx, dy, 12, 3, '#2d2a3a');
          line(c, [lx, dy, lx + 6, dy - 30, lx - 10, dy - 48], '#2d2a3a', 3);
          c.save(); c.translate(lx - 14, dy - 46); c.rotate(0.55);
          poly(c, [-6, -5, 6, -5, 10, 6, -10, 6], '#c8584a');
          c.restore();
          glow(c, lx - 22, dy - 38, 110, [255, 180, 110], 0.22);
          c.save(); c.translate(lx - 26, dy - 1); c.scale(1, 0.25); glow(c, 0, 0, 60, [255, 200, 130], 0.4); c.restore();

          vignette(c, W, H, 0.55);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.08})`; c.fillRect(0, 0, W, H); }
        },
      };
    },
  };

  // ==========================================================
  // 2. Park bench at golden hour
  // ==========================================================
  const LEAF = ['#e07a3f', '#e3a33b', '#c4543a', '#f0c05a'];

  function drawTree(c, x, gy, s, t, ph) {
    rect(c, x - 4 * s, gy - 70 * s, 8 * s, 70 * s + 4, '#5c4038');
    line(c, [x, gy - 45 * s, x + 14 * s, gy - 62 * s], '#5c4038', 3 * s);
    const blobs = [[-20, -78, 22], [18, -82, 24], [0, -102, 25], [-12, -60, 16], [16, -60, 17], [-28, -92, 15], [28, -100, 15]];
    const sway = blobs.map((b, i) => sin(t * 0.9 + ph + i) * 1.3);
    blobs.forEach((b, i) => circle(c, x + (b[0] + sway[i]) * s - 2, gy + b[1] * s + 3, b[2] * s, '#4d6a42'));
    blobs.forEach((b, i) => circle(c, x + (b[0] + sway[i]) * s, gy + b[1] * s, b[2] * s, '#6f8f50'));
    blobs.forEach((b, i) => circle(c, x + (b[0] + sway[i] + 5) * s, gy + (b[1] - 5) * s, b[2] * s * 0.55, '#a5b565'));
  }

  const park = {
    id: 'park', name: 'Park bench', outdoor: true,
    mix: { birds: 0.35, wind: 0.22 },
    create(W, H) {
      const r = rng(21), cx = round(W / 2), gy = 205;
      const clouds = Array.from({ length: 6 }, () => ({
        x: r() * (W + 160), y: 20 + r() * 80, s: 1.5 + r() * 3,
        parts: Array.from({ length: 4 + ((r() * 3) | 0) }, (_, i) => ({ dx: i * 9 - 12 + r() * 4, dy: -r() * 8, r: 6 + r() * 7 })),
      }));
      const newLeaf = (init) => ({ x: random() * W * 1.1 - W * 0.1, y: init ? random() * H : -5, v: 8 + random() * 10, ph: random() * TAU, rot: random() * TAU, col: LEAF[(random() * 4) | 0] });
      const leaves = Array.from({ length: 26 }, () => newLeaf(true));
      const tufts = Array.from({ length: round(W / 8) }, () => ({ x: r() * W, y: 244 + r() * 26, h: 3 + r() * 5 }));
      const bgTrees = Array.from({ length: round(W / 30) }, () => ({ x: r() * W, r: 6 + r() * 7 }));
      const trees = [[cx - 150, 1.15, 0], [cx + 180, 0.95, 2], [cx - 275, 0.9, 4], [cx + 305, 1.1, 1]];
      const birds = { next: 3, list: [] };
      const nearHill = (x) => 190 - 9 * sin(x * 0.018 + 2) - 4 * sin(x * 0.05);

      return {
        draw(c, t, dt, env) {
          c.fillStyle = vgrad(c, 0, gy, [[0, '#5b6aa8'], [0.45, '#e89a8c'], [0.8, '#f8c48f'], [1, '#fbe0a8']]);
          c.fillRect(0, 0, W, gy);
          const sx = cx + 115, sy = 150;
          glow(c, sx, sy, 130, [255, 200, 140], 0.45);
          circle(c, sx, sy, 18, '#fff1c4');

          for (const cl of clouds) {
            const x = ((cl.x + t * cl.s) % (W + 160)) - 80;
            cl.parts.forEach((p) => circle(c, x + p.dx, cl.y + p.dy + 3, p.r, '#e7a49c'));
            cl.parts.forEach((p) => circle(c, x + p.dx, cl.y + p.dy, p.r, '#fbd9c9'));
          }

          ridge(c, W, H, (x) => 172 - 14 * sin(x * 0.012 + 1) - 6 * sin(x * 0.033), '#c48e98');
          for (const b of bgTrees) circle(c, b.x, nearHill(b.x) - b.r * 0.5, b.r, '#7f8a66');
          ridge(c, W, H, nearHill, '#9a9468');
          c.fillStyle = vgrad(c, gy, H, [[0, '#8fa05c'], [1, '#5f7a43']]);
          c.fillRect(0, gy, W, H - gy);
          rect(c, 0, 228, W, 12, '#d9bc92'); rect(c, 0, 228, W, 1, '#e8d0a8'); rect(c, 0, 240, W, 1, '#b99c74');

          for (const [x, s, ph] of trees) drawTree(c, x, gy + 6, s, t, ph);

          // lamp post
          const lp = cx - 78;
          rect(c, lp - 1, 150, 3, 80, '#2f2b3b'); rect(c, lp - 5, 146, 11, 6, '#2f2b3b');
          rect(c, lp - 3, 152, 7, 5, '#ffe2a6'); rect(c, lp - 4, 226, 9, 4, '#2f2b3b');
          glow(c, lp + 1, 155, 30, [255, 220, 160], 0.3);

          // bench, with the figure between seat and backrest
          const bx = cx + 10;
          rect(c, bx - 46, 213, 92, 4, '#9b6440');
          rect(c, bx - 42, 217, 3, 13, '#2f2b3b'); rect(c, bx + 39, 217, 3, 13, '#2f2b3b');
          backFigure(c, bx - 4, 184, {
            t, torso: 32, top: '#d9a066', shade: '#b07c48', hair: '#4a2c2a', longHair: true,
            phones: '#3a3548', rim: 'rgba(255,220,170,0.7)', bob: sin(t * 1.3) * 0.6,
          });
          rect(c, bx - 48, 192, 96, 5, '#a36b45'); rect(c, bx - 48, 196, 96, 1, '#7d4f33');
          rect(c, bx - 48, 201, 96, 5, '#a36b45'); rect(c, bx - 48, 205, 96, 1, '#7d4f33');
          rect(c, bx - 44, 188, 3, 30, '#2f2b3b'); rect(c, bx + 41, 188, 3, 30, '#2f2b3b');

          // falling leaves
          for (const l of leaves) {
            l.y += l.v * dt;
            l.x += (8 + sin(t * 0.7 + l.ph) * 12) * dt;
            l.rot += dt * (2 + l.v * 0.1);
            if (l.y > H + 4 || l.x > W + 4) Object.assign(l, newLeaf(false));
            const w = 1 + abs(cos(l.rot)) * 2.5;
            rect(c, l.x - w / 2, l.y, w, 2, l.col);
          }

          // birds crossing now and then
          if (t > birds.next) {
            birds.next = t + 15 + random() * 20;
            const n = 3 + ((random() * 3) | 0), y0 = 40 + random() * 50;
            for (let i = 0; i < n; i++) birds.list.push({ x: -10 - i * 9, y: y0 + abs(i - n / 2) * 4, v: 22 + random() * 3, ph: random() * TAU });
          }
          birds.list = birds.list.filter((b) => b.x < W + 10);
          for (const b of birds.list) {
            b.x += b.v * dt;
            const w = sin(t * 9 + b.ph) * 2.5;
            line(c, [b.x - 4, b.y - w, b.x, b.y, b.x + 4, b.y - w], '#5a4050', 1);
          }

          c.strokeStyle = '#5a7a40'; c.lineWidth = 1;
          for (const g of tufts) {
            const s = sin(t * 1.5 + g.x * 0.05) * 1.5;
            c.beginPath();
            for (const d of [-2, 0, 2]) { c.moveTo(g.x + d, g.y); c.lineTo(g.x + d * 1.5 + s, g.y - g.h); }
            c.stroke();
          }

          c.fillStyle = 'rgba(255,160,90,0.06)'; c.fillRect(0, 0, W, H);
          vignette(c, W, H, 0.3);
        },
      };
    },
  };

  // ==========================================================
  // 3. Campfire under the stars, playing guitar
  // ==========================================================
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
      const r = rng(31), cx = round(W / 2), fx = cx - 10, fy = 230, gx = cx + 62;
      const stars = Array.from({ length: round(W * 0.35) }, () => ({ x: r() * W, y: r() * 175, s: 0.5 + r() * 2.5, p: r() * TAU, big: r() < 0.07 }));
      const pines = [];
      for (let x = -10; x < W + 10; x += 7 + r() * 14) pines.push({ x, h: 26 + r() * 40 });
      const bigPines = [[cx - 235, 150], [cx - 200, 115], [cx + 215, 125], [cx + 255, 160]];
      const flies = Array.from({ length: 14 }, () => ({ x: r() * W, y: 150 + r() * 60, p: r() * TAU, s: 0.6 + r() * 1.2 }));
      const stones = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * TAU + 0.2, r: 2.5 + r() * 1.5 }));
      const shoot = { next: 5, on: false, x: 0, y: 0, life: 0 };
      const embers = [], notes = [];
      let noteNext = 1;

      return {
        draw(c, t, dt, env) {
          c.fillStyle = vgrad(c, 0, 200, [[0, '#070a1f'], [0.6, '#141a3d'], [1, '#2a2552']]);
          c.fillRect(0, 0, W, 200);
          for (const s of stars) {
            c.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * s.s + s.p));
            rect(c, s.x, s.y, 1, 1, '#fff');
            if (s.big) { rect(c, s.x - 1, s.y, 3, 1); rect(c, s.x, s.y - 1, 1, 3); }
          }
          c.globalAlpha = 1;

          if (!shoot.on && t > shoot.next) Object.assign(shoot, { on: true, x: W * (0.3 + random() * 0.6), y: 10 + random() * 50, life: 0 });
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

          glow(c, cx - 130, 45, 40, [220, 220, 255], 0.25);
          circle(c, cx - 130, 45, 11, '#eee6c8');
          circle(c, cx - 127, 42, 2.5, '#ddd3b2'); circle(c, cx - 134, 49, 1.8, '#ddd3b2');

          ridge(c, W, H, (x) => 172 - 28 * abs(sin(x * 0.011 + 0.4)) - 8 * sin(x * 0.037 + 1), '#191c3c');
          for (const p of pines) pine(c, p.x, 204, p.h, '#0e1128');
          c.fillStyle = vgrad(c, 200, H, [[0, '#16121f'], [1, '#0f0c16']]);
          c.fillRect(0, 200, W, H - 200);
          for (const [x, h] of bigPines) pine(c, x, 245, h, '#080a18');

          const fl = 1 + 0.06 * sin(t * 11) + 0.04 * sin(t * 17.3);
          c.save(); c.translate(fx, fy); c.scale(1, 0.32); glow(c, 0, 0, 170 * fl, [255, 130, 60], 0.35); c.restore();

          // tent
          const tx = cx - 125;
          poly(c, [tx, 172, tx - 46, 226, tx + 46, 226], '#5a4637');
          poly(c, [tx, 172, tx + 46, 226, tx, 226], 'rgba(255,160,90,0.18)');
          poly(c, [tx, 184, tx - 14, 226, tx + 14, 226], '#1c1418');
          poly(c, [tx, 184, tx + 14, 226, tx + 22, 226, tx + 3, 190], '#6e5542');
          glow(c, tx - 3, 216, 14, [255, 200, 120], 0.25);
          rect(c, tx - 1, 169, 2, 4, '#3a2a20');
          line(c, [tx - 46, 226, tx - 58, 232], '#2a2020', 1);

          // fire pit
          const ring = (front) => stones.forEach((s) => {
            if ((sin(s.a) > 0) !== front) return;
            const x = fx + cos(s.a) * 22, y = fy + sin(s.a) * 5;
            ellipse(c, x, y, s.r + 1.5, s.r, '#4a4550'); rect(c, x - 1, y - s.r + 0.5, 3, 1, '#6a6070');
          });
          ring(false);
          for (const a of [0.28, -0.28]) { c.save(); c.translate(fx, fy - 2); c.rotate(a); rect(c, -18, -2.5, 36, 5, '#4d2e1d'); c.restore(); }
          flames(c, fx, fy - 2, t);
          ring(true);

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

          // log seat + guitarist
          rect(c, gx - 26, 222, 52, 9, '#5a3a26');
          ellipse(c, gx + 26, 226.5, 3, 4.5, '#7a5236');
          guitarist(c, gx, 222, t);

          if (t > noteNext) { noteNext = t + 1.2 + random() * 2; notes.push({ x: gx + 12, y: 168, life: 0, ph: random() * TAU }); }
          for (let i = notes.length - 1; i >= 0; i--) {
            const n = notes[i];
            n.life += dt;
            if (n.life > 4) { notes.splice(i, 1); continue; }
            n.y -= 7 * dt;
            n.x += sin(t * 2 + n.ph) * 6 * dt;
            c.globalAlpha = min(1, n.life * 2) * (1 - n.life / 4);
            ellipse(c, n.x, n.y, 2, 1.5, '#ffe6b0', -0.4);
            rect(c, n.x + 1.5, n.y - 7, 1, 7); rect(c, n.x + 1.5, n.y - 7, 3, 1);
          }
          c.globalAlpha = 1;

          glow(c, fx, fy - 14, 150 * fl, [255, 140, 60], 0.28);
          for (const f of flies) {
            const a = pow(max(0, sin(t * f.s + f.p)), 2);
            if (a < 0.02) continue;
            const x = f.x + sin(t * 0.3 + f.p) * 12, y = f.y + cos(t * 0.4 + f.p) * 6;
            glow(c, x, y, 5, [200, 255, 120], 0.5 * a);
            c.globalAlpha = a; rect(c, x, y, 1, 1, '#eaffb0'); c.globalAlpha = 1;
          }
          vignette(c, W, H, 0.55);
        },
      };
    },
  };

  // ==========================================================
  // 4. Fishing off a dock at sunset, lighthouse in the distance
  // ==========================================================
  const seaside = {
    id: 'seaside', name: 'Sunset dock', outdoor: true,
    mix: { waves: 0.55, wind: 0.15 },
    create(W, H) {
      const r = rng(41), cx = round(W / 2), hz = 165, sx = cx - 70, lx = cx + 175, dockEnd = cx + 42;
      const stars = Array.from({ length: 50 }, () => ({ x: r() * W, y: r() * 90, s: 0.5 + r() * 2, p: r() * TAU }));
      const glints = Array.from({ length: round(W / 6) }, () => {
        const y = hz + 3 + pow(r(), 1.6) * (H - hz - 3);
        return { x: r() * W, y, w: (2 + r() * 6) * (0.5 + (y - hz) / (H - hz)), p: r() * TAU, s: 0.5 + r() * 1.5 };
      });
      const streaks = Array.from({ length: 5 }, () => ({ x: r() * (W + 200), y: 60 + r() * 80, w: 40 + r() * 70, s: 0.8 + r() * 1.2 }));

      return {
        draw(c, t, dt, env) {
          c.fillStyle = vgrad(c, 0, hz, [[0, '#1f2150'], [0.35, '#4f3a78'], [0.65, '#b3668a'], [0.85, '#ec9a86'], [1, '#fbcf9a']]);
          c.fillRect(0, 0, W, hz);
          for (const s of stars) { c.globalAlpha = (0.2 + 0.5 * (0.5 + 0.5 * sin(t * s.s + s.p))) * (1 - s.y / 100); rect(c, s.x, s.y, 1, 1, '#fff'); }
          c.globalAlpha = 1;
          glow(c, sx, hz - 4, 130, [255, 190, 140], 0.5);
          circle(c, sx, hz - 2, 24, '#ffe3a6');
          for (const s of streaks) {
            const x = ((s.x + t * s.s) % (W + 200)) - 100;
            rrect(c, x, s.y, s.w, 3, 1.5, 'rgba(240,150,150,0.55)');
            rrect(c, x + 10, s.y + 3, s.w * 0.6, 2, 1, 'rgba(200,110,140,0.5)');
          }

          // island + lighthouse with sweeping beam
          poly(c, [cx + 120, hz, cx + 140, hz - 8, cx + 160, hz - 11, cx + 185, hz - 9, cx + 205, hz - 4, cx + 225, hz], '#2e2346');
          const ly = hz - 10;
          poly(c, [lx - 6, ly, lx + 6, ly, lx + 4, ly - 36, lx - 4, ly - 36], '#ece4ea');
          rect(c, lx - 5.5, ly - 12, 11, 5, '#c24e5a'); rect(c, lx - 4.8, ly - 26, 9.6, 5, '#c24e5a');
          rect(c, lx - 6, ly - 38, 12, 2, '#3a2a40'); rect(c, lx - 3, ly - 44, 6, 6, '#ffe9a8');
          poly(c, [lx - 5, ly - 44, lx + 5, ly - 44, lx, ly - 50], '#3a2a40');
          const a = t * 0.8, dir = cos(a), facing = pow(max(0, sin(a)), 4), bx0 = lx, by0 = ly - 41, len = 260 * abs(dir);
          if (len > 4) {
            const ex = bx0 + Math.sign(dir) * len, spread = 4 + 10 * abs(dir), g = c.createLinearGradient(bx0, 0, ex, 0);
            g.addColorStop(0, 'rgba(255,240,190,0.35)'); g.addColorStop(1, 'rgba(255,240,190,0)');
            c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g;
            c.beginPath(); c.moveTo(bx0, by0 - 1); c.lineTo(ex, by0 - spread); c.lineTo(ex, by0 + spread); c.lineTo(bx0, by0 + 1); c.closePath(); c.fill();
            c.restore();
          }
          glow(c, bx0, by0, 10 + 30 * facing, [255, 235, 180], 0.5 + 0.5 * facing);

          // sea
          c.fillStyle = vgrad(c, hz, H, [[0, '#e8a08e'], [0.15, '#a86b8a'], [0.5, '#5a4a80'], [1, '#26284f']]);
          c.fillRect(0, hz, W, H - hz);
          rect(c, 0, hz, W, 1, 'rgba(255,220,190,0.6)');
          for (let y = hz + 2; y < hz + 70; y += 2) {
            const d = (y - hz) / 70, w = (22 - d * 10) * (0.55 + 0.45 * sin(t * 1.7 + y * 0.9));
            c.fillStyle = `rgba(255,220,170,${0.55 * (1 - d)})`;
            c.fillRect(round(sx - w / 2 + sin(t * 1.1 + y * 0.35) * 2), y, round(w), 1);
          }
          c.fillStyle = 'rgba(46,35,70,0.5)'; c.fillRect(cx + 130, hz + 1, 85, 3);
          for (const g of glints) {
            c.fillStyle = `rgba(255,215,215,${(0.5 + 0.5 * sin(t * g.s + g.p)) * 0.35})`;
            c.fillRect(round(g.x + sin(t * 0.3 + g.p) * 4), round(g.y), round(g.w), 1);
          }

          // dock
          for (let x = 12; x < dockEnd; x += 44) {
            const px = min(x, dockEnd - 6);
            rect(c, px, 222, 5, 32, '#2e2230');
            c.fillStyle = 'rgba(20,15,30,0.35)'; c.fillRect(round(px + sin(t * 2 + x) * 1), 254, 5, 10);
            rect(c, px - 3, 254, 11, 1, 'rgba(255,220,200,0.25)');
          }
          rect(c, 0, 216, dockEnd, 4, '#7a5642'); rect(c, 0, 220, dockEnd, 3, '#523a31');
          for (let x = 4; x < dockEnd; x += 10) rect(c, x, 216, 1, 4, '#654535');

          const lnx = cx - 16;
          rect(c, lnx - 3, 208, 6, 8, '#2e2230'); rect(c, lnx - 2, 210, 4, 5, '#ffd88a');
          glow(c, lnx, 212, 26, [255, 200, 120], 0.4 * (0.92 + 0.08 * sin(t * 7)));

          backFigure(c, cx + 14, 190, {
            t, torso: 26, top: '#7f9c8a', shade: '#5f7a6b', hair: '#4a2e28',
            rim: 'rgba(255,200,160,0.7)', bob: sin(t * 0.9) * 0.5,
          });

          // fishing rod, line, bobber, ripples
          const tipX = cx + 80, tipY = 150 + sin(t * 0.9) * 1.5, bbx = cx + 104, bby = 246 + sin(t * 1.6) * 0.8;
          line(c, [cx + 30, 210, tipX, tipY], '#2a1e1e', 1.5);
          c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.7;
          c.beginPath(); c.moveTo(tipX, tipY); c.quadraticCurveTo(tipX + 18, tipY + 40, bbx, bby); c.stroke();
          for (let k = 0; k < 2; k++) {
            const rr = (t * 5 + k * 9) % 18;
            c.strokeStyle = `rgba(255,230,220,${0.4 * (1 - rr / 18)})`; c.lineWidth = 1;
            c.beginPath(); c.ellipse(bbx, bby + 1, rr, rr * 0.25, 0, 0, TAU); c.stroke();
          }
          rect(c, bbx - 1, bby - 2, 3, 2, '#e64a4a'); rect(c, bbx - 1, bby, 3, 1, '#fff');

          // gulls
          for (let i = 0; i < 2; i++) {
            const gx = cx + cos(t * 0.12 + i * 3) * 140, gy = 55 + sin(t * 0.2 + i * 2) * 14 + i * 20;
            const w = sin(t * 0.5 + i) > 0.5 ? sin(t * 8) * 2.5 : 1.2;
            line(c, [gx - 5, gy - w, gx - 2, gy, gx, gy - 1, gx + 2, gy, gx + 5, gy - w], '#2a2040', 1);
          }

          vignette(c, W, H, 0.35);
        },
      };
    },
  };

  const list = [study, park, campfire, seaside];
  window.Lofi.scenes = { list, byId: Object.fromEntries(list.map((s) => [s.id, s])) };
})();
