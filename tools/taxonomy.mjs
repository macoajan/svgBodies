// Exercise taxonomy: loads taxonomy/vocab/*.json (closed vocabularies) and
// taxonomy/families/*.json (families with their variants), validates them and resolves
// every variant into a flat catalogue entry. The sparse flag table is derived from it.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Facets: field, vocabulary file and kind ('one' = single value, 'many' = set).
export const FACETS = [
  { field: 'pattern', vocab: 'patterns', kind: 'one' },
  { field: 'patterns2', vocab: 'patterns', kind: 'many', optional: true },
  { field: 'plane', vocab: 'planes', kind: 'one' },
  { field: 'mechanics', vocab: 'mechanics', kind: 'one' },
  { field: 'action', vocab: 'actions', kind: 'one' },
  { field: 'position', vocab: 'positions', kind: 'one' },
  { field: 'laterality', vocab: 'laterality', kind: 'one' },
  { field: 'level', vocab: 'levels', kind: 'one' },
  { field: 'equipment', vocab: 'equipment', kind: 'many', nonEmpty: true },
  { field: 'demands', vocab: 'demands', kind: 'many' },
];
const FACET_FIELDS = new Set([...FACETS.map(f => f.field), 'muscles']);
const VARIANT_KEYS = new Set(['id', 'name', 'set', ...FACET_FIELDS]);
const FAMILY_KEYS = new Set(['id', 'name', 'params', 'variants', ...FACET_FIELDS]);

const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const strip = o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

export function loadTaxonomy(root) {
  const vocab = {};
  for (const f of readdirSync(join(root, 'vocab')).filter(f => f.endsWith('.json')).sort())
    vocab[f.replace(/\.json$/, '')] = strip(readJson(join(root, 'vocab', f)));
  const families = readdirSync(join(root, 'families')).filter(f => f.endsWith('.json')).sort()
    .map(f => ({ file: f, ...readJson(join(root, 'families', f)) }));
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);

  // Vocabulary integrity: labels in both languages, hierarchy parents exist and have no cycles.
  for (const [name, terms] of Object.entries(vocab)) for (const [k, t] of Object.entries(terms)) {
    if (!t.es || !t.en) err(`vocab/${name}.json`, `"${k}" sin etiqueta es/en`);
    if (t.parent && !terms[t.parent]) err(`vocab/${name}.json`, `"${k}" tiene un padre inexistente "${t.parent}"`);
  }
  for (const k of Object.keys(vocab.muscles)) {
    const seen = new Set([k]);
    for (let p = vocab.muscles[k].parent; p; p = vocab.muscles[p]?.parent)
      if (seen.has(p)) { err('vocab/muscles.json', `ciclo en la jerarquía de "${k}"`); break; } else seen.add(p);
  }
  for (const [k, t] of Object.entries(vocab.equipment))
    for (const pl of t.places || []) if (!vocab.places[pl]) err('vocab/equipment.json', `"${k}" usa un lugar desconocido "${pl}"`);

  const checkFacets = (obj, where, required) => {
    for (const f of FACETS) {
      const val = obj[f.field];
      if (val === undefined) { if (required && !f.optional) err(where, `falta "${f.field}"`); continue; }
      const terms = vocab[f.vocab];
      if (f.kind === 'one') {
        if (Array.isArray(val) || !terms[String(val)]) err(where, `"${f.field}" = ${JSON.stringify(val)} no está en vocab/${f.vocab}.json`);
      } else {
        if (!Array.isArray(val)) { err(where, `"${f.field}" debe ser una lista`); continue; }
        if (f.nonEmpty && !val.length) err(where, `"${f.field}" no puede estar vacío`);
        if (new Set(val).size !== val.length) err(where, `"${f.field}" tiene valores repetidos`);
        for (const x of val) if (!terms[x]) err(where, `"${f.field}" contiene "${x}", que no está en vocab/${f.vocab}.json`);
      }
    }
    if (obj.muscles !== undefined) {
      const { primary, secondary = [] } = obj.muscles;
      if (!Array.isArray(primary) || !primary.length) err(where, '"muscles.primary" debe ser una lista no vacía');
      for (const m of [...(primary || []), ...secondary]) if (!vocab.muscles[m]) err(where, `músculo desconocido "${m}"`);
      const both = (primary || []).filter(m => secondary.includes(m));
      if (both.length) err(where, `músculos a la vez principales y secundarios: ${both.join(', ')}`);
    } else if (required) err(where, 'falta "muscles"');
  };

  const entries = [], ids = new Map();
  for (const fam of families) {
    const where = `families/${fam.file}`;
    for (const k of Object.keys(fam)) if (k !== 'file' && !FAMILY_KEYS.has(k)) err(where, `campo desconocido "${k}"`);
    if (fam.id + '.json' !== fam.file) err(where, `el id "${fam.id}" no coincide con el nombre del fichero`);
    if (!fam.name?.es || !fam.name?.en) err(where, 'falta name.es / name.en');
    checkFacets(fam, where, true);
    const params = fam.params || {};
    if (!Array.isArray(fam.variants) || !fam.variants.length) { err(where, 'sin variantes'); continue; }
    for (const v of fam.variants) {
      const vw = `${where} → ${v.id}`;
      for (const k of Object.keys(v)) if (!VARIANT_KEYS.has(k)) err(vw, `campo desconocido "${k}"`);
      if (ids.has(v.id)) err(vw, `id repetido (también en ${ids.get(v.id)})`); else ids.set(v.id, where);
      if (!v.name?.es || !v.name?.en) err(vw, 'falta name.es / name.en');
      for (const [k, x] of Object.entries(v.set || {})) {
        if (!params[k]) err(vw, `parámetro "${k}" no declarado en la familia`);
        else if (!params[k].includes(x)) err(vw, `"${k}" = "${x}" no está entre ${params[k].join(', ')}`);
      }
      checkFacets(v, vw, false);
      // Resolution: a variant replaces the family's value field by field.
      const e = { id: v.id, family: fam.id, name: v.name, familyName: fam.name, params: v.set || {} };
      for (const f of FACET_FIELDS) e[f] = v[f] ?? fam[f];
      e.patterns2 = e.patterns2 || [];
      e.level = Number(e.level);
      entries.push(e);
    }
  }
  if (errors.length) throw new Error(`Taxonomía con ${errors.length} error(es):\n  - ${errors.join('\n  - ')}`);

  // Derived facets: muscle groups (ancestors), equipment categories and places.
  const ancestors = m => { const out = []; for (let p = vocab.muscles[m].parent; p; p = vocab.muscles[p].parent) out.push(p); return out; };
  for (const e of entries) {
    e.muscleGroups = [...new Set([...e.muscles.primary, ...(e.muscles.secondary || [])].flatMap(m => [m, ...ancestors(m)]))];
    e.equipmentCategories = [...new Set(e.equipment.map(q => vocab.equipment[q].category))];
    e.places = Object.keys(vocab.places).filter(pl => e.equipment.every(q => vocab.equipment[q].places.includes(pl)));
  }
  return { vocab, families, entries };
}

// Every animation must be classified, and every variant must have an animation.
export function crossCheck(entries, animationIds) {
  const tax = new Set(entries.map(e => e.id)), anim = new Set(animationIds);
  const missing = [...anim].filter(id => !tax.has(id)), orphan = [...tax].filter(id => !anim.has(id));
  if (missing.length || orphan.length)
    throw new Error(`Taxonomía y animaciones no coinciden.${missing.length ? `\n  Sin clasificar: ${missing.join(', ')}` : ''}${orphan.length ? `\n  Sin animación: ${orphan.join(', ')}` : ''}`);
}

// Sparse flag table (derived view): one row per exercise, one column per facet value.
export function flagsCsv(entries, vocab) {
  const cols = [];
  const add = (prefix, keys) => keys.forEach(k => cols.push(`${prefix}:${k}`));
  add('patron', Object.keys(vocab.patterns));
  add('patron2', Object.keys(vocab.patterns));
  add('plano', Object.keys(vocab.planes));
  add('mecanica', Object.keys(vocab.mechanics));
  add('accion', Object.keys(vocab.actions));
  add('posicion', Object.keys(vocab.positions));
  add('lateralidad', Object.keys(vocab.laterality));
  add('nivel', Object.keys(vocab.levels));
  add('material', Object.keys(vocab.equipment));
  add('lugar', Object.keys(vocab.places));
  add('exigencia', Object.keys(vocab.demands));
  add('musculo-principal', Object.keys(vocab.muscles));
  add('musculo-secundario', Object.keys(vocab.muscles));
  add('grupo-muscular', Object.keys(vocab.muscles));
  const has = e => new Set([
    `patron:${e.pattern}`, ...e.patterns2.map(x => `patron2:${x}`), `plano:${e.plane}`, `mecanica:${e.mechanics}`,
    `accion:${e.action}`, `posicion:${e.position}`, `lateralidad:${e.laterality}`, `nivel:${e.level}`,
    ...e.equipment.map(x => `material:${x}`), ...e.places.map(x => `lugar:${x}`), ...e.demands.map(x => `exigencia:${x}`),
    ...e.muscles.primary.map(x => `musculo-principal:${x}`), ...(e.muscles.secondary || []).map(x => `musculo-secundario:${x}`),
    ...e.muscleGroups.map(x => `grupo-muscular:${x}`),
  ]);
  const q = s => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = [['id', 'familia', 'nombre', ...cols].join(',')];
  for (const e of entries) { const h = has(e); rows.push([e.id, e.family, q(e.name.es), ...cols.map(c => (h.has(c) ? '1' : ''))].join(',')); }
  return rows.join('\n') + '\n';
}
