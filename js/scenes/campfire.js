// Campfire, playing guitar.
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { TAU, PI, PHASES, rng, rect, circle, ellipse, rrect, poly, line, vgrad, glow, pool, vignette, ridge, shade, sky, stars, sunOrMoon, makeClouds, clouds, makeFlies, fireflies, fliesLevel, makeFlock, flock, makeLayer, lookOf, headwear, friendWear, FRIEND, drawPet, perchBird, owl, flames } = K;
  const { sin, cos, abs, min, round, random } = Math;

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

  // Front-facing person sitting and playing guitar. o: { sweater, hair, hat, skin, ph }
  function guitarist(c, x, seat, t, o) {
    const skin = o.skin, sweater = o.sweater, sleeve = shade(sweater, -0.15), hair = o.hair, ph = o.ph || 0;
    const bob = sin(t * TAU * 0.6 + ph) * 0.8;
    rect(c, x - 12, seat - 3, 10, 7, '#3a3a55'); rect(c, x + 2, seat - 3, 10, 7, '#3a3a55');
    rect(c, x - 11, seat + 4, 8, 13, '#2f2f48'); rect(c, x + 3, seat + 4, 8, 13, '#2f2f48');
    rect(c, x - 12, seat + 16, 10, 3, '#241c1c'); rect(c, x + 2, seat + 16, 10, 3, '#241c1c');
    rrect(c, x - 13, seat - 38 + bob * 0.3, 26, 38, 8, sweater);
    const hx = x, hy = seat - 48 + bob;
    rect(c, x - 3, hy + 8, 6, 5, shade(skin, -0.1));
    circle(c, hx, hy, 11, skin);
    c.fillStyle = hair; c.beginPath(); c.arc(hx, hy - 1, 11.5, PI * 0.95, PI * 2.05); c.fill();
    rect(c, hx - 12, hy - 2, 4, 12, hair); rect(c, hx + 8, hy - 2, 4, 12, hair);
    if (o.hat) {
      c.fillStyle = o.hat; c.beginPath(); c.arc(hx, hy - 4, 12, PI, 0); c.fill();
      rect(c, hx - 12.5, hy - 6, 25, 4, shade(o.hat, -0.18));
      circle(c, hx, hy - 16, 3, '#e8d9c8');
    }
    if (o.phones) {
      c.strokeStyle = o.phones; c.lineWidth = 2.5;
      c.beginPath(); c.arc(hx, hy - 1, 13.5, PI * 1.02, PI * 1.98); c.stroke();
      rrect(c, hx - 17, hy - 3, 6, 11, 2, o.phones);
      rrect(c, hx + 11, hy - 3, 6, 11, 2, o.phones);
    }
    rect(c, hx - 6, hy + 2, 3, 1, hair); rect(c, hx + 3, hy + 2, 3, 1, hair); // eyes closed, enjoying it
    c.globalAlpha = 0.5; rect(c, hx - 8, hy + 4, 3, 2, '#f08a7a'); rect(c, hx + 5, hy + 4, 3, 2, '#f08a7a'); c.globalAlpha = 1;
    rect(c, hx - 1, hy + 6, 2, 1, shade(skin, -0.35));

    c.save(); c.translate(x - 8, seat - 12); c.rotate(-0.45);
    rect(c, 8, -2, 34, 4, '#5e3a24'); rect(c, 42, -3, 7, 6, '#3e2618');
    ellipse(c, -2, 0, 11, 9, o.guitar || '#c7803f'); ellipse(c, 8, 0, 8, 7, o.guitar || '#c7803f');
    circle(c, 4, 0, 3, '#3a2010'); rect(c, -9, -1.5, 3, 3, '#3a2010');
    rect(c, -8, -0.5, 52, 1, 'rgba(255,240,220,0.35)');
    c.restore();

    const strum = sin(t * TAU * 1.1 + ph) * 3, chord = (Math.floor(t / 2 + ph) % 2) * 3;
    line(c, [x - 12, seat - 34, x - 18, seat - 20, x - 4, seat - 16 + strum], sleeve, 5);
    circle(c, x - 4, seat - 16 + strum, 2.5, skin);
    line(c, [x + 12, seat - 34, x + 21, seat - 19, x + 13 + chord, seat - 22 - chord * 0.4], sleeve, 5);
    circle(c, x + 13 + chord, seat - 22 - chord * 0.4, 2.5, skin);
  }

  window.Lofi.scenes.register({
    id: 'campfire', name: 'Campfire guitar', outdoor: true,
    mix: { fire: 0.6, crickets: 0.3, wind: 0.12 },
    create(W, H) {
      const r = rng(31), cx = round(W / 2), fx = cx - 10, fy = 230, gx = cx + 62, layer = makeLayer(), birds = makeFlock();
      const starList = Array.from({ length: round(W * 0.35) }, () => ({ x: r() * W, y: r() * 175, s: 0.5 + r() * 2.5, p: r() * TAU, big: r() < 0.07 }));
      const pines = [];
      for (let x = -10; x < W + 10; x += 7 + r() * 14) pines.push({ x, h: 26 + r() * 40 });
      const bigPines = [[cx - 235, 150], [cx - 200, 115], [cx + 215, 125], [cx + 255, 160]];
      const flies = makeFlies(r, 14, 0, W, 150, 60);
      const stones = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * TAU + 0.2, r: 2.5 + r() * 1.5 }));
      const cloudList = makeClouds(r, W, 5, 20, 90);
      const shoot = { next: 5, on: false, x: 0, y: 0, life: 0 };
      const embers = [], notes = [];
      let noteNext = 1;

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], C = CAMP[env.tod], lk = lookOf(env), tent = lk.tent || '#5a4637', wind = env.fx.wind;
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
          sunOrMoon(c, P, cx + C.sun[0], C.sun[1]);
          if (!P.moon) {
            clouds(c, cloudList, W, t, P, 1 + wind * 3);
            flock(c, birds, t, dt, env.fx.birds, 0, W, 30, 110, '#3a3a4a');
          }

          ridge(c, W, H, (x) => 172 - 28 * abs(sin(x * 0.011 + 0.4)) - 8 * sin(x * 0.037 + 1), C.mtn);
          for (const p of pines) pine(c, p.x, 204, p.h, C.pines);
          c.fillStyle = vgrad(c, 200, H, [[0, C.ground[0]], [1, C.ground[1]]]);
          c.fillRect(0, 200, W, H - 200);
          for (const [x, h] of bigPines) pine(c, x, 245, h, C.big);

          const fl = 1 + 0.06 * sin(t * 11) + 0.04 * sin(t * 17.3);
          pool(c, fx, fy, 170 * fl, [255, 130, 60], 0.35 * C.fire, 0.32);

          // ---- objects layer: tent, back of the fire pit, seats, people ----
          const f = layer.begin(W, H);
          const tx = cx - 125;
          poly(f, [tx, 172, tx - 46, 226, tx + 46, 226], tent);
          poly(f, [tx, 172, tx + 46, 226, tx, 226], `rgba(255,160,90,${0.18 * C.fire})`);
          poly(f, [tx, 184, tx - 14, 226, tx + 14, 226], '#1c1418');
          poly(f, [tx, 184, tx + 14, 226, tx + 22, 226, tx + 3, 190], shade(tent, 0.15));
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
          guitarist(f, gx, 222, t, { skin: '#f1c7a3', sweater: lk.outfit || '#6f8fb8', hair: lk.hair || '#3a2420', ...headwear(lk, '#e8e0d0') });
          if (lk.friend) { // on a stump, jamming along
            const sx = cx - 68;
            rect(f, sx - 12, 222, 24, 10, '#6a4a30'); ellipse(f, sx, 222, 12, 3, '#8a6848');
            guitarist(f, sx, 222, t, { skin: FRIEND.skin, sweater: '#8a6aa8', hair: FRIEND.hair, ...friendWear(lk), ph: 1.9, guitar: '#9a5a36' });
          }
          drawPet(f, lk, gx + 40, 238, t);
          if (env.fx.birds && !P.moon) perchBird(f, tx, 172, t, 1);
          layer.end(c, P.tint);
          if (env.fx.birds && P.moon) owl(c, tx, 172, t);
          glow(c, tx - 3, 216, 14, [255, 200, 120], 0.25 * P.lights);

          flames(c, fx, fy - 2, t, 1, wind);
          ring(c, true);

          if (dt > 0 && random() < dt * 10) embers.push({ x: fx + (random() - 0.5) * 16, y: fy - 8, vx: (random() - 0.5) * 8, vy: -18 - random() * 22, life: 0, max: 1 + random() * 1.8 });
          for (let i = embers.length - 1; i >= 0; i--) {
            const e = embers[i];
            e.life += dt;
            if (e.life > e.max) { embers.splice(i, 1); continue; }
            e.x += (e.vx + wind * 30 + sin(t * 3 + e.y * 0.1) * 6) * dt;
            e.y += e.vy * dt;
            const a = 1 - e.life / e.max;
            c.globalAlpha = a; rect(c, e.x, e.y, 1, 1, a > 0.5 ? '#ffd27a' : '#ff7a2a');
          }
          c.globalAlpha = 1;

          if (t > noteNext) {
            noteNext = t + 1.2 + random() * 2;
            const who = lk.friend && random() < 0.5 ? cx - 58 : gx + 12;
            notes.push({ x: who, y: 168, life: 0, ph: random() * TAU });
          }
          for (let i = notes.length - 1; i >= 0; i--) {
            const n = notes[i];
            n.life += dt;
            if (n.life > 4) { notes.splice(i, 1); continue; }
            n.y -= 7 * dt;
            n.x += (sin(t * 2 + n.ph) * 6 + wind * 12) * dt;
            c.globalAlpha = min(1, n.life * 2) * (1 - n.life / 4);
            ellipse(c, n.x, n.y, 2, 1.5, P.moon ? '#ffe6b0' : '#fff6e0', -0.4);
            rect(c, n.x + 1.5, n.y - 7, 1, 7); rect(c, n.x + 1.5, n.y - 7, 3, 1);
          }
          c.globalAlpha = 1;

          glow(c, fx, fy - 14, 150 * fl, [255, 140, 60], 0.28 * C.fire);
          fireflies(c, flies, t, fliesLevel(P, env));
          vignette(c, W, H, P.vig);
        },
      };
    },
  });
})();
