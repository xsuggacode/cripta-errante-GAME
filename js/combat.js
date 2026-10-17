'use strict';
/* Combate en tiempo real: ataques, daño, estados, proyectiles, zonas, habilidades activas, consumibles, botín y recompensas de jefes. */
(function () {
  const G = window.G, TS = G.TS;
  G.toast = function (g, msg, col) { if (G.ui && G.ui.toast) G.ui.toast(msg, col); };

  /* ---------- Cálculo de daño del jugador ---------- */
  G.weapon = (p) => p.equip.weapon || { wt: 'fist', min: 2, max: 3, rate: 0.4, aff: {}, kind: 'weapon' };
  G.avgDmg = function (p) {
    const w = G.weapon(p), s = p.st;
    let d = (w.min + w.max) / 2 * s.dmg;
    if (p.buff.rage > 0) d *= 1.3;
    if (p.buff.rageP > 0) d *= 1.4;
    return d;
  };
  function rollHit(g, base, o) {
    const p = g.p, s = p.st;
    let d = base * (o.ranged ? s.rdmg : 1) * (o.magic ? s.magic : 1);
    if (p.counterT > 0 && o.consumeCounter) { d *= 1 + s.counter; p.counterT = 0; }
    const crit = Math.random() < s.crit + (o.critBonus || 0);
    if (crit) d *= s.critDmg;
    return { dmg: d, crit };
  }

  /* ---------- Estados ---------- */
  function applyStatus(g, e, name, dur, dps) {
    if (e.hp <= 0) return;
    if (e.boss && name === 'stun') dur *= 0.25;
    e.st[name] = Math.max(e.st[name], dur);
    if (name === 'burn') e.st.bdps = Math.max(e.st.bdps || 0, dps || 4);
    if (name === 'poison') e.st.pdps = Math.max(e.st.pdps || 0, dps || 3);
  }
  G.applyStatus = applyStatus;
  function playerStatusOpts(g, o) {
    const s = g.p.st, avg = G.avgDmg(g.p);
    return {
      burn: o.burn || Math.random() < s.burn, poison: o.poison || Math.random() < s.poison, slow: o.slow || Math.random() < s.slow,
      bdps: 3 + avg * 0.3, pdps: 2 + avg * 0.2,
    };
  }

  /* ---------- Daño a enemigos ---------- */
  G.damageEnemy = function (g, e, amt, o) {
    o = o || {};
    if (e.hp <= 0 || e.dead) return 0;
    if (e.boss && !e.active) return 0;
    const p = g.p, s = p.st;
    let d = amt * e.dmgTaken;
    if (e.hp < e.hpMax * 0.3) d *= 1 + s.exec;
    if (e.boss) d *= 1 + s.bossDmg;
    d = Math.max(1, Math.round(d));
    e.hp -= d; e.flash = 0.1;
    if (e.state === 'idle') { e.state = 'chase'; e.t = 0; }
    if (!e.boss) { if (e.D.ai === 'thief') e.despawn = false; }
    if (o.kb && !e.boss) { const a = o.ang != null ? o.ang : G.ang(p.x, p.y, e.x, e.y); e.kx += Math.cos(a) * o.kb; e.ky += Math.sin(a) * o.kb; }
    else if (o.kb && e.boss) { const a = o.ang != null ? o.ang : G.ang(p.x, p.y, e.x, e.y); e.kx += Math.cos(a) * o.kb * 0.15; e.ky += Math.sin(a) * o.kb * 0.15; }
    if (o.status) {
      const so = o.status;
      if (so.burn) applyStatus(g, e, 'burn', 3, so.bdps);
      if (so.poison) applyStatus(g, e, 'poison', 5, so.pdps);
      if (so.slow) applyStatus(g, e, 'slow', 2.5);
    }
    if (o.stun) applyStatus(g, e, 'stun', o.stun);
    if (!o.noLeech && s.lifesteal + (p.buff.rage > 0 ? 0.08 * s.mRage : 0) > 0) {
      const ls = s.lifesteal + (p.buff.rage > 0 ? 0.08 * s.mRage : 0);
      p.hp = Math.min(p.hpMax, p.hp + d * ls);
    }
    G.floatText(g, e.x + G.rand(-4, 4), e.y - e.r - 6, d, o.crit ? '#ffd24a' : (o.col || '#fff'), o.crit);
    G.burst(g, e.x, e.y, o.crit ? '#ffd24a' : (e.D ? e.D.pal[0] : '#fff'), o.crit ? 8 : 4, 55, 0.35);
    G.sfx('hit');
    if (e.hp <= 0) G.killEnemy(g, e);
    return d;
  };
  G.dot = function (g, e, amt, col) {
    if (e.hp <= 0) return;
    e.hp -= amt; e.flash = Math.max(e.flash, 0.05);
    G.floatText(g, e.x + G.rand(-3, 3), e.y - e.r - 4, Math.max(1, Math.round(amt)), col, false);
    if (e.hp <= 0) G.killEnemy(g, e);
  };

  /* ---------- Daño al jugador ---------- */
  G.hurtPlayer = function (g, amt, o) {
    o = o || {};
    const p = g.p;
    if (p.dead || p.invuln > 0 || p.dodgeI > 0 || g.cutscene) return false;
    const s = p.st;
    let a = Math.max(1, amt * 40 / (40 + s.def));
    if (o.dot) a = amt;
    a = Math.round(a);
    if (p.shield > 0) {
      const ab = Math.min(p.shield, a);
      p.shield -= ab; a -= ab;
      if (s.mGuard && o.src && o.src.hp > 0 && !o.dot) G.damageEnemy(g, o.src, ab * 0.4 * s.mGuard, { noLeech: true, col: '#7ad7ff' });
      G.floatText(g, p.x, p.y - 12, '🛡' + ab, '#7ad7ff');
    }
    if (a > 0) {
      p.hp -= a;
      G.floatText(g, p.x, p.y - 12, a, '#ff5a5a');
      G.sfx('hurt');
      g.shake = Math.max(g.shake, o.dot ? 0 : 3);
      p.hitFlash = 0.2;
      g.dmgVignette = 0.35;
    }
    p.invuln = o.dot ? 0.12 : 0.5;
    if (o.poison) p.stat.poison = Math.max(p.stat.poison, 4);
    if (o.burn) p.stat.burn = Math.max(p.stat.burn, 3);
    if (o.kb) { const ang = o.ang != null ? o.ang : 0; p.kx += Math.cos(ang) * o.kb; p.ky += Math.sin(ang) * o.kb; }
    if (p.hp <= 0) {
      if (s.lastBreath > 0 && p.lbCd <= 0) {
        p.hp = 1; p.invuln = 2; p.lbCd = s.lastBreath;
        G.toast(g, '¡Último Aliento! Sobreviviste con 1 PV', '#ffd24a'); G.burst(g, p.x, p.y, '#ffd24a', 20, 90); G.sfx('heal');
      } else { p.hp = 0; p.dead = true; if (G.onPlayerDeath) G.onPlayerDeath(g); }
    }
    return true;
  };

  /* ---------- Muerte de enemigos y botín ---------- */
  G.spawnDrop = function (g, x, y, kind, o) {
    const a = Math.random() * 6.283, sp = 20 + Math.random() * 40;
    g.drops.push(Object.assign({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind, t: 0, life: 120, z: 0 }, o));
  };
  function goldDrop(g, x, y, base, tier, mul) {
    const s = g.p.st;
    const amt = Math.max(1, Math.round(base * (1 + 0.28 * (tier - 1)) * (1 + s.gold) * (g.ws.hardcore ? 1.25 : 1) * (mul || 1)));
    G.spawnDrop(g, x, y, 'gold', { amt });
  }
  G.luck = function (g) { return g.p.st.luck + (g.p.buff.clover > 0 ? 0.35 : 0) + (g.ws.hardcore ? 0.1 : 0); };

  G.killEnemy = function (g, e) {
    if (e.dead) return;
    e.dead = true; e.hp = 0;
    const p = g.p, D = e.D;
    g.ws.stats.kills++;
    if (e.id && !e.master) g.ws.dead[e.id] = g.ws.epoch;
    G.burst(g, e.x, e.y, (D || e.B).pal[0], e.boss ? 40 : 12, e.boss ? 120 : 70, 0.6);
    G.sfx(e.boss ? 'boss' : 'hit');
    if (e.boss) { G.bossDefeated(g, e); return; }
    if (e.noLoot) { if (e.type === 'slime') return; }
    // gold
    if (!e.noLoot) {
      const gr = D.gold;
      let base = G.randi(gr[0], gr[1]);
      if (e.type === 'thief') base *= 3;
      if (base > 0 || e.elite) goldDrop(g, e.x, e.y, base * (e.elite ? 2.5 : 1), e.tier);
      // objetos
      const luck = G.luck(g);
      let chance = 0.09 + p.st.looter + (e.elite ? 0.6 : 0) + (e.type === 'thief' ? 1 : 0) + (e.type === 'mimic' ? 1 : 0);
      if (G.chance(Math.min(1, chance))) {
        const it = G.rollLoot(e.tier, luck + (e.elite ? 0.25 : 0), { minRar: e.elite ? 1 : (e.type === 'mimic' ? 2 : 0), consChance: e.elite ? 0.25 : 0.6 });
        G.spawnDrop(g, e.x, e.y, 'item', { item: it });
      }
      if (G.chance(0.08)) G.spawnDrop(g, e.x, e.y, 'orb', { amt: 0.12 });
      if (e.elite && G.chance(0.5)) G.spawnDrop(g, e.x, e.y, 'item', { item: G.randomCons(e.tier) });
    }
    if (e.type === 'slime' && !e.mini && !e.noLoot) {
      for (let i = 0; i < 2; i++) { const m = G.makeEnemy('slime', e.tier, e.x + G.rand(-6, 6), e.y + G.rand(-6, 6), null, true); m.state = 'chase'; m.noLoot = true; g.enemies.push(m); }
    }
    if (e.elite === 'explosive') G.addTele(g, { x: e.x, y: e.y, r: 38, delay: 0.7, dmg: e.dmg * 1.6, col: '#ff7a3a', src: e });
    if (e.elite) G.toast(g, 'Élite derrotado: ' + D.name, G.ELITE_MODS[e.elite].col);
  };

  G.bossDefeated = function (g, b) {
    const p = g.p, ws = g.ws;
    ws.stats.bosses++;
    if (b.arenaKey) ws.done['b:' + b.arenaKey] = 1;
    g.enemies.forEach((e) => { if (e.master === b && !e.dead) { e.hp = 0; e.dead = true; G.burst(g, e.x, e.y, '#c070ff', 10, 60); } });
    const pts = 3 + Math.min(8, ws.stats.bosses - 1) + p.st.bossPts + (ws.hardcore ? 1 : 0);
    p.pts += pts;
    const luck = G.luck(g);
    for (let i = 0; i < 3; i++) G.spawnDrop(g, b.x + G.rand(-14, 14), b.y + G.rand(-14, 14), 'item', { item: G.genGear(b.tier + 1, G.rollRarity(luck + 0.25, i === 0 ? 3 : 2)) });
    for (let i = 0; i < 2; i++) G.spawnDrop(g, b.x + G.rand(-14, 14), b.y + G.rand(-14, 14), 'item', { item: G.randomCons(b.tier + 1) });
    for (let i = 0; i < 5; i++) goldDrop(g, b.x + G.rand(-16, 16), b.y + G.rand(-16, 16), 14, b.tier);
    G.spawnDrop(g, b.x, b.y, 'orb', { amt: 0.5 });
    g.boss = null;
    if (g.openGates) g.openGates(b);
    G.sfx('win'); g.shake = 10;
    G.toast(g, '¡' + b.name + ' derrotado! +' + pts + ' puntos de habilidad', '#ffd24a');
    g.pendingReward = { t: 2.2, pts, boss: b.name };
  };

  /* ---------- Explosiones ---------- */
  G.breakCracks = function (g, x, y, r) {
    const L = g.level, tx0 = Math.floor((x - r) / TS), tx1 = Math.floor((x + r) / TS), ty0 = Math.floor((y - r) / TS), ty1 = Math.floor((y + r) / TS);
    let n = 0;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (L.t(tx, ty) === G.T.CRACK && G.dist(tx * TS + 8, ty * TS + 8, x, y) <= r + 8) {
        const ch = L.chunk(G.fdiv(tx, G.CS), G.fdiv(ty, G.CS));
        L.set(tx, ty, ch.kind === 'ruins' ? G.T.RFLOOR : G.T.DFLOOR, 0, true); n++;
      }
    }
    if (n) { g.ws.stats.secrets++; G.toast(g, '¡Una pared secreta se derrumba!', '#d8c8ff'); G.burst(g, x, y, '#a79ac0', 20, 80, 0.7); }
  };
  G.explode = function (g, x, y, r, dmg, owner, o) {
    o = o || {};
    g.fx.push({ k: 'ring', x, y, r, t: 0, life: 0.3, col: o.col || '#ff9a2e' });
    G.burst(g, x, y, o.col || '#ff9a2e', 14, 90, 0.5);
    G.sfx('boom'); g.shake = Math.max(g.shake, Math.min(6, 2 + r / 20));
    if (owner === 'p') {
      for (const e of g.enemies.slice()) {
        if (e.dead) continue;
        if (G.dist(x, y, e.x, e.y) <= r + e.r) G.damageEnemy(g, e, dmg, { kb: o.kb || 80, ang: G.ang(x, y, e.x, e.y), status: o.status, stun: o.stun, noLeech: o.noLeech, col: o.col });
      }
      if (g.boss && !g.boss.dead && g.enemies.indexOf(g.boss) < 0 && G.dist(x, y, g.boss.x, g.boss.y) <= r + g.boss.r) G.damageEnemy(g, g.boss, dmg, { status: o.status, stun: o.stun });
      if (r >= 18) G.breakCracks(g, x, y, r);
    } else {
      const p = g.p;
      if (G.dist(x, y, p.x, p.y) <= r + 4) G.hurtPlayer(g, dmg, { src: o.src, kb: o.kb || 120, ang: G.ang(x, y, p.x, p.y) });
    }
  };

  /* ---------- Ataque del jugador ---------- */
  G.playerAttack = function (g) {
    const p = g.p, w = G.weapon(p), W = G.WTYPES[w.wt], s = p.st;
    if (p.atkCd > 0 || p.dead || p.dodgeT > 0) return false;
    const aspd = s.as * (p.buff.rage > 0 ? 1.25 : 1);
    p.atkCd = (w.rate || W.rate) / aspd;
    p.swing = 0.16; p.swingA = p.aim;
    const base = w.min + Math.random() * (w.max - w.min);
    const sOpts = playerStatusOpts(g, {});
    if (W.melee) {
      G.sfx('swing');
      const rangeBonus = w.wt === 'fist' ? 0 : 0;
      let hit = false;
      const targets = g.enemies.concat(g.boss && g.enemies.indexOf(g.boss) < 0 ? [g.boss] : []);
      const hr = rollHit(g, base * s.dmg * (p.buff.rage > 0 ? 1.3 : 1) * (p.buff.rageP > 0 ? 1.4 : 1), { consumeCounter: true });
      let used = false;
      for (const e of targets) {
        if (e.dead || e.alpha === 0) continue;
        const d = G.dist(p.x, p.y, e.x, e.y) - e.r;
        if (d > W.range + rangeBonus) continue;
        const ad = Math.abs(G.angDiff(p.aim, G.ang(p.x, p.y, e.x, e.y)));
        const widen = Math.atan2(e.r + 2, Math.max(8, d + e.r));
        if (ad > W.arc / 2 + widen) continue;
        const r2 = used ? rollHit(g, base * s.dmg * (p.buff.rage > 0 ? 1.3 : 1) * (p.buff.rageP > 0 ? 1.4 : 1), {}) : hr; used = true;
        G.damageEnemy(g, e, r2.dmg, { crit: r2.crit, kb: w.wt === 'axe' ? 190 : 120, ang: p.aim, status: sOpts });
        hit = true;
      }
      g.fx.push({ k: 'slash', x: p.x, y: p.y, ang: p.aim, arc: W.arc, range: W.range, t: 0, life: 0.16, thrust: !!W.thrust, col: G.RARITY[w.rar || 0].c });
      if (hit) { g.shake = Math.max(g.shake, 1.2); }
    } else {
      const pr = W.proj, magic = !!pr.magic;
      const hr = rollHit(g, base * s.dmg * (p.buff.rage > 0 ? 1.3 : 1) * (p.buff.rageP > 0 ? 1.4 : 1), { ranged: true, magic, consumeCounter: true });
      G.sfx(magic ? 'magic' : 'shoot');
      G.addProj(g, { x: p.x + Math.cos(p.aim) * 6, y: p.y - 2 + Math.sin(p.aim) * 6, vx: Math.cos(p.aim) * pr.spd, vy: Math.sin(p.aim) * pr.spd, r: pr.r, dmg: hr.dmg, crit: hr.crit, from: 'p', life: pr.life, col: pr.col, magic, pierce: s.pierce + (magic ? 0 : (w.aff.pierce || 0) * 0), explode: pr.explode ? pr.explode + (magic ? 4 : 0) : 0, status: sOpts, kb: 70 });
    }
    return true;
  };

  /* ---------- Proyectiles ---------- */
  G.updateProjs = function (g, dt) {
    const L = g.level, p = g.p;
    for (let i = g.projs.length - 1; i >= 0; i--) {
      const q = g.projs[i];
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      let dead = q.life <= 0;
      if (!dead && L.solidPx(q.x, q.y, true)) {
        // los proyectiles chocan con paredes y objetos sólidos (no con agua/lava)
        dead = true; G.burst(g, q.x, q.y, q.col, 3, 30, 0.25);
        if (q.from === 'p' && q.explode) G.explode(g, q.x, q.y, q.explode, q.dmg * 0.6, 'p', { status: q.status, col: q.col });
        if (q.from === 'p' && q.bomb) G.explode(g, q.x, q.y, q.bomb, q.dmg, 'p', { status: q.status, col: q.col });
      }
      if (!dead && q.from === 'e' && !p.dead) {
        if (G.dist(q.x, q.y, p.x, p.y) < q.r + 4) {
          const hit = G.hurtPlayer(g, q.dmg, { src: q.src, kb: 50, ang: Math.atan2(q.vy, q.vx), poison: q.poison, burn: q.burn });
          if (hit || p.dodgeI > 0 || p.invuln > 0) { if (hit) dead = true; }
        }
      } else if (!dead && q.from === 'p') {
        const targets = g.boss && g.enemies.indexOf(g.boss) < 0 ? g.enemies.concat([g.boss]) : g.enemies;
        for (const e of targets) {
          if (e.dead || (q.hit && q.hit.has(e))) continue;
          if (G.dist(q.x, q.y, e.x, e.y) < q.r + e.r) {
            q.hit = q.hit || new Set(); q.hit.add(e);
            G.damageEnemy(g, e, q.dmg, { crit: q.crit, kb: q.kb, ang: Math.atan2(q.vy, q.vx), status: q.status, col: q.magic ? '#9ad0ff' : null });
            if (q.explode) G.explode(g, q.x, q.y, q.explode, q.dmg * 0.55, 'p', { status: q.status, col: q.col, noLeech: true });
            if (q.bomb) G.explode(g, q.x, q.y, q.bomb, q.dmg, 'p', { status: q.status, col: q.col });
            if (q.frag) q.frag(q.x, q.y);
            if (q.pierce > 0) q.pierce--; else { dead = true; break; }
          }
        }
      }
      if (dead && q.from === 'p' && q.frag && q.life <= 0) q.frag(q.x, q.y);
      if (dead) g.projs.splice(i, 1);
    }
  };

  /* ---------- Efectos: telegráficos, zonas, anillos, bombas, rayos ---------- */
  G.updateFx = function (g, dt) {
    const p = g.p;
    for (let i = g.fx.length - 1; i >= 0; i--) {
      const f = g.fx[i];
      f.t += dt;
      let rm = false;
      switch (f.k) {
        case 'tele':
          if (f.t >= f.delay) {
            rm = true;
            G.burst(g, f.x, f.y, f.col, 12, 70, 0.4);
            if (f.owner === 'e') {
              if (f.dmg > 0) {
                if (G.dist(f.x, f.y, p.x, p.y) <= f.r + 3) G.hurtPlayer(g, f.dmg, { src: f.src, kb: f.kb || 90, ang: G.ang(f.x, f.y, p.x, p.y), poison: f.status === 'poison', burn: f.status === 'burn' });
                if (f.r > 22) { g.shake = Math.max(g.shake, 2.5); G.sfx('boom'); }
              }
              if (f.after) { const off = Math.random() * 6.283; for (let k = 0; k < f.after.ring; k++) G.addProj(g, { x: f.x, y: f.y, vx: Math.cos(off + k / f.after.ring * 6.283) * f.after.spd, vy: Math.sin(off + k / f.after.ring * 6.283) * f.after.spd, dmg: f.after.dmg, r: 3, life: 2.2, col: f.after.col, from: 'e', src: f.src }); }
              if (f.leave) G.addZone(g, { x: f.x, y: f.y, r: f.r, life: f.leave.life, dmg: f.leave.dmg, status: f.leave.status, col: f.leave.col, src: f.src });
            } else {
              for (const e of g.enemies.concat(g.boss && g.enemies.indexOf(g.boss) < 0 ? [g.boss] : [])) if (!e.dead && G.dist(f.x, f.y, e.x, e.y) <= f.r + e.r) G.damageEnemy(g, e, f.dmg, { kb: 120, ang: G.ang(f.x, f.y, e.x, e.y), status: f.statusO, stun: f.stun, col: f.col });
              G.breakCracks(g, f.x, f.y, f.r); G.sfx('boom'); g.shake = Math.max(g.shake, 5);
              g.fx.push({ k: 'ring', x: f.x, y: f.y, r: f.r, t: 0, life: 0.3, col: f.col });
            }
          }
          break;
        case 'zone':
          f.tick += dt;
          if (f.tick >= f.every) {
            f.tick -= f.every;
            if (f.owner === 'e') { if (G.dist(f.x, f.y, p.x, p.y) <= f.r) G.hurtPlayer(g, f.dmg, { src: f.src, poison: f.status === 'poison', burn: f.status === 'burn', dot: true }); }
            else for (const e of g.enemies.concat(g.boss && g.enemies.indexOf(g.boss) < 0 ? [g.boss] : [])) if (!e.dead && G.dist(f.x, f.y, e.x, e.y) <= f.r + e.r) G.damageEnemy(g, e, f.dmg, { noLeech: false, col: f.col, status: f.statusO });
            if (f.arrows) G.burst(g, f.x + G.rand(-f.r, f.r), f.y + G.rand(-f.r, f.r), '#e8dcb0', 3, 20, 0.3);
          }
          if (f.t >= f.life) rm = true;
          break;
        case 'bomb':
          if (f.t >= f.delay) { rm = true; G.explode(g, f.x, f.y, f.r, f.dmg, 'p', { col: '#ff9a2e', kb: 140 }); }
          break;
        case 'ring': case 'slash': case 'bolt': if (f.t >= f.life) rm = true; break;
        case 'delayed': if (f.t >= f.delay) { rm = true; f.fn(); } break;
      }
      if (rm) g.fx.splice(i, 1);
    }
  };

  /* ---------- Estados de enemigos ---------- */
  G.updateEnemyStatus = function (g, e, dt) {
    const st = e.st;
    if (st.burn > 0) { st.burn -= dt; st.bt += dt; if (st.bt >= 0.5) { st.bt -= 0.5; G.dot(g, e, (st.bdps || 4) * 0.5, '#ff8a2a'); } if (Math.random() < 0.15) g.parts.push({ x: e.x + G.rand(-3, 3), y: e.y - 2, vx: 0, vy: -20, t: 0, max: 0.4, col: '#ff8a2a', size: 1 }); }
    if (st.poison > 0) { st.poison -= dt; st.pt += dt; if (st.pt >= 0.5) { st.pt -= 0.5; G.dot(g, e, (st.pdps || 3) * 0.5, '#8bd04a'); } }
    if (st.slow > 0) st.slow -= dt;
    if (st.stun > 0) st.stun -= dt;
  };

  /* ---------- Habilidades activas ---------- */
  function targetsAll(g) { return g.enemies.concat(g.boss && g.enemies.indexOf(g.boss) < 0 ? [g.boss] : []).filter((e) => !e.dead); }
  function aimPoint(g, maxd) {
    const p = g.p;
    let dx = g.aimX - p.x, dy = g.aimY - p.y;
    const d = Math.hypot(dx, dy);
    if (d > maxd) { dx = dx / d * maxd; dy = dy / d * maxd; }
    return { x: p.x + dx, y: p.y + dy };
  }
  G.castSkill = function (g, id) {
    const p = g.p, s = p.st, l = G.skillLvl(p, id), A = G.ACT[id];
    if (!l || p.dead) return false;
    const avg = G.avgDmg(p);
    const sOpts = playerStatusOpts(g, {});
    switch (id) {
      case 'whirl': {
        const R = 32 + 3 * l, dm = avg * (1.1 + 0.2 * l);
        let healed = 0;
        g.fx.push({ k: 'ring', x: p.x, y: p.y, r: R, t: 0, life: 0.3, col: '#e8e4d0' });
        p.swing = 0.3; G.sfx('swing');
        for (const e of targetsAll(g)) if (G.dist(p.x, p.y, e.x, e.y) <= R + e.r) {
          const hr = rollHit(g, dm, {});
          G.damageEnemy(g, e, hr.dmg, { crit: hr.crit, kb: 160, status: sOpts });
          if (s.mWhirl && healed < 0.1) { const h = 0.02 * s.mWhirl; healed += h; p.hp = Math.min(p.hpMax, p.hp + p.hpMax * h); }
        }
        break;
      }
      case 'rage': p.buff.rage = 6 + l + 2 * s.mRage; G.toast(g, 'Furia', '#ff6a3a'); G.burst(g, p.x, p.y, '#ff6a3a', 16, 80); G.sfx('magic'); break;
      case 'guard': p.shield = Math.max(p.shield, 25 + 18 * l); p.shieldT = 8; G.burst(g, p.x, p.y, '#7ad7ff', 14, 60); G.sfx('magic'); break;
      case 'heal': {
        const h = p.hpMax * (22 + 6 * l) / 100;
        p.hp = Math.min(p.hpMax, p.hp + h); p.stat.poison = 0; p.stat.burn = 0;
        if (s.mHeal) { p.shield = Math.max(p.shield, p.hpMax * 0.1 * s.mHeal); p.shieldT = 6; }
        G.floatText(g, p.x, p.y - 14, '+' + Math.round(h), '#7aff9a'); G.burst(g, p.x, p.y, '#7aff9a', 18, 60); G.sfx('heal');
        break;
      }
      case 'blink': {
        const maxd = 64 + 10 * l;
        const dest = aimPoint(g, maxd), ox = p.x, oy = p.y;
        const dd = G.dist(ox, oy, dest.x, dest.y), ang = G.ang(ox, oy, dest.x, dest.y);
        let best = 0;
        for (let d = 4; d <= dd; d += 4) { if (G.collides(g.level, ox + Math.cos(ang) * d, oy + Math.sin(ang) * d, p.r, false)) break; best = d; }
        if (best < 6) return false;
        G.burst(g, ox, oy, '#b070ff', 14, 70);
        p.x = ox + Math.cos(ang) * best; p.y = oy + Math.sin(ang) * best; p.invuln = Math.max(p.invuln, 0.4);
        G.burst(g, p.x, p.y, '#b070ff', 14, 70); G.sfx('dodge');
        if (s.mBlink) { const dm = avg * (0.9 + 0.3 * s.mBlink); G.explode(g, ox, oy, 34, dm, 'p', { col: '#b070ff' }); G.explode(g, p.x, p.y, 34, dm, 'p', { col: '#b070ff' }); }
        break;
      }
      case 'volley': {
        const n = 5 + l, dm = avg * (0.7 + 0.09 * l);
        for (let i = 0; i < n; i++) {
          const a = p.aim + (i / (n - 1) - 0.5) * 0.95;
          const hr = rollHit(g, dm, { ranged: true });
          G.addProj(g, { x: p.x, y: p.y - 2, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 2.5, dmg: hr.dmg, crit: hr.crit, from: 'p', life: 0.8, col: '#e8dcb0', pierce: s.pierce, explode: s.mVolley ? 8 * s.mVolley + 8 : 0, status: sOpts, kb: 60 });
        }
        G.sfx('shoot');
        break;
      }
      case 'rainarrows': {
        const pt = aimPoint(g, 220), dm = avg * (0.55 + 0.08 * l) * s.rdmg;
        G.addZone(g, { x: pt.x, y: pt.y, r: 40 * (1 + 0.25 * s.mRain), life: 3 + 1.5 * s.mRain, every: 0.25, dmg: dm, owner: 'p', col: '#e8dcb0', arrows: true, statusO: sOpts });
        G.sfx('shoot');
        break;
      }
      case 'fireball': {
        const dm = avg * (1.5 + 0.28 * l) * s.magic, R = 26 + 2 * l, frag = s.mFire;
        const st = Object.assign({}, sOpts, { burn: true });
        G.addProj(g, { x: p.x, y: p.y - 2, vx: Math.cos(p.aim) * 190, vy: Math.sin(p.aim) * 190, r: 5, dmg: dm, from: 'p', life: 1.4, col: '#ff8a2a', magic: true, bomb: R, status: st, kb: 100,
          frag: frag ? (x, y) => { for (let k = 0; k < frag * 2; k++) { const a = k / (frag * 2) * 6.283 + Math.random(); G.addProj(g, { x, y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, r: 3, dmg: dm * 0.3, from: 'p', life: 0.45, col: '#ffb040', magic: true, bomb: 14, status: st }); } } : null });
        G.sfx('magic');
        break;
      }
      case 'frostnova': {
        const R = 56 + 5 * l, dm = avg * (0.9 + 0.16 * l) * s.magic;
        g.fx.push({ k: 'ring', x: p.x, y: p.y, r: R, t: 0, life: 0.4, col: '#9ae0ff' });
        G.burst(g, p.x, p.y, '#9ae0ff', 24, 110, 0.6); G.sfx('magic');
        for (const e of targetsAll(g)) if (G.dist(p.x, p.y, e.x, e.y) <= R + e.r) G.damageEnemy(g, e, dm, { kb: 90, status: { slow: true, burn: sOpts.burn, poison: sOpts.poison, bdps: sOpts.bdps, pdps: sOpts.pdps }, stun: s.mFrost ? 0.6 * s.mFrost : 0, col: '#9ae0ff' });
        break;
      }
      case 'lightning': {
        const all = targetsAll(g);
        let cur = null, bd = 190;
        for (const e of all) { const d = G.dist(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; cur = e; } }
        if (!cur) return false;
        const hits = new Set(), pts = [[p.x, p.y - 4]];
        const n = 3 + l + 2 * s.mLight;
        let dm = avg * (1.2 + 0.18 * l) * s.magic;
        for (let i = 0; i < n && cur; i++) {
          hits.add(cur); pts.push([cur.x, cur.y - 2]);
          const hr = rollHit(g, dm, { magic: false });
          G.damageEnemy(g, cur, hr.dmg, { crit: hr.crit, status: sOpts, stun: s.mLight ? 0.4 : 0, col: '#ffee70', kb: 30 });
          dm *= 0.9;
          let next = null, nd = 95;
          for (const e of all) if (!hits.has(e) && !e.dead) { const d = G.dist(cur.x, cur.y, e.x, e.y); if (d < nd) { nd = d; next = e; } }
          cur = next;
        }
        g.fx.push({ k: 'bolt', pts, t: 0, life: 0.3 });
        G.sfx('magic'); g.shake = Math.max(g.shake, 2);
        break;
      }
      case 'meteor': {
        const pt = aimPoint(g, 230), dm = avg * (4.2 + 0.7 * l) * s.magic;
        G.addTele(g, { x: pt.x, y: pt.y, r: 40, delay: 1.0, dmg: dm, owner: 'p', col: '#ff5a2a', statusO: Object.assign({}, sOpts, { burn: true }) });
        for (let k = 0; k < 2 * s.mMeteor; k++) { const a = Math.random() * 6.283, rr = G.rand(30, 70); G.addTele(g, { x: pt.x + Math.cos(a) * rr, y: pt.y + Math.sin(a) * rr, r: 32, delay: 1.2 + k * 0.2, dmg: dm * 0.6, owner: 'p', col: '#ff5a2a' }); }
        G.sfx('boss');
        break;
      }
      default: return false;
    }
    p.cds[id] = A.cd(l) * (1 - s.cdr);
    p.cdMax[id] = p.cds[id];
    return true;
  };

  /* ---------- Consumibles ---------- */
  G.useConsumable = function (g, id) {
    const p = g.p;
    if (p.dead || !G.countCons(p, id)) return false;
    let ok = true;
    switch (id) {
      case 'hp1': if (p.hp >= p.hpMax) { G.toast(g, 'Ya tienes la vida completa'); return false; } p.hp = Math.min(p.hpMax, p.hp + 40); G.floatText(g, p.x, p.y - 14, '+40', '#7aff9a'); G.sfx('heal'); break;
      case 'hp2': if (p.hp >= p.hpMax) { G.toast(g, 'Ya tienes la vida completa'); return false; } p.hp = Math.min(p.hpMax, p.hp + 120); G.floatText(g, p.x, p.y - 14, '+120', '#7aff9a'); G.sfx('heal'); break;
      case 'antidote': p.stat.poison = 0; p.stat.burn = 0; p.hp = Math.min(p.hpMax, p.hp + 20); G.sfx('heal'); break;
      case 'speed': p.buff.speedP = 30; G.toast(g, '+35% de velocidad (30 s)', '#4ae0e0'); G.sfx('magic'); break;
      case 'rage': p.buff.rageP = 30; G.toast(g, '+40% de daño (30 s)', '#ff8a2a'); G.sfx('magic'); break;
      case 'ward': p.shield = Math.max(p.shield, 60); p.shieldT = 30; G.toast(g, 'Escudo de 60 (30 s)', '#7ad7ff'); G.sfx('magic'); break;
      case 'clover': p.buff.clover = 90; G.toast(g, 'Suerte aumentada (90 s)', '#4ec96a'); G.sfx('magic'); break;
      case 'bomb': g.fx.push({ k: 'bomb', x: p.x + Math.cos(p.aim) * 10, y: p.y + Math.sin(p.aim) * 10, t: 0, delay: 1.0, r: 46, dmg: 35 + G.avgDmg(p) * 2.2 }); G.sfx('ui'); break;
      case 'tele': if (!(g.teleportToSave && g.teleportToSave())) return false; G.sfx('magic'); break;
      case 'map': { G.markExplored(g.ws, Math.floor(p.x / TS), Math.floor(p.y / TS), 70); G.toast(g, 'El mapa revela los alrededores', '#e8dcb0'); G.sfx('pickup'); break; }
      default: ok = false;
    }
    if (ok) G.takeCons(p, id);
    return ok;
  };
})();
