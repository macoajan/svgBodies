// Lógica pura del envío y el seguimiento: qué se envía, si hay cambios sin enviar, la visibilidad
// por fechas del formulario y el resumen de respuestas del paciente.
import { checkVisibility, visibilityState } from '@shared/visibility.js';
import { LIMITS } from '@shared/pauta-schema.js';

/** La pauta tal como la recibirá el paciente: con el nombre y el centro del profesional. */
export function pautaParaEnviar(pauta, ajustes = {}) {
  const p = structuredClone(pauta);
  const name = String(ajustes.nombre || '').trim().slice(0, LIMITS.proField);
  const center = String(ajustes.centro || '').trim().slice(0, LIMITS.proField);
  if (name || center) p.pro = { ...(name ? { name } : {}), ...(center ? { center } : {}) };
  else delete p.pro;
  if (!p.title) delete p.title;
  return p;
}

/** Huella estable del contenido (FNV-1a sobre JSON con claves ordenadas). */
export function huella(obj) {
  const stable = v => Array.isArray(v) ? `[${v.map(stable).join(',')}]`
    : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
    : JSON.stringify(v);
  let h = 0x811c9dc5;
  for (const ch of stable(obj)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/**
 * Estado del envío de una pauta guardada:
 * 'borrador' (nunca enviada), 'enviada', 'cambios' (editada después de enviar) o
 * 'sin-servidor' (se envió el enlace largo: funciona, pero no admite cambios ni respuestas).
 */
export function estadoEnvio(rec, ajustes) {
  const e = rec?.envio;
  if (!e) return 'borrador';
  if (e.offline) return 'sin-servidor';
  return huella(pautaParaEnviar(rec.pauta, ajustes)) === e.huella ? 'enviada' : 'cambios';
}

export const ESTADO_LABEL = Object.freeze({ borrador: 'Borrador', enviada: 'Enviada', cambios: 'Cambios sin enviar', 'sin-servidor': 'Enlace sin servidor' });

// ---------- Visibilidad desde el formulario ----------
// Formulario: { modo: 'ya' | 'desde' | 'oculta', desde?: 'AAAA-MM-DD', hasta?: 'AAAA-MM-DD' }.
// «hasta» es el último día visible (incluido): se envía como el inicio del día siguiente.

const pad = n => String(n).padStart(2, '0');
/** Medianoche local de un día 'AAAA-MM-DD' en ISO con la zona horaria del dispositivo. */
export function localMidnightISO(day, addDays = 0) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + addDays, 0, 0, 0);
  const off = -dt.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T00:00:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}
const dayOf = iso => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** Visibilidad del servidor a partir del formulario. Devuelve { visibility, error? }. */
export function formAVisibilidad(f) {
  if (f.modo === 'oculta') return { visibility: { mode: 'hide' } };
  const v = { mode: 'auto' };
  if (f.modo === 'desde') {
    if (!f.desde) return { visibility: null, error: 'Elige desde qué día estará disponible.' };
    v.from = localMidnightISO(f.desde);
  }
  if (f.hasta) v.until = localMidnightISO(f.hasta, 1);
  const errs = checkVisibility(v);
  if (errs.length) return { visibility: null, error: v.from && v.until ? 'La fecha de fin debe ser posterior a la de inicio.' : 'Revisa las fechas.' };
  return { visibility: v };
}

/** Formulario a partir de la visibilidad guardada. */
export function visibilidadAForm(v) {
  if (!v || v.mode === 'show') return { modo: 'ya' };
  if (v.mode === 'hide') return { modo: 'oculta' };
  const f = { modo: v.from ? 'desde' : 'ya' };
  if (v.from) f.desde = dayOf(v.from);
  if (v.until) f.hasta = dayOf(Date.parse(v.until) - 1);
  return f;
}

/** Texto para el profesional: «Visible», «Disponible desde el 24 de noviembre»… */
export function visibilidadTexto(v, now = Date.now()) {
  const fecha = iso => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  switch (visibilityState(v, now)) {
    case 'oculta': return 'Oculta para el paciente';
    case 'programada': return `Disponible desde el ${fecha(v.from)}`;
    case 'caducada': return 'Ya no está disponible (fecha de fin pasada)';
    default: return v?.until ? `Visible hasta el ${fecha(Date.parse(v.until) - 1)}` : 'Visible';
  }
}

// ---------- Respuestas ----------

export const DIFF_LABEL = Object.freeze({ facil: 'Fácil', bien: 'Bien', dificil: 'Difícil' });

/**
 * Resumen por ejercicio de todas las respuestas (en orden de llegada):
 * veces valorado, último dolor, dolor máximo, cuántas «difícil» y tendencia del dolor.
 */
export function resumenRespuestas(respuestas, nItems) {
  const out = Array.from({ length: nItems }, () => ({ veces: 0, dolores: [], dificil: 0, facil: 0, notas: 0 }));
  for (const r of respuestas) {
    for (const it of r.respuesta?.items || []) {
      const s = out[it.i];
      if (!s) continue;
      s.veces++;
      if (Number.isInteger(it.pain)) s.dolores.push(it.pain);
      if (it.diff === 'dificil') s.dificil++;
      if (it.diff === 'facil') s.facil++;
      if (it.note) s.notas++;
    }
  }
  return out.map(s => {
    const d = s.dolores;
    const ultimo = d.length ? d[d.length - 1] : null;
    const max = d.length ? Math.max(...d) : null;
    const tendencia = d.length >= 2 ? (d[d.length - 1] > d[d.length - 2] ? 'sube' : d[d.length - 1] < d[d.length - 2] ? 'baja' : 'igual') : null;
    return { veces: s.veces, ultimo, max, dificil: s.dificil, facil: s.facil, notas: s.notas, tendencia };
  });
}

/** Nivel de alerta de un dolor 0–10 (para el color): 'bajo' ≤3, 'medio' 4–6, 'alto' ≥7. */
export const nivelDolor = p => (p == null ? null : p >= 7 ? 'alto' : p >= 4 ? 'medio' : 'bajo');
