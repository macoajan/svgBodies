# Handoff — svgBodies

Estado al cerrar la sesión del 2026-11-01. Para retomar el trabajo en una sesión nueva.

## Objetivo del proyecto

Biblioteca muy grande de ejercicios (con variantes) dibujados como monigotes SVG animados, para
apps de entrenamiento. Sigue el método de los monigotes de eap-web (`docs/monigotes-eap.md`).
El propietario escribe en español y espera respuestas en español.

## Estado del repositorio

- `main` = `e9f2b02` (PR [macoajan/svgBodies#1](https://github.com/macoajan/svgBodies/pull/1)
  lotes A–D, y PR [macoajan/svgBodies#2](https://github.com/macoajan/svgBodies/pull/2)
  taxonomía; las dos fusionadas).
- Rama de trabajo `claude/eager-heisenberg-cgodjv` (traída íntegra de `claude/magical-galileo-y9nh2n`,
  que queda abandonada) = `6484a9c` + este handoff: **lote E sin PR**.
  Pendiente de que el propietario revise las animaciones y pida abrir la PR.
- Biblioteca: **70 ejercicios, 52 familias**, lotes A a E. Todo valida y compila.

```
node tools/build.mjs     # valida taxonomía y posturas, genera library/
```

## Artefactos publicados (privados, del propietario)

| Artefacto | Para qué | Estado |
|---|---|---|
| [Revisión de la taxonomía](https://claude.ai/artifact/C1Ny8wERm4PGUhzqwX6QNZ) | Revisión en el móvil de la clasificación de los 46 ejercicios de los lotes A–D: Correcto/Cambiar y notas por ejercicio, más «Criterios generales». Guarda en la base de datos del artefacto (`revision/<id>` con `{status, note, at}` y `revision-general/notas`). | Cerrada: el propietario dio los 46 por válidos; las 46 marcas están en `ok`. No incluye el lote E. |
| [Lote E de monigotes](https://claude.ai/artifact/A8gUFgokYJm4TMgddV2wr8) | Galería móvil de los 24 ejercicios del lote E (dos vistas CSS + vista 3D giratoria, chips de clasificación). Generada a partir de `library/lote-e.html` con estilos adaptados a móvil y modo oscuro. | Publicada; esperando la opinión del propietario. No se ha abierto en el dispositivo para comprobarla. |

Para actualizar un artefacto desde otra sesión: leerlo primero (`Artifact` con `action: "read"` y
su URL) y publicar con `url`. Las marcas de revisión se leen con `ArtifactData` (`list` de la
colección `revision`).

## Lote E (rama, sin PR)

`tools/exercises-e.mjs`, 24 ejercicios:

- **Movilidad:** circulos-brazos, balanceo-pierna, gusano, squat-to-stand, rotacion-toracica,
  worlds-greatest-stretch.
- **Estiramientos:** estiramiento-isquios, estiramiento-cuadriceps, estiramiento-flexor-cadera,
  postura-nino, perro-boca-abajo, cobra, estiramiento-gemelo, estiramiento-hombro.
- **Carrera en el sitio:** carrera, skipping, talones-gluteo (generador común `runner`).
- **Saltos:** salto-vertical, sentadilla-salto, salto-rodillas-pecho, salto-horizontal,
  zancada-salto, saltos-patinador, saltos-tobillo (estados interpolados con `jumper`).

Técnica nueva: `swapLR` repite las fases reflejadas para hacer los dos lados (la postura de reposo
debe ser simétrica, incluidos los polos del codo). Taxonomía: patrones nuevos `movilidad` y
`estiramiento`; familias `carrera` (parámetro `tecnica`) y `salto-vertical` (`inicio`, `vuelo`).
`tools/build.mjs` genera las páginas de lote a partir de la lista `BATCHES`.

Limitación conocida: el tronco es un segmento recto (sin curvar la columna), por eso no hay
gato-camello, y la cobra y la postura del niño se leen por cadera y cabeza.

## Próximos pasos

1. Recoger la opinión del propietario sobre el lote E, corregir y abrir la PR (borrador no; en
   este repo no hay CI). Fusionar sólo cuando lo pida.
2. Propuesta pendiente de decisión: que los parámetros de familia generen variantes en el motor
   (piloto con sentadilla y zancada: implemento × posición de carga × apoyo × anchura ×
   profundidad), con una página de revisión móvil para aceptar o descartar variantes.
3. Otras opciones planteadas: lote de bandas y máquinas, paquete reproductor para las apps,
   revisión experta de músculos, niveles y exigencias.

## Cómo revisar visualmente

Las capturas de las animaciones CSS en pausa no son fiables (el navegador desplaza las filas
anchas). Para revisar fotogramas, renderizar posturas estáticas: muestrear con `sample(ex)`,
coger el fotograma y llamar a `renderView` con todos los fotogramas iguales a esa postura.

## Convenciones

- Commits en español, Conventional Commits, sin identificadores de modelo.
- Rama designada `claude/eager-heisenberg-cgodjv`; no tocar `claude/magical-galileo-y9nh2n`. Si su PR ya se fusionó, se reinicia desde
  `origin/main` antes del trabajo nuevo.
- Las PR se abren sólo cuando el propietario lo pide; se fusionan sólo cuando lo pide.
