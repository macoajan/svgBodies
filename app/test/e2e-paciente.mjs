// Prueba de interfaz del lado del paciente (Playwright; no forma parte de `npm test`).
// Usa un servidor LOCAL, como test/e2e-envio.mjs (mismas instrucciones, puerto 3001 y app en 4174).
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { publishPauta, fetchRespuestas } from '../../server/public/api-client.js';

const out = process.argv[2] || '.', url = process.env.URL || 'http://localhost:4174/', api = process.env.API || 'http://localhost:3001';
const pauta = {
  v: 1, kind: 'pauta', title: 'Rodilla', pro: { name: 'Ana Pérez', center: 'Clínica Ejemplo' }, note: 'Si molesta, baja menos.',
  schedule: { perWeek: 7, weeks: 2 }, restBetween: 30, show: { kcal: true },
  items: [
    { id: 'sentadilla-pared', sets: 2, reps: 2, hold: 2, restRep: 1, restSet: 20, note: 'Rodilla a 60°' },
    { id: 'puente-una-pierna', sets: 1, reps: 10, perSide: true, restSide: 10 },
  ],
};
const pub = await publishPauta(api, pauta);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
pg.on('console', m => m.type() === 'error' && !/status of 40[34]|ERR_FAILED/.test(m.text()) && errs.push(m.text()));
const shot = n => pg.screenshot({ path: `${out}/${n}.png` });
const ok = (cond, msg) => { console.log(cond ? 'ok ' : 'MAL', msg); if (!cond) process.exitCode = 1; };
const paso = () => pg.evaluate(() => document.querySelector('.etiqueta-paso, .h1-sesion, .sesion-cuerpo h1')?.textContent || '');

// Abrir el enlace.
await pg.goto(url + '#/paciente'); await pg.fill('input[type=url]', pub.link); await pg.click('button[type=submit]');
await pg.waitForSelector('a.boton.grande');
ok((await pg.textContent('h1')) === 'Hoy te tocan 2 ejercicios', 'pauta recibida');
ok((await pg.textContent('.pro')).includes('Ana Pérez') && (await pg.textContent('.mensaje')).includes('baja menos'), 'profesional y mensaje');
ok((await pg.textContent('.apagado')).includes('kcal'), 'calorías visibles (show.kcal)');
ok((await pg.evaluate(() => document.documentElement.dataset.theme)) === 'C', 'tema del paciente');
await shot('1-recibida');

// Sesión: preparar → aguantes con tiempo → pausa entre repeticiones.
await pg.click('a.boton.grande'); await pg.waitForSelector('.sesion-cab'); await pg.waitForSelector('.figura-svg svg');
ok((await paso()).includes('Sentadilla'), 'preparar: ' + await paso()); await shot('2-preparar');
await pg.click('button:has-text("Empezar")'); await pg.waitForSelector('.aguante');
ok((await pg.textContent('.contadores')).includes('1 de 2'), 'serie y repetición'); await shot('3-mantener');
await pg.waitForSelector('.reloj', { timeout: 5000 });
ok((await paso()).includes('Pausa entre repeticiones'), 'pasa sola a la pausa entre repeticiones');
await pg.waitForSelector('.aguante', { timeout: 5000 }); ok((await pg.textContent('.contadores')).includes('2 de 2'), 'segunda repetición sola');
await pg.waitForSelector('.reloj', { timeout: 5000 });
ok((await paso()).includes('Descanso entre series'), 'descanso entre series');
const r0 = Number(await pg.textContent('.reloj-n'));
await pg.click('button:has-text("+15 s")'); const r1 = Number(await pg.textContent('.reloj-n'));
ok(r1 >= r0 + 14, `alargar descanso ${r0} → ${r1}`);
await pg.click('button:has-text("Pausar")'); await pg.waitForTimeout(1500);
ok(Number(await pg.textContent('.reloj-n')) === r1, 'pausa congela el reloj');
await shot('4-descanso');
await pg.click('button:has-text("Seguir")'); await pg.click('button:has-text("−15 s")');

// Salir a mitad y continuar tras recargar.
await pg.click('button[aria-label^="Salir"]'); await pg.waitForSelector('a.boton.grande');
ok((await pg.textContent('a.boton.grande')) === 'Continuar la sesión', 'sesión a medias guardada');
await pg.reload(); await pg.click('a.boton.grande'); await pg.waitForSelector('.sesion-cab');
ok(!!(await pg.$('.reloj, .aguante')), 'continúa donde iba: ' + await paso());
while (!(await pg.$('.dolor-grid'))) { await pg.click('.sesion-acciones .boton:not(.secundario)'); await pg.waitForTimeout(80); }

// Valorar el primer ejercicio.
await pg.click('.pastilla:has-text("Difícil")'); await pg.click('.dolor-op:has-text("6")'); await pg.fill('textarea', 'Tira al bajar');
await shot('5-valorar');
await pg.click('button:has-text("Siguiente")'); await pg.waitForSelector('.reloj');
ok((await pg.textContent('.sesion-cuerpo')).includes('Siguiente: Puente a una pierna'), 'descanso entre ejercicios con el siguiente');
await pg.click('button:has-text("Saltar")'); await pg.click('button:has-text("Empezar")');
ok((await pg.textContent('.sesion-acciones')).includes('Lado hecho'), 'unilateral: primer lado');
await pg.click('button:has-text("Lado hecho")'); await pg.waitForSelector('.reloj');
ok((await paso()).includes('lado izquierdo'), 'cambio de lado');
await pg.click('button:has-text("Saltar")'); await pg.click('button:has-text("Serie hecha")');
await pg.click('.pastilla:has-text("Bien")'); await pg.click('.dolor-op:has-text("2")'); await pg.click('button:has-text("Siguiente")');
await pg.waitForSelector('.medalla'); await pg.waitForSelector('text=ha llegado a tu profesional');
ok(true, 'resumen y valoración enviada'); await shot('6-resumen');
let rs = await fetchRespuestas(api, pub);
ok(rs.length === 1 && JSON.stringify(rs[0].respuesta.items) === JSON.stringify([{ i: 0, diff: 'dificil', pain: 6, note: 'Tira al bajar' }, { i: 1, diff: 'bien', pain: 2 }]), 'el profesional recibe la valoración');

// Sin red: la valoración queda en cola y se envía después.
await pg.click('a.boton.grande'); await pg.waitForSelector('h1:has-text("Hecho por hoy")');
await pg.route('**/api/v1/p/*/r', r => r.abort());
await pg.click('a.boton.grande'); await pg.waitForSelector('.sesion-cab');
while (!(await pg.$('.dolor-grid'))) { await pg.click('.sesion-acciones .boton:not(.secundario)'); await pg.waitForTimeout(50); }
await pg.click('.dolor-op:has-text("1")');
while (!(await pg.$('.medalla'))) { await pg.click('.sesion-acciones .boton:not(.secundario), .sesion-cuerpo .boton'); await pg.waitForTimeout(50); }
await pg.waitForSelector('text=Sin conexión'); ok(true, 'sin red: en cola');
await pg.unroute('**/api/v1/p/*/r');
await pg.click('a.boton.grande'); await pg.waitForTimeout(1500);
rs = await fetchRespuestas(api, pub); ok(rs.length === 2, 'la cola se envía al volver la red');

// Pauta programada para mañana.
const manana = new Date(Date.now() + 86400000); manana.setHours(0, 0, 0, 0);
const prog = await publishPauta(api, pauta, { visibility: { mode: 'auto', from: manana.toISOString() } });
await pg.goto(url + '#/paciente'); await pg.fill('input[type=url]', prog.link); await pg.click('button[type=submit]');
await pg.waitForSelector('.aviso.error'); ok((await pg.textContent('.aviso.error')).includes('a partir del'), 'programada: ' + await pg.textContent('.aviso.error'));
ok((await pg.$$('.fila-pauta')).length === 1, 'lista de pautas del paciente');

await pg.setViewportSize({ width: 1194, height: 834 }); await pg.click('.fila-pauta'); await pg.click('a.boton.grande'); await pg.waitForSelector('.sesion-figura');
await pg.waitForTimeout(400); await shot('7-tablet');
console.log('errores:', errs); if (errs.length) process.exitCode = 1;
await b.close();
