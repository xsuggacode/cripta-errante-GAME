'use strict';
/* dificultades: facil, normal (la de siempre) y dificil. se elige al crear el mundo y queda guardada en ws.diff */
(function () {
  const G = window.G;

  // todo lo que toca la dificultad esta en esta tabla, asi no ando buscando numeros por todo el codigo
  G.DIFFS = {
    easy: {
      key: 'easy', name: 'Fácil', col: '#8fd8a0',
      desc: 'Menos enemigos, más débiles y casi sin escalado por distancia. Jefes con 2 etapas y ataques más lentos.',
      hp: 0.7, dmg: 0.65, slopeHp: 0.18, slopeDmg: 0.1, density: 0.65, extraGroups: 0, groupSize: 0, elite: 0.4,
      arena: 1, dungeon: 1, arenaMin: 3,
      bossHp: 0.6, bossDmg: 0.55, bossCd: 1.3, bossSpd: 0.85, bossPhases: 2, bossAdds: 0.5, bossEnrage: 0, bossHarass: 0, bossCombo: 0,
      event: 1.5, eventSize: 0.6, gold: 1.15,
    },
    normal: {
      key: 'normal', name: 'Normal', col: '#f2c94c',
      desc: 'La experiencia estándar. Los enemigos se fortalecen cuanto más lejos del origen. Jefes con 3 etapas.',
      hp: 1, dmg: 1, slopeHp: 0.3, slopeDmg: 0.18, density: 1, extraGroups: 0, groupSize: 0, elite: 1,
      arena: 1, dungeon: 1, arenaMin: 3,
      bossHp: 1, bossDmg: 1, bossCd: 1, bossSpd: 1, bossPhases: 3, bossAdds: 1, bossEnrage: 1, bossHarass: 1, bossCombo: 0.35,
      event: 1, eventSize: 1, gold: 1,
    },
    hard: {
      key: 'hard', name: 'Difícil', col: '#ff7060',
      desc: 'Muchos más enemigos y más seguido, más fuertes y escalan el doble de rápido al alejarte. Más jefes y mucho más agresivos.',
      hp: 1.3, dmg: 1.25, slopeHp: 0.5, slopeDmg: 0.32, density: 1.9, extraGroups: 1, groupSize: 2, elite: 1.6,
      arena: 2.8, dungeon: 1.25, arenaMin: 2,
      bossHp: 1.6, bossDmg: 1.3, bossCd: 0.78, bossSpd: 1.15, bossPhases: 3, bossAdds: 1.5, bossEnrage: 1, bossHarass: 1.6, bossCombo: 0.6,
      event: 0.55, eventSize: 1.7, gold: 1.3,
    },
  };

  G.diffKeyOf = (ws) => (ws && G.DIFFS[ws.diff] ? ws.diff : 'normal');
  G.diffOf = (ws) => G.DIFFS[G.diffKeyOf(ws)];
  // dificultad del mundo que se esta jugando ahora
  G.diff = () => G.diffOf(G.game && G.game.ws);
})();
