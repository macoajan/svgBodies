// Pautas recibidas por el paciente: copia local de la pauta, sesión en curso, sesiones hechas y
// cola de respuestas pendientes de enviar (sin red se reintenta más tarde).
import { signal } from '@preact/signals';
import { fetchPauta, sendRespuesta, ApiError } from '@shared/api-client.js';
import { parseLink } from '@shared/pauta-crypto.js';
import { storage } from './app-store.js';
import { huella } from '../domain/envio.js';

export const versionRecibidas = signal(0);
const bump = () => { versionRecibidas.value++; };
const now = () => new Date().toISOString();

/** Clave local de un enlace: el código corto, o una huella del enlace largo. */
export function claveDe(link) {
  const p = parseLink(link);
  if (!p) return null;
  return p.code ? p.code : `L${huella(link)}`;
}

export const listRecibidas = () => Object.entries(storage.get('recibidas')).map(([clave, r]) => ({ clave, ...r }))
  .sort((a, b) => String(b.usada || b.abierta).localeCompare(String(a.usada || a.abierta)));
export const getRecibida = clave => storage.get('recibidas')[clave] || null;

const update = async (clave, fn) => { await storage.update('recibidas', d => { if (d[clave]) fn(d[clave]); }); bump(); };

/**
 * Abre un enlace: descarga y descifra la pauta y la guarda. Devuelve la clave local.
 * Lanza ApiError 403 (aún no visible: body.estado, body.desde) o 404 (no existe).
 */
export async function abrirEnlace(link) {
  const clave = claveDe(link);
  if (!clave) throw new Error('enlace no válido');
  const r = await fetchPauta(link);
  await storage.update('recibidas', d => {
    const prev = d[clave] || { abierta: now(), sesiones: [], sesion: null };
    d[clave] = { ...prev, link, pauta: r.pauta, actualizada: now(), offline: !!r.offline, retirada: false };
  });
  bump();
  return clave;
}

/** Vuelve a descargar la pauta (puede haberla cambiado el profesional). Devuelve 'ok' | 'retirada' | 'oculta' | 'sin-red'. */
export async function refrescar(clave) {
  const rec = getRecibida(clave);
  if (!rec || rec.offline) return 'ok';
  try {
    const r = await fetchPauta(rec.link);
    const cambio = huella(r.pauta) !== huella(rec.pauta);
    await update(clave, d => { d.pauta = r.pauta; d.actualizada = now(); d.retirada = false; d.oculta = false; if (cambio && d.sesion) d.sesion = null; });
    return 'ok';
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) { await update(clave, d => { d.retirada = true; }); return 'retirada'; }
    if (e instanceof ApiError && e.status === 403) { await update(clave, d => { d.oculta = true; d.desde = e.body?.desde || null; }); return 'oculta'; }
    return 'sin-red';
  }
}

export const guardarSesion = (clave, sesion) => update(clave, d => { d.sesion = sesion; d.usada = now(); });

/** Cierra la sesión: la guarda en el historial y envía la respuesta (o la deja en cola). */
export async function terminarSesion(clave, respuesta) {
  await update(clave, d => {
    d.sesion = null;
    d.sesiones = [...(d.sesiones || []), { at: respuesta.at, respuesta, enviada: false }];
    d.usada = now();
  });
  return enviarPendientes(clave);
}

/** Envía las respuestas pendientes de una pauta. Devuelve cuántas quedan sin enviar. */
export async function enviarPendientes(clave) {
  const rec = getRecibida(clave);
  if (!rec) return 0;
  const p = parseLink(rec.link);
  if (!p?.code) return 0; // enlace largo: no hay servidor al que enviar
  let quedan = 0;
  for (const [n, s] of (rec.sesiones || []).entries()) {
    if (s.enviada || !s.respuesta.items.length) continue;
    try {
      await sendRespuesta(new URL(rec.link).origin, p.code, p.key, s.respuesta);
      await update(clave, d => { d.sesiones[n].enviada = true; });
    } catch (e) {
      // 404: la pauta ya no existe; 409: demasiadas respuestas. No tiene sentido reintentar.
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) await update(clave, d => { d.sesiones[n].enviada = 'descartada'; });
      else quedan++;
    }
  }
  return quedan;
}

/** Reintenta la cola de todas las pautas (al abrir la app o el lado del paciente). */
export async function enviarTodasPendientes() {
  let quedan = 0;
  for (const r of listRecibidas()) quedan += await enviarPendientes(r.clave);
  return quedan;
}

export const pendientes = clave => (getRecibida(clave)?.sesiones || []).filter(s => s.enviada === false && s.respuesta.items.length).length;

/** Sesiones hechas hoy (fecha local). */
export function hechasHoy(clave) {
  const hoy = new Date().toDateString();
  return (getRecibida(clave)?.sesiones || []).filter(s => new Date(s.at).toDateString() === hoy).length;
}

export async function borrarRecibida(clave) {
  await storage.update('recibidas', d => { delete d[clave]; });
  bump();
}
