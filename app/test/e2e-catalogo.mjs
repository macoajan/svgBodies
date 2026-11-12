// Prueba de interfaz del catálogo y la ficha (Playwright; no forma parte de `npm test`).
//   npm run build && npx vite preview --port 4173 &   y luego   node test/e2e-catalogo.mjs <carpeta-capturas>
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.', url = process.env.URL || 'http://localhost:4173/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
const shot = n => pg.screenshot({ path: `${out}/${n}.png` });
const count = () => pg.textContent('.recuento');
await pg.goto(url + '#/pro'); await pg.click('a[href="#/pro/catalogo"]'); await pg.waitForSelector('.rejilla li');
console.log('todos:', await count());
await pg.fill('input[type=search]', 'puente'); await pg.waitForTimeout(400);
console.log('puente:', await count(), '| url', await pg.evaluate(() => location.hash));
await pg.fill('input[type=search]', ''); await pg.waitForTimeout(400);
await pg.click('.chip:has-text("Región")'); await pg.waitForSelector('dialog.hoja[open]');
await shot('2-hoja');
await pg.click('.opcion:has-text("Rodilla")'); console.log('boton hoja:', await pg.textContent('dialog .boton'));
await pg.click('dialog .boton'); await pg.waitForTimeout(200);
await pg.click('.chip:has-text("Nivel")'); await pg.click('.opcion:has-text("1 ·")'); await pg.click('dialog .boton'); await pg.waitForTimeout(200);
console.log('rodilla+n1:', await count(), '| url', await pg.evaluate(() => location.hash));
await shot('1-catalogo');
await pg.click('.chip:has-text("Material")'); await pg.waitForSelector('dialog.hoja[open]'); await shot('3-material'); await pg.keyboard.press('Escape');
await pg.click('.chip.activo:has-text("Nivel 1")'); await pg.waitForTimeout(200); console.log('quitar nivel:', await count());
await pg.evaluate(() => window.scrollTo(0, 300)); const y0 = await pg.evaluate(() => scrollY);
await pg.click('.ficha-mini >> nth=2'); await pg.waitForSelector('.h1-ej');
await pg.waitForSelector('.figura-svg svg'); console.log('ficha:', await pg.textContent('.h1-ej'), '| vistas', await pg.$$eval('.segmentos[aria-label=Vista] button', bs => bs.map(b => b.textContent).join('/')));
await shot('4-ficha');
await pg.evaluate(() => window.scrollTo(0, 700)); await shot('5-ficha-textos');
await pg.click('button[aria-label="Pausar animación"]');
console.log('pausada:', await pg.$eval('.figura-svg svg *:not(style):not(title)', el => getComputedStyle(el).animationPlayState).catch(() => 'sin animación'));
await pg.click('.segmentos button:has-text("3D")'); await pg.waitForFunction(() => document.querySelector('.figura-3d')?.querySelectorAll('*').length > 5, null, { timeout: 8000 });
await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300); await shot('6-3d');
const tabs = await pg.$('role=tab[name="Paciente"]'); if (tabs) { await tabs.click(); console.log('paciente:', (await pg.textContent('#panel-texto')).slice(0, 60)); }
await pg.click('.barra a[aria-label=Volver]'); await pg.waitForSelector('.rejilla li'); await pg.waitForTimeout(200);
console.log('vuelta:', await count(), '| url', await pg.evaluate(() => location.hash), '| scroll', y0, '->', await pg.evaluate(() => scrollY));
// tablet
await pg.setViewportSize({ width: 1194, height: 834 }); await pg.goto(url + '#/pro/ejercicio/puente-una-pierna'); await pg.waitForSelector('.figura-svg svg'); await pg.waitForTimeout(300); await shot('7-tablet-ficha');
await pg.goto(url + '#/pro/ejercicio/no-existe'); console.log('inexistente:', await pg.textContent('h1'));
console.log('errores:', errs);
if (errs.length) process.exitCode = 1;
await b.close();
