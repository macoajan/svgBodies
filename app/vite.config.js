import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Los módulos compartidos con el servidor y el visor web viven en server/public/ (una sola copia).
// Si el servidor provisional se sustituye, se mueven a shared/ y solo cambia este alias.
const shared = fileURLToPath(new URL('../server/public', import.meta.url));

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [preact()],
  resolve: { alias: { '@shared': shared } },
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
});
