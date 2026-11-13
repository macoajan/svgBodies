import { useEffect, useRef, useState } from 'preact/hooks';
import { useLibrary } from './useLibrary.js';
import { Figura } from './Figura.jsx';
import { ComoSeHace } from './PautaRecibida.jsx';
import { navigate } from '../router.js';
import { ajustes } from '../data/app-store.js';
import { figureUrls } from '../lib/library.js';
import { getRecibida, guardarSesion, terminarSesion } from '../data/recibidas.js';
import { buildPlan, start, next, prev, tick, remaining, overtime, fractionLeft, adjust, skip, pause, resume, rate, toRespuesta, progress, current, upcomingTimers, setAuto, REST, SIDE_LABEL } from '../domain/ejecucion.js';
import { doseText, estimateSession, fmtDur, REST_TYPES, DEFAULTS } from '@shared/pauta-schema.js';
import { sonar, vibrar, pantallaEncendida, programarAvisos } from '../platform/avisos.js';

const Cerrar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const Atras = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-2" /></svg>;
const mmss = s => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s));

/** Título de un paso de descanso. */
function tituloDescanso(step) {
  switch (step.type) {
    case 'descansoRep': return 'Pausa entre repeticiones';
    case 'cambioLado': return `Cambia de lado: ${SIDE_LABEL[step.side]?.toLowerCase()}`;
    case 'descansoSerie': return step.restType && step.restType !== 'descanso' ? `${REST_TYPES[step.restType].es} entre series` : 'Descanso entre series';
    case 'descansoItem': return REST_TYPES[step.restType]?.es ?? 'Descanso';
    default: return 'Descanso';
  }
}

/** Recupera la sesión guardada si corresponde a esta misma pauta; si no, empieza una nueva. */
function cargar(rec, now, auto) {
  const plan = buildPlan(rec.pauta);
  const s = rec.sesion;
  if (s && s.plan?.length === plan.length && s.plan.every((p, k) => p.type === plan[k].type && p.i === plan[k].i)) return setAuto(s, auto);
  return start(plan, now, { auto });
}

/** Siguiente paso de trabajo (para enseñar «qué viene» durante un descanso). */
function siguienteTrabajo(s) {
  for (let k = s.idx + 1; k < s.plan.length; k++) {
    const st = s.plan[k];
    if (['preparar', 'trabajo', 'mantener', 'trabajoTiempo'].includes(st.type)) return st;
    if (st.type === 'resumen' || st.type === 'descansoItem') return st;
  }
  return null;
}

function Valorar({ nombre, v, onRate, onNext }) {
  const nivel = n => (n >= 7 ? 'alto' : n >= 4 ? 'medio' : 'bajo');
  return (
    <div class="sesion-cuerpo">
      <h1>¿Qué tal «{nombre}»?</h1>
      <fieldset>
        <legend>Esfuerzo</legend>
        <div class="opciones3">
          {[['facil', 'Fácil'], ['bien', 'Bien'], ['dificil', 'Difícil']].map(([k, l]) => (
            <label key={k} class="pastilla"><input type="radio" name="diff" checked={v.diff === k} onChange={() => onRate({ diff: k })} /><span>{l}</span></label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Dolor o molestia (0 = nada, 10 = máximo)</legend>
        <div class="dolor-grid">
          {Array.from({ length: 11 }, (_, n) => (
            <label key={n} class={`dolor-op ${nivel(n)}`}><input type="radio" name="pain" checked={v.pain === n} onChange={() => onRate({ pain: n })} /><span>{n}</span></label>
          ))}
        </div>
      </fieldset>
      <label class="campo"><span>Comentario para tu profesional (opcional)</span>
        <textarea rows={2} maxLength={300} value={v.note || ''} onInput={e => onRate({ note: e.currentTarget.value })} />
      </label>
      <div class="sesion-acciones"><button type="button" class="boton grande" onClick={onNext}>Siguiente</button></div>
    </div>
  );
}

export function Sesion({ params }) {
  const { lib } = useLibrary();
  const clave = params.clave;
  const rec = getRecibida(clave);
  const auto = !!ajustes.value?.autoDescanso;
  const [s, setS] = useState(() => (rec ? cargar(rec, Date.now(), auto) : null));
  const [now, setNow] = useState(Date.now());
  const [envio, setEnvio] = useState(null); // null | 'enviando' | 'enviada' | 'pendiente'
  const ref = useRef(s);
  ref.current = s;
  const ultimoAviso = useRef(null);

  const cambiar = fn => {
    const t = Date.now();
    const n = fn(ref.current, t);
    if (n === ref.current) return;
    ref.current = n;
    setS(n); setNow(t);
    if (current(n)?.type !== 'resumen') guardarSesion(clave, n);
  };

  // Reloj: pone al día los pasos con tiempo y da los avisos.
  useEffect(() => {
    if (!s) return;
    pantallaEncendida(true);
    guardarSesion(clave, s);
    const iv = setInterval(() => {
      const t = Date.now();
      const anterior = ref.current;
      const n = tick(anterior, t);
      setNow(t);
      if (n !== anterior) {
        ref.current = n; setS(n);
        const tipo = current(n)?.type;
        if (n.espera && !anterior.espera) { sonar('fin'); vibrar('fin'); } // descanso terminado: espera al paciente
        else if (tipo === 'mantener' || tipo === 'trabajoTiempo') { sonar('inicio'); vibrar('fin'); }
        else { sonar('fin'); vibrar('fin'); }
        if (tipo !== 'resumen') guardarSesion(clave, n);
      } else {
        const rem = remaining(n, t);
        if (n.terminaEn != null && !n.espera && rem > 0 && rem <= 3 && ultimoAviso.current !== `${n.idx}:${rem}`) {
          ultimoAviso.current = `${n.idx}:${rem}`;
          sonar('cuenta'); vibrar('cuenta');
        }
      }
    }, 250);
    // Con la app en segundo plano, notificaciones locales en los fines de tiempo.
    const vis = () => {
      const st = ref.current;
      if (document.hidden && st) {
        const nombre = i => lib?.byId.get(rec.pauta.items[i]?.id)?.name.es || 'el ejercicio';
        programarAvisos(upcomingTimers(st, Date.now(), 12).map(u => ({
          at: u.at,
          title: u.espera ? 'Descanso terminado' : u.manual ? 'Te toca' : 'Tiempo',
          body: u.espera ? 'Vuelve a la app y pulsa «Continuar con el siguiente».' : u.manual ? `Vuelve a la app para seguir con ${nombre(u.step.i ?? 0)}.` : 'Sigue con tu sesión.',
        })));
      } else programarAvisos([]);
    };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); pantallaEncendida(false); programarAvisos([]); };
  }, []);

  // Al llegar al resumen se envía la valoración (o queda en cola sin red).
  useEffect(() => {
    if (!s || current(s)?.type !== 'resumen' || envio) return;
    setEnvio('enviando');
    terminarSesion(clave, toRespuesta(s)).then(quedan => setEnvio(quedan ? 'pendiente' : 'enviada'), () => setEnvio('pendiente'));
  }, [s?.idx]);

  if (!rec || !s) return <main class="pantalla"><h1>Pauta no encontrada</h1><a class="boton" href="#/paciente">Volver</a></main>;
  const step = current(s);
  const p = rec.pauta;
  const prog = progress(s);
  const it = step.i != null ? p.items[step.i] : null;
  const ex = it ? lib?.byId.get(it.id) : null;
  const nombre = ex?.name.es || 'Ejercicio';
  const rem = remaining(s, now);
  const salir = () => { if (step.type !== 'resumen') guardarSesion(clave, ref.current); navigate(`/paciente/p/${clave}`); };
  const puedeAtras = s.idx > 0 && step.type !== 'resumen';

  const cabecera = (
    <header class="sesion-cab">
      <button type="button" class="icono-btn" aria-label="Salir (se guarda dónde vas)" onClick={salir}><Cerrar /></button>
      {puedeAtras ? <button type="button" class="icono-btn" aria-label="Volver al paso anterior" onClick={() => cambiar(prev)}><Atras /></button> : null}
      <span class="sesion-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog.fraccion * 100)} aria-label="Progreso de la sesión">
        <span style={{ width: `${prog.fraccion * 100}%` }} />
      </span>
      <span class="sesion-n">{step.type === 'resumen' ? 'Fin' : `${prog.ejercicio} de ${prog.total}`}</span>
    </header>
  );

  if (step.type === 'resumen') {
    const kg = ajustes.value?.pesoKg || DEFAULTS.weightKg;
    const est = lib ? estimateSession(p, id => lib.byId.get(id)?.met ?? 3, kg) : null;
    const min = Math.max(1, Math.round(((s.fin ?? now) - s.inicio) / 60000));
    return (
      <main class="pantalla paciente sesion">
        {cabecera}
        <div class="sesion-cuerpo centrado">
          <div class="medalla" aria-hidden="true">✓</div>
          <h1>¡Hecho por hoy!</h1>
          <p>{min} min{p.show?.kcal && est ? ` · unas ${est.kcal} kcal` : ''} · {prog.total} ejercicios</p>
          <p aria-live="polite" class={envio === 'pendiente' ? 'aviso' : 'apagado'}>
            {envio === 'enviando' ? 'Enviando tu valoración…' : envio === 'enviada' ? 'Tu valoración ha llegado a tu profesional.' : envio === 'pendiente' ? 'Sin conexión: tu valoración se enviará en cuanto haya red.' : ''}
          </p>
          <a class="boton grande" href={`#/paciente/p/${clave}`}>Volver a la pauta</a>
        </div>
      </main>
    );
  }

  if (step.type === 'valorar') {
    return (
      <main class="pantalla paciente sesion">
        {cabecera}
        <Valorar nombre={nombre} v={s.valoraciones[step.i] || {}} onRate={v => cambiar(st => rate(st, step.i, v))} onNext={() => cambiar(next)} />
      </main>
    );
  }

  if (REST.has(step.type)) {
    const sig = siguienteTrabajo(s);
    const sigIt = sig?.i != null ? p.items[sig.i] : null;
    const sigEx = sigIt ? lib?.byId.get(sigIt.id) : null;
    const frac = fractionLeft(s, now);
    const parado = s.pausa != null;
    const extra = overtime(s, now);
    const detalleSig = sig?.type === 'resumen' ? 'Fin de la sesión'
      : sig?.type === 'descansoItem' ? `${REST_TYPES[sig.restType]?.es} · ${fmtDur(sig.dur)}`
      : sig?.type === 'preparar' ? doseText(sigIt, p.format)
      : sig ? `Serie ${sig.set} de ${sig.sets}${sig.side ? ` · ${SIDE_LABEL[sig.side].toLowerCase()}` : ''} · ${sig.type === 'trabajoTiempo' ? fmtDur(sig.dur)
        : sig.type === 'mantener' ? `repetición ${sig.rep} de ${sig.reps} · mantén ${sig.dur} s`
        : `${sig.reps} ${sig.reps === 1 ? 'repetición' : 'repeticiones'}`}` : '';
    return (
      <main class="pantalla paciente sesion descanso">
        {cabecera}
        <div class="sesion-cuerpo centrado">
          <p class="etiqueta-paso">{tituloDescanso(step)}</p>
          {step.type === 'descansoItem' && it?.note ? <div class="mensaje"><p>{it.note}</p></div> : null}
          <div class={`reloj${s.espera ? ' terminado' : ''}${parado ? ' parado' : ''}`} role="timer" aria-live="off"
            aria-label={s.espera ? `Descanso terminado hace ${extra} segundos` : `Quedan ${rem} segundos${parado ? ', reloj parado' : ''}`}>
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" class="reloj-fondo" /><circle cx="50" cy="50" r="45" class="reloj-arco" style={{ strokeDashoffset: `${283 * (1 - frac)}` }} /></svg>
            <span class="reloj-n">{s.espera ? <><small>¡Tiempo!</small>+{mmss(extra)}</> : mmss(rem)}</span>
          </div>
          {parado ? <p class="aviso">Reloj parado: tómate el tiempo que necesites.</p> : null}
          <div class="ajuste" role="group" aria-label="Ajustar el descanso">
            {!s.espera ? <button type="button" class="boton secundario" onClick={() => cambiar((st, t) => adjust(st, -15, t))}>−15 s</button> : null}
            <button type="button" class="boton secundario" onClick={() => cambiar((st, t) => adjust(st, 15, t))}>+15 s</button>
            {!s.espera ? <button type="button" class="boton secundario" onClick={() => cambiar(parado ? resume : pause)}>{parado ? 'Seguir el reloj' : 'Parar el reloj'}</button> : null}
          </div>
          {sig ? (
            <section class="que-viene" aria-label="Qué viene">
              <p class="grupo-t">Después</p>
              <div class="fila-pauta">
                <span class="fila-img">{sigEx ? <img src={figureUrls(sigEx)[0]} alt="" /> : <span class="icono-descanso" aria-hidden="true">{sig.type === 'resumen' ? '✓' : '⏸'}</span>}</span>
                <span class="fila-texto"><strong>{sigEx?.name.es ?? (sig.type === 'resumen' ? '¡Terminas!' : REST_TYPES[sig.restType]?.es)}</strong><span>{detalleSig}</span></span>
              </div>
              {sigEx ? <ComoSeHace ex={sigEx} proText={!!p.show?.proText} abierto={false} /> : null}
            </section>
          ) : null}
        </div>
        <div class="sesion-acciones">
          {s.espera
            ? <button type="button" class="boton grande" onClick={() => cambiar(next)}>Continuar con el siguiente</button>
            : <button type="button" class="boton grande secundario" onClick={() => cambiar(skip)}>Saltar descanso</button>}
        </div>
      </main>
    );
  }

  // preparar, trabajo, mantener, trabajoTiempo
  const lado = step.side ? SIDE_LABEL[step.side] : null;
  const conReloj = step.type === 'mantener' || step.type === 'trabajoTiempo';
  const parado = s.pausa != null;
  return (
    <main class="pantalla paciente sesion">
      {cabecera}
      <div class="sesion-figura">{ex ? <Figura ex={ex} /> : null}</div>
      <div class="sesion-cuerpo">
        <div>
          <h1 class="h1-sesion">{nombre}</h1>
          {step.type === 'preparar' ? <p><strong>{doseText(it, p.format)}</strong></p> : lado ? <p class="etiqueta-paso">{lado}</p> : null}
        </div>
        {step.type === 'preparar' ? (
          <>
            {it.note ? <div class="mensaje"><p>{it.note}</p></div> : null}
            <ComoSeHace ex={ex} proText={!!p.show?.proText} abierto={false} />
          </>
        ) : (
          <>
            <div class="contadores">
              <div><small>Serie</small><b>{step.set} <span>de {step.sets}</span></b></div>
              {step.type === 'trabajoTiempo' ? <div><small>Tiempo</small><b>{fmtDur(step.dur)}</b></div>
                : <div><small>{step.type === 'mantener' ? 'Repetición' : 'Repeticiones'}</small>
                    <b>{step.type === 'mantener' ? <>{step.rep} <span>de {step.reps}</span></> : step.reps}</b></div>}
            </div>
            {conReloj ? (
              <div class="aguante" role="timer" aria-label={`${step.type === 'mantener' ? 'Mantén' : 'Trabaja'}, quedan ${rem} segundos`}>
                <div class="aguante-fila"><span>{step.type === 'mantener' ? 'Mantén' : 'Trabaja'}{parado ? ' (parado)' : ''}</span><span>{mmss(rem)}{rem < 60 ? ' s' : ''}</span></div>
                <div class="aguante-barra"><span style={{ width: `${(1 - fractionLeft(s, now)) * 100}%` }} /></div>
              </div>
            ) : null}
            {conReloj ? (
              <div class="ajuste" role="group" aria-label="Ajustar el tiempo">
                <button type="button" class="boton secundario" onClick={() => cambiar((st, t) => adjust(st, -5, t))}>−5 s</button>
                <button type="button" class="boton secundario" onClick={() => cambiar((st, t) => adjust(st, 5, t))}>+5 s</button>
              </div>
            ) : null}
            {it.load ? <p class="apagado">{it.load}</p> : null}
            <ComoSeHace ex={ex} proText={!!p.show?.proText} abierto={false} />
          </>
        )}
      </div>
      <div class="sesion-acciones">
        {step.type === 'preparar' ? <button type="button" class="boton grande" onClick={() => { sonar('inicio'); cambiar(next); }}>Empezar</button>
          : step.type === 'trabajo' ? <button type="button" class="boton grande" onClick={() => cambiar(next)}>{step.side === 'derecho' ? 'Lado hecho' : 'Serie hecha'}</button>
          : (
            <>
              <button type="button" class="boton secundario grande" onClick={() => cambiar(parado ? resume : pause)}>{parado ? 'Seguir' : 'Parar'}</button>
              <button type="button" class="boton grande" onClick={() => cambiar(skip)}>Hecho</button>
            </>
          )}
      </div>
    </main>
  );
}
