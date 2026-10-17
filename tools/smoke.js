// Prueba de humo en navegador headless (Playwright): arranca el juego real y ejercita mundo, combate, jefes, habilidades, UI y guardado.
// Uso: node tools/smoke.js   (requiere Playwright instalado; usa Chromium del sistema)
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const results = [];
const errors = [];
const ok = (name, cond, extra) => { results.push([cond ? 'OK  ' : 'FALLA', name, extra || '']); if (!cond) process.exitCode = 1; };

(async () => {
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }).catch(() => pw.chromium.launch({ args: ['--no-sandbox'] }));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  const noErr = (name) => ok(name + ' (sin errores JS)', errors.length === 0, errors.slice(0, 3).join(' // '));

  await page.goto(url);
  await wait(500);
  ok('Título muestra 3 ranuras', (await ev(() => document.querySelectorAll('.wcard').length)) === 3);
  noErr('Carga inicial');

  // ---- nueva partida normal en ranura 0
  await page.click('[data-a="new"][data-i="0"]');
  await page.fill('#nw-name', 'Prueba A');
  await page.fill('#nw-seed', '4242');
  await page.click('[data-a="create"]');
  await wait(1200);
  ok('Partida creada', await ev(() => !!G.game && G.game.ws.name === 'Prueba A' && G.game.ws.seed !== 0));
  ok('HUD visible', await ev(() => !document.getElementById('hud').classList.contains('hidden')));
  noErr('Primer segundo de juego');

  // ---- entrada real: moverse, atacar, esquivar
  await page.keyboard.down('KeyD'); await wait(500); await page.keyboard.up('KeyD');
  const mv = await ev(() => G.game.p.x - G.game.ws.save.x);
  ok('Movimiento con teclado', Math.abs(mv) > 10, 'dx=' + mv.toFixed(1));
  await page.mouse.move(800, 300); await page.mouse.down(); await wait(500); await page.mouse.up();
  await page.keyboard.press('Shift'); await wait(200);
  noErr('Ataque y esquiva');

  // ---- interacción: cofre del campamento, sabio, santuario
  const chestPos = await ev(() => { const g = G.game; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (g.level.o(x, y) === G.O.CHEST) return [x, y]; return null; });
  ok('Cofre de bienvenida existe', !!chestPos);
  await ev((c) => { const g = G.game; g.p.x = c[0] * 16 + 8; g.p.y = c[1] * 16 + 24; }, chestPos);
  await wait(300);
  await page.keyboard.press('Space'); await wait(500);
  ok('Cofre se abre (objeto cambia)', await ev((c) => G.game.level.o(c[0], c[1]) === G.O.CHESTO, chestPos));
  ok('Cofre generó botín', await ev(() => G.game.ws.stats.chests === 1 && (G.game.drops.length > 0 || G.game.p.inv.filter(Boolean).length > 1 || G.game.p.gold > 20)));
  const shr = await ev(() => { const g = G.game; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (g.level.o(x, y) === G.O.SHRINE) return [x, y]; return null; });
  await ev((c) => { const g = G.game; g.p.x = c[0] * 16 + 8; g.p.y = c[1] * 16 + 24; g.p.hp = 10; }, shr);
  await wait(300);
  const ep0 = await ev(() => G.game.ws.epoch);
  await page.keyboard.press('Space'); await wait(400);
  ok('Santuario cura y guarda', await ev((e) => G.game.p.hp === G.game.p.hpMax && G.game.ws.epoch === e + 1 && localStorage.getItem('cripta_errante_v1_slot0') !== null, ep0));
  // mercader
  const npc = await ev(() => { const n = G.game.npcs.find((n) => n.npc === 'merchant'); return n ? [n.x, n.y] : null; });
  ok('Mercader presente', !!npc);
  await ev((c) => { G.game.p.x = c[0] + 16; G.game.p.y = c[1]; G.game.p.gold = 5000; }, npc);
  await wait(300); await page.keyboard.press('Space'); await wait(300);
  ok('Tienda abre', (await ev(() => G.ui.current())) === 'shop');
  const bought = await ev(() => { const b = document.querySelector('[data-a="shbuy"]:not([disabled])'); if (b) { b.click(); return true; } return false; });
  ok('Compra funciona', bought && (await ev(() => G.game.p.gold)) < 5000);
  await page.keyboard.press('Escape'); await wait(200);
  noErr('Interacciones');

  // ---- equipo y estadísticas de HP enorme para pruebas de combate
  await ev(() => { const p = G.game.p; p.equip.armor = { uid: 'x', kind: 'armor', rar: 4, tier: 1, name: 'Test', def: 0, aff: { hp: 1e7 } }; G.computeStats(p); p.hp = p.hpMax; });

  // ---- recorrido por tipos de chunk (genera mundo, renderiza, spawnea entidades)
  const tour = await ev(() => {
    const g = G.game, seed = g.ws.seed, kinds = {};
    for (let cy = -12; cy <= 12; cy++) for (let cx = -12; cx <= 12; cx++) { const k = G.chunkKind(seed, cx, cy); if (!kinds[k]) kinds[k] = []; if (kinds[k].length < 3) kinds[k].push([cx, cy]); }
    return kinds;
  });
  ok('El mundo contiene todos los tipos de chunk', ['wild', 'camp', 'ruins', 'grove', 'altar', 'spring', 'dungeon', 'arena'].every((k) => tour[k] && tour[k].length), Object.keys(tour).join(','));
  for (const k of Object.keys(tour)) {
    for (const [cx, cy] of tour[k]) {
      await ev(([cx, cy]) => {
        const g = G.game, L = g.level;
        let best = null;
        for (let r = 0; r < 14 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) {
          const tx = cx * 32 + 16 + dx, ty = cy * 32 + 20 + dy;
          if (L.freeTile(tx, ty) && L.freeTile(tx + 1, ty) && L.freeTile(tx, ty + 1)) { best = [tx, ty]; break; }
        }
        g.p.x = best[0] * 16 + 8; g.p.y = best[1] * 16 + 8;
        g.p.hp = g.p.hpMax;
      }, [cx, cy]);
      await wait(350);
    }
  }
  noErr('Recorrido por todos los tipos de chunk');
  const dist = await ev(() => G.game.ws.stats.maxDist);
  ok('Distancia máxima registrada', dist > 5, 'chunks=' + dist);

  // ---- pruebas de simulación directa (juego en pausa; el render sigue corriendo)
  await ev(() => G.ui.showPause());
  const sim = await ev(() => {
    const out = { enemyTypes: {}, patterns: {}, errs: [] };
    const g = G.game, p = g.p, L = g.level;
    // plaza despejada: arena 1 (si existe)
    const seed = g.ws.seed;
    let ar = null;
    for (let cy = -12; cy <= 12 && !ar; cy++) for (let cx = -12; cx <= 12; cx++) if (G.chunkKind(seed, cx, cy) === 'arena') { ar = [cx, cy]; break; }
    const ax = (ar[0] * 32 + 16) * 16, ay = (ar[1] * 32 + 16) * 16;
    p.x = ax; p.y = ay + 70; p.hp = p.hpMax;
    g.enemies.length = 0; g.projs.length = 0; g.fx.length = 0;
    const step = (dt) => {
      for (const e of g.enemies.slice()) { if (e.dead) continue; G.updateEnemyStatus(g, e, dt); G.enemyAI(g, e, dt); }
      g.enemies = g.enemies.filter((e) => !e.dead);
      G.updateProjs(g, dt); G.updateFx(g, dt);
      for (const k of ['invuln', 'dodgeI']) p[k] = Math.max(0, p[k] - dt);
      g.drops.length = 0;
    };
    // enemigos: cada tipo, 12 s simulados, el jugador se mueve en círculos
    for (const type of Object.keys(G.ENEMIES)) {
      g.enemies.length = 0;
      const e = G.makeEnemy(type, 3, ax + 40, ay + 20, G.chance(0.5) ? 'explosive' : null);
      e.state = 'chase'; g.enemies.push(e);
      const hp0 = p.hp; let t = 0;
      try { for (let i = 0; i < 360; i++) { t += 1 / 30; p.x = ax + Math.cos(t * 0.8) * 60; p.y = ay + Math.sin(t * 0.8) * 60; step(1 / 30); } } catch (er) { out.errs.push(type + ': ' + er.message); }
      out.enemyTypes[type] = Math.round(hp0 - p.hp);
      p.hp = p.hpMax;
    }
    // jefes: 40 s simulados cada uno (fase 2 tras 15 s). Se registra cada patrón ejecutado.
    for (const type of Object.keys(G.BOSSES)) {
      g.enemies.length = 0; g.projs.length = 0; g.fx.length = 0;
      const b = G.makeBoss(type, 2, ax, ay - 20); b.active = true; g.boss = b; b.arenaKey = 'test';
      let t = 0; const kinds = new Set();
      try {
        for (let i = 0; i < 1500; i++) {
          t += 1 / 30; p.x = ax + Math.cos(t * 0.5) * 80; p.y = ay + Math.sin(t * 0.5) * 80 + 20;
          if (i === 450) b.hp = b.hpMax * 0.45;
          G.bossAI(g, b, 1 / 30); step(1 / 30);
          if (b.curK) kinds.add(b.curK);
          for (const e of g.enemies) if (e.master) { e.hp = 0; e.dead = true; }
        }
      } catch (er) { out.errs.push(type + ': ' + er.stack.split('\n').slice(0, 2).join(' | ')); }
      out.patterns[type] = { kinds: Array.from(kinds).join(','), phase: b.phase, dmgTaken: Math.round(p.hpMax - p.hp) };
      p.hp = p.hpMax; g.boss = null;
    }
    return out;
  });
  ok('IA de los 14 enemigos sin excepciones', sim.errs.length === 0, sim.errs.join(' // '));
  const dealing = Object.entries(sim.enemyTypes).filter(([, d]) => d > 0).length;
  ok('Los enemigos infligen daño al jugador', dealing >= 10, dealing + '/14 tipos dañaron: ' + JSON.stringify(sim.enemyTypes));
  ok('Los 7 jefes ejecutan patrones y entran en fase 2', Object.values(sim.patterns).every((x) => x.kinds.split(',').length >= 3 && x.phase === 2), JSON.stringify(sim.patterns));
  noErr('Simulación de enemigos y jefes (con render)');

  // ---- habilidades: comprar todo el árbol y lanzar todas las activas
  const sk = await ev(() => {
    const g = G.game, p = g.p, out = { bought: 0, errs: [], cast: {}, total: G.SKILLS.length };
    p.pts = 100000;
    let guard = 0, changed = true;
    while (changed && guard++ < 5000) {
      changed = false;
      for (const s of G.SKILLS) { const lim = s.max >= 999 ? 12 : s.max; while (G.skillLvl(p, s.id) < lim && G.canBuySkill(p, s.id)) { G.buySkill(p, s.id); out.bought++; changed = true; } }
    }
    out.locked = G.SKILLS.filter((s) => G.skillLvl(p, s.id) === 0).map((s) => s.id);
    out.asc = G.skillLvl(p, 'asc_pow');
    out.maxed = G.SKILLS.filter((s) => s.max < 999 && G.skillLvl(p, s.id) === s.max).length;
    // elementos en pantalla
    const L = g.level; const ax = p.x, ay = p.y;
    g.enemies.length = 0;
    for (let i = 0; i < 8; i++) { const e = G.makeEnemy('golem', 2, ax + 30 + i * 6, ay + (i % 2 ? 20 : -20), null); e.state = 'chase'; e.hp = e.hpMax = 1e6; g.enemies.push(e); }
    g.aimX = ax + 60; g.aimY = ay; p.aim = 0;
    for (const id of Object.keys(G.ACT)) {
      p.cds = {}; p.invuln = 0;
      try { const r = G.castSkill(g, id); out.cast[id] = r; for (let i = 0; i < 90; i++) { G.updateProjs(g, 1 / 30); G.updateFx(g, 1 / 30); for (const e of g.enemies) { G.updateEnemyStatus(g, e, 1 / 30); G.enemyAI(g, e, 1 / 30); } } } catch (er) { out.errs.push(id + ': ' + er.stack.split('\n').slice(0, 2).join(' | ')); }
    }
    p.cds = {}; g.enemies.length = 0; g.projs.length = 0; g.fx.length = 0;
    out.hp = p.hpMax; out.st = p.st.dmg;
    return out;
  });
  ok('Todo el árbol es comprable en cadena (nada queda bloqueado)', sk.locked.length === 0, 'bloqueadas: ' + sk.locked.join(','));
  ok('Nodos de Ascensión escalan sin límite (>10 niveles)', sk.asc >= 12, 'asc_pow=' + sk.asc);
  ok('Las 11 habilidades activas se lanzan sin errores', sk.errs.length === 0 && Object.values(sk.cast).filter(Boolean).length >= 10, JSON.stringify(sk.cast) + ' ' + sk.errs.join(' // '));
  noErr('Habilidades');

  // ---- objetos: generar muchos, mostrar tooltips, equipar, consumibles
  const items = await ev(() => {
    const out = { n: 0, rar: [0, 0, 0, 0, 0], errs: [], kinds: {} };
    try {
      for (let i = 0; i < 400; i++) { const it = G.genGear(1 + (i % 8), G.rollRarity(0.1, 0)); out.n++; out.rar[it.rar]++; out.kinds[it.kind + (it.wt ? ':' + it.wt : '')] = 1; G.itemHTML(it); G.Sprites.iconSrc(it); }
      Object.keys(G.CONS).forEach((id) => { G.itemHTML(G.genCons(id, 1)); G.Sprites.iconSrc(G.genCons(id, 1)); });
    } catch (e) { out.errs.push(e.stack.split('\n').slice(0, 3).join(' | ')); }
    return out;
  });
  ok('Generación de objetos (armas, armaduras, amuletos, rarezas)', items.errs.length === 0 && items.rar.every((x, i) => i >= 4 || x > 0) && Object.keys(items.kinds).length >= 8, JSON.stringify(items.rar) + ' ' + Object.keys(items.kinds).length + ' tipos ' + items.errs.join(''));
  const cons = await ev(() => {
    const g = G.game, p = g.p, out = { errs: [], used: {} };
    p.inv = []; G.ensureInv(p); p.hp = 50;
    for (const id of Object.keys(G.CONS)) G.addToInv(p, G.genCons(id, 2));
    for (const id of Object.keys(G.CONS)) { if (id === 'tele') continue; try { out.used[id] = G.useConsumable(g, id); } catch (e) { out.errs.push(id + ':' + e.message); } }
    for (let i = 0; i < 120; i++) { G.updateFx(g, 1 / 30); }
    out.tele = G.useConsumable(g, 'tele');
    return out;
  });
  ok('Todos los consumibles funcionan', cons.errs.length === 0 && Object.values(cons.used).every(Boolean) && cons.tele, JSON.stringify(cons));

  // ---- pantallas de UI
  await ev(() => { G.ui.close(); window.__drops = 0; const o = G.spawnDrop; G.spawnDrop = function () { window.__drops++; return o.apply(this, arguments); }; });
  for (const [key, expect] of [['KeyI', 'inv'], ['KeyK', 'skills'], ['KeyM', 'map']]) {
    await page.keyboard.press(key); await wait(250);
    ok('Pantalla ' + expect, (await ev(() => G.ui.current())) === expect);
    await page.keyboard.press(key); await wait(150);
    ok('Se cierra ' + expect, (await ev(() => G.ui.current())) === null);
  }
  await page.keyboard.press('Escape'); await wait(150);
  ok('Pausa con Esc', (await ev(() => G.ui.current())) === 'pause');
  await ev(() => G.ui.showInventory()); await wait(100);
  const inv = await ev(() => { document.querySelector('[data-a="selInv"]') && document.querySelector('[data-a="selInv"]').click(); const b = document.querySelector('[data-a="equip"],[data-a="useCons"]'); return !!b; });
  ok('Selección de objeto muestra acciones', inv);
  await ev(() => { for (const b of Object.keys(G.BRANCHES)) { G.ui.showSkills(); document.querySelector('[data-a="stab"][data-b="' + b + '"]').click(); } });
  await ev(() => G.ui.close());
  noErr('Pantallas de interfaz');

  // ---- jefe real: entrar a una arena, activar, matar y recibir recompensa
  await ev(() => { const p = G.game.p; p.equip.armor.aff.hp = 1e7; G.computeStats(p); p.hp = p.hpMax; });
  const arenaPos = await ev(() => { const seed = G.game.ws.seed; for (let r = 3; r < 14; r++) for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) if (G.chunkKind(seed, cx, cy) === 'arena') return [cx, cy]; return null; });
  await ev(([cx, cy]) => { const g = G.game; g.p.x = (cx * 32 + 16) * 16; g.p.y = (cy * 32 + 24) * 16; window.__pts0 = g.p.pts; }, arenaPos);
  await wait(1500);
  const bossOn = await ev(() => !!(G.game.boss && G.game.boss.active));
  ok('El jefe se activa y cierra las puertas', bossOn && (await ev(() => { const b = G.game.boss, ch = G.game.level.chunk(...b.arenaKey.split(',').map(Number)); let gates = 0; for (let i = 0; i < 1024; i++) if (ch.o[i] === G.O.GATE) gates++; return gates > 4; })));
  await wait(6000);
  ok('El jefe ataca (proyectiles/efectos) y el HUD lo muestra', await ev(() => !document.getElementById('boss-bar').classList.contains('hidden')));
  await ev(() => { const g = G.game; g.boss.hp = 3; g.boss.x = g.p.x + 12; g.boss.y = g.p.y; });
  await page.mouse.move(640 + 20, 360); await page.mouse.down(); await wait(1500); await page.mouse.up();
  await ev(() => { const g = G.game; if (g.boss) { G.damageEnemy(g, g.boss, 1e6, {}); } });
  await wait(3500);
  const rew = await ev(() => ({ ui: G.ui.current(), gain: G.game.p.pts - window.__pts0, d: G.game.ws.stats.bosses, drops: window.__drops }));
  ok('Jefe derrotado: recompensa de puntos y botín', rew.ui === 'reward' && rew.gain >= 3 && rew.d === 1 && rew.drops >= 10, JSON.stringify(rew));
  ok('Puertas se abren tras el jefe', await ev(([cx, cy]) => { const ch = G.game.level.chunk(cx, cy); let gates = 0; for (let i = 0; i < 1024; i++) if (ch.o[i] === G.O.GATE) gates++; return gates === 0; }, arenaPos));
  await page.click('[data-a="closeScr"]'); await wait(200);
  noErr('Combate real contra jefe');

  // ---- muerte en modo normal
  await ev(() => { const p = G.game.p; p.equip.armor = null; G.computeStats(p); p.hp = 5; p.invuln = 0; p.dodgeI = 0; p.gold = 1000; p.lbCd = 1e9; p.shield = 0; p.shieldT = 0; G.hurtPlayer(G.game, 9999, {}); });
  await wait(300);
  const dbg = await ev(() => ({ ui: G.ui.current(), hp: G.game.p.hp, dead: G.game.p.dead, st: G.game.state, inv: G.game.p.invuln, sh: G.game.p.shield, lb: G.game.p.lbCd, lbs: G.game.p.st.lastBreath }));
  ok('Muerte normal muestra pantalla de reaparición', dbg.ui === 'death' && (await ev(() => !!document.querySelector('[data-a="respawn"]'))), JSON.stringify(dbg));
  await page.click('[data-a="respawn"]'); await wait(800);
  const rs = await ev(() => { const g = G.game; return { alive: !g.p.dead && g.p.hp === g.p.hpMax, atSave: Math.hypot(g.p.x - g.ws.save.x, g.p.y - g.ws.save.y) < 2, gold: g.p.gold, skills: Object.keys(g.p.skills).length, state: g.state }; });
  ok('Reaparece en el último guardado conservando progreso', rs.alive && rs.atSave && rs.gold === 800 && rs.skills > 10 && rs.state === 'play', JSON.stringify(rs));
  noErr('Muerte/reaparición');

  // ---- persistencia: guardar, recargar la página, continuar
  const before = await ev(() => { const g = G.game; G.app.saveNow(); return { x: Math.round(g.p.x), skills: JSON.stringify(g.p.skills), seed: g.ws.seed, bosses: g.ws.stats.bosses, mods: Object.keys(g.ws.mods).length, explored: Object.keys(g.ws.explored).length, gold: g.p.gold, inv: g.p.inv.filter(Boolean).length }; });
  await page.reload(); await wait(600);
  ok('Tras recargar, la ranura 1 aparece guardada', await ev(() => !!document.querySelector('[data-a="cont"][data-i="0"]')));
  await page.click('[data-a="cont"][data-i="0"]'); await wait(1000);
  const after = await ev(() => { const g = G.game; return { x: Math.round(g.p.x), skills: JSON.stringify(g.p.skills), seed: g.ws.seed, bosses: g.ws.stats.bosses, mods: Object.keys(g.ws.mods).length, explored: Object.keys(g.ws.explored).length, gold: g.p.gold, inv: g.p.inv.filter(Boolean).length }; });
  ok('El progreso persiste tras cerrar y reabrir', JSON.stringify(before) === JSON.stringify(after), JSON.stringify(before) + ' vs ' + JSON.stringify(after));
  ok('El cofre abierto sigue abierto (mundo persistente)', await ev((c) => G.game.level.o(c[0], c[1]) === G.O.CHESTO, chestPos));
  ok('El mundo es determinista por semilla (misma semilla = mismo mapa)', await ev(() => { const g = G.game; const L2 = new G.Level(G.newWorldState('x', g.ws.seed, false)); let same = true; for (let i = 0; i < 40; i++) { const tx = i * 37 - 500, ty = i * 91 - 900; if (L2.t(tx, ty) !== g.level.t(tx, ty) && !g.ws.mods[G.fdiv(tx, 32) + ',' + G.fdiv(ty, 32)]) same = false; } return same; }));
  noErr('Recarga y continuación');

  // ---- independencia de ranuras + hardcore
  await ev(() => G.app.toTitle()); await wait(300);
  await page.click('[data-a="new"][data-i="1"]');
  await page.fill('#nw-name', 'Dura'); await page.check('#nw-hc'); await page.click('[data-a="create"]'); await wait(1000);
  const hc = await ev(() => ({ hc: G.game.ws.hardcore, name: G.game.ws.name, skills: Object.keys(G.game.p.skills).length, seed: G.game.ws.seed }));
  ok('Mundo hardcore independiente (progreso desde cero)', hc.hc && hc.name === 'Dura' && hc.skills === 0, JSON.stringify(hc));
  ok('Ranura 0 intacta mientras se juega la 1', await ev(() => JSON.parse(localStorage.getItem('cripta_errante_v1_slot0')).name === 'Prueba A'));
  await ev(() => { const p = G.game.p; p.invuln = 0; p.dodgeI = 0; p.lbCd = 1e9; p.shield = 0; G.hurtPlayer(G.game, 9999, {}); });
  await wait(400);
  ok('Hardcore: la muerte borra el mundo', (await ev(() => localStorage.getItem('cripta_errante_v1_slot1'))) === null && (await ev(() => !document.querySelector('[data-a="respawn"]'))));
  await page.click('[data-a="title"]'); await wait(300);
  ok('Tras morir en hardcore la ranura queda vacía; la otra sigue', await ev(() => !!document.querySelector('[data-a="new"][data-i="1"]') && !!document.querySelector('[data-a="cont"][data-i="0"]')));
  noErr('Hardcore y ranuras');

  // ---- tercera ranura: crear con semilla distinta y comprobar que mundos difieren
  await page.click('[data-a="new"][data-i="2"]'); await page.fill('#nw-seed', 'otra'); await page.click('[data-a="create"]'); await wait(800);
  ok('Tercera ranura creada con otra semilla', await ev(() => G.game.ws.seed !== 4242 && JSON.parse(localStorage.getItem('cripta_errante_v1_slot2')).seed === G.game.ws.seed));
  await wait(3000);
  noErr('Juego libre final');

  await page.screenshot({ path: path.join(__dirname, 'screenshot.png') });
  await browser.close();
  console.log(results.map((r) => r.join(' ')).join('\n'));
  console.log('\nErrores JS capturados:', errors.length); errors.slice(0, 10).forEach((e) => console.log(' -', e));
  const bad = results.filter((r) => r[0] !== 'OK  ').length;
  console.log(bad ? '\n' + bad + ' comprobaciones fallidas' : '\nTodas las comprobaciones pasaron (' + results.length + ')');
})().catch((e) => { console.log(results.map((r) => r.join(' ')).join('\n')); console.error('Fallo del arnés:', e.message.split('\n')[0]); errors.slice(0, 8).forEach((x) => console.log(' -', x)); process.exit(2); });
