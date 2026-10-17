'use strict';
/* Interfaz: HUD, menú principal, nuevo mundo, pausa, inventario, habilidades, mapa, tienda, recompensa de jefe, muerte. */
(function () {
  const G = window.G;
  const $ = (id) => document.getElementById(id);
  const scr = $('screen');
  const A = {}; // acciones por data-a
  let cur = null, sel = null, shop = null, mapScale = 2, skillTab = 'war', invMode = 'inv';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const g = () => G.game;

  scr.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled || b.classList.contains('dis')) return;
    G.sfx('ui');
    const f = A[b.dataset.a];
    if (f) f(b.dataset, e);
  });
  function show(name, html, solid) { cur = name; scr.innerHTML = html; scr.className = 'on' + (solid ? ' solid' : ''); }
  function hide() { cur = null; scr.className = ''; scr.innerHTML = ''; }

  const UI = (G.ui = {
    isOpen: () => scr.classList.contains('on'),
    current: () => cur,
    close: hide,
  });

  /* ---------- Toasts ---------- */
  UI.toast = function (msg, col) {
    const c = $('toasts');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = msg; if (col) d.style.borderLeftColor = col;
    c.appendChild(d);
    while (c.children.length > 6) c.removeChild(c.firstChild);
    setTimeout(() => d.remove(), 4300);
  };

  /* ---------- HUD ---------- */
  let hudCache = {};
  const setT = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; const el = $(id); if (el) el.textContent = v; } };
  UI.buildHotbar = function () {
    const hb = $('hotbar');
    let h = '';
    ['Q', 'E', 'R', 'F'].forEach((k) => (h += '<div class="slot" id="sk-' + k + '"><span class="key">' + k + '</span><span class="ic"></span><div class="cd"></div><div class="cdt"></div></div>'));
    h += '<div style="width:10px"></div>';
    for (let i = 1; i <= 4; i++) h += '<div class="slot sm" id="qs-' + i + '"><span class="key">' + i + '</span><span class="ic"></span><span class="cnt"></span></div>';
    hb.innerHTML = h;
    hudCache = {};
  };
  UI.updateHud = function (gm) {
    const p = gm.p;
    $('hp-fill').style.width = Math.max(0, p.hp / p.hpMax * 100).toFixed(1) + '%';
    $('hp-shield').style.width = Math.min(100, p.shield / p.hpMax * 100).toFixed(1) + '%';
    setT('hp-text', Math.ceil(p.hp) + ' / ' + p.hpMax + (p.shield > 0 ? ' (+' + Math.ceil(p.shield) + ')' : ''));
    setT('gold', '● ' + p.gold);
    setT('points', p.pts > 0 ? '★ ' + p.pts + ' (K)' : '★ 0');
    setT('lvl', 'Nv. ' + G.heroLevel(p));
    setT('mode', gm.ws.hardcore ? '☠ HARDCORE' : '');
    const bf = [];
    if (p.buff.rage > 0) bf.push('Furia ' + Math.ceil(p.buff.rage));
    if (p.buff.rageP > 0) bf.push('Elixir de Furia ' + Math.ceil(p.buff.rageP));
    if (p.buff.speedP > 0) bf.push('Velocidad ' + Math.ceil(p.buff.speedP));
    if (p.buff.clover > 0) bf.push('Suerte ' + Math.ceil(p.buff.clover));
    if (p.buff.regen > 0) bf.push('Regeneración ' + Math.ceil(p.buff.regen));
    if (p.stat.poison > 0) bf.push('☠ Veneno');
    if (p.stat.burn > 0) bf.push('♨ Quemadura');
    if (p.lbCd > 0 && p.st.lastBreath) bf.push('Último Aliento ' + Math.ceil(p.lbCd) + 's');
    const bs = bf.join('|');
    if (hudCache.buffs !== bs) { hudCache.buffs = bs; $('buffs').innerHTML = bf.map((b) => '<span class="buff">' + b + '</span>').join(''); }
    setT('biome-name', gm.biomeName || '');
    setT('coords', Math.floor(p.x / 16) + ', ' + Math.floor(p.y / 16));
    // jefe
    const bb = $('boss-bar');
    if (gm.boss && gm.boss.active && !gm.boss.dead) {
      bb.classList.remove('hidden'); setT('boss-name', gm.boss.name + (gm.boss.phase === 2 ? ' — FURIA' : ''));
      $('boss-fill').style.width = Math.max(0, gm.boss.hp / gm.boss.hpMax * 100).toFixed(1) + '%';
    } else bb.classList.add('hidden');
    // aviso de interacción
    const pr = $('prompt');
    if (gm.interact && !UI.isOpen()) { pr.classList.remove('hidden'); setT('prompt', gm.interact.text); } else pr.classList.add('hidden');
    // habilidades
    ['Q', 'E', 'R', 'F'].forEach((k) => {
      const el = $('sk-' + k), id = p.bind[k];
      const key = 'sk' + k;
      const st = id ? id + '|' + Math.ceil((p.cds[id] || 0) * 10) : '-';
      if (hudCache[key] === st) return;
      hudCache[key] = st;
      if (!id) { el.querySelector('.ic').textContent = ''; el.querySelector('.cd').style.height = '0'; el.querySelector('.cdt').textContent = ''; el.classList.remove('ready'); el.title = 'Sin habilidad: aprende una activa en el árbol (K)'; return; }
      const A_ = G.ACT[id], cd = p.cds[id] || 0, mx = p.cdMax[id] || 1;
      el.querySelector('.ic').textContent = A_.ic; el.querySelector('.ic').style.color = A_.col;
      el.querySelector('.cd').style.height = cd > 0 ? Math.min(100, cd / mx * 100) + '%' : '0';
      el.querySelector('.cdt').textContent = cd > 0 ? (cd >= 10 ? Math.ceil(cd) : cd.toFixed(1)) : '';
      el.classList.toggle('ready', cd <= 0);
      el.title = A_.n + ' Nv.' + G.skillLvl(p, id);
    });
    for (let i = 0; i < 4; i++) {
      const el = $('qs-' + (i + 1)), id = p.quick[i];
      const n = id ? G.countCons(p, id) : 0;
      const key = 'q' + i, st = id + '|' + n;
      if (hudCache[key] === st) continue;
      hudCache[key] = st;
      const ic = el.querySelector('.ic');
      if (id && n > 0) { ic.innerHTML = '<img src="' + G.Sprites.iconSrc({ kind: 'cons', id }) + '">'; el.querySelector('.cnt').textContent = n; el.style.opacity = 1; el.title = G.CONS[id].name; }
      else if (id) { ic.innerHTML = '<img src="' + G.Sprites.iconSrc({ kind: 'cons', id }) + '" style="opacity:.3">'; el.querySelector('.cnt').textContent = '0'; el.title = G.CONS[id].name + ' (agotado)'; }
      else { ic.innerHTML = ''; el.querySelector('.cnt').textContent = ''; el.title = 'Vacío: asigna un consumible desde el inventario (I)'; }
    }
    // pista
    if (gm.hintT > 0) { $('hint').innerHTML = gm.hint; } else $('hint').innerHTML = '';
  };

  /* ---------- Menú principal ---------- */
  function fmtDate(t) { try { return new Date(t).toLocaleDateString('es-AR') + ' ' + new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  UI.showTitle = function () {
    hide();
    G.game = null;
    $('hud').classList.add('hidden');
    let cards = '';
    for (let i = 0; i < 3; i++) {
      const s = G.Save.summary(i);
      if (!s) {
        cards += '<div class="wcard empty"><div class="t">Mundo ' + (i + 1) + '</div><div class="m">Vacío.<br>Crea un mundo nuevo con generación aleatoria infinita.</div><button class="btn pri" data-a="new" data-i="' + i + '">Crear mundo</button> <button class="btn sm" data-a="import" data-i="' + i + '">Importar</button></div>';
      } else {
        cards += '<div class="wcard"><div class="t">' + esc(s.name) + '</div><div class="m">' + (s.hardcore ? '<span class="tag hc">HARDCORE</span>' : '<span class="tag" style="color:#8fd8a0;border-color:#8fd8a0">NORMAL</span>') + '<br>Nivel ' + s.level + ' · Jefes: ' + s.bosses + '<br>Enemigos: ' + s.kills + ' · Tiempo: ' + G.fmtTime(s.play) + '<br><span style="color:#6a5f85">' + fmtDate(s.updated) + '</span></div>' +
          (s.corrupt ? '' : '<button class="btn pri" data-a="cont" data-i="' + i + '">Continuar</button>') + '<button class="btn dng sm" data-a="del" data-i="' + i + '">Borrar</button><button class="btn sm" data-a="export" data-i="' + i + '">Exportar</button></div>';
      }
    }
    show('title', '<div class="panel" style="text-align:center;background:transparent;border:none;box-shadow:none"><h1>CRIPTA ERRANTE</h1><div class="sub">Roguelike de acción · mundos infinitos · tres partidas independientes</div><div class="slots">' + cards + '</div><div class="hr"></div><div class="row" style="justify-content:center"><button class="btn" data-a="controls">Controles</button><button class="btn" data-a="sound">Sonido: ' + (G.audio.on ? 'SÍ' : 'NO') + '</button></div>' + (G.Save.available() ? '' : '<div style="color:#ff8080;margin-top:8px">⚠ El navegador bloquea el almacenamiento local: no se podrá guardar.</div>') + '</div>', true);
  };
  A.new = (d) => {
    show('newworld', '<div class="panel" style="width:min(440px,94vw)"><h2>Nuevo mundo — ranura ' + (+d.i + 1) + '</h2><label>Nombre</label><input type="text" id="nw-name" maxlength="22" value="Mundo ' + (+d.i + 1) + '"><label style="display:block;margin-top:8px">Semilla (opcional, vacío = aleatoria)</label><input type="text" id="nw-seed" maxlength="24" placeholder="aleatoria"><div style="margin-top:12px"><label><input type="checkbox" id="nw-hc"> <b style="color:#ff7060">Modo Hardcore</b></label><div class="sub">La muerte borra el mundo y todo el progreso de esta ranura. Recompensa: +25% oro, +suerte y +1 punto por jefe.</div></div><div class="row" style="justify-content:flex-end"><button class="btn" data-a="title">Cancelar</button><button class="btn pri" data-a="create" data-i="' + d.i + '">Crear y jugar</button></div></div>');
  };
  A.create = (d) => {
    const name = ($('nw-name').value || 'Mundo').trim().slice(0, 22) || 'Mundo';
    const sd = ($('nw-seed').value || '').trim();
    const seed = sd ? (/^-?\d+$/.test(sd) ? parseInt(sd, 10) | 0 : G.strHash(sd) | 0) : (Math.random() * 4294967296) | 0;
    G.app.newWorld(+d.i, { name, seed, hardcore: $('nw-hc').checked });
  };
  A.cont = (d) => G.app.continueSlot(+d.i);
  A.del = (d) => {
    const s = G.Save.summary(+d.i);
    show('confirm', '<div class="panel" style="width:min(380px,94vw)"><h2>¿Borrar «' + esc(s ? s.name : '') + '»?</h2><div class="sub">Se perderá el mundo y el progreso. No se puede deshacer.</div><div class="row" style="justify-content:flex-end"><button class="btn" data-a="title">Cancelar</button><button class="btn dng" data-a="delok" data-i="' + d.i + '">Borrar definitivamente</button></div></div>');
  };
  A.delok = (d) => { G.Save.del(+d.i); UI.showTitle(); };
  A.title = () => UI.showTitle();
  A.export = (d) => {
    try {
      const blob = new Blob([G.Save.exportText(+d.i)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cripta-errante-mundo' + (+d.i + 1) + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { UI.toast('No se pudo exportar'); }
  };
  A.import = (d) => {
    show('import', '<div class="panel" style="width:min(420px,94vw)"><h2>Importar mundo → ranura ' + (+d.i + 1) + '</h2><div class="sub">Selecciona un archivo .json exportado previamente.</div><input type="file" id="imp-file" accept=".json,application/json"><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-a="title">Cancelar</button></div></div>');
    $('imp-file').onchange = (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { try { G.Save.importText(+d.i, r.result); UI.showTitle(); UI.toast('Mundo importado'); } catch (e) { UI.toast('Archivo inválido: ' + e.message, '#ff6060'); } };
      r.readAsText(f);
    };
  };
  A.sound = () => { G.audio.on = !G.audio.on; const s = G.Save.settings(); s.sound = G.audio.on; G.Save.saveSettings(s); if (cur === 'title') UI.showTitle(); else if (cur === 'pause') UI.showPause(); };
  A.controls = () => UI.showControls(cur === 'pause' ? 'pause' : 'title');
  UI.showControls = function (back) {
    show('controls', '<div class="panel"><h2>Controles</h2><table class="ctl"><tr><td><kbd>W A S D</kbd> / flechas</td><td>Moverse</td></tr><tr><td>Ratón</td><td>Apuntar</td></tr><tr><td><kbd>Clic izq.</kbd> / <kbd>J</kbd></td><td>Atacar (mantener para repetir)</td></tr><tr><td><kbd>Shift</kbd> / <kbd>Clic der.</kbd></td><td>Esquivar (invulnerable un instante)</td></tr><tr><td><kbd>Espacio</kbd></td><td>Interactuar (guardar, cofres, mercader…). Sin nada cerca: esquivar</td></tr><tr><td><kbd>Q</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>F</kbd></td><td>Habilidades activas</td></tr><tr><td><kbd>1</kbd>–<kbd>4</kbd></td><td>Consumibles rápidos</td></tr><tr><td><kbd>I</kbd></td><td>Inventario y equipo</td></tr><tr><td><kbd>K</kbd></td><td>Árbol de habilidades</td></tr><tr><td><kbd>M</kbd></td><td>Mapa</td></tr><tr><td><kbd>Esc</kbd> / <kbd>P</kbd></td><td>Pausa</td></tr></table><div class="hr"></div><div class="sub" style="max-width:520px;line-height:1.6">• Los santuarios (cristal turquesa) guardan la partida y curan.<br>• Las paredes agrietadas se rompen con bombas, Meteoro o explosiones: esconden salas secretas.<br>• Cada jefe derrotado da puntos de habilidad: gástalos o guárdalos.</div><div class="row" style="justify-content:flex-end"><button class="btn pri" data-a="' + (back === 'pause' ? 'pause' : 'title') + '">Volver</button></div></div>');
  };

  /* ---------- Pausa ---------- */
  UI.showPause = function () {
    const gm = g();
    show('pause', '<div class="panel" style="width:min(340px,94vw);text-align:center"><h2>PAUSA</h2><div class="sub">' + esc(gm.ws.name) + (gm.ws.hardcore ? ' · HARDCORE' : '') + ' · ' + G.fmtTime(gm.ws.play) + '</div><div style="display:flex;flex-direction:column"><button class="btn pri" data-a="resume">Reanudar</button><button class="btn" data-a="inv">Inventario (I)</button><button class="btn" data-a="skills">Habilidades (K)</button><button class="btn" data-a="map">Mapa (M)</button><button class="btn" data-a="controls">Controles</button><button class="btn" data-a="sound">Sonido: ' + (G.audio.on ? 'SÍ' : 'NO') + '</button><button class="btn" data-a="unstuck">¿Atascado? Volver al último guardado</button><button class="btn dng" data-a="quit">Guardar y salir al menú</button></div></div>');
  };
  A.pause = () => UI.showPause();
  A.resume = () => { hide(); G.app.resume(); };
  A.unstuck = () => { hide(); G.app.unstuck(); };
  A.quit = () => { G.app.toTitle(); };
  A.inv = () => UI.showInventory();
  A.skills = () => UI.showSkills();
  A.map = () => UI.showMap();

  /* ---------- Inventario ---------- */
  function itemImg(it) { return '<img src="' + G.Sprites.iconSrc(it) + '">'; }
  function cell(it, attrs, extra) {
    const bd = it ? 'border-color:' + G.itemColor(it) : '';
    return '<div class="cell ' + (extra || '') + '" ' + attrs + ' style="' + bd + '">' + (it ? itemImg(it) + (it.kind === 'cons' && it.n > 1 ? '<span class="cnt">' + it.n + '</span>' : '') : '') + '</div>';
  }
  const SLOTN = { weapon: 'Arma', armor: 'Armadura', charm1: 'Amuleto 1', charm2: 'Amuleto 2' };
  UI.showInventory = function () {
    const gm = g(), p = gm.p;
    G.ensureInv(p);
    let eq = '<div style="display:flex;gap:6px;margin-bottom:10px">';
    ['weapon', 'armor', 'charm1', 'charm2'].forEach((s) => { eq += '<div style="text-align:center"><div style="font-size:10px;color:#9a8fb5">' + SLOTN[s] + '</div>' + cell(p.equip[s], 'data-a="selEq" data-s="' + s + '"', (sel && sel.t === 'eq' && sel.s === s ? 'sel ' : '') + 'eq') + '</div>'; });
    eq += '</div>';
    let grid = '<div class="grid">';
    for (let i = 0; i < p.inv.length; i++) grid += cell(p.inv[i], 'data-a="selInv" data-i="' + i + '"', sel && sel.t === 'inv' && sel.i === i ? 'sel' : '');
    grid += '</div>';
    const s = p.st, pc = (v) => Math.round(v * 100) + '%';
    const stats = '<div class="statlist"><b>Estadísticas</b><br>Vida: ' + Math.ceil(p.hp) + '/' + p.hpMax + '<br>Daño: ×' + s.dmg.toFixed(2) + ' (prom. arma ' + (G.avgDmg(p)).toFixed(1) + ')<br>Crítico: ' + pc(s.crit) + ' (×' + s.critDmg.toFixed(2) + ')<br>Vel. ataque: ×' + s.as.toFixed(2) + '<br>Velocidad: ×' + s.spd.toFixed(2) + '<br>Armadura: ' + Math.round(s.def) + ' (-' + Math.round(100 - 4000 / (40 + s.def)) + '% daño)<br>Regeneración: ' + s.regen.toFixed(1) + '/s<br>Robo de vida: ' + pc(s.lifesteal) + '<br>Poder mágico: ×' + s.magic.toFixed(2) + '<br>Enfriamiento: -' + pc(s.cdr) + '<br>Oro extra: +' + pc(s.gold) + ' · Suerte: +' + pc(s.luck) + '<br>Quemar/Veneno/Frío: ' + pc(s.burn) + '/' + pc(s.poison) + '/' + pc(s.slow) + '</div>';
    show('inv', '<div class="panel"><h2>Inventario <span style="font-size:13px;color:#ffd24a">● ' + p.gold + ' oro</span></h2><div class="cols"><div>' + eq + grid + '<div class="sub" style="margin-top:6px">Espacios: ' + (p.inv.filter((x) => x).length) + '/' + p.inv.length + ' · Clic para seleccionar</div></div><div><div class="detail" id="inv-detail">' + detailHTML() + '</div></div>' + stats + '</div><div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn pri" data-a="closeScr">Cerrar</button></div></div>');
  };
  function selItem() {
    const p = g().p;
    if (!sel) return null;
    if (sel.t === 'inv') return p.inv[sel.i];
    return p.equip[sel.s];
  }
  function detailHTML() {
    const p = g().p, it = selItem();
    if (!it) { sel = null; return '<div style="color:#9a8fb5">Selecciona un objeto para ver sus detalles.</div>'; }
    let h = G.itemHTML(it);
    if (sel.t === 'inv' && it.kind !== 'cons') {
      const slot = it.kind === 'weapon' ? 'weapon' : it.kind === 'armor' ? 'armor' : 'charm1';
      const cu = p.equip[slot];
      if (it.kind === 'weapon') { const a = G.weaponStats(it).dps, b = cu ? G.weaponStats(cu).dps : G.weaponStats({ min: 2, max: 3, rate: 0.4, wt: 'fist' }).dps; h += '<div class="stat' + (a < b ? ' neg' : '') + '">vs equipado: DPS ' + (a >= b ? '+' : '') + (a - b).toFixed(1) + '</div>'; }
      if (it.kind === 'armor') { const d = it.def - (cu ? cu.def : 0); h += '<div class="stat' + (d < 0 ? ' neg' : '') + '">vs equipado: Armadura ' + (d >= 0 ? '+' : '') + d + '</div>'; }
    }
    h += '<div class="hr"></div><div class="row">';
    if (sel.t === 'inv') {
      if (it.kind === 'cons') {
        h += '<button class="btn sm pri" data-a="useCons">Usar</button>';
        for (let i = 1; i <= 4; i++) h += '<button class="btn sm' + (p.quick[i - 1] === it.id ? ' pri' : '') + '" data-a="quick" data-q="' + (i - 1) + '">Rápido ' + i + '</button>';
      } else h += '<button class="btn sm pri" data-a="equip">Equipar</button>';
      h += '<button class="btn sm dng" data-a="drop">Tirar</button>';
    } else h += '<button class="btn sm" data-a="unequip">Quitar</button>';
    return h + '</div>';
  }
  A.selInv = (d) => { sel = { t: 'inv', i: +d.i }; UI.showInventory(); };
  A.selEq = (d) => { sel = { t: 'eq', s: d.s }; UI.showInventory(); };
  A.closeScr = () => { hide(); G.app.resume(); };
  A.equip = () => { const p = g().p; if (sel && sel.t === 'inv' && G.equipFromInv(p, sel.i)) { G.computeStats(p); G.sfx('pickup'); sel = null; } UI.showInventory(); };
  A.unequip = () => { const p = g().p; if (sel && sel.t === 'eq') { if (G.unequip(p, sel.s)) { G.computeStats(p); sel = null; } else UI.toast('Inventario lleno', '#ff8080'); } UI.showInventory(); };
  A.useCons = () => { const gm = g(), it = selItem(); if (it && it.kind === 'cons') { const id = it.id; G.useConsumable(gm, id); if (!G.countCons(gm.p, id)) sel = null; } UI.showInventory(); };
  A.quick = (d) => { const p = g().p, it = selItem(); if (it && it.kind === 'cons') { const q = +d.q; for (let i = 0; i < 4; i++) if (p.quick[i] === it.id) p.quick[i] = null; p.quick[q] = it.id; } UI.showInventory(); };
  A.drop = () => { const gm = g(), p = gm.p, it = selItem(); if (!it) return; if (sel.t === 'inv') { p.inv[sel.i] = null; G.spawnDrop(gm, p.x, p.y, 'item', { item: it, noPick: 2 }); sel = null; } UI.showInventory(); };

  /* ---------- Habilidades ---------- */
  UI.showSkills = function () {
    const gm = g(), p = gm.p;
    let tabs = '<div class="tabs">';
    for (const k in G.BRANCHES) tabs += '<div class="tab' + (skillTab === k ? ' on' : '') + '" data-a="stab" data-b="' + k + '" style="border-color:' + (skillTab === k ? '#fff' : G.BRANCHES[k].c) + '">' + G.BRANCHES[k].n + '</div>';
    tabs += '</div>';
    let nodes = '<div class="nodes">';
    G.SKILLS.filter((s) => s.b === skillTab).forEach((s) => {
      const l = G.skillLvl(p, s.id), un = G.skillUnlocked(p, s), mx = s.max >= 999 ? '∞' : s.max, full = l >= s.max;
      const cost = full ? 0 : G.skillCost(s, l);
      let pips = '';
      if (s.max < 999) { for (let i = 0; i < s.max; i++) pips += i < l ? '■' : '□'; } else pips = 'Nivel ' + l;
      let extra = '';
      if (s.t === 'a' && G.ACT[s.id]) { const A_ = G.ACT[s.id]; extra = '<div style="color:#8fd8a0">' + (l ? 'Actual: ' + A_.info(l, p.st) + ' · CD ' + (A_.cd(l) * (1 - p.st.cdr)).toFixed(1) + 's' : '') + (!full ? '<br>Siguiente: ' + A_.info(l + 1, p.st) + ' · CD ' + (A_.cd(l + 1) * (1 - p.st.cdr)).toFixed(1) + 's' : '') + '</div>'; }
      let req = '';
      if (!un) req = '<div class="req">Requiere: ' + G.skillReqText(p, s).join(', ') + '</div>';
      let btns = '';
      if (!full) btns += '<button class="btn sm pri" data-a="buy" data-id="' + s.id + '" ' + (G.canBuySkill(p, s.id) ? '' : 'disabled') + '>' + (l ? 'Mejorar' : 'Aprender') + ' (' + cost + ' ★)</button>';
      if (s.t === 'a' && l > 0) ['Q', 'E', 'R', 'F'].forEach((k) => { btns += '<button class="btn sm' + (p.bind[k] === s.id ? ' pri' : '') + '" data-a="bind" data-k="' + k + '" data-id="' + s.id + '">' + k + '</button>'; });
      nodes += '<div class="node' + (un ? '' : ' locked') + (full ? ' max' : '') + '"><div class="h" style="color:' + G.BRANCHES[s.b].c + '">' + s.n + '<span class="badge" style="color:' + (s.t === 'a' ? '#ffb070' : '#9ac0ff') + '">' + (s.t === 'a' ? 'ACTIVA' : 'PASIVA') + '</span></div><div class="pips">' + pips + (s.max < 999 ? ' <span style="color:#9a8fb5;letter-spacing:0">' + l + '/' + mx + '</span>' : '') + '</div><div>' + s.d + '</div>' + extra + req + '<div class="row" style="margin-top:4px">' + btns + '</div></div>';
    });
    nodes += '</div>';
    show('skills', '<div class="panel" style="width:min(940px,96vw)"><h2>Árbol de habilidades <span style="font-size:14px;color:#7ad7ff">★ ' + p.pts + ' puntos</span> <span style="font-size:12px;color:#9a8fb5">· Nivel de héroe ' + G.heroLevel(p) + '</span></h2><div class="sub">Sube una habilidad al máximo para desbloquear las siguientes ramas. Las Maestrías y la Ascensión nunca se agotan. Las activas se asignan a Q/E/R/F.</div>' + tabs + nodes + '<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn pri" data-a="closeScr">Cerrar</button></div></div>');
  };
  A.stab = (d) => { skillTab = d.b; UI.showSkills(); };
  A.buy = (d) => { const p = g().p; if (G.buySkill(p, d.id)) { G.sfx('pickup'); const gm = g(); G.toast(gm, 'Mejorado: ' + G.SKILL_BY_ID[d.id].n, '#7ad7ff'); } UI.showSkills(); };
  A.bind = (d) => { const p = g().p; for (const k in p.bind) if (p.bind[k] === d.id) p.bind[k] = null; p.bind[d.k] = d.id; UI.showSkills(); };

  /* ---------- Mapa ---------- */
  UI.showMap = function () {
    const gm = g();
    show('map', '<div class="panel" style="text-align:center"><h2>Mapa — ' + esc(gm.ws.name) + '</h2><canvas id="mapcv" width="480" height="360"></canvas><div class="sub" style="margin-top:6px"><span style="color:#fff">▲</span> Tú · <span style="color:#59e3e3">◆</span> Santuario/Campamento · <span style="color:#d070ff">☠</span> Arena de jefe · <span style="color:#ff9a2e">▣</span> Mazmorra · <span style="color:#d04a8a">✚</span> Altar · <span style="color:#7ad7ff">○</span> Manantial · <span style="color:#ffd24a">★</span> Guardado · Zoom ' + mapScale + 'x</div><div class="row" style="justify-content:center"><button class="btn sm" data-a="zoom" data-d="-1">Zoom −</button><button class="btn sm" data-a="zoom" data-d="1">Zoom +</button><button class="btn pri" data-a="closeScr">Cerrar</button></div></div>');
    G.drawMap($('mapcv'), gm, mapScale);
  };
  A.zoom = (d) => { mapScale = G.clamp(mapScale + +d.d, 1, 4); UI.showMap(); };

  /* ---------- Tienda ---------- */
  UI.showShop = function (stock, tab) {
    shop = { stock, tab: tab || 'buy' };
    renderShop();
  };
  function sellPrice(it) { return Math.max(1, Math.floor(G.itemValue(it) * 0.5)); }
  function renderShop() {
    const gm = g(), p = gm.p;
    let h = '<div class="panel" style="width:min(720px,96vw)"><h2>Mercader <span style="font-size:13px;color:#ffd24a">● ' + p.gold + ' oro</span></h2><div class="tabs"><div class="tab' + (shop.tab === 'buy' ? ' on' : '') + '" data-a="shtab" data-t="buy">Comprar</div><div class="tab' + (shop.tab === 'sell' ? ' on' : '') + '" data-a="shtab" data-t="sell">Vender</div></div>';
    if (shop.tab === 'buy') {
      h += '<div class="nodes">';
      shop.stock.forEach((s, i) => {
        if (s.sold) return;
        const can = p.gold >= s.price;
        h += '<div class="node"><div style="display:flex;gap:8px"><div class="cell" style="flex:none;cursor:default;border-color:' + G.itemColor(s.item) + '">' + itemImg(s.item) + '</div><div style="flex:1;font-size:12px">' + G.itemHTML(s.item) + '</div></div><div class="row" style="margin-top:4px"><button class="btn sm pri" data-a="shbuy" data-i="' + i + '" ' + (can ? '' : 'disabled') + '>Comprar (' + s.price + ' ●)</button></div></div>';
      });
      h += '</div>';
    } else {
      h += '<div class="nodes">';
      let any = false;
      p.inv.forEach((it, i) => {
        if (!it) return; any = true;
        const pr = it.kind === 'cons' ? Math.max(1, Math.floor(G.CONS[it.id].price * 0.4)) : sellPrice(it);
        h += '<div class="node"><div style="display:flex;gap:8px"><div class="cell" style="flex:none;cursor:default;border-color:' + G.itemColor(it) + '">' + itemImg(it) + (it.kind === 'cons' && it.n > 1 ? '<span class="cnt">' + it.n + '</span>' : '') + '</div><div style="flex:1;font-size:12px">' + G.itemHTML(it) + '</div></div><div class="row" style="margin-top:4px"><button class="btn sm" data-a="shsell" data-i="' + i + '">Vender 1 (' + pr + ' ●)</button></div></div>';
      });
      if (!any) h += '<div style="color:#9a8fb5">No tienes objetos para vender.</div>';
      h += '</div>';
    }
    h += '<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn pri" data-a="closeScr">Cerrar</button></div></div>';
    show('shop', h);
  }
  A.shtab = (d) => { shop.tab = d.t; renderShop(); };
  A.shbuy = (d) => {
    const p = g().p, s = shop.stock[+d.i];
    if (!s || s.sold || p.gold < s.price) return;
    const it = JSON.parse(JSON.stringify(s.item));
    if (!G.addToInv(p, it)) { UI.toast('Inventario lleno', '#ff8080'); return; }
    p.gold -= s.price; if (!s.inf) s.sold = true; G.sfx('coin'); renderShop();
  };
  A.shsell = (d) => {
    const p = g().p, it = p.inv[+d.i];
    if (!it) return;
    const pr = it.kind === 'cons' ? Math.max(1, Math.floor(G.CONS[it.id].price * 0.4)) : sellPrice(it);
    p.gold += pr;
    if (it.kind === 'cons' && it.n > 1) it.n--; else p.inv[+d.i] = null;
    G.sfx('coin'); renderShop();
  };

  /* ---------- Recompensa de jefe / muerte / diálogos ---------- */
  UI.showReward = function (info) {
    const p = g().p;
    show('reward', '<div class="panel" style="text-align:center;width:min(440px,94vw)"><h1 style="font-size:26px;letter-spacing:3px">¡JEFE DERROTADO!</h1><div style="color:#e8b0ff;font-size:16px;margin:4px 0">' + esc(info.boss) + '</div><div style="font-size:18px;color:#7ad7ff;margin:10px 0">+' + info.pts + ' puntos de habilidad</div><div class="sub">Tienes <b style="color:#7ad7ff">' + p.pts + ' ★</b> en total. Gástalos ahora para subir de nivel y desbloquear nuevas habilidades, o guárdalos para más tarde (se conservan).</div><div class="row" style="justify-content:center"><button class="btn pri" data-a="spend">Gastar ahora</button><button class="btn" data-a="closeScr">Guardar puntos</button></div></div>');
  };
  A.spend = () => UI.showSkills();
  UI.showDeath = function (info) {
    const gm = g(), st = gm.ws.stats;
    if (gm.ws.hardcore) {
      show('death', '<div class="panel" style="text-align:center;width:min(440px,94vw);border-color:#e0534a"><h1 style="color:#e0534a;font-size:30px">HAS MUERTO</h1><div class="sub" style="font-size:13px">Modo hardcore: tu mundo «' + esc(gm.ws.name) + '» se ha perdido.</div><div style="line-height:1.7">Jefes derrotados: <b>' + st.bosses + '</b><br>Enemigos: <b>' + st.kills + '</b><br>Distancia máx.: <b>' + st.maxDist + ' chunks</b><br>Nivel de héroe: <b>' + G.heroLevel(gm.p) + '</b><br>Tiempo: <b>' + G.fmtTime(gm.ws.play) + '</b></div><div class="row" style="justify-content:center;margin-top:12px"><button class="btn pri" data-a="title">Volver al menú</button></div></div>', true);
    } else {
      show('death', '<div class="panel" style="text-align:center;width:min(420px,94vw);border-color:#e0534a"><h1 style="color:#e0534a;font-size:30px">HAS MUERTO</h1><div class="sub" style="font-size:13px">Reaparecerás en el último santuario. Conservas habilidades, puntos y objetos.<br>Pierdes <b style="color:#ffd24a">' + info.lost + ' ●</b> de oro.' + (info.bossReset ? '<br>El jefe se ha reiniciado.' : '') + '</div><div class="row" style="justify-content:center;margin-top:10px"><button class="btn pri" data-a="respawn">Reaparecer</button></div></div>');
    }
  };
  A.respawn = () => { hide(); G.app.respawn(); };
  UI.showText = function (title, html, btn) {
    show('text', '<div class="panel" style="width:min(460px,94vw)"><h2>' + title + '</h2><div style="line-height:1.6;font-size:13px">' + html + '</div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" data-a="closeScr">' + (btn || 'Entendido') + '</button></div></div>');
  };
  UI.showAltar = function () {
    const p = g().p;
    show('altar', '<div class="panel" style="width:min(420px,94vw);border-color:#d04a8a"><h2 style="color:#d04a8a">Altar maldito</h2><div class="sub" style="font-size:13px;line-height:1.6">Un altar sediento. Ofrece sangre y te concederá un objeto de rareza elevada.<br>Coste: <b style="color:#ff7060">30% de tu vida actual</b> (' + Math.floor(p.hp * 0.3) + ' PV). No puede matarte.</div><div class="row" style="justify-content:flex-end"><button class="btn" data-a="closeScr">Alejarse</button><button class="btn dng" data-a="altarok">Ofrecer sangre</button></div></div>');
  };
  A.altarok = () => { hide(); G.app.altarSacrifice(); };
})();
