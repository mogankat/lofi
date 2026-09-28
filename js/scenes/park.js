// Park bench, looking out over the city, the countryside or the sea.
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { TAU, PHASES, rng, rect, circle, line, vgrad, glow, pool, vignette, makeFlies, fireflies, fliesLevel, makeLayer, lookOf, headwear, friendWear, outfit, FRIEND, drawPet, perchBird, owl, backFigure, legs } = K;
  const { sin, cos, abs, round, random } = Math;

  const LEAF = ['#e07a3f', '#e3a33b', '#c4543a', '#f0c05a'];
  const PARK = {
    morning: { bush: '#5f8a5a', ground: ['#8fb265', '#6a9148'], path: '#dcc8a4', leaf: ['#4f7048', '#6f9656', '#b8cf7a'], trunk: '#5c4038', grass: '#5f8a45' },
    afternoon: { bush: '#528a4c', ground: ['#8dbb5a', '#62943f'], path: '#e2cfa6', leaf: ['#4b7040', '#6a9a4c', '#a9cc68'], trunk: '#5c4038', grass: '#5a8a3a' },
    evening: { bush: '#6a7a56', ground: ['#8fa05c', '#5f7a43'], path: '#d9bc92', leaf: ['#4d6a42', '#6f8f50', '#a5b565'], trunk: '#5c4038', grass: '#5a7a40' },
    night: { bush: '#172230', ground: ['#1f2c30', '#141e22'], path: '#3a3b4c', leaf: ['#111b24', '#19282f', '#27403f'], trunk: '#1c171e', grass: '#17241f' },
  };

  function drawTree(c, x, gy, s, t, ph, pal, wind) {
    rect(c, x - 4 * s, gy - 70 * s, 8 * s, 70 * s + 4, pal.trunk);
    line(c, [x, gy - 45 * s, x + 14 * s, gy - 62 * s], pal.trunk, 3 * s);
    const blobs = [[-20, -78, 22], [18, -82, 24], [0, -102, 25], [-12, -60, 16], [16, -60, 17], [-28, -92, 15], [28, -100, 15]];
    const amp = 1.3 + wind * 3.5, speed = 0.9 + wind * 1.4;
    const sway = blobs.map((b, i) => sin(t * speed + ph + i) * amp + wind * 2);
    blobs.forEach((b, i) => circle(c, x + (b[0] + sway[i]) * s - 2, gy + b[1] * s + 3, b[2] * s, pal.leaf[0]));
    blobs.forEach((b, i) => circle(c, x + (b[0] + sway[i]) * s, gy + b[1] * s, b[2] * s, pal.leaf[1]));
    blobs.forEach((b, i) => circle(c, x + (b[0] + sway[i] + 5) * s, gy + (b[1] - 5) * s, b[2] * s * 0.55, pal.leaf[2]));
  }

  window.Lofi.scenes.register({
    id: 'park', name: 'Park bench', group: 'town', outdoor: true,
    mix: { birds: 0.35, wind: 0.22 },
    create(W, H) {
      const r = rng(21), cx = round(W / 2), gy = 205, layer = makeLayer();
      const view = K.viewer({ x: 0, y: 0, w: W, h: gy }, { seed: 21, window: false }); // beyond the park
      const newLeaf = (init) => ({ x: random() * W * 1.1 - W * 0.1, y: init ? random() * H : -5, v: 8 + random() * 10, ph: random() * TAU, rot: random() * TAU, col: LEAF[(random() * 4) | 0] });
      const leaves = Array.from({ length: 26 }, () => newLeaf(true));
      const tufts = Array.from({ length: round(W / 8) }, () => ({ x: r() * W, y: 244 + r() * 26, h: 3 + r() * 5 }));
      const bushes = Array.from({ length: round(W / 14) }, (_, i) => ({ x: i * 14 + r() * 8, r: 4 + r() * 5 }));
      const trees = [[cx - 150, 1.15, 0], [cx + 180, 0.95, 2], [cx - 275, 0.9, 4], [cx + 305, 1.1, 1]];
      const flies = makeFlies(r, 12, 0, W, 175, 50);

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], K2 = PARK[env.tod], lk = lookOf(env), fit = outfit(lk, '#d9a066'), wind = env.fx.wind;
          view.draw(c, t, dt, env);
          for (const b of bushes) circle(c, b.x, gy - 1, b.r, K2.bush); // the park's edge
          c.fillStyle = vgrad(c, gy, H, [[0, K2.ground[0]], [1, K2.ground[1]]]);
          c.fillRect(0, gy, W, H - gy);
          rect(c, 0, 228, W, 12, K2.path); rect(c, 0, 228, W, 1, 'rgba(255,255,255,0.18)'); rect(c, 0, 240, W, 1, 'rgba(0,0,0,0.12)');
          for (const [x, s, ph] of trees) drawTree(c, x, gy + 6, s, t, ph, K2, wind);
          if (env.fx.birds && P.moon) { // owls on the branches at night
            owl(c, cx - 150 + 16, gy + 6 - 71, t);
            owl(c, cx + 180 + 13, gy + 6 - 59, t, 2);
          }

          // ---- objects layer: lamp post, bench, people ----
          const f = layer.begin(W, H);
          const lp = cx - 78, on = P.lights > 0.3;
          rect(f, lp - 1, 150, 3, 80, '#2f2b3b'); rect(f, lp - 5, 146, 11, 6, '#2f2b3b');
          rect(f, lp - 3, 152, 7, 5, on ? '#ffe2a6' : '#cfd3d8'); rect(f, lp - 4, 226, 9, 4, '#2f2b3b');
          const bx = cx + 10, me = lk.friend ? bx - 22 : bx - 4, pal = lk.furniture || '#9b6440';
          // lower legs hang below the seat, behind the bench legs
          legs(f, me, 216, 25, { pants: '#3a3a55' });
          if (lk.friend) legs(f, bx + 24, 216, 25, { pants: FRIEND.pants });
          rect(f, bx - 46, 213, 92, 4, K.shade(pal, 0));
          rect(f, bx - 42, 217, 3, 28, '#2f2b3b'); rect(f, bx + 39, 217, 3, 28, '#2f2b3b'); // the bench stands on the grass
          if (lk.friend) backFigure(f, bx + 24, 186, { t, torso: 30, top: FRIEND.top, shade: FRIEND.shade, hair: FRIEND.hair, ...friendWear(lk), rim: P.rim, bob: sin(t * 1.1 + 2) * 0.6 });
          backFigure(f, me, 184, {
            t, torso: 32, top: fit.top, shade: fit.shade, hair: lk.hair || '#4a2c2a', longHair: true, wind,
            ...headwear(lk, '#3a3548'), rim: P.rim, bob: sin(t * 1.3) * 0.6,
          });
          const slat = K.shade(pal, 0.08), slatDark = K.shade(pal, -0.2);
          rect(f, bx - 48, 192, 96, 5, slat); rect(f, bx - 48, 196, 96, 1, slatDark);
          rect(f, bx - 48, 201, 96, 5, slat); rect(f, bx - 48, 205, 96, 1, slatDark);
          rect(f, bx - 44, 188, 3, 30, '#2f2b3b'); rect(f, bx + 41, 188, 3, 30, '#2f2b3b');
          drawPet(f, lk, bx + (lk.friend ? 64 : 58), 245, t); // on the grass beside the bench
          if (env.fx.birds && !P.moon) {
            perchBird(f, cx - 44, 235, t, 0);
            perchBird(f, cx - 32, 237, t, 2.1, '#7a5a40', true);
            perchBird(f, cx + 118, 236, t, 4.2);
          }
          layer.end(c, P.tint);
          if (on) {
            glow(c, lp + 1, 155, 34, [255, 220, 160], 0.4 * P.lights);
            pool(c, lp + 1, 230, 50, [255, 210, 150], 0.3 * P.lights);
          }

          // falling leaves (they blow sideways when it's windy)
          c.globalAlpha = P.moon ? 0.55 : 1;
          for (const l of leaves) {
            l.y += l.v * (1 + wind * 0.6) * dt;
            l.x += (8 + wind * 60 + sin(t * 0.7 + l.ph) * 12) * dt;
            l.rot += dt * (2 + l.v * 0.1 + wind * 6);
            if (l.y > H + 4 || l.x > W + 4) Object.assign(l, newLeaf(false));
            const w = 1 + abs(cos(l.rot)) * 2.5;
            rect(c, l.x - w / 2, l.y, w, 2, l.col);
          }
          c.globalAlpha = 1;

          c.strokeStyle = K2.grass; c.lineWidth = 1;
          for (const g of tufts) {
            const s = sin(t * (1.5 + wind * 2) + g.x * 0.05) * (1.5 + wind * 2) + wind * 2;
            c.beginPath();
            for (const d of [-2, 0, 2]) { c.moveTo(g.x + d, g.y); c.lineTo(g.x + d * 1.5 + s, g.y - g.h); }
            c.stroke();
          }
          fireflies(c, flies, t, fliesLevel(P, env));
          vignette(c, W, H, P.vig);
        },
      };
    },
  });
})();
