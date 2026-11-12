import { useEffect, useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { Figura } from './Figura.jsx';
import { useLibrary } from './useLibrary.js';
import { figureUrls } from '../lib/library.js';
import { navigate } from '../router.js';
import { ajustes } from '../data/app-store.js';
import { versionRecibidas, getRecibida, refrescar, borrarRecibida, hechasHoy, pendientes, enviarPendientes } from '../data/recibidas.js';
import { doseText, estimateSession, DEFAULTS } from '@shared/pauta-schema.js';
import { scheduleText } from '../domain/pautas.js';

const iniciales = s => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'P';

/** Pauta recibida: quién la envía, mensaje, ejercicios y «Empezar». */
export function PautaRecibida({ params }) {
  const { lib } = useLibrary();
  versionRecibidas.value;
  const clave = params.clave;
  const rec = getRecibida(clave);
  const [aviso, setAviso] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => {
    if (!rec) return;
    refrescar(clave).then(r => setAviso(r === 'retirada' ? 'retirada' : r === 'oculta' ? 'oculta' : ''));
    enviarPendientes(clave);
  }, [clave]);
  if (!rec) return <main class="pantalla"><Barra titulo="Mi pauta" volver="/paciente" /><h1>Pauta no encontrada</h1></main>;

  const p = rec.pauta;
  const kg = ajustes.value?.pesoKg || DEFAULTS.weightKg;
  const est = lib ? estimateSession(p, id => lib.byId.get(id)?.met ?? 3, kg) : null;
  const hoy = hechasHoy(clave);
  const cola = pendientes(clave);
  return (
    <main class="pantalla paciente">
      <Barra titulo="Mi pauta" volver="/paciente" />
      {p.pro?.name || p.pro?.center ? (
        <div class="pro">
          <span class="logo" aria-hidden="true">{iniciales(p.pro.name || p.pro.center)}</span>
          <span class="quien"><b>{p.pro.name}</b>{p.pro.center ? <span>{p.pro.center}</span> : null}</span>
        </div>
      ) : null}
      <h1>{hoy ? '¡Hecho por hoy!' : `Hoy te tocan ${p.items.length} ${p.items.length === 1 ? 'ejercicio' : 'ejercicios'}`}</h1>
      <p class="apagado">{p.title ? `${p.title} · ` : ''}{scheduleText(p.schedule)}{est ? ` · unos ${est.minutes} min` : ''}{est && p.show?.kcal ? ` · ~${est.kcal} kcal` : ''}</p>
      {aviso === 'retirada' ? <p class="aviso error">Tu profesional ha retirado esta pauta. Puedes seguir viéndola, pero ya no recibirá tus valoraciones.</p> : null}
      {aviso === 'oculta' ? <p class="aviso">Tu profesional ha pausado esta pauta por ahora.</p> : null}
      {p.note ? (
        <div class="mensaje">
          <span class="logo" aria-hidden="true">{iniciales(p.pro?.name)}</span>
          <p>{p.note}</p>
        </div>
      ) : null}
      <a class="boton grande" href={`#/paciente/p/${clave}/sesion`}>{rec.sesion ? 'Continuar la sesión' : hoy ? 'Hacerla otra vez' : 'Empezar'}</a>
      <ol class="lista-ej">
        {p.items.map((it, i) => {
          const ex = lib?.byId.get(it.id);
          return (
            <li key={i}>
              <a class="fila-pauta" href={`#/paciente/p/${clave}/e/${i}`}>
                <span class="fila-img grande">{ex ? <img src={figureUrls(ex)[0]} alt="" loading="lazy" /> : null}</span>
                <span class="fila-texto">
                  <strong>{ex?.name.es ?? 'Ejercicio no disponible en esta versión'}</strong>
                  <span>{doseText(it, p.format)}</span>
                  {it.note ? <span class="nota-ej">{it.note}</span> : null}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      {cola ? <p class="apagado">{cola === 1 ? 'Hay 1 valoración' : `Hay ${cola} valoraciones`} pendiente{cola === 1 ? '' : 's'} de enviar: se enviará{cola === 1 ? '' : 'n'} cuando haya conexión.</p> : null}
      <p class="apagado">{(rec.sesiones || []).length} {(rec.sesiones || []).length === 1 ? 'sesión hecha' : 'sesiones hechas'}. Lo que valoras solo lo ve tu profesional. Si un ejercicio te causa dolor, detente y consúltale.</p>
      {confirmar ? (
        <div class="item-acciones">
          <button type="button" class="boton peligro" onClick={async () => { await borrarRecibida(clave); navigate('/paciente', undefined, { replace: true }); }}>Sí, quitarla</button>
          <button type="button" class="boton secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
        </div>
      ) : <button type="button" class="enlace" onClick={() => setConfirmar(true)}>Quitar esta pauta del dispositivo</button>}
    </main>
  );
}

/** Ficha del ejercicio para el paciente: figura (2D/3D) y cómo se hace. */
export function FichaPaciente({ params }) {
  const { lib } = useLibrary();
  const rec = getRecibida(params.clave);
  const i = Number(params.i);
  const it = rec?.pauta.items[i];
  const ex = it && lib?.byId.get(it.id);
  const volver = `/paciente/p/${params.clave}`;
  if (!rec || !it) return <main class="pantalla"><Barra titulo="Ejercicio" volver={volver} /><h1>Ejercicio no encontrado</h1></main>;
  if (!lib) return <main class="pantalla"><Barra titulo="Ejercicio" volver={volver} /><p class="apagado">Cargando…</p></main>;
  return (
    <main class="pantalla paciente ficha ancha">
      <Barra titulo={`Ejercicio ${i + 1} de ${rec.pauta.items.length}`} volver={volver} />
      {ex ? <Figura ex={ex} /> : null}
      <div class="cabecera-ej">
        <h1 class="h1-ej">{ex?.name.es ?? 'Ejercicio no disponible'}</h1>
        <p><strong>{doseText(it, rec.pauta.format)}</strong></p>
        {it.note ? <p class="nota-ej">{it.note}</p> : null}
      </div>
      <ComoSeHace ex={ex} proText={!!rec.pauta.show?.proText} />
    </main>
  );
}

/** Instrucciones para el paciente (y texto técnico si el profesional lo permite). */
export function ComoSeHace({ ex, proText = false, abierto = true }) {
  if (!ex) return null;
  const sh = ex.sheet;
  const cuerpo = sh ? (
    <>
      <p>{sh.patient.start}</p>
      <ol>{sh.patient.steps.map(s => <li key={s}>{s}</li>)}</ol>
      {sh.patient.avoid?.length ? <ul class="evitar">{sh.patient.avoid.map(s => <li key={s}>{s}</li>)}</ul> : null}
      {proText ? <p class="apagado"><strong>Objetivo:</strong> {sh.pro.goal}</p> : null}
    </>
  ) : ex.animation?.cue ? <p>{ex.animation.cue}</p> : null;
  if (!cuerpo) return null;
  return abierto ? <section class="bloque texto"><h2>Cómo se hace</h2>{cuerpo}</section>
    : <details class="texto"><summary>Cómo se hace</summary>{cuerpo}</details>;
}
