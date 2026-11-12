import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { useLibrary } from './useLibrary.js';
import { figureUrls } from '../lib/library.js';
import { navigate } from '../router.js';
import { FACETS, FACET, EQUIPMENT_CATEGORY, search, facetCounts, facetOptions, parseFilters, toQuery, mainEquipment } from '../domain/catalogo.js';

// Se recuerdan la consulta y el desplazamiento para volver desde la ficha al mismo sitio.
export const catalogoMemoria = { query: {}, scroll: 0 };

const Lupa = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;

/** Hoja inferior con las opciones de un filtro y su recuento. */
function HojaFiltro({ facetKey, catalog, index, state, onApply, onClose }) {
  const ref = useRef(null);
  const [sel, setSel] = useState(new Set(state.filters[facetKey] || []));
  useEffect(() => { ref.current?.showModal?.(); }, []);
  const f = FACET[facetKey];
  const opts = useMemo(() => facetOptions(catalog, facetKey), [catalog, facetKey]);
  const counts = useMemo(() => facetCounts(index, state, facetKey), [index, state, facetKey]);
  const preview = useMemo(() => search(index, { ...state, filters: { ...state.filters, [facetKey]: [...sel] } }).length, [index, state, sel]);
  const toggle = v => { const n = new Set(sel); n.has(v) ? n.delete(v) : n.add(v); setSel(n); };
  let lastGroup = null;
  return (
    <dialog ref={ref} class="hoja" aria-labelledby="hoja-t" onClose={onClose} onClick={e => e.target === ref.current && ref.current.close()}>
      <div class="hoja-cab">
        <h2 id="hoja-t">{f.label}</h2>
        <button type="button" class="enlace" onClick={() => setSel(new Set())} disabled={!sel.size}>Limpiar</button>
      </div>
      <div class="hoja-lista">
        {opts.map(o => {
          const n = counts.get(o.value) || 0;
          const head = o.group && o.group !== lastGroup ? (lastGroup = o.group, <p class="hoja-grupo" key={'g' + o.group}>{EQUIPMENT_CATEGORY[o.group] || o.group}</p>) : null;
          return [head, (
            <label key={o.value} class={`opcion${n ? '' : ' vacia'}`} style={o.depth ? { paddingLeft: `${12 + o.depth * 18}px` } : null}>
              <input type="checkbox" checked={sel.has(o.value)} onChange={() => toggle(o.value)} />
              <span class="opcion-texto">{facetKey === 'nivel' ? `${o.value} · ${o.label}` : o.label}</span>
              <span class="opcion-n">{n}</span>
            </label>
          )];
        })}
      </div>
      <button type="button" class="boton" onClick={() => { onApply([...sel]); ref.current.close(); }}>
        Ver {preview} {preview === 1 ? 'ejercicio' : 'ejercicios'}
      </button>
    </dialog>
  );
}

export function Catalogo({ query }) {
  const { lib, error } = useLibrary();
  const q = query.q || '';
  const filters = useMemo(() => parseFilters(query), [JSON.stringify(query)]);
  const state = useMemo(() => ({ q, filters }), [q, filters]);
  const [hoja, setHoja] = useState(null);
  const [texto, setTexto] = useState(q);
  useEffect(() => setTexto(q), [q]);

  const go = next => navigate('/pro/catalogo', toQuery(next), { replace: true });
  // La búsqueda actualiza la URL al escribir (sin añadir entradas al historial).
  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => go({ q: texto, filters }), 150);
    return () => clearTimeout(t);
  }, [texto]);

  const results = useMemo(() => (lib ? search(lib.index, state) : []), [lib, state]);
  const activos = FACETS.flatMap(f => (filters[f.key] || []).map(v => ({ f, v })));

  // Volver al mismo punto de la lista al regresar de una ficha.
  catalogoMemoria.query = query;
  useEffect(() => {
    if (lib && catalogoMemoria.scroll) { window.scrollTo(0, catalogoMemoria.scroll); catalogoMemoria.scroll = 0; }
  }, [lib]);

  const etiqueta = (f, v) => {
    const l = lib?.catalog.vocab[f.vocab]?.[v]?.es ?? v;
    return f.key === 'nivel' ? `Nivel ${v}` : l;
  };

  return (
    <main class="pantalla ancha">
      <Barra titulo="Biblioteca" volver="/pro" />
      <h1>Catálogo</h1>
      <label class="buscador">
        <Lupa />
        <input type="search" value={texto} onInput={e => setTexto(e.currentTarget.value)} placeholder="Buscar: rodilla, puente, banda…"
          aria-label="Buscar ejercicios" enterKeyHint="search" autoComplete="off" />
      </label>
      <div class="chips" role="group" aria-label="Filtros">
        {activos.map(({ f, v }) => (
          <button type="button" class="chip activo" key={f.key + v} aria-label={`Quitar filtro ${etiqueta(f, v)}`}
            onClick={() => go({ q, filters: { ...filters, [f.key]: filters[f.key].filter(x => x !== v) } })}>
            {etiqueta(f, v)} <span aria-hidden="true">✕</span>
          </button>
        ))}
        {FACETS.map(f => (
          <button type="button" class="chip" key={f.key} aria-haspopup="dialog" onClick={() => setHoja(f.key)}>
            {f.label}{filters[f.key]?.length ? ` (${filters[f.key].length})` : ''}
          </button>
        ))}
      </div>
      {error ? <p class="aviso error">No se pudo cargar la biblioteca: {error}</p> : !lib ? <p class="apagado">Cargando…</p> : (
        <>
          <p class="recuento" aria-live="polite">
            {results.length} {results.length === 1 ? 'ejercicio' : 'ejercicios'}
            {(activos.length || q) ? <> · <button type="button" class="enlace" onClick={() => { setTexto(''); go({}); }}>Quitar filtros</button></> : null}
          </p>
          <ul class="rejilla">
            {results.map(ex => (
              <li key={ex.id}>
                <a class="ficha-mini" href={`#/pro/ejercicio/${ex.id}`} onClick={() => { catalogoMemoria.scroll = window.scrollY; }}>
                  <img src={figureUrls(ex)[0]} alt="" loading="lazy" width="120" height="120" />
                  <span class="ficha-mini-nombre">{ex.name.es}</span>
                  <span class="ficha-mini-meta">Nivel {ex.level} · {mainEquipment(lib.catalog, ex)}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {hoja && lib ? (
        <HojaFiltro facetKey={hoja} catalog={lib.catalog} index={lib.index} state={state} onClose={() => setHoja(null)}
          onApply={vals => go({ q, filters: { ...filters, [hoja]: vals } })} />
      ) : null}
    </main>
  );
}
