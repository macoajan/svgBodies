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
  bump();
}
