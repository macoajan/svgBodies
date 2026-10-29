# svgBodies

Monigotes SVG animados para una biblioteca de ejercicios funcionales, con el método de los
monigotes de eap-web (`docs/monigotes-eap.md`).

## Generar

```
node tools/build.mjs
```

Produce en `library/`:

| Fichero | Uso |
|---|---|
| `index.html` | Buscador por facetas (patrón, músculo, material, lugar, posición, nivel, objetivo, lateralidad, plano y exclusión por exigencias). |
| `catalog.json` | Clasificación resuelta de cada ejercicio con sus ficheros de animación, para apps. |
| `catalog-flags.csv` | La misma clasificación como tabla dispersa de flags (una columna por valor). |
| `lote-{a,b,c,d,e}.html` | Galería de cada lote: dos vistas CSS por ejercicio (lateral + frontal, o lateral + cenital en los de suelo) y vista iso en vivo con cámara libre (arrastrar para girar, doble clic para volver); pausa, velocidad y control de posición comunes. |
| `svg/<id>-{lateral,frontal\|cenital,iso}.svg` | SVG autónomos (CSS dentro, sin JavaScript), utilizables en web o WebView. |
| `poses.json` | Posturas muestreadas en 3D (lado derecho; el izquierdo es −z) para renderizar en nativo. |
| `viewer.js` | Visor sin dependencias de `poses.json` con cámara libre: `PoseViewer.mount(svg, ejercicio, { yaw, pitch })` y `render(t)`. Ordena las formas por profundidad en cada fotograma (pintor). Referencia para portar a la app. |

## Estructura

- `taxonomy/` — clasificación de los ejercicios (vocabularios cerrados y familias con variantes); ver `taxonomy/README.md`.
- `tools/taxonomy.mjs` — validación, resolución de variantes y exportación del catálogo.

- `tools/engine.mjs` — modelo corporal, ayudas de postura (`legs`, `trunk`, `straight`, `elbowIK`,
  `balance`), muestreo, validación y render de las dos vistas.
- `tools/exercises.mjs` y `tools/exercises-{b,c,d,e}.mjs` (lotes A a E) — definición de cada ejercicio:
  fases (duración y función de postura), postura fija para `prefers-reduced-motion`, vistas
  (`views`), cámara iso propia (`isoCam`) y elementos fijos (`props`: `box` para cajones, bancos, pared y trineo; `lines` para barras y estructuras; `pullbar`).
- `tools/viewer.js` — visor 3D en tiempo de ejecución (se copia a `library/`).

## Añadir un ejercicio

1. Escribir una función `pose(s)` con las ayudas del motor: `pose()` para ejercicios de pie
   simétricos o `poseLR()` con cada lado por separado; piernas por ángulos (`legs`, `legFrom`) o
   por cinemática inversa (`kneeIK`), tronco por ángulo o por equilibrio (`balance`), manos por
   objetivo + polo del codo, pies (`foot`, `footFlat`, `footFromShin`) y objetos `barbell`, `kb`, `db` (mancuerna), `ball`, `wheel`, `cord` (polea) y `rope` (cadena de puntos 3D).
   El tronco admite desplazamiento lateral (`shift`) y giro (`twist`), y `transformPose` mueve la
   postura entera de forma rígida (la plancha lateral se construye boca abajo y se rueda de costado).
2. Añadir la entrada en `EXERCISES` con sus fases y clasificarla en `taxonomy/families/` (la
   compilación falla si una animación no está clasificada o al revés).
3. `node tools/build.mjs`: si una postura es imposible (mano fuera de alcance, objeto bajo el
   suelo, salto entre fases) el generador se detiene con el motivo.

## Lotes

- **A** (de pie, simétricos): peso muerto, peso muerto rumano, swing con kettlebell, sentadilla,
  sentadilla goblet, sentadilla trasera, press militar, remo con barra y thruster.
- **B** (suelo, suspensión, una pierna): flexión, plancha, puente de glúteo, dead bug, bird dog,
  zancada atrás, step-up al cajón y dominada.
- **C** (saltos, desplazamiento, material en movimiento): jumping jacks, comba, paseo del
  granjero (marcha en el sitio), salto al cajón y burpee.
- **D** (resto del catálogo): buenos días, hip thrust, sentadilla frontal, sentadilla al cajón,
  wall ball, zancada lateral, sentadilla búlgara, peso muerto a una pierna, press de banca, fondos
  en paralelas, remo con mancuerna, remo invertido, suitcase carry, overhead carry, plancha
  lateral, Pallof press, leñador, rueda abdominal, mountain climbers, battle ropes, cargada con
  kettlebell, turkish get-up, bear crawl y sled push.
- **E** (movilidad, estiramientos, carrera y saltos): círculos de brazos, balanceo de pierna,
  gusano (walkout), squat to stand, rotación torácica en cuadrupedia, world's greatest stretch;
  estiramientos de isquiotibiales, cuádriceps, flexor de cadera, gemelo en pared y hombro
  cruzado, postura del niño, perro boca abajo y cobra; carrera, skipping y talones al glúteo (en
  el sitio); salto vertical, sentadilla con salto, salto con rodillas al pecho, salto horizontal,
  zancada con salto, saltos de patinador y saltos de tobillo.
