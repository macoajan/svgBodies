// Prueba de humo de la interfaz con Playwright (no forma parte de `npm test`).
//   npm run build && npx vite preview --port 4173 &
//   node test/e2e-smoke.mjs <carpeta-capturas>   (LINK=<enlace de pauta> para probar la apertura)
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.', url = process.env.URL || 'http://localhost:4173/';
const link = process.env.LINK; // opcional: enlace real de una pauta para probar la apertura
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost' } });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
const shot = n => pg.screenshot({ path: `${out}/${n}.png` });
await pg.goto(url); await pg.waitForSelector('h1'); await shot('1-inicio');
console.log('tema inicio', await pg.evaluate(() => document.documentElement.dataset.theme));
await pg.click('text=Crear pautas'); await pg.waitForSelector('h1:has-text("Mis pautas")');
await pg.click('.nav-pro a:has-text("Catálogo")'); await pg.waitForSelector('.rejilla img');
await pg.waitForFunction(() => [...document.querySelectorAll('.rejilla img')].slice(0, 4).every(i => i.complete && i.naturalWidth > 0));
console.log('catálogo:', await pg.textContent('.recuento')); await shot('2-pro');
await pg.click('.nav-pro a:has-text("Ajustes")'); await pg.waitForSelector('text=Tema del profesional');
await pg.click('label.tema:has-text("Cercano noche")'); await pg.fill('input[autocomplete=name]', 'Ana Pérez'); await pg.press('input[autocomplete=name]', 'Tab');
await pg.waitForTimeout(200); await pg.reload(); await pg.waitForSelector('text=Tema del profesional');
console.log('tras recargar: tema', await pg.evaluate(() => document.documentElement.dataset.theme), 'nombre', await pg.inputValue('input[autocomplete=name]'));
await shot('3-ajustes');
await pg.goto(url + '#/paciente'); await pg.waitForSelector('text=Abre tu pauta');
await pg.waitForTimeout(100); console.log('tema paciente', await pg.evaluate(() => document.documentElement.dataset.theme));
await pg.fill('input[type=url]', 'https://example.com/x'); await pg.click('button[type=submit]');
console.log('inválido:', await pg.textContent('.aviso.error'));
if (link) {
  await pg.fill('input[type=url]', link); await pg.click('button[type=submit]');
  await pg.waitForSelector('section.tarjeta h2, .aviso.error', { timeout: 15000 });
  console.log('real:', (await pg.textContent('[aria-live]')).trim()); await shot('4-paciente');
}
await pg.goto(url + '#/nada'); console.log('404:', await pg.textContent('h1'));
console.log('errores:', errs);
if (errs.length) process.exitCode = 1;
await b.close();
