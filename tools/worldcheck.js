// Verifica la generación procedural sin navegador: distribución de biomas/estructuras y conectividad de mazmorras, arenas y cofres.
// Uso: node tools/worldcheck.js [semilla]
const fs = require('fs'), path = require('path'), vm = require('vm');
global.window = global;
for (const f of ['util', 'data', 'items', 'skills', 'world']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f });
const G = global.G, T = G.T, O = G.O, CS = G.CS;
const seed = process.argv[2] ? parseInt(process.argv[2]) : 12345;
const ws = G.newWorldState('t', seed, false);
const L = new G.Level(ws);
const kinds = {}, biomes = {}, problems = [];
let chests = 0, enemies = 0, bosses = {}, unreachableChests = 0, unreachableEnemies = 0, cracks = 0;
const R = 28; // radio en chunks
for (let cy = -R; cy <= R; cy++) for (let cx = -R; cx <= R; cx++) {
  const ch = L.chunk(cx, cy);
  kinds[ch.kind] = (kinds[ch.kind] || 0) + 1;
  biomes[ch.biome] = (biomes[ch.biome] || 0) + 1;
  for (const e of ch.ents) { if (e.k === 'enemy') enemies++; if (e.k === 'boss') bosses[e.type] = (bosses[e.type] || 0) + 1; }
  // contenido
  for (let i = 0; i < CS * CS; i++) if (ch.o[i] === O.CHEST) chests++;
  if (ch.kind === 'dungeon' || ch.kind === 'arena' || ch.kind === 'camp' || ch.kind === 'ruins') {
    const walk = (x, y) => { if (x < 0 || y < 0 || x >= CS || y >= CS) return false; const i = y * CS + x, t = ch.t[i]; return !G.SOLID_T[t] && !G.SOLID_O[ch.o[i]] && t !== T.WATER; };
    // BFS desde un punto de entrada
    let start = null;
    if (ch.kind === 'dungeon') start = [15, 1]; else if (ch.kind === 'arena') start = [16, 20]; else if (ch.kind === 'camp') start = [16, 18]; else start = [1, 1];
    if (ch.kind === 'ruins') { const gd = G.BIOMES[ch.biome].ground; outer: for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) if (walk(x, y) && ch.t[y * CS + x] === gd) { start = [x, y, 1]; break outer; } }
    const seen = new Uint8Array(CS * CS), q = [start];
    if (!walk(start[0], start[1])) { problems.push(ch.kind + ' ' + cx + ',' + cy + ' inicio bloqueado'); continue; }
    seen[start[1] * CS + start[0]] = 1;
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (walk(nx, ny) && !seen[ny * CS + nx]) { seen[ny * CS + nx] = 1; q.push([nx, ny]); } } }
    // cofres (alcanzables si algún vecino caminable fue visitado) y enemigos
    for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) {
      const i = y * CS + x;
      if (ch.t[i] === T.CRACK) cracks++;
      if (ch.o[i] === O.CHEST) {
        const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < CS && ny < CS && seen[ny * CS + nx]; });
        if (!ok) { const behind = ch.kind === 'dungeon' || ch.kind === 'ruins'; if (!behind) { unreachableChests++; problems.push('cofre inalcanzable ' + ch.kind + ' ' + cx + ',' + cy + ' @' + x + ',' + y); } else unreachableChests += 0; }
      }
    }
    if (ch.kind === 'dungeon') {
      // todas las salas excepto bóveda/secretas deben ser alcanzables: el piso conectado debe cubrir la mayoría
      let floor = 0, reach = 0;
      for (let i = 0; i < CS * CS; i++) if (ch.t[i] === T.DFLOOR || ch.t[i] === T.SPIKE) { floor++; if (seen[i]) reach++; }
      if (reach / floor < 0.3) problems.push('mazmorra poco conectada ' + cx + ',' + cy + ' ' + (reach / floor).toFixed(2));
    }
  }
}
const tot = (2 * R + 1) ** 2;
console.log('semilla', seed, 'chunks', tot);
console.log('tipos', JSON.stringify(kinds));
console.log('biomas (por chunk central)', JSON.stringify(biomes));
console.log('cofres', chests, 'enemigos', enemies, 'jefes', JSON.stringify(bosses), 'paredes agrietadas', cracks);
console.log('problemas:', problems.length); problems.slice(0, 15).forEach((p) => console.log(' -', p));
// puntos de guardado: distancia máxima al santuario más cercano (aprox. por chunk)
const sh = []; for (let cy = -R; cy <= R; cy++) for (let cx = -R; cx <= R; cx++) { const k = L.chunk(cx, cy).kind; if (k === 'camp' || k === 'arena') sh.push([cx, cy]); }
let worst = 0; for (let cy = -15; cy <= 15; cy++) for (let cx = -15; cx <= 15; cx++) { let m = 1e9; for (const s of sh) m = Math.min(m, Math.hypot(s[0] - cx, s[1] - cy)); worst = Math.max(worst, m); }
console.log('distancia máx. al santuario más cercano (chunks, radio 15):', worst.toFixed(1));
