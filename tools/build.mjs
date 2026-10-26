// Builds the exercise library:
//   library/svg/<id>-lateral.svg, library/svg/<id>-frontal.svg  (self-contained animated SVGs)
//   library/poses.json                                          (sampled 3D poses for native renderers)
//   library/index.html                                          (gallery)
// Usage: node tools/build.mjs
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, validate, renderView, poseData } from './engine.mjs';
import { EXERCISES } from './exercises.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'library');
rmSync(join(OUT, 'svg'), { recursive: true, force: true });
mkdirSync(join(OUT, 'svg'), { recursive: true });

const cards = [], data = [];
for (const ex of EXERCISES) {
  const s = sample(ex);
  validate(ex, s.frames);
  for (const [view, file] of [['side', 'lateral'], ['front', 'frontal']])
    writeFileSync(join(OUT, 'svg', `${ex.id}-${file}.svg`), renderView(ex, view, s, 64) + '\n');
  data.push(poseData(ex, s));
  cards.push(`<article class="card"><h2>${ex.name}</h2><p>${ex.cue}</p><div class="views">`
    + `<figure>${renderView(ex, 'side', s, 200)}<figcaption>Lateral</figcaption></figure>`
    + `<figure>${renderView(ex, 'front', s, 200)}<figcaption>Frontal</figcaption></figure></div></article>`);
  console.log(`${ex.id}: ${s.T.toFixed(2)} s, ${s.frames.length} muestras`);
}
writeFileSync(join(OUT, 'poses.json'), JSON.stringify({
  units: 'viewBox -7 -15 78 78; x hacia delante, y hacia abajo, z lateral (lado derecho; el izquierdo es -z)',
  exercises: data,
}) + '\n');

writeFileSync(join(OUT, 'index.html'), `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ejercicios funcionales</title>
<style>
:root{--ground:#F3F6F5;--card:#FFFFFF;--ink:#0F2A3D;--muted:#44596B;--accent:#C2410C}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:system-ui,'Segoe UI',Arial,sans-serif;padding:24px 16px}
main{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
h1{margin:0;font-size:28px}
.lead{margin:0;color:var(--muted);line-height:1.4}
.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:var(--card);border-radius:14px;padding:10px 14px;position:sticky;top:8px;z-index:2;box-shadow:0 4px 16px rgba(15,42,61,.08)}
.bar button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:8px 14px;background:var(--accent);color:#fff;cursor:pointer;min-width:96px}
.bar label{display:flex;gap:8px;align-items:center;font-size:14px;color:var(--muted)}
.bar input[type=range]{width:min(260px,50vw)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,460px),1fr));gap:16px}
.card{background:var(--card);border-radius:18px;padding:16px 18px;display:flex;flex-direction:column;gap:8px}
.card h2{margin:0;font-size:20px}
.card p{margin:0;color:var(--muted);font-size:14px;line-height:1.4}
.views{display:grid;grid-template-columns:1fr 1fr;gap:8px}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:4px}
figure svg{width:100%;height:auto;max-width:200px;overflow:visible}
figcaption{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
</style>
</head>
<body>
<main>
<h1>Ejercicios funcionales · lote A</h1>
<p class="lead">Monigotes SVG animados con CSS, generados por <code>tools/build.mjs</code>. Pausa para recorrer el ciclo con el control de posición.</p>
<div class="bar">
<button id="play" type="button">Pausa</button>
<label>Velocidad <select id="speed"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="1.5">1,5×</option></select></label>
<label>Posición <input id="scrub" type="range" min="0" max="1000" value="0" disabled></label>
</div>
<div class="grid">
${cards.join('\n')}
</div>
</main>
<script>
(function () {
  const play = document.getElementById('play'), speed = document.getElementById('speed'), scrub = document.getElementById('scrub');
  const anims = () => document.getAnimations();
  let paused = false;
  play.addEventListener('click', () => {
    paused = !paused;
    anims().forEach(a => (paused ? a.pause() : a.play()));
    play.textContent = paused ? 'Reproducir' : 'Pausa';
    scrub.disabled = !paused;
    if (paused) { const a = anims()[0]; if (a) scrub.value = Math.round(1000 * ((a.currentTime / a.effect.getTiming().duration) % 1)); }
  });
  speed.addEventListener('change', () => anims().forEach(a => (a.playbackRate = +speed.value)));
  scrub.addEventListener('input', () => anims().forEach(a => (a.currentTime = (scrub.value / 1000) * a.effect.getTiming().duration)));
})();
</script>
</body>
</html>
`);
console.log('library/ listo');
