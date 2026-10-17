# CRIPTA ERRANTE

Roguelike de acción 2D con vista cenital y estética pixel art retro. HTML + CSS + JavaScript puro (Canvas), sin librerías, sin servicios externos, sin APIs de pago. Todo el arte (sprites, tiles, iconos) y el sonido se generan por código.

## Cómo ejecutarlo

**Opción A (la más simple):** abrí `index.html` con doble clic en Chrome, Edge o Firefox. Funciona sin servidor.

**Opción B (servidor local, por si tu navegador restringe `file://`):**

```bash
cd cripta-errante
python3 -m http.server 8000
# abrir http://localhost:8000
```

Los mundos se guardan en el `localStorage` del navegador (mismo navegador y mismo origen para continuar). Si abrís por `file://` y luego por `http://localhost`, el navegador los trata como orígenes distintos: usá siempre la misma forma, o usá **Exportar / Importar** en el menú principal para mover un mundo.

## Controles

| Acción | Tecla |
|---|---|
| Mover | `W A S D` / flechas |
| Apuntar | Ratón |
| Atacar | Clic izquierdo (mantener) o `J` |
| Esquivar (invulnerable un instante) | `Shift` o clic derecho |
| Interactuar (guardar, cofres, mercader, altar) | `Espacio` (si no hay nada cerca, esquiva) |
| Habilidades activas | `Q` `E` `R` `F` |
| Consumibles rápidos | `1` `2` `3` `4` |
| Inventario / Habilidades / Mapa | `I` / `K` / `M` |
| Pausa | `Esc` o `P` |

## Qué incluye

**Mundos (3 ranuras independientes).** Cada uno con semilla propia (aleatoria o escrita por vos), generación procedural infinita por chunks y guardado separado. La misma semilla siempre produce el mismo mapa.

**Mundo procedural.** 6 biomas (praderas, bosque, desierto, tundra, pantano, tierras volcánicas), lagos, lava, cuevas continuas y oscuras, y por chunk: campamentos con santuario y mercader, mazmorras (9 salas, corredores, trampas, antorchas, bóveda sellada con paredes agrietadas, salas secretas), arenas de jefe circulares con puertas que se sellan, ruinas con sala secreta, arboledas ocultas con guardianes, altares malditos, manantiales curativos, campamentos de bandidos, cementerios y nidos. Cofres normales, escondidos, mímicos y cofres de eventos.

**Combate en tiempo real.** 6 armas con comportamientos distintos (espada, daga, hacha, lanza, arco, bastón), esquiva con fotogramas de invulnerabilidad, críticos, robo de vida, estados (quemadura, veneno, ralentización, aturdimiento). 14 enemigos con IA propia (saltarín, murciélago errático, embestidas, arqueros, saltos, hechiceros con zonas de aviso, brutos, lobos que rodean, fantasmas que atraviesan paredes, ladrón que huye con botín…), élites con modificadores (veloz, acorazado, explosivo, vampírico, venenoso).

**Jefes.** 7 jefes (uno por bioma + el Liche del Vacío en zonas lejanas), cada uno con su propio conjunto de patrones (golpe de zona, ráfagas, anillos, espirales, invocaciones, embestidas, raíces, lluvia de proyectiles, charcos, teletransporte) y una fase 2 con patrones nuevos. Enemigos y jefes escalan con la distancia al origen.

**Progresión.** Cada jefe da puntos de habilidad (se guardan o se gastan en el momento). Árbol con 57 nodos en 7 ramas, con requisitos encadenados: maximizar una habilidad desbloquea otras (por ejemplo Bola de Fuego nivel 5 → Rayo en Cadena → junto con Nova Gélida → Meteoro), luego **Maestrías** que modifican las activas y, al final, **Ascensión**: nodos sin límite de nivel, para que la progresión nunca termine. 11 habilidades activas (Torbellino, Furia, Bastión, Luz Sanadora, Paso Sombrío, Descarga de Flechas, Lluvia de Flechas, Bola de Fuego, Nova Gélida, Rayo en Cadena, Meteoro) y decenas de pasivas.

**Objetos.** Inventario con apilado de consumibles, equipo (arma, armadura, 2 amuletos) con 5 rarezas y afijos aleatorios, 10 consumibles (pociones, elixires, bombas que rompen paredes agrietadas, pergamino de regreso, trébol de suerte, mapa del tesoro…), mercader que compra y vende.

**Modos.**
- **Normal:** al morir reaparecés en el último santuario conservando habilidades, puntos y objetos (perdés el 20 % del oro y el jefe se reinicia).
- **Hardcore (opcional al crear el mundo):** al morir se borra ese mundo. A cambio: +25 % de oro, más suerte y +1 punto por jefe.

**Guardado.** Se guarda al descansar en un santuario, automáticamente cada 20 s, al pausar/cerrar la pestaña y al salir al menú. Persisten: posición, estadísticas, equipo, habilidades, cofres abiertos, paredes rotas, enemigos caídos, jefes derrotados y el mapa explorado.

**Eventos aleatorios:** emboscadas, goblin ladrón con botín, cofres de suministros, bendiciones temporales y regalos de viajeros.

## Estructura del código

```
index.html          Página, HUD y contenedor de menús
style.css           Estilos (HUD, menús, inventario, árbol)
js/util.js          RNG determinista, ruido, matemáticas, audio sintetizado
js/data.js          Tiles, biomas, enemigos, jefes, armas, consumibles
js/sprites.js       Sprites pixel art, tiles e iconos generados por código
js/items.js         Generación de objetos, afijos, botín, inventario
js/skills.js        Árbol de habilidades, activas, estadísticas del jugador
js/world.js         Generación procedural infinita (chunks, estructuras)
js/entities.js      Colisión, fábrica de enemigos/jefes, IA y patrones de jefe
js/combat.js        Ataques, daño, estados, proyectiles, habilidades, botín
js/save.js          Guardado local (3 ranuras), exportar/importar
js/ui.js            HUD y pantallas (menús, inventario, árbol, mapa, tienda)
js/game.js          Bucle principal, entrada, interacción, eventos, render
tools/              Pruebas automáticas (opcionales)
```

## Pruebas automáticas (opcional)

```bash
node tools/worldcheck.js 12345   # estadísticas y conectividad de la generación
node tools/smoke.js              # partida real en Chromium headless (requiere Playwright)
```

`smoke.js` arranca el juego real y comprueba: creación de mundos, interacción, recorrido por todos los tipos de zona, IA de los 14 enemigos, patrones de los 7 jefes, compra y uso de todo el árbol de habilidades, las 11 activas, consumibles, pantallas, combate real contra un jefe con recompensa, muerte normal y hardcore, y persistencia tras recargar.

## Limitaciones conocidas

- Pensado para teclado y ratón; no hay controles táctiles ni de mando.
- Sin música (sólo efectos sintetizados). El audio arranca tras la primera interacción, como exige el navegador.
- Los guardados viven en el navegador: borrar los datos del sitio los elimina (usá Exportar para respaldarlos).
- El balance (daño, oro, dificultad por distancia) se probó con simulaciones, no con muchas horas de juego humano; probablemente querrás ajustar números en `js/data.js` y `js/skills.js`.
