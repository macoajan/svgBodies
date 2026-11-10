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
  // Therapeutic exercise: all three or none (checked after resolving a variant).
  { field: 'regions', vocab: 'regions', kind: 'many', optional: true, therapy: true },
  { field: 'goals', vocab: 'therapy-goals', kind: 'many', optional: true, therapy: true },
  { field: 'mode', vocab: 'therapy-modes', kind: 'one', optional: true, therapy: true },
];
const THERAPY = FACETS.filter(f => f.therapy).map(f => f.field);
const MAX_MUSCLES = 8;
// Estimated energy cost (MET, Compendium of Physical Activities style), for calorie estimates.
const MET_RANGE = [1, 20];
const FACET_FIELDS = new Set([...FACETS.map(f => f.field), 'muscles', 'met']);
const VARIANT_KEYS = new Set(['id', 'name', 'set', 'progressions', ...FACET_FIELDS]);
const FAMILY_KEYS = new Set(['id', 'name', 'params', 'variants', ...FACET_FIELDS]);

const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const strip = o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

// Exercise sheet (sheets/<id>.json): plain-language text for the patient and technical notes
// for the professional. Required for every therapeutic exercise.
const SHEET_SHAPE = { patient: { start: 'text', steps: 'list', avoid: 'list' }, pro: { goal: 'text', notes: 'list' } };
function checkSheet(sh, where, err) {
  for (const k of Object.keys(sh)) if (k !== 'id' && !SHEET_SHAPE[k]) err(where, `campo desconocido "${k}"`);
  for (const [part, fields] of Object.entries(SHEET_SHAPE)) {
    if (!sh[part]) { err(where, `falta "${part}"`); continue; }
    for (const k of Object.keys(sh[part])) if (!fields[k]) err(where, `campo desconocido "${part}.${k}"`);
    for (const [k, kind] of Object.entries(fields)) {
      const v = sh[part][k];
      if (kind === 'text' ? !(typeof v === 'string' && v.trim()) : !(Array.isArray(v) && v.length && v.every(x => typeof x === 'string' && x.trim())))
        err(where, `"${part}.${k}" debe ser ${kind === 'text' ? 'un texto' : 'una lista de textos'} no vacío`);
    }
  }
}

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
      // Estimated share of the muscular work: { muscle: percent }, multiples of 5 adding up to 100.
      const m = obj.muscles;
      if (!m || typeof m !== 'object' || Array.isArray(m)) err(where, '"muscles" debe ser un objeto { músculo: porcentaje }');
      else {
        const ks = Object.keys(m);
        if (!ks.length || ks.length > MAX_MUSCLES) err(where, `"muscles" debe tener entre 1 y ${MAX_MUSCLES} músculos`);
        for (const k of ks) {
          if (!vocab.muscles[k]) err(where, `músculo desconocido "${k}"`);
          const v = m[k];
          if (!Number.isInteger(v) || v <= 0 || v % 5) err(where, `"muscles.${k}" = ${JSON.stringify(v)}: debe ser un entero positivo múltiplo de 5`);
        }
        const sum = ks.reduce((a, k) => a + (Number(m[k]) || 0), 0);
        if (sum !== 100) err(where, `los porcentajes de "muscles" suman ${sum}, no 100`);
        for (const k of ks) for (let p = vocab.muscles[k]?.parent; p; p = vocab.muscles[p]?.parent)
          if (ks.includes(p)) err(where, `"muscles" incluye a la vez "${p}" y su parte "${k}"`);
        for (let i = 1; i < ks.length; i++) if (m[ks[i]] > m[ks[i - 1]]) { err(where, '"muscles" debe ir ordenado de mayor a menor porcentaje'); break; }
        // The top three are shown as the main muscles: the third must beat the fourth.
        if (ks.length > 3 && m[ks[2]] === m[ks[3]]) err(where, `"muscles": empate en el tercer puesto (${ks[2]} y ${ks[3]} con ${m[ks[2]]}); los tres primeros deben quedar definidos`);
      }
    } else if (required) err(where, 'falta "muscles"');
    if (obj.met !== undefined) {
      const v = obj.met;
      if (typeof v !== 'number' || !(v >= MET_RANGE[0] && v <= MET_RANGE[1]) || Math.round(v * 10) !== v * 10)
        err(where, `"met" = ${JSON.stringify(v)}: debe ser un número entre ${MET_RANGE[0]} y ${MET_RANGE[1]} con un decimal como mucho`);
    } else if (required) err(where, 'falta "met"');
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
      e.progressions = v.progressions || [];
      const th = THERAPY.filter(f => e[f] !== undefined);
      if (th.length && th.length < THERAPY.length) err(vw, `ejercicio terapéutico incompleto: falta ${THERAPY.filter(f => e[f] === undefined).join(', ')}`);
      e.therapeutic = th.length === THERAPY.length;
      if (!e.therapeutic) for (const f of THERAPY) delete e[f];
      e.level = Number(e.level);
      entries.push(e);
    }
  }
  // Progressions: ids that exist, no self-links, no cycles; regressions are derived.
  const byId = Object.fromEntries(entries.map(e => [e.id, e]));
  for (const e of entries) {
    e.regressions = [];
    if (!Array.isArray(e.progressions)) { err(e.id, '"progressions" debe ser una lista'); e.progressions = []; }
    for (const p of e.progressions) if (!byId[p] || p === e.id) err(e.id, `progresión a un ejercicio inexistente o a sí mismo: "${p}"`);
  }
  for (const e of entries) for (const p of e.progressions) byId[p]?.regressions.push(e.id);
  const state = {};
  const visit = (id, path) => {
    if (state[id] === 2) return;
    if (state[id] === 1) { err(id, `ciclo de progresiones: ${[...path, id].join(' → ')}`); return; }
    state[id] = 1;
    for (const p of byId[id].progressions) if (byId[p]) visit(p, [...path, id]);
    state[id] = 2;
  };
  for (const e of entries) visit(e.id, []);

  // Sheets: one per therapeutic exercise, none for unknown ids.
  const sheetDir = join(root, 'sheets');
  let sheetFiles = [];
  try { sheetFiles = readdirSync(sheetDir).filter(f => f.endsWith('.json')); } catch { /* no sheets yet */ }
  for (const f of sheetFiles) {
    const id = f.replace(/\.json$/, ''), where = `sheets/${f}`;
    if (!byId[id]) { err(where, 'no hay ningún ejercicio con ese id'); continue; }
    const sh = strip(readJson(join(sheetDir, f)));
    checkSheet(sh, where, err);
    byId[id].sheet = { patient: sh.patient, pro: sh.pro };
  }
  for (const e of entries) if (e.therapeutic && !e.sheet) err(e.id, `ejercicio terapéutico sin ficha (sheets/${e.id}.json)`);

  if (errors.length) throw new Error(`Taxonomía con ${errors.length} error(es):\n  - ${errors.join('\n  - ')}`);

  // Derived facets: muscle groups (ancestors), equipment categories and places.
  const ancestors = m => { const out = []; for (let p = vocab.muscles[m].parent; p; p = vocab.muscles[p].parent) out.push(p); return out; };
  for (const e of entries) {
    e.muscles = Object.entries(e.muscles).map(([id, pct]) => ({ id, pct }));
    e.muscleGroups = [...new Set(e.muscles.flatMap(m => [m.id, ...ancestors(m.id)]))];
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
  add('musculo', Object.keys(vocab.muscles));
  add('grupo-muscular', Object.keys(vocab.muscles));
  add('region', Object.keys(vocab.regions));
  add('objetivo-terapeutico', Object.keys(vocab['therapy-goals']));
  add('modo', Object.keys(vocab['therapy-modes']));
  const has = e => new Set([
    `patron:${e.pattern}`, ...e.patterns2.map(x => `patron2:${x}`), `plano:${e.plane}`, `mecanica:${e.mechanics}`,
    `accion:${e.action}`, `posicion:${e.position}`, `lateralidad:${e.laterality}`, `nivel:${e.level}`,
    ...e.equipment.map(x => `material:${x}`), ...e.places.map(x => `lugar:${x}`), ...e.demands.map(x => `exigencia:${x}`),
    ...e.muscleGroups.map(x => `grupo-muscular:${x}`),
    ...(e.regions || []).map(x => `region:${x}`), ...(e.goals || []).map(x => `objetivo-terapeutico:${x}`), ...(e.mode ? [`modo:${e.mode}`] : []),
  ]);
  const q = s => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = [['id', 'familia', 'nombre', 'met', ...cols].join(',')];
  // Flags are 1 or empty; the musculo:<id> columns carry the estimated percentage instead.
  for (const e of entries) {
    const h = has(e), pct = Object.fromEntries(e.muscles.map(m => [`musculo:${m.id}`, String(m.pct)]));
    rows.push([e.id, e.family, q(e.name.es), String(e.met), ...cols.map(c => pct[c] ?? (h.has(c) ? '1' : ''))].join(','));
  }
  return rows.join('\n') + '\n';
}
