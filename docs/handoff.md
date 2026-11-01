# Handoff — svgBodies

Estado al cerrar la sesión del 2026-11-01 (actualizado con el piloto terapéutico). Para retomar el trabajo en una sesión nueva.

## Objetivo del proyecto

Biblioteca muy grande de ejercicios (con variantes) dibujados como monigotes SVG animados, para
apps de entrenamiento. Sigue el método de los monigotes de eap-web (`docs/monigotes-eap.md`).
El propietario escribe en español y espera respuestas en español.

## Estado del repositorio

- `main` = `6526bc6`: lotes A–E fusionados ([macoajan/svgBodies#1](https://github.com/macoajan/svgBodies/pull/1),
  [macoajan/svgBodies#2](https://github.com/macoajan/svgBodies/pull/2) y
  [macoajan/svgBodies#3](https://github.com/macoajan/svgBodies/pull/3)).
- Rama de trabajo `claude/eager-heisenberg-cgodjv`: **piloto de ejercicio terapéutico (lote F),
  sin PR**, pendiente de la revisión del propietario. No tocar `claude/magical-galileo-y9nh2n`.
- Biblioteca: **88 ejercicios**, de ellos 24 terapéuticos. Todo valida y compila.

```
node tools/build.mjs     # valida taxonomía, fichas y posturas, genera library/
```

## Artefactos publicados (privados, del propietario)

| Artefacto | Para qué | Estado |
|---|---|---|
| [Revisión de la taxonomía](https://claude.ai/artifact/C1Ny8wERm4PGUhzqwX6QNZ) | Revisión en el móvil de la clasificación de los 46 ejercicios de los lotes A–D: Correcto/Cambiar y notas por ejercicio, más «Criterios generales». Guarda en la base de datos del artefacto (`revision/<id>` con `{status, note, at}` y `revision-general/notas`). | Cerrada: el propietario dio los 46 por válidos; las 46 marcas están en `ok`. No incluye el lote E. |
| [Lote E de monigotes](https://claude.ai/artifact/A8gUFgokYJm4TMgddV2wr8) | Galería móvil de los 24 ejercicios del lote E. | Cerrada: revisada, corregida y fusionada. |
| [Piloto terapéutico](https://claude.ai/artifact/N1182gQxiSMhf3oTcUsk3f) | Revisión móvil de los 24 ejercicios terapéuticos (colección `revision-f`: `{anim, text, note, at}`). | Cerrada: las 24 marcadas `ok` en animación y textos, sin notas. |
| [Músculos por ejercicio](https://claude.ai/artifact/3YXhL1bBnQNnFeJ1h9hXYL) | Revisión móvil del reparto muscular en % de los 88 ejercicios, con los tres primeros y los indirectos. Colección `revision-musculos`: documento `<id>` con `{status, note, at}` (`status` = `ok` o `cambiar`), y `revision-musculos-general/notas` con `{text, at}`. | Publicada; esperando la revisión del propietario. |

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

## Músculos en porcentaje (rama, sin PR)

Petición del propietario para todos los ejercicios: listar los músculos con el porcentaje
estimado de uso. `muscles` pasa a ser `{ músculo: % }` (múltiplos de 5, suma 100, 1–8
músculos, ordenado, sin grupo y parte a la vez); sustituye a `primary`/`secondary`. La app
tomará los tres primeros y sumará el resto como indirectos (eso lo hace la app, no la
biblioteca). Nuevo músculo `rotadores-externos-cadera`. Por decisión del propietario, el
validador prohíbe el empate entre el tercer y el cuarto músculo; los 27 empates iniciales se
resolvieron con criterio clínico.

## Próximos pasos

1. Leer las marcas del propietario en `revision-musculos` y `revision-musculos-general`,
   y corregir los porcentajes. Abrir la PR (piloto
   terapéutico + porcentajes) cuando lo pida.
2. Motor, por orden: columna en tres segmentos (lumbar, dorsal, cervical), banda elástica y
   señal de isometría, y después escápula y cabeza orientable.
3. Ampliar el catálogo terapéutico por regiones (lumbar y hombro primero), y el texto en inglés.
4. La app y la hoja del paciente quedan fuera por ahora (decisión del propietario): no se
   diseña ni se plantea nada de la app hasta que lo pida. La biblioteca sólo exporta los datos
   (`catalog.json` con `sheet`).

## Cómo revisar visualmente

Las capturas de las animaciones CSS en pausa no son fiables (el navegador desplaza las filas
anchas). Para revisar fotogramas, renderizar posturas estáticas: muestrear con `sample(ex)`,
coger el fotograma y llamar a `renderView` con todos los fotogramas iguales a esa postura.

## Convenciones

- Commits en español, Conventional Commits, sin identificadores de modelo.
- Rama designada `claude/eager-heisenberg-cgodjv`; no tocar `claude/magical-galileo-y9nh2n`. Si su PR ya se fusionó, se reinicia desde
  `origin/main` antes del trabajo nuevo.
- Las PR se abren sólo cuando el propietario lo pide; se fusionan sólo cuando lo pide.
