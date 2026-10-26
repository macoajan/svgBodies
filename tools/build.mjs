// Builds the exercise library:
//   library/svg/<id>-{lateral,frontal,iso}.svg  (self-contained animated SVGs, CSS only)
//   library/poses.json                          (sampled 3D poses for native renderers)
//   library/viewer.js                           (free-camera renderer for poses.json)
//   library/index.html                          (gallery: CSS views + free-camera 3D view)
// Usage: node tools/build.mjs
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, validate, renderView, poseData, VIEWS } from './engine.mjs';
import { EXERCISES } from './exercises.mjs';
import { EXERCISES_B } from './exercises-b.mjs';
import { EXERCISES_C } from './exercises-c.mjs';

const BATCHES = [['A', 'Lote A · de pie, simétricos', EXERCISES], ['B', 'Lote B · suelo, suspensión y una pierna', EXERCISES_B], ['C', 'Lote C · saltos, desplazamiento y material en movimiento', EXERCISES_C]];

const TOOLS = dirname(fileURLToPath(import.meta.url));
const OUT = join(TOOLS, '..', 'library');
const VIEWER = readFileSync(join(TOOLS, 'viewer.js'), 'utf8');
rmSync(join(OUT, 'svg'), { recursive: true, force: true });
rmSync(join(OUT, 'iso.html'), { force: true });
mkdirSync(join(OUT, 'svg'), { recursive: true });

const cards = { A: [], B: [], C: [] }, data = [];
for (const [batch, , list] of BATCHES) for (const ex0 of list) {
  const ex = { ...ex0, batch };
  const s = sample(ex);
  validate(ex, s.frames);
  const views = [...(ex.views || ['side', 'front']), 'iso'];
  for (const view of views)
    writeFileSync(join(OUT, 'svg', `${ex.id}-${view === 'iso' ? 'iso' : VIEWS[view].label}.svg`), renderView(ex, view, s, 64) + '\n');
  data.push(poseData(ex, s));
  cards[batch].push(`<article class="card"><h2>${ex.name}</h2><p>${ex.cue}</p><div class="views">`
    + views.filter(v => v !== 'iso').map(v => `<figure>${renderView(ex, v, s, 200)}<figcaption>${VIEWS[v].label}</figcaption></figure>`).join('')
    + `<figure><svg class="ex3d" data-ex="${ex.id}" width="200" height="200" viewBox="-7 -15 78 78" fill="none" stroke="#C2410C" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${ex.name} — vista 3D"></svg><figcaption>Iso · arrastra</figcaption></figure></div></article>`);
  console.log(`${ex.id}: ${s.T.toFixed(2)} s, ${s.frames.length} muestras`);
}
const poses = {
  units: 'viewBox -7 -15 78 78; x hacia delante, y hacia abajo, z lateral (lado derecho; el izquierdo es -z)',
  exercises: data,
};
writeFileSync(join(OUT, 'poses.json'), JSON.stringify(poses) + '\n');
writeFileSync(join(OUT, 'viewer.js'), VIEWER);

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
.batch{margin:12px 0 0;font-size:20px;color:var(--muted)}
.lead{margin:0;color:var(--muted);line-height:1.4}
.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:var(--card);border-radius:14px;padding:10px 14px;position:sticky;top:8px;z-index:2;box-shadow:0 4px 16px rgba(15,42,61,.08)}
.bar button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:8px 14px;background:var(--accent);color:#fff;cursor:pointer;min-width:96px}
.bar label{display:flex;gap:8px;align-items:center;font-size:14px;color:var(--muted)}
.bar input[type=range]{width:min(260px,50vw)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,540px),1fr));gap:16px}
.card{background:var(--card);border-radius:18px;padding:16px 18px;display:flex;flex-direction:column;gap:8px}
.card h2{margin:0;font-size:20px}
.card p{margin:0;color:var(--muted);font-size:14px;line-height:1.4}
.views{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:4px}
figure svg{width:100%;height:auto;max-width:200px;overflow:visible}
.ex3d{user-select:none}
figcaption{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
</style>
</head>
<body>
<main>
<h1>Ejercicios funcionales</h1>
<p class="lead">Monigotes SVG animados con CSS, generados por <code>tools/build.mjs</code>. La vista iso se calcula en vivo a partir de las posturas 3D: arrastra para girar la cámara y haz doble clic para volver al isométrico. Pausa para recorrer el ciclo con el control de posición.</p>
<div class="bar">
<button id="play" type="button">Pausa</button>
<label>Velocidad <select id="speed"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="1.5">1,5×</option></select></label>
<label>Posición <input id="scrub" type="range" min="0" max="1000" value="0" disabled></label>
</div>
${BATCHES.map(([b, title]) => `<h2 class="batch">${title}</h2>\n<div class="grid">\n${cards[b].join('\n')}\n</div>`).join('\n')}
</main>
<script>
${VIEWER}
</script>
<script>
const POSES = ${JSON.stringify(poses)};
(function () {
  // 3D views take their clock from the CSS animations of the same card, so pause, speed and scrub apply to both.
  const byId = Object.fromEntries(POSES.exercises.map(e => [e.id, e]));
  const figs = [...document.querySelectorAll('.ex3d')].map(svg => {
    const ex = byId[svg.dataset.ex];
    const clock = svg.closest('.card').querySelector('svg.ex').getAnimations({ subtree: true })[0];
    return { fig: PoseViewer.mount(svg, ex), ex, clock };
  });
  (function frame() {
    for (const f of figs) f.fig.render(f.clock ? f.clock.currentTime / 1000 : f.ex.still);
    requestAnimationFrame(frame);
  })();
})();
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
