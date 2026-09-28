// Town: reading at a table in an old bookstore, shelves to the ceiling, a friend
// browsing by the rolling ladder, and a tall arched window.
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { TAU, PI, PHASES, rng, rect, ellipse, rrect, poly, line, vgrad, glow, pool, vignette, shade, makeLayer, lookOf, headwear, friendWear, outfit, FRIEND, drawPet, backFigure, standing, arm, steam } = K;
  const { sin, round, random } = Math;

  // dx: which way the window's light leans across the floor.
  const SHOP = {
    morning: { wall: ['#6a4a36', '#523828'], shelf: '#5a3a26', back: '#2e1e16', floor: ['#8a5e3e', '#6a4630'], beam: [255, 236, 200, 0.12], dx: 15 },
    afternoon: { wall: ['#6e4e3a', '#56392a'], shelf: '#5e3e2a', back: '#321f16', floor: ['#926444', '#704a32'], beam: [255, 250, 235, 0.1], dx: -12 },
    evening: { wall: ['#4e3428', '#3a261c'], shelf: '#46301f', back: '#24170f', floor: ['#6a4630', '#4e3322'], beam: [255, 170, 110, 0.14], dx: -15 },
    night: { wall: ['#2e2020', '#221818'], shelf: '#2a1c14', back: '#140d0a', floor: ['#3a2a20', '#281c16'], beam: null, dx: 0 },
  };
  const BOOKS = ['#8a4a4a', '#3f6f8f', '#c8a060', '#5a8a5a', '#7a5a9a', '#d8c8a8', '#a86a3a', '#4a5a7a', '#9a3a3a', '#2e5a4a'];

  // Rows of books on shelves between x0 and x1, from y0 down to the floor.
  function makeShelves(r, x0, x1, y0, y1, gap) {
    const books = [];
    for (let sy = y0 + gap; sy <= y1; sy += gap) {
      for (let x = x0 + 3; x < x1 - 6;) {
        if (r() < 0.06) { // a stack lying flat
          const n = 2 + ((r() * 3) | 0);
          for (let i = 0; i < n; i++) books.push({ x: x + (r() * 2) | 0, y: sy - 4 * (i + 1), w: 12 + ((r() * 4) | 0), h: 4, col: BOOKS[(r() * BOOKS.length) | 0] });
          x += 18;
          continue;
        }
        const w = 3 + ((r() * 4) | 0), h = gap - 8 - ((r() * 9) | 0);
        books.push({ x, y: sy - h, w, h, col: BOOKS[(r() * BOOKS.length) | 0], lean: r() < 0.05 });
        x += w + (r() < 0.08 ? 6 : 1);
      }
    }
    return books;
  }

  window.Lofi.scenes.register({
    id: 'bookstore', name: 'Bookstore', group: 'town', outdoor: false,
    mix: { rain: 0.35, fire: 0.1 },
    create(W, H) {
      const r = rng(91), cx = round(W / 2), layer = makeLayer(), floorY = 214, gap = 34;
      const win = { x: cx - 58, y: 22, w: 116, h: 128 }, archR = win.w / 2, base = win.y + win.h, springY = win.y + archR; // round top, straight sides
      const view = K.viewer(win, { seed: 91, perch: 0.82, rain: 0.6 });
      const left = makeShelves(r, -10, win.x - 16, 8, floorY, gap), right = makeShelves(r, win.x + win.w + 16, W + 10, 8, floorY, gap);
      const motes = Array.from({ length: 26 }, () => ({ x: random(), y: random(), p: random() * TAU, s: 0.2 + random() * 0.5 }));

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], S = SHOP[env.tod], lights = P.lights, lk = lookOf(env), fit = outfit(lk, '#7f9c8a');
          const glowLevel = 0.4 + 0.6 * lights;

          // arched window
          c.save();
          c.beginPath(); c.moveTo(win.x, base); c.lineTo(win.x, springY); c.arc(cx, springY, archR, PI, 0); c.lineTo(win.x + win.w, base); c.closePath(); c.clip();
          view.draw(c, t, dt, env);
          c.save(); c.translate(cx, base - 16); c.scale(-1, 1); // gold lettering, seen from inside
          c.font = 'bold 12px Georgia, serif'; c.textAlign = 'center';
          c.lineWidth = 3; c.strokeStyle = 'rgba(40,24,16,0.7)'; c.strokeText('BOOKS', 0, 0);
          c.fillStyle = 'rgba(240,200,110,0.9)'; c.fillText('BOOKS', 0, 0);
          c.restore();
          c.restore();

          // walls: bookshelves up to the ceiling either side of the window
          c.fillStyle = vgrad(c, 0, floorY, [[0, S.wall[0]], [1, S.wall[1]]]);
          c.beginPath(); c.rect(0, 0, W, floorY); c.moveTo(win.x, base); c.lineTo(win.x + win.w, base); c.lineTo(win.x + win.w, springY); c.arc(cx, springY, archR, 0, PI, true); c.closePath(); c.fill('evenodd');
          for (const [x0, x1, list] of [[-10, win.x - 16, left], [win.x + win.w + 16, W + 10, right]]) {
            rect(c, x0, 4, x1 - x0, floorY - 4, S.shelf);
            rect(c, x0 + 3, 8, x1 - x0 - 6, floorY - 8, S.back);
            for (const b of list) {
              if (b.lean) { c.save(); c.translate(b.x, b.y + b.h); c.rotate(-0.2); rect(c, 0, -b.h, b.w, b.h, b.col); c.restore(); }
              else { rect(c, b.x, b.y, b.w, b.h, b.col); if (b.h > 6) rect(c, b.x, b.y + 3, b.w, 1, 'rgba(255,255,255,0.22)'); }
            }
            for (let sy = 8 + gap; sy <= floorY; sy += gap) { rect(c, x0, sy, x1 - x0, 3, S.shelf); rect(c, x0, sy, x1 - x0, 1, shade(S.shelf, 0.2)); }
            rect(c, x0, 4, x1 - x0, 4, shade(S.shelf, 0.1));
          }
          // window frame and sill
          c.strokeStyle = S.shelf; c.lineWidth = 6;
          c.beginPath(); c.moveTo(win.x, base); c.lineTo(win.x, springY); c.arc(cx, springY, archR, PI, 0); c.lineTo(win.x + win.w, base); c.closePath(); c.stroke();
          rect(c, cx - 1.5, win.y, 3, win.h, S.shelf); rect(c, win.x, springY, win.w, 3, S.shelf);
          rect(c, win.x - 8, base, win.w + 16, 5, shade(S.shelf, 0.15));
          // floor
          c.fillStyle = vgrad(c, floorY, H, [[0, S.floor[0]], [1, S.floor[1]]]);
          c.fillRect(0, floorY, W, H - floorY);
          for (let y = floorY + 6; y < H; y += 8) rect(c, 0, y, W, 1, 'rgba(0,0,0,0.14)');

          // light through the window, with dust drifting in it
          if (S.beam) {
            const [br, bg, bb, ba] = S.beam, gx = S.dx;
            c.save(); c.globalCompositeOperation = 'lighter';
            c.fillStyle = `rgba(${br},${bg},${bb},${ba})`;
            c.beginPath(); c.moveTo(win.x + 6, base); c.lineTo(win.x + win.w - 6, base); c.lineTo(win.x + win.w + 40 + gx, H); c.lineTo(win.x - 40 + gx, H); c.closePath(); c.fill();
            c.restore();
            c.fillStyle = 'rgba(255,245,220,0.7)';
            for (const m of motes) {
              const y = base + ((m.y + t * 0.01 * m.s) % 1) * (H - base), k = (y - base) / (H - base);
              c.globalAlpha = 0.3 + 0.5 * sin(t * m.s * 3 + m.p) ** 2;
              c.fillRect(round(win.x - 40 * k + gx * k + m.x * (win.w + 80 * k) + sin(t * m.s + m.p) * 4), round(y), 1, 1);
            }
            c.globalAlpha = 1;
          }

          // ---- objects layer ----
          const f = layer.begin(W, H);
          // pendant lamps
          for (const lx of [cx - 108, cx + 108]) { line(f, [lx, 0, lx, 22], '#1e1a18', 1); poly(f, [lx - 9, 30, lx + 9, 30, lx + 4, 22, lx - 4, 22], '#2e5a44'); rect(f, lx - 9, 30, 18, 1, '#c8a060'); }
          // trailing ivy on top of the shelves
          for (const ix of [win.x - 40, win.x + win.w + 36]) {
            rect(f, ix - 6, -2, 12, 8, '#b86a4a');
            for (let i = 0; i < 4; i++) {
              const len = 20 + i * 9, sw = sin(t * 0.6 + i) * 1.5;
              for (let k = 0; k < len; k += 4) ellipse(f, ix - 6 + i * 4 + sin(k * 0.3) * 2 + sw * (k / len), 6 + k, 2.2, 1.4, k % 8 ? '#5a8a4a' : '#4a7a40');
            }
          }
          // rolling ladder against the shelves beside the window
          const lx = win.x - 30;
          line(f, [lx - 14, 12, lx + 20, 12], '#b89060', 2);
          line(f, [lx - 6, 12, lx - 18, floorY + 4], '#7a5436', 3); line(f, [lx + 12, 12, lx, floorY + 4], '#7a5436', 3);
          for (let y = 30; y < floorY; y += 20) { const k = (y - 12) / (floorY - 8); line(f, [lx - 6 - 12 * k, y, lx + 12 - 12 * k, y], '#8a6040', 2); }
          // your friend browsing the shelves: easing a book out, another under their arm
          if (lk.friend) {
            const fx = win.x - 88, sh = 76, reach = sin(t * 0.45) > 0.2 ? 1 : 0;
            rect(f, fx + 27 + reach * 2, sh - 34, 5, 17, '#c8584a'); // the book coming off the shelf
            arm(f, [fx + 19, sh + 4, fx + 30, sh - 16, fx + 31 + reach * 2, sh - 26], FRIEND.shade, FRIEND.skin);
            standing(f, fx, sh, 222, {
              t, torso: 70, top: FRIEND.top, shade: FRIEND.shade, hair: FRIEND.hair, longHair: true, skin: FRIEND.skin, ...friendWear(lk, true),
              arms: false, pants: FRIEND.pants, turn: 1, bob: sin(t * 0.9) * 0.3,
            });
            rect(f, fx - 34, sh + 22, 6, 18, '#3f6f8f');
            arm(f, [fx - 21, sh + 6, fx - 28, sh + 30, fx - 25, sh + 40], FRIEND.shade, FRIEND.skin);
          }

          // reading table: book stack, lamp, mug
          const ty = 200;
          rect(f, cx - 130, ty, 260, 6, '#6a4630'); rect(f, cx - 130, ty, 260, 1, '#8a6040');
          rect(f, cx - 124, ty + 6, 6, floorY + 26 - ty, '#4a3020'); rect(f, cx + 118, ty + 6, 6, floorY + 26 - ty, '#4a3020');
          const stackX = cx - 58;
          [['#3f6f8f', 30], ['#c8a060', 26], ['#8a4a4a', 28], ['#5a8a5a', 24]].forEach(([col, w], i) => { rect(f, stackX - w / 2 + (i % 2), ty - 5 * (i + 1), w, 5, col); rect(f, stackX - w / 2 + (i % 2) + 2, ty - 5 * (i + 1) + 1, w - 4, 1, 'rgba(255,255,255,0.35)'); });
          if (lk.pet === 'cat') drawPet(f, lk, stackX, ty - 20, t); // the shop cat, on top of the pile
          const lampX = cx + 92;
          rect(f, lampX - 8, ty - 3, 16, 3, '#b8904e'); rect(f, lampX - 1, ty - 16, 2, 13, '#b8904e');
          rrect(f, lampX - 13, ty - 23, 26, 8, 4, '#2e7a54'); rect(f, lampX - 13, ty - 16, 26, 1, '#1e5a3c');
          const mx = cx + 58;
          rect(f, mx - 4, ty - 9, 8, 9, '#e8dcc6'); f.strokeStyle = '#e8dcc6'; f.lineWidth = 1.5; f.beginPath(); f.arc(mx + 5, ty - 4.5, 2.3, -PI / 2, PI / 2); f.stroke();
          // you, reading (turning a page now and then), in a wooden chair
          const me = cx + 14, page = (t % 9) < 0.8;
          backFigure(f, me, 172, {
            t, torso: 70, top: fit.top, shade: fit.shade, hair: lk.hair || '#2b1d2a', ...headwear(lk, '#e8e0d0'),
            rim: P.moon ? 'rgba(255,200,140,0.5)' : P.rim, bob: sin(t * 0.7) * 0.4 + 1, armR: page ? -5 : 0,
          });
          const chairCol = lk.furniture || '#5a3a26';
          rect(f, me - 26, 214, 4, 56, chairCol); rect(f, me + 22, 214, 4, 56, chairCol);
          rrect(f, me - 27, 210, 54, 7, 3, shade(chairCol, 0.12));
          for (let i = 0; i < 4; i++) rect(f, me - 16 + i * 10, 217, 3, 30, chairCol);
          rect(f, me - 26, 246, 52, 4, chairCol);
          if (lk.pet === 'dog') drawPet(f, lk, cx - 96, 268, t);
          layer.end(c, P.tint, 0.4);

          // ---- light ----
          steam(c, mx, ty - 10, t, 0.25);
          glow(c, lampX, ty - 14, 70, [255, 220, 150], 0.3 * glowLevel);
          pool(c, lampX, ty + 1, 60, [255, 220, 150], 0.4 * glowLevel);
          for (const px of [cx - 108, cx + 108]) { glow(c, px, 32, 50, [255, 210, 140], 0.22 * glowLevel); rect(c, px - 3, 30, 6, 2, '#fff2c8'); }
          if (lights > 0.3) pool(c, cx, floorY + 20, 200, [255, 190, 120], 0.12 * lights, 0.3);
          vignette(c, W, H, P.vig);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.06})`; c.fillRect(0, 0, W, H); }
        },
      };
    },
  });
})();
