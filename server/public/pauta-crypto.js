// Cifrado de pautas y respuestas, compartido por el visor web, la app y las pruebas.
//
// Formato v1: JSON → UTF-8 → deflate-raw → AES-GCM 256 (IV aleatorio de 12 bytes)
// → "v1." + base64url(IV ‖ texto cifrado). La clave (32 bytes, base64url) viaja
// solo en el fragmento del enlace (tras #), que el navegador nunca envía al servidor.
//
// Enlaces:
//   corto  <base>/p/<código>#<clave>        el bloque cifrado está en el servidor
//   largo  <base>/p#<clave>.<bloque>        alternativa sin servidor (sin conexión)
//
// Sin dependencias: WebCrypto, CompressionStream, Blob y Response existen en los
// navegadores actuales y en Node ≥ 22.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64u = {
  encode(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str) {
    if (!/^[A-Za-z0-9_-]*$/.test(str)) throw new Error('base64url no válido');
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  },
};

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

async function importKey(key) {
  const raw = b64u.decode(key);
  if (raw.length !== 32) throw new Error('clave no válida');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function newKey() {
  return b64u.encode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function seal(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await pipe(enc.encode(JSON.stringify(obj)), new CompressionStream('deflate-raw'));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(key), data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return 'v1.' + b64u.encode(out);
}

export async function open(blob, key) {
  if (typeof blob !== 'string' || !blob.startsWith('v1.')) throw new Error('formato desconocido');
  const raw = b64u.decode(blob.slice(3));
  if (raw.length < 13) throw new Error('bloque demasiado corto');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, await importKey(key), raw.subarray(12));
  return JSON.parse(dec.decode(await pipe(new Uint8Array(pt), new DecompressionStream('deflate-raw'))));
}

const trimBase = base => base.replace(/\/+$/, '');

export function shortLink(base, code, key) {
  return `${trimBase(base)}/p/${code}#${key}`;
}

export function longLink(base, key, blob) {
  return `${trimBase(base)}/p#${key}.${blob}`;
}

// Devuelve { code, key } para un enlace corto o { key, blob } para uno largo; null si no lo es.
export function parseLink(href) {
  const url = new URL(href);
  const frag = url.hash.slice(1);
  if (!frag) return null;
  const m = url.pathname.match(/^\/p\/([A-Za-z0-9]{6,16})\/?$/);
  if (m) return /^[A-Za-z0-9_-]{43}$/.test(frag) ? { code: m[1], key: frag } : null;
  if (/^\/p\/?$/.test(url.pathname)) {
    const dot = frag.indexOf('.');
    if (dot !== 43) return null;
    return { key: frag.slice(0, dot), blob: frag.slice(dot + 1) };
  }
  return null;
}
