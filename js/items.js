'use strict';
/* Generación de ítems (armas, armaduras, amuletos, consumibles), botín e inventario. */
(function () {
  const G = window.G;

  const AFFIX = {
    dmg: { suf: 'de Poder', r: [0.04, 0.1] }, crit: { suf: 'de Precisión', r: [0.02, 0.05] }, critDmg: { suf: 'de Ruina', r: [0.1, 0.25] },
    lifesteal: { suf: 'de Sangre', r: [0.01, 0.025] }, burn: { suf: 'de Fuego', r: [0.05, 0.12] }, poison: { suf: 'del Veneno', r: [0.05, 0.12] },
    slow: { suf: 'de Escarcha', r: [0.06, 0.14] }, as: { suf: 'de Tormenta', r: [0.04, 0.1] }, magic: { suf: 'de Arcano', r: [0.06, 0.15] },
    pierce: { suf: 'Perforante', r: [1, 1], flat: true }, hp: { suf: 'de Vida', r: [8, 20], flat: true }, def: { suf: 'de Roca', r: [1, 3], flat: true },
    regen: { suf: 'de Renacer', r: [0.2, 0.6], flat: true, dec: 1 }, spd: { suf: 'del Viento', r: [0.03, 0.07] }, cdr: { suf: 'del Tiempo', r: [0.03, 0.07] },
    gold: { suf: 'de Oro', r: [0.08, 0.2] }, luck: { suf: 'de la Fortuna', r: [0.04, 0.1] },
  };
  const POOL = {
    weapon: ['dmg', 'crit', 'critDmg', 'lifesteal', 'burn', 'poison', 'slow', 'as', 'magic', 'pierce'],
    armor: ['hp', 'def', 'regen', 'spd', 'cdr', 'gold', 'luck'],
    charm: ['crit', 'critDmg', 'lifesteal', 'spd', 'hp', 'def', 'regen', 'gold', 'luck', 'as', 'dmg', 'magic', 'cdr'],
  };
  const LEG = {
    sword: ['Rompealmas', 'Filo del Alba', 'Colmillo de Ceniza'], dagger: ['Susurro Letal', 'Aguja de Medianoche'], axe: ['Partemundos', 'Hambre del Verdugo'],
    spear: ['Lanza del Relámpago', 'Aguijón de Wyrm'], bow: ['Arco del Cazador Eterno', 'Cuerda del Eclipse'], staff: ['Báculo de las Estrellas', 'Ojo del Vacío'],
    armor: ['Coraza del Coloso', 'Manto del Último Rey', 'Escamas de Dragón'], charm: ['Corazón de la Cripta', 'Sello del Errante', 'Lágrima de Fénix'],
  };
  const ANAMES = ['Túnica', 'Coraza', 'Cota de malla', 'Capa', 'Peto'];
  const CNAMES = ['Amuleto', 'Anillo', 'Talismán', 'Reliquia', 'Colgante'];

  G.rollRarity = function (luck, min, rng) {
    rng = rng || Math.random;
    const l = Math.max(0, luck || 0);
    const w = [60 * Math.max(0.2, 1 - l * 0.8), 25 * (1 + l * 0.2), 10 * (1 + l * 1.2), 4 * (1 + l * 2.5), 1 * (1 + l * 5)];
    let tot = 0; w.forEach((x) => (tot += x));
    let r = rng() * tot, idx = 0;
    for (let i = 0; i < 5; i++) { r -= w[i]; if (r <= 0) { idx = i; break; } idx = i; }
    return Math.max(min || 0, idx);
  };

  function genAffixes(kind, count, tier, rng, wt) {
    let pool = POOL[kind].slice();
    if (kind === 'weapon' && !(G.WTYPES[wt] && !G.WTYPES[wt].melee)) pool = pool.filter((k) => k !== 'pierce');
    const aff = {};
    for (let i = 0; i < count && pool.length; i++) {
      const k = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      const A = AFFIX[k];
      let v = A.r[0] + (A.r[1] - A.r[0]) * rng();
      if (!(k === 'pierce')) v *= 1 + 0.07 * (tier - 1);
      if (A.flat) v = k === 'regen' ? Math.round(v * 10) / 10 : Math.round(v);
      else v = Math.round(v * 1000) / 1000;
      aff[k] = v;
    }
    return aff;
  }
  function nameFor(base, aff, rar, kind, rng, wt) {
    if (rar >= 4) return G.pick(LEG[kind === 'weapon' ? wt : kind], rng);
    const keys = Object.keys(aff);
    if (rar === 0 || !keys.length) return base;
    return base + ' ' + AFFIX[keys[0]].suf;
  }

  G.genWeapon = function (tier, rar, wt, rng) {
    rng = rng || Math.random;
    wt = wt || G.pick(G.WEAPON_KEYS, rng);
    const W = G.WTYPES[wt];
    const sc = (1 + 0.16 * (tier - 1)) * G.RARITY[rar].m * (0.92 + rng() * 0.16);
    const aff = genAffixes('weapon', G.RARITY[rar].aff, tier, rng, wt);
    const mn = Math.max(1, Math.round(W.min * sc)), mx = Math.max(mn + 1, Math.round(W.max * sc));
    return { uid: G.uid(), kind: 'weapon', wt, rar, tier, name: nameFor(W.n, aff, rar, 'weapon', rng, wt), min: mn, max: mx, rate: +(W.rate * (0.95 + rng() * 0.1)).toFixed(2), aff };
  };
  G.genArmor = function (tier, rar, rng) {
    rng = rng || Math.random;
    const m = G.RARITY[rar].m;
    const aff = genAffixes('armor', G.RARITY[rar].aff, tier, rng);
    return { uid: G.uid(), kind: 'armor', rar, tier, name: nameFor(G.pick(ANAMES, rng), aff, rar, 'armor', rng), def: Math.round((2 + tier * 1.6) * m * (0.9 + rng() * 0.2)), aff };
  };
  G.genCharm = function (tier, rar, rng) {
    rng = rng || Math.random;
    const aff = genAffixes('charm', Math.max(1, G.RARITY[rar].aff) + (rar >= 3 ? 0 : 0), tier, rng);
    return { uid: G.uid(), kind: 'charm', rar, tier, name: nameFor(G.pick(CNAMES, rng), aff, rar, 'charm', rng), aff };
  };
  G.genCons = function (id, n) { return { kind: 'cons', id, n: n || 1 }; };
  G.genGear = function (tier, rar, rng) {
    rng = rng || Math.random;
    const r = rng();
    if (r < 0.45) return G.genWeapon(tier, rar, null, rng);
    if (r < 0.75) return G.genArmor(tier, rar, rng);
    return G.genCharm(tier, rar, rng);
  };
  G.randomCons = function (tier, rng) {
    const pairs = G.CONS_DROP.filter((p) => p[0] !== 'hp2' || tier >= 2);
    return G.genCons(G.wpick(pairs, rng), 1);
  };
  /* Botín genérico: 55% consumible, 45% equipo. */
  G.rollLoot = function (tier, luck, o) {
    o = o || {};
    const rng = o.rng || Math.random;
    if (!o.gearOnly && rng() < (o.consChance != null ? o.consChance : 0.55)) return G.randomCons(tier, rng);
    return G.genGear(tier, G.rollRarity(luck, o.minRar || 0, rng), rng);
  };

  G.itemColor = (it) => (it.kind === 'cons' ? '#e9e2f5' : G.RARITY[it.rar].c);
  G.itemName = function (it) { return it.kind === 'cons' ? G.CONS[it.id].name : it.name; };
  G.itemValue = function (it) {
    if (it.kind === 'cons') return G.CONS[it.id].price;
    return Math.round((6 + it.tier * 5) * Math.pow(1.9, it.rar) * (it.kind === 'weapon' ? 1.2 : 1));
  };
  G.fmtAff = function (k, v) {
    const L = G.STAT_LABELS[k];
    if (!L) return k;
    if (L[1] === '%') return '+' + Math.round(v * 100) + '% ' + L[0];
    if (L[1] === 'r') return '+' + (Math.round(v * 10) / 10) + ' PV/s';
    return '+' + Math.round(v) + ' ' + L[0];
  };
  G.weaponStats = function (it) {
    const W = G.WTYPES[it.wt || 'fist'];
    const avg = (it.min + it.max) / 2;
    return { avg, dps: avg / it.rate, W };
  };
  G.itemHTML = function (it) {
    if (!it) return '';
    const col = G.itemColor(it);
    let h = '<div class="nm" style="color:' + col + '">' + G.itemName(it) + '</div>';
    if (it.kind === 'cons') {
      h += '<div style="color:#9a8fb5">Consumible' + (it.n > 1 ? ' ×' + it.n : '') + '</div><div>' + G.CONS[it.id].desc + '</div>';
      h += '<div style="color:#ffd24a">Valor: ' + G.itemValue(it) + ' oro</div>';
      return h;
    }
    const typeName = it.kind === 'weapon' ? G.WTYPES[it.wt].n : it.kind === 'armor' ? 'Armadura' : 'Amuleto';
    h += '<div style="color:#9a8fb5">' + G.RARITY[it.rar].n + ' · ' + typeName + ' · Nv.' + it.tier + '</div>';
    if (it.kind === 'weapon') { const s = G.weaponStats(it); h += '<div>Daño: ' + it.min + '–' + it.max + ' · Cadencia: ' + it.rate + 's</div><div style="color:#9a8fb5">DPS base ≈ ' + s.dps.toFixed(1) + (s.W.melee ? '' : ' (a distancia)') + '</div>'; }
    if (it.kind === 'armor') h += '<div>Armadura: ' + it.def + '</div>';
    for (const k in it.aff) h += '<div class="stat">' + G.fmtAff(k, it.aff[k]) + '</div>';
    h += '<div style="color:#ffd24a">Valor: ' + G.itemValue(it) + ' oro</div>';
    return h;
  };

  /* ---------- Inventario ---------- */
  G.ensureInv = function (p) {
    const n = p.st ? p.st.inv : 20;
    while (p.inv.length < n) p.inv.push(null);
  };
  G.invFree = function (p) { G.ensureInv(p); return p.inv.filter((x) => !x).length; };
  G.addToInv = function (p, it) {
    G.ensureInv(p);
    if (it.kind === 'cons') {
      for (let i = 0; i < p.inv.length; i++) {
        const s = p.inv[i];
        if (s && s.kind === 'cons' && s.id === it.id && s.n < 20) { const add = Math.min(20 - s.n, it.n); s.n += add; it.n -= add; if (it.n <= 0) return true; }
      }
    }
    for (let i = 0; i < p.inv.length; i++) if (!p.inv[i]) { p.inv[i] = it; return true; }
    return false;
  };
  G.countCons = function (p, id) { let n = 0; p.inv.forEach((s) => { if (s && s.kind === 'cons' && s.id === id) n += s.n; }); return n; };
  G.takeCons = function (p, id) {
    for (let i = 0; i < p.inv.length; i++) {
      const s = p.inv[i];
      if (s && s.kind === 'cons' && s.id === id) { s.n--; if (s.n <= 0) p.inv[i] = null; return true; }
    }
    return false;
  };
  G.equipFromInv = function (p, idx) {
    const it = p.inv[idx];
    if (!it || it.kind === 'cons') return false;
    let slot = it.kind === 'weapon' ? 'weapon' : it.kind === 'armor' ? 'armor' : !p.equip.charm1 ? 'charm1' : !p.equip.charm2 ? 'charm2' : 'charm1';
    const old = p.equip[slot];
    p.equip[slot] = it;
    p.inv[idx] = old || null;
    return true;
  };
  G.unequip = function (p, slot) {
    const it = p.equip[slot];
    if (!it) return false;
    G.ensureInv(p);
    const i = p.inv.findIndex((x) => !x);
    if (i < 0) return false;
    p.inv[i] = it; p.equip[slot] = null;
    return true;
  };
})();
