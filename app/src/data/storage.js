// Almacenamiento local de la app: un documento JSON por colección, todo en memoria mientras la
// app está abierta y escrito en segundo plano (escrituras en serie por colección).
// Cada archivo guarda { v, data }; al abrir se aplican las migraciones pendientes en orden.
// El «backend» decide dónde se guarda: archivos (app nativa), IndexedDB (web) o memoria (pruebas).

import { MIGRATIONS } from './migraciones.js';

/** Colecciones y su valor inicial. */
export const DEFAULTS = Object.freeze({
  ajustes: () => ({ temaPro: 'A1', temaPaciente: 'C', nombre: '', centro: '', pesoKg: null, idioma: 'es' }),
  pacientes: () => ({}),   // id → { alias, nota, alta }
  pautas: () => ({}),      // id → { pauta, pacienteId, code?, key?, token?, publicada?, version }
  respuestas: () => ({}),  // pautaId → { after, items: [] }
  plantillas: () => ({}),  // id → pauta sin paciente (Pro)
  recibidas: () => ({}),   // code|hash → { link, pauta, progreso, enviadas }
  compra: () => ({ pro: false, comprobado: null }),
});
export const COLLECTIONS = Object.freeze(Object.keys(DEFAULTS));

export class StorageError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

/** Versión actual de una colección: 1 + número de migraciones definidas. */
export const latestVersion = (name, migrations = MIGRATIONS) => 1 + (migrations[name]?.length || 0);

/** Lleva { v, data } a la última versión. Devuelve { doc, migrated }. */
export function migrate(name, doc, migrations = MIGRATIONS) {
  const steps = migrations[name] || [];
  const latest = 1 + steps.length;
  if (!doc || typeof doc !== 'object' || !Number.isInteger(doc.v) || doc.v < 1) {
    throw new StorageError('corrupto', `colección ${name}: formato no válido`);
  }
  if (doc.v > latest) throw new StorageError('version-nueva', `colección ${name}: datos de una versión más nueva de la app (v${doc.v})`);
  let { v, data } = doc;
  const from = v;
  while (v < latest) { data = steps[v - 1](data); v++; }
  return { doc: { v, data }, migrated: v !== from };
}

/**
 * @param {{ backend: { read(name: string): Promise<string|null>, write(name: string, text: string): Promise<void>, remove(name: string): Promise<void> }, migrations?: object }} opts
 */
export function createStorage({ backend, migrations = MIGRATIONS }) {
  const mem = new Map();
  const queues = new Map();
  let opened = false;

  const persist = name => {
    const text = JSON.stringify({ v: latestVersion(name, migrations), data: mem.get(name) });
    const prev = queues.get(name) || Promise.resolve();
    const next = prev.catch(() => {}).then(() => backend.write(name, text));
    queues.set(name, next);
    return next;
  };

  const need = name => {
    if (!opened) throw new StorageError('cerrado', 'almacenamiento sin abrir');
    if (!mem.has(name)) throw new StorageError('coleccion', `colección desconocida: ${name}`);
  };

  return {
    async open() {
      for (const name of COLLECTIONS) {
        const text = await backend.read(name);
        if (text == null) { mem.set(name, DEFAULTS[name]()); continue; }
        let parsed;
        try { parsed = JSON.parse(text); } catch { throw new StorageError('corrupto', `colección ${name}: JSON no válido`); }
        const { doc, migrated } = migrate(name, parsed, migrations);
        mem.set(name, doc.data);
        if (migrated) await backend.write(name, JSON.stringify(doc));
      }
      opened = true;
      return this;
    },
    /** Copia del contenido (no se debe mutar lo que devuelve get: usar set/update). */
    get(name) { need(name); return structuredClone(mem.get(name)); },
    set(name, data) { need(name); mem.set(name, structuredClone(data)); return persist(name); },
    update(name, fn) { const d = this.get(name); const r = fn(d); return this.set(name, r === undefined ? d : r); },
    /** Espera a que terminen todas las escrituras pendientes. */
    async flush() { await Promise.all([...queues.values()].map(p => p.catch(() => {}))); },
    /** Borra todos los datos locales (opción de Ajustes). */
    async clear() {
      await this.flush();
      for (const name of COLLECTIONS) { await backend.remove(name); mem.set(name, DEFAULTS[name]()); }
    },
    /** Instantánea de todo, para la copia de seguridad (F5 la cifra). */
    snapshot() {
      need('ajustes');
      return { v: 1, collections: Object.fromEntries(COLLECTIONS.map(n => [n, { v: latestVersion(n, migrations), data: structuredClone(mem.get(n)) }])) };
    },
  };
}

/** Backend en memoria, para pruebas. */
export function memoryBackend(initial = {}) {
  const files = new Map(Object.entries(initial));
  return {
    files,
    async read(name) { return files.has(name) ? files.get(name) : null; },
    async write(name, text) { files.set(name, text); },
    async remove(name) { files.delete(name); },
  };
}

/**
 * Backend de archivos para la app nativa (@capacitor/filesystem, directorio Data, que el sistema
 * no vacía por falta de espacio). Escritura atómica: temporal y renombrado. Si al leer solo
 * existe el temporal (cierre a mitad de escritura), se recupera.
 */
export function fileBackend({ Filesystem, Directory, Encoding, dir = 'datos' }) {
  const opt = { directory: Directory.Data };
  const path = name => `${dir}/${name}.json`;
  const tmp = name => `${dir}/${name}.json.tmp`;
  const readOr = async p => {
    try { return (await Filesystem.readFile({ ...opt, path: p, encoding: Encoding.UTF8 })).data; } catch { return null; }
  };
  return {
    async read(name) {
      const main = await readOr(path(name));
      if (main != null) return /** @type {string} */ (main);
      return /** @type {string|null} */ (await readOr(tmp(name)));
    },
    async write(name, text) {
      await Filesystem.writeFile({ ...opt, path: tmp(name), data: text, encoding: Encoding.UTF8, recursive: true });
      try {
        await Filesystem.rename({ from: tmp(name), to: path(name), directory: Directory.Data, toDirectory: Directory.Data });
      } catch {
        // Algunas plataformas no sobrescriben al renombrar: se borra el destino y se reintenta.
        // Si falla entre medias, read() recupera el temporal.
        try { await Filesystem.deleteFile({ ...opt, path: path(name) }); } catch { /* no existía */ }
        await Filesystem.rename({ from: tmp(name), to: path(name), directory: Directory.Data, toDirectory: Directory.Data });
      }
    },
    async remove(name) {
      for (const p of [path(name), tmp(name)]) {
        try { await Filesystem.deleteFile({ ...opt, path: p }); } catch { /* no existía */ }
      }
    },
  };
}

/** Backend IndexedDB, solo para el navegador (desarrollo y pruebas de interfaz). */
export function indexedDbBackend(dbName = 'pautas') {
  let dbp;
  const db = () => dbp || (dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('archivos');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction('archivos', mode);
      const r = fn(t.objectStore('archivos'));
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error);
    });
  };
  return {
    async read(name) { const v = await tx('readonly', s => s.get(name)); return v ?? null; },
    async write(name, text) { await tx('readwrite', s => s.put(text, name)); },
    async remove(name) { await tx('readwrite', s => s.delete(name)); },
  };
}
