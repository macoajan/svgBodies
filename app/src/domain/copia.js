// Copia de seguridad cifrada con una frase de paso: PBKDF2-SHA256 → AES-GCM 256 (WebCrypto).
// Formato del archivo .pautas: { app: 'pautas', v: 1, kdf: { iter, salt }, iv, ct } (base64url).
// Contiene la instantánea del almacenamiento (incluidas claves y tokens de las pautas enviadas).
import { b64u } from '@shared/pauta-crypto.js';

export const ITER = 310_000;
const enc = new TextEncoder(), dec = new TextDecoder();

async function derive(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function cifrarCopia(snapshot, pass, { iter = ITER } = {}) {
  if (String(pass).length < 8) throw new Error('La frase debe tener al menos 8 caracteres.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(pass, salt, iter);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify({ at: new Date().toISOString(), snapshot }))));
  return JSON.stringify({ app: 'pautas', v: 1, kdf: { iter, salt: b64u.encode(salt) }, iv: b64u.encode(iv), ct: b64u.encode(ct) });
}

/** Devuelve { at, snapshot }. Lanza Error con mensaje claro si la frase o el archivo no valen. */
export async function descifrarCopia(texto, pass) {
  let f;
  try { f = JSON.parse(texto); } catch { throw new Error('El archivo no es una copia de seguridad de la app.'); }
  if (f?.app !== 'pautas' || f.v !== 1 || !f.kdf || !f.iv || !f.ct) throw new Error('El archivo no es una copia de seguridad de la app.');
  const key = await derive(pass, b64u.decode(f.kdf.salt), f.kdf.iter);
  let plain;
  try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64u.decode(f.iv) }, key, b64u.decode(f.ct)); }
  catch { throw new Error('La frase no es correcta.'); }
  return JSON.parse(dec.decode(plain));
}
