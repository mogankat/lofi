// Café window seat looking out on a street, with passing cars and people: shops
// across the road in the city, fields in the countryside, the sea at the beach.
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { TAU, PHASES, rng, rect, circle, ellipse, rrect, poly, line, vgrad, glow, pool, vignette, shade, makeLayer, lookOf, headwear, friendWear, outfit, FRIEND, drawPet, perchBird, owl, backFigure, legs, steam } = K;
  const { sin, round, random } = Math;

  const CAFE = {
    morning: {
      wall: ['#7a5644', '#5a3e30'], frame: '#3a2a22', top: '#c08e5e', counter: ['#6e4a32', '#4a3020'],
      facade: ['#e0c2a8', '#c8a8b8', '#b0c0d0', '#e6d098'], road: '#8c8c96', walk: '#bdb4aa', trim: '#f4ece0',
      shop: 'rgba(225,238,250,0.55)', up: '#a3b3c8',
    },
    afternoon: {
      wall: ['#7e5a46', '#5e4232'], frame: '#3a2a22', top: '#c8955f', counter: ['#744e34', '#4e3322'],
      facade: ['#ecccb0', '#d4b2c2', '#b8cadc', '#f0da9e'], road: '#909098', walk: '#c6bdb2', trim: '#faf4e8',
      shop: 'rgba(230,242,255,0.6)', up: '#adbdd2',
    },
    evening: {
      wall: ['#5e3e32', '#422a22'], frame: '#2e201a', top: '#a87448', counter: ['#583a28', '#3a261a'],
      facade: ['#b88a80', '#9a7690', '#7e8aa6', '#c0a070'], road: '#6a6070', walk: '#948680', trim: '#e8d0c0',
      shop: null, up: '#6a6a88',
    },
    night: {
      wall: ['#3a2620', '#281a16'], frame: '#221812', top: '#8a5c38', counter: ['#40291c', '#2a1a12'],
      facade: ['#3e3656', '#352e4c', '#2e3450', '#453a50'], road: '#24222e', walk: '#3a3644', trim: '#5a5270',
      shop: null, up: '#1e1c2c',
    },
  };
  const AWNING = [['#c8584a', '#f2e6d8'], ['#3f6f8f', '#f2e6d8'], ['#5a8a5a', '#f2e6d8'], ['#d8a040', '#6a3a2a']];
  const CAR = ['#c8584a', '#3f6f8f', '#e0c060', '#6a8a6a', '#e8e4dc', '#4a4a5a', '#8a5aa0'];
  const COAT = ['#6a5a8a', '#b86a5a', '#3f6f8f', '#8a7a5a', '#4a4a5a', '#c89a5a'];

  window.Lofi.scenes.register({
    id: 'cafe', name: 'Café window', group: 'town', outdoor: false,
    mix: { cafe: 0.45, rain: 0.25 },
    create(W, H) {
      const r = rng(51), cx = round(W / 2), layer = makeLayer();
      const win = { x: cx - 200, y: 18, w: 400, h: 150 }, base = win.y + win.h;
      const street = { shops: 128, road: 133, near: 152 };
      const shops = [];
      for (let x = win.x - 20; x < win.x + win.w + 20;) {
        const w = 56 + ((r() * 34) | 0), h = 72 + ((r() * 34) | 0);
        // Each upstairs window has its own slow on/off rhythm, like people moving
        // between rooms; a few have a TV flickering.
        const ups = Array.from({ length: 6 }, () => ({ p: r() * TAU, s: 0.03 + r() * 0.12, bias: r() * 0.9 - 0.3, tv: r() < 0.15 }));
        shops.push({ x, w, h, face: (r() * 4) | 0, awning: AWNING[(r() * 4) | 0], ups });
        x += w + 2;
      }
      const view = K.viewer({ x: win.x, y: win.y, w: win.w, h: street.shops - win.y }, { seed: 51, window: false }); // across the road
      const lamps = [win.x + 70, win.x + 230, win.x + 370];
      const cars = [], people = [];
      let nextCar = 1, nextPerson = 0.5;

      function drawStreet(c, t, dt, env, P, C, city) {
        const lights = P.lights, rain = env.fx.rain > 0.1;
        // shops across the road (in the city)
        if (city) for (const s of shops) {
          const top = street.shops - s.h;
          rect(c, s.x, top, s.w, s.h, C.facade[s.face]);
          rect(c, s.x, top, s.w, 3, shade(C.facade[s.face], -0.15)); // cornice
          for (let i = 0; i < 6; i++) { // upper windows
            const wx = s.x + 8 + (i % 3) * ((s.w - 16) / 3), wy = top + 10 + ((i / 3) | 0) * 18;
            const u = s.ups[i], lit = lights > 0.3 && sin(t * u.s + u.p) + sin(t * u.s * 2.7 + u.p * 3) * 0.4 > u.bias;
            if (!lit) rect(c, wx, wy, 9, 11, C.up);
            else if (u.tv) rect(c, wx, wy, 9, 11, `rgba(${150 + 40 * sin(t * 7 + u.p)},${170 + 30 * sin(t * 5.3 + u.p)},255,${0.55 + 0.25 * sin(t * 11 + u.p) * sin(t * 3.1)})`);
            else rect(c, wx, wy, 9, 11, `rgba(255,214,140,${0.5 + 0.5 * lights})`);
            rect(c, wx, wy + 11, 9, 1, C.trim);
          }
          const shopTop = street.shops - 30;
          rect(c, s.x + 5, shopTop + 6, s.w - 22, 20, C.shop || `rgba(255,200,120,${0.6 + 0.4 * lights})`);
          if (!C.shop) glow(c, s.x + s.w / 2 - 6, shopTop + 16, 30, [255, 190, 110], 0.18 * lights);
          rect(c, s.x + s.w - 14, shopTop + 8, 9, 22, shade(C.facade[s.face], -0.4)); // door
          for (let i = 0; i < s.w; i += 6) rect(c, s.x + i, shopTop - 2, 6, 7, s.awning[(i / 6) % 2]); // striped awning
          rect(c, s.x, shopTop + 5, s.w, 1, 'rgba(0,0,0,0.2)');
        }
        // pavement + road
        rect(c, win.x, street.shops, win.w, street.road - street.shops, C.walk);
        rect(c, win.x, street.road, win.w, street.near - street.road, C.road);
        for (let x = win.x + 6; x < win.x + win.w; x += 24) rect(c, x, 142, 12, 1, 'rgba(255,255,255,0.35)');
        rect(c, win.x, street.near, win.w, base - street.near, shade(C.walk, 0.08));
        rect(c, win.x, street.near, win.w, 1, 'rgba(0,0,0,0.2)');
        if (rain) { c.fillStyle = 'rgba(200,210,240,0.12)'; c.fillRect(win.x, street.road, win.w, street.near - street.road); } // wet road sheen

        // street lamps
        for (const lx of lamps) {
          rect(c, lx, 88, 2, street.shops - 88 + 2, '#2a2830');
          rect(c, lx - 3, 86, 8, 4, '#2a2830');
          rect(c, lx - 2, 89, 6, 2, lights > 0.3 ? '#ffe2a6' : '#c8ccd0');
          if (lights > 0.3) { glow(c, lx + 1, 91, 26, [255, 220, 160], 0.35 * lights); pool(c, lx + 1, 131, 28, [255, 210, 150], 0.25 * lights); }
        }
        if (env.fx.birds) {
          if (P.moon) owl(c, lamps[1] + 1, 86, t);
          else { perchBird(c, lamps[0] + 1, 86, t, 0.5, '#8a8a96'); perchBird(c, win.x + 150, street.road - 1, t, 2, '#8a8a96', true); }
        }

        // cars
        if (dt > 0 && t > nextCar) {
          nextCar = t + 2.5 + random() * 5;
          const dir = random() < 0.5 ? 1 : -1;
          cars.push({ x: dir > 0 ? win.x - 40 : win.x + win.w + 40, dir, y: dir > 0 ? 149 : 141, v: 34 + random() * 18, col: CAR[(random() * CAR.length) | 0] });
        }
        for (let i = cars.length - 1; i >= 0; i--) {
          const k = cars[i];
          k.x += k.dir * k.v * dt;
          if (k.x < win.x - 60 || k.x > win.x + win.w + 60) { cars.splice(i, 1); continue; }
          rrect(c, k.x - 16, k.y - 9, 32, 7, 2, k.col);
          rrect(c, k.x - 9, k.y - 14, 18, 6, 2, k.col);
          rect(c, k.x - 7, k.y - 13, 6, 4, 'rgba(180,210,240,0.8)'); rect(c, k.x + 1, k.y - 13, 6, 4, 'rgba(180,210,240,0.8)');
          circle(c, k.x - 9, k.y - 2, 2.5, '#1e1c22'); circle(c, k.x + 9, k.y - 2, 2.5, '#1e1c22');
          rect(c, k.x - k.dir * 16, k.y - 8, 1, 2, '#ff4a4a');
          if (lights > 0.3) glow(c, k.x + k.dir * 18, k.y - 6, 14, [255, 240, 200], 0.45 * lights);
        }

        // people walking by (with umbrellas when it rains)
        if (dt > 0 && t > nextPerson) {
          nextPerson = t + 1.5 + random() * 4;
          const dir = random() < 0.5 ? 1 : -1;
          people.push({ x: dir > 0 ? win.x - 10 : win.x + win.w + 10, dir, v: 10 + random() * 6, coat: COAT[(random() * COAT.length) | 0], ph: random() * TAU, umb: AWNING[(random() * 4) | 0][0], h: 20 + random() * 4 });
        }
        for (let i = people.length - 1; i >= 0; i--) {
          const p = people[i], y = base - 2;
          p.x += p.dir * p.v * dt;
          if (p.x < win.x - 20 || p.x > win.x + win.w + 20) { people.splice(i, 1); continue; }
          const step = sin(t * 7 + p.ph) * 2;
          rect(c, p.x - 2 + step * 0.5, y - 7, 2, 7, '#2a2830'); rect(c, p.x + 1 - step * 0.5, y - 7, 2, 7, '#2a2830');
          rrect(c, p.x - 4, y - p.h + 6, 8, p.h - 12, 2, p.coat);
          circle(c, p.x, y - p.h + 3, 3, '#e0b89a');
          if (rain) { c.fillStyle = p.umb; c.beginPath(); c.arc(p.x, y - p.h, 9, Math.PI, 0); c.fill(); rect(c, p.x, y - p.h, 1, 8, '#2a2830'); }
        }
      }

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], C = CAFE[env.tod], lk = lookOf(env), fit = outfit(lk, '#c8584a');
          const glowLevel = 0.35 + 0.65 * P.lights;

          // view through the window
          c.save();
          c.beginPath(); c.rect(win.x, win.y, win.w, win.h); c.clip();
          view.draw(c, t, dt, env);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.5})`; c.fillRect(win.x, win.y, win.w, win.h); }
          drawStreet(c, t, dt, env, P, C, view.kind(env) === 'city');
          env.drawWind(c, win);
          env.drawRain(c, win, 0.8);
          // glass reflections + lettering
          c.fillStyle = 'rgba(255,255,255,0.05)';
          for (const x0 of [win.x + 40, win.x + 190, win.x + 320]) poly(c, [x0, win.y, x0 + 26, win.y, x0 - 34, base, x0 - 60, base], 'rgba(255,255,255,0.045)');
          c.save(); c.translate(cx, win.y + 25); c.scale(-1, 1); // painted on the glass, so we see it backwards
          c.font = 'bold 13px Georgia, serif'; c.textAlign = 'center';
          c.lineWidth = 3; c.strokeStyle = 'rgba(40,24,16,0.75)'; c.strokeText('CAFÉ', 0, 0);
          c.fillStyle = 'rgba(245,205,125,0.9)'; c.fillText('CAFÉ', 0, 0);
          c.restore();
          c.restore();

          // wall, frame, counter
          c.fillStyle = vgrad(c, 0, H, [[0, C.wall[0]], [1, C.wall[1]]]);
          c.fillRect(0, 0, W, win.y); c.fillRect(0, win.y, win.x, win.h); c.fillRect(win.x + win.w, win.y, W - win.x - win.w, win.h);
          for (let x = cx % 22; x < W; x += 22) { if (x < win.x - 6 || x > win.x + win.w + 6) rect(c, x, 0, 1, base, 'rgba(0,0,0,0.12)'); }
          c.strokeStyle = C.frame; c.lineWidth = 7; c.strokeRect(win.x - 3, win.y - 3, win.w + 6, win.h + 3);
          rect(c, win.x + win.w / 3 - 2, win.y, 4, win.h, C.frame); rect(c, win.x + (2 * win.w) / 3 - 2, win.y, 4, win.h, C.frame);
          rect(c, win.x, win.y + 32, win.w, 3, C.frame);
          rect(c, 0, base, W, 7, C.top); rect(c, 0, base, W, 1, shade(C.top, 0.2));
          c.fillStyle = vgrad(c, base + 7, H, [[0, C.counter[0]], [1, C.counter[1]]]);
          c.fillRect(0, base + 7, W, H - base - 7);
          for (let x = cx % 40; x < W; x += 40) rect(c, x, base + 12, 1, H, 'rgba(0,0,0,0.18)');

          // ---- objects layer ----
          const f = layer.begin(W, H);
          for (const px of [cx - 178, cx + 178]) { // potted plants on the counter
            rect(f, px - 7, base - 12, 14, 12, '#c8795a'); rect(f, px - 8, base - 13, 16, 2, '#d88a6a');
            for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.45 + sin(t * 0.7 + i + px) * 0.05; ellipse(f, px + Math.cos(a) * 10, base - 16 + sin(a) * 10, 6, 2.2, i % 2 ? '#5f8f5a' : '#4c7a4c', a); }
          }
          if (lk.pet === 'cat') drawPet(f, lk, cx - 82, base, t); // on the counter, people-watching
          // latte + croissant
          const mx = cx + 42;
          ellipse(f, mx, base - 1, 9, 2, '#f0ebe4');
          rrect(f, mx - 6, base - 11, 12, 10, 3, '#f4efe8'); rect(f, mx - 5, base - 11, 10, 2, '#b88a5a');
          f.strokeStyle = '#f4efe8'; f.lineWidth = 2; f.beginPath(); f.arc(mx + 7, base - 6, 2.5, -1.4, 1.4); f.stroke();
          ellipse(f, cx - 44, base - 1, 10, 2, '#f0ebe4');
          ellipse(f, cx - 44, base - 5, 8, 4, '#d8983f'); ellipse(f, cx - 44, base - 6, 5, 2.5, '#e8b060');
          // pendant lamps
          for (const lx of [cx - 130, cx, cx + 130]) {
            line(f, [lx, 0, lx, 20], '#1e1a18', 1);
            f.fillStyle = '#2e4a3e'; f.beginPath(); f.arc(lx, 27, 9, Math.PI, 0); f.fill();
            rect(f, lx - 9, 27, 18, 1, '#c8a060');
          }
          // stools + people
          const stool = lk.furniture || '#7a4a30';
          const seat = (x, pants) => {
            legs(f, x, 230, 29, { pants }); // shins down to the footrest, behind the stool's post
            rrect(f, x - 20, 226, 40, 7, 3, stool); rect(f, x - 3, 233, 6, 37, '#2a2830'); rect(f, x - 15, 262, 30, 2, '#2a2830');
          };
          if (lk.friend) {
            seat(cx + 92, FRIEND.pants);
            backFigure(f, cx + 92, 160, { t, torso: 68, top: FRIEND.top, shade: FRIEND.shade, hair: FRIEND.hair, longHair: true, ...friendWear(lk), rim: P.rim, bob: sin(t * 1.1 + 2) * 0.5 });
          }
          seat(cx, '#3a3a55');
          backFigure(f, cx, 158, {
            t, torso: 70, top: fit.top, shade: fit.shade, hair: lk.hair || '#3a2420', ...headwear(lk, '#e8e0d0'),
            rim: P.rim, bob: sin(t * 1.2) * 0.6, armL: sin(t * 0.5) > 0.7 ? -3 : 0,
          });
          if (lk.pet === 'dog') drawPet(f, lk, cx - 48, 270, t); // on the floor by the stool
          layer.end(c, P.tint, 0.5);

          // ---- light ----
          steam(c, mx, base - 12, t);
          for (const lx of [cx - 130, cx, cx + 130]) {
            glow(c, lx, 30, 60, [255, 200, 130], 0.3 * glowLevel);
            rect(c, lx - 3, 27, 6, 2, '#fff2c8');
            pool(c, lx, base + 2, 70, [255, 200, 130], 0.25 * glowLevel);
          }
          vignette(c, W, H, P.vig * 0.8);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.08})`; c.fillRect(0, 0, W, H); }
        },
      };
    },
  });
})();
