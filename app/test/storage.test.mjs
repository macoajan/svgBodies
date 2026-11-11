import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, memoryBackend, fileBackend, migrate, latestVersion, COLLECTIONS, StorageError } from '../src/data/storage.js';

test('abre con valores iniciales y guarda {v, data}', async () => {
  const backend = memoryBackend();
  const s = await createStorage({ backend }).open();
  assert.equal(s.get('ajustes').temaPro, 'A1');
  assert.deepEqual(s.get('pacientes'), {});
  await s.update('pacientes', d => { d.p1 = { alias: 'Ana' }; });
  await s.flush();
  assert.deepEqual(JSON.parse(backend.files.get('pacientes')), { v: 1, data: { p1: { alias: 'Ana' } } });
  // Una segunda instancia lee lo guardado.
  const s2 = await createStorage({ backend }).open();
  assert.equal(s2.get('pacientes').p1.alias, 'Ana');
});

test('get devuelve copias: mutarlas no cambia el almacén', async () => {
  const s = await createStorage({ backend: memoryBackend() }).open();
  const a = s.get('ajustes'); a.nombre = 'X';
  assert.equal(s.get('ajustes').nombre, '');
});

test('las escrituras de una colección se aplican en orden', async () => {
  const writes = [];
  const backend = memoryBackend();
  const slow = { ...backend, async write(n, t) { await new Promise(r => setTimeout(r, writes.length ? 1 : 10)); writes.push(t); backend.files.set(n, t); } };
  const s = await createStorage({ backend: slow }).open();
  s.set('compra', { pro: false, comprobado: 1 });
  s.set('compra', { pro: true, comprobado: 2 });
  await s.flush();
  assert.equal(JSON.parse(backend.files.get('compra')).data.pro, true);
});

test('migraciones: se aplican en orden y se reescribe el archivo', async () => {
  const migrations = { pacientes: [d => ({ ...d, a: 1 }), d => ({ ...d, b: d.a + 1 })] };
  assert.equal(latestVersion('pacientes', migrations), 3);
  const backend = memoryBackend({ pacientes: JSON.stringify({ v: 1, data: { x: 0 } }) });
  const s = await createStorage({ backend, migrations }).open();
  assert.deepEqual(s.get('pacientes'), { x: 0, a: 1, b: 2 });
  assert.equal(JSON.parse(backend.files.get('pacientes')).v, 3);
  assert.deepEqual(migrate('pacientes', { v: 2, data: { a: 5 } }, migrations).doc, { v: 3, data: { a: 5, b: 6 } });
});

test('datos de una versión más nueva o corruptos: error y sin escribir', async () => {
  const backend = memoryBackend({ ajustes: JSON.stringify({ v: 9, data: {} }) });
  await assert.rejects(createStorage({ backend }).open(), e => e instanceof StorageError && e.code === 'version-nueva');
  assert.equal(JSON.parse(backend.files.get('ajustes')).v, 9);
  await assert.rejects(createStorage({ backend: memoryBackend({ pautas: '{no' }) }).open(), { code: 'corrupto' });
});

test('clear borra todo y vuelve a los valores iniciales; snapshot incluye todas las colecciones', async () => {
  const backend = memoryBackend();
  const s = await createStorage({ backend }).open();
  await s.set('pacientes', { p: { alias: 'B' } });
  assert.deepEqual(Object.keys(s.snapshot().collections), COLLECTIONS);
  await s.clear();
  assert.deepEqual(s.get('pacientes'), {});
  assert.equal(backend.files.size, 0);
});

// Simula @capacitor/filesystem: rename falla si el destino existe (como en algunas plataformas).
function fakeFs() {
  const files = new Map();
  const nf = () => Object.assign(new Error('File does not exist'), { code: 'OS-PLUG-FILE-0008' });
  return {
    files,
    Directory: { Data: 'DATA' }, Encoding: { UTF8: 'utf8' },
    Filesystem: {
      async readFile({ path }) { if (!files.has(path)) throw nf(); return { data: files.get(path) }; },
      async writeFile({ path, data }) { files.set(path, data); return { uri: path }; },
      async deleteFile({ path }) { if (!files.delete(path)) throw nf(); },
      async rename({ from, to }) {
        if (!files.has(from)) throw nf();
        if (files.has(to)) throw new Error('destino existe');
        files.set(to, files.get(from)); files.delete(from);
      },
    },
  };
}

test('backend de archivos: escritura atómica, sobrescritura y recuperación del temporal', async () => {
  const fs = fakeFs();
  const b = fileBackend(fs);
  assert.equal(await b.read('pautas'), null);
  await b.write('pautas', 'uno');
  await b.write('pautas', 'dos');
  assert.equal(await b.read('pautas'), 'dos');
  assert.deepEqual([...fs.files.keys()], ['datos/pautas.json']);
  // Cierre entre borrar el destino y renombrar: solo queda el temporal.
  fs.files.delete('datos/pautas.json'); fs.files.set('datos/pautas.json.tmp', 'tres');
  assert.equal(await b.read('pautas'), 'tres');
  await b.remove('pautas');
  assert.equal(fs.files.size, 0);
});
