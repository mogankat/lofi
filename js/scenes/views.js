// What's outside in the Home and Town scenes: a city skyline, the countryside
// or the beach, picked once for all of them in the Scenes panel (env.look.view).
//
//   const view = K.viewer({ x, y, w, h }, { perch: 0.85 });
//   view.draw(c, t, dt, env)   – fills the area (clip to it first)
//   view.kind(env)             – which view is showing
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { TAU, PHASES, rng, rect, circle, poly, line, vgrad, glow, shade, sky, makeStars, stars, moon, sunOrMoon, makeClouds, clouds, makeFlock, flock, perchBird, owl, makeFlies, fireflies, fliesLevel } = K;
  const { sin, cos, max, min, round, pow } = Math;

  const VIEWS = [['city', 'City'], ['country', 'Countryside'], ['beach', 'Beach']];
  const DEFAULT_VIEW = 'city';
  const viewKind = (env) => (VIEWS.some(([id]) => id === (env.look && env.look.view)) ? env.look.view : DEFAULT_VIEW);

  const PAL = {
    city: {
      morning: { far: '#a9b8d2', near: '#7a87a6', win: 'rgba(230,240,255,0.45)', bird: '#4a4a5a' },
      afternoon: { far: '#b3c6de', near: '#8190ad', win: 'rgba(235,245,255,0.5)', bird: '#3a3a4a' },
      evening: { far: '#8f6f8f', near: '#4d3b5e', win: 'rgba(255,200,150,0.3)', bird: '#3a2a3a' },
      night: { far: '#29245a', near: '#15122f', win: null, bird: null },
    },
    country: {
      morning: { far: '#9fb0c8', hills: '#8aab7c', trees: '#5a8456', field: '#9cbd6e', furrow: '#b0cc80', barn: '#b85a4a', roof: '#6a4a4a', trim: '#f0e6dc', fence: '#8a6a50', bird: '#3a3a4a' },
      afternoon: { far: '#98b4c6', hills: '#80a86a', trees: '#4c7c46', field: '#a6c464', furrow: '#bcd67a', barn: '#c05848', roof: '#6a4444', trim: '#f6efe6', fence: '#8a6a50', bird: '#3a3a4a' },
      evening: { far: '#9a7a94', hills: '#8a7a70', trees: '#5a5066', field: '#c49a5a', furrow: '#d6b06a', barn: '#9a4a48', roof: '#4a3040', trim: '#e0c8c0', fence: '#5a4048', bird: '#3a2a3a' },
      night: { far: '#262a4c', hills: '#1c2440', trees: '#121a2e', field: '#1c2632', furrow: '#222e3c', barn: '#3a2230', roof: '#1a1424', trim: '#4a4460', fence: '#1a1822', bird: null },
    },
    beach: {
      morning: { water: [[0, '#f2dccb'], [0.25, '#a9c6dc'], [1, '#5f8fb8']], sand: '#ead6b2', wet: '#cfb892', head: '#7d8aa0', tower: '#f0eaf0', trunk: '#8a6a4a', leaf: '#4f8a5a', refl: [255, 240, 210, 0.5], bird: '#4a4a5a' },
      afternoon: { water: [[0, '#cfe7f2'], [0.25, '#7fc4dc'], [1, '#2f8ab0']], sand: '#f0dcb4', wet: '#d6bc90', head: '#6a7e92', tower: '#f4f0f4', trunk: '#8a6a4a', leaf: '#3f8a50', refl: [255, 255, 240, 0.35], bird: '#3a3a4a' },
      evening: { water: [[0, '#f0a88e'], [0.25, '#b07890'], [1, '#4a4a80']], sand: '#d8a88a', wet: '#b8887a', head: '#4a3a5a', tower: '#e8dce4', trunk: '#5a4040', leaf: '#3a4a48', refl: [255, 210, 160, 0.6], bird: '#3a2a3a' },
      night: { water: [[0, '#2b2f5c'], [0.25, '#1e2350'], [1, '#0e1230']], sand: '#4a4660', wet: '#3a3650', head: '#161830', tower: '#6c6a88', trunk: '#241c24', leaf: '#141e28', refl: [215, 220, 255, 0.4], bird: null },
    },
  };
  // Where the sun (or moon) sits, as fractions of the view; null = overhead, out of sight.
  const SUN = {
    city: { morning: [0.2, 0.3], afternoon: null, evening: [0.8, 0.36], night: [0.8, 0.22] },
    country: { morning: [0.28, 0.3], afternoon: [0.75, 0.12], evening: [0.72, 0.46], night: [0.7, 0.2] },
    beach: { morning: [0.25, 0.3], afternoon: [0.7, 0.12], evening: [0.6, 0.47], night: [0.72, 0.2] },
  };

  // ---------- city ----------
  function makeCity(v, r) {
    const S = min(1.15, v.h / 138); // a big backdrop gets more sky, not a wall of towers
    const skyline = (minH, maxH, minW, maxW, density) => {
      const out = [];
      for (let x = v.x - 4; x < v.x + v.w;) {
        const w = (minW + r() * (maxW - minW)) | 0, h = ((minH + r() * (maxH - minH)) * S) | 0, wins = [];
        for (let yy = 6; yy < h - 4; yy += 6) for (let xx = 3; xx < w - 3; xx += 5) if (r() < density) wins.push({ x: xx, y: yy, p: r() * TAU, s: 0.04 + r() * 0.2 });
        out.push({ x, w, h, wins, ant: r() < 0.2 });
        x += w + ((r() * 3) | 0);
      }
      return out;
    };
    return { far: skyline(40, 95, 12, 24, 0.25), near: skyline(18, 62, 16, 34, 0.4) };
  }
  function drawCity(c, v, L, t, pal, lights) {
    const base = v.y + v.h;
    const row = (list, col, lit) => {
      for (const b of list) {
        rect(c, b.x, base - b.h, b.w, b.h, col);
        if (b.ant) {
          rect(c, b.x + b.w / 2, base - b.h - 7, 1, 7, col);
          if (lights > 0.5 && sin(t * 2 + b.x) > 0.6) rect(c, b.x + b.w / 2, base - b.h - 8, 1, 1, '#ff5a5a');
        }
        if (pal.win) { c.fillStyle = pal.win; for (const w of b.wins) c.fillRect(b.x + w.x, base - b.h + w.y, 2, 2); }
        if (lights > 0) {
          c.globalAlpha = lights; c.fillStyle = lit;
          for (const w of b.wins) if (sin(t * w.s + w.p) > -0.2 + (1 - lights) * 0.8) c.fillRect(b.x + w.x, base - b.h + w.y, 2, 2);
          c.globalAlpha = 1;
        }
      }
    };
    row(L.far, pal.far, 'rgba(255,214,140,0.45)');
    row(L.near, pal.near, '#ffd27f');
  }

  // ---------- countryside ----------
  function makeCountry(v, r) {
    const S = min(2, v.h / 104), trees = [];
    for (let x = v.x - 4; x < v.x + v.w + 4; x += (7 + r() * 12) * S) trees.push({ x, r: (3 + r() * 3) * S, dark: r() < 0.35 });
    return { S, trees, barn: v.x + v.w * (0.62 + r() * 0.1), mill: v.x + v.w * (0.34 + r() * 0.1), flies: makeFlies(r, round(v.w / 30) + 2, v.x, v.w, v.y + v.h * 0.72, v.h * 0.25) };
  }
  function drawCountry(c, v, L, t, env, P, pal, o) {
    const { S } = L, base = v.y + v.h, lights = P.lights;
    const far = (x) => v.y + v.h * 0.56 - v.h * 0.07 * sin(x * 0.02 + 1) - v.h * 0.03 * sin(x * 0.07);
    const mid = (x) => v.y + v.h * 0.68 - v.h * 0.05 * sin(x * 0.03 + 2);
    const fill = (fn, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(v.x, base); for (let x = v.x; x <= v.x + v.w + 2; x += 2) c.lineTo(x, fn(x)); c.lineTo(v.x + v.w, base); c.closePath(); c.fill(); };
    fill(far, pal.far);
    // an old farm windmill on the far hill, turning faster in the wind
    const mx = L.mill, my = far(mx), mh = 16 * S, a = t * (0.6 + env.fx.wind * 3);
    line(c, [mx - 3 * S, my + 2, mx, my - mh, mx + 3 * S, my + 2], shade(pal.far, -0.25), 1);
    for (let i = 0; i < 4; i++) { const b = a + (i * TAU) / 4; line(c, [mx, my - mh, mx + cos(b) * 5 * S, my - mh + sin(b) * 5 * S], shade(pal.far, -0.3), max(1, S * 0.8)); }
    fill(mid, pal.hills);
    for (const tr of L.trees) circle(c, tr.x, mid(tr.x) - tr.r * 0.4, tr.r, tr.dark ? shade(pal.trees, -0.15) : pal.trees);
    // red barn with a gambrel roof; its window lights up after dark
    const bx = L.barn, by = mid(bx) + 2 * S, bw = 14 * S, bh = 9 * S;
    rect(c, bx - bw / 2, by - bh, bw, bh, pal.barn);
    poly(c, [bx - bw / 2 - 1, by - bh, bx - bw * 0.35, by - bh - 5 * S, bx, by - bh - 7 * S, bx + bw * 0.35, by - bh - 5 * S, bx + bw / 2 + 1, by - bh], pal.roof);
    rect(c, bx - 2 * S, by - 5 * S, 4 * S, 5 * S, pal.trim);
    rect(c, bx - 1.5 * S, by - bh - 3 * S, 3 * S, 2 * S, lights > 0.3 ? '#ffd27f' : pal.trim);
    if (lights > 0.3) glow(c, bx, by - bh - 2 * S, 8 * S, [255, 200, 120], 0.35 * lights);
    // fields
    const fy = v.y + v.h * 0.8;
    rect(c, v.x, fy, v.w, base - fy, pal.field);
    for (let y = fy + 2; y < base; y += 3 + round((y - fy) / 8)) rect(c, v.x, y, v.w, 1, pal.furrow);
    if (o.fence !== false) {
      for (let x = v.x + 3; x < v.x + v.w; x += 12) rect(c, x, base - 8, 2, 8, pal.fence);
      rect(c, v.x, base - 7, v.w, 1, pal.fence); rect(c, v.x, base - 4, v.w, 1, pal.fence);
    }
    fireflies(c, L.flies, t, fliesLevel(P, env));
  }

  // ---------- beach ----------
  function makeBeach(v, r) {
    const S = min(2, v.h / 104);
    return {
      S, boat: r() * 1000, palm: 0.06 + r() * 0.06,
      glints: Array.from({ length: round(v.w / 7) }, () => ({ x: v.x + r() * v.w, y: r(), w: 2 + r() * 5, p: r() * TAU, s: 0.5 + r() * 1.5 })),
    };
  }
  function drawBeach(c, v, L, t, env, P, pal, sunX, o) {
    const { S } = L, base = v.y + v.h, hz = round(v.y + v.h * 0.55), shore = v.y + v.h * 0.8, wind = env.fx.wind;
    // headland with a little lighthouse
    const hx = v.x + v.w * 0.74;
    poly(c, [hx, hz, hx + 12 * S, hz - 6 * S, hx + 30 * S, hz - 9 * S, v.x + v.w + 20, hz - 7 * S, v.x + v.w + 20, hz], pal.head);
    const lx = hx + 22 * S, ly = hz - 8 * S;
    poly(c, [lx - 2.5 * S, ly, lx + 2.5 * S, ly, lx + 1.8 * S, ly - 14 * S, lx - 1.8 * S, ly - 14 * S], pal.tower);
    rect(c, lx - 2.2 * S, ly - 6 * S, 4.4 * S, 2 * S, '#c24e5a');
    const beam = P.lights > 0.3 ? pow(max(0, sin(t * 0.9)), 6) : 0;
    rect(c, lx - 1.5 * S, ly - 17 * S, 3 * S, 3 * S, P.lights > 0.3 ? '#ffe9a8' : '#cfd6dc');
    if (P.lights > 0.3) glow(c, lx, ly - 15.5 * S, (6 + 24 * beam) * S, [255, 235, 180], (0.4 + 0.5 * beam) * P.lights);
    // sea, with the sun's (or moon's) path on it
    c.fillStyle = vgrad(c, hz, shore, pal.water); c.fillRect(v.x, hz, v.w, shore - hz);
    rect(c, v.x, hz, v.w, 1, 'rgba(255,255,255,0.35)');
    if (sunX != null) {
      const [rr, rg, rb, ra] = pal.refl;
      for (let y = hz + 2; y < shore; y += 2) {
        const d = (y - hz) / (shore - hz), w = (6 + d * 16) * S * 0.6 * (0.55 + 0.45 * sin(t * 1.7 + y * 0.9));
        c.fillStyle = `rgba(${rr},${rg},${rb},${ra * (1 - d * 0.6)})`;
        c.fillRect(round(sunX - w / 2 + sin(t * 1.1 + y * 0.35) * 2), y, round(w), 1);
      }
    }
    for (const g of L.glints) {
      c.fillStyle = `rgba(255,255,255,${(0.5 + 0.5 * sin(t * g.s * (1 + wind) + g.p)) * 0.25})`;
      c.fillRect(round(g.x + sin(t * 0.4 + g.p) * 3), round(hz + 3 + pow(g.y, 1.5) * (shore - hz - 6)), round(g.w), 1);
    }
    // a sailboat drifting along the horizon
    const bxw = v.w + 60, bx = v.x - 30 + ((L.boat + t * 2.2) % bxw), by = hz + 1 + sin(t * 1.3) * 0.5;
    poly(c, [bx - 5 * S, by - 1, bx + 5 * S, by - 1, bx + 3.5 * S, by + 1.5 * S, bx - 3.5 * S, by + 1.5 * S], P.lights > 0.5 ? '#3a3450' : '#6a4a4a');
    poly(c, [bx, by - 1, bx, by - 11 * S, bx + 5 * S, by - 2], P.lights > 0.5 ? '#8a88a8' : '#f6f0e6');
    poly(c, [bx - 0.5, by - 2, bx - 0.5, by - 8 * S, bx - 4 * S, by - 2], P.lights > 0.5 ? '#6a6888' : '#e8dccc');
    // sand, and the surf washing up and back
    rect(c, v.x, shore, v.w, base - shore, pal.sand);
    const wash = sin(t * 0.55) * 2.5 * S, surf = shore + 2 + wash;
    rect(c, v.x, shore, v.w, max(1, surf - shore + 2), pal.wet);
    c.fillStyle = vgrad(c, shore - 2, surf, [[0, 'rgba(0,0,0,0)'], [1, pal.water[1][1]]]); c.fillRect(v.x, shore - 2, v.w, surf - shore + 2);
    for (let x = v.x; x < v.x + v.w; x += 3) rect(c, x, round(surf + sin(x * 0.3 + t * 2) * 0.8), 3, 1, 'rgba(255,255,255,0.75)');
    const out = shore - 5 * S + ((t * 3) % (5 * S)); // a smaller wave coming in
    c.globalAlpha = 0.5 * (1 - ((t * 3) % (5 * S)) / (5 * S));
    for (let x = v.x; x < v.x + v.w; x += 4) rect(c, x, round(out + sin(x * 0.2 + t) * 0.6), 3, 1, '#ffffff');
    c.globalAlpha = 1;
    // a palm tree leaning in from the side, fronds swaying
    if (o.palm !== false) {
      const px = v.x + v.w * L.palm, pb = base + 2, top = [px + 16 * S, v.y + v.h * 0.42];
      line(c, [px, pb, px + 6 * S, pb - v.h * 0.25, top[0], top[1]], pal.trunk, 3 * S);
      for (let i = 0; i < 7; i++) {
        const a = -2.9 + i * 0.55 + sin(t * (1 + wind * 2) + i) * (0.05 + wind * 0.12), len = (16 + (i % 2) * 5) * S;
        const ex = top[0] + cos(a) * len, ey = top[1] + sin(a) * len * 0.6 + 6 * S;
        c.strokeStyle = pal.leaf; c.lineWidth = 2.2 * S; c.lineCap = 'round';
        c.beginPath(); c.moveTo(top[0], top[1]); c.quadraticCurveTo(top[0] + cos(a) * len * 0.6, top[1] + sin(a) * len * 0.6 - 3 * S, ex, ey); c.stroke();
      }
      circle(c, top[0] + 1, top[1] + 2, 2 * S, shade(pal.trunk, -0.2));
    }
  }

  function makeView(kind, v, o = {}) {
    const r = rng(o.seed || 7), birds = makeFlock();
    const starList = makeStars(r, max(10, round((v.w * v.h) / 900)), v.x, v.w, v.y, v.h * 0.5);
    const cloudList = kind === 'city' ? [] : makeClouds(r, v.x + v.w, max(2, round(v.w / 110)), v.y + 6, v.y + v.h * 0.3);
    const L = kind === 'city' ? makeCity(v, r) : kind === 'country' ? makeCountry(v, r) : makeBeach(v, r);
    const R = min(16, max(7, v.h * 0.09));
    return {
      kind,
      draw(c, t, dt, env) {
        const P = PHASES[env.tod], pal = PAL[kind][env.tod], lights = P.lights, at = SUN[kind][env.tod];
        const base = v.y + v.h, sunX = at ? v.x + v.w * at[0] : null;
        sky(c, v.x, v.y, v.w, v.h, P.sky);
        stars(c, starList, t, P.stars);
        if (at) { if (P.moon) moon(c, sunX, v.y + v.h * at[1], R * 0.8); else sunOrMoon(c, P, sunX, v.y + v.h * at[1], R); }
        clouds(c, cloudList, v.x + v.w, t, P, 0.6 + env.fx.wind * 2);
        if (kind === 'beach' && env.fx.birds && !P.moon) for (let i = 0; i < 3; i++) { // gulls
          const gx = v.x + v.w * (0.5 + cos(t * 0.12 + i * 2.2) * 0.35), gy = v.y + v.h * (0.18 + i * 0.07) + sin(t * 0.2 + i * 2) * 4;
          const w = sin(t * 0.5 + i) > 0.5 ? sin(t * 8) * 2.5 : 1.2;
          line(c, [gx - 5, gy - w, gx - 2, gy, gx, gy - 1, gx + 2, gy, gx + 5, gy - w], pal.bird || '#2a2040', 1);
        } else if (pal.bird) flock(c, birds, t, dt, env.fx.birds, v.x, v.x + v.w, v.y + 6, v.y + v.h * 0.35, pal.bird);
        if (o.window !== false && env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.55})`; c.fillRect(v.x, v.y, v.w, v.h); }
        if (kind === 'city') drawCity(c, v, L, t, pal, lights);
        else if (kind === 'country') drawCountry(c, v, L, t, env, P, pal, o);
        else drawBeach(c, v, L, t, env, P, pal, at && sunX, o);
        if (o.perch != null && env.fx.birds) { // a bird (an owl at night) on the sill
          const px = v.x + v.w * o.perch;
          if (P.moon) owl(c, px, base, t); else perchBird(c, px, base, t, 1, kind === 'beach' ? '#e4e4ec' : '#7a6a5a', true);
        }
        if (o.window !== false) { env.drawWind(c, v); env.drawRain(c, v, o.rain || 0.6); }
      },
    };
  }

  // A view that follows the setting picked in the Scenes panel.
  // o: { seed, perch: x fraction for a bird on the sill, window: false for an
  // outdoor backdrop (the app draws weather over those), fence, palm, rain }.
  function viewer(v, o) {
    const cache = {};
    return { kind: viewKind, draw(c, t, dt, env) { const k = viewKind(env); (cache[k] || (cache[k] = makeView(k, v, o))).draw(c, t, dt, env); } };
  }

  Object.assign(K, { VIEWS, DEFAULT_VIEW, viewKind, makeView, viewer });
})();
