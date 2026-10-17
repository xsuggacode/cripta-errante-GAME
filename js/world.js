'use strict';
/* Generación procedural infinita por chunks (32x32 tiles). Determinista por semilla.
   Cada chunk es de un tipo: wild, camp, ruins, grove, altar, spring, dungeon, arena. Las cuevas son un campo de ruido continuo. */
(function () {
  const G = window.G, T = G.T, O = G.O, CS = G.CS, TS = G.TS;
  const NN = CS * CS;

  /* ---------- Funciones puras de campo ---------- */
  G.biomeAt = function (seed, tx, ty) {
    const m = G.fbm(seed + 2, tx / 60, ty / 60, 3);
    const d = Math.hypot(tx - 16, ty - 16);
    if (d < 46) return m > 0.55 ? 'forest' : 'grass';
    const t = G.fbm(seed + 1, tx / 80, ty / 80, 3);
    if (t < 0.39) return 'snow';
    if (t > 0.615) return m < 0.5 ? 'desert' : 'volcanic';
    if (m > 0.6) return 'swamp';
    if (m > 0.49) return 'forest';
    return 'grass';
  };
  G.caveMask = (seed, tx, ty) => G.fbm(seed + 9, tx / 34, ty / 34, 3);
  G.tierAt = function (cx, cy) { return 1 + Math.floor(Math.hypot(cx, cy) / 5); };

  const roll = (seed, cx, cy) => G.hash2(seed + 5, cx, cy) / 4294967296;
  function heavyKind(seed, cx, cy) {
    if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) return null;
    const r = roll(seed, cx, cy);
    if (r < 0.05 && Math.hypot(cx, cy) >= 3) return 'arena';
    if (r < 0.125) return 'dungeon';
    return null;
  }
  G.chunkKind = function (seed, cx, cy) {
    if (cx === 0 && cy === 0) return 'camp';
    let h = heavyKind(seed, cx, cy);
    if (h) {
      const me = roll(seed, cx, cy);
      for (let dy = -1; dy <= 1 && h; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (heavyKind(seed, cx + dx, cy + dy) && roll(seed, cx + dx, cy + dy) < me) { h = null; break; }
      }
      if (h) return h;
    }
    if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) return 'wild';
    const r = G.hash2(seed + 6, cx, cy) / 4294967296;
    if (r < 0.13) return 'camp';
    if (r < 0.22) return 'ruins';
    if (r < 0.27) return 'grove';
    if (r < 0.31) return 'altar';
    if (r < 0.35) return 'spring';
    return 'wild';
  };

  /* ---------- Nivel (mundo en ejecución) ---------- */
  function Level(ws) {
    this.ws = ws;
    this.seed = ws.seed;
    this.chunks = new Map();
    this.pending = [];
  }
  G.Level = Level;
  const P = Level.prototype;

  P.key = (cx, cy) => cx + ',' + cy;
  P.chunk = function (cx, cy) {
    if (cx === this.lcx && cy === this.lcy && this.lch) return this.lch;
    const k = cx + ',' + cy;
    let c = this.chunks.get(k);
    if (!c) { c = this.gen(cx, cy); this.chunks.set(k, c); }
    this.lcx = cx; this.lcy = cy; this.lch = c;
    return c;
  };
  P.trim = function (pcx, pcy, keep) {
    if (this.chunks.size < 70) return;
    for (const [k, c] of this.chunks) if (Math.abs(c.cx - pcx) > keep || Math.abs(c.cy - pcy) > keep) this.chunks.delete(k);
    this.lch = null;
  };
  P.t = function (tx, ty) { const c = this.chunk(G.fdiv(tx, CS), G.fdiv(ty, CS)); return c.t[(ty - c.cy * CS) * CS + (tx - c.cx * CS)]; };
  P.o = function (tx, ty) { const c = this.chunk(G.fdiv(tx, CS), G.fdiv(ty, CS)); return c.o[(ty - c.cy * CS) * CS + (tx - c.cx * CS)]; };
  P.v = function (tx, ty) { const c = this.chunk(G.fdiv(tx, CS), G.fdiv(ty, CS)); return c.v[(ty - c.cy * CS) * CS + (tx - c.cx * CS)]; };
  P.set = function (tx, ty, t, o, persist) {
    const cx = G.fdiv(tx, CS), cy = G.fdiv(ty, CS), c = this.chunk(cx, cy);
    const i = (ty - cy * CS) * CS + (tx - cx * CS);
    if (t != null) c.t[i] = t;
    if (o != null) c.o[i] = o;
    if (persist) {
      const ck = cx + ',' + cy;
      const m = (this.ws.mods[ck] = this.ws.mods[ck] || {});
      m[tx - cx * CS + ',' + (ty - cy * CS)] = [c.t[i], c.o[i]];
    }
  };
  P.blocked = function (tx, ty, fly) {
    const t = this.t(tx, ty), o = this.o(tx, ty);
    if (G.SOLID_T[t] || G.SOLID_O[o]) return true;
    if (!fly && t === T.WATER) return true;
    return false;
  };
  P.solidPx = function (px, py, fly) { return this.blocked(Math.floor(px / TS), Math.floor(py / TS), fly); };
  P.metaAt = function (tx, ty) { return this.ws.meta[tx + ',' + ty] || (this.chunk(G.fdiv(tx, CS), G.fdiv(ty, CS)).meta[tx + ',' + ty]); };
  P.biomeOf = function (tx, ty) { return G.biomeAt(this.seed, tx, ty); };
  P.freeTile = function (tx, ty) {
    const t = this.t(tx, ty);
    return !this.blocked(tx, ty) && t !== T.LAVA && t !== T.SPIKE && t !== T.DOOR;
  };

  /* ---------- Generación de chunk ---------- */
  P.gen = function (cx, cy) {
    const seed = this.seed, rng = G.rngFor(seed, cx, cy, 1);
    const ch = { cx, cy, t: new Uint8Array(NN), o: new Uint8Array(NN), v: new Uint8Array(NN), kind: G.chunkKind(seed, cx, cy), ents: [], pois: [], meta: {}, lights: [], tier: G.tierAt(cx, cy), keep: [] };
    const x0 = cx * CS, y0 = cy * CS;
    const midBiome = G.biomeAt(seed, x0 + 16, y0 + 16);
    ch.biome = midBiome;

    // terreno base
    for (let ly = 0; ly < CS; ly++) for (let lx = 0; lx < CS; lx++) {
      const tx = x0 + lx, ty = y0 + ly, i = ly * CS + lx;
      const bk = G.biomeAt(seed, tx, ty), B = G.BIOMES[bk];
      const h = G.hash2(seed, tx, ty);
      const r100 = h % 100;
      ch.v[i] = (h >>> 8) & 3;
      let t = B.ground, o = 0;
      const dOrig = Math.hypot(tx - 16, ty - 16);
      const w = G.fbm(seed + 3, tx / 20, ty / 20, 3);
      const wth = bk === 'desert' ? 0.72 : bk === 'swamp' ? 0.6 : 0.64;
      if (dOrig > 14 && w > wth) {
        t = bk === 'volcanic' ? T.LAVA : bk === 'snow' ? T.ICE : T.WATER;
        if (bk === 'volcanic' && w < wth + 0.015) t = B.ground;
      } else {
        const d = G.fbm(seed + 4, tx / 11, ty / 11, 2);
        if (dOrig > 9) {
          switch (bk) {
            case 'grass': if (d > 0.56 && r100 < 26) o = O.TREE; else if (r100 < 2) o = O.ROCK; else if (r100 < 8) o = O.FLOWER; else if (r100 < 14) o = O.TALL; break;
            case 'forest': if (d > 0.44 && r100 < 42) o = O.TREE; else if (r100 < 2) o = O.ROCK; else if (r100 < 6) o = O.FLOWER; else if (r100 < 11) o = O.TALL; break;
            case 'desert': if (r100 < 2) o = O.CACTUS; else if (r100 < 3) o = O.ROCK; else if (r100 < 4 && d > 0.55) o = O.DEAD; else if (r100 < 5) o = O.BONES; break;
            case 'snow': if (d > 0.5 && r100 < 22) o = O.PINE; else if (r100 < 2) o = O.ROCK; break;
            case 'swamp': if (d > 0.52 && r100 < 16) o = O.DEAD; else if (r100 < 4) o = O.MUSH; else if (r100 < 11) o = O.TALL; else if (r100 < 12) o = O.ROCK; break;
            case 'volcanic': if (r100 < 3) o = O.ROCK; else if (r100 < 5 && d > 0.5) o = O.DEAD; break;
          }
        }
      }
      // cuevas (campo de ruido continuo y sin costuras)
      if (dOrig > 52) {
        const cm = G.caveMask(seed, tx, ty);
        if (cm > 0.6) {
          const wn = G.fbm(seed + 10, tx / 5.5, ty / 5.5, 2);
          if (wn > 0.585) { t = T.CWALL; o = 0; }
          else if (w > 0.7) { t = T.WATER; o = 0; }
          else { t = T.CFLOOR; o = (cm > 0.64 && r100 < 5) ? O.MUSH : (r100 < 1 ? O.ROCK : 0); }
        } else if (cm > 0.575 && o === O.TREE) o = O.ROCK;
      }
      ch.t[i] = t; ch.o[i] = o;
    }

    const S = { ch, rng, x0, y0, L: this };
    switch (ch.kind) {
      case 'camp': genCamp(S); break;
      case 'ruins': genRuins(S); break;
      case 'grove': genGrove(S); break;
      case 'altar': genAltar(S); break;
      case 'spring': genSpring(S); break;
      case 'dungeon': genDungeon(S); break;
      case 'arena': genArena(S); break;
    }
    if (ch.kind !== 'dungeon' && ch.kind !== 'arena') genWild(S);

    // aplicar modificaciones persistentes (cofres abiertos, paredes rotas...)
    const mods = this.ws.mods[cx + ',' + cy];
    if (mods) for (const k in mods) {
      const [lx, ly] = k.split(',').map(Number);
      ch.t[ly * CS + lx] = mods[k][0]; ch.o[ly * CS + lx] = mods[k][1];
    }
    // luces
    for (let i = 0; i < NN; i++) if (ch.t[i] === T.TORCH || ch.o[i] === O.FIRE || ch.o[i] === O.SHRINEON) ch.lights.push([x0 + (i % CS), y0 + ((i / CS) | 0)]);
    return ch;
  };

  /* ---------- Utilidades de generación ---------- */
  const idx = (x, y) => y * CS + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < CS && y < CS;
  function setT(ch, x, y, t, o) { if (!inb(x, y)) return; ch.t[idx(x, y)] = t; if (o != null) ch.o[idx(x, y)] = o; }
  function setO(ch, x, y, o) { if (inb(x, y)) ch.o[idx(x, y)] = o; }
  function fillR(ch, x, y, w, h, t, o) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setT(ch, x + i, y + j, t, o == null ? 0 : o); }
  function clearDisc(S, cx, cy, r, ground) {
    const ch = S.ch;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!inb(x, y) || Math.hypot(x - cx, y - cy) > r + 0.3) continue;
      const i = idx(x, y);
      if (ch.t[i] === T.WATER || ch.t[i] === T.LAVA || ch.t[i] === T.ICE || ch.t[i] === T.CWALL || ch.t[i] === T.CFLOOR) ch.t[i] = ground;
      ch.o[i] = 0;
      ch.keep[i] = 1;
    }
  }
  const groundOf = (ch) => G.BIOMES[ch.biome].ground;
  function freeSpot(S, tries, ax, ay, rad) {
    const { ch, rng } = S;
    for (let k = 0; k < tries; k++) {
      let x, y;
      if (ax != null) { const a = rng() * 6.283, d = rng() * rad; x = Math.round(ax + Math.cos(a) * d); y = Math.round(ay + Math.sin(a) * d); }
      else { x = 1 + Math.floor(rng() * (CS - 2)); y = 1 + Math.floor(rng() * (CS - 2)); }
      if (!inb(x, y)) continue;
      const i = idx(x, y), t = ch.t[i];
      if (ch.o[i] || ch.keep[i] === 2 || G.SOLID_T[t] || t === T.WATER || t === T.LAVA || t === T.SPIKE || t === T.DOOR || t === T.ICE && false) continue;
      return [x, y];
    }
    return null;
  }
  let entN = 0;
  function pushEnemy(S, type, x, y, opts) {
    const ch = S.ch;
    ch.ents.push(Object.assign({ id: ch.cx + ',' + ch.cy + '#' + (entN++ % 10000) + ':' + ch.ents.length, k: 'enemy', type, tx: x, ty: y }, opts || {}));
  }
  function enemyPool(ch, where) {
    if (where === 'dungeon') return G.DUNGEON_ENEMIES;
    return G.BIOMES[ch.biome].enemies;
  }
  function addGroup(S, n, pool, ax, ay, rad, opts) {
    const { ch, rng } = S;
    const dist = Math.hypot(ch.cx, ch.cy);
    for (let i = 0; i < n; i++) {
      const p = freeSpot(S, 12, ax, ay, rad);
      if (!p) continue;
      const type = G.pick(pool, rng);
      const o = Object.assign({}, opts);
      if (!o.noElite && dist > 1.5 && rng() < Math.min(0.28, 0.05 + dist * 0.012)) o.elite = G.pick(Object.keys(G.ELITE_MODS), rng);
      pushEnemy(S, type, p[0], p[1], o);
    }
  }
  function chest(S, x, y, o) {
    const { ch, rng, x0, y0 } = S;
    setO(ch, x, y, O.CHEST);
    ch.meta[(x0 + x) + ',' + (y0 + y)] = Object.assign({ q: 0, mimic: rng() < 0.06 }, o);
  }

  /* ---------- Contenido salvaje (enemigos, cofres, zonas especiales) ---------- */
  function genWild(S) {
    const { ch, rng } = S;
    const safe = ch.kind === 'camp';
    const near = Math.abs(ch.cx) <= 1 && Math.abs(ch.cy) <= 1;
    const dist = Math.hypot(ch.cx, ch.cy);
    const pool = G.BIOMES[ch.biome].enemies;
    // ¿es una cueva dominante?
    const cm = G.caveMask(S.L.seed, S.x0 + 16, S.y0 + 16);
    const isCave = cm > 0.6 && dist > 1.6;
    const epool = isCave ? G.CAVE_ENEMIES : pool;
    if (!safe) {
      const groups = near ? 1 : 2 + (rng() < 0.5 ? 1 : 0);
      for (let g = 0; g < groups; g++) {
        const sp = freeSpot(S, 20);
        if (!sp) continue;
        if (near && Math.hypot(sp[0] - 16, sp[1] - 16) < 10) continue;
        addGroup(S, near ? 2 : 2 + Math.floor(rng() * 3), epool, sp[0], sp[1], 6, {});
      }
    }
    // zonas especiales en terreno salvaje
    if (!near && ch.kind === 'wild') {
      const r = rng();
      const sp = freeSpot(S, 30);
      if (sp && r < 0.14) { // campamento de bandidos
        clearDisc(S, sp[0], sp[1], 3, groundOf(ch));
        setO(ch, sp[0], sp[1], O.FIRE); ch.keep[idx(sp[0], sp[1])] = 2;
        [[-3, -1], [3, 1], [-1, 3]].forEach((d) => setO(ch, sp[0] + d[0], sp[1] + d[1], O.ROCK));
        const c = freeSpot(S, 20, sp[0], sp[1], 3);
        if (c) chest(S, c[0], c[1], { q: 1 });
        addGroup(S, 3 + Math.floor(rng() * 2), ['goblin', 'goblin', 'wolf'], sp[0], sp[1], 4, {});
        if (rng() < 0.5) { const q = freeSpot(S, 10, sp[0], sp[1], 4); if (q) pushEnemy(S, 'thief', q[0], q[1], {}); }
        ch.pois.push({ k: 'special', n: 'Campamento' });
      } else if (sp && r < 0.26) { // cementerio
        clearDisc(S, sp[0], sp[1], 4, groundOf(ch));
        for (let i = 0; i < 7; i++) { const b = freeSpot(S, 10, sp[0], sp[1], 4); if (b) setO(ch, b[0], b[1], i % 3 ? O.BONES : O.ROCK); }
        const c = freeSpot(S, 20, sp[0], sp[1], 3);
        if (c) chest(S, c[0], c[1], { q: 1 });
        addGroup(S, 4, ['skeleton', 'ghost', 'skeleton'], sp[0], sp[1], 4, {});
        ch.pois.push({ k: 'special', n: 'Cementerio' });
      } else if (sp && r < 0.33) { // nido de arañas
        clearDisc(S, sp[0], sp[1], 3, groundOf(ch));
        const c = freeSpot(S, 20, sp[0], sp[1], 2);
        if (c) chest(S, c[0], c[1], { q: 1 });
        addGroup(S, 5, ['spider'], sp[0], sp[1], 4, {});
        ch.pois.push({ k: 'special', n: 'Nido' });
      } else if (sp && r < 0.5) { // cofre escondido
        chest(S, sp[0], sp[1], { q: rng() < 0.2 ? 2 : 0 });
        ch.keep[idx(sp[0], sp[1])] = 2;
      }
    }
  }

  /* ---------- Campamento: guardado, mercader y fogata ---------- */
  function genCamp(S) {
    const { ch, rng } = S;
    const g = groundOf(ch);
    clearDisc(S, 16, 16, 7, g);
    for (let a = 0; a < 12; a++) { const x = 16 + Math.round(Math.cos(a / 12 * 6.283) * 7), y = 16 + Math.round(Math.sin(a / 12 * 6.283) * 7); if (a % 3 === 0) setO(ch, x, y, O.ROCK); else if (a % 3 === 1) setO(ch, x, y, O.FLOWER); }
    setO(ch, 16, 16, O.FIRE);
    setO(ch, 19, 15, O.SHRINE);
    ch.pois.push({ k: 'camp', n: 'Campamento', tx: S.x0 + 19, ty: S.y0 + 15 });
    ch.ents.push({ id: 'npc:' + ch.cx + ',' + ch.cy + ':m', k: 'npc', npc: 'merchant', tx: 13, ty: 17 });
    if (ch.cx === 0 && ch.cy === 0) ch.ents.push({ id: 'npc:0,0:sage', k: 'npc', npc: 'sage', tx: 16, ty: 13 });
    for (let i = 0; i < 3; i++) { const p = freeSpot(S, 10, 16, 16, 6); if (p && Math.hypot(p[0] - 16, p[1] - 16) > 3) setO(ch, p[0], p[1], O.FLOWER); }
    if (ch.cx === 0 && ch.cy === 0) {
      chest(S, 14, 13, { q: 0, cons: 'hp1', n: 2, tut: true });
    }
  }

  /* ---------- Ruinas con sala secreta ---------- */
  function genRuins(S) {
    const { ch, rng } = S;
    const bx = 8 + Math.floor(rng() * 6), by = 9 + Math.floor(rng() * 6), w = 12, h = 9;
    const g = groundOf(ch);
    clearDisc(S, bx + 6, by + 4, 9, g);
    fillR(ch, bx, by, w, h, T.RWALL); fillR(ch, bx + 1, by + 1, w - 2, h - 2, T.RFLOOR);
    // brechas en las paredes (ruinas)
    const gaps = [[bx + 5, by], [bx + 6, by], [bx, by + 4], [bx + w - 1, by + 4], [bx + 6, by + h - 1], [bx + 5, by + h - 1]];
    gaps.forEach((p) => setT(ch, p[0], p[1], T.RFLOOR, 0));
    for (let i = 0; i < 6; i++) { const x = bx + (rng() * w | 0), y = by + (rng() * h | 0); if (ch.t[idx(x, y)] === T.RWALL && rng() < 0.6) setT(ch, x, y, T.RFLOOR, 0); }
    [[bx + 2, by + 2], [bx + w - 3, by + 2], [bx + 2, by + h - 3], [bx + w - 3, by + h - 3]].forEach((p) => setO(ch, p[0], p[1], O.PILLAR));
    chest(S, bx + 6, by + 3, { q: 1 });
    // sala secreta: cuarto 3x3 sellado con pared agrietada, detrás hay 2 cofres
    const side = rng() < 0.5 ? 'e' : 'w';
    const sy = by + 3;
    if (side === 'e') { const sx = bx + w + 1; fillR(ch, sx - 1, sy - 1, 5, 5, T.RWALL); fillR(ch, sx, sy, 3, 3, T.RFLOOR); setT(ch, bx + w - 1, sy + 1, T.CRACK, 0); setT(ch, bx + w, sy + 1, T.CRACK, 0); chest(S, sx + 1, sy, { q: 2 }); chest(S, sx + 1, sy + 2, { q: 1 }); }
    else { const sx = bx - 4; fillR(ch, sx - 1, sy - 1, 5, 5, T.RWALL); fillR(ch, sx, sy, 3, 3, T.RFLOOR); setT(ch, bx, sy + 1, T.CRACK, 0); setT(ch, bx - 1, sy + 1, T.CRACK, 0); chest(S, sx + 1, sy, { q: 2 }); chest(S, sx + 1, sy + 2, { q: 1 }); }
    ch.pois.push({ k: 'special', n: 'Ruinas' });
    addGroup(S, 3 + Math.floor(rng() * 2), ['skeleton', 'ghost', 'cultist'], bx + 6, by + 4, 3, {});
    for (let i = 0; i < 3; i++) { const p = freeSpot(S, 6, bx + 6, by + 4, 3); if (p) setO(ch, p[0], p[1], O.BONES); }
  }

  /* ---------- Arboleda oculta ---------- */
  function genGrove(S) {
    const { ch, rng } = S;
    const g = groundOf(ch), tree = ch.biome === 'snow' ? O.PINE : ch.biome === 'desert' ? O.CACTUS : (ch.biome === 'swamp' || ch.biome === 'volcanic') ? O.DEAD : O.TREE;
    const cx = 16, cy = 16, R = 8, gap = Math.floor(rng() * 4);
    clearDisc(S, cx, cy, R + 1, g);
    for (let a = 0; a < 48; a++) {
      const an = a / 48 * 6.283; if (Math.floor(a / 12) === gap) continue;
      const x = Math.round(cx + Math.cos(an) * R), y = Math.round(cy + Math.sin(an) * R);
      setO(ch, x, y, tree); setO(ch, Math.round(cx + Math.cos(an) * (R + 1)), Math.round(cy + Math.sin(an) * (R + 1)), tree);
    }
    chest(S, cx, cy, { q: 2 });
    for (let i = 0; i < 8; i++) { const p = freeSpot(S, 6, cx, cy, 6); if (p) setO(ch, p[0], p[1], O.FLOWER); }
    addGroup(S, 4, G.BIOMES[ch.biome].enemies, cx, cy, 5, { noElite: false });
    ch.pois.push({ k: 'special', n: 'Arboleda' });
  }

  /* ---------- Altar maldito ---------- */
  function genAltar(S) {
    const { ch } = S, g = groundOf(ch);
    clearDisc(S, 16, 16, 6, g);
    setO(ch, 16, 16, O.ALTAR);
    [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach((d) => setO(ch, 16 + d[0], 16 + d[1], O.PILLAR));
    for (let a = 0; a < 8; a++) setO(ch, 16 + Math.round(Math.cos(a / 8 * 6.283) * 5), 16 + Math.round(Math.sin(a / 8 * 6.283) * 5), a % 2 ? O.BONES : 0);
    ch.pois.push({ k: 'altar', n: 'Altar', tx: S.x0 + 16, ty: S.y0 + 16 });
  }

  /* ---------- Manantial curativo ---------- */
  function genSpring(S) {
    const { ch } = S, g = groundOf(ch);
    clearDisc(S, 16, 16, 6, g);
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.hypot(x, y) <= 2.2) setT(ch, 16 + x, 16 + y, T.WATER, 0);
    for (let a = 0; a < 14; a++) { const an = a / 14 * 6.283; setO(ch, 16 + Math.round(Math.cos(an) * 4), 16 + Math.round(Math.sin(an) * 4), O.FLOWER); }
    ch.pois.push({ k: 'spring', n: 'Manantial', tx: S.x0 + 16, ty: S.y0 + 16 });
  }

  /* ---------- Mazmorra: 3x3 salas, corredores, secretos, trampas y bóveda ---------- */
  function genDungeon(S) {
    const { ch, rng } = S;
    ch.t.fill(T.DWALL); ch.o.fill(0);
    const rooms = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const rw = 5 + Math.floor(rng() * 4), rh = 5 + Math.floor(rng() * 4);
      const rx = 1 + i * 10 + 1 + Math.floor(rng() * (10 - rw - 1)), ry = 1 + j * 10 + 1 + Math.floor(rng() * (10 - rh - 1));
      const r = { i, j, x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) };
      rooms.push(r);
      fillR(ch, rx, ry, rw, rh, T.DFLOOR);
    }
    const R = (i, j) => rooms[j * 3 + i];
    const carve = (a, b) => {
      let x = a.cx, y = a.cy;
      const sx = b.cx > x ? 1 : -1, sy = b.cy > y ? 1 : -1;
      while (x !== b.cx) { setT(ch, x, y, T.DFLOOR, 0); x += sx; }
      while (y !== b.cy) { setT(ch, x, y, T.DFLOOR, 0); y += sy; }
      setT(ch, x, y, T.DFLOOR, 0);
    };
    // árbol de expansión aleatorio sobre las 8 salas exteriores (+ conexiones extra); la bóveda central cuelga como hoja
    const isV = (i, j) => i === 1 && j === 1;
    const seen = new Set(['1,0']), edges = [], front = [[1, 0]];
    while (seen.size < 8) {
      const [ci, cj] = front[Math.floor(rng() * front.length)];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map((d) => [ci + d[0], cj + d[1]]).filter((p) => p[0] >= 0 && p[1] >= 0 && p[0] < 3 && p[1] < 3 && !isV(p[0], p[1]) && !seen.has(p[0] + ',' + p[1]));
      if (!nb.length) { front.splice(front.findIndex((f) => f[0] === ci && f[1] === cj), 1); if (!front.length) break; continue; }
      const n = G.pick(nb, rng); seen.add(n[0] + ',' + n[1]); front.push(n); edges.push([[ci, cj], n]);
    }
    for (let e = 0; e < 3; e++) { const i = Math.floor(rng() * 3), j = Math.floor(rng() * 3); const d = rng() < 0.5 ? [1, 0] : [0, 1]; if (i + d[0] < 3 && j + d[1] < 3 && !isV(i, j) && !isV(i + d[0], j + d[1])) edges.push([[i, j], [i + d[0], j + d[1]]]); }
    const vlinks = [[1, 0], [0, 1], [2, 1], [1, 2]].sort(() => rng() - 0.5).slice(0, 1 + (rng() < 0.4 ? 1 : 0));
    vlinks.forEach((v) => edges.push([v, [1, 1]]));
    edges.forEach((e) => carve(R(e[0][0], e[0][1]), R(e[1][0], e[1][1])));
    // entradas en los cuatro lados
    const doorTo = (rm, dir) => {
      if (dir === 'n') { for (let y = 0; y <= rm.cy; y++) { setT(ch, 15, y, T.DFLOOR, 0); setT(ch, 16, y, T.DFLOOR, 0); } setT(ch, 15, 0, T.DOOR, 0); setT(ch, 16, 0, T.DOOR, 0); }
      if (dir === 's') { for (let y = rm.cy; y < CS; y++) { setT(ch, 15, y, T.DFLOOR, 0); setT(ch, 16, y, T.DFLOOR, 0); } setT(ch, 15, 31, T.DOOR, 0); setT(ch, 16, 31, T.DOOR, 0); }
      if (dir === 'w') { for (let x = 0; x <= rm.cx; x++) { setT(ch, x, 15, T.DFLOOR, 0); setT(ch, x, 16, T.DFLOOR, 0); } setT(ch, 0, 15, T.DOOR, 0); setT(ch, 0, 16, T.DOOR, 0); }
      if (dir === 'e') { for (let x = rm.cx; x < CS; x++) { setT(ch, x, 15, T.DFLOOR, 0); setT(ch, x, 16, T.DFLOOR, 0); } setT(ch, 31, 15, T.DOOR, 0); setT(ch, 31, 16, T.DOOR, 0); }
    };
    doorTo(R(1, 0), 'n'); doorTo(R(1, 2), 's'); doorTo(R(0, 1), 'w'); doorTo(R(2, 1), 'e');
    const vault = R(1, 1);
    // sellar la bóveda con paredes agrietadas (hay que usar bombas)
    let sealed = false;
    if (rng() < 0.65) {
      sealed = true;
      for (let x = vault.x - 1; x <= vault.x + vault.w; x++) for (let y = vault.y - 1; y <= vault.y + vault.h; y++) {
        const edge = x === vault.x - 1 || y === vault.y - 1 || x === vault.x + vault.w || y === vault.y + vault.h;
        if (edge && ch.t[idx(x, y)] === T.DFLOOR) setT(ch, x, y, T.CRACK, 0);
      }
    }
    // decoración y contenido de salas
    const order = rooms.map((r, n) => n).sort((a, b) => Math.abs(rooms[a].i - 1) + Math.abs(rooms[a].j - 1) - (Math.abs(rooms[b].i - 1) + Math.abs(rooms[b].j - 1)));
    let bombChest = sealed, chestCount = 0;
    rooms.forEach((rm) => {
      const isVault = rm === vault;
      // antorchas
      [rm.x + 1, rm.x + rm.w - 2].forEach((x) => { if (ch.t[idx(x, rm.y - 1)] === T.DWALL && rng() < 0.8) { setT(ch, x, rm.y - 1, T.TORCH, 0); } });
      if (rm.w >= 7 && rm.h >= 7) [[rm.x + 1, rm.y + 1], [rm.x + rm.w - 2, rm.y + 1], [rm.x + 1, rm.y + rm.h - 2], [rm.x + rm.w - 2, rm.y + rm.h - 2]].forEach((p) => setO(ch, p[0], p[1], O.PILLAR));
      if (!isVault && rng() < 0.3) { const sx = rm.x + 1 + Math.floor(rng() * (rm.w - 3)), sy = rm.y + 1 + Math.floor(rng() * (rm.h - 3)); for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (ch.t[idx(sx + a, sy + b)] === T.DFLOOR && !ch.o[idx(sx + a, sy + b)] && !(sx + a === rm.cx && sy + b === rm.cy)) setT(ch, sx + a, sy + b, T.SPIKE, 0); }
      if (rng() < 0.4) { const p = freeSpot(S, 6, rm.cx, rm.cy, 2); if (p) setO(ch, p[0], p[1], O.BONES); }
      if (isVault) {
        setO(ch, vault.cx, vault.cy, 0);
        [[0, 0], [1, 0], [0, 1]].forEach((d, n) => { const x = vault.x + 1 + d[0] * (vault.w - 3), y = vault.y + 1 + d[1] * (vault.h - 3); if (n < 2) chest(S, x, y, { q: n === 0 ? 3 : 2, mimic: rng() < 0.12 }); });
        pushEnemy(S, G.pick(G.DUNGEON_ENEMIES, rng), vault.cx, vault.cy, { elite: G.pick(Object.keys(G.ELITE_MODS), rng), guard: true });
        pushEnemy(S, G.pick(G.DUNGEON_ENEMIES, rng), vault.cx + 1, vault.cy + 1, { elite: G.pick(Object.keys(G.ELITE_MODS), rng), guard: true });
      } else {
        const n = 2 + Math.floor(rng() * 3);
        const isEntryish = rm.i === 1 && rm.j === 0;
        for (let k = 0; k < n; k++) { const p = freeSpot(S, 12, rm.cx, rm.cy, Math.max(rm.w, rm.h) / 2 - 0.5); if (p && !(isEntryish && Math.hypot(p[0] - 16, p[1] - 1) < 4)) { if (G.chance(0.04)) pushEnemy(S, 'thief', p[0], p[1], {}); else addGroup(S, 1, G.DUNGEON_ENEMIES, p[0], p[1], 0, {}); } }
        if (rng() < 0.4 || (bombChest && rm !== vault && order.indexOf(rooms.indexOf(rm)) === 1)) {
          const p = freeSpot(S, 12, rm.cx, rm.cy, Math.max(rm.w, rm.h) / 2 - 1);
          if (p) { if (bombChest && (order.indexOf(rooms.indexOf(rm)) === 1)) { chest(S, p[0], p[1], { q: 0, cons: 'bomb', n: 3, mimic: false }); bombChest = false; } else chest(S, p[0], p[1], { q: rng() < 0.3 ? 2 : 1 }); chestCount++; }
        }
      }
    });
    // salas secretas pequeñas selladas con pared agrietada
    for (let n = 0, made = 0; n < 24 && made < 2; n++) {
      const rm = G.pick(rooms, rng), side = Math.floor(rng() * 4);
      let sx, sy, bx, by;
      if (side === 0) { sx = rm.x + rm.w + 1; sy = rm.cy - 1; bx = rm.x + rm.w; by = rm.cy; }
      else if (side === 1) { sx = rm.x - 4; sy = rm.cy - 1; bx = rm.x - 1; by = rm.cy; }
      else if (side === 2) { sx = rm.cx - 1; sy = rm.y + rm.h + 1; bx = rm.cx; by = rm.y + rm.h; }
      else { sx = rm.cx - 1; sy = rm.y - 4; bx = rm.cx; by = rm.y - 1; }
      let ok = sx - 1 >= 1 && sy - 1 >= 1 && sx + 3 <= 30 && sy + 3 <= 30;
      for (let y = sy - 1; ok && y <= sy + 3; y++) for (let x = sx - 1; x <= sx + 3; x++) {
        if (ch.t[idx(x, y)] !== T.DWALL && !(x === bx && y === by)) { ok = false; break; }
      }
      if (!ok) continue;
      fillR(ch, sx, sy, 3, 3, T.DFLOOR);
      // la pared agrietada conecta la sala con el cuarto (puede tener 1-2 tiles de espesor)
      const cells = [];
      if (side === 0) for (let x = bx; x < sx; x++) cells.push([x, by]);
      if (side === 1) for (let x = sx + 3; x <= bx; x++) cells.push([x, by]);
      if (side === 2) for (let y = by; y < sy; y++) cells.push([bx, y]);
      if (side === 3) for (let y = sy + 3; y <= by; y++) cells.push([bx, y]);
      cells.forEach((c) => setT(ch, c[0], c[1], T.CRACK, 0));
      chest(S, sx + 1, sy + 1, { q: 2, mimic: false });
      made++;
    }
    ch.pois.push({ k: 'dungeon', n: 'Mazmorra', sealed });
    ch.tier = ch.tier + 1;
  }

  /* ---------- Arena de jefe: círculo con puertas que se sellan, santuario en la esquina ---------- */
  function genArena(S) {
    const { ch, rng } = S;
    const g = groundOf(ch);
    clearDisc(S, 16, 16, 16, g);
    const dist = Math.hypot(ch.cx, ch.cy);
    const bh = G.hash2(S.L.seed + 77, ch.cx, ch.cy) / 4294967296;
    let boss = G.BIOMES[ch.biome].boss;
    if (dist >= 6 && bh < 0.28) boss = 'lich';
    ch.boss = boss;
    const wall = boss === 'pharaoh' ? T.AWALL : T.RWALL, floor = boss === 'pharaoh' ? T.AFLOOR : T.RFLOOR;
    for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
      if (d < 13) { ch.t[idx(x, y)] = floor; ch.o[idx(x, y)] = 0; ch.keep[idx(x, y)] = 2; }
      else if (d < 15) {
        const dx = Math.abs(x + 0.5 - 16), dy = Math.abs(y + 0.5 - 16);
        const door = (dx < 2 && dy > dx) || (dy < 2 && dx > dy);
        if (door) { ch.t[idx(x, y)] = floor; ch.o[idx(x, y)] = 0; ch.keep[idx(x, y)] = 2; }
        else { ch.t[idx(x, y)] = wall; ch.o[idx(x, y)] = 0; ch.keep[idx(x, y)] = 2; }
      }
    }
    [[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach((d) => setO(ch, 16 + d[0], 16 + d[1], O.PILLAR));
    // santuario fuera del anillo (esquina) para guardar antes del combate
    clearDisc(S, 3, 3, 2, g); setO(ch, 3, 3, O.SHRINE); setO(ch, 4, 5, O.FIRE);
    ch.pois.push({ k: 'camp', n: 'Santuario', tx: S.x0 + 3, ty: S.y0 + 3 });
    ch.pois.push({ k: 'boss', n: 'Arena de ' + G.BOSSES[boss].name, boss });
    ch.ents.push({ id: 'boss:' + ch.cx + ',' + ch.cy, k: 'boss', type: boss, tx: 16, ty: 14 });
    ch.tier = ch.tier + 1;
  }

  /* ---------- Fábrica de estado de mundo ---------- */
  G.newWorldState = function (name, seed, hardcore) {
    return {
      v: 1, name, seed, hardcore: !!hardcore, created: Date.now(), updated: Date.now(), play: 0,
      mods: {}, meta: {}, dead: {}, done: {}, epoch: 0, explored: {},
      save: { x: 16 * TS + 8, y: 18 * TS },
      stats: { kills: 0, bosses: 0, deaths: 0, chests: 0, maxDist: 0, secrets: 0 },
      discovered: {},
      player: null,
    };
  };
  G.newPlayer = function () {
    const p = {
      x: 16 * TS + 8, y: 18 * TS, hp: null, hpMax: 100, gold: 20, pts: 0, spent: 0, skills: {}, bind: { Q: null, E: null, R: null, F: null },
      equip: { weapon: null, armor: null, charm1: null, charm2: null }, inv: [], quick: [null, null, null, null], boss: {},
    };
    p.equip.weapon = G.genWeapon(1, 0, 'sword');
    p.equip.weapon.name = 'Espada oxidada'; p.equip.weapon.min = 6; p.equip.weapon.max = 9;
    p.inv.push(G.genCons('hp1', 3));
    p.quick[0] = 'hp1';
    G.computeStats(p);
    p.hp = p.hpMax;
    return p;
  };

  /* ---------- Explorado (mapa) ---------- */
  G.markExplored = function (ws, tx, ty, r) {
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if ((x - tx) * (x - tx) + (y - ty) * (y - ty) > r * r) continue;
      const cx = G.fdiv(x, CS), cy = G.fdiv(y, CS), k = cx + ',' + cy;
      let e = ws.explored[k];
      if (!e) e = ws.explored[k] = new Uint8Array(NN);
      e[(y - cy * CS) * CS + (x - cx * CS)] = 1;
    }
  };
})();
