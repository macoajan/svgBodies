import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAppLibrary } from '../../tools/build-app-library.mjs';

test('build-app-library copia la biblioteca y parte las posturas', async () => {
  const out = await mkdtemp(join(tmpdir(), 'lib-'));
  try {
    const r = await buildAppLibrary({ out });
    assert.equal(r.written, true);
    const catalog = JSON.parse(await readFile(join(out, 'catalog.json'), 'utf8'));
    assert.equal(r.exercises, catalog.exercises.length);
    const poses = await readdir(join(out, 'poses'));
    assert.equal(poses.length, r.poses);
    // Toda figura citada por el catálogo existe, y cada ejercicio tiene posturas.
    const svgs = new Set(await readdir(join(out, 'svg')));
    for (const e of catalog.exercises) {
      for (const v of e.animation?.views || []) assert.ok(svgs.has(v.replace(/^svg\//, '')), v);
      assert.ok(poses.includes(`${e.id}.json`), e.id);
    }
    const one = JSON.parse(await readFile(join(out, 'poses', poses[0]), 'utf8'));
    assert.ok(one.id);
    assert.equal((await buildAppLibrary({ out })).written, false); // sin cambios: no reescribe
  } finally { await rm(out, { recursive: true, force: true }); }
});
