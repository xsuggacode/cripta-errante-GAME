'use strict';
/* Entidades: movimiento con colisión, fábrica de enemigos/jefes, IA de enemigos y patrones de jefes. */
(function () {
  const G = window.G, TS = G.TS;

  /* ---------- Colisión ---------- */
  G.collides = function (L, x, y, r, fly) {
    const h = r * 0.8;
    const pts = [[-h, -h], [h, -h], [-h, h], [h, h], [0, -h], [0, h], [-h, 0], [h, 0]];
    for (let i = 0; i < 8; i++) if (L.solidPx(x + pts[i][0], y + pts[i][1], fly)) return true;
    return false;
  };
  G.moveEnt = function (L, e, dx, dy, fly) {
    let moved = false;
    if (dx && !G.collides(L, e.x + dx, e.y, e.r, fly)) { e.x += dx; moved = true; }
    if (dy && !G.collides(L, e.x, e.y + dy, e.r, fly)) { e.y += dy; moved = true; }
    return moved;
  };

  /* ---------- Helpers de efectos ---------- */
  G.floatText = function (g, x, y, txt, col, big) { g.texts.push({ x, y, txt: String(txt), col: col || '#fff', t: 0, big: !!big }); };
  G.burst = function (g, x, y, col, n, spd, life) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (0.3 + Math.random() * 0.7) * (spd || 60); g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: (life || 0.45) * (0.6 + Math.random() * 0.6), col, size: 1 + (Math.random() < 0.3 ? 1 : 0) }); }
  };
  G.addProj = function (g, o) {
    g.projs.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, r: 3, dmg: 5, from: 'e', life: 2, col: '#ff6a6a', hit: null, pierce: 0, magic: false }, o));
  };
  G.addTele = function (g, o) { // círculo de aviso que explota tras un retardo
    g.fx.push(Object.assign({ k: 'tele', x: 0, y: 0, r: 20, t: 0, delay: 0.8, dmg: 8, owner: 'e', col: '#ff4040' }, o));
  };
  G.addZone = function (g, o) { // zona persistente que daña por ticks
    g.fx.push(Object.assign({ k: 'zone', x: 0, y: 0, r: 20, t: 0, life: 4, tick: 0, every: 0.5, dmg: 4, owner: 'e', col: '#8bd04a', status: null }, o));
  };
  G.eShoot = function (g, e, ang, spd, dmgMul, o) {
    G.addProj(g, Object.assign({ x: e.x, y: e.y - 2, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg: e.dmg * (dmgMul || 1), src: e }, o));
  };

  /* ---------- Fábrica ---------- */
  G.makeEnemy = function (type, tier, x, y, elite, mini) {
    const D = G.ENEMIES[type];
    const hs = 1 + 0.3 * (tier - 1), ds = 1 + 0.18 * (tier - 1);
    const e = { k: 'enemy', type, D, x, y, vx: 0, vy: 0, kx: 0, ky: 0, hp: D.hp * hs, hpMax: D.hp * hs, dmg: D.dmg * ds, spd: D.spd, r: D.r, fly: !!D.fly, state: 'idle', t: Math.random() * 1.5, cd: 0.6 + Math.random() * 1.2, face: 1,
      flash: 0, st: { burn: 0, poison: 0, slow: 0, stun: 0, bt: 0, pt: 0 }, tier, elite: elite || null, aggro: D.aggro || 110, contactCd: 0, anim: Math.random() * 6, stuck: 0, wander: Math.random() * 6.283, home: { x, y }, dmgTaken: 1, mini: !!mini, alpha: 1 };
    if (elite) {
      e.hp *= 2.3; e.hpMax = e.hp; e.dmg *= 1.3; e.r *= 1.2; e.aggro += 40;
      if (elite === 'swift') e.spd *= 1.5;
      if (elite === 'armored') e.dmgTaken = 0.55;
    }
    if (mini) { e.hp *= 0.45; e.hpMax = e.hp; e.r *= 0.7; e.dmg *= 0.6; }
    e.scale = (elite ? 1.2 : 1) * (mini ? 0.7 : 1);
    return e;
  };
  G.makeBoss = function (type, tier, x, y) {
    const B = G.BOSSES[type];
    const hs = 1 + 0.42 * (tier - 1), ds = 1 + 0.2 * (tier - 1);
    return { k: 'boss', boss: true, type, B, name: B.name, x, y, vx: 0, vy: 0, kx: 0, ky: 0, hp: B.hp * hs, hpMax: B.hp * hs, dmg: B.dmg * ds, spd: B.spd, r: B.r, fly: false, state: 'idle', t: 0, cd: 1.5, face: 1, flash: 0,
      st: { burn: 0, poison: 0, slow: 0, stun: 0, bt: 0, pt: 0 }, tier, elite: null, active: false, phase: 1, cur: null, last: null, contactCd: 0, anim: 0, dmgTaken: 1, alpha: 1, scale: B.scale, minions: [], home: { x, y } };
  };
  G.NPCS = {
    merchant: { name: 'Mercader', pal: ['#8a5a2a', '#e8b878', '#2a6a4a', '#1b1424'], shape: 'robe' },
    sage: { name: 'Sabio del Camino', pal: ['#3a6ac8', '#e8d8f0', '#7a5aa8', '#1b1424'], shape: 'robe' },
  };

  /* ---------- IA de enemigos ---------- */
  function face(e, dx) { if (Math.abs(dx) > 0.5) e.face = dx > 0 ? 1 : -1; }
  function walk(g, e, ang, mul, dt) {
    const sp = e.spd * (mul == null ? 1 : mul) * (e.st.slow > 0 ? 0.55 : 1) * dt;
    const dx = Math.cos(ang) * sp, dy = Math.sin(ang) * sp;
    const moved = G.moveEnt(g.level, e, dx, dy, e.fly || e.D && e.D.phase);
    if (!moved) { e.stuck += dt; if (e.stuck > 0.35) { e.wander += (Math.random() < 0.5 ? 1 : -1) * 1.6; e.stuck = 0; G.moveEnt(g.level, e, Math.cos(e.wander) * sp * 3, Math.sin(e.wander) * sp * 3, e.fly); } }
    else e.stuck = Math.max(0, e.stuck - dt);
    face(e, dx);
  }
  function idleWander(g, e, dt) {
    e.t -= dt;
    if (e.t <= 0) { e.t = 1 + Math.random() * 2; e.wander = Math.random() * 6.283; e.walking = Math.random() < 0.5; }
    if (e.walking) {
      const hd = Math.hypot(e.x - e.home.x, e.y - e.home.y);
      if (hd > 70) e.wander = G.ang(e.x, e.y, e.home.x, e.home.y);
      walk(g, e, e.wander, 0.35, dt);
    }
  }
  const RANGED = { archer: 1, caster: 1, imp: 1, bog: 0.6, scorp: 0.8, thief: 0.3 };

  G.enemyAI = function (g, e, dt) {
    const p = g.p, D = e.D;
    e.anim += dt;
    if (e.contactCd > 0) e.contactCd -= dt;
    if (e.flash > 0) e.flash -= dt;
    // knockback
    if (e.kx || e.ky) {
      G.moveEnt(g.level, e, e.kx * dt, e.ky * dt, e.fly);
      const f = Math.pow(0.002, dt); e.kx *= f; e.ky *= f; if (Math.abs(e.kx) + Math.abs(e.ky) < 4) { e.kx = e.ky = 0; }
    }
    if (e.st.stun > 0) return;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const awake = e.state !== 'idle';
    if (!awake) {
      if (d < e.aggro && !p.dead) { e.state = 'chase'; e.t = 0; e.cd = 0.4 + Math.random() * 0.5; }
      else { idleWander(g, e, dt); return; }
    } else if (d > e.aggro * 2.6 + 80 && e.state === 'chase') { e.state = 'idle'; e.t = 0; return; }
    if (p.dead) { idleWander(g, e, dt); return; }
    const ai = D.ai;
    switch (ai) {
      case 'hop': {
        e.t -= dt;
        if (e.state === 'chase') { if (e.t <= 0) { e.state = 'hop'; e.t = 0.38; e.hopA = a + G.rand(-0.4, 0.4); } }
        else if (e.state === 'hop') { walk(g, e, e.hopA, 3.1, dt); if (e.t <= 0) { e.state = 'chase'; e.t = 0.7 + Math.random() * 0.5; } }
        break;
      }
      case 'flit': {
        e.t -= dt;
        const off = Math.sin(e.anim * 5) * 1.1;
        if (e.state === 'chase') { walk(g, e, a + off, 1, dt); if (d < e.r + 8) { e.state = 'retreat'; e.t = 0.7; } }
        else { walk(g, e, a + Math.PI + Math.sin(e.anim * 8) * 0.8, 1.1, dt); if (e.t <= 0) e.state = 'chase'; }
        break;
      }
      case 'charger': case 'wolf': {
        e.t -= dt;
        const wolf = ai === 'wolf';
        if (e.state === 'chase') {
          if (wolf && d < 120) { e.state = 'orbit'; e.t = 1 + Math.random() * 0.8; e.orb = Math.random() < 0.5 ? 1 : -1; }
          else { walk(g, e, a, 1, dt); if (!wolf && d < 78 && e.t <= 0) { e.state = 'wind'; e.t = 0.45; e.dashA = a; } }
        } else if (e.state === 'orbit') {
          walk(g, e, a + e.orb * 1.35, 0.9, dt);
          if (e.t <= 0) { e.state = 'wind'; e.t = 0.32; e.dashA = a; }
        } else if (e.state === 'wind') {
          e.dashA = a; e.flash = 0.05;
          if (e.t <= 0) { e.state = 'dash'; e.t = wolf ? 0.42 : 0.36; }
        } else if (e.state === 'dash') {
          walk(g, e, e.dashA, wolf ? 4.3 : 3.8, dt);
          if (e.t <= 0) { e.state = 'recover'; e.t = wolf ? 0.5 : 0.7; }
        } else if (e.state === 'recover') { if (e.t <= 0) { e.state = 'chase'; e.t = 0.6 + Math.random() * 0.8; } }
        break;
      }
      case 'archer': {
        e.cd -= dt;
        if (d < 70) walk(g, e, a + Math.PI, 0.9, dt); else if (d > 115) walk(g, e, a, 0.9, dt); else walk(g, e, a + 1.4, 0.4, dt);
        if (e.state === 'wind') { e.t -= dt; e.flash = 0.04; if (e.t <= 0) { G.eShoot(g, e, a, 125, 1, { col: '#e8e4d0', r: 2.5, life: 2.2 }); G.sfx('shoot'); e.state = 'chase'; e.cd = 1.5 + Math.random() * 0.7; } }
        else if (e.cd <= 0 && d < 190) { e.state = 'wind'; e.t = 0.35; }
        break;
      }
      case 'spider': {
        e.t -= dt;
        if (e.state === 'chase') { walk(g, e, a + Math.sin(e.anim * 6) * 0.6, 1, dt); if (d < 64 && e.t <= 0) { e.state = 'wind'; e.t = 0.3; e.dashA = a; } }
        else if (e.state === 'wind') { e.dashA = a; if (e.t <= 0) { e.state = 'dash'; e.t = 0.26; } }
        else if (e.state === 'dash') { walk(g, e, e.dashA, 3.6, dt); if (e.t <= 0) { e.state = 'recover'; e.t = 0.5; } }
        else if (e.t <= 0) { e.state = 'chase'; e.t = 0.7; }
        break;
      }
      case 'caster': {
        e.cd -= dt;
        if (d < 80) walk(g, e, a + Math.PI, 0.8, dt); else if (d > 130) walk(g, e, a, 0.7, dt);
        if (e.state === 'wind') {
          e.t -= dt; e.flash = 0.04;
          if (e.t <= 0) {
            if (e.castK === 0) { for (let i = -1; i <= 1; i++) G.eShoot(g, e, a + i * 0.28, 90, 0.9, { col: '#d070ff', r: 3, magic: true, life: 2.4 }); G.sfx('magic'); }
            else G.addTele(g, { x: p.x, y: p.y, r: 24, delay: 0.85, dmg: e.dmg * 1.4, col: '#c040ff', src: e });
            e.state = 'chase'; e.cd = 2 + Math.random();
          }
        } else if (e.cd <= 0 && d < 200) { e.state = 'wind'; e.t = 0.45; e.castK = Math.random() < 0.5 ? 0 : 1; }
        break;
      }
      case 'brute': {
        e.t -= dt;
        if (e.state === 'chase') { walk(g, e, a, 1, dt); if (d < 48 && e.t <= 0) { e.state = 'wind'; e.t = 0.75; } }
        else if (e.state === 'wind') { e.flash = 0.05; if (e.t <= 0) { G.addTele(g, { x: e.x, y: e.y, r: 36, delay: 0.0, dmg: e.dmg * 1.5, col: '#ff7a30', src: e, kb: 150 }); G.sfx('boom'); g.shake = Math.max(g.shake, 3); e.state = 'recover'; e.t = 0.9; } }
        else if (e.t <= 0) { e.state = 'chase'; e.t = 0.8; }
        break;
      }
      case 'scorp': {
        e.cd -= dt;
        if (d > 56) walk(g, e, a, 1, dt); else if (d < 36) walk(g, e, a + Math.PI, 0.6, dt);
        if (e.state === 'wind') { e.t -= dt; e.flash = 0.04; if (e.t <= 0) { for (let i = -1; i <= 1; i++) G.eShoot(g, e, a + i * 0.2, 130, 0.8, { col: '#9ad04a', r: 2.5, poison: true, life: 1.2 }); G.sfx('shoot'); e.state = 'chase'; e.cd = 1.7; } }
        else if (e.cd <= 0 && d < 120 && d > 30) { e.state = 'wind'; e.t = 0.4; }
        break;
      }
      case 'imp': {
        e.cd -= dt;
        if (d < 70) walk(g, e, a + Math.PI, 1, dt); else if (d > 120) walk(g, e, a, 1, dt); else walk(g, e, a + 1.5 * Math.sin(e.anim), 0.6, dt);
        if (e.cd <= 0 && d < 200) { for (let i = 0; i < 2; i++) G.eShoot(g, e, a + (i ? 0.15 : -0.15), 105, 0.9, { col: '#ff8a2a', r: 3, burn: true, life: 2.2 }); G.sfx('shoot'); e.cd = 2 + Math.random() * 0.8; }
        break;
      }
      case 'bog': {
        e.cd -= dt;
        if (d > 44) walk(g, e, a, 1, dt);
        if (e.state === 'wind') { e.t -= dt; e.flash = 0.04; if (e.t <= 0) { for (let i = -1; i <= 1; i++) G.eShoot(g, e, a + i * 0.35, 85, 0.8, { col: '#8bd04a', r: 3.5, poison: true, life: 1.6 }); G.sfx('shoot'); e.state = 'chase'; e.cd = 2.4; } }
        else if (e.cd <= 0 && d < 140) { e.state = 'wind'; e.t = 0.5; }
        break;
      }
      case 'ghost': {
        e.alpha = 0.65 + Math.sin(e.anim * 3) * 0.2;
        walk(g, e, a + Math.sin(e.anim * 2) * 0.7, d > 40 ? 1 : 0.4, dt);
        break;
      }
      case 'thief': {
        walk(g, e, a + Math.PI + Math.sin(e.anim * 3) * 0.5, d < 160 ? 1.3 : 0.2, dt);
        if (d > 360) e.despawn = true;
        break;
      }
      default: walk(g, e, a, 1, dt);
    }
    // daño por contacto
    const contact = D.contact != null ? D.contact : (RANGED[ai] != null ? 0.35 : 1);
    if (contact > 0 && e.contactCd <= 0 && d < e.r + 5 && e.state !== 'wind') {
      e.contactCd = 0.9;
      const dm = e.dmg * contact * (e.state === 'dash' ? 1.3 : 1);
      G.hurtPlayer(g, dm, { src: e, kb: 90, poison: D.poison || e.elite === 'venomous', ang: a });
      if (e.elite === 'vampiric') { e.hp = Math.min(e.hpMax, e.hp + dm * 0.8); }
    }
  };

  /* ---------- Jefes ---------- */
  function choosePat(b) {
    const B = b.B;
    const pool = b.phase === 2 ? B.pats.concat(B.p2, B.p2) : B.pats;
    const opts = pool.filter((x) => x !== b.lastDef);
    return G.wpick(opts.map((x) => [x, x.w]));
  }
  function aliveMinions(g, b) { return g.enemies.filter((e) => e.master === b && e.hp > 0).length; }
  const FIRE_COL = '#ff6a6a';

  G.bossAI = function (g, b, dt) {
    const p = g.p, B = b.B;
    b.anim += dt;
    if (b.flash > 0) b.flash -= dt;
    if (b.contactCd > 0) b.contactCd -= dt;
    if (b.kx || b.ky) { G.moveEnt(g.level, b, b.kx * dt * 0.25, b.ky * dt * 0.25, false); const f = Math.pow(0.002, dt); b.kx *= f; b.ky *= f; }
    if (!b.active || p.dead) return;
    if (b.st.stun > 0) return;
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (b.phase === 1 && b.hp < b.hpMax * 0.5) {
      b.phase = 2; b.cur = null; b.cd = 0.8; b.flash = 0.6; b.spd *= 1.25;
      G.toast(g, '¡' + b.name + ' entra en furia!', '#ff7060'); G.sfx('boss'); g.shake = Math.max(g.shake, 6);
      G.addTele(g, { x: b.x, y: b.y, r: 50, delay: 0.6, dmg: b.dmg * 0.8, col: '#ff4040', src: b, kb: 140 });
    }
    const cdMul = b.phase === 2 ? 0.7 : 1;
    if (!b.cur) {
      // movimiento de posicionamiento
      if (d > 120) walkB(g, b, a, 1, dt); else if (d < 60) walkB(g, b, a + Math.PI, 0.6, dt); else walkB(g, b, a + 1.5, 0.35, dt);
      b.cd -= dt;
      if (b.cd <= 0) { const def = choosePat(b); b.lastDef = def; b.cur = Object.assign({}, def); b.curK = def.k; b.pt = 0; b.ps = 0; b.pa = a; }
    } else {
      runPattern(g, b, dt, a, d);
    }
    b.cdNext = B.cd * cdMul;
    // daño por contacto
    if (b.contactCd <= 0 && d < b.r + 6 && b.curK !== 'blinkout') {
      b.contactCd = 1; G.hurtPlayer(g, b.dmg * 0.7, { src: b, kb: 120, ang: a });
    }
  };
  function walkB(g, b, ang, mul, dt) {
    const sp = b.spd * mul * (b.st.slow > 0 ? 0.6 : 1) * dt;
    G.moveEnt(g.level, b, Math.cos(ang) * sp, Math.sin(ang) * sp, false);
    if (Math.abs(Math.cos(ang)) > 0.2) b.face = Math.cos(ang) > 0 ? 1 : -1;
  }
  function finish(b) { b.cur = null; b.curK = null; b.alpha = 1; b.cd = b.cdNext || b.B.cd; }

  function runPattern(g, b, dt, a, d) {
    const c = b.cur, p = g.p;
    b.pt += dt;
    const cl = c.k;
    switch (cl) {
      case 'slam': {
        if (b.ps === 0) { b.ps = 1; G.addTele(g, { x: b.x, y: b.y, r: c.r, delay: 0.75, dmg: b.dmg * 1.4, col: c.col || '#ff4040', src: b, kb: 170, after: c.ring ? { ring: c.ring, spd: 95, col: c.col || FIRE_COL, dmg: b.dmg * 0.6 } : null }); b.flash = 0.2; }
        if (b.pt > 1.1) finish(b);
        break;
      }
      case 'aimed': {
        const bursts = c.bursts || 1, gap = c.gap || 0.4;
        if (b.pt >= 0.45 + b.ps * gap && b.ps < bursts) {
          b.ps++;
          const aa = G.ang(b.x, b.y, p.x, p.y);
          for (let i = 0; i < c.n; i++) { const o = c.n === 1 ? 0 : (i / (c.n - 1) - 0.5) * c.spread; G.eShoot(g, b, aa + o, c.spd, 0.55, { col: c.col || FIRE_COL, r: 3.5, life: 3 }); }
          G.sfx('shoot');
        }
        if (b.ps >= bursts && b.pt > 0.45 + bursts * gap) finish(b);
        break;
      }
      case 'ring': {
        const rings = c.rings || 1, gap = c.gap || 0.5;
        if (b.pt >= 0.4 + b.ps * gap && b.ps < rings) {
          const off = Math.random() * 6.283;
          for (let i = 0; i < c.n; i++) { const aa = off + i / c.n * 6.283 + b.ps * (3.14 / c.n); G.eShoot(g, b, aa, c.spd, 0.55, { col: c.col || FIRE_COL, r: 3.5, life: 4 }); }
          G.sfx('boom'); b.ps++;
        }
        if (b.ps >= rings && b.pt > 0.4 + rings * gap) finish(b);
        break;
      }
      case 'spiral': {
        b.sacc = (b.sacc || 0) + dt;
        if (b.pt > 0.4 && b.pt < 0.4 + c.dur) {
          while (b.sacc >= c.rate) {
            b.sacc -= c.rate; b.sang = (b.sang || 0) + 0.32;
            for (let k = 0; k < c.arms; k++) G.eShoot(g, b, b.sang + k / c.arms * 6.283, c.spd, 0.5, { col: c.col || FIRE_COL, r: 3, life: 4 });
          }
        }
        if (b.pt > 0.8 + c.dur) { b.sacc = 0; finish(b); }
        break;
      }
      case 'summon': {
        if (b.ps === 0) { b.ps = 1; b.flash = 0.5; }
        if (b.ps === 1 && b.pt > 0.8) {
          b.ps = 2;
          const room = Math.max(0, 6 - aliveMinions(g, b));
          for (let i = 0; i < Math.min(c.n, room); i++) {
            const an = i / c.n * 6.283 + Math.random(), px = b.x + Math.cos(an) * 34, py = b.y + Math.sin(an) * 34;
            if (G.collides(g.level, px, py, 5)) continue;
            const m = G.makeEnemy(c.id, Math.max(1, b.tier - 1), px, py, null, false);
            m.state = 'chase'; m.master = b; m.noLoot = true; g.enemies.push(m);
            G.burst(g, px, py, '#c070ff', 10, 50);
          }
          G.sfx('magic');
        }
        if (b.pt > 1.3) finish(b);
        break;
      }
      case 'charge': {
        if (b.ps === 0) { b.ps = 1; b.flash = 0.6; b.cdir = a; }
        if (b.ps === 1) { b.cdir = a; if (b.pt > 0.7) { b.ps = 2; b.cdt = c.dur; G.sfx('boss'); } }
        if (b.ps === 2) {
          b.cdt -= dt;
          const ok = G.moveEnt(g.level, b, Math.cos(b.cdir) * c.spd * dt, Math.sin(b.cdir) * c.spd * dt, false);
          b.face = Math.cos(b.cdir) > 0 ? 1 : -1;
          if (!ok || b.cdt <= 0) { if (!ok) { g.shake = Math.max(g.shake, 5); G.sfx('boom'); } b.ps = 3; b.pt = 0; }
          const dd = G.dist(b.x, b.y, p.x, p.y);
          if (dd < b.r + 6 && b.contactCd <= 0) { b.contactCd = 0.7; G.hurtPlayer(g, b.dmg * 1.2, { src: b, kb: 190, ang: b.cdir }); }
          if (Math.random() < 0.6) g.parts.push({ x: b.x, y: b.y + 4, vx: 0, vy: 0, t: 0, max: 0.3, col: '#ccc', size: 2 });
        }
        if (b.ps === 3 && b.pt > 0.5) finish(b);
        break;
      }
      case 'roots': {
        if (b.ps === 0) {
          b.ps = 1; const aa = G.ang(b.x, b.y, p.x, p.y);
          for (let i = 0; i < c.n; i++) G.addTele(g, { x: b.x + Math.cos(aa) * (20 + i * c.step), y: b.y + Math.sin(aa) * (20 + i * c.step), r: 15, delay: 0.55 + i * 0.1, dmg: b.dmg * 1.1, col: '#7adf5a', src: b });
        }
        if (b.pt > 0.55 + c.n * 0.1 + 0.4) finish(b);
        break;
      }
      case 'rain': {
        if (b.ps === 0) {
          b.ps = 1;
          for (let i = 0; i < c.n; i++) {
            const an = Math.random() * 6.283, rr = i === 0 ? 0 : 20 + Math.random() * 70;
            G.addTele(g, { x: p.x + Math.cos(an) * rr, y: p.y + Math.sin(an) * rr, r: c.r, delay: c.delay + i * 0.12, dmg: b.dmg * 1.1, col: c.col || '#ff6a2a', src: b });
          }
        }
        if (b.pt > c.delay + c.n * 0.12 + 0.35) finish(b);
        break;
      }
      case 'pool': {
        if (b.ps === 0) {
          b.ps = 1;
          for (let i = 0; i < c.n; i++) {
            const an = Math.random() * 6.283, rr = i === 0 ? 0 : 30 + Math.random() * 60;
            G.addTele(g, { x: p.x + Math.cos(an) * rr, y: p.y + Math.sin(an) * rr, r: c.r, delay: 0.8, dmg: 0, col: '#8bd04a', src: b, leave: { life: 6, dmg: b.dmg * 0.35, status: 'poison', col: '#8bd04a' } });
          }
        }
        if (b.pt > 1.2) finish(b);
        break;
      }
      case 'blink': {
        if (b.ps === 0) { b.ps = 1; b.curK = 'blinkout'; b.alpha = 1; }
        if (b.ps === 1) { b.alpha = Math.max(0, 1 - b.pt / 0.35); if (b.pt > 0.35) {
          for (let tries = 0; tries < 12; tries++) { const an = Math.random() * 6.283, px = p.x + Math.cos(an) * G.rand(70, 110), py = p.y + Math.sin(an) * G.rand(70, 110); if (!G.collides(g.level, px, py, b.r)) { G.burst(g, b.x, b.y, '#c070ff', 14, 70); b.x = px; b.y = py; break; } }
          b.ps = 2; b.pt = 0; b.curK = 'blink'; G.burst(g, b.x, b.y, '#c070ff', 14, 70); } }
        if (b.ps === 2) { b.alpha = Math.min(1, b.pt / 0.3); if (b.pt > 0.45) { b.ps = 3; b.alpha = 1; const aa = G.ang(b.x, b.y, p.x, p.y); for (let i = 0; i < 12; i++) G.eShoot(g, b, aa + i / 12 * 6.283, 100, 0.5, { col: '#d070ff', r: 3, life: 3.5 }); G.sfx('magic'); } }
        if (b.ps === 3 && b.pt > 1.0) { b.alpha = 1; finish(b); }
        break;
      }
      default: finish(b);
    }
  }
})();
