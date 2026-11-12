import { useEffect, useRef, useState } from 'preact/hooks';
import { useLibrary } from './useLibrary.js';
import { Figura } from './Figura.jsx';
import { ComoSeHace } from './PautaRecibida.jsx';
import { navigate } from '../router.js';
import { ajustes } from '../data/app-store.js';
import { getRecibida, guardarSesion, terminarSesion } from '../data/recibidas.js';
import { buildPlan, start, next, tick, remaining, fractionLeft, adjust, skip, pause, resume, rate, toRespuesta, progress, current, upcomingTimers, REST, SIDE_LABEL } from '../domain/ejecucion.js';
import { doseText, estimateSession, DEFAULTS } from '@shared/pauta-schema.js';
import { sonar, vibrar, pantallaEncendida, programarAvisos } from '../platform/avisos.js';

const Cerrar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const REST_LABEL = { descansoRep: 'Pausa entre repeticiones', descansoSerie: 'Descanso entre series', descansoEjercicio: 'Descanso', cambioLado: 'Cambia de lado' };
const mmss = s => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s));

/** Recupera la sesión guardada si corresponde a esta misma pauta; si no, empieza una nueva. */
function cargar(rec, now) {
  const plan = buildPlan(rec.pauta);
  const s = rec.sesion;
  if (s && s.plan?.length === plan.length && s.plan.every((p, k) => p.type === plan[k].type && p.i === plan[k].i)) return s;
  return start(plan, now);
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
  const [s, setS] = useState(() => (rec ? cargar(rec, Date.now()) : null));
  const [now, setNow] = useState(Date.now());
  const [envio, setEnvio] = useState(null); // null | 'enviando' | 'enviada' | 'pendiente'
  const ref = useRef(s);
  ref.current = s;
  const ultimoAviso = useRef(null);

  const cambiar = (fn) => {
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
      const prev = ref.current;
      const n = tick(prev, t);
      setNow(t);
      if (n !== prev) {
        ref.current = n; setS(n);
        const tipo = current(n)?.type;
        if (tipo === 'mantener') { sonar('inicio'); vibrar('fin'); }
        else { sonar('fin'); vibrar('fin'); }
        if (tipo !== 'resumen') guardarSesion(clave, n);
      } else {
        const rem = remaining(n, t);
        if (n.terminaEn != null && rem > 0 && rem <= 3 && ultimoAviso.current !== `${n.idx}:${rem}`) {
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
          title: u.manual ? 'Te toca' : REST.has(u.step.type) ? 'Fin del descanso' : 'Tiempo',
          body: u.manual ? `Vuelve a la app para seguir con ${nombre(u.step.i ?? 0)}.` : 'Sigue con tu sesión.',
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

  const cabecera = (
    <header class="sesion-cab">
      <button type="button" class="icono-btn" aria-label="Salir (se guarda dónde vas)" onClick={salir}><Cerrar /></button>
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
          <p>{min} min{p.show?.kcal && est ? ` · unas ${est.kcal} kcal` : ''} · {p.items.length} ejercicios</p>
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
    const siguiente = step.type === 'descansoEjercicio' ? lib?.byId.get(p.items[step.next]?.id) : null;
    const frac = fractionLeft(s, now);
    return (
      <main class="pantalla paciente sesion descanso">
        {cabecera}
        <div class="sesion-cuerpo centrado">
          <p class="etiqueta-paso">{step.type === 'cambioLado' ? `${REST_LABEL.cambioLado}: ${SIDE_LABEL[step.side]?.toLowerCase()}` : REST_LABEL[step.type]}</p>
          <div class="reloj" role="timer" aria-live="off" aria-label={`Quedan ${rem} segundos`}>
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" class="reloj-fondo" /><circle cx="50" cy="50" r="45" class="reloj-arco" style={{ strokeDashoffset: `${283 * (1 - frac)}` }} /></svg>
            <span class="reloj-n">{mmss(rem)}</span>
          </div>
          {siguiente ? <p>Siguiente: <strong>{siguiente.name.es}</strong></p>
            : step.type !== 'cambioLado' ? <p>{nombre}{step.type === 'descansoSerie' ? ` · serie ${step.set + 1} de ${it.sets}` : ''}</p> : <p>{nombre}</p>}
          <div class="ajuste" role="group" aria-label="Ajustar el descanso">
            <button type="button" class="boton secundario" onClick={() => cambiar((st, t) => adjust(st, -15, t))}>−15 s</button>
            <button type="button" class="boton secundario" onClick={() => cambiar((st, t) => adjust(st, 15, t))}>+15 s</button>
          </div>
        </div>
        <div class="sesion-acciones">
          <button type="button" class="boton secundario grande" onClick={() => cambiar(s.pausa != null ? resume : pause)}>{s.pausa != null ? 'Seguir' : 'Pausar'}</button>
          <button type="button" class="boton grande" onClick={() => cambiar(skip)}>Saltar</button>
        </div>
      </main>
    );
  }

  // preparar, trabajo, mantener
  const lado = step.side ? SIDE_LABEL[step.side] : null;
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
              <div><small>Serie</small><b>{step.set} <span>de {it.sets}</span></b></div>
              <div><small>{step.type === 'mantener' ? 'Repetición' : 'Repeticiones'}</small>
                <b>{step.type === 'mantener' ? <>{step.rep} <span>de {step.reps}</span></> : step.reps}</b></div>
            </div>
            {step.type === 'mantener' ? (
              <div class="aguante" role="timer" aria-label={`Mantén, quedan ${rem} segundos`}>
                <div class="aguante-fila"><span>Mantén</span><span>{rem} s</span></div>
                <div class="aguante-barra"><span style={{ width: `${(1 - fractionLeft(s, now)) * 100}%` }} /></div>
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
              <button type="button" class="boton secundario grande" onClick={() => cambiar(s.pausa != null ? resume : pause)}>{s.pausa != null ? 'Seguir' : 'Pausar'}</button>
              <button type="button" class="boton grande" onClick={() => cambiar(skip)}>Hecho</button>
            </>
          )}
      </div>
    </main>
  );
}
