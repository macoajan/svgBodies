#!/usr/bin/env node
// Genera iconos y pantallas de inicio de iOS y Android a partir de resources/figura.svg.
// Usa Playwright (Chromium) para pasar el SVG a PNG. Para cambiar el icono: editar la figura o
// los colores de abajo y volver a ejecutar:  node tools/iconos.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONDO = '#14213D', SPLASH = '#FFFFFF';
const figura = readFileSync(join(app, 'resources/figura.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

// size: lado del PNG; escala: tamaño de la figura respecto al lado; forma: cuadrado, redondo, sin fondo.
const svg = ({ w, h = w, escala = 1, fondo = FONDO, forma = 'cuadrado' }) => {
  const lado = Math.min(w, h) * escala, x = (w - lado) / 2, y = (h - lado) / 2;
  const bg = forma === 'nada' ? '' : forma === 'redondo'
    ? `<circle cx="${w / 2}" cy="${h / 2}" r="${w / 2}" fill="${fondo}"/>`
    : forma === 'redondeado' ? `<rect width="${w}" height="${h}" rx="${w * 0.22}" fill="${fondo}"/>`
    : `<rect width="${w}" height="${h}" fill="${fondo}"/>`;
  const fig = fondo === SPLASH ? figura.replace(/#FFD2B3/g, FONDO).replace(/#D4FF3A/g, '#FF9A62') : figura;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}<g transform="translate(${x} ${y}) scale(${lado / 1024})">${fig}</g></svg>`;
};

const b = await chromium.launch();
const pg = await b.newPage();
async function png(file, opts) {
  const s = svg(opts);
  await pg.setViewportSize({ width: opts.w, height: opts.h ?? opts.w });
  await pg.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await pg.locator('svg').screenshot({ path: join(app, file), omitBackground: true });
}

// iOS: icono único de 1024 (sin transparencia; iOS redondea las esquinas) y pantalla de inicio.
await png('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', { w: 1024 });
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await png(`ios/App/App/Assets.xcassets/Splash.imageset/${f}`, { w: 2732, escala: 0.22, fondo: SPLASH });
}
// Android: iconos clásicos, redondos y capa delantera del icono adaptable (zona segura del 66 %).
const res = 'android/app/src/main/res';
for (const [d, px] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  await png(`${res}/mipmap-${d}/ic_launcher.png`, { w: px, forma: 'redondeado' });
  await png(`${res}/mipmap-${d}/ic_launcher_round.png`, { w: px, forma: 'redondo' });
  await png(`${res}/mipmap-${d}/ic_launcher_foreground.png`, { w: px * 2.25, escala: 0.62, forma: 'nada' });
}
// Android: pantalla de inicio (anterior a Android 12; desde 12 usa el icono sobre el color de fondo).
await png(`${res}/drawable/splash.png`, { w: 480, h: 320, escala: 0.5, fondo: SPLASH });
for (const [d, [w, h]] of Object.entries({ mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] })) {
  await png(`${res}/drawable-port-${d}/splash.png`, { w, h, escala: 0.35, fondo: SPLASH });
  await png(`${res}/drawable-land-${d}/splash.png`, { w: h, h: w, escala: 0.35, fondo: SPLASH });
}
writeFileSync(join(app, `${res}/values/ic_launcher_background.xml`), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${FONDO}</color>\n</resources>\n`);
await b.close();
console.log('iconos y pantallas de inicio generados');
