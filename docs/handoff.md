# Handoff — svgBodies

Estado al 2026-11-10 (biblioteca cerrada; la app, en diseño). Para retomar el trabajo en una sesión nueva.

## Objetivo del proyecto

Biblioteca muy grande de ejercicios (con variantes) dibujados como monigotes SVG animados, para
apps de entrenamiento. Sigue el método de los monigotes de eap-web (`docs/monigotes-eap.md`).
El propietario escribe en español y espera respuestas en español.

## Estado del repositorio

- `main`: todo fusionado ([macoajan/svgBodies#1](https://github.com/macoajan/svgBodies/pull/1) a
  [macoajan/svgBodies#7](https://github.com/macoajan/svgBodies/pull/7)): lotes A–F, columna
  segmentada, cervical, bastón, muñeca, bandas, señal de isometría y escápula.
- Rama de trabajo `claude/eager-heisenberg-cgodjv`. Si su última PR ya se fusionó, se reinicia
  desde `origin/main` antes del trabajo nuevo.
- Biblioteca: **113 ejercicios**, de ellos 49 terapéuticos. Todo valida y compila.
- El propietario pasa a otra fase; los fallos que encuentre en las pruebas los irá indicando.

```
node tools/build.mjs     # valida taxonomía, fichas y posturas, genera library/
```

## Artefactos publicados (privados, del propietario)

| Artefacto | Para qué | Estado |
|---|---|---|
| [Revisión de la taxonomía](https://claude.ai/artifact/C1Ny8wERm4PGUhzqwX6QNZ) | Revisión en el móvil de la clasificación de los 46 ejercicios de los lotes A–D: Correcto/Cambiar y notas por ejercicio, más «Criterios generales». Guarda en la base de datos del artefacto (`revision/<id>` con `{status, note, at}` y `revision-general/notas`). | Cerrada: el propietario dio los 46 por válidos; las 46 marcas están en `ok`. No incluye el lote E. |
| [Lote E de monigotes](https://claude.ai/artifact/A8gUFgokYJm4TMgddV2wr8) | Galería móvil de los 24 ejercicios del lote E. | Cerrada: revisada, corregida y fusionada. |
| [Piloto terapéutico](https://claude.ai/artifact/N1182gQxiSMhf3oTcUsk3f) | Revisión móvil de los ejercicios terapéuticos (colección `revision-f`: `{anim, text, note, at}`). Versión 2: 28 terapéuticos, con los 4 de columna lumbar marcados «Nuevo · columna» y una tarjeta de la cobra rehecha (sólo `anim`). | Versión 6: 49 terapéuticos. Cerrada: todos en `ok`. Los 5 últimos (isometrías y escápula) los dio por válidos el propietario sin revisarlos; se revisarán en la fase de pruebas. |
| [Pantallas de la app](https://claude.ai/artifact/JncynHqzHKV5zUpVjM7ZwC) | Lienzo de diseño (tipo Design) con el mockup de la app: pantallas de profesional, paciente (descanso, valoración), respuestas, compra Pro, canal público de gimnasio (lista, visibilidad, WOD del cliente), tres pantallas de tablet horizontal (profesional A1, paciente C, WOD en pared del box A2) y una fila por dirección visual (A Pista, A1, A2; C Cercano, C1, C2). | Estilo actual de las 11 pantallas: provisional (el propietario dijo que «huele a Claude»). Se conservan todas las variantes A y C como temas seleccionables; falta rehacer las pantallas con ellos. |
| [Músculos por ejercicio](https://claude.ai/artifact/3YXhL1bBnQNnFeJ1h9hXYL) | Revisión móvil del reparto muscular en % de los 88 ejercicios, con los tres primeros y los indirectos. Colección `revision-musculos`: documento `<id>` con `{status, note, at}` (`status` = `ok` o `cambiar`), y `revision-musculos-general/notas` con `{text, at}`. | Dados por buenos por el propietario; los sigue revisando con calma. Consultar de vez en cuando si hay marcas `cambiar` o notas. |

Para actualizar un artefacto desde otra sesión: leerlo primero (`Artifact` con `action: "read"` y
su URL) y publicar con `url`. Las marcas de revisión se leen con `ArtifactData` (`list` de la
colección `revision`).

## Piloto terapéutico (rama, sin PR)

Objetivo: que el fisioterapeuta sustituya las fotocopias. En la app elige ejercicios del
catálogo, pone la dosificación y envía al paciente un enlace con la hoja animada. La
dosificación no está en la biblioteca.

- **Taxonomía:** vocabularios `regions`, `therapy-goals` y `therapy-modes`; facetas opcionales
  `regions`/`goals`/`mode` (las tres o ninguna, en la variante); `progressions` por variante
  (regresiones derivadas, sin ciclos); material de rehabilitación; posición `sentado`; patrones
  `analitico` y `equilibrio`; músculos `triceps-sural` (padre de `gemelos` y `soleo`),
  `tibial-anterior` y `manguito-rotador`. Documentado en `taxonomy/README.md`.
- **Fichas:** `taxonomy/sheets/<id>.json` con `patient {start, steps, avoid}` (llano, de tú) y
  `pro {goal, notes}`. Obligatoria en cada terapéutico; se exporta en `catalog.json` (`sheet`).
- **Lote F** (`tools/exercises-f.mjs`, 18 animaciones): bombeo de tobillos, elevación de
  talones (dos pies y uno), equilibrio a una pierna, deslizamiento de talón, extensión de
  rodilla sobre rodillo y sentado, elevación de pierna recta, sentadilla isométrica en pared,
  sentarse y levantarse, bajada de escalón, puente a una pierna, almeja, abducción de cadera
  de lado, extensión de cadera boca abajo, péndulo de Codman, flexión de hombro con bastón y
  deslizamiento en pared. Seis existentes etiquetados: puente de glúteo, dead bug, bird dog,
  plancha, step-up y estiramiento de gemelo.
- **Técnicas nuevas:** `sideLying` construye la postura boca abajo y la rueda sobre el costado
  izquierdo; `rotAxis` (Rodrigues) para la almeja; silla dibujada con `lines`; rodillo con el
  objeto `wheel`; bastón con `rope` de dos puntos.
- El índice tiene filtros de región y objetivo terapéutico.

Limitaciones conocidas: tronco recto (sin columna segmentada), sin escápula, sin cabeza
orientable, sin banda elástica que se estire y sin señal visual de isometría. Por eso aún no
hay ejercicios lumbares de movilidad, cervicales, escapulares ni con banda.

## Cervical (fusionado)

- `trunk()` acepta `neckSide` y `headSide` (inclinación lateral del cuello y de la cabeza, en
  grados, positivo hacia la derecha; la cabeza sigue al cuello por defecto) y `headYaw`
  (rotación de la cabeza). Las posturas llevan `face` (nariz: un punto pequeño delante de la
  cara) y `eyeR`/`eyeL` (ojos, dentro del contorno de la cabeza); sólo se dibujan en los
  ejercicios con `face: true` (y sólo ellos lo exportan en `poses.json`), para no
  cambiar el aspecto del resto. Sin estas opciones las posturas son idénticas a las de antes.
- Músculos nuevos: grupo `cuello` con `flexores-profundos-cuello`, `extensores-cuello`,
  `esternocleidomastoideo` y `escalenos`.
- Ejercicios (lote F, sentado en silla): retracción cervical, flexión y extensión, rotación e
  inclinación, con taxonomía, fichas y porcentajes.

## Señal de isometría y escápula (fusionado)

- Isometría: `ex.glow = [['r.hip', 'r.knee'], ...]` dibuja un halo ámbar translúcido (`GLOW`)
  detrás de cada segmento; su anchura sigue `pose.effort` (0–1, o un valor por halo). En
  `exercises-f.mjs`, `isoHold(dur, pose, side)` hace el mantenimiento con el halo que aparece,
  late y desaparece, y `swapLR` intercambia el par de esfuerzos [derecha, izquierda]. Lo llevan
  la sentadilla en pared, la extensión de rodilla sobre rodillo, la retracción cervical y la
  plancha. `poses.json` exporta `glow` y `effort`, y el visor 3D los dibuja.
- Escápula: `trunk(..., { scap: { r: { up, fwd }, l: { up, fwd } } })` mueve cada hombro
  (elevación +/depresión −, protracción +/retracción −).
- Ejercicios: contracción isométrica de cuádriceps, isometría de rotación externa contra la
  pared, elevación y depresión escapular, retracción escapular y protracción en supino.

## Bastón, antebrazo/muñeca y bandas (fusionado)

- Motor: objeto `band` (`{ type: 'band', a, b }`, verde `BAND`), segmento de la mano
  (`fingers`, `L.palm = 3.8`) que sólo se dibuja con `hands: true` y se valida en longitud, y el
  martillo como `rope` + `ball` sujeto en la mano. Sin cambios en las posturas anteriores.
- Vocabulario: material `martillo`; músculos `flexores-muneca`, `extensores-muneca`,
  `pronadores` y `supinadores` (hijos de `antebrazo`).
- Ejercicios: rotación externa, rotación interna (detrás de la espalda), abducción y extensión
  de hombro con bastón; pronosupinación con martillo, flexo-extensión y desviación de muñeca;
  rotación externa e interna con banda, remo con banda (variante de `remo`), extensión de
  hombro con banda y almeja con banda (variante de `almeja`). Progresiones de bastón a banda.

## Columna segmentada (fusionada)

- `trunk()` divide el tronco en tres segmentos (`SPINE = [6, 4.5, 4.5]`: lumbar, dorsal baja,
  dorsal alta) y acepta `lumbar` y `thoracic` en grados (positivo = flexión, negativo =
  extensión); `alpha` es la orientación de la pelvis. Con la columna recta las posturas son
  idénticas a las de antes (comprobado articulación por articulación). Las posturas llevan
  `lumbarTop` y `thorax`; render, validación, centro de masas, `poses.json` y visor 3D usan los
  tres segmentos.
- Nuevos (lote F): báscula pélvica, gato-camello, extensión lumbar sobre codos (esfinge) y
  extensión lumbar con brazos (McKenzie), con taxonomía, fichas y porcentajes. La cobra del
  lote E se rehízo arqueando la columna.
- Limitación: el monigote no tiene grosor (las articulaciones apoyadas van sobre la línea de
  contacto), así que en McKenzie los codos no llegan a estirarse del todo y la báscula
  pélvica se ha exagerado un poco para que se vea.

## Músculos en porcentaje (fusionado)

Petición del propietario para todos los ejercicios: listar los músculos con el porcentaje
estimado de uso. `muscles` pasa a ser `{ músculo: % }` (múltiplos de 5, suma 100, 1–8
músculos, ordenado, sin grupo y parte a la vez); sustituye a `primary`/`secondary`. La app
tomará los tres primeros y sumará el resto como indirectos (eso lo hace la app, no la
biblioteca). Nuevo músculo `rotadores-externos-cadera`. Por decisión del propietario, el
validador prohíbe el empate entre el tercer y el cuarto músculo; los 27 empates iniciales se
resolvieron con criterio clínico.

## App (en diseño)

Decisiones del propietario (fisioterapeuta, funcionario docente; la parte legal la lleva un
publisher, que solo gestiona el cobro, a mano):

- **Distribución**: tiendas (iOS y Android) a través del publisher, que paga royalties al
  propietario. App genérica (salud, deporte, música, danza…), no centrada en un colectivo.
  Categoría «Salud y forma física», sin afirmaciones clínicas.
- **Cobro**: app gratuita; el paciente nunca paga. Compra única «Pro» (pautas ilimitadas,
  plantillas, logo, PDF); packs, sin decidir. Precio sin fijar.
- **Versión 1 sin datos legibles en servidor**: la pauta se cifra en el dispositivo
  (AES-GCM, clave en el fragmento `#` del enlace). Pautas del profesional guardadas en local.
- **Acortador privado** («bitly privado») en el Coolify del propietario: Node simple + SQLite,
  guarda solo bloques cifrados; enlace `<dominio>/p/<código>#<clave>`, con el enlace largo
  `<dominio>/p#<clave>.<bloque>` como alternativa sin conexión. Dominio configurable
  (`PUBLIC_URL`); para pruebas, `maroto.es`. Permite actualizar la pauta con el mismo enlace
  (token de edición) y recoger las respuestas del paciente. QR generado en la app, nunca en
  servicios externos. CloudKit descartado para esto (escribir exige Apple ID); posible en v2
  para sincronizar las pautas del profesional entre sus dispositivos Apple.
- **Descansos** en tres niveles: entre repeticiones (y al cambiar de lado), entre series y al
  terminar el ejercicio (con un valor por defecto de la pauta). El paciente puede alargarlos
  o acortarlos.
- **Respuesta del paciente** por ejercicio: fácil/bien/difícil, dolor 0–10 y comentario.
- **Ámbito y visibilidad**: pauta privada (`/p/…`) o canal público (`/c/…`, p. ej. el WOD de
  un gimnasio para todos sus clientes). Cada pauta o sesión lleva visibilidad en claro
  `{ mode: auto|show|hide, from?, until? }`: automático por fechas o forzado (override). El
  servidor solo entrega lo visible. Las sesiones admiten `format` (series, AMRAP, EMOM, for
  time, tabata).
- **Calorías**: `met` por ejercicio en la taxonomía; la pauta lleva `show.kcal` para que el
  profesional decida si el paciente las ve. Peso del usuario solo en su dispositivo.

Código en `server/` (Node ≥ 22.5, sin dependencias):

- `public/pauta-crypto.js`: cifrado y formato de enlaces, compartido por app, visor y pruebas.
- `public/pauta-schema.js`: formato v1 de pauta y respuesta, validación y estimación de
  duración y calorías.
- `public/visibility.js`: visibilidad por fechas y modo.
- `README.md`: ámbitos y API prevista.
- `src/config.mjs`: configuración por entorno. **Pendiente**: el servidor en sí (API de
  pautas `/api/p`, respuestas `/api/p/<código>/r`, canales `/api/c`, visores `/p` y `/c`,
  caducidad, límites por IP, Dockerfile para Coolify, asociación de dominio con la app).
- `npm test` en `server/`.

## Próximos pasos

1. El propietario pasa a otra cosa; atender los fallos que indique en la fase de pruebas.
2. Leer de vez en cuando las colecciones de revisión (`revision-f`, `revision-musculos` y sus
   `-general`) por si hay marcas `cambiar` o notas nuevas.
3. Pendientes del motor: grosor del cuerpo (para la extensión completa de codos en McKenzie) y
   texto en inglés de las fichas.
4. Alcance acordado: **v1** pautas privadas 1:1 (descansos, respuestas, calorías, acortador,
   compra Pro); **v1.1** canales públicos con visibilidad (lógica hecha); **v2** grupos
   privados 1:n con invitación individual y expulsión (token por miembro que el servidor
   revoca y rotación de la clave del grupo para los que quedan), sincronización entre
   dispositivos y seguimiento en tiempo real. No añadir más funcionalidades sin acordarlo.
5. App: rehacer las 11 pantallas del mockup con los temas A y C; terminar el servidor del
   acortador y desplegarlo en Coolify (con el visto bueno del propietario); después, el diseño
   técnico de la app (Capacitor, compras únicas con StoreKit 2 y Google Play Billing).

## Cómo revisar visualmente

Las capturas de las animaciones CSS en pausa no son fiables (el navegador desplaza las filas
anchas). Para revisar fotogramas, renderizar posturas estáticas: muestrear con `sample(ex)`,
coger el fotograma y llamar a `renderView` con todos los fotogramas iguales a esa postura.

## Convenciones

- Commits en español, Conventional Commits, sin identificadores de modelo.
- Rama designada `claude/eager-heisenberg-cgodjv`; no tocar `claude/magical-galileo-y9nh2n`. Si su PR ya se fusionó, se reinicia desde
  `origin/main` antes del trabajo nuevo.
- Las PR se abren sólo cuando el propietario lo pide; se fusionan sólo cuando lo pide.
