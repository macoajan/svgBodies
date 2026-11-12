// Acceso a pacientes y pautas del profesional sobre el almacenamiento local.
// Las pantallas usan estas funciones y la señal `version`, que cambia con cada escritura para
// que se vuelvan a pintar.
import { signal } from '@preact/signals';
import { storage } from './app-store.js';

export const version = signal(0);
const bump = () => { version.value++; };
const now = () => new Date().toISOString();
const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

// ---------- Pacientes ----------
export const listPacientes = () => Object.values(storage.get('pacientes')).sort((a, b) => a.alias.localeCompare(b.alias, 'es'));
export const getPaciente = id => storage.get('pacientes')[id] || null;

/** @param {{ id?: string, alias: string, nota?: string }} p */
export async function savePaciente({ id, alias, nota = '' }) {
  const a = String(alias || '').trim().slice(0, 60);
  if (!a) throw new Error('El alias no puede estar vacío.');
  const pid = id || newId();
  await storage.update('pacientes', d => { d[pid] = { ...(d[pid] || { alta: now() }), id: pid, alias: a, nota: String(nota).slice(0, 500) }; });
  bump();
  return pid;
}

/** Borra el paciente y sus pautas locales. */
export async function deletePaciente(id) {
  await storage.update('pautas', d => { for (const [k, r] of Object.entries(d)) if (r.pacienteId === id) delete d[k]; });
  await storage.update('pacientes', d => { delete d[id]; });
  bump();
}

// ---------- Pautas ----------
export const listPautas = () => Object.values(storage.get('pautas'));
export const getPauta = id => storage.get('pautas')[id] || null;

export async function createPauta(pauta, pacienteId = null) {
  const id = newId();
  const t = now();
  await storage.update('pautas', d => { d[id] = { id, pacienteId, pauta, creada: t, editada: t, estado: 'borrador' }; });
  bump();
  return id;
}

/**
 * Guarda cambios de una pauta (contenido o paciente).
 * @param {string} id @param {{ pauta?: any, pacienteId?: string|null }} cambios
 */
export async function savePauta(id, { pauta, pacienteId }) {
  await storage.update('pautas', d => {
    if (!d[id]) return;
    if (pauta !== undefined) d[id].pauta = pauta;
    if (pacienteId !== undefined) d[id].pacienteId = pacienteId;
    d[id].editada = now();
  });
  bump();
}

export async function duplicatePauta(id) {
  const r = getPauta(id);
  if (!r) return null;
  return createPauta({ ...r.pauta, title: `${r.pauta.title || 'Pauta'} (copia)`.slice(0, 60) }, r.pacienteId);
}

export async function deletePauta(id) {
  await storage.update('pautas', d => { delete d[id]; });
  await storage.update('respuestas', d => { delete d[id]; });
  bump();
}

// ---------- Envío y respuestas ----------

/**
 * Guarda (o quita, con null) los datos del envío: { code, key, token, link, offline?, enviada,
 * huella, visibility }. La clave y el token solo existen en este dispositivo.
 * @param {string} id @param {object|null} envio
 */
export async function setEnvio(id, envio) {
  await storage.update('pautas', d => {
    if (!d[id]) return;
    if (envio) { d[id].envio = envio; d[id].estado = 'enviada'; } else { delete d[id].envio; d[id].estado = 'borrador'; }
  });
  bump();
}

/** Respuestas guardadas de una pauta: { after, items: [{ id, at, respuesta }], vistas }. */
export const getRespuestas = id => storage.get('respuestas')[id] || { after: 0, items: [], vistas: 0 };

/** Añade respuestas nuevas (sin duplicar por id). */
export async function addRespuestas(id, nuevas) {
  if (!nuevas.length) return;
  await storage.update('respuestas', d => {
    const r = d[id] || { after: 0, items: [], vistas: 0 };
    const ids = new Set(r.items.map(x => x.id));
    for (const n of nuevas) if (!ids.has(n.id)) r.items.push(n);
    r.items.sort((a, b) => a.id - b.id);
    r.after = Math.max(r.after, ...r.items.map(x => x.id));
    d[id] = r;
  });
  bump();
}

/** Marca como vistas todas las respuestas de la pauta. */
export async function marcarVistas(id) {
  const r = getRespuestas(id);
  if (r.vistas === r.items.length) return;
  await storage.update('respuestas', d => { d[id] = { ...r, vistas: r.items.length }; });
  bump();
}

export const nuevasRespuestas = id => { const r = getRespuestas(id); return r.items.length - r.vistas; };

// ---------- Plantillas (Pro) ----------
export const listPlantillas = () => Object.values(storage.get('plantillas')).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

export async function savePlantilla(pauta, nombre) {
  const id = newId();
  const n = String(nombre || pauta.title || 'Plantilla').trim().slice(0, 60) || 'Plantilla';
  await storage.update('plantillas', d => { d[id] = { id, nombre: n, pauta: structuredClone(pauta), creada: now() }; });
  bump();
  return id;
}

export async function deletePlantilla(id) {
  await storage.update('plantillas', d => { delete d[id]; });
  bump();
}

/** Nueva pauta a partir de una plantilla. */
export async function pautaDesdePlantilla(id, pacienteId = null) {
  const t = storage.get('plantillas')[id];
  if (!t) return null;
  return createPauta({ ...structuredClone(t.pauta), title: t.nombre }, pacienteId);
}
