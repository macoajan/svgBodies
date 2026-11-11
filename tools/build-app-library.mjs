#!/usr/bin/env node
// Copia la biblioteca a app/public/lib/ para que la app funcione sin conexión.
// Misma fuente que el servidor (library/): catálogo, figuras, visor 3D y posturas partidas por
// ejercicio (poses/<id>.json, como /lib/poses/<id>.json del servidor). Escribe manifest.json con
// una huella del contenido; si no ha cambiado, no reescribe nada.
//   node tools/build-app-library.mjs [--src library] [--out app/public/lib] [--force]
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? resolve(process.argv[i + 1]) : def;
};

export async function buildAppLibrary({ src = join(root, 'library'), out = join(root, 'app/public/lib'), force = false } = {}) {
  const svgNames = (await readdir(join(src, 'svg'))).filter(n => n.endsWith('.svg')).sort();
  const files = new Map(); // ruta relativa → Buffer
  files.set('catalog.json', await readFile(join(src, 'catalog.json')));
  files.set('viewer.js', await readFile(join(src, 'viewer.js')));
  for (const n of svgNames) files.set(`svg/${n}`, await readFile(join(src, 'svg', n)));
  const poses = JSON.parse(await readFile(join(src, 'poses.json'), 'utf8'));
  for (const e of poses.exercises) files.set(`poses/${e.id}.json`, Buffer.from(JSON.stringify(e)));

  const hash = createHash('sha256');
  for (const [k, v] of [...files].sort(([a], [b]) => a.localeCompare(b))) hash.update(k).update(v);
  const version = hash.digest('hex').slice(0, 16);

  const catalog = JSON.parse(files.get('catalog.json'));
  const manifest = { version, exercises: catalog.exercises.length, poses: poses.exercises.length, svg: svgNames.length };

  if (!force) {
    try {
      const prev = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
      if (prev.version === version) return { ...manifest, written: false };
    } catch { /* no existe: se genera */ }
  }
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, 'svg'), { recursive: true });
  await mkdir(join(out, 'poses'), { recursive: true });
  for (const [k, v] of files) await writeFile(join(out, k), v);
  await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { ...manifest, written: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await buildAppLibrary({ src: arg('--src'), out: arg('--out'), force: process.argv.includes('--force') });
  console.log(`biblioteca ${r.version}: ${r.exercises} ejercicios, ${r.svg} figuras, ${r.poses} posturas${r.written ? '' : ' (sin cambios)'}`);
}
