// Home, outside: rocking chairs on the porch looking out over the countryside or
// the beach, or deck chairs up on the roof in the city (follows the scene setting).
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { TAU, PI, PHASES, rect, circle, ellipse, rrect, poly, line, glow, pool, vignette, shade, makeLayer, lookOf, headwear, friendWear, outfit, FRIEND, drawPet, perchBird, owl, backFigure, steam } = K;
  const { sin, cos, round } = Math;

  const BULBS = [['#ffd27f', [255, 210, 127]], ['#ff9d8a', [255, 157, 138]], ['#9fd3ff', [159, 211, 255]], ['#c6f2a4', [198, 242, 164]]];
  const SPOT = {
    country: { trim: '#8a6446', floor: '#9a7050', chair: '#7a4e32', rail: '#8a6446' },
    beach: { trim: '#eee8de', floor: '#a8bcc4', chair: '#e8e2d6', rail: '#f2ede4' },
    city: { brick: '#9a5a4a', coping: '#b8b0a8', floor: '#8a6a50', chair: '#3f6f8f', tank: '#6a4a3a' },
  };
  const floorY = 226, seatY = 220, feet = 257; // chairs (and the table) stand at `feet`

  // A chair seen from behind, with its person drawn first so the back hides
  // all but their head and shoulders, and their shins showing below the seat.
  // kind: 'rocker' (porch) or 'deck' (roof).
  function chair(f, kind, x, col, person, t, ph) {
    const dark = shade(col, -0.3), light = shade(col, 0.15);
    const rock = kind === 'rocker' ? sin(t * 1.1 + ph) * 1.2 : 0, y = seatY + rock;
    ellipse(f, x, feet + 2, 26, 3, 'rgba(0,0,0,0.22)');
    if (person) K.legs(f, x, y + 4, feet - y - 9, { pants: person.pants });
    if (kind === 'rocker') {
      for (const dx of [-17, 15]) { rect(f, dx + x, y, 3, feet - 1 - y, dark); ellipse(f, x + dx + 1.5, feet, 7, 2, dark); }
    } else {
      for (const dx of [-17, 14]) rect(f, x + dx, y, 3, feet + 1 - y, dark);
      for (const dx of [-29, 26]) rect(f, x + dx, y - 16, 3, feet + 17 - y, dark); // front legs under the wide arms
    }
    if (person) backFigure(f, x, y - 38, { torso: 40, ...person });
    rect(f, x - 21, y, 42, 4, dark); // seat edge
    if (kind === 'rocker') {
      for (const dx of [-19, 17]) { rect(f, x + dx, y - 54, 3, 56, col); circle(f, x + dx + 1.5, y - 55, 2.2, light); }
      for (let i = 0; i < 5; i++) rect(f, x - 13 + i * 6, y - 46, 2, 46, col); // spindles
      rrect(f, x - 19, y - 52, 38, 7, 3, col); rect(f, x - 19, y - 52, 38, 1, light); // crest rail
      rect(f, x - 19, y - 18, 38, 3, col);
    } else { // Adirondack: a tall fan of slats, and wide flat arms
      for (let i = -2; i <= 2; i++) {
        const top = y - 50 + Math.abs(i) * 4 + i * i;
        rrect(f, x + i * 7 - 3, top, 6.5, y - top + 2, 3, i % 2 ? shade(col, -0.06) : col);
      }
      rect(f, x - 18, y - 30, 36, 3, dark);
      for (const dx of [-31, 18]) { rect(f, x + dx, y - 18, 13, 3, col); rect(f, x + dx, y - 18, 13, 1, light); }
    }
  }

  window.Lofi.scenes.register({
    id: 'porch', name: 'Porch', group: 'home', outdoor: true,
    label: (look) => (K.viewKind({ look }) === 'city' ? 'Rooftop' : 'Porch'),
    mix: { birds: 0.25, wind: 0.15, crickets: 0.15 },
    create(W, H) {
      const cx = round(W / 2), layer = makeLayer();
      const view = K.viewer({ x: 0, y: 0, w: W, h: 204 }, { seed: 81, window: false, fence: false });
      const postXs = []; // porch posts at cx ± 230, and every 460px beyond on wide screens
      for (let x = (((cx - 230) % 460) + 460) % 460 - 460; x < W + 20; x += 460) if (x > -20) postXs.push(x);
      const bulbs = [];
      for (let x = cx - 230; x <= cx + 230; x += 12) {
        const k = Math.abs(x - cx) / 230; // two spans sagging from the poles to the middle
        const [col, rgb] = BULBS[bulbs.length % 4];
        bulbs.push({ x, y: 30 + (1 - k) * 4 + sin(k * PI) * 16, col, rgb });
      }

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], lk = lookOf(env), fit = outfit(lk, '#c8584a'), lights = P.lights, wind = env.fx.wind;
          const kind = view.kind(env), roof = kind === 'city', S = SPOT[kind];
          const rim = P.moon ? 'rgba(170,200,255,0.55)' : P.rim;
          view.draw(c, t, dt, env);

          if (roof) {
            // the neighbours' water tower, beyond the parapet
            const tx = cx + 150;
            for (const dx of [-14, -5, 5, 14]) line(c, [tx + dx * 0.8, 156, tx + dx, 198], shade(S.tank, -0.35), 2);
            line(c, [tx - 13, 176, tx + 13, 186], shade(S.tank, -0.35), 1); line(c, [tx + 13, 176, tx - 13, 186], shade(S.tank, -0.35), 1);
            rect(c, tx - 18, 116, 36, 42, S.tank);
            for (const y of [124, 136, 148]) rect(c, tx - 18, y, 36, 2, shade(S.tank, -0.3));
            poly(c, [tx - 21, 117, tx, 100, tx + 21, 117], shade(S.tank, -0.2));
            if (env.fx.birds && P.moon) owl(c, tx, 101, t);
            // brick parapet, then the deck
            rect(c, 0, 198, W, floorY - 198, S.brick);
            c.fillStyle = 'rgba(0,0,0,0.16)';
            for (let y = 203, row = 0; y < floorY; y += 5, row++) { c.fillRect(0, y, W, 1); for (let x = (row % 2) * 6; x < W; x += 12) c.fillRect(x, y - 5, 1, 5); }
            rect(c, 0, 194, W, 5, S.coping); rect(c, 0, 194, W, 1, shade(S.coping, 0.25)); rect(c, 0, 199, W, 1, 'rgba(0,0,0,0.25)');
            rect(c, 0, floorY, W, H - floorY, S.floor);
            for (let y = floorY + 5; y < H; y += 7) rect(c, 0, y, W, 1, 'rgba(0,0,0,0.14)');
          } else {
            // railing, porch floor
            rect(c, 0, 200, W, 4, S.rail); rect(c, 0, 200, W, 1, shade(S.rail, 0.2));
            for (let x = 3; x < W; x += 10) rect(c, x, 204, 3, 19, shade(S.rail, -0.05));
            rect(c, 0, 221, W, 3, S.rail);
            rect(c, 0, floorY, W, H - floorY, S.floor);
            for (let y = floorY + 4; y < H; y += 7) rect(c, 0, y, W, 1, 'rgba(0,0,0,0.12)');
            rect(c, 0, floorY, W, 2, 'rgba(0,0,0,0.18)');
          }

          // ---- objects layer ----
          const f = layer.begin(W, H);
          if (roof) {
            for (const px of [cx - 230, cx + 230]) { rect(f, px - 1, 24, 3, floorY + 12 - 24, '#2a2830'); rect(f, px - 3, 234, 7, 3, '#2a2830'); }
            f.strokeStyle = 'rgba(40,34,60,0.8)'; f.lineWidth = 1;
            f.beginPath(); bulbs.forEach((b, i) => (i ? f.lineTo(b.x, b.y) : f.moveTo(b.x, b.y))); f.stroke();
            bulbs.forEach((b) => rect(f, b.x - 1, b.y + 1, 2, 3, b.col));
            // olive tree in a big pot
            const ox = cx - 160;
            poly(f, [ox - 16, 236, ox + 16, 236, ox + 12, 262, ox - 12, 262], '#b86a4a'); rect(f, ox - 17, 234, 34, 4, '#c87a5a');
            line(f, [ox, 236, ox - 2, 206, ox + 3, 186], '#5a4636', 3);
            for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, sw = sin(t * (1 + wind * 2) + i) * (1 + wind * 2); circle(f, ox + 3 + cos(a) * 13 + sw, 178 + sin(a) * 9, 7, i % 2 ? '#7a9a6a' : '#6a8a5c'); }
            if (env.fx.birds && !P.moon) { perchBird(f, cx - 90, 194, t, 0.3, '#8a8a96'); perchBird(f, cx - 76, 194, t, 2.4, '#9a96a0', true); }
          } else {
            for (const px of postXs) { rect(f, px - 4, 0, 8, floorY + 8, S.trim); rect(f, px - 4, 0, 2, floorY + 8, shade(S.trim, 0.15)); rect(f, px - 7, floorY + 4, 14, 4, shade(S.trim, -0.2)); }
            rect(f, 0, 0, W, 10, S.trim); rect(f, 0, 10, W, 2, 'rgba(0,0,0,0.25)'); // the edge of the porch roof
            // hanging fern
            const hx = cx - 150, hs = sin(t * 0.9) * (0.5 + wind * 2);
            for (const dx of [-8, 0, 8]) line(f, [hx + hs, 10, hx + dx + hs, 34], '#5a5040', 1);
            ellipse(f, hx + hs, 36, 10, 5, '#a86a4a');
            for (let i = 0; i < 8; i++) { const a = PI * (0.1 + (i / 7) * 0.8) + sin(t + i) * 0.05 * (1 + wind * 3); line(f, [hx + hs, 34, hx + hs + cos(a) * 16, 34 + sin(a) * 18], i % 2 ? '#5f8f5a' : '#4c7a4c', 2); }
            // wind chime: shells at the beach, little tubes in the country
            const wx = cx + 140;
            rect(f, wx - 9, 12, 18, 2, '#6a5a4a');
            for (let i = 0; i < 5; i++) {
              const a = sin(t * (1.5 + i * 0.3) + i) * (0.04 + wind * 0.35), len = 14 + (i % 3) * 4, sx = wx - 8 + i * 4;
              line(f, [sx, 14, sx + sin(a) * len, 14 + cos(a) * len], 'rgba(60,50,40,0.8)', 0.6);
              if (kind === 'beach') ellipse(f, sx + sin(a) * len, 16 + cos(a) * len, 1.8, 2.4, ['#f0e0d0', '#e8b8a8', '#f6f0e6'][i % 3]);
              else rect(f, sx + sin(a) * len - 1, 14 + cos(a) * len, 2, 6, '#b8bcc4');
            }
            // porch light on the post
            const lx = postXs.find((x) => x > cx - 300 && x < cx) ?? cx - 230;
            rect(f, lx + 5, 108, 7, 11, '#2a2830'); rect(f, lx + 6, 110, 5, 7, lights > 0.3 ? '#ffe2a6' : '#d8d2c0');
            if (kind === 'beach') { // surfboard leaning on the post
              const sx = (postXs.find((x) => x > cx) ?? cx + 230) - 14;
              f.save(); f.translate(sx, 250); f.rotate(-0.12); rrect(f, -8, -92, 16, 94, 8, '#f2c46a'); rect(f, -1, -90, 2, 90, '#d8584a'); f.restore();
            } else { // sunflowers in a pot
              const sx = (postXs.find((x) => x > cx) ?? cx + 230) - 20;
              poly(f, [sx - 10, 240, sx + 10, 240, sx + 8, 258, sx - 8, 258], '#b86a4a');
              [[-5, 196], [3, 186], [8, 204]].forEach(([dx, y], i) => {
                line(f, [sx + dx * 0.4, 240, sx + dx, y], '#4c7a4c', 2);
                const sw = sin(t * 0.8 + i) * (0.5 + wind);
                for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; ellipse(f, sx + dx + sw + cos(a) * 5, y + sin(a) * 5, 3, 1.5, '#f0c040', a); }
                circle(f, sx + dx + sw, y, 3.5, '#6a4020');
              });
            }
          }

          // the table between the chairs: lemonade by day, mugs and a candle after dark
          const tx = cx;
          const top = seatY + 4; // the table's top, a little above the seats
          rect(f, tx - 12, top, 24, 3, roof ? '#9a7a5a' : shade(S.chair, -0.1)); rect(f, tx - 10, top + 3, 3, feet - top - 3, '#5a4636'); rect(f, tx + 7, top + 3, 3, feet - top - 3, '#5a4636');
          const mugs = [];
          if (lights < 0.5) {
            rrect(f, tx - 9, top - 13, 8, 13, 2, 'rgba(250,230,140,0.85)'); rect(f, tx - 9, top - 13, 8, 2, 'rgba(255,255,255,0.6)');
            rect(f, tx + 2, top - 7, 5, 7, 'rgba(250,230,140,0.8)'); rect(f, tx + 3, top - 9, 1, 3, '#5f9a4a');
          } else {
            rect(f, tx - 9, top - 7, 6, 7, '#e8dcc6'); rect(f, tx + 3, top - 7, 6, 7, lk.friend ? '#6f8fb8' : '#e8dcc6');
            mugs.push([tx - 6, top - 8], [tx + 6, top - 8]);
            rect(f, tx - 2, top - 9, 4, 9, '#f0e6d0');
          }

          // chairs and people
          const kindOfChair = roof ? 'deck' : 'rocker', col = lk.furniture || S.chair;
          chair(f, kindOfChair, cx - 48, col, lk.friend && {
            t, top: FRIEND.top, shade: FRIEND.shade, hair: FRIEND.hair, longHair: true, skin: FRIEND.skin, pants: FRIEND.pants, ...friendWear(lk), rim, wind, turn: 1, bob: sin(t * 0.9 + 2) * 0.4,
          }, t, 2);
          if (!lk.friend) { // a blanket draped over the empty chair's back
            rrect(f, cx - 62, seatY - 56, 28, 22, 3, '#b8cbb8');
            for (const y of [seatY - 50, seatY - 42]) rect(f, cx - 62, y, 28, 2, '#4a6a8a');
            for (let x = cx - 61; x < cx - 34; x += 3) rect(f, x, seatY - 34, 1, 3, '#b8cbb8');
          }
          chair(f, kindOfChair, cx + 48, col, {
            t, top: fit.top, shade: fit.shade, hair: lk.hair || '#4a2c2a', pants: '#3a3a55', ...headwear(lk, '#3a3548'), rim, wind, turn: lk.friend ? -1 : 0, bob: sin(t * 0.8) * 0.4,
          }, t, 0);
          drawPet(f, lk, cx + 108, 262, t);
          layer.end(c, P.tint, 0.8);

          // ---- light ----
          mugs.forEach(([x, y]) => steam(c, x, y, t, 0.2));
          if (lights > 0.3) {
            glow(c, tx, seatY - 6, 16 * (0.9 + 0.1 * sin(t * 9)), [255, 200, 120], 0.45 * lights);
            rect(c, tx - 0.5, seatY - 7, 1, 2, '#ffe9a8');
          }
          if (roof) {
            bulbs.forEach((b, i) => glow(c, b.x, b.y + 2, 9, b.rgb, 0.4 * (0.55 + 0.45 * sin(t * 1.3 + i * 1.7)) * (0.15 + 0.85 * lights)));
            if (lights > 0.3) pool(c, cx, 250, 220, [255, 200, 140], 0.18 * lights, 0.2);
          } else if (lights > 0.3) {
            const lx = postXs.find((x) => x > cx - 300 && x < cx) ?? cx - 230;
            glow(c, lx + 8, 113, 50, [255, 210, 150], 0.35 * lights);
            pool(c, lx + 8, floorY + 6, 80, [255, 200, 140], 0.25 * lights, 0.25);
          }
          vignette(c, W, H, P.vig * 0.8);
        },
      };
    },
  });
})();
