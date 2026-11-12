// Prueba de interfaz del envío y el seguimiento (Playwright; no forma parte de `npm test`).
// Usa un servidor LOCAL, nunca el de producción:
//   (cd ../server && PORT=3001 HOST=127.0.0.1 DATA_DIR=/tmp/pautas-e2e PUBLIC_URL=http://localhost:3001 npm start) &
//   VITE_SERVER_URL=http://localhost:3001 npx vite build --outDir dist-e2e
//   npx vite preview --outDir dist-e2e --port 4174 &
//   node test/e2e-envio.mjs <carpeta-capturas>
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { fetchPauta, sendRespuesta } from '../../server/public/api-client.js';
import { parseLink } from '../../server/public/pauta-crypto.js';

const out = process.argv[2] || '.', url = process.env.URL || 'http://localhost:4174/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
pg.on('console', m => m.type() === 'error' && !/status of 40[34]/.test(m.text()) && errs.push(m.text()));
const shot = n => pg.screenshot({ path: `${out}/${n}.png`, fullPage: true });
const ok = (cond, msg) => { console.log(cond ? 'ok ' : 'MAL', msg); if (!cond) process.exitCode = 1; };
const rejects = async (p, status) => { try { await p; return false; } catch (e) { return e.status === status; } };

// Nombre del profesional y una pauta con dos ejercicios.
await pg.goto(url + '#/ajustes'); await pg.waitForSelector('input[autocomplete=name]'); await pg.fill('input[autocomplete=name]', 'Ana Pérez'); await pg.press('input[autocomplete=name]', 'Tab'); await pg.waitForTimeout(200);
await pg.goto(url + '#/pro'); await pg.click('button:has-text("+ Nueva")'); await pg.waitForSelector('.titulo-pauta');
await pg.fill('.titulo-pauta', 'Hombro');
await pg.click('a:has-text("+ Añadir ejercicios")'); await pg.waitForSelector('.ficha-mini-sel');
await pg.click('.ficha-mini-sel >> nth=0'); await pg.click('.ficha-mini-sel >> nth=1'); await pg.click('.barra-sel .boton');
await pg.waitForSelector('.items');
await pg.click('a:has-text("Enviar al paciente")'); await pg.waitForSelector('h1:has-text("Enviar pauta")');
ok((await pg.textContent('.tarjeta')).includes('Firmada como Ana Pérez'), 'firma del profesional');
await pg.click('button:text-is("Enviar")'); await pg.waitForSelector('svg.qr');
const link = (await pg.textContent('.enlace-texto')).trim();
ok(/^http:\/\/localhost:3001\/p\/[A-Za-z0-9]+#[A-Za-z0-9_-]{43}$/.test(link), 'enlace corto: ' + link);
await shot('1-enviada');
let r = await fetchPauta(link);
ok(r.pauta.title === 'Hombro' && r.pauta.pro.name === 'Ana Pérez' && r.pauta.items.length === 2, 'el paciente descifra la pauta');

await pg.click('button:text-is("Copiar")'); await pg.waitForSelector('.aviso.ok');
ok((await pg.evaluate(() => navigator.clipboard.readText())) === link, 'enlace copiado');
const dl = pg.waitForEvent('download'); await pg.click('button:has-text("Compartir QR")');
ok((await (await dl).suggestedFilename()) === 'pauta-qr.png', 'QR como imagen');

// Cambiar la pauta: aparece «cambios sin enviar» y se actualiza con el mismo enlace.
await pg.click('.barra a[aria-label=Volver]'); await pg.waitForSelector('.titulo-pauta');
await pg.fill('.titulo-pauta', 'Hombro fase 2'); await pg.waitForTimeout(500);
ok((await pg.textContent('.acciones-envio')).includes('Cambios sin enviar'), 'cambios sin enviar');
await pg.click('a:has-text("Actualizar envío")'); await pg.click('button:has-text("Actualizar pauta enviada")'); await pg.waitForSelector('.aviso.ok');
r = await fetchPauta(link); ok(r.pauta.title === 'Hombro fase 2', 'actualizada con el mismo enlace');

// Visibilidad: oculta → el servidor no la entrega; programada → 403 con fecha; de nuevo visible.
await pg.click('.visibilidad label:has-text("Ocultar")'); await pg.click('button:has-text("Guardar cuándo puede verla")'); await pg.waitForSelector('.aviso.ok');
ok(await rejects(fetchPauta(link), 403), 'oculta: el servidor no la entrega');
await pg.click('.visibilidad label:has-text("A partir de un día")');
const manana = new Date(Date.now() + 86400000).toLocaleDateString('sv-SE');
await pg.fill('.visibilidad input[type=date] >> nth=0', manana);
await pg.click('button:has-text("Guardar cuándo puede verla")'); await pg.waitForSelector('.aviso.ok');
ok(await rejects(fetchPauta(link), 403), 'programada para mañana: aún no se entrega');
ok((await pg.textContent('.tarjeta')).includes('Disponible desde'), 'texto de visibilidad programada');
await pg.click('.visibilidad label:has-text("Disponible ya")'); await pg.click('button:has-text("Guardar cuándo puede verla")'); await pg.waitForSelector('.aviso.ok');
r = await fetchPauta(link); ok(r.pauta.items.length === 2, 'visible de nuevo');

// El paciente responde dos veces.
const { code, key } = parseLink(link);
await sendRespuesta('http://localhost:3001', code, key, { v: 1, kind: 'respuesta', at: new Date(Date.now() - 86400000).toISOString(), items: [{ i: 0, diff: 'bien', pain: 2 }, { i: 1, diff: 'dificil', pain: 5, note: 'Tira al subir' }] });
await sendRespuesta('http://localhost:3001', code, key, { v: 1, kind: 'respuesta', at: new Date().toISOString(), items: [{ i: 0, diff: 'facil', pain: 1 }, { i: 1, diff: 'dificil', pain: 7 }] });
await pg.goto(url + '#/pro'); await pg.reload(); await pg.waitForSelector('.fila-pauta');
await pg.waitForSelector('.fila-pauta .punto-nuevo', { timeout: 5000 });
ok((await pg.textContent('.fila-pauta .punto-nuevo')).includes('2 respuestas'), 'aviso de respuestas nuevas en Mis pautas');
await shot('2-lista');
await pg.click('.fila-pauta'); await pg.click('a:has-text("Respuestas")'); await pg.waitForSelector('.sesion-r');
ok((await pg.$$('.sesion-r')).length === 2, 'dos sesiones');
ok((await pg.textContent('.fila-resumen >> nth=1')).includes('↑ sube'), 'tendencia del dolor');
ok((await pg.textContent('.sesiones')).includes('Tira al subir'), 'nota del paciente');
await shot('3-respuestas');
await pg.click('.nav-pro a:has-text("Pautas")'); await pg.waitForSelector('.fila-pauta');
ok(!(await pg.$('.fila-pauta .punto-nuevo')), 'respuestas marcadas como vistas');

// Retirar el enlace.
await pg.click('.fila-pauta'); await pg.click('a:has-text("Ver envío")'); await pg.click('button:has-text("Retirar enlace")'); await pg.click('button:has-text("Sí, retirar")');
await pg.waitForSelector('h1:has-text("Enviar pauta")');
ok(await rejects(fetchPauta(link), 404), 'retirada: el enlace ya no funciona');
await shot('4-retirada');
console.log('errores:', errs); if (errs.length) process.exitCode = 1;
await b.close();
