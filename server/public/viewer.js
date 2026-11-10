// Visor web de pautas y canales (provisional). Descifra en el navegador con la clave del
// fragmento del enlace; el servidor nunca la recibe. Construye el DOM con textContent: nada de
// lo que viene cifrado se interpreta como HTML.
import { fetchPauta, fetchCanal, sendRespuesta, ApiError } from './api-client.js';
import { checkPauta, doseText, estimateSession, FORMAT_LABEL } from './pauta-schema.js';

const app = document.getElementById('app');

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== undefined && c !== null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

const show = (...nodes) => app.replaceChildren(...nodes);
const fecha = iso => new Date(iso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

function fail(e) {
  let msg = 'No se ha podido abrir. Comprueba que el enlace está completo.';
  if (e instanceof ApiError) {
    if (e.status === 404) msg = 'Este enlace no existe o ha caducado. Pide uno nuevo a tu profesional.';
    else if (e.status === 403 && e.body.estado === 'programada') msg = `Estará disponible a partir del ${fecha(e.body.desde)}.`;
    else if (e.status === 403) msg = 'Este contenido no está disponible ahora mismo.';
    else if (e.status === 429) msg = 'Demasiados intentos seguidos. Espera unos minutos.';
  }
  show(h('p', { class: 'estado' }, msg));
}

let catalog;
async function loadCatalog() {
  if (!catalog) {
    const res = await fetch('/lib/catalog.json');
    const data = await res.json();
    catalog = new Map(data.exercises.map(e => [e.id, e]));
  }
  return catalog;
}

function exerciseCard(it, ex, { proText, format }) {
  const view = ex?.animation?.views?.[0];
  const sheet = ex?.sheet;
  const how = sheet && h('details', {},
    h('summary', {}, 'Cómo se hace'),
    h('p', {}, sheet.patient.start),
    h('ol', {}, sheet.patient.steps.map(s => h('li', {}, s))),
    h('p', {}, h('strong', {}, 'Evita:')),
    h('ul', { class: 'evitar' }, sheet.patient.avoid.map(s => h('li', {}, s))),
    proText && h('p', {}, h('strong', {}, 'Objetivo: '), sheet.pro.goal),
    proText && h('ul', {}, sheet.pro.notes.map(s => h('li', {}, s))));
  const cue = !sheet && ex?.animation?.cue && h('details', {}, h('summary', {}, 'Cómo se hace'), h('p', {}, ex.animation.cue));
  return h('li', { class: 'ejercicio' },
    view ? h('img', { src: `/lib/${view}`, alt: '', loading: 'lazy' }) : h('div'),
    h('div', {},
      h('h2', {}, ex?.name?.es ?? it.id),
      h('p', { class: 'dosis' }, doseText(it, format)),
      it.note && h('p', { class: 'nota-ej' }, it.note)),
    how || cue);
}

function feedbackForm(pauta, cat, code, key) {
  const fields = pauta.items.map((it, i) => {
    const name = cat.get(it.id)?.name?.es ?? it.id;
    return h('fieldset', {},
      h('legend', {}, name),
      h('div', { class: 'opciones', role: 'radiogroup', 'aria-label': `Cómo te ha resultado ${name}` },
        ['facil', 'bien', 'dificil'].map(v => h('label', {}, h('input', { type: 'radio', name: `d${i}`, value: v }), { facil: 'Fácil', bien: 'Bien', dificil: 'Difícil' }[v]))),
      h('label', {}, 'Dolor (0 = nada, 10 = máximo) ',
        h('select', { name: `p${i}` }, h('option', { value: '' }, '—'), Array.from({ length: 11 }, (_, n) => h('option', { value: n }, n)))),
      h('label', {}, 'Comentario (opcional)', h('input', { type: 'text', name: `n${i}`, maxlength: 300 })));
  });
  const status = h('p', { role: 'status' });
  const button = h('button', { type: 'submit' }, 'Enviar a mi profesional');
  const form = h('form', { class: 'respuesta', onsubmit: async ev => {
    ev.preventDefault();
    const data = new FormData(form);
    const items = pauta.items.map((_, i) => ({ i, diff: data.get(`d${i}`) || undefined, pain: data.get(`p${i}`) === '' || data.get(`p${i}`) === null ? undefined : Number(data.get(`p${i}`)), note: (data.get(`n${i}`) || '').trim() || undefined }))
      .filter(r => r.diff || r.pain !== undefined || r.note);
    if (!items.length) { status.className = 'error'; status.textContent = 'Marca al menos un ejercicio.'; return; }
    button.disabled = true;
    try {
      await sendRespuesta(location.origin, code, key, { v: 1, kind: 'respuesta', at: new Date().toISOString(), items });
      status.className = 'ok'; status.textContent = 'Enviado. ¡Gracias!';
      form.querySelectorAll('input, select').forEach(el => { el.disabled = true; });
    } catch {
      status.className = 'error'; status.textContent = 'No se ha podido enviar. Inténtalo de nuevo.';
      button.disabled = false;
    }
  } }, h('h2', {}, '¿Cómo te ha ido?'), fields, button, status);
  return form;
}

async function showPauta() {
  const { pauta, code, key } = await fetchPauta(location.href);
  const cat = await loadCatalog();
  if (checkPauta(pauta).length) throw new Error('pauta no válida');
  const pro = [pauta.pro?.name, pauta.pro?.center].filter(Boolean).join(' · ');
  const est = estimateSession(pauta, id => cat.get(id)?.met ?? 3);
  const meta = [
    pauta.format && pauta.format.type !== 'series' && `${FORMAT_LABEL[pauta.format.type]}${pauta.format.minutes ? ` ${pauta.format.minutes} min` : ''}`,
    pauta.schedule && `${pauta.schedule.perWeek === 7 ? 'Todos los días' : `${pauta.schedule.perWeek} días por semana`} · ${pauta.schedule.weeks} ${pauta.schedule.weeks === 1 ? 'semana' : 'semanas'}`,
    `~${est.minutes} min`,
    pauta.show?.kcal && `~${est.kcal} kcal (estimado para 70 kg)`,
  ].filter(Boolean).join(' · ');
  document.title = 'Tus ejercicios';
  show(
    pro && h('p', { class: 'pro' }, pro),
    h('h1', {}, 'Tus ejercicios'),
    h('p', { class: 'meta' }, meta),
    pauta.note && h('p', { class: 'nota' }, pauta.note),
    h('ol', { class: 'lista' }, pauta.items.map(it => exerciseCard(it, cat.get(it.id), { proText: pauta.show?.proText, format: pauta.format }))),
    code && feedbackForm(pauta, cat, code, key));
}

async function showCanal() {
  const { meta, sesiones } = await fetchCanal(location.href);
  const cat = await loadCatalog();
  document.title = meta.name || 'Canal';
  show(
    meta.center && h('p', { class: 'pro' }, meta.center),
    h('h1', {}, meta.name || 'Canal'),
    sesiones.length
      ? h('div', { class: 'lista' }, sesiones.map(({ pauta }) => h('section', { class: 'sesion' },
          h('h2', {}, pauta.format && pauta.format.type !== 'series' && h('span', { class: 'formato' }, `${FORMAT_LABEL[pauta.format.type]}${pauta.format.minutes ? ` ${pauta.format.minutes}'` : ''}`), pauta.title || 'Sesión'),
          pauta.note && h('p', { class: 'nota-ej' }, pauta.note),
          h('ul', {}, pauta.items.map(it => h('li', {}, `${cat.get(it.id)?.name?.es ?? it.id} — ${doseText(it, pauta.format)}`))))))
      : h('p', { class: 'estado' }, 'No hay sesiones publicadas ahora mismo.'));
}

(location.pathname.startsWith('/c/') ? showCanal() : showPauta()).catch(fail);
