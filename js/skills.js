'use strict';
/* Árbol de habilidades con desbloqueos encadenados, activas, pasivas, maestrías y nodos infinitos. */
(function () {
  const G = window.G;

  G.BRANCHES = {
    war: { n: 'Guerrero', c: '#e0534a' },
    hunt: { n: 'Cazador', c: '#e8b84a' },
    arc: { n: 'Arcano', c: '#7a9aff' },
    surv: { n: 'Supervivencia', c: '#4ec96a' },
    fort: { n: 'Fortuna', c: '#f2c94c' },
    mast: { n: 'Maestrías', c: '#d070ff' },
    asc: { n: 'Ascensión ∞', c: '#ffffff' },
  };

  const cf = (base, step) => (l) => base + Math.floor(l * step); // coste del siguiente nivel (l = nivel actual)
  const S = [];
  const add = (o) => { o.cost = o.cost || [1]; S.push(o); };

  /* ----- Raíces (sin requisitos) ----- */
  add({ id: 'vigor', n: 'Vigor', b: 'surv', t: 'p', max: 5, cost: [1, 1, 2, 2, 3], req: [], d: '+12 vida máxima por nivel.', eff: (l, s) => (s.hp += 12 * l) });
  add({ id: 'fuerza', n: 'Fuerza', b: 'war', t: 'p', max: 5, cost: [1, 1, 2, 2, 3], req: [], d: '+6% de daño por nivel.', eff: (l, s) => (s.dmg += 0.06 * l) });
  add({ id: 'agilidad', n: 'Agilidad', b: 'hunt', t: 'p', max: 5, cost: [1, 1, 2, 2, 3], req: [], d: '+4% de velocidad de movimiento por nivel.', eff: (l, s) => (s.spd += 0.04 * l) });
  add({ id: 'foco', n: 'Foco Arcano', b: 'arc', t: 'p', max: 5, cost: [1, 1, 2, 2, 3], req: [], d: '+8% de poder mágico por nivel (habilidades y bastones).', eff: (l, s) => (s.magic += 0.08 * l) });
  add({ id: 'punteria', n: 'Puntería', b: 'hunt', t: 'p', max: 5, cost: [1, 1, 2, 2, 3], req: [], d: '+8% de daño con proyectiles (arcos, bastones, flechas).', eff: (l, s) => (s.rdmg += 0.08 * l) });
  add({ id: 'codicia', n: 'Codicia', b: 'fort', t: 'p', max: 5, cost: [1, 1, 2, 2, 3], req: [], d: '+10% de oro obtenido por nivel.', eff: (l, s) => (s.gold += 0.1 * l) });
  add({ id: 'whirl', n: 'Torbellino', b: 'war', t: 'a', max: 5, cost: [1, 2, 2, 3, 3], req: [], d: 'ACTIVA: giras y dañas a todos los enemigos cercanos. Más daño, radio y menos enfriamiento por nivel.' });

  /* ----- Guerrero ----- */
  add({ id: 'rage', n: 'Furia', b: 'war', t: 'a', max: 5, cost: [1, 2, 2, 3, 3], req: [['fuerza', 3]], d: 'ACTIVA: +30% de daño y +25% de velocidad de ataque unos segundos. Dura más por nivel.' });
  add({ id: 'golpe_critico', n: 'Golpe Crítico', b: 'war', t: 'p', max: 5, cost: [1, 2, 2, 3, 3], req: [['fuerza', 5]], d: '+3% de probabilidad de crítico por nivel.', eff: (l, s) => (s.crit += 0.03 * l) });
  add({ id: 'critico_letal', n: 'Crítico Letal', b: 'war', t: 'p', max: 5, cost: [2, 2, 3, 3, 4], req: [['golpe_critico', 5]], d: '+15% de daño crítico por nivel.', eff: (l, s) => (s.critDmg += 0.15 * l) });
  add({ id: 'ejecutor', n: 'Ejecutor', b: 'war', t: 'p', max: 3, cost: [2, 3, 4], req: [['critico_letal', 3]], d: '+12% de daño contra enemigos con menos del 30% de vida, por nivel.', eff: (l, s) => (s.exec += 0.12 * l) });
  add({ id: 'vampirismo', n: 'Vampirismo', b: 'war', t: 'p', max: 5, cost: [2, 2, 3, 3, 4], req: [['vigor', 3], ['fuerza', 3]], d: '+1.5% de robo de vida por nivel.', eff: (l, s) => (s.lifesteal += 0.015 * l) });

  /* ----- Supervivencia ----- */
  add({ id: 'piel', n: 'Piel de Hierro', b: 'surv', t: 'p', max: 5, cost: [1, 2, 2, 3, 3], req: [['vigor', 5]], d: '+2 de armadura por nivel (reduce el daño recibido).', eff: (l, s) => (s.def += 2 * l) });
  add({ id: 'recuperacion', n: 'Recuperación', b: 'surv', t: 'p', max: 5, cost: [1, 2, 2, 3, 3], req: [['vigor', 5]], d: '+0.5 PV/s de regeneración por nivel.', eff: (l, s) => (s.regen += 0.5 * l) });
  add({ id: 'guard', n: 'Bastión', b: 'surv', t: 'a', max: 5, cost: [1, 2, 2, 3, 3], req: [['piel', 2]], d: 'ACTIVA: escudo que absorbe daño durante 8 s. Más absorción por nivel.' });
  add({ id: 'heal', n: 'Luz Sanadora', b: 'surv', t: 'a', max: 5, cost: [1, 2, 2, 3, 3], req: [['recuperacion', 2]], d: 'ACTIVA: restauras un porcentaje de tu vida máxima. Cura más por nivel.' });
  add({ id: 'ultimo_aliento', n: 'Último Aliento', b: 'surv', t: 'p', max: 3, cost: [2, 3, 4], req: [['recuperacion', 3], ['piel', 3]], d: 'Un golpe mortal te deja con 1 PV y 2 s de invulnerabilidad. Enfriamiento: 150/110/70 s.', eff: (l, s) => (s.lastBreath = [0, 150, 110, 70][l]) });

  /* ----- Cazador ----- */
  add({ id: 'blink', n: 'Paso Sombrío', b: 'hunt', t: 'a', max: 5, cost: [1, 2, 2, 3, 3], req: [['agilidad', 3]], d: 'ACTIVA: te teletransportas hacia el cursor y eres invulnerable un instante.' });
  add({ id: 'esquiva', n: 'Esquiva Fluida', b: 'hunt', t: 'p', max: 5, cost: [1, 2, 2, 3, 3], req: [['agilidad', 5]], d: 'La esquiva se recarga 10% más rápido y dura más por nivel.', eff: (l, s) => { s.dodgeCd *= 1 - 0.1 * l; s.iframes += 0.02 * l; } });
  add({ id: 'contragolpe', n: 'Contragolpe', b: 'hunt', t: 'p', max: 3, cost: [2, 3, 4], req: [['esquiva', 3]], d: 'Tras esquivar, tu siguiente ataque (1.2 s) hace +30% de daño por nivel.', eff: (l, s) => (s.counter += 0.3 * l) });
  add({ id: 'volley', n: 'Descarga de Flechas', b: 'hunt', t: 'a', max: 5, cost: [1, 2, 2, 3, 3], req: [['punteria', 2]], d: 'ACTIVA: disparas un abanico de flechas hacia el cursor. Más flechas y daño por nivel.' });
  add({ id: 'perforacion', n: 'Perforación', b: 'hunt', t: 'p', max: 3, cost: [2, 3, 4], req: [['punteria', 5]], d: 'Tus proyectiles atraviesan +1 enemigo por nivel.', eff: (l, s) => (s.pierce += l) });
  add({ id: 'ojo_halcon', n: 'Ojo de Halcón', b: 'hunt', t: 'p', max: 3, cost: [2, 3, 4], req: [['punteria', 5]], d: '+6% de crítico y +10% de daño con proyectiles por nivel.', eff: (l, s) => { s.crit += 0.06 * l; s.rdmg += 0.1 * l; } });
  add({ id: 'rainarrows', n: 'Lluvia de Flechas', b: 'hunt', t: 'a', max: 5, cost: [2, 3, 3, 4, 4], req: [['volley', 5], ['punteria', 3]], d: 'ACTIVA: una zona en el cursor recibe una lluvia de flechas durante 3 s.' });
  add({ id: 'toxinas', n: 'Toxinas', b: 'hunt', t: 'p', max: 5, cost: [1, 2, 2, 3, 3], req: [['volley', 3]], d: '+8% de probabilidad de envenenar por nivel.', eff: (l, s) => (s.poison += 0.08 * l) });

  /* ----- Arcano ----- */
  add({ id: 'fireball', n: 'Bola de Fuego', b: 'arc', t: 'a', max: 5, cost: [1, 2, 2, 3, 3], req: [['foco', 1]], d: 'ACTIVA: lanzas una bola de fuego explosiva que quema. Escala con poder mágico.' });
  add({ id: 'frostnova', n: 'Nova Gélida', b: 'arc', t: 'a', max: 5, cost: [1, 2, 2, 3, 3], req: [['foco', 3]], d: 'ACTIVA: onda de hielo que daña y ralentiza a los enemigos alrededor.' });
  add({ id: 'maestria_arcana', n: 'Maestría Arcana', b: 'arc', t: 'p', max: 5, cost: [2, 2, 3, 3, 4], req: [['foco', 5]], d: '-4% de enfriamiento de habilidades por nivel.', eff: (l, s) => (s.cdr += 0.04 * l) });
  add({ id: 'piromano', n: 'Pirómano', b: 'arc', t: 'p', max: 5, cost: [1, 2, 2, 3, 3], req: [['fireball', 3]], d: '+8% de probabilidad de quemar por nivel.', eff: (l, s) => (s.burn += 0.08 * l) });
  add({ id: 'criogenia', n: 'Criogenia', b: 'arc', t: 'p', max: 5, cost: [1, 2, 2, 3, 3], req: [['frostnova', 3]], d: '+8% de probabilidad de ralentizar por nivel.', eff: (l, s) => (s.slow += 0.08 * l) });
  add({ id: 'lightning', n: 'Rayo en Cadena', b: 'arc', t: 'a', max: 5, cost: [2, 3, 3, 4, 4], req: [['fireball', 5]], d: 'ACTIVA: un rayo salta entre enemigos. Más saltos y daño por nivel.' });
  add({ id: 'meteor', n: 'Meteoro', b: 'arc', t: 'a', max: 5, cost: [3, 3, 4, 4, 5], req: [['frostnova', 5], ['lightning', 3]], d: 'ACTIVA: un meteoro cae sobre el cursor tras 1 s con daño devastador.' });

  /* ----- Fortuna ----- */
  add({ id: 'bolsillos', n: 'Bolsillos Profundos', b: 'fort', t: 'p', max: 5, cost: [1, 2, 2, 3, 3], req: [['codicia', 3]], d: '+2 espacios de inventario por nivel.', eff: (l, s) => (s.inv += 2 * l) });
  add({ id: 'iman', n: 'Imán', b: 'fort', t: 'p', max: 3, cost: [1, 2, 3], req: [['codicia', 3]], d: '+14 de radio de recogida de botín por nivel.', eff: (l, s) => (s.magnet += 14 * l) });
  add({ id: 'buscador', n: 'Buscador', b: 'fort', t: 'p', max: 5, cost: [1, 2, 2, 3, 3], req: [['codicia', 5]], d: '+6% de suerte por nivel (mejor rareza del botín).', eff: (l, s) => (s.luck += 0.06 * l) });
  add({ id: 'cazatesoros', n: 'Cazatesoros', b: 'fort', t: 'p', max: 5, cost: [2, 2, 3, 3, 4], req: [['buscador', 3]], d: '+6% de probabilidad de que los enemigos suelten botín extra.', eff: (l, s) => (s.looter += 0.06 * l) });

  /* ----- Maestrías (se desbloquean al llevar al máximo una habilidad activa u otras cadenas) ----- */
  add({ id: 'm_whirl', n: 'Torbellino Sanguíneo', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['whirl', 5]], d: 'Cada enemigo golpeado por Torbellino te cura 2% de tu vida máx. por nivel.', eff: (l, s) => (s.mWhirl = l) });
  add({ id: 'm_fire', n: 'Fragmentación Ígnea', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['fireball', 5]], d: 'La bola de fuego libera 2 fragmentos por nivel al explotar.', eff: (l, s) => (s.mFire = l) });
  add({ id: 'm_frost', n: 'Congelación Profunda', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['frostnova', 5]], d: 'Nova Gélida aturde 0.6 s por nivel a los enemigos.', eff: (l, s) => (s.mFrost = l) });
  add({ id: 'm_light', n: 'Tormenta Eléctrica', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['lightning', 5]], d: '+2 saltos por nivel y el rayo aturde brevemente.', eff: (l, s) => (s.mLight = l) });
  add({ id: 'm_volley', n: 'Flechas Explosivas', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['volley', 5]], d: 'Las flechas de Descarga explotan (+8 de radio por nivel).', eff: (l, s) => (s.mVolley = l) });
  add({ id: 'm_blink', n: 'Paso Letal', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['blink', 5]], d: 'Paso Sombrío explota al salir y al llegar, dañando a los cercanos.', eff: (l, s) => (s.mBlink = l) });
  add({ id: 'm_rage', n: 'Frenesí', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['rage', 5]], d: 'Furia dura +2 s por nivel y otorga +8% de robo de vida mientras dura.', eff: (l, s) => (s.mRage = l) });
  add({ id: 'm_guard', n: 'Escudo Reflectante', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['guard', 5]], d: 'Mientras Bastión absorbe daño, devuelve 40% por nivel del daño absorbido al atacante.', eff: (l, s) => (s.mGuard = l) });
  add({ id: 'm_meteor', n: 'Lluvia de Meteoros', b: 'mast', t: 'p', max: 3, cost: [4, 5, 6], req: [['meteor', 5]], d: 'Cada Meteoro invoca 2 meteoros adicionales por nivel alrededor.', eff: (l, s) => (s.mMeteor = l) });
  add({ id: 'm_rain', n: 'Tormenta de Acero', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['rainarrows', 5]], d: 'Lluvia de Flechas dura +1.5 s y es 25% más ancha por nivel.', eff: (l, s) => (s.mRain = l) });
  add({ id: 'm_heal', n: 'Luz Duradera', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['heal', 5]], d: 'Luz Sanadora además te otorga un escudo del 10% de tu vida máx. por nivel.', eff: (l, s) => (s.mHeal = l) });
  add({ id: 'cazajefes', n: 'Cazajefes', b: 'mast', t: 'p', max: 5, cost: [2, 3, 3, 4, 5], req: [['fuerza', 5], ['critico_letal', 3]], d: '+8% de daño contra jefes por nivel.', eff: (l, s) => (s.bossDmg += 0.08 * l) });
  add({ id: 'erudito', n: 'Erudito de Batalla', b: 'mast', t: 'p', max: 3, cost: [3, 4, 5], req: [['cazajefes', 3]], d: '+1 punto de habilidad extra por jefe derrotado por nivel.', eff: (l, s) => (s.bossPts += l) });
  add({ id: 'trascendencia', n: 'Trascendencia', b: 'mast', t: 'p', max: 3, cost: [5, 6, 7], req: [['ejecutor', 3], ['ultimo_aliento', 3], ['esquiva', 5]], d: '+10% de daño, +10% de velocidad de ataque y +5% de movimiento por nivel.', eff: (l, s) => { s.dmg += 0.1 * l; s.as += 0.1 * l; s.spd += 0.05 * l; } });

  /* ----- Ascensión: nodos sin fin; la progresión nunca se agota ----- */
  const ASC = [['vigor', 5], ['fuerza', 5], ['agilidad', 5]];
  const ascCost = cf(3, 0.25);
  add({ id: 'asc_vit', n: 'Ascensión: Vitalidad', b: 'asc', t: 'p', max: 999, cost: ascCost, req: ASC, d: '+8 vida máxima y +0.05 PV/s por nivel. Sin límite.', eff: (l, s) => { s.hp += 8 * l; s.regen += 0.05 * l; } });
  add({ id: 'asc_pow', n: 'Ascensión: Poder', b: 'asc', t: 'p', max: 999, cost: ascCost, req: ASC, d: '+2.5% de daño por nivel. Sin límite.', eff: (l, s) => (s.dmg += 0.025 * l) });
  add({ id: 'asc_swift', n: 'Ascensión: Celeridad', b: 'asc', t: 'p', max: 999, cost: ascCost, req: ASC, d: '+1% de movimiento y +1.2% de velocidad de ataque por nivel. Sin límite.', eff: (l, s) => { s.spd += 0.01 * l; s.as += 0.012 * l; } });
  add({ id: 'asc_fate', n: 'Ascensión: Destino', b: 'asc', t: 'p', max: 999, cost: ascCost, req: ASC, d: '+1.5% de suerte, +2% de oro y +0.3% de crítico por nivel. Sin límite.', eff: (l, s) => { s.luck += 0.015 * l; s.gold += 0.02 * l; s.crit += 0.003 * l; } });
  add({ id: 'asc_guard', n: 'Ascensión: Resistencia', b: 'asc', t: 'p', max: 999, cost: ascCost, req: ASC, d: '+1 de armadura y -0.5% de enfriamiento (máx. total 45%) por nivel. Sin límite.', eff: (l, s) => { s.def += l; s.cdr += 0.005 * l; } });

  G.SKILLS = S;
  G.SKILL_BY_ID = {};
  S.forEach((s) => (G.SKILL_BY_ID[s.id] = s));

  G.skillCost = function (sk, lvl) { return typeof sk.cost === 'function' ? sk.cost(lvl) : sk.cost[Math.min(lvl, sk.cost.length - 1)]; };
  G.skillLvl = function (p, id) { return (p.skills && p.skills[id]) || 0; };
  G.skillUnlocked = function (p, sk) { return sk.req.every((r) => G.skillLvl(p, r[0]) >= r[1]); };
  G.skillReqText = function (p, sk) {
    return sk.req.filter((r) => G.skillLvl(p, r[0]) < r[1]).map((r) => G.SKILL_BY_ID[r[0]].n + ' ' + r[1] + '/' + G.skillLvl(p, r[0]));
  };
  G.canBuySkill = function (p, id) {
    const sk = G.SKILL_BY_ID[id];
    const l = G.skillLvl(p, id);
    if (!sk || l >= sk.max || !G.skillUnlocked(p, sk)) return false;
    return p.pts >= G.skillCost(sk, l);
  };
  G.buySkill = function (p, id) {
    if (!G.canBuySkill(p, id)) return false;
    const sk = G.SKILL_BY_ID[id];
    const l = G.skillLvl(p, id);
    p.pts -= G.skillCost(sk, l);
    p.spent = (p.spent || 0) + G.skillCost(sk, l);
    p.skills[id] = l + 1;
    if (sk.t === 'a' && l === 0) { // asignar a la primera ranura libre
      const slots = ['Q', 'E', 'R', 'F'];
      for (const k of slots) if (!p.bind[k]) { p.bind[k] = id; break; }
    }
    G.computeStats(p);
    return true;
  };
  G.heroLevel = function (p) { let n = 1; for (const k in p.skills) n += p.skills[k]; return n; };

  /* ---------- Habilidades activas: parámetros por nivel ---------- */
  G.ACT = {
    whirl: { n: 'Torbellino', ic: '🌀', col: '#e8e4d0', cd: (l) => 9 - 0.5 * l, info: (l) => 'Daño ' + Math.round(110 + 20 * l) + '% · radio ' + (32 + 3 * l) },
    rage: { n: 'Furia', ic: '💢', col: '#ff6a3a', cd: (l) => 26 - 2 * l, info: (l, s) => 'Dura ' + (6 + l + 2 * (s.mRage || 0)) + ' s' },
    guard: { n: 'Bastión', ic: '🛡', col: '#7ad7ff', cd: (l) => 22 - 1.5 * l, info: (l) => 'Absorbe ' + (25 + 18 * l) },
    heal: { n: 'Luz Sanadora', ic: '✚', col: '#7aff9a', cd: (l) => 32 - 2.5 * l, info: (l) => 'Cura ' + (22 + 6 * l) + '% de vida' },
    blink: { n: 'Paso Sombrío', ic: '✦', col: '#b070ff', cd: (l) => 7 - 0.6 * l, info: (l) => 'Distancia ' + (64 + 10 * l) },
    volley: { n: 'Descarga de Flechas', ic: '➶', col: '#e8dcb0', cd: (l) => 8 - 0.5 * l, info: (l) => (5 + l) + ' flechas · ' + Math.round(70 + 9 * l) + '% de daño' },
    rainarrows: { n: 'Lluvia de Flechas', ic: '☔', col: '#e8dcb0', cd: (l) => 16 - 1 * l, info: (l) => 'Zona durante 3 s · ' + Math.round(55 + 8 * l) + '%/golpe' },
    fireball: { n: 'Bola de Fuego', ic: '🔥', col: '#ff8a2a', cd: (l) => 5.5 - 0.3 * l, info: (l) => Math.round(150 + 28 * l) + '% de daño mágico' },
    frostnova: { n: 'Nova Gélida', ic: '❄', col: '#9ae0ff', cd: (l) => 11 - 0.7 * l, info: (l) => Math.round(90 + 16 * l) + '% de daño · radio ' + (56 + 5 * l) },
    lightning: { n: 'Rayo en Cadena', ic: '⚡', col: '#ffee70', cd: (l) => 8 - 0.5 * l, info: (l, s) => (3 + l + 2 * (s.mLight || 0)) + ' saltos · ' + Math.round(120 + 18 * l) + '% de daño' },
    meteor: { n: 'Meteoro', ic: '☄', col: '#ff5a2a', cd: (l) => 24 - 1.5 * l, info: (l) => Math.round(420 + 70 * l) + '% de daño mágico' },
  };

  /* ---------- Estadísticas del jugador ---------- */
  G.baseStats = function () {
    return { hp: 100, dmg: 1, crit: 0.05, critDmg: 1.5, spd: 1, as: 1, def: 0, regen: 0.4, lifesteal: 0, gold: 0, luck: 0, magic: 1, cdr: 0, burn: 0, poison: 0, slow: 0, pierce: 0, inv: 20, rdmg: 1, exec: 0, counter: 0, bossDmg: 0, bossPts: 0, dodgeCd: 0.9, iframes: 0.26, lastBreath: 0, magnet: 22, looter: 0,
      mWhirl: 0, mFire: 0, mFrost: 0, mLight: 0, mVolley: 0, mBlink: 0, mRage: 0, mGuard: 0, mMeteor: 0, mRain: 0, mHeal: 0 };
  };
  G.computeStats = function (p) {
    const s = G.baseStats();
    for (const sk of G.SKILLS) { const l = G.skillLvl(p, sk.id); if (l > 0 && sk.eff) sk.eff(l, s); }
    const items = [p.equip.weapon, p.equip.armor, p.equip.charm1, p.equip.charm2];
    for (const it of items) {
      if (!it) continue;
      if (it.kind === 'armor') s.def += it.def;
      for (const k in it.aff) {
        const v = it.aff[k];
        if (k === 'hp') s.hp += v; else if (k === 'def') s.def += v; else if (k === 'regen') s.regen += v; else if (k in s) s[k] += v;
      }
    }
    s.cdr = Math.min(0.5, s.cdr);
    s.crit = Math.min(0.85, s.crit);
    s.lifesteal = Math.min(0.3, s.lifesteal);
    s.burn = Math.min(0.9, s.burn); s.poison = Math.min(0.9, s.poison); s.slow = Math.min(0.9, s.slow);
    s.spd = Math.min(1.9, s.spd);
    s.as = Math.min(2.6, s.as);
    p.st = s;
    const old = p.hpMax || s.hp;
    p.hpMax = Math.round(s.hp);
    if (p.hp == null) p.hp = p.hpMax;
    if (p.hpMax > old) p.hp += p.hpMax - old;
    p.hp = Math.min(p.hp, p.hpMax);
    G.ensureInv(p);
    return s;
  };
})();
