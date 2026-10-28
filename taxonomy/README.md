# Taxonomía de ejercicios

Fuente de verdad de la clasificación. `node tools/build.mjs` la valida, la cruza con las
animaciones y exporta `library/catalog.json` (para apps) y `library/catalog-flags.csv`
(tabla dispersa de flags, generada: no se edita a mano).

## Ficheros

- `vocab/*.json` — vocabularios cerrados: cada término lleva `es` y `en`; los jerárquicos
  (`muscles`) llevan `parent`. Las claves que empiezan por `_` son notas.
- `families/<id>.json` — una familia de movimiento con sus variantes. El nombre del fichero
  es el `id` de la familia.

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
| `muscles.primary`, `muscles.secondary` | listas | `muscles` (un músculo no puede estar en las dos) |
| `equipment` | lista no vacía | `equipment` (`peso-corporal` si no hay material) |
| `demands` | lista | `demands`: exigencias mecánicas descriptivas, no contraindicaciones |
| `params` | `{ parámetro: [valores] }` | ejes de variación de la familia |
| `variants` | lista | ver abajo |

## Variantes

Cada variante tiene `id` (el mismo que su animación), `name.es`, `name.en` y opcionalmente
`set` (valores de los `params` de la familia) y cualquier campo de clasificación, que
**sustituye** al de la familia (no se mezcla: si una variante declara `muscles`, declara los
suyos completos).

## Facetas derivadas (no se escriben)

- Grupos musculares: cada músculo más todos sus antecesores (filtrar por «glúteo» incluye
  glúteo mayor y medio).
- Categorías de material.
- Lugares: un ejercicio es posible donde está todo su material (`places` de `vocab/equipment.json`).

## Reglas que comprueba la validación

Valores dentro de su vocabulario, campos desconocidos, ids repetidos, parámetros no
declarados, listas vacías o con duplicados, jerarquías sin ciclos, etiquetas en los dos
idiomas, y que cada animación tenga clasificación y cada variante, animación.
