# Taxonomía de ejercicios

Fuente de verdad de la clasificación. `node tools/build.mjs` la valida, la cruza con las
animaciones y exporta `library/catalog.json` (para apps) y `library/catalog-flags.csv`
(tabla dispersa de flags, generada: no se edita a mano).

## Ficheros

- `vocab/*.json` — vocabularios cerrados: cada término lleva `es` y `en`; los jerárquicos
  (`muscles`) llevan `parent`. Las claves que empiezan por `_` son notas.
- `families/<id>.json` — una familia de movimiento con sus variantes. El nombre del fichero
  es el `id` de la familia.
- `sheets/<id>.json` — ficha de un ejercicio (texto para el paciente y notas para el
  profesional). Obligatoria en los ejercicios terapéuticos. El nombre es el `id` del ejercicio.

## Campos de una familia

| Campo | Tipo | Vocabulario |
|---|---|---|
| `id`, `name.es`, `name.en` | texto | — |
| `pattern` | uno | `patterns` |
| `patterns2` | lista (opcional) | `patterns` (patrones secundarios de ejercicios combinados) |
| `plane` | uno | `planes` |
| `mechanics` | uno | `mechanics` |
| `action` | uno | `actions` (objetivo principal) |
| `position` | uno | `positions` |
| `laterality` | uno | `laterality` |
| `level` | uno | `levels` (1–4) |
| `muscles` | `{ músculo: % }` | `muscles`: reparto estimado del trabajo muscular (ver abajo) |
| `equipment` | lista no vacía | `equipment` (`peso-corporal` si no hay material) |
| `demands` | lista | `demands`: exigencias mecánicas descriptivas, no contraindicaciones |
| `regions` | lista (terapéutico) | `regions`: región corporal a la que se dirige |
| `goals` | lista (terapéutico) | `therapy-goals`: objetivo terapéutico |
| `mode` | uno (terapéutico) | `therapy-modes`: activo o autoasistido |
| `params` | `{ parámetro: [valores] }` | ejes de variación de la familia |
| `variants` | lista | ver abajo |

## Variantes

Cada variante tiene `id` (el mismo que su animación), `name.es`, `name.en` y opcionalmente
`set` (valores de los `params` de la familia) y cualquier campo de clasificación, que
**sustituye** al de la familia (no se mezcla: si una variante declara `muscles`, declara los
suyos completos).

## Músculos y porcentajes

`muscles` reparte el trabajo muscular estimado del ejercicio entre 1 y 8 músculos:

```json
"muscles": { "cuadriceps": 45, "gluteo-mayor": 30, "aductores": 10, "erectores": 5, "soleo": 5, "recto-abdominal": 5 }
```

- Enteros múltiplos de 5 que suman 100, ordenados de mayor a menor.
- Un grupo y una de sus partes no pueden aparecer a la vez (`gluteo` y `gluteo-medio`).
- Es una estimación clínica de la contribución de cada músculo (no una medida
  electromiográfica). En los estiramientos indica qué músculos se estiran y en qué proporción.
- La familia declara el reparto por defecto y cada variante que difiere declara el suyo completo.
- `catalog.json` lo exporta como lista ordenada `[{ "id", "pct" }]`; en `catalog-flags.csv`
  las columnas `musculo:<id>` llevan el porcentaje. Qué músculos se muestran como principales
  y cuáles se agrupan como indirectos lo decide quien consume el catálogo.

## Ejercicio terapéutico

Un ejercicio es terapéutico si tiene `regions`, `goals` y `mode` (los tres o ninguno; se
suelen declarar en la variante para que no los hereden las demás de la familia). Se clasifica
por región y objetivo, no por diagnóstico: la indicación es criterio del profesional.

- `progressions` (sólo en variantes): ids de los ejercicios a los que se progresa. Las
  regresiones se derivan (`regressions` en `catalog.json`). No puede haber ciclos.
- La dosificación (series, repeticiones, tiempos) no forma parte de la biblioteca: la pauta
  el profesional en la app.

### Ficha (`sheets/<id>.json`)

```json
{
  "patient": { "start": "posición inicial", "steps": ["paso 1", "paso 2"], "avoid": ["error frecuente"] },
  "pro": { "goal": "objetivo terapéutico", "notes": ["nota técnica", "progresión o regresión"] }
}
```

`patient` va en lenguaje llano y de tú, para la hoja que recibe el paciente; `pro` es la nota
técnica para el profesional (el paciente también puede leerla). `catalog.json` la exporta en
`sheet`.

## Facetas derivadas (no se escriben)

- Grupos musculares: cada músculo más todos sus antecesores (filtrar por «glúteo» incluye
  glúteo mayor y medio).
- Categorías de material.
- Lugares: un ejercicio es posible donde está todo su material (`places` de `vocab/equipment.json`).

## Reglas que comprueba la validación

Valores dentro de su vocabulario, campos desconocidos, ids repetidos, parámetros no
declarados, listas vacías o con duplicados, jerarquías sin ciclos, etiquetas en los dos
idiomas, y que cada animación tenga clasificación y cada variante, animación. En los
terapéuticos: las tres facetas juntas, progresiones a ejercicios que existen y sin ciclos, y
una ficha completa por ejercicio (sin fichas de ids desconocidos).
