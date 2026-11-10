// PROVISIONAL — almacenamiento del servidor de pautas.
//
// El resto del servidor solo usa la interfaz de `openStore()`; cambiar de motor (otra base
// de datos, un servicio gestionado…) consiste en escribir otra implementación con los mismos
// métodos. Lo guardado son bloques cifrados que el servidor no puede leer, resúmenes SHA-256
// de los tokens de edición, la visibilidad (en claro) y fechas.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pautas (
  code TEXT PRIMARY KEY, blob TEXT NOT NULL, token_hash TEXT NOT NULL, visibility TEXT,
  created INTEGER NOT NULL, updated INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, blob TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS respuestas_code ON respuestas (code, id);
CREATE TABLE IF NOT EXISTS canales (
  code TEXT PRIMARY KEY, blob TEXT NOT NULL, token_hash TEXT NOT NULL,
  created INTEGER NOT NULL, updated INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT, canal TEXT NOT NULL, blob TEXT NOT NULL, visibility TEXT,
  created INTEGER NOT NULL, updated INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sesiones_canal ON sesiones (canal, id);
`;

const parseVis = s => (s ? JSON.parse(s) : undefined);
const pautaRow = r => r && { code: r.code, blob: r.blob, tokenHash: r.token_hash, visibility: parseVis(r.visibility), created: r.created, updated: r.updated, expires: r.expires };
const canalRow = r => r && { code: r.code, blob: r.blob, tokenHash: r.token_hash, created: r.created, updated: r.updated, expires: r.expires };
const sesionRow = r => r && { id: r.id, canal: r.canal, blob: r.blob, visibility: parseVis(r.visibility), created: r.created, updated: r.updated };

export function openStore(dataDir) {
  let file = ':memory:';
  if (dataDir !== ':memory:') {
    mkdirSync(dataDir, { recursive: true });
    file = join(dataDir, 'pautas.sqlite');
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  const q = sql => db.prepare(sql);
  const st = {
    pautaIns: q('INSERT INTO pautas (code, blob, token_hash, visibility, created, updated, expires) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    pautaGet: q('SELECT * FROM pautas WHERE code = ?'),
    pautaUpd: q('UPDATE pautas SET blob = ?, visibility = ?, updated = ?, expires = ? WHERE code = ?'),
    pautaTouch: q('UPDATE pautas SET expires = ? WHERE code = ?'),
    pautaDel: q('DELETE FROM pautas WHERE code = ?'),
    respIns: q('INSERT INTO respuestas (code, blob, at) VALUES (?, ?, ?)'),
    respCount: q('SELECT COUNT(*) AS n FROM respuestas WHERE code = ?'),
    respList: q('SELECT id, blob, at FROM respuestas WHERE code = ? AND id > ? ORDER BY id LIMIT ?'),
    respDel: q('DELETE FROM respuestas WHERE code = ?'),
    canalIns: q('INSERT INTO canales (code, blob, token_hash, created, updated, expires) VALUES (?, ?, ?, ?, ?, ?)'),
    canalGet: q('SELECT * FROM canales WHERE code = ?'),
    canalUpd: q('UPDATE canales SET blob = ?, updated = ?, expires = ? WHERE code = ?'),
    canalTouch: q('UPDATE canales SET expires = ? WHERE code = ?'),
    canalDel: q('DELETE FROM canales WHERE code = ?'),
    sesIns: q('INSERT INTO sesiones (canal, blob, visibility, created, updated) VALUES (?, ?, ?, ?, ?)'),
    sesGet: q('SELECT * FROM sesiones WHERE canal = ? AND id = ?'),
    sesUpd: q('UPDATE sesiones SET blob = ?, visibility = ?, updated = ? WHERE canal = ? AND id = ?'),
    sesDel: q('DELETE FROM sesiones WHERE canal = ? AND id = ?'),
    sesDelCanal: q('DELETE FROM sesiones WHERE canal = ?'),
    sesList: q('SELECT * FROM sesiones WHERE canal = ? ORDER BY id'),
    sesCount: q('SELECT COUNT(*) AS n FROM sesiones WHERE canal = ?'),
    expPautas: q('SELECT code FROM pautas WHERE expires < ?'),
    expCanales: q('SELECT code FROM canales WHERE expires < ?'),
  };
  const tx = fn => (...args) => {
    db.exec('BEGIN');
    try { const r = fn(...args); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  const vis = v => (v ? JSON.stringify(v) : null);
  const removePauta = code => { st.respDel.run(code); return st.pautaDel.run(code).changes > 0; };
  const removeCanal = code => { st.sesDelCanal.run(code); return st.canalDel.run(code).changes > 0; };

  return {
    // Pautas privadas
    createPauta: ({ code, blob, tokenHash, visibility, now, expires }) => st.pautaIns.run(code, blob, tokenHash, vis(visibility), now, now, expires),
    getPauta: code => pautaRow(st.pautaGet.get(code)),
    updatePauta: ({ code, blob, visibility, now, expires }) => st.pautaUpd.run(blob, vis(visibility), now, expires, code).changes > 0,
    touchPauta: (code, expires) => st.pautaTouch.run(expires, code),
    deletePauta: tx(removePauta),
    // Respuestas del paciente
    addRespuesta: ({ code, blob, now }) => Number(st.respIns.run(code, blob, now).lastInsertRowid),
    countRespuestas: code => st.respCount.get(code).n,
    listRespuestas: (code, after = 0, limit = 200) => st.respList.all(code, after, limit).map(r => ({ id: r.id, blob: r.blob, at: r.at })),
    // Canales públicos y sus sesiones
    createCanal: ({ code, blob, tokenHash, now, expires }) => st.canalIns.run(code, blob, tokenHash, now, now, expires),
    getCanal: code => canalRow(st.canalGet.get(code)),
    updateCanal: ({ code, blob, now, expires }) => st.canalUpd.run(blob, now, expires, code).changes > 0,
    touchCanal: (code, expires) => st.canalTouch.run(expires, code),
    deleteCanal: tx(removeCanal),
    addSesion: ({ canal, blob, visibility, now }) => Number(st.sesIns.run(canal, blob, vis(visibility), now, now).lastInsertRowid),
    getSesion: (canal, id) => sesionRow(st.sesGet.get(canal, id)),
    updateSesion: ({ canal, id, blob, visibility, now }) => st.sesUpd.run(blob, vis(visibility), now, canal, id).changes > 0,
    deleteSesion: (canal, id) => st.sesDel.run(canal, id).changes > 0,
    listSesiones: canal => st.sesList.all(canal).map(sesionRow),
    countSesiones: canal => st.sesCount.get(canal).n,
    // Mantenimiento: borra lo caducado (con sus respuestas o sesiones).
    purgeExpired: tx(now => {
      let n = 0;
      for (const { code } of st.expPautas.all(now)) n += removePauta(code) ? 1 : 0;
      for (const { code } of st.expCanales.all(now)) n += removeCanal(code) ? 1 : 0;
      return n;
    }),
    close: () => db.close(),
  };
}
