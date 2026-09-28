// Fishing off a dock, lighthouse in the distance.
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { TAU, PHASES, rng, rect, rrect, poly, line, vgrad, glow, vignette, sky, stars, sunOrMoon, makeLayer, lookOf, headwear, friendWear, outfit, FRIEND, drawPet, perchBird, owl, backFigure, legs } = K;
  const { sin, cos, abs, max, min, round, pow } = Math;

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

  // Rod from the hands to the tip, then a line down to a bobbing float.
  function fishing(c, hx, hy, tipX, tipY, bx, by, t) {
    line(c, [hx, hy, tipX, tipY], '#2a1e1e', 1.5);
    return (c) => { // the line and float are drawn later, on the main canvas
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(tipX, tipY); c.quadraticCurveTo((tipX + bx) / 2, tipY + 40, bx, by); c.stroke();
      for (let k = 0; k < 2; k++) {
        const q = (t * 5 + k * 9) % 18;
        c.strokeStyle = `rgba(255,230,220,${0.4 * (1 - q / 18)})`; c.lineWidth = 1;
        c.beginPath(); c.ellipse(bx, by + 1, q, q * 0.25, 0, 0, TAU); c.stroke();
      }
      rect(c, bx - 1, by - 2, 3, 2, '#e64a4a'); rect(c, bx - 1, by, 3, 1, '#fff');
    };
  }

  window.Lofi.scenes.register({
    id: 'seaside', name: 'Fishing dock', group: 'explore', outdoor: true,
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
          const P = PHASES[env.tod], S = SEA[env.tod], sx = cx + S.sun[0], sy = S.sun[1], lk = lookOf(env), fit = outfit(lk, '#7f9c8a');
          const wind = env.fx.wind;
          sky(c, 0, 0, W, hz, S.sky || P.sky);
          stars(c, starList, t, P.stars);
          sunOrMoon(c, P, sx, sy, S.sunR);
          for (const s of streaks) {
            const x = ((s.x + t * s.s * (1 + wind * 4)) % (W + 200)) - 100;
            rrect(c, x, s.y, s.w, 3, 1.5, S.streak[0]);
            rrect(c, x + 10, s.y + 3, s.w * 0.6, 2, 1, S.streak[1]);
          }

          // island + lighthouse with sweeping beam
          poly(c, [cx + 120, hz, cx + 140, hz - 8, cx + 160, hz - 11, cx + 185, hz - 9, cx + 205, hz - 4, cx + 225, hz], S.island);
          const ly = hz - 10, lamp = P.lights > 0.3;
          poly(c, [lx - 6, ly, lx + 6, ly, lx + 4, ly - 36, lx - 4, ly - 36], S.tower);
          rect(c, lx - 5.5, ly - 12, 11, 5, S.stripe); rect(c, lx - 4.8, ly - 26, 9.6, 5, S.stripe);
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
          c.fillStyle = vgrad(c, hz, H, S.water);
          c.fillRect(0, hz, W, H - hz);
          rect(c, 0, hz, W, 1, S.hz);
          const [rr, rg, rb, ra] = S.refl;
          for (let y = hz + 2; y < hz + 70; y += 2) {
            const d = (y - hz) / 70, w = (22 - d * 10) * (0.55 + 0.45 * sin(t * 1.7 + y * 0.9));
            c.fillStyle = `rgba(${rr},${rg},${rb},${ra * (1 - d)})`;
            c.fillRect(round(sx - w / 2 + sin(t * 1.1 + y * 0.35) * 2), y, round(w), 1);
          }
          c.fillStyle = 'rgba(20,20,40,0.3)'; c.fillRect(cx + 130, hz + 1, 85, 3);
          const [gr, gg, gb, ga] = S.glint;
          for (const g of glints) {
            c.fillStyle = `rgba(${gr},${gg},${gb},${(0.5 + 0.5 * sin(t * g.s * (1 + wind) + g.p)) * ga})`;
            c.fillRect(round(g.x + sin(t * (0.3 + wind) + g.p) * 4), round(g.y), round(g.w), 1);
          }
          if (env.fx.birds && !P.moon) for (let i = 0; i < 3; i++) { // gulls
            const gx = cx + cos(t * 0.12 + i * 2.2) * 150, gy = 50 + sin(t * 0.2 + i * 2) * 14 + i * 16;
            const w = sin(t * 0.5 + i) > 0.5 ? sin(t * 8) * 2.5 : 1.2;
            line(c, [gx - 5, gy - w, gx - 2, gy, gx, gy - 1, gx + 2, gy, gx + 5, gy - w], P.moon ? '#8a8ab0' : '#2a2040', 1);
          }

          // ---- objects layer: dock, lantern, people, rods ----
          const f = layer.begin(W, H), later = [];
          for (let x = 12; x < dockEnd; x += 44) {
            const px = min(x, dockEnd - 6);
            rect(f, px, 222, 5, 32, '#2e2230');
            f.fillStyle = 'rgba(20,15,30,0.35)'; f.fillRect(round(px + sin(t * 2 + x) * 1), 254, 5, 10);
            rect(f, px - 3, 254, 11, 1, 'rgba(255,220,200,0.25)');
          }
          const deck = lk.furniture || '#7a5642';
          rect(f, 0, 216, dockEnd, 4, deck); rect(f, 0, 220, dockEnd, 3, K.shade(deck, -0.3));
          for (let x = 4; x < dockEnd; x += 10) rect(f, x, 216, 1, 4, K.shade(deck, -0.15));
          const lnx = cx - 16;
          rect(f, lnx - 3, 208, 6, 8, '#2e2230'); rect(f, lnx - 2, 210, 4, 5, P.lights > 0.3 ? '#ffd88a' : '#d8d2c0');
          const rim = P.moon ? 'rgba(200,210,255,0.5)' : P.rim;
          // legs dangle over the edge, swinging a little; rods point out to sea, so the
          // lines drop into the water beyond the dock (between it and the horizon)
          legs(f, cx + 14, 223, 29, { t, swing: 2 });
          if (lk.friend) {
            legs(f, cx - 52, 223, 28, { t: t + 2, swing: 1.5, pants: FRIEND.pants });
            backFigure(f, cx - 52, 177, { t, torso: 40, top: '#c98a6a', shade: '#a86f52', hair: FRIEND.hair, longHair: true, ...friendWear(lk), wind, rim, bob: sin(t * 0.8 + 2) * 0.5 });
            later.push(fishing(f, cx - 70, 208, cx - 104, 126 + sin(t * 0.8 + 1) * 1.5, cx - 126, 190 + sin(t * 1.4 + 1) * 0.6, t + 3));
          }
          drawPet(f, lk, lk.friend ? cx - 100 : cx - 44, 216, t);
          backFigure(f, cx + 14, 176, {
            t, torso: 41, top: fit.top, shade: fit.shade, hair: lk.hair || '#4a2e28', ...headwear(lk, '#3a3548'), wind,
            rim, bob: sin(t * 0.9) * 0.5,
          });
          later.push(fishing(f, cx + 32, 208, cx + 66, 124 + sin(t * 0.9) * 1.5, cx + 90, 194 + sin(t * 1.6) * 0.6, t));
          if (env.fx.birds && !P.moon) perchBird(f, dockEnd - 4, 216, t, 3, '#e4e4ec', true);
          later.forEach((fn) => fn(c)); // lines and floats are further away than the people: under the layer
          layer.end(c, P.tint);
          if (env.fx.birds && P.moon) owl(c, dockEnd - 4, 216, t);
          glow(c, lnx, 212, 26, [255, 200, 120], 0.4 * (0.92 + 0.08 * sin(t * 7)) * P.lights);
          vignette(c, W, H, P.vig * 0.7);
        },
      };
    },
  });
})();
