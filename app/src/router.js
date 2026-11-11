// Router mínimo por hash (#/ruta/:param?clave=valor). Igual en web y en la app nativa.
import { signal } from '@preact/signals';

/** Separa ruta y consulta de un hash como «#/pro/pauta/ab12?tab=2». */
export function parseHash(hash) {
  const raw = (hash || '').replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  const path = '/' + p.split('/').filter(Boolean).map(decodeURIComponent).join('/');
  return { path, query: Object.fromEntries(new URLSearchParams(q)) };
}

/** Busca la primera ruta cuyo patrón («/pro/pauta/:id») encaja con la ruta. */
export function match(routes, path) {
  const segs = path.split('/').filter(Boolean);
  for (const route of routes) {
    const pat = route.path.split('/').filter(Boolean);
    if (pat.length !== segs.length) continue;
    const params = {};
    if (pat.every((s, i) => (s.startsWith(':') ? ((params[s.slice(1)] = segs[i]), true) : s === segs[i]))) {
      return { route, params };
    }
  }
  return null;
}

/** Construye un hash a partir de ruta y consulta. */
export function href(path, query) {
  const q = query && Object.keys(query).length ? '?' + new URLSearchParams(query) : '';
  return '#' + path + q;
}

export const location = signal(parseHash(typeof window !== 'undefined' ? window.location.hash : ''));

export function startRouter() {
  const sync = () => { location.value = parseHash(window.location.hash); };
  window.addEventListener('hashchange', sync);
  sync();
  return () => window.removeEventListener('hashchange', sync);
}

export function navigate(path, query, { replace = false } = {}) {
  const h = href(path, query);
  if (replace) window.history.replaceState(null, '', h); else window.location.hash = h;
  location.value = parseHash(h);
}
