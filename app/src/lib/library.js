// Biblioteca empaquetada en la app (generada por tools/build-app-library.mjs en public/lib/).
import { LIB_BASE } from '../config.js';

let cache = null;
export function loadLibrary(base = LIB_BASE, fetchFn = fetch) {
  if (!cache) {
    cache = Promise.all([
      fetchFn(`${base}/manifest.json`).then(r => r.json()),
      fetchFn(`${base}/catalog.json`).then(r => r.json()),
    ]).then(([manifest, catalog]) => ({ manifest, catalog, byId: new Map(catalog.exercises.map(e => [e.id, e])) }))
      .catch(e => { cache = null; throw e; });
  }
  return cache;
}

/** Figuras de un ejercicio (rutas relativas a la biblioteca), la principal primero. */
export const figureUrls = (ex, base = LIB_BASE) => (ex?.animation?.views || []).map(v => `${base}/${v}`);
