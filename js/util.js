'use strict';
/* Utilidades: RNG determinista, ruido, matemáticas y audio sintetizado (sin archivos externos). */
(function () {
  const G = (window.G = window.G || {});
  G.TS = 16; // tamaño de tile en px
  G.CS = 32; // tamaño de chunk en tiles

  G.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.hash2 = function (seed, x, y) {
    let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return h >>> 0;
  };
  G.rngFor = (seed, x, y, salt) => G.mulberry32(G.hash2((seed + Math.imul(salt | 0, 7919)) | 0, x, y));
  G.strHash = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };

  G.vnoise = function (seed, x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const r = (a, b) => G.hash2(seed, a, b) / 4294967296;
    const a = r(x0, y0), b = r(x0 + 1, y0), c = r(x0, y0 + 1), d = r(x0 + 1, y0 + 1);
    const top = a + (b - a) * u, bot = c + (d - c) * u;
    return top + (bot - top) * v;
  };
  G.fbm = function (seed, x, y, oct) {
    let amp = 1, f = 1, sum = 0, n = 0;
    for (let i = 0; i < (oct || 3); i++) {
      sum += amp * G.vnoise(seed + i * 1013, x * f, y * f);
      n += amp; amp *= 0.5; f *= 2;
    }
    return sum / n;
  };

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  G.ang = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  G.angDiff = function (a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.chance = (p) => Math.random() < p;
  G.pick = (arr, rng) => arr[Math.floor((rng ? rng() : Math.random()) * arr.length)];
  G.wpick = function (pairs, rng) {
    let tot = 0;
    for (const p of pairs) tot += p[1];
    let r = (rng ? rng() : Math.random()) * tot;
    for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  };
  G.fdiv = (a, b) => Math.floor(a / b);
  G.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  G.fmtTime = function (s) {
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (s % 60) + 's';
  };

  /* ---------- Audio (WebAudio sintetizado) ---------- */
  G.audio = { ctx: null, on: true, last: {} };
  const SFX = {
    hit: ['square', 220, 90, 0.08, 0.05], hurt: ['sawtooth', 170, 50, 0.2, 0.08], swing: ['triangle', 320, 130, 0.07, 0.035],
    shoot: ['square', 520, 220, 0.1, 0.035], pickup: ['square', 600, 1100, 0.09, 0.04], coin: ['square', 900, 1400, 0.06, 0.03],
    boom: ['sawtooth', 130, 30, 0.35, 0.09], magic: ['sine', 380, 900, 0.22, 0.06], boss: ['sawtooth', 90, 40, 0.7, 0.1],
    win: ['square', 400, 1200, 0.55, 0.06], ui: ['square', 500, 540, 0.04, 0.03], dodge: ['triangle', 200, 500, 0.12, 0.04],
    heal: ['sine', 500, 1000, 0.3, 0.06], save: ['triangle', 440, 880, 0.4, 0.07], chest: ['square', 300, 700, 0.2, 0.05],
  };
  G.sfx = function (name) {
    if (!G.audio.on) return;
    try {
      const now = Date.now();
      if (G.audio.last[name] && now - G.audio.last[name] < 45) return;
      G.audio.last[name] = now;
      const cfg = SFX[name];
      if (!cfg) return;
      if (!G.audio.ctx) G.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = G.audio.ctx;
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = cfg[0];
      o.frequency.setValueAtTime(cfg[1], t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, cfg[2]), t + cfg[3]);
      g.gain.setValueAtTime(cfg[4], t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + cfg[3]);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + cfg[3] + 0.02);
    } catch (e) { /* audio no disponible */ }
  };
})();
