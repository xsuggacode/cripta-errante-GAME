'use strict';
/* Datos del juego: tiles, biomas, enemigos, jefes, armas, consumibles, rarezas. */
(function () {
  const G = window.G;

  /* ---------- Tiles: capa base (t) y capa de objetos (o) ---------- */
  const T = (G.T = { GRASS: 0, SAND: 1, SNOW: 2, MUD: 3, ASH: 4, WATER: 5, LAVA: 6, CFLOOR: 7, CWALL: 8, DFLOOR: 9, DWALL: 10, DOOR: 11, CRACK: 12, SPIKE: 13, AFLOOR: 14, AWALL: 15, RFLOOR: 16, RWALL: 17, TORCH: 18, ICE: 19 });
  const O = (G.O = { NONE: 0, TREE: 1, PINE: 2, CACTUS: 3, DEAD: 4, ROCK: 5, FLOWER: 6, TALL: 7, MUSH: 8, CHEST: 9, CHESTO: 10, SHRINE: 11, SHRINEON: 12, ALTAR: 13, ALTARU: 14, GATE: 15, FIRE: 16, PILLAR: 17, BONES: 18 });

  G.SOLID_T = new Uint8Array(32);
  [T.CWALL, T.DWALL, T.CRACK, T.AWALL, T.RWALL, T.TORCH].forEach((i) => (G.SOLID_T[i] = 1));
  G.SOLID_O = new Uint8Array(32);
  [O.TREE, O.PINE, O.CACTUS, O.DEAD, O.ROCK, O.CHEST, O.CHESTO, O.SHRINE, O.SHRINEON, O.ALTAR, O.ALTARU, O.GATE, O.FIRE, O.PILLAR].forEach((i) => (G.SOLID_O[i] = 1));
  G.DARK_T = new Uint8Array(32); // zonas oscuras (cuevas y mazmorras)
  [T.CFLOOR, T.DFLOOR, T.SPIKE, T.DOOR].forEach((i) => (G.DARK_T[i] = 1));
  G.ANIM_T = new Uint8Array(32);
  [T.WATER, T.LAVA, T.TORCH].forEach((i) => (G.ANIM_T[i] = 1));
  G.ANIM_O = new Uint8Array(32);
  [O.SHRINEON, O.FIRE, O.MUSH].forEach((i) => (G.ANIM_O[i] = 1));

  // Colores de mapa
  const MT = ['#4f9a3c', '#dcc27a', '#e8f0f8', '#4e5a34', '#3d3a40', '#2f6fb8', '#e0561f', '#6b6275', '#2b2631', '#8a84a0', '#3a3548', '#a9722f', '#9b8fb0', '#a05050', '#a88a5c', '#7a3030', '#9a957c', '#5a5648', '#ff9a2e', '#bfe3f2'];
  const MO = { 1: '#2f6e2a', 2: '#2a5a3a', 3: '#3f8f3f', 4: '#6a5a48', 5: '#8a8a92', 6: '#d878b0', 7: '#3f8a30', 8: '#7ad7ff', 9: '#ffd24a', 10: '#8a6a30', 11: '#59a0a0', 12: '#59e3e3', 13: '#d04a8a', 14: '#6a4a5a', 15: '#aaaaaa', 16: '#ff9a2e', 17: '#aaa', 18: '#e8e4d0' };
  G.MAPCOLS = ['#000'];
  G.MAP_T = [];
  G.MAP_O = [];
  (function () {
    const reg = (c) => { let i = G.MAPCOLS.indexOf(c); if (i < 0) { G.MAPCOLS.push(c); i = G.MAPCOLS.length - 1; } return i; };
    for (let i = 0; i < MT.length; i++) G.MAP_T[i] = reg(MT[i]);
    for (let i = 1; i <= 18; i++) G.MAP_O[i] = reg(MO[i]);
    G.MAP_O[0] = 0;
  })();

  /* ---------- Biomas ---------- */
  G.BIOMES = {
    grass: { name: 'Praderas', ground: T.GRASS, enemies: ['slime', 'goblin', 'bat', 'wolf'], boss: 'slimeking', weather: 'leaf' },
    forest: { name: 'Bosque Umbrío', ground: T.GRASS, enemies: ['goblin', 'wolf', 'spider', 'slime'], boss: 'treant', weather: 'leaf' },
    desert: { name: 'Desierto Ardiente', ground: T.SAND, enemies: ['scorpion', 'skeleton', 'bat', 'ghost'], boss: 'pharaoh', weather: 'sand' },
    snow: { name: 'Tundra Helada', ground: T.SNOW, enemies: ['wolf', 'skeleton', 'ghost', 'bat'], boss: 'frostqueen', weather: 'snow' },
    swamp: { name: 'Pantano Pútrido', ground: T.MUD, enemies: ['bog', 'spider', 'slime', 'cultist'], boss: 'hydra', weather: 'spore' },
    volcanic: { name: 'Tierras de Ceniza', ground: T.ASH, enemies: ['imp', 'golem', 'skeleton', 'cultist'], boss: 'magmagolem', weather: 'ash' },
  };
  G.DUNGEON_ENEMIES = ['skeleton', 'cultist', 'spider', 'goblin', 'ghost', 'bat'];
  G.CAVE_ENEMIES = ['bat', 'spider', 'slime', 'bat', 'ghost', 'golem'];

  /* ---------- Enemigos ---------- */
  // pal: [a, b, c, ojos]
  G.ENEMIES = {
    slime: { name: 'Slime', hp: 16, dmg: 5, spd: 30, r: 5, ai: 'hop', gold: [1, 3], shape: 'slime', pal: ['#5ac85a', '#9af09a', '#2f8a3a', '#1b1424'] },
    bat: { name: 'Murciélago', hp: 9, dmg: 4, spd: 62, r: 4, ai: 'flit', gold: [0, 2], shape: 'bat', pal: ['#6a4a8a', '#9a7aba', '#3a2a4a', '#ff4040'], fly: true, aggro: 130 },
    goblin: { name: 'Goblin', hp: 24, dmg: 7, spd: 44, r: 5, ai: 'charger', gold: [2, 5], shape: 'goblin', pal: ['#5aa83a', '#8a5a2a', '#1b1424', '#ff4040'] },
    skeleton: { name: 'Esqueleto', hp: 22, dmg: 6, spd: 34, r: 5, ai: 'archer', gold: [2, 5], shape: 'skel', pal: ['#e8e4d0', '#a8a090', '#403838', '#40e0ff'], aggro: 140 },
    spider: { name: 'Araña', hp: 15, dmg: 5, spd: 56, r: 5, ai: 'spider', gold: [1, 4], shape: 'spider', pal: ['#3a2a3a', '#6a4a6a', '#c04040', '#ff3030'], poison: true },
    cultist: { name: 'Cultista', hp: 20, dmg: 6, spd: 30, r: 5, ai: 'caster', gold: [3, 7], shape: 'robe', pal: ['#000', '#c0a040', '#7a2a5a', '#ff8040'], aggro: 150 },
    golem: { name: 'Gólem', hp: 70, dmg: 12, spd: 20, r: 8, ai: 'brute', gold: [6, 12], shape: 'golem', pal: ['#8a8a92', '#b0b0ba', '#5a5a62', '#ff7a30'], aggro: 100 },
    scorpion: { name: 'Escorpión', hp: 26, dmg: 7, spd: 40, r: 5, ai: 'scorp', gold: [2, 6], shape: 'scorpion', pal: ['#c08a3a', '#e8c070', '#7a5a20', '#ff3030'], poison: true },
    wolf: { name: 'Lobo', hp: 22, dmg: 7, spd: 58, r: 5, ai: 'wolf', gold: [2, 5], shape: 'wolf', pal: ['#8a8a96', '#b8b8c4', '#4a4a54', '#ffd040'], aggro: 160 },
    imp: { name: 'Diablillo', hp: 18, dmg: 6, spd: 46, r: 4, ai: 'imp', gold: [3, 7], shape: 'imp', pal: ['#d04030', '#ff8060', '#802020', '#ffe040'], fly: true, aggro: 150 },
    bog: { name: 'Criatura del Fango', hp: 34, dmg: 8, spd: 24, r: 6, ai: 'bog', gold: [3, 8], shape: 'bog', pal: ['#5a6a2a', '#8a9a4a', '#3a4a1a', '#ffe040'], poison: true },
    ghost: { name: 'Espectro', hp: 20, dmg: 7, spd: 30, r: 5, ai: 'ghost', gold: [3, 8], shape: 'ghost', pal: ['#d8e8f8', '#ffffff', '#9ab0d0', '#40a0ff'], fly: true, phase: true, aggro: 130 },
    mimic: { name: 'Mímico', hp: 60, dmg: 11, spd: 50, r: 6, ai: 'charger', gold: [20, 40], shape: 'mimic', pal: ['#a0652a', '#d9a441', '#6a3a14', '#ff4040'], aggro: 200 },
    thief: { name: 'Goblin Ladrón', hp: 55, dmg: 4, spd: 60, r: 5, ai: 'thief', gold: [25, 50], shape: 'goblin', pal: ['#c9a63a', '#6a3a8a', '#1b1424', '#ff4040'], aggro: 170, contact: 0.3 },
  };
  G.ELITE_MODS = {
    swift: { n: 'Veloz', col: '#4ec96a' },
    armored: { n: 'Acorazado', col: '#9aa6b8' },
    explosive: { n: 'Explosivo', col: '#ff7a3a' },
    vampiric: { n: 'Vampírico', col: '#e0536a' },
    venomous: { n: 'Venenoso', col: '#8bd04a' },
  };

  /* ---------- Jefes ---------- */
  // pats: patrones base. p2: patrones adicionales en fase 2 (<50% vida).
  G.BOSSES = {
    slimeking: { name: 'Rey Slime', shape: 'slime', pal: ['#5ac85a', '#9af09a', '#2f8a3a', '#1b1424'], scale: 3.2, hp: 300, dmg: 10, spd: 26, r: 13, cd: 1.5, decor: 'crown',
      pats: [{ k: 'slam', w: 0.7, r: 34, ring: 8 }, { k: 'aimed', w: 0.6, n: 3, spread: 0.45, spd: 115, bursts: 2, gap: 0.35 }, { k: 'summon', w: 0.8, id: 'slime', n: 3 }],
      p2: [{ k: 'ring', w: 0.7, n: 14, rings: 2, gap: 0.45, spd: 85 }, { k: 'charge', w: 0.8, spd: 190, dur: 0.6 }] },
    treant: { name: 'Ancestro Verdeante', shape: 'treant', pal: ['#3f9a3f', '#7a4f2a', '#2b6a2b', '#ffdd55'], scale: 3.2, hp: 380, dmg: 12, spd: 20, r: 13, cd: 1.6, decor: 'branches',
      pats: [{ k: 'roots', w: 0.8, n: 9, step: 18 }, { k: 'spiral', w: 0.7, arms: 2, dur: 2.6, rate: 0.09, spd: 80, col: '#7adf5a' }, { k: 'summon', w: 0.9, id: 'spider', n: 3 }],
      p2: [{ k: 'slam', w: 0.7, r: 42, ring: 10 }, { k: 'rain', w: 0.7, n: 7, r: 18, delay: 0.9, col: '#6adf4a' }] },
    pharaoh: { name: 'Faraón de Arena', shape: 'skel', pal: ['#e8d8a0', '#c8a840', '#7a5a20', '#40e0ff'], scale: 3.2, hp: 340, dmg: 12, spd: 30, r: 12, cd: 1.4, decor: 'headdress',
      pats: [{ k: 'rain', w: 0.6, n: 6, r: 20, delay: 0.9, col: '#e8c070' }, { k: 'charge', w: 0.8, spd: 210, dur: 0.55 }, { k: 'aimed', w: 0.6, n: 5, spread: 0.9, spd: 120, col: '#ffd24a' }, { k: 'summon', w: 0.8, id: 'scorpion', n: 3 }],
      p2: [{ k: 'spiral', w: 0.7, arms: 3, dur: 2.4, rate: 0.1, spd: 85, col: '#ffd24a' }, { k: 'blink', w: 0.6 }] },
    frostqueen: { name: 'Reina de Escarcha', shape: 'robe', pal: ['#bfe8ff', '#ffffff', '#5aa0d0', '#80f0ff'], scale: 3.2, hp: 360, dmg: 12, spd: 30, r: 12, cd: 1.3, decor: 'icecrown',
      pats: [{ k: 'blink', w: 0.6 }, { k: 'ring', w: 0.7, n: 16, rings: 2, gap: 0.5, spd: 90, col: '#9ae0ff' }, { k: 'spiral', w: 0.6, arms: 2, dur: 2.8, rate: 0.08, spd: 85, col: '#bff0ff' }, { k: 'rain', w: 0.7, n: 7, r: 16, delay: 0.85, col: '#9ae0ff' }],
      p2: [{ k: 'summon', w: 0.8, id: 'wolf', n: 3 }, { k: 'aimed', w: 0.6, n: 7, spread: 1.1, spd: 130, col: '#9ae0ff' }] },
    hydra: { name: 'Hidra del Pantano', shape: 'bog', pal: ['#4a7a2a', '#8aba4a', '#2a4a1a', '#ffe040'], scale: 3.4, hp: 420, dmg: 13, spd: 22, r: 13, cd: 1.4, decor: 'heads',
      pats: [{ k: 'aimed', w: 0.6, n: 3, spread: 0.5, spd: 120, bursts: 3, gap: 0.4, col: '#8bd04a' }, { k: 'pool', w: 0.7, n: 3, r: 24 }, { k: 'slam', w: 0.7, r: 36, ring: 8 }],
      p2: [{ k: 'spiral', w: 0.7, arms: 3, dur: 2.6, rate: 0.1, spd: 80, col: '#8bd04a' }, { k: 'ring', w: 0.7, n: 16, rings: 2, gap: 0.45, spd: 85, col: '#8bd04a' }] },
    magmagolem: { name: 'Gólem de Magma', shape: 'golem', pal: ['#6a3a2a', '#a0502a', '#3a1a1a', '#ffb030'], scale: 3.4, hp: 480, dmg: 14, spd: 24, r: 13, cd: 1.4, decor: 'flames',
      pats: [{ k: 'charge', w: 0.9, spd: 200, dur: 0.6 }, { k: 'rain', w: 0.6, n: 8, r: 20, delay: 0.85, col: '#ff6a2a' }, { k: 'slam', w: 0.8, r: 46, ring: 12, col: '#ff7a30' }, { k: 'ring', w: 0.6, n: 12, rings: 2, gap: 0.5, spd: 90, col: '#ff7a30' }],
      p2: [{ k: 'spiral', w: 0.7, arms: 3, dur: 2.6, rate: 0.09, spd: 85, col: '#ff7a30' }, { k: 'summon', w: 0.8, id: 'imp', n: 3 }] },
    lich: { name: 'Liche del Vacío', shape: 'robe', pal: ['#000', '#c070ff', '#4a2a7a', '#e040ff'], scale: 3.4, hp: 560, dmg: 15, spd: 32, r: 12, cd: 1.1, decor: 'skullcrown',
      pats: [{ k: 'blink', w: 0.5 }, { k: 'spiral', w: 0.6, arms: 3, dur: 2.6, rate: 0.08, spd: 90, col: '#d070ff' }, { k: 'summon', w: 0.8, id: 'ghost', n: 3 }, { k: 'rain', w: 0.6, n: 8, r: 18, delay: 0.8, col: '#c040ff' }, { k: 'ring', w: 0.6, n: 18, rings: 2, gap: 0.45, spd: 95, col: '#d070ff' }],
      p2: [{ k: 'aimed', w: 0.5, n: 9, spread: 1.3, spd: 140, col: '#e040ff' }, { k: 'slam', w: 0.7, r: 44, ring: 14, col: '#c040ff' }] },
  };

  /* ---------- Rarezas y armas ---------- */
  G.RARITY = [
    { n: 'Común', c: '#c8c8c8', m: 1, aff: 0 },
    { n: 'Poco común', c: '#5fd35f', m: 1.15, aff: 1 },
    { n: 'Raro', c: '#4aa3ff', m: 1.35, aff: 2 },
    { n: 'Épico', c: '#b45cff', m: 1.6, aff: 3 },
    { n: 'Legendario', c: '#ff9a2e', m: 2, aff: 4 },
  ];
  G.WTYPES = {
    fist: { n: 'Puños', min: 2, max: 3, rate: 0.4, range: 14, arc: 1.6, melee: true },
    sword: { n: 'Espada', min: 7, max: 11, rate: 0.4, range: 24, arc: 2.0, melee: true },
    dagger: { n: 'Daga', min: 3, max: 5, rate: 0.22, range: 17, arc: 1.4, melee: true },
    axe: { n: 'Hacha', min: 13, max: 19, rate: 0.72, range: 26, arc: 2.8, melee: true },
    spear: { n: 'Lanza', min: 8, max: 12, rate: 0.52, range: 38, arc: 0.5, melee: true, thrust: true },
    bow: { n: 'Arco', min: 6, max: 9, rate: 0.46, range: 0, melee: false, proj: { spd: 230, life: 0.9, r: 2.5, col: '#e8dcb0' } },
    staff: { n: 'Bastón', min: 6, max: 9, rate: 0.52, range: 0, melee: false, proj: { spd: 170, life: 1.1, r: 3.5, col: '#9ad0ff', magic: true, explode: 14 } },
  };
  G.WEAPON_KEYS = ['sword', 'dagger', 'axe', 'spear', 'bow', 'staff'];

  /* ---------- Consumibles ---------- */
  G.CONS = {
    hp1: { name: 'Poción menor', desc: 'Restaura 40 PV.', price: 15, col: '#e04050', ic: 'potion' },
    hp2: { name: 'Poción mayor', desc: 'Restaura 120 PV.', price: 45, col: '#ff5a8a', ic: 'potion' },
    speed: { name: 'Elixir de Velocidad', desc: '+35% velocidad de movimiento durante 30 s.', price: 30, col: '#4ae0e0', ic: 'potion' },
    rage: { name: 'Elixir de Furia', desc: '+40% de daño durante 30 s.', price: 35, col: '#ff8a2a', ic: 'potion' },
    ward: { name: 'Pergamino Protector', desc: 'Escudo que absorbe 60 de daño durante 30 s.', price: 35, col: '#7ad7ff', ic: 'scroll' },
    bomb: { name: 'Bomba', desc: 'Explota tras 1 s: daña a los enemigos y rompe paredes agrietadas.', price: 25, col: '#555566', ic: 'bomb' },
    tele: { name: 'Pergamino de Regreso', desc: 'Te teletransporta al último punto de guardado.', price: 40, col: '#b070ff', ic: 'scroll' },
    clover: { name: 'Trébol de la Suerte', desc: 'Mejora la rareza del botín durante 90 s.', price: 40, col: '#4ec96a', ic: 'clover' },
    antidote: { name: 'Antídoto', desc: 'Cura veneno y quemaduras y restaura 20 PV.', price: 18, col: '#8bd04a', ic: 'potion' },
    map: { name: 'Mapa del Tesoro', desc: 'Revela el terreno y los lugares de interés cercanos en el mapa.', price: 50, col: '#e8dcb0', ic: 'map' },
  };
  G.CONS_DROP = [['hp1', 40], ['hp2', 10], ['speed', 7], ['rage', 7], ['ward', 7], ['bomb', 12], ['tele', 5], ['clover', 4], ['antidote', 8], ['map', 3]];

  /* ---------- Etiquetas de estadísticas ---------- */
  G.STAT_LABELS = {
    hp: ['Vida máx.', 'f'], dmg: ['Daño', '%'], crit: ['Prob. crítico', '%'], critDmg: ['Daño crítico', '%'], spd: ['Velocidad', '%'], as: ['Vel. de ataque', '%'],
    def: ['Armadura', 'f'], regen: ['Regeneración', 'r'], lifesteal: ['Robo de vida', '%'], gold: ['Oro extra', '%'], luck: ['Suerte', '%'], magic: ['Poder mágico', '%'],
    cdr: ['Reducción de enfriamiento', '%'], burn: ['Prob. quemar', '%'], poison: ['Prob. envenenar', '%'], slow: ['Prob. ralentizar', '%'], pierce: ['Perforación', 'f'],
  };
})();
