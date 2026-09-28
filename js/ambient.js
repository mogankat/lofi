// Ambient sounds, synthesised live with the Web Audio API.
// No audio files are downloaded: rain, fire, café chatter etc. are all built
// from filtered noise and oscillators, so they never repeat exactly.
(function () {
  'use strict';
  const L = window.Lofi;

  const SOUNDS = [
    { id: 'rain', name: 'Rain', icon: '🌧️' },
    { id: 'thunder', name: 'Thunder', icon: '⛈️' },
    { id: 'wind', name: 'Wind', icon: '🍃' },
    { id: 'waves', name: 'Ocean waves', icon: '🌊' },
    { id: 'fire', name: 'Fireplace', icon: '🔥' },
    { id: 'cafe', name: 'Café', icon: '☕' },
    { id: 'birds', name: 'Birds', icon: '🐦' },
    { id: 'crickets', name: 'Crickets', icon: '🦗' },
    { id: 'white', name: 'White noise', icon: '⚪' },
    { id: 'pink', name: 'Pink noise', icon: '🌸' },
    { id: 'brown', name: 'Brown noise', icon: '🟤' },
  ];

  const A = { SOUNDS, onLightning: null, onChange: null };
  const vols = L.store.load('ambient', {});
  let master = L.store.load('ambientMaster', 0.8);
  const MAKEUP = 2;
  let ctx = null, out = null, unlocked = false, night = false;
  const buffers = {}, channels = {};

  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- plumbing ----------
  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      // +6 dB makeup gain so sounds sit well against music, then a limiter so
      // stacking several sounds at full volume never clips.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12;
      limiter.attack.value = 0.003; limiter.release.value = 0.25;
      out = ctx.createGain();
      out.gain.value = master * MAKEUP;
      out.connect(limiter);
      limiter.connect(ctx.destination);
      setInterval(schedule, 200);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 8 s of stereo noise, with the tail cross-faded into the head so it loops seamlessly.
  function buffer(type) {
    if (buffers[type]) return buffers[type];
    const sr = ctx.sampleRate, len = sr * 8, fade = Math.floor(sr * 0.5);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch), tmp = new Float32Array(len + fade);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < tmp.length; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') tmp[i] = w;
        else if (type === 'pink') { // Paul Kellet's filter
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          tmp[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else { // brown
          last = (last + 0.02 * w) / 1.02;
          tmp[i] = last * 3.5;
        }
      }
      d.set(tmp.subarray(0, len));
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        d[i] = tmp[len + i] * Math.sqrt(1 - k) + tmp[i] * Math.sqrt(k);
      }
    }
    return (buffers[type] = buf);
  }

  function noise(type, when = 0, dur) {
    const s = ctx.createBufferSource();
    s.buffer = buffer(type);
    s.loop = true;
    s.start(when, Math.random() * 7);
    if (dur) s.stop(when + dur);
    return s;
  }
  function filt(type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    return f;
  }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function pan(v) {
    if (!ctx.createStereoPanner) return gain(1);
    const p = ctx.createStereoPanner(); p.pan.value = v; return p;
  }
  function chain(...nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1];
  }
  // Calls fire(time) for every event inside the look-ahead window; fire returns
  // the gap until its next event. Look-ahead keeps sounds smooth in background tabs.
  function ticker(fire) {
    let next = 0;
    return (now, until) => {
      if (next < now) next = now + 0.05;
      while (next < until) next += fire(next);
    };
  }

  // Short filtered noise click — raindrops, fire crackles.
  function burst(dest, time, ftype, freq, q, peak, decay, p) {
    const s = ctx.createBufferSource();
    s.buffer = buffer('white');
    const g = gain(0);
    chain(s, filt(ftype, freq, q), g, pan(p), dest);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    s.start(time, Math.random() * 7, decay + 0.05);
  }

  // Small bell-like ping — cups and spoons in the café.
  function ping(dest, time, f, peak, p) {
    const g = gain(0), pn = pan(p);
    chain(g, pn, dest);
    const decay = rnd(0.25, 0.6);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    [1, 2.71].forEach((m) => {
      const o = ctx.createOscillator();
      o.frequency.value = f * m;
      o.connect(g); o.start(time); o.stop(time + decay + 0.05);
    });
  }

  function steady(type, o, v) { const s = noise(type); chain(s, gain(v), o); return s; }

  // ---------- sound recipes ----------
  function strike(o, time) {
    const dist = Math.random(); // 0 = overhead, 1 = far away
    setTimeout(() => A.onLightning && A.onLightning(1 - dist * 0.7), Math.max(0, (time - ctx.currentTime) * 1000));
    const rt = time + 0.25 + dist * 2.2; // sound arrives after the flash
    const f0 = 180 + (1 - dist) * 600;
    const lp = filt('lowpass', f0, 0.8), g = gain(0);
    lp.frequency.setValueAtTime(f0, rt);
    lp.frequency.exponentialRampToValueAtTime(80, rt + 7);
    const peak = 1.1 - dist * 0.5;
    let tt = rt + 0.1 + dist * 0.5;
    g.gain.setValueAtTime(0, rt);
    g.gain.linearRampToValueAtTime(peak, tt);
    for (let i = 0; i < 4; i++) { // rolling rumble
      tt += rnd(0.3, 0.9);
      g.gain.linearRampToValueAtTime(peak * rnd(0.35, 0.9) * (1 - i * 0.15), tt);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, tt + rnd(2.5, 5));
    chain(noise('brown', rt, tt + 6 - rt), lp, g, o);
    if (dist < 0.35) { // close strike: add a crack
      const cg = gain(0);
      chain(noise('white', rt - 0.02, 0.9), filt('highpass', 700), filt('lowpass', 5000), cg, o);
      cg.gain.setValueAtTime(0, rt - 0.02);
      cg.gain.linearRampToValueAtTime(0.45, rt);
      cg.gain.exponentialRampToValueAtTime(0.0001, rt + 0.7);
    }
  }

  function birdPhrase(o, t) {
    const base = rnd(2200, 4800), n = 2 + ((Math.random() * 6) | 0), kind = (Math.random() * 3) | 0;
    const pg = gain(rnd(0.13, 0.4));
    chain(pg, pan(rnd(-0.9, 0.9)), o);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const d = rnd(0.04, 0.12), osc = ctx.createOscillator(), g = gain(0);
      const from = kind === 0 ? base * 1.3 : kind === 1 ? base * 0.8 : base * rnd(0.9, 1.1);
      const to = kind === 0 ? base * 0.8 : kind === 1 ? base * 1.35 : base * rnd(1.1, 1.4);
      osc.frequency.setValueAtTime(from, tt);
      osc.frequency.exponentialRampToValueAtTime(to, tt + d);
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(1, tt + d * 0.25);
      g.gain.linearRampToValueAtTime(0, tt + d);
      chain(osc, g, pg);
      osc.start(tt); osc.stop(tt + d + 0.02);
      tt += d + rnd(0.02, 0.1);
    }
  }

  // Owl at night: soft falling "hoo"s in a great-horned-owl rhythm
  // (hoo … hoo-hoo … hoo … hoo), sometimes answered by a second owl.
  function hootPhrase(o, t, far = 1) {
    const f0 = rnd(330, 420) * (far < 1 ? 0.9 : 1);
    const pg = gain(rnd(0.2, 0.35) * far);
    chain(pg, filt('lowpass', 900), pan(rnd(-0.8, 0.8)), o);
    const pattern = Math.random() < 0.6 ? [0.45, 0.2, 0.2, 0.5, 0.55] : [0.55, 0.6];
    let tt = t;
    pattern.forEach((d, i) => {
      const f = f0 * rnd(0.97, 1.02), osc = ctx.createOscillator(), g = gain(0);
      osc.frequency.setValueAtTime(f * 1.05, tt);
      osc.frequency.exponentialRampToValueAtTime(f * 0.9, tt + d);
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(1, tt + d * 0.3);
      g.gain.linearRampToValueAtTime(0.7, tt + d * 0.7);
      g.gain.linearRampToValueAtTime(0, tt + d);
      chain(osc, g, pg);
      osc.start(tt); osc.stop(tt + d + 0.05);
      const breath = gain(0); // a little breathiness
      chain(noise('pink', tt, d + 0.05), filt('bandpass', f * 1.5, 2), breath, pg);
      breath.gain.setValueAtTime(0, tt);
      breath.gain.linearRampToValueAtTime(0.15, tt + d * 0.3);
      breath.gain.linearRampToValueAtTime(0, tt + d);
      tt += d + (i === 0 ? 0.35 : 0.15);
    });
    return tt - t;
  }

  // A short synthetic reverb (decaying stereo noise) so outdoor sounds sit in a space.
  let verbIR = null;
  function outdoorVerb() {
    if (!verbIR) {
      const sr = ctx.sampleRate, len = Math.floor(sr * 1.6);
      verbIR = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = verbIR.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
      }
    }
    const v = ctx.createConvolver();
    v.buffer = verbIR;
    return v;
  }

  // One field-cricket chirp: a few short pulses. Each pulse is a tone that the
  // cricket's scraper chops into rapid "tooth" clicks (the raspy texture), with a
  // soft swell and fade and a slight pitch drop — not a clean electronic beep.
  function chirp(t, b) {
    const n = b.pulses, span = n * (b.len + b.gap) + 0.05;
    const car = ctx.createOscillator(), over = ctx.createOscillator(), teeth = ctx.createOscillator();
    const overGain = gain(0.14), am = gain(1 - b.rasp), depth = gain(b.rasp), env = gain(0);
    teeth.type = 'triangle';
    teeth.frequency.value = b.tooth * rnd(0.97, 1.03);
    chain(teeth, depth); depth.connect(am.gain);
    chain(car, am); chain(over, overGain, am);
    chain(am, env, b.out);
    for (let k = 0; k < n; k++) {
      const s = t + k * (b.len + b.gap) + rnd(-0.002, 0.002);
      const f = b.f * rnd(0.995, 1.005), level = b.level * (k === 0 ? 0.8 : 1) * rnd(0.85, 1);
      car.frequency.setValueAtTime(f * 1.012, s);
      car.frequency.linearRampToValueAtTime(f * 0.985, s + b.len);
      over.frequency.setValueAtTime(f * 2.024, s);
      over.frequency.linearRampToValueAtTime(f * 1.97, s + b.len);
      env.gain.setValueAtTime(0, s);
      env.gain.setTargetAtTime(level, s, b.len * 0.18); // soft swell (no click)
      env.gain.setTargetAtTime(0, s + b.len * 0.6, b.len * 0.22);
    }
    [car, over, teeth].forEach((o) => { o.start(t); o.stop(t + span); });
  }

  const BUILD = {
    white: (o) => ({ srcs: [steady('white', o, 0.2)] }),
    pink: (o) => ({ srcs: [steady('pink', o, 0.45)] }),
    brown: (o) => ({ srcs: [steady('brown', o, 0.5)] }),

    rain(o) {
      const a = noise('pink'), b = noise('white'), drops = gain(1);
      chain(a, filt('highpass', 450), filt('lowpass', 8000), gain(0.5), o);
      chain(b, filt('bandpass', 3200, 0.5), gain(0.07), o);
      drops.connect(o);
      return {
        srcs: [a, b],
        tick: ticker((t) => {
          burst(drops, t, 'bandpass', rnd(1800, 6500), rnd(2, 7), rnd(0.03, 0.22), rnd(0.015, 0.05), rnd(-0.8, 0.8));
          return rnd(0.005, 0.06);
        }),
      };
    },

    thunder: (o) => ({ srcs: [], tick: ticker((t) => { strike(o, t); return rnd(14, 38); }) }),

    wind(o) {
      const s = noise('pink'), low = noise('brown'), bp = filt('bandpass', 520, 0.9), g = gain(0.55);
      // Slow, unrelated LFOs sweep the filter and level so gusts never line up.
      const lfos = [[0.05, 260, bp.frequency], [0.13, 120, bp.frequency], [0.07, 0.28, g.gain], [0.19, 0.1, g.gain]]
        .map(([f, depth, param]) => {
          const l = ctx.createOscillator(), lg = gain(depth);
          l.frequency.value = f * rnd(0.8, 1.2);
          l.connect(lg); lg.connect(param); l.start();
          return l;
        });
      chain(s, bp, g, o);
      chain(low, filt('lowpass', 160), gain(0.3), o);
      return { srcs: [s, low, ...lfos] };
    },

    waves(o) {
      const deep = noise('brown'), foam = noise('pink'), dg = gain(0.1), fg = gain(0.02);
      chain(deep, filt('lowpass', 700), dg, o);
      chain(foam, filt('highpass', 900), filt('lowpass', 7000), fg, o);
      return {
        srcs: [deep, foam],
        tick: ticker((t) => {
          const up = rnd(1.6, 2.8), pk = rnd(0.55, 0.95);
          dg.gain.setTargetAtTime(pk, t, up / 3);
          dg.gain.setTargetAtTime(0.12, t + up, rnd(1, 1.6));
          fg.gain.setTargetAtTime(pk * 0.3, t + up * 0.75, 0.35);
          fg.gain.setTargetAtTime(0.02, t + up + 0.4, rnd(0.9, 1.4));
          return rnd(5.5, 9.5);
        }),
      };
    },

    fire(o) {
      const roar = noise('brown'), hiss = noise('pink'), cr = gain(1);
      chain(roar, filt('lowpass', 380), gain(0.55), o);
      chain(hiss, filt('bandpass', 1400, 0.7), gain(0.035), o);
      cr.connect(o);
      return {
        srcs: [roar, hiss],
        tick: ticker((t) => {
          const big = Math.random() < 0.06;
          burst(cr, t, 'highpass', big ? rnd(600, 1200) : rnd(1500, 4500), 0.7,
            big ? rnd(0.5, 0.8) : rnd(0.08, 0.35), big ? rnd(0.03, 0.06) : rnd(0.004, 0.02), rnd(-0.5, 0.5));
          return Math.random() < 0.25 ? rnd(0.008, 0.04) : rnd(0.06, 0.4);
        }),
      };
    },

    cafe(o) {
      // Distant babble: sawtooth "voices" through moving vowel formants, muffled.
      const room = noise('brown'), air = noise('pink'), vb = gain(0.7), clinks = gain(1);
      chain(room, filt('lowpass', 250), gain(0.3), o);
      chain(air, filt('bandpass', 800, 0.6), gain(0.04), o);
      chain(vb, filt('lowpass', 2000), o);
      clinks.connect(o);
      const VOWELS = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [660, 1720], [490, 1350], [400, 1900]];
      const srcs = [room, air], voices = [];
      for (let i = 0; i < 7; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const v = { osc, f0: rnd(95, 230), f1: filt('bandpass', 500, 7), f2: filt('bandpass', 1500, 9), g: gain(0), dist: rnd(0.3, 1) };
        osc.frequency.value = v.f0;
        osc.connect(v.f1); osc.connect(v.f2); v.f1.connect(v.g); v.f2.connect(v.g);
        chain(v.g, pan(rnd(-0.9, 0.9)), vb);
        osc.start();
        srcs.push(osc);
        v.tick = ticker((t) => {
          if (Math.random() < 0.1) { v.g.gain.setTargetAtTime(0, t, 0.04); return rnd(0.5, 2.5); }
          const [a, b] = VOWELS[(Math.random() * VOWELS.length) | 0], dur = rnd(0.09, 0.26);
          v.f1.frequency.setTargetAtTime(a, t, 0.02);
          v.f2.frequency.setTargetAtTime(b, t, 0.02);
          v.osc.frequency.setTargetAtTime(v.f0 * rnd(0.85, 1.2), t, 0.04);
          v.g.gain.setTargetAtTime(rnd(0.25, 0.6) * v.dist, t, 0.02);
          v.g.gain.setTargetAtTime(0.04 * v.dist, t + dur * 0.75, 0.025);
          return dur;
        });
        voices.push(v);
      }
      const clink = ticker((t) => {
        const n = Math.random() < 0.3 ? 2 : 1;
        for (let k = 0; k < n; k++) ping(clinks, t + k * rnd(0.08, 0.2), rnd(2200, 4200), rnd(0.02, 0.06), rnd(-0.7, 0.7));
        return rnd(1.5, 7);
      });
      return { srcs, tick: (now, until) => { voices.forEach((v) => v.tick(now, until)); clink(now, until); } };
    },

    // Songbirds by day; owls at night (the app calls setNight with the scene lighting).
    birds: (o) => ({ srcs: [], tick: ticker((t) => {
      if (!night) { birdPhrase(o, t); return rnd(1.2, 6); }
      const len = hootPhrase(o, t);
      if (Math.random() < 0.3) hootPhrase(o, t + len + rnd(1.5, 3), 0.6); // an owl further off answers
      return len + rnd(6, 13);
    }) }),

    // A summer-night field: a couple of nearby field crickets, a muffled chorus of
    // distant ones, and a tree cricket trilling on and off, all in some night air.
    crickets(o) {
      const verb = outdoorVerb(), dry = gain(1), wet = gain(0.55);
      dry.connect(o); chain(verb, wet, o);
      const place = (near, p) => { // distance = quieter, duller, more reverb
        const out = gain(1), pn = pan(p), send = gain(near ? 0.25 : 0.9);
        chain(out, filt('lowpass', near ? 9000 : rnd(3200, 5200), 0.5), pn);
        pn.connect(dry); chain(pn, send, verb);
        return out;
      };
      const ticks = Array.from({ length: 7 }, (_, i) => {
        const near = i < 2;
        const b = {
          f: rnd(4300, 5100), len: rnd(0.014, 0.022), gap: rnd(0.028, 0.042), pulses: 3 + ((Math.random() * 2) | 0),
          tooth: rnd(260, 420), rasp: rnd(0.4, 0.6), period: rnd(0.42, 0.85),
          level: near ? rnd(0.42, 0.6) : rnd(0.12, 0.2), out: place(near, near ? rnd(-0.6, 0.6) : rnd(-0.95, 0.95)),
        };
        return ticker((t) => {
          if (Math.random() > 0.06) chirp(t, b);
          return b.period * rnd(0.9, 1.1) * (Math.random() < 0.04 ? rnd(2, 6) : 1); // now and then a pause
        });
      });

      // Tree cricket: a steady high trill (fast pulsing tone) that comes and goes.
      const trill = ctx.createOscillator(), pulse = ctx.createOscillator(), tg = gain(0), tam = gain(0.5), tdepth = gain(0.5);
      trill.frequency.value = rnd(2700, 3100);
      pulse.frequency.value = rnd(45, 60);
      chain(pulse, tdepth); tdepth.connect(tam.gain);
      chain(trill, tam, tg, place(false, rnd(-0.7, 0.7)));
      trill.start(); pulse.start();
      const trillTick = ticker((t) => {
        const on = rnd(3, 9);
        tg.gain.setTargetAtTime(rnd(0.05, 0.09), t, 0.6);
        tg.gain.setTargetAtTime(0, t + on, 0.8);
        return on + rnd(2, 7);
      });

      return { srcs: [trill, pulse], tick: (now, until) => { ticks.forEach((k) => k(now, until)); trillTick(now, until); } };
    },
  };

  // ---------- channels ----------
  function setGain(id) {
    const v = vols[id] || 0;
    channels[id].g.gain.setTargetAtTime(v * v, ctx.currentTime, 0.15); // squared = more natural slider feel
  }
  function startChannel(id) {
    const ch = channels[id];
    if (ch) { clearTimeout(ch.stopTimer); ch.stopTimer = null; setGain(id); return; }
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(out);
    channels[id] = { g, inst: BUILD[id](g), stopTimer: null };
    setGain(id);
  }
  function stopChannel(id) {
    const ch = channels[id];
    if (!ch || ch.stopTimer) return;
    ch.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    ch.stopTimer = setTimeout(() => {
      ch.inst.srcs.forEach((s) => { try { s.stop(); } catch (e) { /* already stopped */ } });
      ch.g.disconnect();
      delete channels[id];
    }, 800);
  }
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime, until = now + 1.5;
    for (const id in channels) {
      const ch = channels[id];
      if (ch.inst.tick && !ch.stopTimer) ch.inst.tick(now, until);
    }
  }
  const emit = () => A.onChange && A.onChange();

  // ---------- public API ----------
  A.ctx = ensureCtx;

  // Browsers only allow audio after a click/keypress; call this from one.
  A.unlock = function () {
    ensureCtx();
    if (unlocked) return;
    unlocked = true;
    for (const s of SOUNDS) if (vols[s.id] > 0) startChannel(s.id);
  };

  A.getVolume = (id) => vols[id] || 0;
  A.setNight = (v) => { night = !!v; };
  A.setVolume = function (id, v) {
    vols[id] = v;
    L.store.save('ambient', vols);
    if (!unlocked) A.unlock();
    if (v > 0) startChannel(id); else stopChannel(id);
    emit();
  };
  A.setMix = function (mix) { SOUNDS.forEach((s) => A.setVolume(s.id, mix[s.id] || 0)); };
  A.getMaster = () => master;
  A.setMaster = function (v) {
    master = v;
    L.store.save('ambientMaster', v);
    if (out) out.gain.setTargetAtTime(v * MAKEUP, ctx.currentTime, 0.1);
    emit();
  };
  A.activeCount = () => SOUNDS.filter((s) => vols[s.id] > 0).length;

  // Soft three-note bell for the end of a timer session.
  A.chime = function (vol, rising = true) {
    if (!(vol > 0)) return;
    const c = ensureCtx(), g = gain(0.22 * vol);
    g.connect(c.destination);
    const notes = rising ? [659.25, 783.99, 1046.5] : [1046.5, 783.99, 659.25];
    notes.forEach((f, i) => {
      const t = c.currentTime + 0.05 + i * 0.22;
      [[1, 1], [2.76, 0.25], [5.4, 0.08]].forEach(([m, a]) => {
        const o = c.createOscillator(), e = gain(0);
        o.frequency.value = f * m;
        chain(o, e, g);
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(a, t + 0.01);
        e.gain.exponentialRampToValueAtTime(0.0001, t + 2.2 / Math.pow(m, 0.3));
        o.start(t); o.stop(t + 2.5);
      });
    });
  };

  L.Ambient = A;
})();
