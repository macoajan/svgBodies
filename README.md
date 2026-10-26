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
| `index.html` | Galería con todos los ejercicios en ambas vistas; pausa, velocidad y control de posición. |
| `svg/<id>-lateral.svg`, `svg/<id>-frontal.svg` | SVG autónomos (CSS dentro), utilizables en web o WebView. |
| `poses.json` | Posturas muestreadas en 3D (lado derecho; el izquierdo es −z) para renderizar en nativo. |

## Estructura

- `tools/engine.mjs` — modelo corporal, ayudas de postura (`legs`, `trunk`, `straight`, `elbowIK`,
  `balance`), muestreo, validación y render de las dos vistas.
- `tools/exercises.mjs` — definición de cada ejercicio: fases (duración y función de postura) y
  postura fija para `prefers-reduced-motion`.

## Añadir un ejercicio

1. Escribir una función `pose(s)` con las ayudas del motor (piernas por ángulos, tronco por
   ángulo o por equilibrio, manos por objetivo + polo del codo, objetos `barbell`/`kb`).
2. Añadir la entrada en `EXERCISES` con sus fases.
3. `node tools/build.mjs`: si una postura es imposible (mano fuera de alcance, objeto bajo el
   suelo, salto entre fases) el generador se detiene con el motivo.

## Lote A

Peso muerto, peso muerto rumano, swing con kettlebell, sentadilla, sentadilla goblet,
sentadilla trasera, press militar, remo con barra y thruster.
