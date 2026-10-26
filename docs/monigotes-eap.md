# Monigotes SVG animados de eap-web — cómo están hechos

Referencia extraída de `macoajan/eap-web` (commit `df75e37`): `index.html` (SVG en línea),
`style.css` (animaciones) y `app.js` (corredor de la caja clínica). Sin bibliotecas: SVG
escrito a mano + `@keyframes` CSS + un poco de JS con la Web Animations API.

## 1. Principios

- **SVG en línea, sólo trazo**: `fill="none"`, `stroke-width="3.4"`, `stroke-linecap="round"`,
  `stroke-linejoin="round"`, `viewBox="0 0 64 64"` dibujado a 66–68 px. El color de la
  variante va en el atributo `stroke` del `<svg>` (naranja `#C2410C` rápido, azul `#3D6A99`
  lento, gris `#5F6B77` sentado, blanco sobre fondo naranja). `aria-hidden="true"`.
- **Esqueleto = árbol de `<g>` anidados** (cinemática directa): cada articulación es un
  grupo que rota sobre su pivote y arrastra a sus hijos. El muslo contiene a la espinilla,
  el brazo al antebrazo.
- **Pose de reposo con todos los segmentos verticales en x = 32**; la pose real la dan las
  rotaciones. Así los pivotes son triviales: hombro `32 21`, codo `32 30`, cadera `32 36`,
  rodilla `32 48`.
- **`transform-box: view-box`** en `g` y `line`, para que `transform-origin` se exprese en
  unidades del viewBox (no en la caja del propio elemento).
- **Profundidad por orden de pintado**: extremidades `b` (las de detrás) antes del tronco,
  tronco y cabeza, y extremidades `a` (las de delante) al final.
- **Mira a la derecha**: el pie es un segmento horizontal de 4 px hacia +x al final de la
  espinilla. En SVG la rotación positiva es horaria: rotar negativo un segmento que cuelga
  lo lleva hacia delante (+x); positivo, hacia atrás.

## 2. Plantilla del caminante/corredor

```html
<svg class="fig fast" width="68" height="68" viewBox="0 0 64 64" fill="none" stroke="#C2410C"
     stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <g class="speed">                      <!-- sólo en .fast: líneas de velocidad detrás -->
    <line x1="2" y1="20" x2="12" y2="20"/><line x1="0" y1="30" x2="10" y2="30"/><line x1="4" y1="40" x2="12" y2="40"/>
  </g>
  <g class="bob"><g class="lean">        <!-- bote vertical > inclinación del cuerpo -->
    <g class="uarm b"><line x1="32" y1="21" x2="32" y2="30"/>
      <g class="farm"><line x1="32" y1="30" x2="32" y2="37"/></g></g>
    <g class="thigh b"><line x1="32" y1="36" x2="32" y2="48"/>
      <g class="shin b"><line x1="32" y1="48" x2="32" y2="59"/><line x1="32" y1="59" x2="36" y2="59"/></g></g>
    <line x1="32" y1="19" x2="32" y2="36"/>   <!-- tronco -->
    <circle cx="32" cy="11" r="5.5"/>         <!-- cabeza -->
    <g class="thigh a">…igual que b…</g>
    <g class="uarm a">…igual que b…</g>
  </g></g>
</svg>
```

CSS de estructura común:

```css
.fig{flex:none;overflow:visible}
.fig g,.fig line{transform-box:view-box}
.fig .lean {transform-origin:32px 36px}   /* cadera */
.fig .thigh{transform-origin:32px 36px}
.fig .shin {transform-origin:32px 48px}   /* rodilla */
.fig .uarm {transform-origin:32px 21px}   /* hombro */
.fig .farm {transform-origin:32px 30px;transform:rotate(-80deg)}  /* codo fijo doblado */
```

## 3. Ciclo de marcha (CSS)

Las dos piernas usan el mismo `@keyframes`; la `b` va desfasada medio periodo con
`animation-delay` negativo (arranca ya en fase, sin espera). Cada brazo va en contrafase con
la pierna de su lado (`uarm.a` desfasado, `uarm.b` no). El bote dura medio periodo con
`alternate`, así sube y baja una vez por paso.

| Parámetro | `.fast` (corre) | `.slow` (camina) |
|---|---|---|
| Periodo / easing | 0,5 s `linear` | 1,2 s `ease-in-out` |
| Inclinación `.lean` | `rotate(14deg)` | `rotate(4deg)` |
| Bote `.bob` | 0,25 s, `translateY(-2.5px)` | 0,6 s, `translateY(-1px)` |
| Muslo | −42° → 42° → −42° | −20° → 20° → −20° |
| Espinilla (flexión de rodilla) | 0 % 18°, 25 % 12°, 50 % 95°, 75 % 55°, 100 % 18° | 0 % 8°, 50 % 45°, 75 % 25°, 100 % 8° |
| Brazo | −50° → 50° → −50° | −24° → 24° → −24° |
| Extras | líneas `.speed`: `translateX(8px→-8px)` con opacidad 0→.6→0, desfases −.17 s y −.33 s | — |

La rodilla sólo flexiona en positivo (talón hacia atrás) y alcanza el máximo cuando el
muslo está atrás (50 %), lo que da la fase de recogida natural.

## 4. Otras figuras

- **Sentado (`.fig.sit`)**: silla en `<g stroke="#AEB8C1">` (respaldo, asiento, dos patas);
  persona con polilíneas en pose fija. Vida mínima: `.breathe` (tronco+cabeza, `translateY(-1px)`,
  3 s), `.nod` (cabeza, pivote `23 17`, cabezada −8°/4° en el 80–90 % de 4 s) y `.tap`
  (pie, pivote `40 38`, golpeteo −12° cada 0,9 s `alternate`). Inquieto, no inmóvil.
- **Cansado (`.tired`)**: SVG aparte con polilíneas, cuerpo doblado y manos en las rodillas.
  `.heave` (tronco, pivote cadera `30 38`, 0–5°, 0,55 s `alternate` = jadeo), `.neck`
  (cabeza, 0–10°, 1,1 s) y gotas de sudor (`path` relleno, `stroke="none"`) que caen con
  `translate(4px,14px)` y desvanecen, 1,2 s, la segunda desfasada −0,6 s.
- **Coach con megáfono (`.coachfig`, viewBox 66×48)**: busto (curva de hombros + cabeza);
  el grupo `.mega` (brazo + megáfono trapecio relleno `#FDEEE6`) sube de 42° a 0°, sostiene y
  baja en 2,6 s; tres ondas `path` (`.w1–.w3`, color de acento) aparecen escalonadas
  (+3 % de ciclo cada una) y parpadean mientras el megáfono está arriba.

## 5. Corredor con máquina de estados (JS)

En la caja de conclusión un `.mover` contiene dos SVG: el corredor `.fig.fast.trun` y el
cansado `.tired`; la clase `.rest` alterna cuál se ve (`display`).

- Bucle `requestAnimationFrame` con `dt` acotado a 50 ms; posición `x` aplicada como
  `translateX`; al salir por la derecha reaparece en `-FIG`.
- Estados: `run` (150 px/s) → `slow` (decelera a 28 px/s en 1,6 s con *smoothstep*) →
  `rest` (parado 2,4 s, figura cansada) → `acc` (acelera 0,8 s) → `run`. La siguiente parada
  es aleatoria (2,2–5 s) y sólo si queda sitio en la pista.
- **Cadencia ligada a la velocidad**: a todos los descendientes de `.trun` se les ajusta
  `el.getAnimations().forEach(a => a.playbackRate = r)` con `r = max(0.3, v/SPEED)`; las
  líneas de velocidad se apagan con `opacity = (r − 0.45)/0.55`. Así las mismas animaciones
  CSS sirven para correr y para frenar arrastrando los pies, sin keyframes nuevos.

## 6. Accesibilidad

`@media (prefers-reduced-motion: reduce)` anula todas las animaciones (`animation:none
!important`) de `.fig`, `.coachfig` y `.tired`; las ondas del coach quedan visibles y el
corredor se coloca estático al 40 % de la pista.

## 7. Receta para una figura nueva

1. Dibujar en viewBox 64×64 con segmentos verticales en reposo y pivotes en coordenadas enteras.
2. Anidar `<g>` según la cadena articular; una clase por articulación y `a`/`b` por lado.
3. Ordenar: lado lejano → tronco/cabeza → lado cercano.
4. `transform-box:view-box` + `transform-origin` en px del viewBox para cada articulación.
5. Un `@keyframes` por articulación compartido por ambos lados; contrafase con delay negativo
   de medio periodo.
6. Postura global (inclinación) como `transform` estático en un grupo externo; bote en otro grupo.
7. Variar velocidad con `playbackRate` en vez de duplicar keyframes.
8. Respetar `prefers-reduced-motion`.

## 8. Extensión: biblioteca de ejercicios (`tools/`, `library/`)

Mismo método de salida (SVG en línea + `@keyframes`), pero con las posturas calculadas por un
motor en vez de escritas a mano. Detalle en `README.md`. Diferencias respecto a eap:

- **Transformaciones planas en lugar de grupos anidados.** Cada segmento se dibuja de (0,0) a
  (0,L) y se coloca con `translate(P) rotate(θ) scaleY(|PQ|/L)`. Con keyframes densos (12 por
  fase) las articulaciones no se separan de forma visible, y la misma técnica sirve para la
  vista frontal, donde los segmentos se acortan por perspectiva (`scaleY` actúa sólo a lo largo
  del segmento, así que el grosor del trazo no cambia; los puntos de articulación tapan los
  remates aplastados).
- **Modelo 3D mínimo**: plano sagital (x, y) más desplazamiento lateral z de rodillas, cadera,
  hombros, codos y manos. La vista lateral muestra (x, y); la frontal, (32 ± z, y).
- **Cinemática inversa** de brazo de dos huesos con vector polo (hacia dónde apunta el codo) y
  **equilibrio**: el tronco se inclina hasta que el centro de masas (tablas antropométricas +
  carga) queda donde está el de la postura erguida.
- Validación al generar: longitudes de segmento constantes, nada bajo el suelo, fases que
  enlazan sin saltos.
- **Vista iso y cámara libre.** Como las posturas son 3D, `isoProject` (cámara girada 40° y
  elevada 30°) genera un SVG isométrico CSS con orden de pintado fijo (lado izquierdo, tronco,
  lado derecho). Para cualquier ángulo, `tools/viewer.js` proyecta `poses.json` en vivo y
  reordena las formas por profundidad en cada fotograma; los discos son cilindros (envolvente
  convexa de sus dos caras) para conservar el grosor de canto.
- **Lote B: cuerpo con dos lados y contactos libres.** Cada lado lleva sus propias articulaciones
  (cadera, rodilla, tobillo, punta del pie, hombro, codo, mano) y el pie es un segmento. Los
  apoyos se resuelven por ejercicio: puntas y manos fijas (flexión), codos y puntas (plancha),
  hombros y pies (puente), rodillas y manos (bird dog), manos en la barra (dominada) o pies en
  el cajón (step-up), con cinemática inversa de dos huesos e intersección de circunferencias.
  Tumbado, el cuello se dobla para que la cabeza apoye en el suelo.
- **Una sola proyección para todas las vistas** (lateral, frontal, iso, cenital), con orden de
  pintado por profundidad media del ciclo; la profundidad tiene en cuenta la altura de la cámara.
  Los ejercicios de suelo usan vista cenital en lugar de frontal. Cajón y barra se dibujan
  detrás de la figura para que los apoyos se vean siempre.
