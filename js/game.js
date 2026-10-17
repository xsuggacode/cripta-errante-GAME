'use strict';
/* Bucle principal, entrada, integración mundo/entidades, interacción, eventos aleatorios, renderizado, mapa y guardado. */
(function () {
  const G = window.G, T = G.T, O = G.O, TS = G.TS, CS = G.CS, S = G.Sprites;
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const VW = cv.width, VH = cv.height;
  ctx.imageSmoothingEnabled = false;
  const UI = G.ui;
  G.game = null;
  const keys = {}, mouse = { x: VW / 2, y: VH / 2, down: false };
  const dk = document.createElement('canvas'); dk.width = VW; dk.height = VH;
  const dkx = dk.getContext('2d');
  const mini = document.getElementById('minimap'), mctx = mini.getContext('2d');
  const tmpMap = document.createElement('canvas');
  G.MAPRGB = G.MAPCOLS.map((c) => { const n = parseInt(c.slice(1).length === 3 ? c.slice(1).replace(/./g, '$&$&') : c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; });

  /* ---------- Entrada ---------- */
  function resize() {
    const sc = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    const s = sc >= 2 ? Math.floor(sc) : sc;
    cv.style.width = Math.floor(VW * s) + 'px'; cv.style.height = Math.floor(VH * s) + 'px';
  }
  window.addEventListener('resize', resize); resize();
  function setMouse(e) { const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width * VW; mouse.y = (e.clientY - r.top) / r.height * VH; }
  window.addEventListener('mousemove', setMouse);
  cv.addEventListener('mousedown', (e) => { setMouse(e); if (e.button === 0) mouse.down = true; if (e.button === 2) dodge(G.game); e.preventDefault(); });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => { mouse.down = false; for (const k in keys) keys[k] = false; const g = G.game; if (g && g.state === 'play' && !UI.isOpen()) UI.showPause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.app.saveNow(); });
  window.addEventListener('pagehide', () => G.app.saveNow());

  const SKILLKEY = { KeyQ: 'Q', KeyE: 'E', KeyR: 'R', KeyF: 'F' };
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const g = G.game;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) { keys[e.code] = true; return; }
    keys[e.code] = true;
    if (!g) return;
    const cur = UI.current();
    if (UI.isOpen()) {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (['inv', 'skills', 'map', 'shop', 'text', 'altar', 'reward', 'pause'].includes(cur)) { UI.close(); G.app.resume(); }
        else if (cur === 'controls') UI.showPause();
      } else if (e.code === 'KeyI' && cur === 'inv') { UI.close(); G.app.resume(); }
      else if (e.code === 'KeyK' && cur === 'skills') { UI.close(); G.app.resume(); }
      else if (e.code === 'KeyM' && cur === 'map') { UI.close(); G.app.resume(); }
      else if (e.code === 'KeyI' && cur === 'pause') UI.showInventory();
      return;
    }
    if (g.state !== 'play') return;
    if (e.code === 'Escape' || e.code === 'KeyP') UI.showPause();
    else if (e.code === 'KeyI') UI.showInventory();
    else if (e.code === 'KeyK') UI.showSkills();
    else if (e.code === 'KeyM') UI.showMap();
    else if (e.code === 'Space') { if (!interact(g)) dodge(g); }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') dodge(g);
    else if (SKILLKEY[e.code]) useSkill(g, SKILLKEY[e.code]);
    else if (/^Digit[1-4]$/.test(e.code)) useQuick(g, +e.code.slice(5) - 1);
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  /* ---------- Jugador ---------- */
  function initRuntime(p) {
    Object.assign(p, { vx: 0, vy: 0, kx: 0, ky: 0, r: 5, face: 1, aim: 0, atkCd: 0, swing: 0, swingA: 0, dodgeT: 0, dodgeI: 0, dodgeCdT: 0, dodgeA: 0, invuln: 1.5, hitFlash: 0, shield: 0, shieldT: 0,
      buff: { rage: 0, rageP: 0, speedP: 0, clover: 0, regen: 0 }, stat: { poison: 0, burn: 0, slow: 0 }, cds: {}, cdMax: {}, counterT: 0, lbCd: 0, dead: false, anim: 0, dotT: 0, trapT: 0, lavaT: 0, moving: false });
    p.skills = p.skills || {}; p.bind = p.bind || { Q: null, E: null, R: null, F: null }; p.equip = p.equip || {}; p.inv = p.inv || []; p.quick = p.quick || [null, null, null, null]; p.boss = p.boss || {};
    G.computeStats(p);
  }
  function dodge(g) {
    if (!g || g.state !== 'play' || UI.isOpen()) return;
    const p = g.p;
    if (p.dead || p.dodgeT > 0 || p.dodgeCdT > 0) return;
    let dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), dy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    p.dodgeA = dx || dy ? Math.atan2(dy, dx) : p.aim + Math.PI;
    p.dodgeT = 0.2; p.dodgeI = p.st.iframes; p.dodgeCdT = p.st.dodgeCd;
    if (p.st.counter > 0) p.counterT = 1.2;
    G.sfx('dodge');
    for (let i = 0; i < 6; i++) g.parts.push({ x: p.x, y: p.y + 3, vx: G.rand(-20, 20), vy: G.rand(-20, 20), t: 0, max: 0.3, col: '#cfc8e8', size: 2 });
  }
  function useSkill(g, k) {
    const p = g.p, id = p.bind[k];
    if (!id || p.dead) return;
    if ((p.cds[id] || 0) > 0) return;
    G.castSkill(g, id);
  }
  function useQuick(g, i) {
    const p = g.p, id = p.quick[i];
    if (!id || p.dead) return;
    if (!G.countCons(p, id)) { UI.toast('Sin ' + G.CONS[id].name, '#ff8080'); return; }
    G.useConsumable(g, id);
  }

  /* ---------- App: arranque, mundos, guardado ---------- */
  const App = (G.app = {
    slot: -1,
    newWorld(slot, o) {
      const ws = G.newWorldState(o.name, o.seed, o.hardcore);
      App.start(slot, ws, G.newPlayer(), true);
    },
    continueSlot(slot) {
      let ws;
      try { ws = G.Save.load(slot); } catch (e) { UI.toast('El guardado está dañado', '#ff6060'); return; }
      if (!ws) return;
      const p = ws.player || G.newPlayer();
      App.start(slot, ws, p, false);
    },
    deleteSlot(slot) { G.Save.del(slot); },
    start(slot, ws, p, fresh) {
      UI.close();
      App.slot = slot;
      const g = { ws, p, slot, level: new G.Level(ws), enemies: [], projs: [], fx: [], parts: [], texts: [], drops: [], npcs: [], bossList: [], boss: null, shake: 0, time: 0, state: 'play', active: new Set(), shops: {},
        interact: null, hint: '', hintT: 0, biomeName: '', eventT: G.rand(60, 110), dark: 0, amb: [], banner: null, autoT: 20, exploreT: 0, pcx: 1e9, pcy: 1e9, mapT: 0, over: false, aimX: 0, aimY: 0, cam: { x: 0, y: 0 }, dmgVignette: 0, pendingReward: null, lastBiome: '' };
      G.game = g;
      initRuntime(p);
      if (p.hp == null || p.hp <= 0) p.hp = p.hpMax;
      p.hp = Math.min(p.hp, p.hpMax);
      g.teleportToSave = () => teleportToSave(g);
      g.openGates = (b) => setGates(g, b, false);
      if (fresh) { p.x = ws.save.x; p.y = ws.save.y; }
      if (ws.stats.maxDist == null) ws.stats.maxDist = 0;
      S.init && !S.tiles.length && S.init();
      UI.buildHotbar();
      document.getElementById('hud').classList.remove('hidden');
      g.hint = '<b>WASD</b> mover · <b>Clic</b> atacar · <b>Shift</b> esquivar · <b>Espacio</b> interactuar<br><b>I</b> inventario · <b>K</b> habilidades · <b>M</b> mapa · <b>Esc</b> pausa';
      g.hintT = fresh ? 30 : 8;
      updateChunks(g, true);
      G.markExplored(ws, Math.floor(p.x / TS), Math.floor(p.y / TS), 9);
      if (fresh) { UI.toast('Habla con el Sabio y abre el cofre del campamento', '#f2c94c'); App.saveNow(true); }
      else UI.toast('Partida cargada: ' + ws.name, '#9ad0ff');
      mouse.down = false;
    },
    saveNow(force) {
      const g = G.game;
      if (!g || g.over || g.state === 'dead' || (g.p.dead && !force)) return false;
      return G.Save.save(g.slot, g.ws, g.p);
    },
    resume() { for (const k in keys) keys[k] = false; mouse.down = false; },
    toTitle() { App.saveNow(); UI.showTitle(); },
    unstuck() { const g = G.game; if (g) teleportToSave(g); },
    respawn() {
      const g = G.game, p = g.p, ws = g.ws;
      const lost = Math.floor(p.gold * 0.2);
      p.gold -= lost;
      resetBossFight(g);
      p.dead = false; p.hp = p.hpMax; p.x = ws.save.x; p.y = ws.save.y; p.invuln = 2; p.shield = 0; p.stat.poison = p.stat.burn = 0;
      Object.keys(p.buff).forEach((k) => (p.buff[k] = 0));
      p.lbCd = 0;
      g.projs.length = 0; g.fx.length = 0; g.enemies.length = 0; g.active.clear(); g.npcs.length = 0; g.bossList.length = 0;
      ws.epoch++;
      g.state = 'play'; g.pcx = 1e9;
      updateChunks(g, true);
      App.saveNow(true);
      UI.toast('Reaparecer en el último santuario (−' + lost + ' oro)', '#ffd24a');
    },
    shopStock(npc) {
      const g = G.game, ws = g.ws;
      const key = npc.id + '@' + ws.epoch;
      if (g.shops[key]) return g.shops[key];
      const cx = G.fdiv(npc.x, CS * TS), cy = G.fdiv(npc.y, CS * TS);
      const rng = G.rngFor(ws.seed, cx, cy, 500 + ws.epoch), tier = Math.max(1, G.tierAt(cx, cy));
      const stock = [];
      for (let i = 0; i < 6; i++) {
        const it = G.genGear(tier, G.rollRarity(0.15, 0, rng), rng);
        stock.push({ item: it, price: Math.ceil(G.itemValue(it) * 2.6) });
      }
      ['hp1', 'hp2', 'antidote', 'bomb', 'speed', 'rage', 'ward', 'tele', 'clover', 'map'].forEach((id) => stock.push({ item: G.genCons(id, 1), price: G.CONS[id].price, inf: true }));
      return (g.shops[key] = stock);
    },
    altarSacrifice() {
      const g = G.game, p = g.p, a = g.altarTile;
      if (!a) return;
      const cost = Math.floor(p.hp * 0.3);
      p.hp = Math.max(1, p.hp - cost);
      g.level.set(a.tx, a.ty, null, O.ALTARU, true);
      G.floatText(g, p.x, p.y - 14, '-' + cost, '#ff5a5a');
      const tier = G.tierAt(G.fdiv(a.tx, CS), G.fdiv(a.ty, CS));
      for (let i = 0; i < 2; i++) G.spawnDrop(g, a.tx * TS + 8, a.ty * TS + 20, 'item', { item: G.genGear(tier + 1, G.rollRarity(G.luck(g) + 0.4, i ? 2 : 3)) });
      G.burst(g, a.tx * TS + 8, a.ty * TS + 8, '#d04a8a', 24, 90, 0.8); G.sfx('boss');
      UI.toast('El altar acepta tu ofrenda…', '#d04a8a');
      g.altarTile = null;
    },
  });

  function teleportToSave(g) {
    if (g.boss && g.boss.active) { UI.toast('No puedes huir del jefe', '#ff8080'); return false; }
    const p = g.p, ws = g.ws;
    G.burst(g, p.x, p.y, '#b070ff', 20, 80, 0.6);
    p.x = ws.save.x; p.y = ws.save.y; p.invuln = 1;
    G.burst(g, p.x, p.y, '#b070ff', 20, 80, 0.6);
    g.projs.length = 0; g.pcx = 1e9;
    return true;
  }

  /* ---------- Chunks activos: aparición/desaparición de entidades ---------- */
  function updateChunks(g, force) {
    const p = g.p, L = g.level, ws = g.ws;
    const pcx = G.fdiv(Math.floor(p.x / TS), CS), pcy = G.fdiv(Math.floor(p.y / TS), CS);
    if (!force && pcx === g.pcx && pcy === g.pcy) return;
    g.pcx = pcx; g.pcy = pcy;
    const d = Math.floor(Math.hypot(pcx, pcy));
    if (d > ws.stats.maxDist) ws.stats.maxDist = d;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = pcx + dx, cy = pcy + dy, k = cx + ',' + cy;
      if (g.active.has(k)) continue;
      g.active.add(k);
      const ch = L.chunk(cx, cy);
      spawnChunk(g, ch, k);
    }
    for (const k of Array.from(g.active)) {
      const [cx, cy] = k.split(',').map(Number);
      if (Math.abs(cx - pcx) > 2 || Math.abs(cy - pcy) > 2) {
        g.active.delete(k);
        g.enemies = g.enemies.filter((e) => e.ck !== k || e.master);
        g.npcs = g.npcs.filter((n) => n.ck !== k);
        g.bossList = g.bossList.filter((b) => { if (b.ck === k && !b.active) return false; return true; });
      }
    }
    L.trim(pcx, pcy, 4);
  }
  function spawnChunk(g, ch, k) {
    const ws = g.ws, p = g.p;
    for (const def of ch.ents) {
      if (def.k === 'enemy') {
        if (ws.dead[def.id] !== undefined && ws.epoch - ws.dead[def.id] < 2) continue;
        const x = (ch.cx * CS + def.tx) * TS + 8, y = (ch.cy * CS + def.ty) * TS + 8;
        const e = G.makeEnemy(def.type, ch.tier, x, y, def.elite);
        e.id = def.id; e.ck = k; if (def.guard) e.aggro = 70;
        g.enemies.push(e);
      } else if (def.k === 'boss') {
        const ak = ch.cx + ',' + ch.cy;
        if (ws.done['b:' + ak]) continue;
        if (g.bossList.some((b) => b.arenaKey === ak)) continue;
        const b = G.makeBoss(def.type, ch.tier, (ch.cx * CS + 16) * TS, (ch.cy * CS + 14) * TS);
        b.arenaKey = ak; b.ck = k; b.home = { x: (ch.cx * CS + 16) * TS, y: (ch.cy * CS + 16) * TS };
        g.bossList.push(b);
      } else if (def.k === 'npc') {
        g.npcs.push({ k: 'npc', id: def.id, npc: def.npc, x: (ch.cx * CS + def.tx) * TS + 8, y: (ch.cy * CS + def.ty) * TS + 8, ck: k, anim: Math.random() * 6 });
      }
    }
  }
  function arenaDoorTiles(ch) {
    const out = [];
    for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
      if (d < 13 || d >= 15) continue;
      const dx = Math.abs(x + 0.5 - 16), dy = Math.abs(y + 0.5 - 16);
      if ((dx < 2 && dy > dx) || (dy < 2 && dx > dy)) out.push([ch.cx * CS + x, ch.cy * CS + y]);
    }
    return out;
  }
  function setGates(g, b, closed) {
    const [cx, cy] = b.arenaKey.split(',').map(Number);
    const ch = g.level.chunk(cx, cy);
    arenaDoorTiles(ch).forEach((t) => g.level.set(t[0], t[1], null, closed ? O.GATE : 0, false));
  }
  function resetBossFight(g) {
    const b = g.boss;
    if (!b) return;
    setGates(g, b, false);
    g.minionsClear = true;
    g.enemies = g.enemies.filter((e) => e.master !== b);
    g.bossList = g.bossList.filter((x) => x !== b);
    g.active.delete(b.ck);
    g.boss = null;
  }

  /* ---------- Muerte ---------- */
  G.onPlayerDeath = function (g) {
    g.state = 'dead';
    G.burst(g, g.p.x, g.p.y, '#e0534a', 30, 110, 0.9); G.sfx('boom');
    g.ws.stats.deaths++;
    const bossReset = !!(g.boss && g.boss.active);
    if (g.ws.hardcore) {
      g.over = true; G.Save.del(g.slot);
      UI.showDeath({});
    } else {
      UI.showDeath({ lost: Math.floor(g.p.gold * 0.2), bossReset });
    }
  };

  /* ---------- Interacción ---------- */
  function findInteract(g) {
    const p = g.p, L = g.level, tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
    let best = null, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const o = L.o(tx + dx, ty + dy);
      if (o !== O.SHRINE && o !== O.SHRINEON && o !== O.CHEST && o !== O.ALTAR) continue;
      const cx = (tx + dx) * TS + 8, cy = (ty + dy) * TS + 8, d = G.dist(p.x, p.y, cx, cy);
      if (d < 28 && d < bd) {
        bd = d;
        best = { kind: o === O.CHEST ? 'chest' : o === O.ALTAR ? 'altar' : 'shrine', tx: tx + dx, ty: ty + dy, text: o === O.CHEST ? '[Espacio] Abrir cofre' : o === O.ALTAR ? '[Espacio] Altar maldito' : '[Espacio] Descansar y guardar la partida' };
      }
    }
    for (const n of g.npcs) { const d = G.dist(p.x, p.y, n.x, n.y); if (d < 34 && d < bd) { bd = d; best = { kind: 'npc', npc: n, text: n.npc === 'merchant' ? '[Espacio] Comerciar' : '[Espacio] Hablar' }; } }
    return best;
  }
  function interact(g) {
    const it = g.interact;
    if (!it || g.p.dead) return false;
    if (it.kind === 'chest') openChest(g, it.tx, it.ty);
    else if (it.kind === 'shrine') rest(g, it.tx, it.ty);
    else if (it.kind === 'altar') { g.altarTile = { tx: it.tx, ty: it.ty }; UI.showAltar(); }
    else if (it.kind === 'npc') {
      if (it.npc.npc === 'merchant') UI.showShop(App.shopStock(it.npc));
      else UI.showText('Sabio del Camino', 'Bienvenido, errante. Este mundo no tiene fin: cada camino genera tierras nuevas.<br><br>• <b>Santuarios</b> (cristales turquesa): guardan tu partida y te curan. Si mueres, vuelves al último.<br>• Los <b>jefes</b> viven en arenas circulares. Al vencerlos ganas <b>puntos de habilidad</b>.<br>• Las <b>paredes agrietadas</b> ocultan salas secretas: ábrelas con bombas.<br>• Cuidado con los <b>mímicos</b> y los cofres demasiado generosos.<br>• Los enemigos y jefes se fortalecen cuanto más te alejas del origen.');
    }
    return true;
  }
  function openChest(g, tx, ty) {
    const L = g.level, ws = g.ws, p = g.p;
    const meta = L.metaAt(tx, ty) || { q: 0 };
    const x = tx * TS + 8, y = ty * TS + 8, ch = L.chunk(G.fdiv(tx, CS), G.fdiv(ty, CS));
    if (meta.mimic) {
      L.set(tx, ty, null, 0, true);
      const m = G.makeEnemy('mimic', ch.tier, x, y + 4, null); m.state = 'chase'; m.ck = null; g.enemies.push(m);
      G.toast(g, '¡Era un Mímico!', '#ff6a3a'); g.shake = 6; G.sfx('boss'); G.burst(g, x, y, '#d9a441', 16, 80);
      return;
    }
    L.set(tx, ty, null, O.CHESTO, true);
    ws.stats.chests++;
    G.sfx('chest');
    const rng = G.rngFor(ws.seed, tx, ty, 77), tier = ch.tier, q = meta.q || 0, luck = G.luck(g);
    const items = [];
    if (meta.cons) items.push(G.genCons(meta.cons, meta.n || 1));
    const n = q >= 3 ? 3 : q === 2 ? 2 : 1 + (rng() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) items.push(G.rollLoot(tier, luck, { rng, minRar: i === 0 ? q : 0, gearOnly: q >= 2 && i === 0, consChance: 0.5 }));
    items.forEach((it) => G.spawnDrop(g, x, y, 'item', { item: it, noPick: 0.35 }));
    const gold = Math.round(G.randi(8, 20) * (1 + q * 0.8) * (1 + 0.28 * (tier - 1)) * (1 + p.st.gold));
    G.spawnDrop(g, x, y, 'gold', { amt: gold, noPick: 0.35 });
    G.burst(g, x, y, '#ffd24a', 16, 80, 0.6);
    if (meta.tut) G.toast(g, 'Los objetos caen al suelo: acércate para recogerlos', '#f2c94c');
  }
  function rest(g, tx, ty) {
    const p = g.p, ws = g.ws, L = g.level;
    if (g.boss && g.boss.active) { UI.toast('No puedes descansar durante el combate con el jefe', '#ff8080'); return; }
    p.hp = p.hpMax; p.stat.poison = p.stat.burn = 0; p.shield = 0;
    if (L.o(tx, ty) === O.SHRINE) L.set(tx, ty, null, O.SHRINEON, true);
    const cand = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1]];
    let sp = { x: tx * TS + 8, y: (ty + 1) * TS + 8 };
    for (const c of cand) { const px = (tx + c[0]) * TS + 8, py = (ty + c[1]) * TS + 8; if (!G.collides(L, px, py, p.r)) { sp = { x: px, y: py }; break; } }
    ws.save = sp;
    ws.epoch++;
    g.enemies = g.enemies.filter((e) => e.master); g.active.clear(); g.npcs.length = 0; g.bossList = g.bossList.filter((b) => b.active); g.pcx = 1e9;
    updateChunks(g, true);
    const ok = App.saveNow(true);
    G.sfx('save'); G.burst(g, tx * TS + 8, ty * TS + 4, '#59e3e3', 24, 90, 0.8);
    UI.toast(ok ? 'Partida guardada. Los enemigos vuelven a acechar…' : 'No se pudo guardar (almacenamiento bloqueado)', ok ? '#59e3e3' : '#ff6060');
  }

  /* ---------- Eventos aleatorios ---------- */
  function randomEvent(g) {
    const p = g.p, L = g.level, tier = G.tierAt(g.pcx, g.pcy);
    const kind = G.wpick([['ambush', 3], ['thief', 2], ['supply', 2], ['blessing', 2], ['gift', 2]]);
    const biomeKey = L.biomeOf(Math.floor(p.x / TS), Math.floor(p.y / TS));
    const pool = G.BIOMES[biomeKey].enemies;
    const ring = (n, r, fn) => { let c = 0; for (let i = 0; i < n * 3 && c < n; i++) { const a = Math.random() * 6.283, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (G.collides(L, x, y, 6)) continue; fn(x, y); c++; } };
    if (kind === 'ambush') {
      UI.toast('¡Emboscada! Los enemigos te rodean', '#ff6a3a'); G.sfx('boss');
      ring(3 + Math.min(4, tier), 120, (x, y) => { const e = G.makeEnemy(G.pick(pool), tier, x, y, G.chance(0.12) ? G.pick(Object.keys(G.ELITE_MODS)) : null); e.state = 'chase'; e.noLoot = false; g.enemies.push(e); G.burst(g, x, y, '#ff6a3a', 8, 50); });
    } else if (kind === 'thief') {
      UI.toast('Un goblin ladrón merodea con un botín…', '#c9a63a');
      ring(1, 150, (x, y) => { const e = G.makeEnemy('thief', tier, x, y, null); e.hp *= 1.2; g.enemies.push(e); });
    } else if (kind === 'supply') {
      let done = false;
      ring(1, 60, (x, y) => {
        const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
        if (L.o(tx, ty) || !L.freeTile(tx, ty)) return;
        L.set(tx, ty, null, O.CHEST, true); g.ws.meta[tx + ',' + ty] = { q: 1 + (G.chance(0.3) ? 1 : 0), mimic: false };
        G.burst(g, tx * TS + 8, ty * TS + 8, '#ffd24a', 24, 70, 0.9); done = true;
      });
      if (done) { UI.toast('Un cofre de suministros ha caído cerca', '#ffd24a'); G.sfx('chest'); }
    } else if (kind === 'blessing') {
      const b = G.pick(['rage', 'speedP', 'regen']);
      if (b === 'regen') { p.buff.regen = 40; UI.toast('Bendición: regeneras 3 PV/s durante 40 s', '#7aff9a'); }
      else if (b === 'rage') { p.buff.rageP = 40; UI.toast('Bendición: +40% de daño durante 40 s', '#ff8a2a'); }
      else { p.buff.speedP = 40; UI.toast('Bendición: +35% de velocidad durante 40 s', '#4ae0e0'); }
      G.sfx('heal'); G.burst(g, p.x, p.y, '#ffd24a', 20, 70, 0.8);
    } else if (kind === 'gift') {
      UI.toast('Un viajero misterioso te deja un regalo', '#f2c94c');
      for (let i = 0; i < 2; i++) G.spawnDrop(g, p.x + G.rand(-12, 12), p.y + 14, 'item', { item: G.randomCons(tier), noPick: 0.4 });
      G.spawnDrop(g, p.x, p.y + 14, 'gold', { amt: Math.round(G.randi(15, 40) * (1 + 0.3 * (tier - 1))), noPick: 0.4 });
      G.sfx('pickup');
    }
  }

  /* ---------- Actualización ---------- */
  function update(g, dt) {
    const p = g.p, ws = g.ws, L = g.level;
    g.time += dt; ws.play += dt;
    if (g.hintT > 0) g.hintT -= dt;
    // temporizadores del jugador
    ['atkCd', 'swing', 'dodgeT', 'dodgeI', 'dodgeCdT', 'invuln', 'hitFlash', 'counterT', 'lbCd'].forEach((k) => { if (p[k] > 0) p[k] = Math.max(0, p[k] - dt); });
    for (const k in p.buff) if (p.buff[k] > 0) p.buff[k] = Math.max(0, p.buff[k] - dt);
    for (const k in p.cds) if (p.cds[k] > 0) p.cds[k] = Math.max(0, p.cds[k] - dt);
    if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
    g.shake = Math.max(0, g.shake - dt * 14);
    g.dmgVignette = Math.max(0, g.dmgVignette - dt);
    // apuntado
    g.aimX = g.cam.x + mouse.x; g.aimY = g.cam.y + mouse.y;
    p.aim = Math.atan2(g.aimY - p.y, g.aimX - p.x);
    if (Math.abs(Math.cos(p.aim)) > 0.15) p.face = Math.cos(p.aim) > 0 ? 1 : -1;
    // movimiento
    if (p.dodgeT > 0) {
      const sp = 215;
      G.moveEnt(L, p, Math.cos(p.dodgeA) * sp * dt, Math.sin(p.dodgeA) * sp * dt, false);
      if (Math.random() < 0.5) g.parts.push({ x: p.x, y: p.y + 4, vx: 0, vy: 0, t: 0, max: 0.25, col: '#b8b0d8', size: 2 });
    } else {
      let dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), dy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
      p.moving = !!(dx || dy);
      if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
      const sp = 80 * p.st.spd * (p.buff.speedP > 0 ? 1.35 : 1) * (p.stat.slow > 0 ? 0.6 : 1);
      G.moveEnt(L, p, dx * sp * dt, dy * sp * dt, false);
      if (p.moving) p.anim += dt * 9;
    }
    if (p.kx || p.ky) { G.moveEnt(L, p, p.kx * dt, p.ky * dt, false); const f = Math.pow(0.003, dt); p.kx *= f; p.ky *= f; if (Math.abs(p.kx) + Math.abs(p.ky) < 3) p.kx = p.ky = 0; }
    // ataque
    if ((mouse.down || keys.KeyJ) && !UI.isOpen()) G.playerAttack(g);
    // regeneración y estados
    if (!p.dead) {
      p.hp = Math.min(p.hpMax, p.hp + (p.st.regen + (p.buff.regen > 0 ? 3 : 0)) * dt);
      p.dotT += dt;
      if (p.dotT >= 0.5) {
        p.dotT -= 0.5;
        const tier = G.tierAt(g.pcx, g.pcy), dps = 2 + 1.5 * tier;
        if (p.stat.poison > 0) G.hurtPlayer(g, dps * 0.5, { dot: true });
        if (p.stat.burn > 0) G.hurtPlayer(g, dps * 0.7 * 0.5 + 1, { dot: true });
      }
      if (p.stat.poison > 0) p.stat.poison -= dt; if (p.stat.burn > 0) p.stat.burn -= dt; if (p.stat.slow > 0) p.stat.slow -= dt;
      // terreno peligroso
      const tt = L.t(Math.floor(p.x / TS), Math.floor(p.y / TS));
      if (tt === T.LAVA) { p.lavaT -= dt; if (p.lavaT <= 0) { p.lavaT = 0.4; G.hurtPlayer(g, 7 + 2 * G.tierAt(g.pcx, g.pcy), { burn: true, dot: false, kb: 0 }); } }
      if (tt === T.SPIKE && p.dodgeI <= 0) { p.trapT -= dt; if (p.trapT <= 0) { p.trapT = 0.8; G.hurtPlayer(g, 8 + 3 * G.tierAt(g.pcx, g.pcy), {}); G.burst(g, p.x, p.y, '#cfd8e6', 6, 40); } } else p.trapT = 0;
    }
    updateChunks(g, false);
    // jefes: activación
    if (!g.boss) for (const b of g.bossList) {
      if (!b.active && !b.dead && G.dist(p.x, p.y, b.home.x, b.home.y) < 9 * TS) {
        b.active = true; g.boss = b; setGates(g, b, true);
        G.toast(g, '¡' + b.name + '!', '#e8b0ff'); G.sfx('boss'); g.shake = 8;
        break;
      }
    }
    // enemigos
    for (let i = g.enemies.length - 1; i >= 0; i--) {
      const e = g.enemies[i];
      if (e.dead || e.despawn) { g.enemies.splice(i, 1); continue; }
      G.updateEnemyStatus(g, e, dt);
      if (e.dead) { g.enemies.splice(i, 1); continue; }
      G.enemyAI(g, e, dt);
    }
    if (g.boss) {
      const b = g.boss;
      G.updateEnemyStatus(g, b, dt);
      if (!b.dead) G.bossAI(g, b, dt);
      if (b.dead) { g.bossList = g.bossList.filter((x) => x !== b); g.boss = null; }
    }
    for (const b of g.bossList) if (!b.active) b.anim += dt;
    G.updateProjs(g, dt);
    G.updateFx(g, dt);
    for (const n of g.npcs) n.anim += dt;
    // partículas y textos
    for (let i = g.parts.length - 1; i >= 0; i--) { const q = g.parts[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; if (q.t >= q.max) g.parts.splice(i, 1); }
    if (g.parts.length > 500) g.parts.splice(0, g.parts.length - 500);
    for (let i = g.texts.length - 1; i >= 0; i--) { const q = g.texts[i]; q.t += dt; q.y -= 18 * dt; if (q.t > 0.9) g.texts.splice(i, 1); }
    updateDrops(g, dt);
    // interacción
    g.interact = p.dead ? null : findInteract(g);
    // jefe: derrota → recompensa
    if (g.pendingReward) { g.pendingReward.t -= dt; if (g.pendingReward.t <= 0) { const r = g.pendingReward; g.pendingReward = null; UI.showReward(r); } }
    // exploración, bioma y POIs
    g.exploreT -= dt;
    if (g.exploreT <= 0) {
      g.exploreT = 0.25;
      const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
      G.markExplored(ws, tx, ty, 9);
      const k = g.pcx + ',' + g.pcy;
      if (!ws.discovered[k]) { const ch = L.chunk(g.pcx, g.pcy); ws.discovered[k] = ch.pois.map((q) => ({ k: q.k, tx: q.tx != null ? q.tx : g.pcx * CS + 16, ty: q.ty != null ? q.ty : g.pcy * CS + 16 })); }
      updateArea(g, tx, ty);
      // resorte
      const ch = L.chunk(g.pcx, g.pcy);
      for (const q of ch.pois) if (q.k === 'spring' && G.dist(p.x, p.y, q.tx * TS + 8, q.ty * TS + 8) < 56 && p.hp < p.hpMax) { p.hp = Math.min(p.hpMax, p.hp + 6); p.stat.poison = p.stat.burn = 0; g.parts.push({ x: p.x, y: p.y, vx: 0, vy: -20, t: 0, max: 0.6, col: '#7aff9a', size: 2 }); }
    }
    // eventos
    if (!g.boss && !p.dead) { g.eventT -= dt; if (g.eventT <= 0) { g.eventT = G.rand(75, 150); const camp = L.chunk(g.pcx, g.pcy).kind === 'camp'; if (!camp) randomEvent(g); } }
    // autoguardado
    g.autoT -= dt;
    if (g.autoT <= 0) { g.autoT = 20; if (!g.boss) App.saveNow(); }
  }

  function updateArea(g, tx, ty) {
    const L = g.level, ch = L.chunk(g.pcx, g.pcy), t = L.t(tx, ty);
    let name;
    if (ch.kind === 'dungeon') name = 'Mazmorra';
    else if (ch.kind === 'arena' && Math.hypot(tx - (ch.cx * CS + 16), ty - (ch.cy * CS + 16)) < 15) name = 'Arena de ' + G.BOSSES[ch.boss].name;
    else if (t === T.CFLOOR) name = 'Cuevas';
    else name = G.BIOMES[L.biomeOf(tx, ty)].name;
    g.biomeName = name;
    if (name !== g.lastBiome) { g.lastBiome = name; g.banner = { text: name, t: 0 }; }
    g.darkTarget = G.DARK_T[t] ? 1 : 0;
  }

  function updateDrops(g, dt) {
    const p = g.p, L = g.level, mg = p.st.magnet;
    for (let i = g.drops.length - 1; i >= 0; i--) {
      const d = g.drops[i];
      d.t += dt; d.life -= dt;
      if (d.noPick > 0) d.noPick -= dt;
      if (d.vx || d.vy) {
        const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
        if (!L.solidPx(nx, d.y, true)) d.x = nx; else d.vx = 0;
        if (!L.solidPx(d.x, ny, true)) d.y = ny; else d.vy = 0;
        const f = Math.pow(0.02, dt); d.vx *= f; d.vy *= f; if (Math.abs(d.vx) + Math.abs(d.vy) < 3) { d.vx = d.vy = 0; }
      }
      const dist = G.dist(p.x, p.y, d.x, d.y);
      const canPick = !(d.noPick > 0) && !p.dead;
      if (canPick && (d.kind !== 'item' || G.invFree(p) > 0 || d.item.kind === 'cons') && dist < mg) { const a = G.ang(d.x, d.y, p.x, p.y), sp = 140; d.x += Math.cos(a) * sp * dt; d.y += Math.sin(a) * sp * dt; }
      if (canPick && dist < 9) {
        if (d.kind === 'gold') { p.gold += d.amt; G.sfx('coin'); G.floatText(g, p.x, p.y - 10, '+' + d.amt, '#ffd24a'); g.drops.splice(i, 1); continue; }
        if (d.kind === 'orb') { p.hp = Math.min(p.hpMax, p.hp + p.hpMax * d.amt); G.sfx('heal'); G.floatText(g, p.x, p.y - 10, '♥', '#ff6a8a'); g.drops.splice(i, 1); continue; }
        if (d.kind === 'item') {
          if (G.addToInv(p, d.item)) {
            G.sfx(d.item.kind !== 'cons' && d.item.rar >= 3 ? 'win' : 'pickup');
            G.toast(g, G.itemName(d.item) + (d.item.kind === 'cons' && d.item.n > 1 ? ' ×' + d.item.n : ''), G.itemColor(d.item));
            g.drops.splice(i, 1); continue;
          } else if (!d.warned) { d.warned = true; G.toast(g, 'Inventario lleno', '#ff8080'); }
        }
      }
      if (dist > 70 && d.warned) d.warned = false;
      if (d.life <= 0 && d.kind !== 'item') g.drops.splice(i, 1);
    }
  }

  /* ---------- Renderizado ---------- */
  const GROUND_DECOR = new Uint8Array(32); [O.FLOWER, O.TALL, O.MUSH, O.BONES].forEach((i) => (GROUND_DECOR[i] = 1));
  const MAP_SHOW = new Uint8Array(32); [O.TREE, O.PINE, O.CACTUS, O.ROCK, O.CHEST, O.CHESTO, O.SHRINE, O.SHRINEON, O.ALTAR, O.ALTARU, O.GATE, O.FIRE, O.PILLAR].forEach((i) => (MAP_SHOW[i] = 1));
  const AMB = { snow: ['#fff', 14, 38], ash: ['#ff9a4a', -18, 22], sand: ['#e8d490', 70, 10], spore: ['#9ae04a', -8, 10], leaf: ['#7adf5a', 24, 20] };

  function sprShadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, 6.283); ctx.fill(); }
  function drawSprite(info, x, y, flip, flash, alpha, sy) {
    const img = flash ? info.white : info.img;
    ctx.save();
    if (alpha != null && alpha < 1) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    if (sy) ctx.scale(1, sy);
    ctx.drawImage(img, -Math.round(info.w / 2), -info.h);
    ctx.restore();
  }
  function render(g) {
    const p = g.p, L = g.level, cam = g.cam, time = g.time;
    const sh = g.shake;
    cam.x = Math.round(p.x - VW / 2); cam.y = Math.round(p.y - VH / 2);
    const ox = sh > 0.2 ? Math.round((Math.random() - 0.5) * sh) : 0, oy = sh > 0.2 ? Math.round((Math.random() - 0.5) * sh) : 0;
    const cx0 = cam.x - ox, cy0 = cam.y - oy;
    ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, VW, VH);
    const tx0 = Math.floor(cx0 / TS), ty0 = Math.floor(cy0 / TS), tx1 = tx0 + Math.ceil(VW / TS) + 1, ty1 = ty0 + Math.ceil(VH / TS) + 1;
    const draws = [];
    const fr = Math.floor(time * 2.2);
    for (let cy = G.fdiv(ty0, CS); cy <= G.fdiv(ty1, CS); cy++) for (let cx = G.fdiv(tx0, CS); cx <= G.fdiv(tx1, CS); cx++) {
      const ch = L.chunk(cx, cy);
      const ax = Math.max(tx0, cx * CS), bx = Math.min(tx1, cx * CS + CS - 1), ay = Math.max(ty0, cy * CS), by = Math.min(ty1, cy * CS + CS - 1);
      for (let ty = ay; ty <= by; ty++) for (let tx = ax; tx <= bx; tx++) {
        const i = (ty - cy * CS) * CS + (tx - cx * CS), t = ch.t[i], o = ch.o[i], v = ch.v[i];
        const sx = tx * TS - cx0, sy = ty * TS - cy0;
        ctx.drawImage(S.tiles[t][G.ANIM_T[t] ? (v + fr) & 3 : v], sx, sy);
        if (o) {
          if (GROUND_DECOR[o]) ctx.drawImage(S.objs[o][G.ANIM_O[o] ? (v + fr) & 3 : v], sx, sy);
          else draws.push({ y: (ty + 1) * TS - 2, o, v: G.ANIM_O[o] ? (v + fr) & 3 : v, x: sx, yy: sy });
        }
      }
    }
    // suelo: objetos caídos
    for (const d of g.drops) {
      const sx = d.x - cx0, sy = d.y - cy0;
      if (sx < -20 || sx > VW + 20 || sy < -20 || sy > VH + 20) continue;
      const bob = Math.sin(d.t * 4 + d.x) * 1.5;
      if (d.kind === 'gold') { ctx.drawImage(S.icon({ kind: 'cons', id: 'hp1' }) && coinIcon(), Math.round(sx - 4), Math.round(sy - 4 + bob), 8, 8); }
      else if (d.kind === 'orb') { ctx.fillStyle = '#ff6a8a'; ctx.beginPath(); ctx.arc(sx, sy + bob, 3, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(sx - 1, sy - 2 + bob, 1, 1); }
      else if (d.kind === 'item') {
        const it = d.item, col = G.itemColor(it);
        if (it.kind !== 'cons' && it.rar >= 2) { ctx.globalAlpha = 0.35 + Math.sin(d.t * 5) * 0.15; ctx.fillStyle = col; ctx.fillRect(Math.round(sx - 1), Math.round(sy - 22), 2, 22); ctx.globalAlpha = 1; }
        sprShadow(sx, sy + 5, 5);
        ctx.drawImage(S.icon(it), Math.round(sx - 8), Math.round(sy - 10 + bob));
      }
    }
    // entidades ordenadas por profundidad
    for (const n of g.npcs) draws.push({ y: n.y + 6, npc: n });
    for (const e of g.enemies) draws.push({ y: e.y + e.r * 0.6, e });
    for (const b of g.bossList) draws.push({ y: b.y + b.r * 0.6, e: b });
    draws.push({ y: p.y + 6, player: true });
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) {
      if (d.o) ctx.drawImage(S.objs[d.o][d.v], d.x, d.yy);
      else if (d.npc) drawNpc(d.npc, cx0, cy0);
      else if (d.e) drawEnemy(d.e, cx0, cy0, time);
      else if (d.player) drawPlayer(g, cx0, cy0);
    }
    // efectos de suelo
    for (const f of g.fx) drawFx(f, cx0, cy0);
    for (const q of g.projs) {
      const sx = q.x - cx0, sy = q.y - cy0;
      ctx.globalAlpha = 0.3; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(sx, sy, q.r + 2, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(sx, sy, q.r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(sx - 1), Math.round(sy - 1), 2, 2);
    }
    for (const q of g.parts) { ctx.globalAlpha = Math.max(0, 1 - q.t / q.max); ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x - cx0), Math.round(q.y - cy0), q.size, q.size); }
    ctx.globalAlpha = 1;
    // clima ambiental
    drawAmbient(g, cx0, cy0);
    // oscuridad (cuevas y mazmorras)
    g.dark += ((g.darkTarget || 0) - g.dark) * 0.08;
    if (g.dark > 0.02) drawDark(g, cx0, cy0);
    // textos
    ctx.textAlign = 'center';
    for (const q of g.texts) {
      ctx.font = (q.big ? 'bold 11px' : 'bold 9px') + ' monospace';
      ctx.globalAlpha = Math.min(1, (0.9 - q.t) * 3);
      const sx = Math.round(q.x - cx0), sy = Math.round(q.y - cy0);
      ctx.fillStyle = '#000'; ctx.fillText(q.txt, sx + 1, sy + 1); ctx.fillStyle = q.col; ctx.fillText(q.txt, sx, sy);
    }
    ctx.globalAlpha = 1;
    // viñeta de daño
    if (g.dmgVignette > 0 || p.hp < p.hpMax * 0.25) {
      const a = Math.max(g.dmgVignette, p.hp < p.hpMax * 0.25 ? 0.2 + Math.sin(time * 6) * 0.08 : 0);
      const gr = ctx.createRadialGradient(VW / 2, VH / 2, 90, VW / 2, VH / 2, 280);
      gr.addColorStop(0, 'rgba(180,0,0,0)'); gr.addColorStop(1, 'rgba(200,0,0,' + a.toFixed(2) + ')');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
    }
    // cartel de zona
    if (g.banner) {
      g.banner.t += 1 / 60;
      const t = g.banner.t, a = t < 0.5 ? t * 2 : t > 2.5 ? Math.max(0, (3 - t) * 2) : 1;
      if (t > 3) g.banner = null; else {
        ctx.globalAlpha = a; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = '#000'; ctx.fillText(g.banner.text, VW / 2 + 1, 71); ctx.fillStyle = '#f2e8ff'; ctx.fillText(g.banner.text, VW / 2, 70); ctx.globalAlpha = 1;
      }
    }
    // retícula
    if (!UI.isOpen()) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; const mx = Math.round(mouse.x), my = Math.round(mouse.y); ctx.beginPath(); ctx.moveTo(mx - 4, my); ctx.lineTo(mx - 1, my); ctx.moveTo(mx + 2, my); ctx.lineTo(mx + 5, my); ctx.moveTo(mx, my - 4); ctx.lineTo(mx, my - 1); ctx.moveTo(mx, my + 2); ctx.lineTo(mx, my + 5); ctx.stroke(); }
    // minimapa
    g.mapT--;
    if (g.mapT <= 0) { g.mapT = 8; drawMini(g); }
  }
  let coinC = null;
  function coinIcon() { if (!coinC) { coinC = document.createElement('canvas'); coinC.width = coinC.height = 8; const c = coinC.getContext('2d'); c.fillStyle = '#7a5a10'; c.fillRect(1, 0, 6, 8); c.fillRect(0, 1, 8, 6); c.fillStyle = '#f2c94c'; c.fillRect(1, 1, 6, 6); c.fillStyle = '#ffe888'; c.fillRect(2, 2, 2, 2); c.fillStyle = '#c8903a'; c.fillRect(4, 4, 2, 2); } return coinC; }

  function drawNpc(n, cx0, cy0) {
    const D = G.NPCS[n.npc], info = S.ent(D.shape, D.pal, 1.2);
    const sx = n.x - cx0, sy = n.y - cy0;
    sprShadow(sx, sy + 3, 6);
    drawSprite(info, sx, sy + 4, false, false, 1, 1 + Math.sin(n.anim * 2) * 0.02);
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(D.name, sx + 1, sy - 17); ctx.fillStyle = n.npc === 'merchant' ? '#ffd24a' : '#9ad0ff'; ctx.fillText(D.name, sx, sy - 18);
  }
  function drawEnemy(e, cx0, cy0, time) {
    const sx = e.x - cx0, sy = e.y - cy0;
    if (sx < -60 || sx > VW + 60 || sy < -60 || sy > VH + 60) return;
    const D = e.boss ? e.B : e.D;
    const info = S.ent(D.shape, D.pal, e.boss ? e.B.scale : (e.scale || 1), e.boss ? e.B.decor : null);
    const feet = sy + e.r * 0.6;
    sprShadow(sx, feet, e.r * 1.1);
    if (e.elite) { ctx.globalAlpha = 0.5 + Math.sin(time * 6) * 0.2; ctx.strokeStyle = G.ELITE_MODS[e.elite].col; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, feet, e.r * 1.5, e.r * 0.7, 0, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
    const flash = e.flash > 0 && Math.floor(time * 30) % 2 === 0 || (e.state === 'wind' && Math.floor(time * 16) % 2 === 0) || (e.boss && e.cur && e.ps === 1 && (e.curK === 'charge' || e.curK === 'summon') && Math.floor(time * 14) % 2 === 0);
    const bob = e.D && e.D.fly ? Math.sin(e.anim * 6) * 2 - 4 : 0;
    const sq = e.D && e.D.ai === 'hop' ? 1 + Math.sin(e.anim * 10) * 0.07 * (e.state === 'hop' ? 2 : 0.4) : 1;
    drawSprite(info, sx, feet + bob, e.face < 0, flash, e.alpha, sq);
    if (e.st.stun > 0) { ctx.fillStyle = '#ffee70'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText('✦', sx, feet - info.h - 2); }
    if (e.st.burn > 0) { ctx.fillStyle = '#ff8a2a'; ctx.fillRect(Math.round(sx - 3), Math.round(feet - info.h * 0.5), 2, 2); }
    if (e.st.poison > 0) { ctx.fillStyle = '#8bd04a'; ctx.fillRect(Math.round(sx + 2), Math.round(feet - info.h * 0.6), 2, 2); }
    if (e.st.slow > 0) { ctx.fillStyle = '#9ae0ff'; ctx.fillRect(Math.round(sx), Math.round(feet - info.h * 0.3), 2, 2); }
    if (!e.boss && e.hp < e.hpMax) {
      const w = Math.max(12, e.r * 2.4), bx = Math.round(sx - w / 2), by = Math.round(feet - info.h + 4);
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, w + 2, 4); ctx.fillStyle = '#c02a2a'; ctx.fillRect(bx, by, Math.max(0, w * e.hp / e.hpMax), 2);
    }
    if (e.elite) { ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; const nm = G.ELITE_MODS[e.elite].n + ' ' + e.D.name; const ny = Math.round(feet - info.h - 2); ctx.fillStyle = '#000'; ctx.fillText(nm, sx + 1, ny + 1); ctx.fillStyle = G.ELITE_MODS[e.elite].col; ctx.fillText(nm, sx, ny); }
    // indicador de carga del jefe
    if (e.boss && e.active && e.curK === 'charge' && e.ps === 1) { ctx.strokeStyle = 'rgba(255,60,60,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(e.cdir) * 140, sy + Math.sin(e.cdir) * 140); ctx.stroke(); }
  }
  function drawPlayer(g, cx0, cy0) {
    const p = g.p, sx = p.x - cx0, sy = p.y - cy0;
    if (p.dead) return;
    sprShadow(sx, sy + 6, 6);
    const frames = S.player(), fr = frames[Math.floor(p.anim) % 2 && p.moving ? 1 : 0];
    const blink = p.invuln > 0 && !p.dodgeT && Math.floor(g.time * 20) % 2 === 0;
    const flash = p.hitFlash > 0;
    ctx.save();
    ctx.globalAlpha = p.dodgeT > 0 ? 0.55 : blink ? 0.45 : 1;
    ctx.translate(Math.round(sx), Math.round(sy + 6));
    if (p.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(flash ? fr.white : fr.img, -6, -13);
    ctx.restore();
    ctx.globalAlpha = 1;
    // arma
    const w = p.equip.weapon;
    const ic = w ? S.icon(w) : null;
    if (ic) {
      const sw = p.swing > 0 ? 1 - p.swing / 0.16 : 0;
      const a = p.swing > 0 ? p.swingA + (sw - 0.5) * 1.8 : p.aim;
      const dist = 8 + (p.swing > 0 && G.WTYPES[w.wt].thrust ? Math.sin(sw * 3.14) * 6 : 0);
      ctx.save(); ctx.translate(Math.round(sx + Math.cos(a) * dist), Math.round(sy - 2 + Math.sin(a) * dist)); ctx.rotate(a + Math.PI / 4); ctx.drawImage(ic, -8, -8); ctx.restore();
    }
    if (p.shield > 0) { ctx.globalAlpha = 0.35 + Math.sin(g.time * 8) * 0.1; ctx.strokeStyle = '#7ad7ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 11, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
    if (p.buff.rage > 0 || p.buff.rageP > 0) { ctx.globalAlpha = 0.3; ctx.fillStyle = '#ff5a2a'; ctx.beginPath(); ctx.ellipse(sx, sy + 6, 9, 4, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
  }
  function drawFx(f, cx0, cy0) {
    const sx = (f.x || 0) - cx0, sy = (f.y || 0) - cy0;
    switch (f.k) {
      case 'tele': {
        const pr = Math.min(1, f.t / f.delay);
        ctx.globalAlpha = 0.14 + pr * 0.22; ctx.fillStyle = f.owner === 'p' ? '#ffb040' : f.col; ctx.beginPath(); ctx.arc(sx, sy, f.r, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 0.9; ctx.strokeStyle = f.col; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, f.r, 0, 6.283); ctx.stroke();
        ctx.globalAlpha = 0.5; ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(sx, sy, f.r * pr, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; break;
      }
      case 'zone': {
        ctx.globalAlpha = 0.22 + Math.sin(f.t * 5) * 0.06; ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(sx, sy, f.r, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 0.7; ctx.strokeStyle = f.col; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; break;
      }
      case 'ring': { const pr = f.t / f.life; ctx.globalAlpha = 1 - pr; ctx.strokeStyle = f.col; ctx.lineWidth = 3 * (1 - pr) + 1; ctx.beginPath(); ctx.arc(sx, sy, f.r * (0.3 + 0.7 * pr), 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; break; }
      case 'slash': {
        const pr = f.t / f.life; ctx.globalAlpha = 1 - pr * 0.8; ctx.strokeStyle = f.col; ctx.lineWidth = 3;
        if (f.thrust) { ctx.beginPath(); ctx.moveTo(sx + Math.cos(f.ang) * 6, sy + Math.sin(f.ang) * 6); ctx.lineTo(sx + Math.cos(f.ang) * (6 + f.range * (0.4 + pr * 0.8)), sy + Math.sin(f.ang) * (6 + f.range * (0.4 + pr * 0.8))); ctx.stroke(); }
        else { const a0 = f.ang - f.arc / 2 + pr * f.arc * 0.5, a1 = a0 + f.arc * 0.5; ctx.beginPath(); ctx.arc(sx, sy, f.range * 0.85, a0, a1); ctx.stroke(); }
        ctx.globalAlpha = 1; break;
      }
      case 'bolt': {
        ctx.globalAlpha = 1 - f.t / f.life; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath();
        f.pts.forEach((q, i) => { const x = q[0] - cx0 + (i && i < f.pts.length ? G.rand(-2, 2) : 0), y = q[1] - cy0; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        ctx.strokeStyle = '#ffee70'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; break;
      }
      case 'bomb': {
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, 6.283); ctx.fill();
        ctx.fillStyle = Math.floor(f.t * 10) % 2 ? '#ff4040' : '#ffd24a'; ctx.fillRect(Math.round(sx), Math.round(sy - 6), 2, 2);
        ctx.globalAlpha = 0.2; ctx.strokeStyle = '#ff6a2a'; ctx.beginPath(); ctx.arc(sx, sy, f.r, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; break;
      }
    }
  }
  function drawAmbient(g, cx0, cy0) {
    const L = g.level, p = g.p, bk = L.biomeOf(Math.floor(p.x / TS), Math.floor(p.y / TS));
    const kind = G.BIOMES[bk].weather, A_ = AMB[kind];
    if (!A_ || g.dark > 0.5) return;
    if (!g.amb.length) for (let i = 0; i < 40; i++) g.amb.push({ x: Math.random() * VW, y: Math.random() * VH, s: Math.random() });
    ctx.fillStyle = A_[0]; ctx.globalAlpha = 0.7;
    for (const a of g.amb) {
      a.x += (A_[1] + Math.sin(g.time + a.s * 9) * 8) * (1 / 60) * (0.6 + a.s); a.y += A_[2] * (1 / 60) * (0.6 + a.s);
      if (a.y > VH + 4) { a.y = -4; a.x = Math.random() * VW; } if (a.y < -6) a.y = VH; if (a.x > VW + 4) a.x = -4; if (a.x < -4) a.x = VW + 4;
      ctx.fillRect(Math.round(a.x), Math.round(a.y), a.s > 0.7 ? 2 : 1, a.s > 0.7 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }
  function drawDark(g, cx0, cy0) {
    const p = g.p, L = g.level;
    dkx.globalCompositeOperation = 'source-over';
    dkx.clearRect(0, 0, VW, VH);
    dkx.fillStyle = 'rgba(3,1,8,' + (0.94 * g.dark).toFixed(3) + ')';
    dkx.fillRect(0, 0, VW, VH);
    dkx.globalCompositeOperation = 'destination-out';
    const light = (x, y, r, a) => {
      const sx = x - cx0, sy = y - cy0;
      if (sx < -r || sx > VW + r || sy < -r || sy > VH + r) return;
      const gr = dkx.createRadialGradient(sx, sy, r * 0.15, sx, sy, r);
      gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dkx.fillStyle = gr; dkx.fillRect(sx - r, sy - r, r * 2, r * 2);
    };
    light(p.x, p.y, 105 + (p.buff.rage > 0 ? 15 : 0), 1);
    const fl = 1 + Math.sin(g.time * 9) * 0.05;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ch = L.chunk(g.pcx + dx, g.pcy + dy);
      for (const l of ch.lights) light(l[0] * TS + 8, l[1] * TS + 8, 62 * fl, 0.95);
    }
    for (const q of g.projs) if (q.from === 'p') light(q.x, q.y, 30, 0.8);
    for (const f of g.fx) if (f.k === 'ring' || f.k === 'bomb') light(f.x, f.y, 40, 0.6);
    dkx.globalCompositeOperation = 'source-over';
    ctx.drawImage(dk, 0, 0);
  }

  /* ---------- Mapa y minimapa ---------- */
  function mapImage(g, ctr_tx, ctr_ty, wT, hT) {
    const ws = g.ws, L = g.level;
    const id = tmpMap.getContext('2d').createImageData(wT, hT), d = id.data;
    const x0 = ctr_tx - Math.floor(wT / 2), y0 = ctr_ty - Math.floor(hT / 2);
    for (let cy = G.fdiv(y0, CS); cy <= G.fdiv(y0 + hT - 1, CS); cy++) for (let cx = G.fdiv(x0, CS); cx <= G.fdiv(x0 + wT - 1, CS); cx++) {
      const ex = ws.explored[cx + ',' + cy];
      if (!ex) continue;
      const ch = L.chunk(cx, cy);
      for (let ly = 0; ly < CS; ly++) for (let lx = 0; lx < CS; lx++) {
        const i = ly * CS + lx;
        if (!ex[i]) continue;
        const px = cx * CS + lx - x0, py = cy * CS + ly - y0;
        if (px < 0 || py < 0 || px >= wT || py >= hT) continue;
        const o = ch.o[i], ci = MAP_SHOW[o] ? G.MAP_O[o] : G.MAP_T[ch.t[i]], c = G.MAPRGB[ci] || [255, 0, 255];
        const q = (py * wT + px) * 4;
        d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
      }
    }
    return { id, x0, y0 };
  }
  const POI_ICON = { camp: ['◆', '#59e3e3'], boss: ['☠', '#d070ff'], dungeon: ['▣', '#ff9a2e'], altar: ['✚', '#d04a8a'], spring: ['○', '#7ad7ff'], special: ['◇', '#ffd24a'] };
  function drawPois(c2, g, x0, y0, sc, size) {
    c2.font = 'bold ' + size + 'px monospace'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
    for (const k in g.ws.discovered) for (const q of g.ws.discovered[k]) {
      const ic = POI_ICON[q.k]; if (!ic) continue;
      const x = (q.tx - x0) * sc, y = (q.ty - y0) * sc;
      if (x < 0 || y < 0 || x > c2.canvas.width || y > c2.canvas.height) continue;
      c2.fillStyle = '#000'; c2.fillText(ic[0], x + 1, y + 1); c2.fillStyle = ic[1]; c2.fillText(ic[0], x, y);
    }
    const sv = g.ws.save;
    c2.fillStyle = '#ffd24a'; c2.fillText('★', (sv.x / TS - x0) * sc, (sv.y / TS - y0) * sc);
  }
  function drawMini(g) {
    const p = g.p, tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
    const r = mapImage(g, tx, ty, 60, 60);
    tmpMap.width = 60; tmpMap.height = 60;
    tmpMap.getContext('2d').putImageData(r.id, 0, 0);
    mctx.imageSmoothingEnabled = false;
    mctx.clearRect(0, 0, 120, 120); mctx.drawImage(tmpMap, 0, 0, 120, 120);
    drawPois(mctx, g, r.x0, r.y0, 2, 9);
    mctx.fillStyle = '#fff'; mctx.fillRect(58, 58, 4, 4); mctx.fillStyle = '#e04050'; mctx.fillRect(59, 59, 2, 2);
  }
  G.drawMap = function (canvas, g, scale) {
    const c2 = canvas.getContext('2d'), p = g.p;
    const wT = Math.ceil(canvas.width / scale), hT = Math.ceil(canvas.height / scale);
    const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
    tmpMap.width = wT; tmpMap.height = hT;
    const r = mapImage(g, tx, ty, wT, hT);
    tmpMap.getContext('2d').putImageData(r.id, 0, 0);
    c2.imageSmoothingEnabled = false;
    c2.fillStyle = '#000'; c2.fillRect(0, 0, canvas.width, canvas.height);
    c2.drawImage(tmpMap, 0, 0, wT * scale, hT * scale);
    drawPois(c2, g, r.x0, r.y0, scale, 12);
    c2.fillStyle = '#000'; c2.fillText('▲', (p.x / TS - r.x0) * scale + 1, (p.y / TS - r.y0) * scale + 1);
    c2.fillStyle = '#fff'; c2.fillText('▲', (p.x / TS - r.x0) * scale, (p.y / TS - r.y0) * scale);
  };

  /* ---------- Bucle ---------- */
  let last = performance.now();
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    const g = G.game;
    if (!g) { renderIdle(ts); return; }
    if (!UI.isOpen() && g.state === 'play') update(g, dt);
    render(g);
    UI.updateHud(g);
  }
  function renderIdle(ts) {
    ctx.fillStyle = '#0d0a14'; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 30; i++) { const x = (i * 97 + ts * 0.01 * (1 + i % 3)) % VW, y = (i * 53 + ts * 0.02) % VH; ctx.fillStyle = i % 2 ? '#2a2140' : '#3a2f55'; ctx.fillRect(x, y, 2, 2); }
  }

  /* ---------- Arranque ---------- */
  function boot() {
    const st = G.Save.settings();
    if (st.sound === false) G.audio.on = false;
    S.init();
    UI.showTitle();
    requestAnimationFrame(frame);
  }
  window.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
})();
