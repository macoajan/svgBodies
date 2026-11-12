// Envío de pautas al servidor PROVISIONAL (susceptible de cambio) y lectura de respuestas.
// Solo usa el cliente compartido (@shared/api-client.js) y guarda el resultado en local.
import { publishPauta, updatePauta, deletePauta as apiDelete, fetchRespuestas, ApiError } from '@shared/api-client.js';
import { SERVER_URL } from '../config.js';
import { ajustes } from './app-store.js';
import { getPauta, setEnvio, addRespuestas, listPautas, getRespuestas } from './repo.js';
import { pautaParaEnviar, huella } from '../domain/envio.js';

/** Mensaje claro para el profesional a partir de un error de red o del servidor. */
export function mensajeError(e) {
  if (e instanceof ApiError) {
    if (e.status === 404) return 'El enlace ya no existe en el servidor (caducado o retirado).';
    if (e.status === 413) return 'La pauta es demasiado grande para enviarla.';
    if (e.status === 429) return 'Demasiadas peticiones seguidas. Espera un minuto y vuelve a intentarlo.';
    if (e.status === 401 || e.status === 403) return 'El servidor no acepta los permisos de este dispositivo para esta pauta.';
    return `El servidor respondió con un error (${e.status}).`;
  }
  return 'No hay conexión con el servidor. Inténtalo de nuevo más tarde.';
}

/** Publica la pauta. Devuelve el envío guardado (offline: true si solo hay enlace largo). */
export async function enviar(id, visibility) {
  const rec = getPauta(id);
  const p = pautaParaEnviar(rec.pauta, ajustes.value);
  const r = await publishPauta(SERVER_URL, p, { visibility });
  const envio = { ...r, enviada: new Date().toISOString(), huella: huella(p), visibility: visibility || { mode: 'auto' } };
  await setEnvio(id, envio);
  return envio;
}

/**
 * Sustituye la pauta enviada por la actual (mismo enlace) y/o cambia su visibilidad.
 * @param {string} id @param {{ contenido?: boolean, visibility?: object }} [opts]
 */
export async function actualizar(id, { contenido = true, visibility } = {}) {
  const rec = getPauta(id);
  const e = rec.envio;
  const p = pautaParaEnviar(rec.pauta, ajustes.value);
  await updatePauta(SERVER_URL, e, contenido ? p : null, { visibility });
  await setEnvio(id, {
    ...e,
    ...(contenido ? { huella: huella(p), enviada: new Date().toISOString() } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
  });
}

/** Retira el enlace del servidor (si ya no existe, también vale) y deja la pauta como borrador. */
export async function retirar(id) {
  const e = getPauta(id)?.envio;
  if (e && !e.offline) {
    try { await apiDelete(SERVER_URL, e); } catch (err) { if (!(err instanceof ApiError && err.status === 404)) throw err; }
  }
  await setEnvio(id, null);
}

/** Descarga las respuestas nuevas. Devuelve cuántas han llegado. */
export async function leerRespuestas(id) {
  const rec = getPauta(id);
  const e = rec?.envio;
  if (!e || e.offline) return 0;
  const nuevas = await fetchRespuestas(SERVER_URL, e, getRespuestas(id).after);
  await addRespuestas(id, nuevas);
  return nuevas.length;
}

let ultima = 0;
/** Comprueba respuestas de todas las pautas enviadas, como mucho cada `cadaMs`. */
export async function leerTodas({ cadaMs = 5 * 60_000, now = Date.now() } = {}) {
  if (now - ultima < cadaMs) return 0;
  ultima = now;
  let total = 0;
  for (const r of listPautas().filter(r => r.envio && !r.envio.offline)) {
    try { total += await leerRespuestas(r.id); } catch { /* sin red o caducada: se verá al abrirla */ }
  }
  return total;
}
