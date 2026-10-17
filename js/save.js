'use strict';
/* Guardado local (localStorage): 3 ranuras independientes. Incluye mundo (modificaciones, exploración, enemigos caídos) y jugador. */
(function () {
  const G = window.G;
  const PFX = 'cripta_errante_v1_';
  const KEYS = (i) => PFX + 'slot' + i;
  const ok = () => { try { localStorage.setItem(PFX + 't', '1'); localStorage.removeItem(PFX + 't'); return true; } catch (e) { return false; } };

  function packBits(arr) { // Uint8Array(1024) de 0/1 -> base64 de 128 bytes
    const out = new Uint8Array(arr.length >> 3);
    for (let i = 0; i < arr.length; i++) if (arr[i]) out[i >> 3] |= 1 << (i & 7);
    let s = ''; for (let i = 0; i < out.length; i++) s += String.fromCharCode(out[i]);
    return btoa(s);
  }
  function unpackBits(b64, n) {
    const s = atob(b64), arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) arr[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
    return arr;
  }
  const PLAYER_KEYS = ['x', 'y', 'hp', 'gold', 'pts', 'spent', 'skills', 'bind', 'equip', 'inv', 'quick', 'boss'];

  G.Save = {
    available: ok,
    summary(i) {
      try {
        const raw = localStorage.getItem(KEYS(i));
        if (!raw) return null;
        const d = JSON.parse(raw);
        const lvl = 1 + Object.values((d.player && d.player.skills) || {}).reduce((a, b) => a + b, 0);
        return { name: d.name, hardcore: d.hardcore, play: d.play || 0, updated: d.updated, level: lvl, bosses: (d.stats && d.stats.bosses) || 0, kills: (d.stats && d.stats.kills) || 0, dist: (d.stats && d.stats.maxDist) || 0, seed: d.seed };
      } catch (e) { return { name: '(dañado)', corrupt: true, play: 0, level: 1, bosses: 0, kills: 0 }; }
    },
    serialize(ws, p) {
      const d = {};
      for (const k in ws) if (k !== 'explored' && k !== 'player') d[k] = ws[k];
      d.updated = Date.now();
      ws.updated = d.updated;
      d.explored = {};
      for (const k in ws.explored) { const e = ws.explored[k]; let any = false; for (let i = 0; i < e.length; i++) if (e[i]) { any = true; break; } if (any) d.explored[k] = packBits(e); }
      const pl = {};
      PLAYER_KEYS.forEach((k) => (pl[k] = JSON.parse(JSON.stringify(p[k]))));
      d.player = pl;
      return d;
    },
    save(i, ws, p) {
      try { localStorage.setItem(KEYS(i), JSON.stringify(G.Save.serialize(ws, p))); return true; }
      catch (e) { console.warn('No se pudo guardar', e); return false; }
    },
    load(i) {
      const raw = localStorage.getItem(KEYS(i));
      if (!raw) return null;
      const d = JSON.parse(raw);
      const ex = {};
      for (const k in d.explored || {}) ex[k] = unpackBits(d.explored[k], G.CS * G.CS);
      d.explored = ex;
      d.mods = d.mods || {}; d.meta = d.meta || {}; d.dead = d.dead || {}; d.done = d.done || {}; d.discovered = d.discovered || {};
      d.stats = Object.assign({ kills: 0, bosses: 0, deaths: 0, chests: 0, maxDist: 0, secrets: 0 }, d.stats);
      return d;
    },
    del(i) { try { localStorage.removeItem(KEYS(i)); } catch (e) { /* nada */ } },
    exportText(i) { return localStorage.getItem(KEYS(i)) || ''; },
    importText(i, txt) {
      const d = JSON.parse(txt);
      if (!d || typeof d.seed !== 'number' || !d.player) throw new Error('Archivo de guardado inválido');
      localStorage.setItem(KEYS(i), JSON.stringify(d));
    },
    settings() { try { return JSON.parse(localStorage.getItem(PFX + 'settings') || '{}'); } catch (e) { return {}; } },
    saveSettings(s) { try { localStorage.setItem(PFX + 'settings', JSON.stringify(s)); } catch (e) { /* nada */ } },
  };
})();
