// Home: cooking at the stove while a friend chops vegetables, by the window over the sink.
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { PI, PHASES, rect, circle, ellipse, rrect, poly, line, vgrad, glow, pool, vignette, shade, makeLayer, lookOf, headwear, friendWear, outfit, FRIEND, drawPet, standing, arm, steam } = K;
  const { sin, cos, max, round } = Math;

  const ROOM = {
    morning: { wall: ['#eadfca', '#dccdb2'], tile: '#f4efe4', cab: '#8aa894', top: '#c89a6a', floor: ['#e2d8c8', '#b4a48c'], frame: '#f6f1e8', beam: [255, 236, 200, 0.16] },
    afternoon: { wall: ['#efe4ce', '#e0d2b6'], tile: '#f8f4ea', cab: '#8eae98', top: '#d0a270', floor: ['#e8decc', '#b8aa92'], frame: '#faf6ee', beam: [255, 250, 235, 0.12] },
    evening: { wall: ['#b8988a', '#9a7c70'], tile: '#c8b0a4', cab: '#6a7a6e', top: '#a8784e', floor: ['#a8927e', '#7a6656'], frame: '#d8c4b8', beam: [255, 170, 110, 0.16] },
    night: { wall: ['#3e3848', '#2e2a38'], tile: '#4a4658', cab: '#34403e', top: '#6a4e36', floor: ['#403a48', '#28242e'], frame: '#5a5468', beam: null },
  };
  const JARS = ['#e8c878', '#c8584a', '#8a6a4a', '#e8e0d0', '#6a8a5a'];
  const BITS = ['#e07a3f', '#5f9a4a', '#e8c040', '#c8403a', '#f0e8d0']; // what's in the pan

  // Cupboard doors from x0 to x1 (both sides of the room go all the way to the edge).
  function cupboards(c, x0, x1, y, h, col) {
    const n = max(1, round((x1 - x0) / 40)), w = (x1 - x0) / n;
    rect(c, x0, y, x1 - x0, h, shade(col, -0.25));
    for (let i = 0; i < n; i++) {
      const dx = x0 + i * w;
      rect(c, dx + 2, y + 2, w - 4, h - 4, col);
      rect(c, dx + 5, y + 5, w - 10, h - 10, shade(col, 0.08));
      rect(c, dx + (i % 2 ? 6 : w - 9), y + h / 2 - 4, 2, 8, '#d8c8a0');
    }
  }

  window.Lofi.scenes.register({
    id: 'kitchen', name: 'Kitchen', group: 'home', outdoor: false,
    mix: { rain: 0.25, birds: 0.2, cafe: 0.12 },
    create(W, H) {
      const cx = round(W / 2), layer = makeLayer(), top = 176, floor = 250;
      const win = { x: cx - 58, y: 34, w: 116, h: 84 };
      const view = K.viewer(win, { seed: 71, perch: 0.2, rain: 0.6 });
      const stoveX = cx + 110, friendX = cx - 118;

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], R = ROOM[env.tod], lights = P.lights, lk = lookOf(env), fit = outfit(lk, '#d9a066');

          // window over the sink
          c.save(); c.beginPath(); c.rect(win.x, win.y, win.w, win.h); c.clip();
          view.draw(c, t, dt, env);
          c.restore();

          // walls, tiles, cupboards
          c.fillStyle = vgrad(c, 0, top, [[0, R.wall[0]], [1, R.wall[1]]]);
          c.fillRect(0, 0, W, win.y); c.fillRect(0, win.y + win.h, W, top - win.y - win.h);
          c.fillRect(0, win.y, win.x, win.h); c.fillRect(win.x + win.w, win.y, W - win.x - win.w, win.h);
          const tileTop = 96; // subway tiles behind the counter
          rect(c, 0, tileTop, win.x - 8, top - tileTop, R.tile); rect(c, win.x + win.w + 8, tileTop, W - win.x - win.w - 8, top - tileTop, R.tile);
          rect(c, win.x - 8, win.y + win.h + 6, win.w + 16, top - win.y - win.h - 6, R.tile);
          c.fillStyle = 'rgba(0,0,0,0.07)';
          for (let y = tileTop; y < top; y += 6) {
            c.fillRect(0, y, W, 1);
            for (let x = ((y / 6) % 2) * 6; x < W; x += 12) if (y > win.y + win.h + 6 || x < win.x - 8 || x > win.x + win.w + 8) c.fillRect(x, y, 1, 6);
          }
          cupboards(c, -20, win.x - 16, 16, 74, R.cab);
          cupboards(c, stoveX + 62, W + 20, 16, 74, R.cab);
          // open shelf between the window and the hood: jars and plates
          rect(c, win.x + win.w + 12, 62, stoveX - 56 - win.x - win.w - 12, 3, shade(R.top, -0.2));
          for (let i = 0, x = win.x + win.w + 16; x < stoveX - 62; i++, x += 11) {
            rrect(c, x, 50 - (i % 2) * 3, 8, 12 + (i % 2) * 3, 2, JARS[i % JARS.length]);
            rect(c, x, 50 - (i % 2) * 3, 8, 3, '#8a7a6a');
          }
          // window frame, sill with herbs, gingham valance
          c.strokeStyle = R.frame; c.lineWidth = 5; c.strokeRect(win.x - 2, win.y - 2, win.w + 4, win.h + 4);
          rect(c, cx - 1.5, win.y, 3, win.h, R.frame); rect(c, win.x, win.y + win.h * 0.5 - 1.5, win.w, 3, R.frame);
          rect(c, win.x - 8, win.y + win.h + 2, win.w + 16, 5, R.frame);
          const sway = sin(t * 1.4) * env.fx.wind * 2;
          for (let x = win.x - 6; x < win.x + win.w + 6; x += 4) {
            const k = ((x - win.x) / 4) | 0;
            rect(c, x + sway * 0.3, win.y - 6, 4, 14, k % 2 ? '#c8584a' : '#f2e6d8');
            rect(c, x + sway * 0.3, win.y + 1, 4, 3, k % 2 ? '#f2e6d8' : '#d88070');
            circle(c, x + 2 + sway * 0.3, win.y + 8, 2, k % 2 ? '#c8584a' : '#f2e6d8');
          }
          rect(c, win.x - 10, win.y - 8, win.w + 20, 2, '#8a7060');

          // range hood over the stove
          poly(c, [stoveX - 14, 0, stoveX + 14, 0, stoveX + 14, 44, stoveX - 14, 44], '#b8bcc4');
          poly(c, [stoveX - 14, 44, stoveX + 14, 44, stoveX + 50, 70, stoveX - 50, 70], '#c8ccd4');
          rect(c, stoveX - 50, 70, 100, 4, '#9a9ea8');

          // counter, lower cupboards, oven, floor
          rect(c, 0, top, W, 8, R.top); rect(c, 0, top, W, 1, shade(R.top, 0.25));
          cupboards(c, -20, stoveX - 44, top + 8, floor - top - 12, R.cab);
          cupboards(c, stoveX + 44, W + 20, top + 8, floor - top - 12, R.cab);
          rect(c, stoveX - 44, top + 8, 88, floor - top - 12, '#2c2a30');
          rect(c, stoveX - 36, top + 22, 72, 30, lights > 0.3 ? '#6a3a24' : '#3a3840'); // oven window (baking after dark)
          rect(c, stoveX - 32, top + 16, 64, 2, '#c8ccd4');
          for (let i = 0; i < 4; i++) circle(c, stoveX - 27 + i * 18, top + 12, 2, '#9a9ea8');
          rect(c, 0, floor - 4, W, 4, '#2a2622');
          for (let y = floor, row = 0; y < H; y += 10, row++) {
            for (let x = -(row % 2) * 10; x < W; x += 20) {
              rect(c, x, y, 10, 10, R.floor[0]); rect(c, x + 10, y, 10, 10, R.floor[1]);
            }
          }
          // sink + tap, stove top
          rect(c, cx - 26, top, 52, 3, '#8a9098');
          line(c, [cx, top, cx, top - 16, cx + 7, top - 16, cx + 9, top - 12], '#b8bcc4', 2.5);
          if ((t % 7) < 0.4) rect(c, cx + 9, top - 10 + ((t % 7) / 0.4) * 9, 1, 2, 'rgba(200,225,255,0.8)'); // a drip now and then
          rect(c, stoveX - 50, top - 2, 100, 3, '#2a282e');

          // ---- objects layer ----
          const f = layer.begin(W, H);
          // herbs on the sill
          for (const [i, px] of [win.x + 12, win.x + 30, win.x + win.w - 16].entries()) {
            rect(f, px - 4, win.y + win.h - 5, 8, 7, '#c8795a');
            for (let k = 0; k < 5; k++) { const a = -PI / 2 + (k - 2) * 0.45 + sin(t * 0.8 + k + i) * 0.05; ellipse(f, px + cos(a) * 5, win.y + win.h - 8 + sin(a) * 5, 3.5, 1.5, i === 1 ? '#6a8a5a' : '#4c7a4c', a); }
          }
          // utensils hanging under the left cupboards
          rect(f, win.x - 150, 94, 120, 1, '#6a6a72');
          [[-140, 'ladle'], [-124, 'spatula'], [-108, 'whisk'], [-90, 'spoon']].forEach(([dx, kind]) => {
            const ux = win.x + dx, sw = sin(t * 0.9 + dx) * 0.3;
            line(f, [ux, 94, ux + sw, 110], kind === 'spoon' ? '#b88a5a' : '#9a9ea8', 1.5);
            if (kind === 'ladle') circle(f, ux + sw, 112, 3, '#9a9ea8');
            else if (kind === 'spatula') rect(f, ux - 2 + sw, 109, 5, 6, '#3a3840');
            else if (kind === 'whisk') ellipse(f, ux + sw, 113, 2.5, 5, '#b8bcc4');
            else ellipse(f, ux + sw, 111, 2, 3, '#b88a5a');
          });
          // fruit bowl
          ellipse(f, cx + 44, top - 3, 12, 4, '#e8e0d0'); circle(f, cx + 38, top - 7, 4, '#e8a040'); circle(f, cx + 46, top - 8, 4, '#c8403a'); circle(f, cx + 51, top - 6, 3.5, '#a8c050');

          // the pot (stirred) and the pan (tossed now and then), with blue flames under them
          const potX = stoveX - 38, panX = stoveX + 36;
          for (const bx of [potX, panX]) for (let i = -2; i <= 2; i++) rect(f, bx + i * 4, top - 3 - (sin(t * 20 + i * 3 + bx) > 0 ? 1 : 0), 2, 2, '#6aa0ff');
          rrect(f, potX - 13, top - 20, 26, 18, 3, '#b8404a'); rect(f, potX - 13, top - 20, 26, 3, '#d05a60');
          rect(f, potX - 17, top - 16, 4, 3, '#2a282e'); rect(f, potX + 13, top - 16, 4, 3, '#2a282e');
          const toss = (t % 6) < 0.7 ? sin(((t % 6) / 0.7) * PI) : 0, panY = top - 5 - toss * 4;
          ellipse(f, panX, panY, 14, 3.5, '#2a282e'); ellipse(f, panX, panY - 1, 12, 2.5, '#4a4850');
          line(f, [panX + 13, panY - 1, panX + 30, panY - 3 - toss * 2], '#2a282e', 3);
          BITS.forEach((col, i) => { // food in the pan, flying up when it's tossed
            const bx = panX - 8 + i * 4, by = panY - 3 - toss * (10 + (i % 3) * 5) + (toss ? sin(i) * 2 : 0);
            rect(f, bx, by, 3, 2, col);
          });

          // you, at the stove: stirring the pot with one hand, the pan in the other
          const me = stoveX, sh = 120, sleeve = fit.shade, skin = '#c99a7c';
          const sx = potX + 4 + cos(t * 3) * 4, sy = top - 26 + sin(t * 3) * 1.5;
          line(f, [sx, sy, sx - 2, top - 8], '#b88a5a', 2); // wooden spoon
          arm(f, [me - 21, sh + 8, me - 34, sh + 34, sx, sy], sleeve, skin);
          arm(f, [me + 21, sh + 8, me + 34, sh + 36, panX + 24, panY - 2 - toss * 2], sleeve, skin);
          standing(f, me, sh, 266, {
            t, torso: 70, top: fit.top, shade: fit.shade, hair: lk.hair || '#3a2420', ...headwear(lk, '#d9d2ea'),
            rim: P.rim, arms: false, pants: '#3a3a55', apron: '#f2ead8', bob: sin(t * 2.2) * 0.5, turn: sin(t * 0.25) > 0.8 ? -1 : 0,
          });

          // cutting board: your friend chops a carrot (or it waits there)
          const bx = friendX + 44, cut = lk.friend ? (t * 0.35) % 1 : 0.35, burst = sin(t * 0.8) > -0.3;
          const chop = lk.friend && burst ? max(0, sin(t * 12)) * 5 : 0;
          rect(f, bx - 16, top - 3, 36, 4, '#d8b080'); rect(f, bx - 16, top - 3, 36, 1, '#e8c898');
          const len = 16 * (1 - cut * 0.75);
          rrect(f, bx + 2, top - 7, len, 4, 2, '#e07a3f'); poly(f, [bx + 2 + len, top - 6, bx + 7 + len, top - 8, bx + 6 + len, top - 4], '#5f9a4a');
          for (let i = 0; i < round(cut * 9); i++) rect(f, bx - 12 + (i % 5) * 3, top - 5 - ((i / 5) | 0) * 2, 2, 2, '#e8904f');
          circle(f, bx - 26, top - 6, 5, '#c8403a'); rect(f, bx - 26, top - 12, 1, 2, '#5f9a4a'); // a tomato waiting its turn
          const kx = bx + 1, ky = top - 10 - chop;
          if (lk.friend) {
            arm(f, [friendX - 21, sh + 10, friendX - 30, sh + 36, friendX - 8, sh + 48], FRIEND.shade, FRIEND.skin);
            rect(f, kx - 7, ky + 1, 7, 3, '#2a2420'); poly(f, [kx, ky, kx + 12, ky + 2, kx, ky + 4], '#dfe3ea');
            arm(f, [friendX + 21, sh + 10, friendX + 32, sh + 36, kx - 5, ky + 3], FRIEND.shade, FRIEND.skin);
            standing(f, friendX, sh + 2, 266, {
              t, torso: 68, top: FRIEND.top, shade: FRIEND.shade, hair: FRIEND.hair, longHair: true, skin: FRIEND.skin,
              ...friendWear(lk), rim: P.rim, arms: false, pants: FRIEND.pants, apron: '#c8584a', bob: sin(t * 1.3 + 2) * 0.4,
            });
          } else {
            rect(f, bx + 22, top - 4, 7, 2, '#2a2420'); poly(f, [bx + 29, top - 5, bx + 41, top - 4, bx + 29, top - 2], '#dfe3ea');
          }
          drawPet(f, lk, stoveX - 72, 268, t); // hoping something falls
          layer.end(c, P.tint, 0.45);

          // ---- light ----
          steam(c, potX, top - 22, t, 0.35);
          if (toss > 0.3) for (let i = 0; i < 4; i++) rect(c, panX - 10 + i * 6 + sin(t * 30 + i) * 2, panY - 6 - toss * 8 - i, 1, 1, 'rgba(255,240,200,0.8)'); // sizzle
          glow(c, stoveX, 74, 40, [255, 220, 170], 0.3 * (0.4 + 0.6 * lights));
          pool(c, stoveX, top, 60, [255, 210, 150], 0.3 * (0.4 + 0.6 * lights));
          for (const bxx of [potX, panX]) glow(c, bxx, top - 2, 10, [110, 160, 255], 0.35);
          if (lights > 0.05) {
            pool(c, win.x - 90, top + 1, 90, [255, 214, 150], 0.35 * lights); // under-cupboard lights
            pool(c, stoveX + 130, top + 1, 70, [255, 214, 150], 0.3 * lights);
            glow(c, stoveX, top + 37, 34, [255, 150, 70], 0.3 * lights); // oven light
          }
          if (R.beam) { const [br, bg, bb, ba] = R.beam; pool(c, cx, top + 2, 110, [br, bg, bb], ba * 1.1, 0.3); }
          vignette(c, W, H, P.vig * 0.85);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.07})`; c.fillRect(0, 0, W, H); }
        },
      };
    },
  });
})();
