// PROVISIONAL — servidor HTTP de pautas (acortador privado). Diseñado para poder sustituirse:
// la app solo habla con él a través de public/api-client.js y la API está versionada
// (/api/v1). Nunca recibe la clave de cifrado (va en el fragmento del enlace), así que solo
// ve bloques cifrados, la visibilidad (fechas y modo, en claro) y metadatos técnicos.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { checkVisibility, isVisible, visibilityState } from '../public/visibility.js';
import { createRateLimiter } from './ratelimit.mjs';

const DAY = 86_400_000;
const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const BLOB_RE = /^v1\.[A-Za-z0-9_-]+$/;
const CODE = '([A-Za-z0-9]{8})';
const PUBLIC_FILES = { 'viewer.html': 'text/html', 'viewer.js': 'text/javascript', 'viewer.css': 'text/css',
  'pauta-crypto.js': 'text/javascript', 'pauta-schema.js': 'text/javascript', 'visibility.js': 'text/javascript', 'api-client.js': 'text/javascript' };
const TYPES = { '.svg': 'image/svg+xml', '.json': 'application/json' };

const sha256 = s => createHash('sha256').update(s).digest('hex');
const newCode = () => Array.from(randomBytes(8), b => B62[b % 62]).join('');
const newToken = () => randomBytes(32).toString('base64url');

class HttpError extends Error {
  constructor(status, error, extra = {}) { super(error); this.status = status; this.body = { error, ...extra }; }
}

export function createApp(config, store, { now = () => Date.now() } = {}) {
  const limiter = createRateLimiter({ windowMs: 10 * 60_000, limits: { read: config.readLimit, write: config.writeLimit } });
  const expiry = t => t + config.ttlDays * DAY;
  const fileCache = new Map();

  const send = (res, status, body, headers = {}) => {
    const isBuf = Buffer.isBuffer(body) || typeof body === 'string';
    res.writeHead(status, { 'Content-Type': isBuf ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', ...headers });
    res.end(isBuf ? body : JSON.stringify(body));
  };

  // Lee el cuerpo JSON. Si excede el máximo, lo descarta sin guardarlo y responde 413 al final
  // (cortar la conexión a mitad de subida deja al cliente sin respuesta).
  const readBody = (req, max) => new Promise((resolve, reject) => {
    if (Number(req.headers['content-length']) > max) { req.resume(); req.on('end', () => reject(new HttpError(413, 'demasiado-grande'))); return; }
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size <= max) chunks.push(c);
    });
    req.on('end', () => {
      if (size > max) return reject(new HttpError(413, 'demasiado-grande'));
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new HttpError(400, 'json-no-valido')); }
    });
    req.on('error', reject);
  });

  const blobOf = (body, max) => {
    if (typeof body.blob !== 'string' || !BLOB_RE.test(body.blob)) throw new HttpError(400, 'bloque-no-valido');
    if (body.blob.length > max) throw new HttpError(413, 'demasiado-grande');
    return body.blob;
  };
  const visOf = body => {
    if (body.visibility === undefined || body.visibility === null) return undefined;
    const errs = checkVisibility(body.visibility);
    if (errs.length) throw new HttpError(400, 'visibilidad-no-valida', { detalles: errs });
    return { mode: body.visibility.mode, ...(body.visibility.from && { from: body.visibility.from }), ...(body.visibility.until && { until: body.visibility.until }) };
  };
  const hasToken = (req, hash) => {
    const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(req.headers.authorization || '');
    if (!m) return false;
    const a = Buffer.from(sha256(m[1]), 'hex'), b = Buffer.from(hash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const requireToken = (req, row) => { if (!hasToken(req, row.tokenHash)) throw new HttpError(401, 'token-no-valido'); };
  // Alargar la caducidad al leer, como mucho una vez al día.
  const touch = (row, fn) => { const t = now(); if (row.expires - t < config.ttlDays * DAY - DAY) fn(row.code, expiry(t)); };
  const hidden = v => { const s = visibilityState(v, now()); return new HttpError(403, 'no-visible', { estado: s, ...(s === 'programada' && { desde: v.from }) }); };

  // ---------------- API v1 ----------------
  const routes = [
    // Pautas privadas
    ['POST', /^\/api\/v1\/p$/, async req => {
      const body = await readBody(req, config.maxBlob + 2048);
      const blob = blobOf(body, config.maxBlob), visibility = visOf(body);
      const token = newToken(), t = now();
      for (let i = 0; ; i++) {
        const code = newCode();
        try { store.createPauta({ code, blob, tokenHash: sha256(token), visibility, now: t, expires: expiry(t) }); return [201, { code, token, url: `${config.publicUrl}/p/${code}` }]; }
        catch (e) { if (i > 4) throw e; }
      }
    }],
    ['GET', new RegExp(`^/api/v1/p/${CODE}$`), (req, code) => {
      const p = store.getPauta(code);
      if (!p) throw new HttpError(404, 'no-existe');
      const owner = hasToken(req, p.tokenHash);
      if (!owner && !isVisible(p.visibility, now())) throw hidden(p.visibility);
      touch(p, store.touchPauta);
      return [200, { blob: p.blob, updated: new Date(p.updated).toISOString(),
        ...(owner && { visibility: p.visibility ?? null, estado: visibilityState(p.visibility, now()) }) }];
    }],
    ['PUT', new RegExp(`^/api/v1/p/${CODE}$`), async (req, code) => {
      const p = store.getPauta(code);
      if (!p) throw new HttpError(404, 'no-existe');
      requireToken(req, p);
      const body = await readBody(req, config.maxBlob + 2048);
      const blob = body.blob === undefined ? p.blob : blobOf(body, config.maxBlob);
      const visibility = 'visibility' in body ? visOf(body) : p.visibility;
      const t = now();
      store.updatePauta({ code, blob, visibility, now: t, expires: expiry(t) });
      return [200, { ok: true }];
    }],
    ['DELETE', new RegExp(`^/api/v1/p/${CODE}$`), (req, code) => {
      const p = store.getPauta(code);
      if (!p) throw new HttpError(404, 'no-existe');
      requireToken(req, p);
      store.deletePauta(code);
      return [200, { ok: true }];
    }],
    // Respuestas del paciente
    ['POST', new RegExp(`^/api/v1/p/${CODE}/r$`), async (req, code) => {
      const p = store.getPauta(code);
      if (!p) throw new HttpError(404, 'no-existe');
      if (!isVisible(p.visibility, now())) throw hidden(p.visibility);
      const body = await readBody(req, config.maxResponse + 512);
      const blob = blobOf(body, config.maxResponse);
      if (store.countRespuestas(code) >= config.maxResponses) throw new HttpError(409, 'demasiadas-respuestas');
      return [201, { id: store.addRespuesta({ code, blob, now: now() }) }];
    }],
    ['GET', new RegExp(`^/api/v1/p/${CODE}/r$`), (req, code, url) => {
      const p = store.getPauta(code);
      if (!p) throw new HttpError(404, 'no-existe');
      requireToken(req, p);
      const after = Number.parseInt(url.searchParams.get('after') || '0', 10) || 0;
      return [200, { items: store.listRespuestas(code, after).map(r => ({ id: r.id, at: new Date(r.at).toISOString(), blob: r.blob })) }];
    }],
    // Canales públicos
    ['POST', /^\/api\/v1\/c$/, async req => {
      const body = await readBody(req, config.maxBlob + 2048);
      const blob = blobOf(body, config.maxBlob);
      const token = newToken(), t = now();
      for (let i = 0; ; i++) {
        const code = newCode();
        try { store.createCanal({ code, blob, tokenHash: sha256(token), now: t, expires: expiry(t) }); return [201, { code, token, url: `${config.publicUrl}/c/${code}` }]; }
        catch (e) { if (i > 4) throw e; }
      }
    }],
    ['GET', new RegExp(`^/api/v1/c/${CODE}$`), (req, code, url) => {
      const c = store.getCanal(code);
      if (!c) throw new HttpError(404, 'no-existe');
      const all = url.searchParams.get('all') === '1';
      if (all) requireToken(req, c);
      touch(c, store.touchCanal);
      const t = now();
      const sesiones = store.listSesiones(code)
        .filter(s => all || isVisible(s.visibility, t))
        .map(s => ({ id: s.id, blob: s.blob, updated: new Date(s.updated).toISOString(),
          ...(all && { visibility: s.visibility ?? null, estado: visibilityState(s.visibility, t) }) }));
      return [200, { blob: c.blob, sesiones }];
    }],
    ['PUT', new RegExp(`^/api/v1/c/${CODE}$`), async (req, code) => {
      const c = store.getCanal(code);
      if (!c) throw new HttpError(404, 'no-existe');
      requireToken(req, c);
      const blob = blobOf(await readBody(req, config.maxBlob + 2048), config.maxBlob);
      const t = now();
      store.updateCanal({ code, blob, now: t, expires: expiry(t) });
      return [200, { ok: true }];
    }],
    ['DELETE', new RegExp(`^/api/v1/c/${CODE}$`), (req, code) => {
      const c = store.getCanal(code);
      if (!c) throw new HttpError(404, 'no-existe');
      requireToken(req, c);
      store.deleteCanal(code);
      return [200, { ok: true }];
    }],
    ['POST', new RegExp(`^/api/v1/c/${CODE}/s$`), async (req, code) => {
      const c = store.getCanal(code);
      if (!c) throw new HttpError(404, 'no-existe');
      requireToken(req, c);
      const body = await readBody(req, config.maxBlob + 2048);
      const blob = blobOf(body, config.maxBlob), visibility = visOf(body);
      if (store.countSesiones(code) >= config.maxSesiones) throw new HttpError(409, 'demasiadas-sesiones');
      const t = now();
      const id = store.addSesion({ canal: code, blob, visibility, now: t });
      store.updateCanal({ code, blob: c.blob, now: t, expires: expiry(t) });
      return [201, { id }];
    }],
    ['PUT', new RegExp(`^/api/v1/c/${CODE}/s/(\\d{1,12})$`), async (req, code, url, id) => {
      const c = store.getCanal(code);
      if (!c) throw new HttpError(404, 'no-existe');
      requireToken(req, c);
      const s = store.getSesion(code, Number(id));
      if (!s) throw new HttpError(404, 'no-existe');
      const body = await readBody(req, config.maxBlob + 2048);
      const blob = body.blob === undefined ? s.blob : blobOf(body, config.maxBlob);
      const visibility = 'visibility' in body ? visOf(body) : s.visibility;
      store.updateSesion({ canal: code, id: s.id, blob, visibility, now: now() });
      return [200, { ok: true }];
    }],
    ['DELETE', new RegExp(`^/api/v1/c/${CODE}/s/(\\d{1,12})$`), (req, code, url, id) => {
      const c = store.getCanal(code);
      if (!c) throw new HttpError(404, 'no-existe');
      requireToken(req, c);
      if (!store.deleteSesion(code, Number(id))) throw new HttpError(404, 'no-existe');
      return [200, { ok: true }];
    }],
  ];

  // ---------------- Ficheros ----------------
  const cached = async (path, type) => {
    if (!fileCache.has(path)) fileCache.set(path, await readFile(path).then(b => ({ b, type })).catch(() => null));
    return fileCache.get(path);
  };
  const SEC = {
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  };
  const serveFile = async (res, path, type, cache, extra = {}) => {
    const f = await cached(path, type);
    if (!f) return send(res, 404, { error: 'no-existe' });
    const ct = f.type.startsWith('font/') ? f.type : `${f.type}; charset=utf-8`;
    res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': cache, ...extra });
    res.end(f.b);
  };
  const wellKnown = path => {
    if (path === '/.well-known/apple-app-site-association' && config.iosAppIds.length)
      return { applinks: { details: [{ appIDs: config.iosAppIds, components: [{ '/': '/p/*' }, { '/': '/c/*' }] }] } };
    if (path === '/.well-known/assetlinks.json' && config.androidPackage)
      return [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: config.androidPackage, sha256_cert_fingerprints: config.androidSha256 } }];
    return null;
  };

  return async function handle(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    try {
      if (path.startsWith('/api/')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'OPTIONS') {
          return send(res, 204, '', { 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' });
        }
        const ip = (config.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
        const wait = limiter.hit(ip, req.method === 'GET' ? 'read' : 'write');
        if (wait) throw new HttpError(429, 'demasiadas-peticiones', { reintentarEn: Math.ceil(wait / 1000) });
        for (const [method, re, fn] of routes) {
          const m = re.exec(path);
          if (!m) continue;
          if (method !== req.method) continue;
          const [status, body] = await fn(req, m[1], url, m[2]);
          return send(res, status, body);
        }
        throw new HttpError(routes.some(([, re]) => re.test(path)) ? 405 : 404, routes.some(([, re]) => re.test(path)) ? 'metodo-no-permitido' : 'no-existe');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'metodo-no-permitido' });
      if (path === '/healthz') return send(res, 200, { ok: true });
      const wk = wellKnown(path);
      if (wk) return send(res, 200, wk, { 'Cache-Control': 'public, max-age=3600' });
      if (/^\/(p|c)(\/[A-Za-z0-9]{8})?\/?$/.test(path)) return serveFile(res, join(config.publicDir, 'viewer.html'), 'text/html', 'no-cache', SEC);
      const pub = /^\/assets\/([a-z-]+\.(?:js|css|html))$/.exec(path);
      if (pub && PUBLIC_FILES[pub[1]]) return serveFile(res, join(config.publicDir, pub[1]), PUBLIC_FILES[pub[1]], 'public, max-age=300');
      if (path === '/assets/fonts/lexend-latin.woff2') return serveFile(res, join(config.publicDir, 'fonts', 'lexend-latin.woff2'), 'font/woff2', 'public, max-age=31536000, immutable');
      if (path === '/lib/catalog.json') return serveFile(res, join(config.libraryDir, 'catalog.json'), 'application/json', 'public, max-age=3600');
      const svg = /^\/lib\/svg\/([a-z0-9-]+\.svg)$/.exec(path);
      if (svg) return serveFile(res, join(config.libraryDir, 'svg', svg[1]), TYPES[extname(svg[1])], 'public, max-age=86400');
      return send(res, 404, { error: 'no-existe' });
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, e.body);
      console.error('error interno:', e.message);
      return send(res, 500, { error: 'error-interno' });
    }
  };
}
