// Builds the exercise library:
//   library/svg/<id>-{lateral,frontal,iso}.svg  (self-contained animated SVGs, CSS only)
//   library/poses.json                          (sampled 3D poses for native renderers)
//   library/viewer.js                           (free-camera renderer for poses.json)
//   library/lote-{a,b,c,d}.html                 (gallery per batch: CSS views + free-camera 3D view)
//   library/index.html                          (faceted search over the catalogue)
//   library/catalog.json                        (taxonomy resolved per exercise, for apps)
//   library/catalog-flags.csv                   (the same as a sparse flag table)
// Usage: node tools/build.mjs
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, validate, renderView, poseData, VIEWS } from './engine.mjs';
import { EXERCISES } from './exercises.mjs';
import { EXERCISES_B } from './exercises-b.mjs';
import { EXERCISES_C } from './exercises-c.mjs';
import { EXERCISES_D } from './exercises-d.mjs';
import { loadTaxonomy, crossCheck, flagsCsv } from './taxonomy.mjs';

const BATCHES = [['A', 'Lote A · de pie, simétricos', EXERCISES], ['B', 'Lote B · suelo, suspensión y una pierna', EXERCISES_B], ['C', 'Lote C · saltos, desplazamiento y material en movimiento', EXERCISES_C], ['D', 'Lote D · resto del catálogo', EXERCISES_D]];

const TOOLS = dirname(fileURLToPath(import.meta.url));
const OUT = join(TOOLS, '..', 'library');
const VIEWER = readFileSync(join(TOOLS, 'viewer.js'), 'utf8');
rmSync(join(OUT, 'svg'), { recursive: true, force: true });
rmSync(join(OUT, 'iso.html'), { force: true });
const pageOf = b => `lote-${b.toLowerCase()}.html`;
const TAX = loadTaxonomy(join(TOOLS, '..', 'taxonomy'));
const ENTRY = Object.fromEntries(TAX.entries.map(e => [e.id, e]));
const label = (vocab, k) => TAX.vocab[vocab][String(k)].es;
// Classification chips shown on each gallery card.
const chips = e => (!e ? '' : `<ul class="tags">${[
  ['p', label('patterns', e.pattern)], ['n', label('levels', e.level)],
  ...e.equipment.filter(q => q !== 'peso-corporal' && q !== 'esterilla').map(q => ['m', label('equipment', q)]),
  ...e.places.map(pl => ['l', label('places', pl)]),
].map(([c, t]) => `<li class="t-${c}">${t}</li>`).join('')}</ul>`);
const files = {};
mkdirSync(join(OUT, 'svg'), { recursive: true });

const cards = { A: [], B: [], C: [], D: [] }, data = [], names = { A: [], B: [], C: [], D: [] };
for (const [batch, , list] of BATCHES) for (const ex0 of list) {
  const ex = { ...ex0, batch };
  const s = sample(ex);
  validate(ex, s.frames);
  const views = [...(ex.views || ['side', 'front']), 'iso'];
  for (const view of views)
    writeFileSync(join(OUT, 'svg', `${ex.id}-${view === 'iso' ? 'iso' : VIEWS[view].label}.svg`), renderView(ex, view, s, 64) + '\n');
  data.push(poseData(ex, s));
  names[batch].push([ex.id, ex.name]);
  files[ex.id] = { batch, page: `${pageOf(batch)}#${ex.id}`, views: views.map(v => `svg/${ex.id}-${v === 'iso' ? 'iso' : VIEWS[v].label}.svg`), duration: +s.T.toFixed(2), cue: ex.cue };
  cards[batch].push(`<article class="card" id="${ex.id}"><h2>${ex.name}</h2><p>${ex.cue}</p>${chips(ENTRY[ex.id])}<div class="views">`
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

// Catalogue: every animation must be classified and every classified variant animated.
crossCheck(TAX.entries, data.map(d => d.id));
const vocabLabels = Object.fromEntries(Object.entries(TAX.vocab).map(([k, terms]) =>
  [k, Object.fromEntries(Object.entries(terms).map(([id, t]) => [id, { es: t.es, en: t.en, ...(t.parent ? { parent: t.parent } : {}) }]))]));
const catalog = { vocab: vocabLabels, exercises: TAX.entries.map(e => ({ ...e, animation: files[e.id] })) };
writeFileSync(join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
writeFileSync(join(OUT, 'catalog-flags.csv'), flagsCsv(TAX.entries, TAX.vocab));

const CSS = `:root{--ground:#F3F6F5;--card:#FFFFFF;--ink:#0F2A3D;--muted:#44596B;--accent:#C2410C}
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
.nav{display:flex;flex-wrap:wrap;gap:8px}
.nav a{font-weight:700;color:var(--accent);text-decoration:none;padding:6px 12px;border-radius:999px;background:var(--card)}
.nav a[aria-current]{background:var(--accent);color:#fff}
.toc{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:16px}
.toc section{background:var(--card);border-radius:18px;padding:16px 18px}
.toc h2{margin:0 0 8px;font-size:18px}
.toc ul{margin:0;padding-left:18px;line-height:1.7}
.toc a{color:var(--ink)}
.tags{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.tags li{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:#E2EAEF;color:var(--ink)}
.tags .t-p{background:var(--ink);color:#fff}
.tags .t-n{background:#FDEEE6;color:#9A3412}
.search{display:grid;grid-template-columns:minmax(220px,280px) 1fr;gap:16px;align-items:start}
@media (max-width:720px){.search{grid-template-columns:1fr}}
.facets{background:var(--card);border-radius:18px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.facets input[type=search]{font:inherit;padding:8px 10px;border:1px solid #C9D3DB;border-radius:10px}
.facets details{border-top:1px solid #E2EAEF;padding-top:6px}
.facets summary{font-weight:800;cursor:pointer;color:var(--ink)}
.facets label{display:flex;gap:6px;align-items:center;font-size:14px;color:var(--ink-2,#2B3F50);padding:1px 0}
.facets label small{color:var(--muted);margin-left:auto}
.facets button{font:inherit;border:0;background:none;color:var(--accent);font-weight:700;cursor:pointer;text-align:left;padding:4px 0}
.results{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.results a{background:var(--card);border-radius:14px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--ink);text-decoration:none;font-weight:700;font-size:14px;text-align:center}
.results img{width:100%;max-width:130px;aspect-ratio:1}
.count{margin:0;color:var(--muted)}
`;
const nav = cur => `<nav class="nav">${BATCHES.map(([b]) => `<a href="${pageOf(b)}"${b === cur ? ' aria-current="page"' : ''}>Lote ${b}</a>`).join('')}<a href="index.html">Índice</a></nav>`;
const shell = (title, inner, script = '') => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${CSS}</style>
</head>
<body>
<main>
${inner}
</main>
${script}
</body>
</html>
`;

for (const [b, title] of BATCHES) {
  const subset = { units: poses.units, exercises: data.filter(e => e.batch === b) };
  writeFileSync(join(OUT, pageOf(b)), shell(`Ejercicios · lote ${b}`, `<h1>${title}</h1>
${nav(b)}
<p class="lead">Monigotes SVG animados con CSS, generados por <code>tools/build.mjs</code>. La vista iso se calcula en vivo a partir de las posturas 3D: arrastra para girar la cámara y haz doble clic para volver a la cámara inicial. Pausa para recorrer el ciclo con el control de posición.</p>
<div class="bar">
<button id="play" type="button">Pausa</button>
<label>Velocidad <select id="speed"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="1.5">1,5×</option></select></label>
<label>Posición <input id="scrub" type="range" min="0" max="1000" value="0" disabled></label>
</div>
<div class="grid">
${cards[b].join('\n')}
</div>`, `<script>
${VIEWER}
</script>
<script>
const POSES = ${JSON.stringify(subset)};
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
</script>`));
}

// Index: faceted search. Several values in one facet = any of them; facets combine with AND;
// demands work the other way round (tick to exclude exercises that have them).
const FACET_UI = [
  ['Patrón', 'patterns', e => [e.pattern, ...e.patterns2]],
  ['Músculo', 'muscles', e => e.muscleGroups],
  ['Material', 'equipment', e => e.equipment],
  ['Lugar', 'places', e => e.places],
  ['Posición', 'positions', e => [e.position]],
  ['Nivel', 'levels', e => [String(e.level)]],
  ['Objetivo', 'actions', e => [e.action]],
  ['Lateralidad', 'laterality', e => [e.laterality]],
  ['Plano', 'planes', e => [e.plane]],
  ['Excluir exigencias', 'demands', e => e.demands, true],
];
const lite = TAX.entries.map(e => ({
  id: e.id, name: e.name.es, page: files[e.id].page, img: files[e.id].views[0],
  f: Object.fromEntries(FACET_UI.map(([, v, get]) => [v, get(e).map(String)])),
}));
const depth = (v, k) => { let d = 0; for (let p = TAX.vocab[v][k].parent; p; p = TAX.vocab[v][p].parent) d++; return d; };
const facetHtml = FACET_UI.map(([title, v, , exclude]) => {
  const used = new Set(lite.flatMap(e => e.f[v]));
  const keys = Object.keys(TAX.vocab[v]).filter(k => used.has(k));
  return `<details${v === 'patterns' ? ' open' : ''}><summary>${title}</summary>${keys.map(k => {
    const n = lite.filter(e => e.f[v].includes(k)).length;
    return `<label style="padding-left:${depth(v, k) * 14}px"><input type="checkbox" data-f="${v}" value="${k}"${exclude ? ' data-x="1"' : ''}>${TAX.vocab[v][k].es}<small>${n}</small></label>`;
  }).join('')}</details>`;
}).join('\n');

writeFileSync(join(OUT, 'index.html'), shell('Ejercicios funcionales', `<h1>Ejercicios funcionales</h1>
${nav(null)}
<p class="lead">${data.length} ejercicios (${TAX.families.length} familias) clasificados por varios criterios a la vez. Dentro de un criterio se combinan con «o», entre criterios con «y»; las exigencias marcadas excluyen. Datos: <code>catalog.json</code> y <code>catalog-flags.csv</code>.</p>
<div class="search">
<aside class="facets">
<input id="q" type="search" placeholder="Buscar por nombre" aria-label="Buscar por nombre">
<button id="clear" type="button">Quitar filtros</button>
${facetHtml}
</aside>
<section><p class="count" id="count"></p><div class="results" id="results"></div></section>
</div>`, `<script>
const CAT = ${JSON.stringify(lite)};
(function () {
  const boxes = [...document.querySelectorAll('.facets input[type=checkbox]')], q = document.getElementById('q');
  const results = document.getElementById('results'), count = document.getElementById('count');
  function run() {
    const inc = {}, exc = new Set(), text = q.value.trim().toLowerCase();
    for (const b of boxes) if (b.checked) { if (b.dataset.x) exc.add(b.value); else (inc[b.dataset.f] ||= []).push(b.value); }
    const hits = CAT.filter(e => (!text || e.name.toLowerCase().includes(text))
      && Object.entries(inc).every(([f, vals]) => vals.some(v => e.f[f].includes(v)))
      && !e.f.demands.some(d => exc.has(d)));
    count.textContent = hits.length + ' de ' + CAT.length + ' ejercicios';
    results.innerHTML = hits.map(e => '<a href="' + e.page + '"><img src="' + e.img + '" alt="" loading="lazy">' + e.name + '</a>').join('');
  }
  boxes.forEach(b => b.addEventListener('change', run));
  q.addEventListener('input', run);
  document.getElementById('clear').addEventListener('click', () => { boxes.forEach(b => (b.checked = false)); q.value = ''; run(); });
  run();
})();
</script>`));
console.log('library/ listo');
