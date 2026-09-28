// Town: a glasshouse full of plants. Watering at the potting bench while a
// friend mists the hanging baskets; rain patters on the glass.
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { TAU, PI, PHASES, rng, rect, circle, ellipse, rrect, poly, line, vgrad, glow, pool, vignette, shade, makeLayer, lookOf, headwear, friendWear, outfit, FRIEND, drawPet, backFigure, standing, arm } = K;
  const { sin, cos, abs, min, round, random } = Math;

  const GARDEN = {
    morning: { frame: '#eef0ea', bench: '#8a6a4a', floor: ['#b07058', '#8a5444'], leaf: ['#4c8a4c', '#5f9a5a', '#7ab070'] },
    afternoon: { frame: '#f2f4ee', bench: '#906e4c', floor: ['#b87660', '#90584a'], leaf: ['#4a8a48', '#5c9a54', '#78b06a'] },
    evening: { frame: '#dcd4d4', bench: '#6e5240', floor: ['#8a5a4c', '#6a4438'], leaf: ['#4a6a48', '#5a7a52', '#6e8a60'] },
    night: { frame: '#5a5e70', bench: '#3a2e28', floor: ['#3e2e2c', '#2a201e'], leaf: ['#1e3a2e', '#26463a', '#2e5244'] },
  };
  const FLOWERS = ['#e0506a', '#f08a4a', '#f4d04a', '#c070d0', '#f4f0f0'];
  const WINGS = [['#f08a3a', '#3a2a20'], ['#f4f4f0', '#8a8a96'], ['#6a9ae0', '#2a3a6a']];

  function pot(c, x, y, w, h, col = '#c07050') {
    poly(c, [x - w / 2, y - h, x + w / 2, y - h, x + w / 2 - 2, y, x - w / 2 + 2, y], col);
    rect(c, x - w / 2 - 1, y - h - 2, w + 2, 3, shade(col, 0.12));
  }
  // One plant on the bench: kind picks the shape; (x, y) = the bottom of its pot.
  function plant(c, p, x, y, t, L, wind) {
    const sw = sin(t * (0.8 + wind * 2) + p.ph) * (0.6 + wind * 2);
    if (p.kind === 'tray') { // seedlings
      rect(c, x - 14, y - 4, 28, 4, '#6a5040');
      for (let i = 0; i < 7; i++) { const sx = x - 12 + i * 4; line(c, [sx, y - 4, sx + sw * 0.3, y - 8 - (i % 2)], L.leaf[2], 1); ellipse(c, sx + sw * 0.3, y - 9 - (i % 2), 1.6, 1, L.leaf[2]); }
      return;
    }
    pot(c, x, y, p.w, p.h);
    const top = y - p.h - 2;
    if (p.kind === 'fern') {
      for (let i = 0; i < 7; i++) {
        const a = -PI / 2 + (i - 3) * 0.42, len = 14 + (i % 3) * 3;
        const ex = x + cos(a) * len + sw, ey = top + sin(a) * len * 0.7 + (abs(i - 3) * 2);
        line(c, [x, top, (x + ex) / 2, (top + ey) / 2 - 3, ex, ey], L.leaf[i % 2], 1.6);
        for (let k = 1; k < 4; k++) ellipse(c, x + (ex - x) * k / 4, top + (ey - top) * k / 4 - 2, 2, 1, L.leaf[2], a);
      }
    } else if (p.kind === 'succulent') {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ellipse(c, x + cos(a) * 4, top - 3 + sin(a) * 2, 3, 1.6, i % 2 ? '#7aa89a' : '#8abcaa', a); }
      circle(c, x, top - 4, 2, '#9accb8');
    } else if (p.kind === 'flower') {
      for (let i = 0; i < 6; i++) { const a = -PI / 2 + (i - 2.5) * 0.5; ellipse(c, x + cos(a) * 6 + sw * 0.3, top - 3 + sin(a) * 5, 3.5, 2.2, L.leaf[i % 2], a); }
      for (let i = 0; i < 4; i++) circle(c, x - 5 + i * 3.5 + sw * 0.5, top - 9 - (i % 2) * 3, 2.2, p.col);
    } else if (p.kind === 'cactus') {
      rrect(c, x - 3, top - 16, 6, 16, 3, '#5a8a58'); rrect(c, x - 8, top - 11, 4, 7, 2, '#5a8a58'); rect(c, x - 6, top - 6, 3, 2, '#5a8a58');
      for (let k = 0; k < 4; k++) rect(c, x - 1, top - 14 + k * 4, 1, 1, '#d8e8c8');
      circle(c, x, top - 17, 2, p.col);
    } else if (p.kind === 'snake') {
      for (let i = 0; i < 5; i++) { const lx = x - 6 + i * 3, h = 14 + ((i * 7) % 9); poly(c, [lx - 1.5, top, lx + 1.5, top, lx + sw * 0.2, top - h], i % 2 ? '#4a7a44' : '#5a8a50'); }
    } else { // monstera
      for (let i = 0; i < 4; i++) {
        const a = -PI / 2 + (i - 1.5) * 0.6, lx = x + cos(a) * 12 + sw, ly = top + sin(a) * 12;
        line(c, [x, top, lx, ly], L.leaf[0], 1.2);
        ellipse(c, lx, ly, 7, 5, L.leaf[1], a); ellipse(c, lx, ly, 2, 5, 'rgba(0,0,0,0.12)', a);
      }
    }
  }

  window.Lofi.scenes.register({
    id: 'greenhouse', name: 'Greenhouse', group: 'town', outdoor: false,
    mix: { rain: 0.4, birds: 0.25 },
    create(W, H) {
      const r = rng(101), cx = round(W / 2), layer = makeLayer(), floorY = 214, benchY = 182;
      const eave = 78, peak = 12, span = 250; // the glass roof's outline, seen from inside
      const roofY = (x) => (abs(x - cx) > span ? eave : peak + (eave - peak) * (abs(x - cx) / span));
      const view = K.viewer({ x: 0, y: 0, w: W, h: benchY }, { seed: 101, rain: 0.7 }); // outside, through the glass
      const KINDS = ['fern', 'flower', 'succulent', 'cactus', 'snake', 'monstera', 'tray', 'flower'];
      const plants = [];
      for (let x = 10; x < W - 6; x += 22 + r() * 12) {
        const kind = KINDS[(r() * KINDS.length) | 0];
        plants.push({ x, kind, w: 10 + r() * 6, h: 8 + r() * 5, col: FLOWERS[(r() * FLOWERS.length) | 0], ph: r() * TAU });
      }
      const low = Array.from({ length: round(W / 34) }, (_, i) => ({ x: 18 + i * 34 + r() * 8, w: 12 + r() * 6, h: 9 + r() * 4 }));
      const baskets = [cx - 196, cx - 30, cx + 176];
      const flies = Array.from({ length: 3 }, (_, i) => ({ ph: random() * TAU, s: 0.3 + random() * 0.2, cx: cx - 150 + i * 150, wing: WINGS[i] }));
      const bulbs = [];
      for (let x = cx - span; x <= cx + span; x += 14) bulbs.push({ x, y: roofY(x) + 6 + sin(((x - cx + span) / 28) * PI) * 3 });

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], G = GARDEN[env.tod], lk = lookOf(env), fit = outfit(lk, '#c8a878'), lights = P.lights, wind = env.fx.wind;

          // outside, through the glass (with the rain running down it)
          view.draw(c, t, dt, env);
          // the glass: a faint sheen, and reflections
          c.fillStyle = 'rgba(235,245,240,0.08)'; c.fillRect(0, 0, W, benchY);
          for (const x0 of [cx - 170, cx + 40, cx + 210]) poly(c, [x0, 0, x0 + 22, 0, x0 - 40, benchY, x0 - 62, benchY], 'rgba(255,255,255,0.05)');

          // white-painted iron frame
          c.strokeStyle = G.frame; c.lineWidth = 4;
          c.beginPath(); c.moveTo(-5, eave); c.lineTo(cx - span, eave); c.lineTo(cx, peak); c.lineTo(cx + span, eave); c.lineTo(W + 5, eave); c.stroke();
          c.lineWidth = 2;
          for (let k = -6; k <= 6; k++) { // glazing bars across the roof above the gable
            if (!k) continue;
            const gx = cx + k * 42, gy = roofY(gx);
            c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + k * 14, 0); c.stroke();
          }
          for (let x = cx % 48; x < W; x += 48) rect(c, x - 1.5, roofY(x), 3, benchY - roofY(x), G.frame);
          rect(c, 0, 116, W, 3, G.frame);
          c.beginPath(); c.arc(cx, 40, 13, 0, TAU); c.stroke(); // round vent at the peak
          for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 0.05; line(c, [cx, 40, cx + cos(a) * 13, 40 + sin(a) * 13], G.frame, 1); }
          // knee wall, floor
          rect(c, 0, benchY, W, floorY - benchY, shade(G.floor[1], -0.1));
          c.fillStyle = vgrad(c, floorY, H, [[0, G.floor[0]], [1, G.floor[1]]]);
          c.fillRect(0, floorY, W, H - floorY);
          c.fillStyle = 'rgba(0,0,0,0.15)';
          for (let y = floorY, row = 0; y < H; y += 7, row++) { c.fillRect(0, y, W, 1); for (let x = (row % 2) * 9; x < W; x += 18) c.fillRect(x, y, 1, 7); }

          // ---- objects layer ----
          const f = layer.begin(W, H);
          if (lights > 0.3) { // string lights along the roof
            f.strokeStyle = 'rgba(40,34,40,0.8)'; f.lineWidth = 1;
            f.beginPath(); bulbs.forEach((b, i) => (i ? f.lineTo(b.x, b.y) : f.moveTo(b.x, b.y))); f.stroke();
            bulbs.forEach((b) => rect(f, b.x - 1, b.y + 1, 2, 2, '#ffe2a6'));
          }
          // hanging baskets with trailing vines
          baskets.forEach((bx, i) => {
            const top = roofY(bx) + 2, by = top + 30, s = sin(t * 0.8 + i) * (0.6 + wind * 2);
            for (const dx of [-7, 0, 7]) line(f, [bx, top, bx + dx + s, by - 2], '#6a6050', 1);
            ellipse(f, bx + s, by, 10, 5, '#8a6a4a');
            for (let k = 0; k < 5; k++) {
              const vx = bx + s - 8 + k * 4, len = 12 + ((k * 5) % 11);
              for (let d = 0; d < len; d += 3) circle(f, vx + sin(d * 0.3 + t * 0.9 + k) * (1 + wind), by + 2 + d, 1.5, k % 2 ? G.leaf[1] : G.leaf[2]);
            }
            for (let k = 0; k < 4; k++) ellipse(f, bx + s - 6 + k * 4, by - 4, 3, 2, G.leaf[k % 2]);
          });
          // potting bench with plants, and pots and a watering can underneath
          rect(f, 0, benchY, W, 4, G.bench); rect(f, 0, benchY, W, 1, shade(G.bench, 0.2));
          for (let x = 6; x < W; x += 60) rect(f, x, benchY + 4, 4, floorY + 6 - benchY, shade(G.bench, -0.25));
          rect(f, 0, 204, W, 3, shade(G.bench, -0.1));
          for (const p of low) pot(f, p.x, 204, p.w, p.h, '#b86a4e');
          for (const p of plants) plant(f, p, p.x, benchY, t, G, wind);
          // big plants on the floor at the sides
          const fig = cx - 222;
          pot(f, fig, 262, 26, 22, '#a86048');
          line(f, [fig, 240, fig - 2, 170, fig + 2, 120], '#6a5040', 3);
          for (let i = 0; i < 16; i++) { const a = i * 2.4, ly = 124 + (i / 16) * 110, lx = fig + (i % 2 ? 1 : -1) * (6 + (i % 3) * 3); ellipse(f, lx + sin(t * 0.7 + i) * 0.8, ly, 6, 4, G.leaf[i % 3], (i % 2 ? 0.6 : -0.6) + sin(a) * 0.1); }
          const palm = cx + 226;
          pot(f, palm, 262, 24, 20, '#c07a5a');
          for (let i = 0; i < 7; i++) {
            const a = -PI / 2 + (i - 3) * 0.38 + sin(t * 0.6 + i) * 0.04 * (1 + wind * 3), len = 50 + (i % 2) * 12;
            f.strokeStyle = G.leaf[i % 2]; f.lineWidth = 3; f.lineCap = 'round';
            f.beginPath(); f.moveTo(palm, 240); f.quadraticCurveTo(palm + cos(a) * len * 0.5, 240 + sin(a) * len * 0.8, palm + cos(a) * len, 240 + sin(a) * len * 0.75 + 16); f.stroke();
          }

          // your friend misting a hanging basket
          if (lk.friend) {
            const fx = cx - 140, sh = 118, puff = (t % 2.2) < 0.35;
            const hx = fx - 34, hy = 84;
            arm(f, [fx - 21, sh + 6, fx - 34, sh - 12, hx, hy + 8], FRIEND.shade, FRIEND.skin);
            rrect(f, hx - 3, hy - 4, 6, 10, 2, '#6ab0c8'); rect(f, hx - 2, hy - 8, 4, 4, '#f4f4f0'); rect(f, hx - 6, hy - 8, 4, 2, '#f4f4f0');
            standing(f, fx, sh, 264, {
              t, torso: 70, top: FRIEND.top, shade: FRIEND.shade, hair: FRIEND.hair, longHair: true, skin: FRIEND.skin, ...friendWear(lk),
              arms: false, pants: FRIEND.pants, apron: '#5a7a5a', turn: -1, bob: sin(t * 0.8 + 1) * 0.3,
            });
            arm(f, [fx + 21, sh + 8, fx + 28, sh + 34, fx + 22, sh + 50], FRIEND.shade, FRIEND.skin);
            if (puff) for (let i = 0; i < 12; i++) { const q = ((t % 2.2) / 0.35), a = PI + 0.6 - (i / 12) * 1.2; rect(f, hx - 6 + cos(a) * q * 18, hy - 7 + sin(a) * q * 10, 1, 1, 'rgba(255,255,255,0.8)'); }
          }

          // you, on a stool at the bench, watering the plants now and then
          const me = cx + 40, sh = 150, cycle = t % 8, pour = cycle > 3 && cycle < 6 ? min(1, (cycle - 3) * 2, (6 - cycle) * 2) : 0;
          const hand = [me + 50, 170 - pour * 4];
          f.save(); f.translate(hand[0], hand[1]); f.rotate(pour * 0.5); // watering can
          rrect(f, 2, -6, 16, 12, 3, '#6a9a8a'); line(f, [16, 0, 28, -6], '#6a9a8a', 2); rect(f, 26, -8, 4, 3, '#5a8a7a');
          f.strokeStyle = '#5a8a7a'; f.lineWidth = 2; f.beginPath(); f.arc(9, -6, 6, PI, 0); f.stroke();
          f.restore();
          arm(f, [me + 21, sh + 6, me + 34, sh + 26, hand[0] + 2, hand[1]], fit.shade);
          legsStool(f, me, lk);
          backFigure(f, me, sh, { t, torso: 58, top: fit.top, shade: fit.shade, hair: lk.hair || '#4a2c2a', ...headwear(lk, '#3a3548'), rim: P.rim, arms: false, bob: sin(t * 0.9) * 0.4 });
          rrect(f, me - 33, sh + 4, 12, 30, 6, fit.shade); // the other arm, resting
          if (pour > 0.6) for (let i = 0; i < 6; i++) { // water falling from the spout
            const q = (t * 3 + i / 6) % 1, sx = hand[0] + 30, sy = hand[1] + 6;
            rect(f, sx + q * 4, sy + q * 14, 1, 2, 'rgba(170,210,255,0.9)');
          }
          drawPet(f, lk, cx - 44, 266, t);
          // butterflies in the daytime
          if (!P.moon && lights < 0.9) for (const b of flies) {
            const bx = b.cx + sin(t * b.s + b.ph) * 60, by = 120 + sin(t * b.s * 1.7 + b.ph) * 30, flap = abs(sin(t * 18 + b.ph));
            ellipse(f, bx - 2, by, 2.5 * flap + 0.5, 2.5, b.wing[0]); ellipse(f, bx + 2, by, 2.5 * flap + 0.5, 2.5, b.wing[0]);
            rect(f, bx - 0.5, by - 2, 1, 4, b.wing[1]);
          }
          layer.end(c, P.tint, 0.45);

          // ---- light ----
          if (lights < 0.5) { // sun shafts through the glass
            c.save(); c.globalCompositeOperation = 'lighter';
            for (const x0 of [cx - 140, cx + 20, cx + 170]) {
              c.fillStyle = `rgba(255,245,220,${0.05 * (1 - lights)})`;
              c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + 34, 0); c.lineTo(x0 - 30, H); c.lineTo(x0 - 70, H); c.closePath(); c.fill();
            }
            c.restore();
          }
          if (lights > 0.3) {
            bulbs.forEach((b, i) => glow(c, b.x, b.y + 2, 8, [255, 214, 150], 0.35 * lights * (0.7 + 0.3 * sin(t * 1.2 + i))));
            const lx = cx - 70; // lantern on the bench
            rect(c, lx - 3, benchY - 10, 6, 10, '#2a2830'); rect(c, lx - 2, benchY - 8, 4, 6, '#ffd88a');
            glow(c, lx, benchY - 5, 40, [255, 200, 120], 0.35 * lights);
            pool(c, lx, benchY + 2, 60, [255, 200, 120], 0.3 * lights);
          }
          vignette(c, W, H, P.vig * 0.8);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.08})`; c.fillRect(0, 0, W, H); }
        },
      };
    },
  });

  // A tall stool at the bench, with your legs on its footrest.
  function legsStool(f, x, lk) {
    K.legs(f, x, 214, 24, { pants: '#3a3a55' });
    const col = lk.furniture || '#7a5a3a';
    rrect(f, x - 18, 206, 36, 7, 3, col);
    rect(f, x - 14, 213, 3, 55, shade(col, -0.25)); rect(f, x + 11, 213, 3, 55, shade(col, -0.25));
    rect(f, x - 14, 242, 28, 2, shade(col, -0.25));
  }
})();
