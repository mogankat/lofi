// Study desk by a city window.
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { TAU, PI, PHASES, rng, rect, circle, ellipse, rrect, poly, line, vgrad, glow, pool, vignette, shade, sky, makeStars, stars, moon, sunOrMoon, makeLayer, lookOf, gear, outfit, drawPet, perchBird, owl, backFigure, steam, makeFlock, flock } = K;
  const { sin, cos, round } = Math;

  const BULBS = [['#ffd27f', [255, 210, 127]], ['#ff9d8a', [255, 157, 138]], ['#9fd3ff', [159, 211, 255]], ['#c6f2a4', [198, 242, 164]]];
  const ROOM = {
    morning: {
      wall: ['#aea4c4', '#9186ab'], frame: '#e4dcea', curtain: '#d4919a', fold: '#bf7d88', rod: '#8a7060',
      sill: '#e8e0ee', sillHi: '#f8f4fb', deskTop: '#b07d53', deskEdge: '#8c5f3b', desk: ['#7f5438', '#65422d'],
      cat: '#463d55', far: '#a9b8d2', near: '#7a87a6', win: 'rgba(230,240,255,0.45)',
      sun: [0.2, 0.3, 12], beam: [255, 236, 200, 0.14], beamX: -40, bird: '#4a4a5a',
    },
    afternoon: {
      wall: ['#b7a9c9', '#9a8cb0'], frame: '#ece6f2', curtain: '#d98f8f', fold: '#c77b7e', rod: '#8a7060',
      sill: '#efe8f2', sillHi: '#ffffff', deskTop: '#b98356', deskEdge: '#94633d', desk: ['#8a5a3a', '#6e4630'],
      cat: '#4a4058', far: '#b3c6de', near: '#8190ad', win: 'rgba(235,245,255,0.5)',
      sun: null, beam: [255, 250, 235, 0.12], beamX: 0, bird: '#3a3a4a',
    },
    evening: {
      wall: ['#7a5f86', '#5a4466'], frame: '#b8a0b8', curtain: '#b86a78', fold: '#a05a6a', rod: '#6b5a4a',
      sill: '#b89fb8', sillHi: '#cfb6cc', deskTop: '#9a6440', deskEdge: '#744a30', desk: ['#5c3c2a', '#40291d'],
      cat: '#35294a', far: '#8f6f8f', near: '#4d3b5e', win: 'rgba(255,200,150,0.3)',
      sun: [0.8, 0.36, 14], beam: [255, 170, 110, 0.16], beamX: 50, bird: '#3a2a3a',
    },
    night: {
      wall: ['#231f3d', '#17142b'], frame: '#3d365f', curtain: '#473768', fold: '#3a2d57', rod: '#6b5a4a',
      sill: '#4b4272', sillHi: '#5d538a', deskTop: '#7a5238', deskEdge: '#5a3a28', desk: ['#3d281d', '#2a1b14'],
      cat: '#2a2540', far: '#29245a', near: '#15122f', win: null,
      sun: null, beam: null, beamX: 0, bird: null,
    },
  };

  // Office chair seen from behind, in front of the person sitting in it.
  function chair(c, x, col) {
    const dark = shade(col, -0.35), light = shade(col, 0.18);
    rrect(c, x - 32, 250, 64, 9, 4, dark); // seat edge
    rrect(c, x - 28, 212, 56, 42, 12, col); // backrest
    rrect(c, x - 24, 215, 48, 3, 2, light);
    rect(c, x - 3, 258, 6, 8, '#2a2830'); // gas lift
    rect(c, x - 26, 265, 52, 3, '#2a2830');
    for (const dx of [-24, 0, 24]) circle(c, x + dx, 269, 2.5, '#1e1c22');
  }

  window.Lofi.scenes.register({
    id: 'study', name: 'Study desk', outdoor: false,
    mix: { rain: 0.45, thunder: 0.18 },
    create(W, H) {
      const r = rng(11), cx = round(W / 2), dy = 198, layer = makeLayer(), birds = makeFlock();
      const win = { x: cx - 150, y: 36, w: 300, h: 138 };
      const base = win.y + win.h;
      const starList = makeStars(r, 45, win.x, win.w, win.y, win.h * 0.55);
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
          const P = PHASES[env.tod], R = ROOM[env.tod], lights = P.lights, lk = lookOf(env), fit = outfit(lk, '#b86b77');

          // view through the window
          c.save();
          c.beginPath(); c.rect(win.x, win.y, win.w, win.h); c.clip();
          sky(c, win.x, win.y, win.w, win.h, P.sky);
          stars(c, starList, t, P.stars);
          if (P.moon) moon(c, win.x + win.w - 58, win.y + 30, 10);
          else if (R.sun) sunOrMoon(c, P, win.x + win.w * R.sun[0], win.y + win.h * R.sun[1], R.sun[2]);
          if (R.bird) flock(c, birds, t, dt, env.fx.birds, win.x, win.x + win.w, win.y + 8, win.y + 45, R.bird);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.55})`; c.fillRect(win.x, win.y, win.w, win.h); }
          drawSkyline(c, far, R.far, 'rgba(255,214,140,0.45)', R.win, lights, t);
          drawSkyline(c, near, R.near, '#ffd27f', R.win, lights, t);
          if (env.fx.birds) { if (P.moon) owl(c, win.x + win.w - 36, base, t); else perchBird(c, win.x + win.w - 36, base, t, 1, '#7a6a5a', true); }
          env.drawWind(c, win);
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
          const sway = sin(t * 1.4) * env.fx.wind * 3; // curtains stir when it's windy
          for (const [x0, dir] of [[win.x - 36, 1], [win.x + win.w - 6, -1]]) {
            poly(c, [x0, win.y - 14, x0 + 42, win.y - 14, x0 + 42 + (dir < 0 ? sway : 0), win.y + win.h + 30, x0 + (dir > 0 ? sway : 0), win.y + win.h + 30], R.curtain);
            for (let i = 0; i < 5; i++) rect(c, x0 + 3 + i * 8 + (dir > 0 ? 0 : 1) + sway * 0.5, win.y - 14, 3, win.h + 44, R.fold);
          }
          rect(c, win.x - 14, base + 3, win.w + 28, 6, R.sill);
          rect(c, win.x - 14, base + 3, win.w + 28, 1, R.sillHi);

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
          if (lk.pet === 'cat') drawPet(f, lk, cx - 96, base + 3, t, R.cat); // on the sill, watching the city
          const bx = cx - 148;
          rect(f, bx - 16, dy - 6, 32, 6, '#7c4a5c'); rect(f, bx - 14, dy - 11, 28, 5, '#46708a'); rect(f, bx - 15, dy - 17, 30, 6, '#b08a4c');
          rect(f, bx + 14, dy - 5, 1, 4, '#e8dcc4'); rect(f, bx + 13, dy - 10, 1, 3, '#e8dcc4');
          const gx = cx - 62;
          rect(f, gx - 5, dy - 12, 10, 12, '#e9d9bd');
          rect(f, gx - 5, dy - 12, 10, 2, '#d4c2a2');
          f.strokeStyle = '#e9d9bd'; f.lineWidth = 2; f.beginPath(); f.arc(gx + 6, dy - 6, 3, -PI / 2, PI / 2); f.stroke();
          const px = cx + 152;
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
            t, torso: 74, top: fit.top, shade: fit.shade, hair: lk.hair || '#2b1d2a', phones: gear(lk, '#d9d2ea'),
            rim: P.moon ? 'rgba(170,200,255,0.6)' : P.rim, bob: sin(t * TAU * 75 / 60) * 0.8,
            armL: round(sin(t * 9) * 0.8), armR: round(sin(t * 9 + 1.7) * 0.8),
          });
          chair(f, cx, lk.furniture || '#3d3a4a');
          if (lk.pet === 'dog') drawPet(f, lk, cx + 56, 270, t); // on the floor beside the chair
          const lx = cx + 118;
          ellipse(f, lx, dy, 12, 3, '#2d2a3a');
          line(f, [lx, dy, lx + 6, dy - 30, lx - 10, dy - 48], '#2d2a3a', 3);
          f.save(); f.translate(lx - 14, dy - 46); f.rotate(0.55);
          poly(f, [-6, -5, 6, -5, 10, 6, -10, 6], '#c8584a');
          f.restore();
          layer.end(c, P.tint, 0.6);

          // ---- light ----
          steam(c, gx, dy - 14, t);
          if (R.beam) { const [br, bg, bb, ba] = R.beam; pool(c, cx + R.beamX, dy + 4, 200, [br, bg, bb], ba * 1.6, 0.3); }
          bulbs.forEach((b, i) => glow(c, b.x, b.y + 2, 9, b.rgb, 0.35 * (0.55 + 0.45 * sin(t * 1.3 + i * 1.7)) * (0.25 + 0.75 * lights)));
          glow(c, cx, dy - 22, 80, [140, 180, 255], 0.2 * (0.3 + 0.7 * lights));
          if (lights > 0.05) {
            glow(c, lx - 22, dy - 38, 110, [255, 180, 110], 0.22 * lights);
            pool(c, lx - 26, dy - 1, 60, [255, 200, 130], 0.4 * lights);
          }

          vignette(c, W, H, P.vig);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.08})`; c.fillRect(0, 0, W, H); }
        },
      };
    },
  });
})();
