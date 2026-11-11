// Cliente del servidor de pautas: el ÚNICO punto por el que la app y el visor hablan con él.
// El servidor es provisional; si cambia (otra API, otro proveedor), solo cambia este fichero.
//
// Todo se cifra aquí antes de salir: el servidor recibe bloques cifrados y la visibilidad.
// Las claves viven en el fragmento de los enlaces (#) y en el dispositivo del profesional.
import { newKey, seal, open, shortLink, longLink, parseLink } from './pauta-crypto.js';

export const API_VERSION = 'v1';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `HTTP ${status}`);
    this.status = status;
    this.body = body || {};
  }
}

const trim = base => base.replace(/\/+$/, '');

/** @param {string} base @param {string} method @param {string} path @param {{ token?: string, body?: any }} [opts] */
async function call(base, method, path, { token, body } = {}) {
  const res = await fetch(`${trim(base)}/api/${API_VERSION}${path}`, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// ---------- Pautas privadas ----------

// Publica una pauta. Devuelve lo que el profesional debe guardar en su dispositivo
// ({ link, code, token, key }). Sin conexión o si el servidor falla, devuelve el enlace largo
// ({ link, key, offline: true }), que funciona sin servidor pero no se puede actualizar.
/** @param {string} base @param {object} pauta @param {{ visibility?: object }} [opts] */
export async function publishPauta(base, pauta, { visibility } = {}) {
  const key = newKey();
  const blob = await seal(pauta, key);
  try {
    const { code, token } = await call(base, 'POST', '/p', { body: { blob, visibility } });
    return { link: shortLink(base, code, key), code, token, key };
  } catch (e) {
    if (e instanceof ApiError && e.status < 500 && e.status !== 429) throw e;
    return { link: longLink(base, key, blob), key, offline: true };
  }
}

// Sustituye la pauta y/o su visibilidad manteniendo el mismo enlace.
/** @param {string} base @param {{ code: string, token: string, key: string }} ref @param {object} pauta @param {{ visibility?: object }} [opts] */
export async function updatePauta(base, { code, token, key }, pauta, { visibility } = {}) {
  const body = {};
  if (pauta) body.blob = await seal(pauta, key);
  if (visibility !== undefined) body.visibility = visibility;
  return call(base, 'PUT', `/p/${code}`, { token, body });
}

export const deletePauta = (base, { code, token }) => call(base, 'DELETE', `/p/${code}`, { token });

// Abre una pauta desde su enlace (corto o largo). Con `token` (el profesional) la lee aunque
// aún no sea visible. Si no es visible lanza ApiError 403 con body.estado y body.desde.
/** @param {string} link @param {{ token?: string }} [opts] */
export async function fetchPauta(link, { token } = {}) {
  const parsed = parseLink(link);
  if (!parsed) throw new Error('enlace no válido');
  if (parsed.blob) return { pauta: await open(parsed.blob, parsed.key), key: parsed.key, offline: true };
  const base = new URL(link).origin;
  const data = await call(base, 'GET', `/p/${parsed.code}`, { token });
  return { pauta: await open(data.blob, parsed.key), code: parsed.code, key: parsed.key, updated: data.updated, visibility: data.visibility, estado: data.estado };
}

// ---------- Respuestas del paciente ----------

export async function sendRespuesta(base, code, key, respuesta) {
  return call(base, 'POST', `/p/${code}/r`, { body: { blob: await seal(respuesta, key) } });
}

export async function fetchRespuestas(base, { code, token, key }, after = 0) {
  const { items } = await call(base, 'GET', `/p/${code}/r?after=${after}`, { token });
  return Promise.all(items.map(async it => ({ id: it.id, at: it.at, respuesta: await open(it.blob, key) })));
}

// ---------- Canales públicos ----------

// meta: { name, center?, … } (cifrado). Devuelve { link, code, token, key } para el gimnasio.
export async function createCanal(base, meta) {
  const key = newKey();
  const { code, token } = await call(base, 'POST', '/c', { body: { blob: await seal(meta, key) } });
  return { link: `${trim(base)}/c/${code}#${key}`, code, token, key };
}

export async function updateCanal(base, { code, token, key }, meta) {
  return call(base, 'PUT', `/c/${code}`, { token, body: { blob: await seal(meta, key) } });
}

export const deleteCanal = (base, { code, token }) => call(base, 'DELETE', `/c/${code}`, { token });

export async function addSesion(base, { code, token, key }, pauta, visibility) {
  return call(base, 'POST', `/c/${code}/s`, { token, body: { blob: await seal(pauta, key), visibility } });
}

export async function updateSesion(base, { code, token, key }, id, pauta, visibility) {
  const body = {};
  if (pauta) body.blob = await seal(pauta, key);
  if (visibility !== undefined) body.visibility = visibility;
  return call(base, 'PUT', `/c/${code}/s/${id}`, { token, body });
}

export const deleteSesion = (base, { code, token }, id) => call(base, 'DELETE', `/c/${code}/s/${id}`, { token });

// Lee un canal desde su enlace: cabecera y sesiones visibles ahora. Con `token` (el
// gimnasio), todas con su visibilidad y estado.
/** @param {string} link @param {{ token?: string }} [opts] */
export async function fetchCanal(link, { token } = {}) {
  const url = new URL(link);
  const m = url.pathname.match(/^\/c\/([A-Za-z0-9]{8})\/?$/);
  const key = url.hash.slice(1);
  if (!m || !/^[A-Za-z0-9_-]{43}$/.test(key)) throw new Error('enlace de canal no válido');
  const data = await call(url.origin, 'GET', `/c/${m[1]}${token ? '?all=1' : ''}`, { token });
  return {
    code: m[1], key,
    meta: await open(data.blob, key),
    sesiones: await Promise.all(data.sesiones.map(async s => ({ id: s.id, updated: s.updated, visibility: s.visibility, estado: s.estado, pauta: await open(s.blob, key) }))),
  };
}
