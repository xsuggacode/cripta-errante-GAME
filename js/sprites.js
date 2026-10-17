'use strict';
/* Pixel art generado por código: sprites de entidades, tiles, objetos e iconos. Sin imágenes externas. */
(function () {
  const G = window.G, T = G.T, O = G.O;
  const S = (G.Sprites = { tiles: [], objs: [], entCache: {}, iconCache: {}, iconURL: {} });
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

  /* ---------- Mapas de píxeles (10 de ancho) ---------- */
  const MAPS = {
    slime: ['...oooo...', '..oabbao..', '.oabbaaao.', '.oaeaaeao.', '.oaaaaaao.', 'oaaaaaaaao', 'occcccccco', '.oooooooo.'],
    bat: ['o...oo...o', 'oo.oaao.oo', 'oaooaaooao', 'oaaoeeoaao', '.ooaaaaoo.', '...oaao...', '....oo....'].map((s) => s.slice(0, 10)),
    goblin: ['oo.oooo.oo', 'oaooaaooao', '.oaaaaaao.', '.oaeaaeao.', '..oaccao..', '...oooo...', '..obbbbo..', '.oabbbbao.', '.oabbbbao.', '..oo..oo..'],
    skel: ['..oooooo..', '.oaaaaaao.', '.oaeaaeao.', '.oaaccaao.', '..oaaaao..', '..obbbbo..', '.oabbbbao.', '..obbbbo..', '...oo.oo..', '..oo..oo..'],
    robe: ['...oooo...', '..occcco..', '.occcccco.', '.ocoeeoco.', '.occoocco.', '..occcco..', '.occbbcco.', 'occcbbccco', 'occcccccco', 'oooooooooo'],
    spider: ['o........o', '.oo.oo.oo.', 'o.oaaaao.o', '..oaeeao..', 'o.oaaaao.o', '.oo.cc.oo.', 'o...oo...o'],
    golem: ['..oooooo..', '.oabbbbao.', '.oaeaaeao.', '..oaaaao..', 'ooabbbbaoo', 'oaaabbaaao', 'oaoaaaaoao', 'ooocccoooo', '..occcco..', '..oo..oo..'],
    scorpion: ['......oo..', '.....obbo.', '.....oao..', 'oo..oaao..', 'oaoooaaoo.', '.oaeaaaeao', 'oo.oaaao.o', 'o..o.o.o..'],
    wolf: ['......o.o.', '.....oaoao', 'ooooooaaao', 'oaaaaaaeao', 'oaaaaaaaao', '.oaaaaaao.', '.oa.oa.oa.', '.oo.oo.oo.'],
    imp: ['..o....o..', '..oo..oo..', 'o.oaaaao.o', 'oooaeaeaoo', 'oaoaaaaoao', '.oaoccoao.', '..oabbao..', '...o..o...'],
    bog: ['..oo..oo..', '.oaaooaao.', 'oabaaaabao', 'oaeaaaaeao', 'oaaabbaaao', 'oacaaaacao', '.occccccco', '.o.oooo.o.'],
    ghost: ['...oooo...', '..oaaaao..', '.oaaaaaao.', '.oaeaaeao.', '.oaaaaaao.', '.oaaooaao.', '.oaaaaaao.', '.oaoaaoao.', '..o.oo.o..'],
    mimic: ['oooooooooo', 'obbbbbbbbo', 'obaaaaaabo', 'oaaeaaeaao', 'owowowowwo', 'oaaaaaaaao', 'obbbbbbbbo', 'occcccccco', 'oo......oo'],
    treant: ['..o.oo.o..', '.oaooooao.', 'oaaaaaaaao', '.oaeaaeao.', '.oaaccaao.', '..oaaaao..', '..obbbbo..', '.obbbbbbo.', 'obb.bb.bbo', 'oo..oo..oo'],
    player: ['....oooo....', '...occcco...', '..occccccco.', '..obbbbbbo..', '..obebbebo..', '..obbbbbbo..', '...oobbboo..', '..oaaaaaao..', '.oaaaddaaao.', '.obaaaaaabo.', '..oaaaaaao..', '..oaa..aao..', '..ooo..ooo..'],
  };
  const PAD = 10;

  function paintMap(ctx, map, pal, scale, oy) {
    const colors = { o: '#1b1424', w: '#ffffff', d: pal[4] || '#8a5a2a', a: pal[0], b: pal[1], c: pal[2], e: pal[3] };
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const ch = map[y][x];
        if (ch === '.') continue;
        ctx.fillStyle = colors[ch] || '#f0f';
        ctx.fillRect(Math.floor(x * scale), Math.floor(oy + y * scale), Math.ceil(scale), Math.ceil(scale));
      }
    }
  }
  function decorate(c, type, w) {
    const P = PAD;
    switch (type) {
      case 'crown': R(c, '#ffd24a', w * 0.28, P - 5, w * 0.44, 5); for (let i = 0; i < 3; i++) R(c, '#ffd24a', w * 0.28 + i * (w * 0.2), P - 9, 4, 5); R(c, '#e04050', w / 2 - 1, P - 4, 3, 3); break;
      case 'branches': R(c, '#6a4423', w * 0.2, P - 7, 3, 8); R(c, '#6a4423', w * 0.75, P - 7, 3, 8); R(c, '#3f9a3f', w * 0.1, P - 9, 6, 4); R(c, '#3f9a3f', w * 0.72, P - 9, 6, 4); break;
      case 'headdress': R(c, '#ffd24a', w * 0.15, P - 5, w * 0.7, 7); for (let i = 0; i < 5; i++) R(c, '#3a6ac8', w * 0.15 + i * (w * 0.14), P - 5, 3, 7); break;
      case 'icecrown': for (let i = 0; i < 5; i++) R(c, '#d8f4ff', w * 0.2 + i * (w * 0.13), P - 4 - (i % 2 ? 4 : 7), 4, 8); break;
      case 'heads': R(c, '#4a7a2a', 1, P - 6, 8, 8); R(c, '#4a7a2a', w - 9, P - 6, 8, 8); R(c, '#ffe040', 4, P - 3, 2, 2); R(c, '#ffe040', w - 6, P - 3, 2, 2); R(c, '#e04050', 3, P + 2, 4, 1); R(c, '#e04050', w - 7, P + 2, 4, 1); break;
      case 'flames': for (let i = 0; i < 5; i++) { R(c, '#ff7a1a', w * 0.2 + i * (w * 0.14), P - 6 - (i % 2) * 3, 4, 8); R(c, '#ffd24a', w * 0.2 + i * (w * 0.14) + 1, P - 3 - (i % 2) * 3, 2, 5); } break;
      case 'skullcrown': for (let i = 0; i < 4; i++) R(c, '#a050ff', w * 0.22 + i * (w * 0.17), P - 8 - (i % 2) * 2, 3, 9); R(c, '#e8e4d0', w / 2 - 3, P - 3, 6, 5); R(c, '#1b1424', w / 2 - 2, P - 1, 1, 1); R(c, '#1b1424', w / 2 + 1, P - 1, 1, 1); break;
    }
  }
  /* Devuelve {img, white, w, h}. El ancla es el centro inferior (pies). */
  S.ent = function (shape, pal, scale, decor) {
    scale = scale || 1;
    const key = shape + '|' + pal.join(',') + '|' + scale + '|' + (decor || '');
    if (S.entCache[key]) return S.entCache[key];
    const map = MAPS[shape] || MAPS.slime;
    const w = Math.ceil(map[0].length * scale), h = Math.ceil(map.length * scale + PAD);
    const img = cv(w, h), c = img.getContext('2d');
    paintMap(c, map, pal, scale, PAD);
    if (decor) decorate(c, decor, w);
    const white = cv(w, h), wc = white.getContext('2d');
    wc.drawImage(img, 0, 0);
    wc.globalCompositeOperation = 'source-in';
    wc.fillStyle = '#fff';
    wc.fillRect(0, 0, w, h);
    return (S.entCache[key] = { img, white, w, h });
  };
  S.player = function () {
    if (S.playerSpr) return S.playerSpr;
    const mk = (legShift) => {
      const map = MAPS.player.slice();
      if (legShift) { map[11] = '..oa....ao..'; map[12] = '..oo....oo..'; }
      const img = cv(12, 13), c = img.getContext('2d');
      paintMap(c, map, ['#3a6ac8', '#f0c8a0', '#5a3a1a', '#1b1424', '#f2c94c'], 1, 0);
      const white = cv(12, 13), wc = white.getContext('2d');
      wc.drawImage(img, 0, 0); wc.globalCompositeOperation = 'source-in'; wc.fillStyle = '#fff'; wc.fillRect(0, 0, 12, 13);
      return { img, white };
    };
    return (S.playerSpr = [mk(false), mk(true)]);
  };

  /* ---------- Tiles base ---------- */
  function spk(c, base, cols, n, r, two) {
    R(c, base, 0, 0, 16, 16);
    for (let i = 0; i < n; i++) { c.fillStyle = cols[(r() * cols.length) | 0]; c.fillRect((r() * 16) | 0, (r() * 16) | 0, two && r() < 0.3 ? 2 : 1, 1); }
  }
  function brick(c, base, line, hi, r) {
    R(c, base, 0, 0, 16, 16);
    for (let row = 0; row < 4; row++) { const y = row * 4; R(c, line, 0, y, 16, 1); const off = row % 2 ? 4 : 0; for (let x = off; x < 16; x += 8) R(c, line, x, y, 1, 4); }
    for (let i = 0; i < 8; i++) R(c, hi, (r() * 16) | 0, (r() * 16) | 0, 1, 1);
    R(c, hi, 0, 0, 16, 1);
  }
  const TD = {};
  TD[T.GRASS] = (c, r) => { spk(c, '#4f9a3c', ['#5fb04a', '#448a33', '#6bc255'], 26, r); c.fillStyle = '#3b7a2c'; for (let i = 0; i < 3; i++) c.fillRect((r() * 14) | 0, ((r() * 13) | 0) + 1, 1, 2); };
  TD[T.SAND] = (c, r) => spk(c, '#dcc27a', ['#e8d490', '#caaa62', '#f0dfa6'], 22, r, true);
  TD[T.SNOW] = (c, r) => spk(c, '#e8f0f8', ['#ffffff', '#cfdcec', '#b8cce0'], 20, r, true);
  TD[T.MUD] = (c, r) => { spk(c, '#4e5a34', ['#5d6b3c', '#3f4a2a', '#6a7a44'], 26, r); R(c, '#3a4426', (r() * 10) | 0, (r() * 12) | 0, 4, 2); };
  TD[T.ASH] = (c, r) => { spk(c, '#3d3a40', ['#4b474f', '#2f2c33', '#5a565e'], 24, r); if (r() < 0.3) R(c, '#ff6a2a', (r() * 15) | 0, (r() * 15) | 0, 1, 1); };
  TD[T.WATER] = (c, r, v) => { R(c, '#2f6fb8', 0, 0, 16, 16); for (let k = 0; k < 4; k++) { const y = (k * 4 + v) % 16, x = (k * 5 + v * 3) % 12; R(c, '#5a9ae0', x, y, 4, 1); R(c, '#245a9a', (x + 7) % 13, (y + 2) % 16, 3, 1); } };
  TD[T.LAVA] = (c, r, v) => { R(c, '#c2411a', 0, 0, 16, 16); for (let i = 0; i < 18; i++) { c.fillStyle = r() < 0.5 ? '#ff9a2e' : '#7a1f10'; c.fillRect((r() * 15) | 0, (r() * 15) | 0, 2, 1); } R(c, '#ffd24a', (v * 4) % 14, (v * 5) % 14, 2, 1); };
  TD[T.CFLOOR] = (c, r) => { spk(c, '#4a4351', ['#554d5e', '#3e3844', '#625a6c'], 24, r); R(c, '#3a3440', (r() * 12) | 0, (r() * 12) | 0, 3, 2); };
  TD[T.CWALL] = (c, r) => { R(c, '#2b2631', 0, 0, 16, 16); for (let i = 0; i < 6; i++) R(c, '#3d3646', (r() * 12) | 0, (r() * 12) | 0, 4, 3); R(c, '#4a4256', 0, 0, 16, 2); R(c, '#1a1620', 0, 14, 16, 2); };
  TD[T.DFLOOR] = (c, r) => { spk(c, '#5b566a', ['#655f75', '#504b5f'], 14, r); R(c, '#4c4859', 0, 0, 16, 1); R(c, '#4c4859', 0, 0, 1, 16); };
  TD[T.DWALL] = (c, r) => brick(c, '#2e2a3a', '#1e1a28', '#463f58', r);
  TD[T.DOOR] = (c, r) => { TD[T.DFLOOR](c, r); R(c, '#6b4423', 0, 0, 3, 16); R(c, '#6b4423', 13, 0, 3, 16); R(c, '#8a5a2a', 0, 0, 16, 4); R(c, '#3a2412', 0, 4, 16, 1); R(c, '#f2c94c', 1, 8, 1, 2); R(c, '#f2c94c', 14, 8, 1, 2); };
  TD[T.CRACK] = (c, r) => { brick(c, '#2e2a3a', '#1e1a28', '#463f58', r); const p = [[8, 0], [7, 3], [9, 5], [7, 8], [8, 11], [6, 13], [7, 15]]; p.forEach((q) => { R(c, '#0a0810', q[0], q[1], 2, 2); R(c, '#a79ac0', q[0] + 1, q[1], 1, 1); }); };
  TD[T.SPIKE] = (c, r) => { TD[T.DFLOOR](c, r); [3, 10].forEach((x) => [3, 10].forEach((y) => { R(c, '#7a8090', x, y, 3, 3); R(c, '#e8ecf4', x + 1, y, 1, 1); })); };
  TD[T.AFLOOR] = (c, r) => { spk(c, '#9a7a52', ['#a88a5c', '#8a6a46', '#b09064'], 22, r); R(c, '#7a5a3a', 0, 0, 16, 1); R(c, '#7a5a3a', 0, 0, 1, 16); };
  TD[T.AWALL] = (c, r) => { brick(c, '#5a3a30', '#3a2420', '#8a4a4a', r); R(c, '#a03a3a', 0, 0, 16, 2); };
  TD[T.RFLOOR] = (c, r) => spk(c, '#7b7660', ['#8a856c', '#6c6752', '#5f7a4a'], 26, r);
  TD[T.RWALL] = (c, r) => brick(c, '#5a5648', '#3a372e', '#7a7664', r);
  TD[T.TORCH] = (c, r, v) => { brick(c, '#2e2a3a', '#1e1a28', '#463f58', r); R(c, '#6b4423', 7, 7, 2, 7); R(c, '#9a9aa6', 6, 6, 4, 2); R(c, '#ff9a2e', 6, 2 + (v & 1), 4, 5); R(c, '#ffe070', 7, 3 + (v & 1), 2, 3); };
  TD[T.ICE] = (c, r) => { spk(c, '#bfe3f2', ['#d8f2ff', '#a0ccdf', '#ffffff'], 16, r); R(c, '#e8f8ff', (r() * 8) | 0, (r() * 14) | 0, 6, 1); };

  /* ---------- Objetos (capa transparente) ---------- */
  const OD = {};
  OD[O.TREE] = (c, r) => { R(c, '#4a2e16', 6, 9, 4, 7); R(c, '#6a4423', 7, 9, 3, 7); for (let y = 0; y < 13; y++) for (let x = 2; x < 14; x++) { const d = Math.hypot(x - 8, y - 6.5); if (d < 6.2) { c.fillStyle = d > 5 ? '#225a20' : x < 7 && y < 6 ? '#4aa23a' : '#2f7a2a'; c.fillRect(x, y, 1, 1); if (r() < 0.12) R(c, '#5cbc4a', x, y, 1, 1); } } };
  OD[O.PINE] = (c) => { R(c, '#5a3a1a', 7, 13, 2, 3); for (let i = 0; i < 3; i++) { const y = 1 + i * 4, w = 4 + i * 3; for (let k = 0; k < 5; k++) { const ww = Math.min(w, 2 + k * 2 + i); R(c, k < 2 ? '#2a7a4a' : '#1f5a3a', 8 - ww / 2, y + k, ww, 1); } R(c, '#fff', 7, y, 2, 1); } };
  OD[O.CACTUS] = (c, r) => { R(c, '#3f8f3f', 6, 3, 4, 12); R(c, '#3f8f3f', 3, 7, 3, 2); R(c, '#3f8f3f', 3, 4, 2, 4); R(c, '#3f8f3f', 10, 9, 3, 2); R(c, '#3f8f3f', 11, 6, 2, 4); R(c, '#5fb05f', 7, 3, 1, 12); for (let i = 0; i < 6; i++) R(c, '#d8f0a0', (r() * 8 + 4) | 0, (r() * 11 + 3) | 0, 1, 1); };
  OD[O.DEAD] = (c) => { R(c, '#6a5a48', 7, 6, 2, 9); R(c, '#6a5a48', 5, 5, 2, 1); R(c, '#6a5a48', 4, 3, 1, 3); R(c, '#6a5a48', 9, 4, 2, 1); R(c, '#6a5a48', 11, 2, 1, 3); R(c, '#6a5a48', 6, 8, 1, 2); R(c, '#4a3a2c', 8, 6, 1, 9); };
  OD[O.ROCK] = (c, r) => { for (let y = 4; y < 15; y++) for (let x = 1; x < 15; x++) { const d = Math.pow((x - 8) / 7, 2) + Math.pow((y - 10) / 5.5, 2); if (d < 1) { c.fillStyle = y > 12 ? '#5a5a62' : x < 6 && y < 9 ? '#b0b0b8' : '#8a8a92'; c.fillRect(x, y, 1, 1); } } R(c, '#6a6a72', 9, 8, 3, 1); };
  OD[O.FLOWER] = (c, r, v) => { const cols = ['#ff6a8a', '#ffd24a', '#ffffff', '#b080ff']; const col = cols[v & 3]; R(c, '#3f8a30', 5, 10, 1, 4); R(c, col, 4, 8, 3, 3); R(c, '#ffe070', 5, 9, 1, 1); R(c, '#3f8a30', 11, 8, 1, 5); R(c, cols[(v + 1) & 3], 10, 6, 3, 3); R(c, '#ffe070', 11, 7, 1, 1); };
  OD[O.TALL] = (c, r) => { for (let i = 0; i < 7; i++) { const x = 2 + ((r() * 12) | 0), h = 4 + ((r() * 5) | 0); R(c, i % 2 ? '#3f8a30' : '#5fb04a', x, 14 - h, 1, h); } };
  OD[O.MUSH] = (c, r, v) => { const gl = v & 1 ? '#c070ff' : '#7ad7ff'; R(c, '#d8d0e8', 5, 11, 2, 3); R(c, gl, 3, 8, 6, 3); R(c, '#fff', 4, 9, 1, 1); R(c, '#d8d0e8', 11, 12, 1, 2); R(c, gl, 9, 10, 4, 2); };
  OD[O.CHEST] = (c) => { R(c, '#1b1424', 1, 4, 14, 12); R(c, '#8a5a2a', 2, 8, 12, 7); R(c, '#a0692f', 2, 5, 12, 4); R(c, '#f2c94c', 2, 8, 12, 1); R(c, '#f2c94c', 7, 8, 2, 3); R(c, '#c8903a', 2, 12, 12, 1); };
  OD[O.CHESTO] = (c) => { R(c, '#1b1424', 1, 8, 14, 8); R(c, '#8a5a2a', 2, 10, 12, 5); R(c, '#2a1a10', 3, 9, 10, 2); R(c, '#f2c94c', 5, 9, 6, 1); R(c, '#a0692f', 2, 3, 12, 4); R(c, '#1b1424', 1, 2, 14, 1); };
  const shrine = (c, on, v) => { R(c, '#8a8a96', 3, 12, 10, 3); R(c, '#6a6a76', 5, 6, 6, 7); R(c, '#aaaab4', 5, 6, 1, 7); if (on) { R(c, 'rgba(89,227,227,0.25)', 3, 0 + (v & 1), 10, 8); R(c, '#59e3e3', 6, 1, 4, 5); R(c, '#d8ffff', 7, 2, 1, 3); if (v & 1) R(c, '#d8ffff', 4, 3, 1, 1); else R(c, '#d8ffff', 11, 2, 1, 1); } else { R(c, '#3a6a6a', 6, 2, 4, 4); } };
  OD[O.SHRINE] = (c, r, v) => shrine(c, false, v);
  OD[O.SHRINEON] = (c, r, v) => shrine(c, true, v);
  OD[O.ALTAR] = (c) => { R(c, '#5a4a5a', 2, 9, 12, 6); R(c, '#7a6a7a', 1, 8, 14, 2); R(c, '#d04a8a', 6, 11, 4, 1); R(c, '#d04a8a', 7, 10, 2, 3); R(c, '#ff80b8', 7, 11, 1, 1); };
  OD[O.ALTARU] = (c) => { R(c, '#4a3a4a', 2, 9, 12, 6); R(c, '#5a4a5a', 1, 8, 14, 2); R(c, '#2a1a2a', 6, 11, 4, 1); };
  OD[O.GATE] = (c) => { [1, 5, 9, 13].forEach((x) => { R(c, '#8a8a96', x, 0, 2, 16); R(c, '#c0c0cc', x, 0, 1, 16); }); R(c, '#5a5a66', 0, 3, 16, 2); R(c, '#5a5a66', 0, 11, 16, 2); };
  OD[O.FIRE] = (c, r, v) => { R(c, '#6a4423', 3, 12, 10, 2); R(c, '#4a2e16', 4, 10, 8, 2); R(c, '#ff7a1a', 5, 4 + (v & 1), 6, 8); R(c, '#ffd24a', 6, 6 + (v & 1), 4, 5); R(c, '#fff0a0', 7, 9, 2, 3); R(c, '#555', 2, 14, 3, 2); R(c, '#555', 11, 14, 3, 2); };
  OD[O.PILLAR] = (c) => { R(c, '#8a8a96', 4, 3, 8, 12); R(c, '#aaaab4', 4, 3, 2, 12); R(c, '#5a5a66', 10, 3, 2, 12); R(c, '#9a9aa6', 3, 2, 10, 2); R(c, '#9a9aa6', 3, 13, 10, 2); };
  OD[O.BONES] = (c) => { R(c, '#e8e4d0', 4, 8, 5, 4); R(c, '#1b1424', 5, 9, 1, 1); R(c, '#1b1424', 7, 9, 1, 1); R(c, '#e8e4d0', 9, 12, 5, 1); R(c, '#e8e4d0', 2, 14, 6, 1); };

  S.init = function () {
    for (let t = 0; t <= 19; t++) {
      S.tiles[t] = [];
      for (let v = 0; v < 4; v++) {
        const c = cv(16, 16), ctx = c.getContext('2d');
        (TD[t] || ((x) => R(x, '#f0f', 0, 0, 16, 16)))(ctx, G.mulberry32(t * 977 + v * 131 + 7), v);
        S.tiles[t][v] = c;
      }
    }
    for (let o = 1; o <= 18; o++) {
      S.objs[o] = [];
      for (let v = 0; v < 4; v++) {
        const c = cv(16, 16), ctx = c.getContext('2d');
        if (OD[o]) OD[o](ctx, G.mulberry32(o * 613 + v * 71 + 3), v);
        S.objs[o][v] = c;
      }
    }
  };
  S.tile = (t, v) => S.tiles[t][v & 3];
  S.obj = (o, v) => S.objs[o][v & 3];

  /* ---------- Iconos de ítems (16x16) ---------- */
  function line(c, x0, y0, x1, y1, col) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (let i = 0; i < 40; i++) {
      R(c, col, x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  const ICONS = {
    sword: (c) => { line(c, 4, 11, 13, 2, '#cfd8e6'); line(c, 5, 11, 13, 3, '#8a96aa'); line(c, 4, 7, 8, 11, '#f2c94c'); line(c, 5, 11, 2, 14, '#8a5a2a'); R(c, '#f2c94c', 1, 14, 2, 2); },
    dagger: (c) => { line(c, 7, 9, 12, 4, '#cfd8e6'); line(c, 8, 9, 12, 5, '#8a96aa'); line(c, 5, 8, 9, 12, '#f2c94c'); line(c, 7, 10, 4, 13, '#8a5a2a'); },
    axe: (c) => { line(c, 3, 14, 11, 5, '#8a5a2a'); line(c, 4, 14, 12, 5, '#6a4423'); R(c, '#cfd8e6', 9, 2, 5, 3); R(c, '#cfd8e6', 11, 5, 3, 3); R(c, '#8a96aa', 13, 3, 1, 5); },
    spear: (c) => { line(c, 2, 14, 11, 5, '#8a5a2a'); R(c, '#cfd8e6', 11, 3, 3, 3); R(c, '#cfd8e6', 12, 1, 2, 2); R(c, '#8a96aa', 14, 2, 1, 3); },
    bow: (c) => { [[10, 2], [11, 3], [12, 4], [12, 5], [12, 6], [12, 7], [12, 8], [12, 9], [11, 10], [10, 11], [9, 12]].forEach((p) => R(c, '#a0692f', p[0], p[1], 1, 1)); line(c, 9, 2, 9, 12, '#dddddd'); line(c, 2, 7, 11, 7, '#c8c8c8'); R(c, '#cfd8e6', 11, 6, 2, 3); },
    staff: (c, a) => { line(c, 3, 14, 10, 7, '#8a5a2a'); R(c, a || '#9ad0ff', 10, 2, 4, 4); R(c, '#fff', 11, 3, 1, 1); },
    armor: (c, a) => { R(c, '#1b1424', 1, 2, 14, 13); R(c, a || '#8a96aa', 2, 3, 12, 3); R(c, a || '#8a96aa', 4, 6, 8, 8); R(c, '#cfd8e6', 7, 4, 2, 9); R(c, '#1b1424', 6, 2, 4, 2); },
    ring: (c, a) => { R(c, '#f2c94c', 5, 7, 6, 6); R(c, 'rgba(0,0,0,0)', 7, 9, 2, 2); c.clearRect(7, 9, 2, 2); R(c, a || '#b070ff', 7, 4, 3, 3); R(c, '#fff', 8, 5, 1, 1); },
    potion: (c, a) => { R(c, '#8a5a2a', 7, 1, 2, 1); R(c, '#ddd', 7, 2, 2, 3); R(c, '#1b1424', 4, 4, 8, 11); R(c, a, 5, 5, 6, 9); R(c, '#fff', 6, 6, 1, 3); R(c, '#1b1424', 4, 4, 1, 1); R(c, '#1b1424', 11, 4, 1, 1); },
    scroll: (c, a) => { R(c, '#e8dcb0', 3, 3, 10, 10); R(c, '#c8b080', 2, 2, 12, 2); R(c, '#c8b080', 2, 12, 12, 2); R(c, a, 6, 6, 4, 4); R(c, '#fff', 7, 7, 1, 1); },
    bomb: (c) => { R(c, '#1b1424', 4, 6, 8, 9); R(c, '#1b1424', 3, 8, 10, 5); R(c, '#444458', 5, 7, 6, 7); R(c, '#888', 5, 8, 2, 2); line(c, 10, 6, 12, 3, '#8a5a2a'); R(c, '#ffd24a', 12, 2, 2, 2); R(c, '#ff7a1a', 13, 1, 1, 1); },
    clover: (c) => { [[4, 4], [8, 4], [4, 8], [8, 8]].forEach((p) => { R(c, '#3aa84a', p[0], p[1], 4, 4); R(c, '#6adf6a', p[0] + 1, p[1] + 1, 1, 1); }); R(c, '#2a7a3a', 7, 10, 2, 5); },
    map: (c) => { R(c, '#e8dcb0', 2, 3, 12, 10); R(c, '#c8b080', 2, 3, 12, 1); R(c, '#8a6a3a', 4, 5, 3, 1); R(c, '#8a6a3a', 6, 6, 3, 1); R(c, '#e04050', 9, 8, 1, 3); R(c, '#e04050', 8, 9, 3, 1); },
    coin: (c) => { R(c, '#f2c94c', 4, 4, 8, 8); R(c, '#ffe888', 5, 5, 2, 2); R(c, '#c8903a', 8, 9, 3, 2); },
  };
  S.icon = function (it) {
    let ic, col;
    if (it.kind === 'weapon') { ic = it.wt; col = G.RARITY[it.rar].c; }
    else if (it.kind === 'armor') { ic = 'armor'; col = ['#8a8a96', '#6aa86a', '#5a8ad0', '#9a6ad0', '#e0903a'][it.rar]; }
    else if (it.kind === 'charm') { ic = 'ring'; col = G.RARITY[it.rar].c; }
    else { const d = G.CONS[it.id]; ic = d.ic; col = d.col; }
    const key = ic + col;
    if (S.iconCache[key]) return S.iconCache[key];
    const c = cv(16, 16), ctx = c.getContext('2d');
    (ICONS[ic] || ICONS.coin)(ctx, col);
    return (S.iconCache[key] = c);
  };
  S.iconSrc = function (it) {
    const c = S.icon(it);
    if (!c._url) { try { c._url = c.toDataURL(); } catch (e) { c._url = ''; } }
    return c._url;
  };
})();
