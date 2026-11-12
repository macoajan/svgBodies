// Búsqueda y filtros del catálogo de ejercicios. Lógica pura (sin interfaz), probada en
// test/catalogo.test.mjs. Dentro de un filtro los valores se combinan con «o»; entre filtros, con «y».

/** Filtros disponibles: clave en la URL, vocabulario de etiquetas y valores de cada ejercicio. */
export const FACETS = Object.freeze([
  { key: 'region', label: 'Región', vocab: 'regions', values: e => e.regions || [] },
  { key: 'objetivo', label: 'Objetivo', vocab: 'therapy-goals', values: e => e.goals || [] },
  { key: 'musculo', label: 'Músculo', vocab: 'muscles', values: e => e.muscleGroups || [] },
  { key: 'material', label: 'Material', vocab: 'equipment', values: e => e.equipment || [] },
  { key: 'lugar', label: 'Lugar', vocab: 'places', values: e => e.places || [] },
  { key: 'posicion', label: 'Posición', vocab: 'positions', values: e => (e.position ? [e.position] : []) },
  { key: 'nivel', label: 'Nivel', vocab: 'levels', values: e => (e.level != null ? [String(e.level)] : []) },
]);
export const FACET = Object.freeze(Object.fromEntries(FACETS.map(f => [f.key, f])));

/** Etiquetas de las categorías de material (agrupan las opciones del filtro «Material»). */
export const EQUIPMENT_CATEGORY = Object.freeze({
  ninguno: 'Sin material', accesorio: 'Accesorios', 'peso-libre': 'Peso libre', estructura: 'Estructuras', maquina: 'Máquinas',
});

/** Minúsculas y sin tildes, para buscar «rodilla» o «abduccion». */
export const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const label = (catalog, vocab, k) => catalog.vocab[vocab]?.[k]?.es ?? k;

/** Índice de búsqueda: nombre aparte (puntúa más) y el resto de textos útiles. */
export function buildIndex(catalog) {
  return catalog.exercises.map(ex => {
    const name = fold(ex.name?.es);
    const extra = [
      ex.name?.en, ex.familyName?.es,
      ...(ex.muscles || []).map(m => label(catalog, 'muscles', m.id)),
      ...(ex.equipment || []).map(q => label(catalog, 'equipment', q)),
      ...(ex.regions || []).map(r => label(catalog, 'regions', r)),
      ...(ex.goals || []).map(g => label(catalog, 'therapy-goals', g)),
      label(catalog, 'patterns', ex.pattern), label(catalog, 'positions', ex.position),
    ];
    return { ex, name, text: fold(extra.join(' · ')) };
  });
}

/** Filtros desde la consulta de la URL: { region: ['rodilla'], nivel: ['1','2'] }. */
export function parseFilters(query = {}) {
  const out = {};
  for (const f of FACETS) {
    const vals = String(query[f.key] ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (vals.length) out[f.key] = [...new Set(vals)];
  }
  return out;
}

/** Consulta de URL desde búsqueda y filtros (sin claves vacías). */
export function toQuery({ q = '', filters = {} } = {}) {
  const out = {};
  if (q.trim()) out.q = q.trim();
  for (const f of FACETS) if (filters[f.key]?.length) out[f.key] = filters[f.key].join(',');
  return out;
}

const matchesFilters = (row, filters, skip) => FACETS.every(f => {
  if (f.key === skip) return true;
  const want = filters[f.key];
  if (!want?.length) return true;
  const have = f.values(row.ex);
  return want.some(v => have.includes(v));
});

/** Puntuación de búsqueda (0 = no encaja). Todas las palabras deben aparecer. */
export function score(row, q) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  let s = 0;
  for (const w of words) {
    if (row.name.includes(w)) s += row.name.startsWith(w) || row.name.includes(' ' + w) ? 3 : 2;
    else if (row.text.includes(w)) s += 1;
    else return 0;
  }
  return s;
}

/** Ejercicios que cumplen búsqueda y filtros, los más relevantes primero (y por nombre). */
export function search(index, { q = '', filters = {} } = {}) {
  const hasQ = !!fold(q).trim();
  return index
    .filter(row => matchesFilters(row, filters))
    .map(row => ({ row, s: score(row, q) }))
    .filter(r => r.s > 0)
    .sort((a, b) => (hasQ ? b.s - a.s : 0) || a.row.ex.name.es.localeCompare(b.row.ex.name.es, 'es'))
    .map(r => r.row.ex);
}

/** Recuento por valor de un filtro, aplicando la búsqueda y los demás filtros. */
export function facetCounts(index, { q = '', filters = {} } = {}, key) {
  const f = FACET[key];
  const counts = new Map();
  for (const row of index) {
    if (!matchesFilters(row, filters, key) || !score(row, q)) continue;
    for (const v of f.values(row.ex)) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return counts;
}

/**
 * Opciones de un filtro en el orden del vocabulario, solo las que usa algún ejercicio.
 * Músculos: con `depth` (jerarquía). Material: con `group` (categoría).
 */
export function facetOptions(catalog, key) {
  const f = FACET[key];
  const used = new Set(catalog.exercises.flatMap(e => f.values(e)));
  const vocab = catalog.vocab[f.vocab] || {};
  const depth = k => { let d = 0; for (let p = vocab[k]?.parent; p; p = vocab[p]?.parent) d++; return d; };
  let opts = Object.keys(vocab).filter(k => used.has(k)).map(k => ({
    value: k, label: vocab[k].es,
    ...(key === 'musculo' ? { depth: depth(k) } : {}),
    ...(key === 'material' ? { group: vocab[k].category } : {}),
  }));
  if (key === 'material') {
    const order = Object.keys(EQUIPMENT_CATEGORY);
    opts = opts.map((o, i) => ({ o, i })).sort((a, b) => order.indexOf(a.o.group) - order.indexOf(b.o.group) || a.i - b.i).map(x => x.o);
  }
  return opts;
}

/** kcal por minuto de trabajo según MET y peso (fórmula ACSM: MET·3,5·kg/200). */
export const kcalPerMin = (met, kg = 70) => (met * 3.5 * kg) / 200;

/** Material que merece mostrarse en la tarjeta (sin «Sin material» ni la esterilla si hay otro). */
export function mainEquipment(catalog, ex) {
  const list = (ex.equipment || []).filter(q => q !== 'peso-corporal');
  const shown = list.length > 1 ? list.filter(q => q !== 'esterilla') : list;
  return shown.length ? shown.map(q => label(catalog, 'equipment', q)).join(', ') : 'Sin material';
}
