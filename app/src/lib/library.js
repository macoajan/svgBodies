// Biblioteca empaquetada en la app (generada por tools/build-app-library.mjs en public/lib/).
import { LIB_BASE } from '../config.js';
import { buildIndex } from '../domain/catalogo.js';

let cache = null;
export function loadLibrary(base = LIB_BASE, fetchFn = fetch) {
  if (!cache) {
    cache = Promise.all([
      fetchFn(`${base}/manifest.json`).then(r => r.json()),
      fetchFn(`${base}/catalog.json`).then(r => r.json()),
    ]).then(([manifest, catalog]) => ({
      manifest, catalog,
      byId: new Map(catalog.exercises.map(e => [e.id, e])),
      index: buildIndex(catalog),
    })).catch(e => { cache = null; throw e; });
  }
  return cache;
}

/** Figuras de un ejercicio (rutas relativas a la biblioteca), la principal primero. */
export const figureUrls = (ex, base = LIB_BASE) => (ex?.animation?.views || []).map(v => `${base}/${v}`);

/** Nombre de una vista a partir del archivo («…-lateral.svg» → «Lateral»). */
const VIEW_LABEL = { lateral: 'Lateral', frontal: 'Frontal', iso: 'Perspectiva', cenital: 'Arriba' };
export const viewLabel = path => VIEW_LABEL[/-([a-z]+)\.svg$/.exec(path)?.[1]] || 'Vista';

// Figuras como texto SVG (para insertarlas en línea y poder pausar su animación). Son archivos
// propios de la app, no contenido externo.
const svgCache = new Map();
export function loadFigure(path, base = LIB_BASE) {
  if (!svgCache.has(path)) {
    svgCache.set(path, fetch(`${base}/${path}`).then(r => { if (!r.ok) throw new Error('figura no disponible'); return r.text(); })
      .catch(e => { svgCache.delete(path); throw e; }));
  }
  return svgCache.get(path);
}

// Visor 3D (PoseViewer, de library/viewer.js) y posturas por ejercicio, cargados al abrir el 3D.
let viewerLib = null;
export function loadViewer(base = LIB_BASE) {
  return viewerLib || (viewerLib = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = `${base}/viewer.js`;
    sc.onload = () => resolve(/** @type {any} */ (window).PoseViewer);
    sc.onerror = () => { viewerLib = null; reject(new Error('visor 3D no disponible')); };
    document.head.append(sc);
  }));
}
const poseCache = new Map();
export function loadPoses(id, base = LIB_BASE) {
  if (!poseCache.has(id)) {
    poseCache.set(id, fetch(`${base}/poses/${id}.json`).then(r => { if (!r.ok) throw new Error('sin posturas'); return r.json(); })
      .catch(e => { poseCache.delete(id); throw e; }));
  }
  return poseCache.get(id);
}
