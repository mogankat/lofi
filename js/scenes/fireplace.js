// Home: an armchair in front of the fireplace.
(function () {
  'use strict';
  const K = window.Lofi.sceneKit;
  const { TAU, PHASES, rng, rect, circle, ellipse, rrect, poly, line, vgrad, glow, pool, vignette, shade, sky, makeStars, stars, moon, sunOrMoon, makeFlock, flock, makeLayer, lookOf, headwear, friendWear, outfit, FRIEND, drawPet, perchBird, owl, backFigure, flames } = K;
  const { sin, cos, round } = Math;

  const HOME = {
    morning: {
      wall: ['#c9b8a0', '#b5a28a'], panel: '#9a8468', floor: ['#9a6a44', '#7a5234'], stone: '#b8aca0',
      mantel: '#6a4a32', shelf: '#5a3e2a', hills: '#86a07e', trees: '#5f7f5c', sun: [0.3, 0.3], bird: '#3a3a4a',
    },
    afternoon: {
      wall: ['#d4c4ac', '#bea992'], panel: '#a08a6e', floor: ['#a4724a', '#825a3a'], stone: '#c0b4a8',
      mantel: '#6e4e36', shelf: '#5e422e', hills: '#80a46e', trees: '#58804e', sun: null, bird: '#3a3a4a',
    },
    evening: {
      wall: ['#8e6c62', '#6c5048'], panel: '#5a4238', floor: ['#6e4a32', '#523624'], stone: '#8a7a78',
      mantel: '#523a28', shelf: '#48321f', hills: '#8a6a86', trees: '#4e4460', sun: [0.7, 0.62], bird: '#3a2a3a',
    },
    night: {
      wall: ['#3a2c34', '#2a2028'], panel: '#221a20', floor: ['#3a2a22', '#261a14'], stone: '#5a5058',
      mantel: '#3a281c', shelf: '#2e2016', hills: '#1c2038', trees: '#121428', sun: null, bird: null,
    },
  };
  const BOOKS = ['#8a4a4a', '#3f6f8f', '#c8a060', '#5a8a5a', '#7a5a9a', '#d8c8a8', '#a86a3a', '#4a5a7a'];

  // Painting of autumn woods: warm sky, trees in reds and golds, a leafy path.
  const AUTUMN = ['#d9642c', '#e8963a', '#c0442e', '#f0bf52', '#b85a2a'];
  function makePainting(r) {
    const trees = Array.from({ length: 8 }, (_, i) => ({
      x: 0.06 + i * 0.125 + (r() - 0.5) * 0.05, w: 1 + ((r() * 2) | 0), top: 0.3 + r() * 0.15,
      blobs: Array.from({ length: 4 }, () => ({ dx: (r() - 0.5) * 12, dy: r() * 10, r: 3 + r() * 3.5, col: AUTUMN[(r() * AUTUMN.length) | 0] })),
    }));
    const flecks = Array.from({ length: 26 }, () => ({ x: r(), y: 0.8 + r() * 0.2, col: AUTUMN[(r() * AUTUMN.length) | 0] }));
    return { trees, flecks };
  }
  function drawPainting(c, P, x, y, w, h) {
    rect(c, x - 4, y - 4, w + 8, h + 8, '#8a6a3a'); rect(c, x - 2, y - 2, w + 4, h + 4, '#6a4e28');
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = vgrad(c, y, y + h, [[0, '#f6dcae'], [1, '#e8a878']]); c.fillRect(x, y, w, h);
    for (let i = 0; i < 12; i++) circle(c, x + i * 8, y + h * 0.55, 6, '#d0946a'); // distant trees
    rect(c, x, y + h * 0.78, w, h * 0.22, '#9a5a2e');
    poly(c, [x + w * 0.42, y + h, x + w * 0.58, y + h, x + w * 0.52, y + h * 0.78, x + w * 0.49, y + h * 0.78], '#c8905e'); // path
    for (const f of P.flecks) rect(c, x + f.x * w, y + f.y * h, 1, 1, f.col);
    for (const tr of P.trees) {
      const tx = x + tr.x * w;
      rect(c, tx, y + h * tr.top, tr.w, h * (0.8 - tr.top), '#4a3024');
      for (const b of tr.blobs) circle(c, tx + b.dx, y + h * tr.top + b.dy, b.r, b.col);
    }
    c.restore();
  }

  // Small mantel clock whose hands show the real time.
  function mantelClock(c, x, y) {
    const now = new Date(), cx0 = x, cy0 = y;
    rrect(c, x - 10, y - 10, 20, 19, 4, '#b8904e'); rect(c, x - 11, y + 8, 22, 2, '#8a6a3a');
    circle(c, cx0, cy0, 6.8, '#f4efe4');
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; rect(c, cx0 + Math.cos(a) * 5.4 - 0.5, cy0 + Math.sin(a) * 5.4 - 0.5, 1, 1, '#6a5a4a'); }
    const m = now.getMinutes() + now.getSeconds() / 60, h = (now.getHours() % 12) + m / 60;
    const hand = (frac, len, w, col) => { const a = frac * Math.PI * 2 - Math.PI / 2; line(c, [cx0, cy0, cx0 + Math.cos(a) * len, cy0 + Math.sin(a) * len], col, w); };
    hand(h / 12, 3.6, 1.3, '#2a2020');
    hand(m / 60, 5.3, 0.9, '#2a2020');
    hand(now.getSeconds() / 60, 5.6, 0.5, '#c0443a');
    circle(c, cx0, cy0, 0.9, '#2a2020');
  }

  // ---- a little 3D for the armchairs ----
  // Parts are boxes in chair space (x = the sitter's right, y = up, z = the way
  // the chair faces), turned by `ang` about the vertical (positive = turned to
  // face left) and seen from behind and slightly above: further away draws
  // higher up. Faces pointing away are skipped and boxes are painted back to
  // front, so the chair's shape and angle come out right on their own.
  const ELEV = 0.38;
  function projector(ox, oy, ang) {
    const cs = cos(ang), sn = sin(ang);
    const turn = (x, z) => [x * cs - z * sn, x * sn + z * cs]; // → world [X, Z]
    return {
      pt: (x, y, z) => { const [X, Z] = turn(x, z); return [ox + X, oy - y - Z * ELEV]; },
      depth: (x, y, z) => turn(x, z)[1] - y * ELEV,
      turn,
    };
  }
  const FACES = [ // [normal, corners of box b = [x0, x1, y0, y1, z0, z1]]
    [[1, 0, 0], (b) => [[b[1], b[2], b[4]], [b[1], b[2], b[5]], [b[1], b[3], b[5]], [b[1], b[3], b[4]]]],
    [[-1, 0, 0], (b) => [[b[0], b[2], b[4]], [b[0], b[2], b[5]], [b[0], b[3], b[5]], [b[0], b[3], b[4]]]],
    [[0, 1, 0], (b) => [[b[0], b[3], b[4]], [b[1], b[3], b[4]], [b[1], b[3], b[5]], [b[0], b[3], b[5]]]],
    [[0, 0, 1], (b) => [[b[0], b[2], b[5]], [b[1], b[2], b[5]], [b[1], b[3], b[5]], [b[0], b[3], b[5]]]],
    [[0, 0, -1], (b) => [[b[0], b[2], b[4]], [b[1], b[2], b[4]], [b[1], b[3], b[4]], [b[0], b[3], b[4]]]],
  ];
  // part: { box, col (hex), tone?, bias?, after?(c, P) }. fireX: -1 if the fire is to the left.
  function drawParts(c, P, parts, fireX) {
    parts.map((p) => ({ p, d: P.depth((p.box[0] + p.box[1]) / 2, (p.box[2] + p.box[3]) / 2, (p.box[4] + p.box[5]) / 2) + (p.bias || 0) }))
      .sort((a, b) => b.d - a.d)
      .forEach(({ p }) => {
        for (const [[nx, ny, nz], corners] of FACES) {
          const [wx, wz] = P.turn(nx, nz);
          if (wz - ELEV * ny >= 0) continue; // facing away from us
          const light = ny > 0 ? 0.14 : wz < -0.7 ? 0 : -0.16; // tops catch light, sides are darker
          const warm = fireX * wx > 0.3 ? 0.07 : 0; // the side facing the fire picks up its glow
          poly(c, corners(p.box).flatMap(([x, y, z]) => P.pt(x, y, z)), shade(p.col, light + warm + (p.tone || 0)));
        }
        if (p.after) p.after(c, P);
      });
  }

  // Wingback armchair seen from behind, turned toward the fire: the tall back
  // with its "wings", the rolled arm on the fire side with a plaid throw over it,
  // skirt, and wooden legs. ang > 0 turns it to face left.
  function armchair(c, P, ang, col, [blanket, stripe]) {
    const wood = '#3a2418', dark = shade(col, -0.35);
    const s = ang > 0 ? -1 : 1; // the arm on the fire side (the one we can see): -1 = sitter's left
    const armX = s < 0 ? [-28, -19] : [19, 28], rollX = s < 0 ? [-30, -17] : [17, 30], otherArm = armX.map((v) => -v).reverse(), otherRoll = rollX.map((v) => -v).reverse();
    const bx = s < 0 ? -31 : 31; // outside face of the throw
    const parts = [
      ...[[-27, -23], [23, 27]].flatMap((lx) => [[-25, -21], [19, 23]].map((lz) => ({ box: [lx[0], lx[1], 0, 9, lz[0], lz[1]], col: wood }))),
      { box: [-28, 28, 9, 20, -26, 24], col, tone: -0.12, after: (cc, Q) => { // skirt, with piping along its top
        const a = Q.pt(-28, 20, -26.1), b = Q.pt(28, 20, -26.1);
        line(cc, [a[0], a[1], b[0], b[1]], shade(col, 0.2), 1);
      } },
      { box: [-20, 20, 20, 27, -16, 22], col, tone: 0.05 }, // seat cushion
      { box: [otherArm[0], otherArm[1], 20, 36, -16, 22], col }, { box: [otherRoll[0], otherRoll[1], 36, 41, -16, 25], col },
      { box: [armX[0], armX[1], 20, 36, -16, 22], col }, { box: [rollX[0], rollX[1], 36, 41, -16, 25], col },
      { box: [s < 0 ? -31 : 16, s < 0 ? -16 : 31, 21, 43, -4, 12], col: blanket, bias: -5, after: (cc, Q) => { // throw over the arm
        for (const y of [28, 35]) { const a = Q.pt(bx, y, -4), b = Q.pt(bx, y, 12); line(cc, [a[0], a[1], b[0], b[1]], stripe, 1.6); }
        const a = Q.pt(bx, 21, 4), b = Q.pt(bx, 43, 4); cc.globalAlpha = 0.55; line(cc, [a[0], a[1], b[0], b[1]], stripe, 1.4); cc.globalAlpha = 1;
        for (let z = -3; z <= 11; z += 3) { const f = Q.pt(bx, 21, z); rect(cc, f[0], f[1], 1, 2 + (z % 2 ? 1 : 0), blanket); } // fringe
      } },
      { box: [-28, -20, 48, 76, -16, -6], col }, { box: [20, 28, 48, 76, -16, -6], col }, // wings
      { box: [-28, 28, 20, 76, -26, -16], col, after: (cc, Q) => { // the back, button-tufted
        [[62, [-14, 0, 14]], [50, [-7, 7]], [38, [-14, 0, 14]]].forEach(([y, xs]) => xs.forEach((x) => { const q = Q.pt(x, y, -26.1); circle(cc, q[0], q[1], 1.1, dark); }));
      } },
      { box: [-24, 24, 76, 80, -25, -17], col }, // rounded crest along the top
    ];
    drawParts(c, P, parts, ang > 0 ? -1 : 1);
  }

  // Small round side table with a mug (returns where its steam rises from),
  // or a couple of books when nobody's using it.
  function sideTable(c, x, mug) {
    const wood = '#6a4630';
    ellipse(c, x, 263, 12, 2.5, 'rgba(0,0,0,0.25)');
    ellipse(c, x, 262, 9, 2.5, shade(wood, -0.25));
    rect(c, x - 2, 234, 4, 28, shade(wood, -0.2));
    ellipse(c, x, 233, 15, 4, shade(wood, -0.15));
    ellipse(c, x, 232, 15, 3.5, wood);
    ellipse(c, x, 231.5, 13, 2.5, shade(wood, 0.12));
    if (!mug) {
      rect(c, x - 8, 227, 15, 3, '#46708a'); rect(c, x - 6, 224, 12, 3, '#b08a4c');
      rect(c, x + 6, 227.5, 1, 2, '#e8dcc4');
      return null;
    }
    rect(c, x - 4, 222, 8, 9, mug); rect(c, x - 4, 222, 8, 2, shade(mug, -0.15));
    c.strokeStyle = mug; c.lineWidth = 1.5;
    c.beginPath(); c.arc(x + 5, 226.5, 2.3, -Math.PI / 2, Math.PI / 2); c.stroke();
    return [x, 221];
  }

  window.Lofi.scenes.register({
    id: 'fireplace', name: 'Fireside', outdoor: false,
    mix: { fire: 0.55, rain: 0.2 },
    create(W, H) {
      const r = rng(61), cx = round(W / 2), layer = makeLayer(), birds = makeFlock(), floorY = 205;
      const win = { x: cx - 238, y: 42, w: 78, h: 104 };
      const starList = makeStars(r, 16, win.x, win.w, win.y, 50);
      const shelf = { x: cx + 152, y: 40, w: 80, h: floorY - 40 };
      const painting = makePainting(r);
      const books = [];
      for (let row = 0; row < 4; row++) {
        let x = shelf.x + 5;
        while (x < shelf.x + shelf.w - 8) {
          const w = 3 + ((r() * 4) | 0), h = 18 + ((r() * 10) | 0);
          books.push({ x, row, w, h, col: BOOKS[(r() * BOOKS.length) | 0], lean: r() < 0.1 });
          x += w + (r() < 0.15 ? 5 : 1);
        }
      }

      return {
        draw(c, t, dt, env) {
          const P = PHASES[env.tod], M = HOME[env.tod], lk = lookOf(env), fit = outfit(lk, '#5a78a0');
          const lights = P.lights, fl = 1 + 0.06 * sin(t * 11) + 0.04 * sin(t * 17.3);

          // window
          c.save();
          c.beginPath(); c.rect(win.x, win.y, win.w, win.h); c.clip();
          sky(c, win.x, win.y, win.w, win.h, P.sky);
          stars(c, starList, t, P.stars);
          if (P.moon) moon(c, win.x + 52, win.y + 22, 7);
          else if (M.sun) sunOrMoon(c, P, win.x + win.w * M.sun[0], win.y + win.h * M.sun[1], 9);
          if (M.bird) flock(c, birds, t, dt, env.fx.birds, win.x, win.x + win.w, win.y + 8, win.y + 40, M.bird);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.55})`; c.fillRect(win.x, win.y, win.w, win.h); }
          K.ridge(c, W, H, (x) => win.y + 78 - 8 * sin(x * 0.05), M.hills);
          for (let i = 0; i < 5; i++) { const tx = win.x + 8 + i * 17; poly(c, [tx, win.y + 64 - (i % 2) * 6, tx - 7, win.y + 86, tx + 7, win.y + 86], M.trees); }
          if (env.fx.birds) { if (P.moon) owl(c, win.x + 60, win.y + win.h, t); else perchBird(c, win.x + 60, win.y + win.h, t, 1, '#8a6a4a', true); }
          env.drawWind(c, win);
          env.drawRain(c, win, 0.6);
          c.restore();

          // walls
          c.fillStyle = vgrad(c, 0, floorY, [[0, M.wall[0]], [1, M.wall[1]]]);
          c.fillRect(0, 0, W, win.y); c.fillRect(0, win.y + win.h, W, floorY - win.y - win.h);
          c.fillRect(0, win.y, win.x, win.h); c.fillRect(win.x + win.w, win.y, W - win.x - win.w, win.h);
          rect(c, 0, 160, W, floorY - 160, M.panel); rect(c, 0, 160, W, 2, shade(M.panel, 0.2));
          for (let x = cx % 34; x < W; x += 34) rect(c, x, 166, 26, 34, shade(M.panel, -0.08));
          // window frame + curtains
          c.strokeStyle = M.shelf; c.lineWidth = 5; c.strokeRect(win.x - 2, win.y - 2, win.w + 4, win.h + 4);
          rect(c, win.x + win.w / 2 - 1.5, win.y, 3, win.h, M.shelf); rect(c, win.x, win.y + win.h / 2 - 1.5, win.w, 3, M.shelf);
          rect(c, win.x - 6, win.y + win.h + 2, win.w + 12, 4, shade(M.panel, 0.1));
          const sway = sin(t * 1.4) * env.fx.wind * 3;
          poly(c, [win.x - 22, win.y - 10, win.x + 4, win.y - 10, win.x + 2 + sway, win.y + win.h + 20, win.x - 24, win.y + win.h + 20], '#8a5a5a');
          poly(c, [win.x + win.w - 4, win.y - 10, win.x + win.w + 22, win.y - 10, win.x + win.w + 24, win.y + win.h + 20, win.x + win.w - 2 + sway, win.y + win.h + 20], '#8a5a5a');
          rect(c, win.x - 26, win.y - 12, win.w + 52, 3, M.mantel);
          // floor
          c.fillStyle = vgrad(c, floorY, H, [[0, M.floor[0]], [1, M.floor[1]]]);
          c.fillRect(0, floorY, W, H - floorY);
          for (let y = floorY + 8; y < H; y += 10) rect(c, 0, y, W, 1, 'rgba(0,0,0,0.12)');

          // bookshelf
          rect(c, shelf.x, shelf.y, shelf.w, shelf.h, M.shelf);
          rect(c, shelf.x + 3, shelf.y + 3, shelf.w - 6, shelf.h - 3, shade(M.shelf, -0.35));
          for (let row = 0; row < 4; row++) rect(c, shelf.x + 3, shelf.y + 3 + (row + 1) * 40 - 3, shelf.w - 6, 3, M.shelf);
          for (const b of books) {
            const y = shelf.y + 3 + (b.row + 1) * 40 - 3 - b.h;
            if (b.lean) { c.save(); c.translate(b.x, y + b.h); c.rotate(-0.25); rect(c, 0, -b.h, b.w, b.h, b.col); c.restore(); }
            else { rect(c, b.x, y, b.w, b.h, b.col); rect(c, b.x, y + 3, b.w, 1, 'rgba(255,255,255,0.25)'); }
          }

          // fireplace
          const fx = cx, top = 94;
          rect(c, fx - 86, top, 172, floorY - top, M.stone);
          for (let y = top + 6; y < floorY; y += 10) for (let x = fx - 86 + ((y / 10) % 2) * 12; x < fx + 86; x += 24) rect(c, x, y, 1, 10, 'rgba(0,0,0,0.12)');
          for (let y = top + 6; y < floorY; y += 10) rect(c, fx - 86, y, 172, 1, 'rgba(0,0,0,0.1)');
          rect(c, fx - 100, top - 8, 200, 8, M.mantel); rect(c, fx - 100, top - 8, 200, 1, shade(M.mantel, 0.25));
          c.fillStyle = '#1a1210';
          c.beginPath(); c.moveTo(fx - 50, floorY); c.lineTo(fx - 50, 140); c.quadraticCurveTo(fx, 112, fx + 50, 140); c.lineTo(fx + 50, floorY); c.fill();
          rect(c, fx - 96, floorY - 4, 192, 8, shade(M.stone, 0.12));
          drawPainting(c, painting, fx - 42, 24, 84, 44);
          // logs + fire
          for (const a of [0.2, -0.2]) { c.save(); c.translate(fx, floorY - 8); c.rotate(a); rect(c, -24, -3, 48, 6, '#4d2e1d'); c.restore(); }
          flames(c, fx, floorY - 8, t, 1.05);

          // ---- objects layer: mantel décor, lamp, chairs, people, pet ----
          const f = layer.begin(W, H);
          const candles = [fx - 80, fx - 70, fx + 78];
          for (const x of candles) rect(f, x - 2, top - 20 + (x === fx - 70 ? 4 : 0), 4, 12 - (x === fx - 70 ? 4 : 0), '#f0e6d0');
          mantelClock(f, fx - 27, top - 18);
          rect(f, fx + 30, top - 20, 16, 12, '#3a2a22'); rect(f, fx + 32, top - 18, 12, 8, '#d8b890'); // photo
          rect(f, fx + 56, top - 14, 10, 6, '#b86a4a');
          for (let i = 0; i < 5; i++) line(f, [fx + 61, top - 12, fx + 56 + i * 3 + sin(t * 0.6 + i) * 0.5, top - 4 + i * 5], '#5f8f5a', 2); // trailing plant
          // floor lamp
          const lampX = cx - 212; // beside the window, out of the way of the side table
          rect(f, lampX - 1, 90, 2, floorY - 88, '#2a2426'); ellipse(f, lampX, floorY, 8, 2, '#2a2426');
          poly(f, [lampX - 12, 92, lampX + 12, 92, lampX + 8, 76, lampX - 8, 76], lights > 0.3 ? '#f0d8a8' : '#d8c8a8');
          // rug
          ellipse(f, cx, 242, 150, 22, '#8a4a4a'); ellipse(f, cx, 242, 138, 18, '#a85a54'); ellipse(f, cx, 242, 120, 14, '#8a4a4a');
          drawPet(f, lk, cx - 4, 238, t);
          // Two armchairs turned toward the fire (and each other). The guest chair
          // is always there; the friend just fills it. People are drawn first so
          // the chair back hides all but their heads.
          const chairCol = lk.furniture || '#6a3a4a', mugs = [];
          const chair = (ox, ang, throwCols, person) => {
            ellipse(f, ox + (ang > 0 ? -6 : 6), 259, 40, 5, 'rgba(0,0,0,0.25)'); // shadow
            const P = projector(ox, 256, ang);
            if (person) { // only what shows above the chair back (so sleeves don't poke out the sides)
              const [hx, hy] = P.pt(0, 82, -8), top = P.pt(0, 80, -26)[1];
              f.save(); f.beginPath(); f.rect(0, 0, W, top + 3); f.clip();
              backFigure(f, hx, hy + 17, { t, torso: 28, rim: 'rgba(255,170,100,0.6)', ...person });
              f.restore();
            }
            armchair(f, P, ang, chairCol, throwCols);
          };
          chair(cx - 70, -0.5, ['#b8cbb8', '#4a6a8a'], lk.friend && { top: FRIEND.top, shade: FRIEND.shade, hair: FRIEND.hair, longHair: true, skin: FRIEND.skin, ...friendWear(lk, true), turn: 1, bob: sin(t * 0.9 + 2) * 0.5 });
          mugs.push(sideTable(f, cx - 124, lk.friend ? '#6f8fb8' : null));
          chair(cx + 70, 0.5, ['#d8c8a0', '#b0584a'], { top: fit.top, shade: fit.shade, hair: lk.hair || '#3a2420', ...headwear(lk, null, '#c9574a', true), turn: -1, bob: sin(t * 0.8) * 0.5 });
          mugs.push(sideTable(f, cx + 124, '#e8dcc6'));
          layer.end(c, P.tint, 0.4);

          // ---- light ----
          const fire = 0.55 + 0.45 * lights;
          glow(c, fx, 160, 260 * fl, [255, 140, 60], 0.16 * fire);
          pool(c, fx, floorY + 10, 180 * fl, [255, 150, 70], 0.3 * fire, 0.3);
          candles.forEach((x, i) => { // flickering candle flames
            const cy = top - 21 + (x === fx - 70 ? 4 : 0), k = 0.75 + 0.2 * sin(t * 13 + i * 2.1) + 0.12 * sin(t * 29 + i * 5.3);
            const sway = sin(t * 7 + i * 1.7) * 0.5, fh = 2.4 * k;
            glow(c, x, cy - 1, 11 * k, [255, 200, 120], (0.2 + 0.25 * lights) * k);
            ellipse(c, x + sway, cy - fh * 0.6, 1.3, fh, '#ffb347');
            ellipse(c, x + sway * 0.6, cy - fh * 0.4, 0.7, fh * 0.55, '#fff1b0');
          });
          if (lights > 0.3) glow(c, lampX, 88, 70, [255, 210, 150], 0.25 * lights);
          mugs.forEach((m) => m && K.steam(c, m[0], m[1], t, 0.22));
          vignette(c, W, H, P.vig * 0.9);
          if (env.flash) { c.fillStyle = `rgba(200,210,255,${env.flash * 0.06})`; c.fillRect(0, 0, W, H); }
        },
      };
    },
  });
})();
