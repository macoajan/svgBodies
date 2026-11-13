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
    { id: 'descanso-caminando', time: 5, note: 'Camina suave por la habitación' },
    { id: 'puente-una-pierna', sets: 2, reps: 10, perSide: true, restSide: 10, perSet: [{ reps: 12, rest: 15, restType: 'descanso-caminando' }, { time: 3 }] },
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
const principal = () => pg.click('.sesion-acciones .boton >> nth=-1'); // botón principal del paso
const hasta = async (cond, max = 60) => { for (let k = 0; k < max && !(await cond()); k++) { await principal(); await pg.waitForTimeout(60); } };

// Abrir el enlace.
await pg.goto(url + '#/paciente'); await pg.fill('input[type=url]', pub.link); await pg.click('button[type=submit]');
await pg.waitForSelector('a.boton.grande');
ok((await pg.textContent('h1')) === 'Hoy te tocan 2 ejercicios', 'pauta recibida (el descanso no cuenta como ejercicio)');
ok((await pg.textContent('.pro')).includes('Ana Pérez') && (await pg.textContent('.mensaje')).includes('baja menos'), 'profesional y mensaje');
ok((await pg.textContent('.lista-ej')).includes('Descanso caminando · 5 s'), 'descanso suelto en la lista');
ok((await pg.textContent('.lista-ej')).includes('12 repeticiones') || (await pg.textContent('.lista-ej')).includes('12 rep.'), 'series a medida en la dosis');
ok((await pg.evaluate(() => document.documentElement.dataset.theme)) === 'C', 'tema del paciente');
await shot('1-recibida');

// Aguante con tiempo → pausa entre repeticiones que, al terminar, espera «Continuar».
await pg.click('a.boton.grande'); await pg.waitForSelector('.sesion-cab'); await pg.waitForSelector('.figura-svg svg');
ok((await paso()).includes('Sentadilla'), 'preparar: ' + await paso()); await shot('2-preparar');
await pg.click('button:has-text("Empezar")'); await pg.waitForSelector('.aguante');
ok((await pg.textContent('.contadores')).includes('1 de 2'), 'serie y repetición'); await shot('3-mantener');
await pg.waitForSelector('.reloj', { timeout: 5000 });
ok((await paso()).includes('Pausa entre repeticiones'), 'pasa sola del aguante a la pausa');
await pg.waitForSelector('button:has-text("Continuar con el siguiente")', { timeout: 5000 });
ok((await pg.textContent('.reloj-n')).includes('¡Tiempo!'), 'al terminar la pausa espera al paciente');
await pg.waitForTimeout(2200);
ok(/\+\d/.test(await pg.textContent('.reloj-n')) && (await paso()).includes('Pausa'), 'cuenta el tiempo extra y no avanza: ' + await pg.textContent('.reloj-n'));
await shot('4-fin-descanso');
await pg.click('button:has-text("Continuar con el siguiente")'); await pg.waitForSelector('.aguante');
ok((await pg.textContent('.contadores')).includes('2 de 2'), 'continuar → segunda repetición');

// Descanso entre series: alargar, parar el reloj, qué viene, anterior.
await pg.waitForSelector('.reloj', { timeout: 5000 });
ok((await paso()).includes('Descanso entre series'), 'descanso entre series');
ok((await pg.textContent('.que-viene')).includes('Serie 2 de 2'), 'muestra qué viene');
const r0 = Number(await pg.textContent('.reloj-n'));
await pg.click('button:has-text("+15 s")'); const r1 = Number(await pg.textContent('.reloj-n'));
ok(r1 >= r0 + 14, `alargar descanso ${r0} → ${r1}`);
await pg.click('button:has-text("Parar el reloj")'); await pg.waitForTimeout(1500);
ok(Number(await pg.textContent('.reloj-n')) === r1 && (await pg.textContent('main')).includes('Reloj parado'), 'el reloj se para y no sigue adelante');
await shot('5-descanso-parado');
await pg.click('button[aria-label="Volver al paso anterior"]'); await pg.waitForSelector('.aguante');
ok((await pg.textContent('.contadores')).includes('1 de 2') && (await pg.textContent('.contadores')).includes('Serie1'.replace('1', '')), 'anterior: vuelve al aguante');

// Salir a mitad y continuar tras recargar.
await pg.click('button[aria-label^="Salir"]'); await pg.waitForSelector('a.boton.grande');
ok((await pg.textContent('a.boton.grande')) === 'Continuar la sesión', 'sesión a medias guardada');
await pg.reload(); await pg.click('a.boton.grande'); await pg.waitForSelector('.sesion-cab');
ok(!!(await pg.$('.reloj, .aguante')), 'continúa donde iba: ' + await paso());
await hasta(async () => !!(await pg.$('.dolor-grid')));

// Valorar el primer ejercicio.
await pg.click('.pastilla:has-text("Difícil")'); await pg.click('.dolor-op:has-text("6")'); await pg.fill('textarea', 'Tira al bajar');
await shot('6-valorar');
await pg.click('button:has-text("Siguiente")'); await pg.waitForSelector('.reloj');
ok((await paso()).includes('Descanso caminando') && (await pg.textContent('main')).includes('Camina suave'), 'descanso suelto con su tipo y nota');
ok((await pg.textContent('.que-viene')).includes('Puente a una pierna'), 'después del descanso, el siguiente ejercicio');
await shot('7-descanso-caminando');
await pg.waitForSelector('button:has-text("Continuar con el siguiente")', { timeout: 8000 });
await pg.click('button:has-text("Continuar con el siguiente")'); await pg.click('button:has-text("Empezar")');
ok((await pg.textContent('.contadores')).includes('12'), 'serie a medida: 12 repeticiones');
ok((await pg.textContent('.sesion-acciones')).includes('Lado hecho'), 'unilateral: primer lado');
await pg.click('button:has-text("Lado hecho")'); await pg.waitForSelector('.reloj');
ok((await paso()).includes('lado izquierdo'), 'cambio de lado');
await pg.click('button:has-text("Saltar descanso")'); await pg.click('button:has-text("Serie hecha")');
await pg.waitForSelector('.reloj'); ok((await paso()).includes('Descanso caminando entre series'), 'descanso entre series con su tipo');
await pg.click('button:has-text("Saltar descanso")'); await pg.waitForSelector('.aguante');
ok((await pg.textContent('.aguante')).includes('Trabaja') && (await pg.textContent('.contadores')).includes('3 s'), 'serie cronometrada');
await shot('8-cronometrada');
await hasta(async () => !!(await pg.$('.dolor-grid')));
await pg.click('.pastilla:has-text("Bien")'); await pg.click('.dolor-op:has-text("2")'); await pg.click('button:has-text("Siguiente")');
await pg.waitForSelector('.medalla'); await pg.waitForSelector('text=ha llegado a tu profesional');
ok(true, 'resumen y valoración enviada'); await shot('9-resumen');
let rs = await fetchRespuestas(api, pub);
ok(rs.length === 1 && JSON.stringify(rs[0].respuesta.items) === JSON.stringify([{ i: 0, diff: 'dificil', pain: 6, note: 'Tira al bajar' }, { i: 2, diff: 'bien', pain: 2 }]), 'el profesional recibe la valoración: ' + JSON.stringify(rs[0]?.respuesta.items));

// Sin red: la valoración queda en cola y se envía después.
await pg.click('a.boton.grande'); await pg.waitForSelector('h1:has-text("Hecho por hoy")');
await pg.route('**/api/v1/p/*/r', r => r.abort());
await pg.click('a.boton.grande'); await pg.waitForSelector('.sesion-cab');
await hasta(async () => !!(await pg.$('.dolor-grid')));
await pg.click('.dolor-op:has-text("1")');
await hasta(async () => !!(await pg.$('.medalla')), 80);
await pg.waitForSelector('text=Sin conexión'); ok(true, 'sin red: en cola');
await pg.unroute('**/api/v1/p/*/r');
await pg.click('a.boton.grande'); await pg.waitForTimeout(1500);
rs = await fetchRespuestas(api, pub); ok(rs.length === 2, 'la cola se envía al volver la red');

// Avance automático (Ajustes): la pausa entre repeticiones avanza sola.
await pg.goto(url + '#/ajustes'); await pg.click('.interruptor:has-text("Avanzar solo")');
await pg.goto(url + '#/paciente'); await pg.click('.fila-pauta'); await pg.click('a.boton.grande'); await pg.waitForSelector('.sesion-cab');
await pg.click('button:has-text("Empezar")'); await pg.waitForSelector('.reloj', { timeout: 5000 });
await pg.waitForSelector('.aguante', { timeout: 5000 }); ok(true, 'con avance automático, la pausa termina sola');
await pg.click('button[aria-label^="Salir"]');

// Pauta programada para mañana.
const manana = new Date(Date.now() + 86400000); manana.setHours(0, 0, 0, 0);
const prog = await publishPauta(api, pauta, { visibility: { mode: 'auto', from: manana.toISOString() } });
await pg.goto(url + '#/paciente'); await pg.fill('input[type=url]', prog.link); await pg.click('button[type=submit]');
await pg.waitForSelector('.aviso.error'); ok((await pg.textContent('.aviso.error')).includes('a partir del'), 'programada: ' + await pg.textContent('.aviso.error'));
ok((await pg.$$('.fila-pauta')).length === 1, 'lista de pautas del paciente');

await pg.setViewportSize({ width: 1194, height: 834 }); await pg.click('.fila-pauta'); await pg.click('a.boton.grande'); await pg.waitForSelector('.sesion-figura');
await pg.waitForTimeout(400); await shot('10-tablet');
console.log('errores:', errs); if (errs.length) process.exitCode = 1;
await b.close();
