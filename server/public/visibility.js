// Visibilidad de una pauta o de una sesión de un canal público. Va EN CLARO junto al bloque
// cifrado para que sea el servidor quien no entregue lo que aún no toca (si fuera cifrada, un
// cliente podría leer las sesiones futuras). Solo contiene fechas y modo, ningún dato de salud.
//
// { mode: 'auto' | 'show' | 'hide', from?: ISO 8601, until?: ISO 8601 }
//   auto  visible entre from (incluido) y until (excluido); sin fechas, siempre visible
//   show  forzada visible, ignora las fechas
//   hide  forzada oculta, ignora las fechas
//
// Las fechas llevan zona (p. ej. 2026-11-11T06:00:00+01:00): la app las calcula con la zona
// horaria del gimnasio o del profesional y el servidor compara instantes.

export const MODES = ['auto', 'show', 'hide'];
/** @typedef {{ mode: 'auto' | 'show' | 'hide', from?: string, until?: string }} Visibility */
/** @type {Readonly<Visibility>} */
export const ALWAYS = Object.freeze({ mode: 'auto' });
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function checkVisibility(v) {
  const errs = [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ['no es un objeto'];
  for (const k of Object.keys(v)) if (!['mode', 'from', 'until'].includes(k)) errs.push(`campo desconocido "${k}"`);
  if (!MODES.includes(v.mode)) errs.push('mode');
  for (const k of ['from', 'until']) if (v[k] !== undefined && !(typeof v[k] === 'string' && ISO.test(v[k]))) errs.push(k);
  if (!errs.length && v.from && v.until && Date.parse(v.until) <= Date.parse(v.from)) errs.push('until debe ser posterior a from');
  return errs;
}

export function isVisible(v = ALWAYS, now = Date.now()) {
  if (v.mode === 'show') return true;
  if (v.mode === 'hide') return false;
  if (v.from && now < Date.parse(v.from)) return false;
  if (v.until && now >= Date.parse(v.until)) return false;
  return true;
}

// Estado para la interfaz del profesional: 'visible', 'programada', 'caducada' u 'oculta'.
export function visibilityState(v = ALWAYS, now = Date.now()) {
  if (v.mode === 'show') return 'visible';
  if (v.mode === 'hide') return 'oculta';
  if (v.from && now < Date.parse(v.from)) return 'programada';
  if (v.until && now >= Date.parse(v.until)) return 'caducada';
  return 'visible';
}
