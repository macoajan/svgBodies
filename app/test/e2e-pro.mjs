// Prueba de interfaz de Pro, límites, plantillas, PDF, logo y copia de seguridad (Playwright).
//   npm run build && npx vite preview --port 4173 &   y luego   node test/e2e-pro.mjs <carpeta>
// En el navegador no hay tienda: «tener Pro» se simula escribiendo la caché de compra.
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const out = process.argv[2] || '.', url = process.env.URL || 'http://localhost:4173/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
const pg = await ctx.newPage();
// Las pautas «enviadas» del ejemplo son ficticias: ninguna petición sale al servidor real.
const REAL = 'https://pautas.maroto.es/';
await pg.route(REAL + '**', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
const errs = []; pg.on('pageerror', e => errs.push(e.message));
pg.on('console', m => m.type() === 'error' && !/status of 404/.test(m.text()) && errs.push(m.text()));
pg.on('response', r => r.status() >= 400 && !r.url().startsWith(REAL) && errs.push(`${r.status()} ${r.url()}`));
const shot = n => pg.screenshot({ path: `${out}/${n}.png` });
const ok = (cond, msg) => { console.log(cond ? 'ok ' : 'MAL', msg); if (!cond) process.exitCode = 1; };
const doc = data => ({ v: 1, data });
const seed = files => pg.evaluate(async files => new Promise((res, rej) => {
  const r = indexedDB.open('pautas', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('archivos');
  r.onsuccess = () => {
    const tx = r.result.transaction('archivos', 'readwrite');
    for (const [k, v] of Object.entries(files)) tx.objectStore('archivos').put(JSON.stringify(v), k);
    tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error);
  };
}), files);

const item = { id: 'plancha', sets: 3, hold: 30 };
const P = (id, pacienteId, enviada, title) => ({ id, pacienteId, pauta: { v: 1, kind: 'pauta', title, items: [item, { id: 'sentadilla-pared', sets: 3, reps: 3, hold: 20 }] }, creada: '2026-11-01', editada: '2026-11-0' + id.length, estado: enviada ? 'enviada' : 'borrador', ...(enviada ? { envio: { code: 'x' + id, key: 'k', token: 't', link: `https://ejemplo.invalid/p/x${id}#k`, huella: '0', visibility: { mode: 'auto' } } } : {}) });

await pg.goto(url + '#/pro'); await pg.waitForSelector('h1');
await seed({
  ajustes: doc({ temaPro: 'A1', temaPaciente: 'C', nombre: 'Ana Pérez', centro: 'Clínica Ejemplo', pesoKg: null, idioma: 'es' }),
  pacientes: doc({ p1: { id: 'p1', alias: 'Uno', nota: '' }, p2: { id: 'p2', alias: 'Dos', nota: '' }, p3: { id: 'p3', alias: 'Tres', nota: '' }, p4: { id: 'p4', alias: 'Cuatro', nota: '' } }),
  pautas: doc({ a: P('a', 'p1', true, 'A'), bb: P('bb', 'p2', true, 'B'), ccc: P('ccc', 'p3', true, 'C'), dddd: P('dddd', 'p4', false, 'Rodilla'), eeeee: P('eeeee', 'p1', false, 'Otra de Uno') }),
});
await pg.reload(); await pg.waitForSelector('.fila-pauta');
ok((await pg.textContent('main')).includes('3 de 3 pacientes con pauta activa'), 'uso del límite gratuito en Mis pautas');
ok((await pg.textContent('main')).includes('Guarda pautas como plantillas'), 'plantillas bloqueadas sin Pro');

await pg.goto(url + '#/pro/pauta/dddd/enviar'); await pg.waitForSelector('h1');
ok(!!(await pg.$('.bloqueo')) && !(await pg.$('button:text-is("Enviar")')), 'cuarto paciente: bloqueado');
await shot('1-limite');
await pg.goto(url + '#/pro/pauta/eeeee/enviar'); await pg.waitForSelector('h1');
ok(!!(await pg.$('button:text-is("Enviar")')), 'otra pauta de un paciente activo: se puede enviar');

await pg.click('.nav-pro a:has-text("Pautas")'); await pg.click('.bloqueo >> nth=0'); await pg.waitForSelector('h1:has-text("Pásate a Pro")');
ok((await pg.textContent('main')).includes('disponible en la app para iPhone'), 'pantalla Pro en el navegador');
await shot('2-pro');

// Con Pro: botón «Desbloquear» de pruebas (DESBLOQUEO_PRUEBAS).
await pg.click('button:text-is("Desbloquear")'); await pg.waitForSelector('h1:has-text("Tienes Pro")');
ok(true, 'desbloqueo de pruebas');
await pg.goto(url + '#/pro/pauta/dddd/enviar'); await pg.reload(); await pg.waitForSelector('h1');
ok(!!(await pg.$('button:text-is("Enviar")')), 'con Pro: sin límite');
await pg.goto(url + '#/pro/pauta/dddd'); await pg.waitForSelector('.items');
await pg.click('button:has-text("Guardar como plantilla")'); await pg.waitForSelector('text=Guardada como plantilla');
const dl = pg.waitForEvent('download'); await pg.click('button:text-is("PDF")');
const pdf = await dl; const pdfPath = await pdf.path();
const bytes = readFileSync(pdfPath);
ok(pdf.suggestedFilename() === 'rodilla.pdf' && bytes.subarray(0, 5).toString() === '%PDF-' && bytes.length > 10_000, `PDF ${pdf.suggestedFilename()} (${bytes.length} bytes)`);
await pdf.saveAs(`${out}/pauta.pdf`);
await pg.click('.nav-pro a:has-text("Pautas")'); await pg.waitForSelector('#pl-t');
ok((await pg.textContent('main')).includes('Rodilla') && !!(await pg.$('button:text-is("Usar")')), 'plantilla en Mis pautas');
await pg.click('button:text-is("Usar")'); await pg.waitForSelector('.items');
ok((await pg.$$('.items > li')).length === 2 && (await pg.inputValue('.titulo-pauta')) === 'Rodilla', 'pauta creada desde la plantilla');

// Logo.
await pg.click('.nav-pro a:has-text("Ajustes")'); await pg.waitForSelector('text=Logo');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGNgYGD4z8DAwMDAAAAMAAEDyzRnAAAAAElFTkSuQmCC', 'base64');
await pg.setInputFiles('input[type=file][accept="image/*"]', { name: 'logo.png', mimeType: 'image/png', buffer: png });
await pg.waitForSelector('img.logo-prev'); ok(true, 'logo guardado');

// Copia de seguridad: crear, borrar todo, restaurar.
await pg.fill('input[autocomplete=new-password] >> nth=0', 'frase de prueba'); await pg.fill('input[autocomplete=new-password] >> nth=1', 'frase de prueba');
const dl2 = pg.waitForEvent('download'); await pg.click('button:has-text("Crear copia")');
const copia = await dl2; const copiaTxt = readFileSync(await copia.path(), 'utf8');
ok(/^pautas-copia-\d{4}-\d\d-\d\d\.pautas$/.test(copia.suggestedFilename()) && !copiaTxt.includes('Cuatro') && copiaTxt.includes('"app":"pautas"'), 'copia cifrada descargada');
await shot('3-ajustes');
await pg.click('button:has-text("Borrar todos los datos")'); await pg.click('button:has-text("Sí, borrar todo")');
await pg.click('.nav-pro a:has-text("Pacientes")'); await pg.waitForSelector('h1'); ok(!(await pg.$('.fila-pauta')), 'datos borrados');
await pg.click('.nav-pro a:has-text("Ajustes")'); await pg.waitForSelector('text=Restaurar una copia');
await pg.setInputFiles('input[type=file][accept^=".pautas"]', { name: 'copia.pautas', mimeType: 'application/octet-stream', buffer: Buffer.from(copiaTxt) });
await pg.fill('input[autocomplete=current-password]', 'otra frase'); await pg.click('button:text-is("Restaurar")'); await pg.click('button:has-text("Sí, restaurar")');
await pg.waitForSelector('text=La frase no es correcta'); ok(true, 'frase incorrecta');
await pg.fill('input[autocomplete=current-password]', 'frase de prueba'); await pg.click('button:text-is("Restaurar")'); await pg.click('button:has-text("Sí, restaurar")');
await pg.waitForSelector('text=Datos restaurados');
ok(await pg.inputValue('input[autocomplete=name]') === 'Ana Pérez', 'ajustes restaurados');
await pg.click('.nav-pro a:has-text("Pacientes")'); await pg.waitForSelector('.fila-pauta'); await pg.waitForTimeout(200); const np = (await pg.$$('.fila-pauta')).length; ok(np === 4, 'pacientes restaurados: ' + np);
console.log('errores:', errs); if (errs.length) process.exitCode = 1;
await b.close();
