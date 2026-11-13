// Visor web de pautas y canales (provisional) · tema «Cercano».
// Descifra en el navegador con la clave del fragmento del enlace; el servidor nunca la recibe.
// Construye el DOM con textContent: nada de lo que viene cifrado se interpreta como HTML.
import { fetchPauta, fetchCanal, sendRespuesta, ApiError } from './api-client.js';
import { checkPauta, doseText, estimateSession, FORMAT_LABEL, isRestItem, itemName, REST_TYPES } from './pauta-schema.js';

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
const show = (...nodes) => app.replaceChildren(...nodes.flat().filter(Boolean));
const fecha = iso => new Date(iso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const check = () => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'm5 12 5 5 9-10'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '3.2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
  s.append(p);
  return s;
};
const initials = name => (name || '').split(/\s+/).filter(w => /^[\p{L}]/u.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '·';

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
    const data = await (await fetch('/lib/catalog.json')).json();
    catalog = new Map(data.exercises.map(e => [e.id, e]));
  }
  return catalog;
}

// Visor 3D de la biblioteca (cámara libre: arrastrar para girar). Se carga solo al abrirlo.
let viewerLib;
const loadViewer = () => viewerLib ||= new Promise((resolve, reject) => {
  const sc = document.createElement('script');
  sc.src = '/lib/viewer.js';
  sc.onload = () => resolve(window.PoseViewer);
  sc.onerror = () => { viewerLib = null; reject(new Error('visor 3D no disponible')); };
  document.head.append(sc);
});
const poseCache = new Map();
const loadPoses = id => {
  if (!poseCache.has(id)) poseCache.set(id, fetch(`/lib/poses/${id}.json`).then(r => { if (!r.ok) throw new Error('sin posturas'); return r.json(); }));
  return poseCache.get(id);
};
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let loops = [];
const stopLoops = () => { loops.forEach(cancelAnimationFrame); loops = []; };

function viewer3d(id, name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '-14 -22 92 96', fill: 'none', stroke: '#C2410C', 'stroke-width': '3.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', role: 'img', 'aria-label': `${name}, figura en 3D` })) svg.setAttribute(k, v);
  const box = h('div', { class: 'visor3d' }, svg, h('p', { class: 'pista' }, 'Arrastra para girar · doble toque para volver'));
  Promise.all([loadViewer(), loadPoses(id)]).then(([PV, ex]) => {
    const fig = PV.mount(svg, ex);
    // Encuadre automático: une la caja de la figura y el suelo a lo largo de la animación, y
    // se recalcula cuando cambia la cámara (al girar o al volver con doble toque).
    let fit = null, cam = '';
    const draw = t => {
      fig.render(t);
      const key = `${Math.round(fig.state.yaw)}|${Math.round(fig.state.pitch)}`;
      if (key !== cam) { cam = key; fit = null; }
      const b = svg.getBBox();
      fit = fit ? { x0: Math.min(fit.x0, b.x), y0: Math.min(fit.y0, b.y), x1: Math.max(fit.x1, b.x + b.width), y1: Math.max(fit.y1, b.y + b.height) }
        : { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height };
      const pad = 3;
      svg.setAttribute('viewBox', `${(fit.x0 - pad).toFixed(1)} ${(fit.y0 - pad).toFixed(1)} ${(fit.x1 - fit.x0 + 2 * pad).toFixed(1)} ${(fit.y1 - fit.y0 + 2 * pad).toFixed(1)}`);
    };
    if (reduceMotion()) { draw(ex.still ?? 0); return; }
    const t0 = performance.now();
    const slot = loops.length;
    const frame = now => { draw((now - t0) / 1000); loops[slot] = requestAnimationFrame(frame); };
    loops[slot] = requestAnimationFrame(frame);
  }).catch(() => box.replaceChildren(h('p', { class: 'pista' }, 'No se ha podido cargar la vista 3D.')));
  return box;
}

// Ejercicios hechos hoy: solo en este dispositivo (comodidad del paciente; no se envía).
const today = () => new Date().toISOString().slice(0, 10);
function doneStore(id) {
  const key = `hechos:${id}:${today()}`;
  let set = new Set();
  try { set = new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { /* sin almacenamiento */ }
  return {
    has: i => set.has(i),
    toggle: i => {
      if (set.has(i)) set.delete(i); else set.add(i);
      try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* sin almacenamiento */ }
    },
    get size() { return set.size; },
  };
}

function howTo(ex, proText) {
  const sheet = ex?.sheet;
  if (!sheet) return ex?.animation?.cue && h('details', {}, h('summary', {}, 'Cómo se hace'), h('p', {}, ex.animation.cue));
  return h('details', {},
    h('summary', {}, 'Cómo se hace'),
    h('p', {}, sheet.patient.start),
    h('ol', {}, sheet.patient.steps.map(s => h('li', {}, s))),
    h('ul', { class: 'evitar', 'aria-label': 'Evita' }, sheet.patient.avoid.map(s => h('li', {}, s))),
    proText && h('p', {}, h('strong', {}, 'Objetivo: '), sheet.pro.goal),
    proText && h('ul', {}, sheet.pro.notes.map(s => h('li', {}, s))));
}

function feedbackForm(pauta, cat, code, key) {
  const fields = pauta.items.map((it, i) => {
    if (isRestItem(it)) return null; // los descansos no se valoran
    const name = itemName(it, cat);
    return h('fieldset', {},
      h('legend', {}, name),
      h('div', { class: 'opciones', role: 'radiogroup', 'aria-label': `Cómo te ha resultado ${name}` },
        [['facil', 'Fácil'], ['bien', 'Bien'], ['dificil', 'Difícil']].map(([v, t]) => h('label', {}, h('input', { type: 'radio', name: `d${i}`, value: v }), t))),
      h('div', { class: 'etiqueta' }, h('span', { id: `pl${i}` }, 'Dolor durante el ejercicio'), h('span', {}, '0 nada · 10 máximo')),
      h('div', { class: 'dolor', role: 'radiogroup', 'aria-labelledby': `pl${i}` },
        Array.from({ length: 11 }, (_, n) => h('label', { class: n >= 7 ? 'alto' : n >= 3 ? 'medio' : undefined }, h('input', { type: 'radio', name: `p${i}`, value: n, 'aria-label': `Dolor ${n}` }), n))),
      h('label', {}, 'Comentario (opcional)', h('textarea', { name: `n${i}`, maxlength: 300, rows: 2 })));
  });
  const status = h('p', { role: 'status' });
  const button = h('button', { type: 'submit', class: 'enviar' }, 'Enviar a mi profesional');
  const form = h('form', { class: 'respuesta', onsubmit: async ev => {
    ev.preventDefault();
    const data = new FormData(form);
    const items = pauta.items.map((it, i) => isRestItem(it) ? {} : ({
      i,
      diff: data.get(`d${i}`) || undefined,
      pain: data.get(`p${i}`) === null ? undefined : Number(data.get(`p${i}`)),
      note: (data.get(`n${i}`) || '').trim() || undefined,
    })).filter(r => r.diff || r.pain !== undefined || r.note);
    // (los descansos dan objetos vacíos y se descartan aquí)
    if (!items.length) { status.className = 'error'; status.textContent = 'Marca al menos un ejercicio.'; return; }
    button.disabled = true;
    try {
      await sendRespuesta(location.origin, code, key, { v: 1, kind: 'respuesta', at: new Date().toISOString(), items });
      status.className = 'ok'; status.textContent = 'Enviado. ¡Gracias!';
      form.querySelectorAll('input, textarea').forEach(el => { el.disabled = true; });
    } catch {
      status.className = 'error'; status.textContent = 'No se ha podido enviar. Inténtalo de nuevo.';
      button.disabled = false;
    }
  } },
  h('h2', {}, '¿Cómo te ha ido?'), fields, button, status,
  h('p', { class: 'privado' }, 'Solo lo verá tu profesional. Va cifrado: ni siquiera el servidor puede leerlo.'));
  return form;
}

async function showPauta() {
  const { pauta, code, key } = await fetchPauta(location.href);
  const cat = await loadCatalog();
  if (checkPauta(pauta).length) throw new Error('pauta no válida');
  const done = doneStore(code || key.slice(0, 12));
  const est = estimateSession(pauta, id => cat.get(id)?.met ?? 3);
  const sched = pauta.schedule && `${pauta.schedule.perWeek === 7 ? 'Todos los días' : `${pauta.schedule.perWeek} días/semana`} · ${pauta.schedule.weeks} ${pauta.schedule.weeks === 1 ? 'semana' : 'semanas'}`;
  const fmt = pauta.format && pauta.format.type !== 'series' && `${FORMAT_LABEL[pauta.format.type]}${pauta.format.minutes ? ` ${pauta.format.minutes} min` : ''}`;
  const logo = initials(pauta.pro?.name);
  const form = code && feedbackForm(pauta, cat, code, key);
  const open3d = new Set();

  const render = () => {
    stopLoops();
    const n = pauta.items.filter(it => !isRestItem(it)).length;
    const current = pauta.items.findIndex((_, i) => !done.has(i));
    const all = current === -1;
    const meta = [`${done.size} ${done.size === 1 ? 'hecho' : 'hechos'}`, `unos ${est.minutes} min`, pauta.show?.kcal && `~${est.kcal} kcal`].filter(Boolean).join(' · ');
    show(
      (pauta.pro?.name || pauta.pro?.center || sched) && h('div', { class: 'pro' },
        (pauta.pro?.name || pauta.pro?.center) && h('div', { class: 'logo', 'aria-hidden': 'true' }, logo),
        h('div', { class: 'quien' }, pauta.pro?.name && h('b', {}, pauta.pro.name), pauta.pro?.center && h('span', {}, pauta.pro.center)),
        sched && h('span', { class: 'pill' }, sched)),
      fmt && h('span', { class: 'pill calida' }, fmt),
      h('h1', {}, all ? '¡Hecho por hoy!' : n === 1 ? 'Hoy te toca 1 ejercicio' : `Hoy te tocan ${n} ejercicios`),
      h('div', { class: 'progreso' },
        pauta.items.map((_, i) => h('span', { class: `punto${done.has(i) ? ' hecho' : i === current ? ' actual' : ''}`, 'aria-hidden': 'true' }, done.has(i) && check())),
        h('span', { class: 'texto' }, meta, pauta.show?.kcal && h('small', {}, ' (estimado para 70 kg)'))),
      pauta.note && h('div', { class: 'mensaje' }, h('div', { class: 'logo', 'aria-hidden': 'true' }, logo), h('p', {}, pauta.note)),
      h('ol', { class: 'lista' }, pauta.items.map((it, i) => {
        if (isRestItem(it)) {
          return h('li', { class: `ej descanso-item${done.has(i) ? ' hecho' : ''}` },
            h('span', { class: 'icono-descanso', 'aria-hidden': 'true' }, '⏸'),
            h('div', {}, h('h2', {}, REST_TYPES[it.id].es), h('p', { class: 'dosis' }, doseText(it)), it.note && h('p', { class: 'nota-ej' }, it.note)),
            h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'btn-hecho', 'aria-pressed': String(done.has(i)), onclick: () => { done.toggle(i); render(); } }, done.has(i) ? 'Deshacer' : 'Marcar como hecho')));
        }
        const ex = cat.get(it.id);
        const view = ex?.animation?.views?.[0];
        const state = done.has(i) ? 'hecho' : i === current ? 'actual' : 'pendiente';
        return h('li', { class: `ej ${state}` },
          view ? h('img', { src: `/lib/${view}`, alt: '', loading: 'lazy' }) : h('span'),
          h('div', {},
            state === 'actual' && h('span', { class: 'ahora' }, 'Ahora'),
            h('h2', {}, ex?.name?.es ?? it.id),
            h('p', { class: 'dosis' }, state === 'hecho' ? '¡Hecho!' : doseText(it, pauta.format)),
            it.note && state !== 'hecho' && h('p', { class: 'nota-ej' }, it.note)),
          open3d.has(i) && viewer3d(it.id, ex?.name?.es ?? it.id),
          state !== 'hecho' && howTo(ex, pauta.show?.proText),
          h('div', { class: 'acciones' },
            h('button', { type: 'button', class: 'btn-3d', 'aria-expanded': String(open3d.has(i)), onclick: () => { if (open3d.has(i)) open3d.delete(i); else open3d.add(i); render(); } },
              open3d.has(i) ? 'Cerrar 3D' : 'Ver en 3D'),
            h('button', { type: 'button', class: 'btn-hecho', 'aria-pressed': String(done.has(i)), onclick: () => { done.toggle(i); render(); } },
              done.has(i) ? 'Deshacer' : 'Marcar como hecho')));
      })),
      form);
  };
  document.title = 'Tus ejercicios';
  render();
}

async function showCanal() {
  const { meta, sesiones } = await fetchCanal(location.href);
  const cat = await loadCatalog();
  document.title = meta.name || 'Canal';
  show(
    h('div', { class: 'pro' },
      h('div', { class: 'logo', 'aria-hidden': 'true' }, initials(meta.name)),
      h('div', { class: 'quien' }, h('b', {}, meta.name || 'Canal'), meta.center && h('span', {}, meta.center))),
    h('h1', {}, sesiones.length === 1 ? 'Hoy toca' : 'Disponible ahora'),
    sesiones.length
      ? sesiones.map(({ pauta }) => h('section', { class: 'sesion' },
          pauta.format && pauta.format.type !== 'series' && h('span', { class: 'pill' }, `${FORMAT_LABEL[pauta.format.type]}${pauta.format.minutes ? ` ${pauta.format.minutes}'` : ''}`),
          h('h2', {}, pauta.title || 'Sesión'),
          pauta.note && h('p', {}, pauta.note),
          h('ul', {}, pauta.items.map(it => {
            const ex = cat.get(it.id);
            const view = ex?.animation?.views?.[0];
            return h('li', {}, view && h('img', { src: `/lib/${view}`, alt: '', loading: 'lazy' }),
              h('div', {}, h('strong', {}, itemName(it, cat)), h('br'), doseText(it, pauta.format)));
          }))))
      : h('p', { class: 'estado' }, 'No hay sesiones publicadas ahora mismo.'));
}

(location.pathname.startsWith('/c/') ? showCanal() : showPauta()).catch(fail);
