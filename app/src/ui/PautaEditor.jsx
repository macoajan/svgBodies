import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { Stepper, Interruptor, debounce } from './controles.jsx';
import { useLibrary } from './useLibrary.js';
import { figureUrls } from '../lib/library.js';
import { navigate } from '../router.js';
import { version, getPauta, savePauta, listPacientes, savePaciente, duplicatePauta, deletePauta, nuevasRespuestas, getRespuestas } from '../data/repo.js';
import { retirar, mensajeError } from '../data/envio-service.js';
import { ajustes } from '../data/app-store.js';
import { estadoEnvio, ESTADO_LABEL, pautaParaEnviar } from '../domain/envio.js';
import { esPro } from '../data/pro.js';
import { savePlantilla } from '../data/repo.js';
import { compartirArchivo } from '../platform/share.js';
import { updatePauta, updateItem, updateSet, insertRest, moveItem, removeItem, duplicateItem, scheduleText, doseShort, summary, problems, PAUTA_RANGES, ITEM_RANGES, REST_ITEM_RANGE } from '../domain/pautas.js';
import { LIMITS, REST_TYPES, isRestItem, itemName, setSpec, fmtDur } from '@shared/pauta-schema.js';
import { BloqueoPro } from './ProCompra.jsx';

/** Selector de paciente con opción de crear uno nuevo en el momento. */
function SelectorPaciente({ value, onChange }) {
  version.value;
  const [nuevo, setNuevo] = useState(null);
  const pacientes = listPacientes();
  if (nuevo !== null) {
    return (
      <form class="fila-form" onSubmit={async e => { e.preventDefault(); if (!nuevo.trim()) return; onChange(await savePaciente({ alias: nuevo })); setNuevo(null); }}>
        <label class="campo crece"><span>Alias del nuevo paciente</span>
          <input type="text" value={nuevo} maxLength={60} autoFocus onInput={e => setNuevo(e.currentTarget.value)} autoComplete="off" />
        </label>
        <button class="boton" type="submit" disabled={!nuevo.trim()}>Crear</button>
        <button class="boton secundario" type="button" onClick={() => setNuevo(null)}>Cancelar</button>
      </form>
    );
  }
  return (
    <label class="campo"><span>Paciente</span>
      <select value={value || ''} onChange={e => { const v = e.currentTarget.value; if (v === '__nuevo') setNuevo(''); else onChange(v || null); }}>
        <option value="">Sin paciente</option>
        {pacientes.map(p => <option key={p.id} value={p.id}>{p.alias}</option>)}
        <option value="__nuevo">+ Nuevo paciente…</option>
      </select>
    </label>
  );
}

const TIPOS = Object.entries(REST_TYPES);

/** Selector del tipo de descanso. */
function TipoDescanso({ id, label = 'Tipo de descanso', value, onChange }) {
  return (
    <label class="campo"><span>{label}</span>
      <select id={id} value={value || 'descanso'} onChange={e => onChange(e.currentTarget.value)}>
        {TIPOS.map(([k, t]) => <option key={k} value={k}>{t.es}</option>)}
      </select>
    </label>
  );
}

/** Segmentado de dos opciones (repeticiones o tiempo). */
/** @param {{ label: string, value: string, onChange: (v: string) => void }} props */
function Modo({ label, value, onChange }) {
  return (
    <div class="segmentos modo" role="radiogroup" aria-label={label}>
      {[['reps', 'Repeticiones'], ['tiempo', 'Por tiempo']].map(([v, l]) => (
        <button type="button" key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

/** Acciones comunes: subir, bajar, duplicar, descanso detrás y quitar. */
function Acciones({ i, n, nombre, onMove, onDup, onRemove, onRestAfter }) {
  return (
    <div class="item-acciones">
      <button type="button" class="boton secundario" disabled={i === 0} onClick={() => onMove(i - 1)} aria-label={`Subir ${nombre}`}>↑ Subir</button>
      <button type="button" class="boton secundario" disabled={i === n - 1} onClick={() => onMove(i + 1)} aria-label={`Bajar ${nombre}`}>↓ Bajar</button>
      <button type="button" class="boton secundario" disabled={n >= LIMITS.items} onClick={onDup}>Duplicar</button>
      <button type="button" class="boton secundario" disabled={n >= LIMITS.items} onClick={onRestAfter}>+ Descanso detrás</button>
      <button type="button" class="boton peligro" onClick={onRemove}>Quitar</button>
    </div>
  );
}

/** Series a medida: cada serie con sus repeticiones o su tiempo y el descanso que la sigue. */
function SeriesAMedida({ it, i, onSet }) {
  return (
    <ol class="series-medida">
      {Array.from({ length: it.sets }, (_, k) => {
        const sp = setSpec(it, k);
        const modo = sp.time != null ? 'tiempo' : 'reps';
        return (
          <li key={k} class="serie-fila">
            <p class="grupo-t">Serie {k + 1}</p>
            <Modo label={`Serie ${k + 1}: repeticiones o tiempo`} value={modo} onChange={m => onSet(k, { modo: m })} />
            <div class="steppers">
              {modo === 'tiempo'
                ? <Stepper id={`ps-t-${i}-${k}`} label="Tiempo" unit="s" value={sp.time} min={1} max={ITEM_RANGES.time[1]} step={5} onChange={v => onSet(k, { time: v })} />
                : <Stepper id={`ps-r-${i}-${k}`} label={it.perSide ? 'Repeticiones por lado' : 'Repeticiones'} value={sp.reps} min={1} max={ITEM_RANGES.reps[1]} onChange={v => onSet(k, { reps: v })} />}
              {k < it.sets - 1 ? <Stepper id={`ps-d-${i}-${k}`} label="Descanso después" unit="s" value={sp.rest} min={0} max={ITEM_RANGES.restSet[1]} step={15} onChange={v => onSet(k, { rest: v })} /> : null}
            </div>
            {k < it.sets - 1 && sp.rest > 0 ? <TipoDescanso id={`ps-tipo-${i}-${k}`} value={sp.restType} onChange={v => onSet(k, { restType: v })} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Tarjeta de un elemento: ejercicio o descanso. Plegada muestra el resumen; abierta, todo. */
function Item({ it, i, n, ex, restBetween, abierto, onToggle, onChange, onSet, onMove, onDup, onRemove, onRestAfter }) {
  const descanso = isRestItem(it);
  const nombre = itemName(it, ex ? new Map([[it.id, ex]]) : null);
  const panel = `item-${i}`;
  const acciones = <Acciones i={i} n={n} nombre={nombre} onMove={onMove} onDup={onDup} onRemove={onRemove} onRestAfter={onRestAfter} />;
  return (
    <li class={`item${abierto ? ' abierto' : ''}${descanso ? ' item-descanso' : ''}`}>
      <button type="button" class="item-cab" aria-expanded={abierto} aria-controls={panel} onClick={onToggle}>
        <span class="item-n">{String(i + 1).padStart(2, '0')}</span>
        <span class="fila-img">{descanso ? <span class="icono-descanso" aria-hidden="true">⏸</span> : ex ? <img src={figureUrls(ex)[0]} alt="" loading="lazy" /> : null}</span>
        <span class="fila-texto"><strong>{nombre}</strong><span>{doseShort(it)}</span></span>
        <span class="item-chevron" aria-hidden="true">{abierto ? '▴' : '▾'}</span>
      </button>
      {abierto && descanso ? (
        <div id={panel} class="item-panel">
          <TipoDescanso id={`tipo-${i}`} value={it.id} onChange={v => onChange({ id: v })} />
          <div class="steppers">
            <Stepper id={`dur-${i}`} label="Duración" unit="s" value={it.time} min={REST_ITEM_RANGE[0]} max={REST_ITEM_RANGE[1]} step={15} onChange={v => onChange({ time: v })} />
          </div>
          <p class="apagado">{fmtDur(it.time)}. Al terminar, el paciente pulsa «Continuar con el siguiente».</p>
          <label class="campo"><span>Nota</span>
            <textarea rows={2} value={it.note ?? ''} maxLength={LIMITS.itemNote} placeholder="Camina suave, sin parar." onInput={e => onChange({ note: e.currentTarget.value }, true)} />
          </label>
          {acciones}
        </div>
      ) : abierto ? (
        <div id={panel} class="item-panel">
          {!ex ? <p class="aviso error">Este ejercicio no está en la biblioteca de esta versión.</p> : null}
          <p class="grupo-t">Trabajo</p>
          <div class="steppers">
            <Stepper id={`sets-${i}`} label="Series" value={it.sets} min={ITEM_RANGES.sets[0]} max={ITEM_RANGES.sets[1]} onChange={v => onChange({ sets: v })} />
          </div>
          <Interruptor label="Series a medida" detalle="Repeticiones, tiempo y descanso distintos en cada serie" checked={!!it.perSet} onChange={v => onChange({ perSet: v })} />
          {it.perSet ? <SeriesAMedida it={it} i={i} onSet={onSet} /> : (
            <>
              <Modo label="Repeticiones o tiempo" value={it.time != null ? 'tiempo' : 'reps'} onChange={m => onChange({ modo: m })} />
              <div class="steppers">
                {it.time != null
                  ? <Stepper id={`time-${i}`} label="Tiempo por serie" unit="s" value={it.time} min={1} max={ITEM_RANGES.time[1]} step={5} onChange={v => onChange({ time: v })} />
                  : <>
                      <Stepper id={`reps-${i}`} label={it.perSide ? 'Repeticiones por lado' : 'Repeticiones'} value={it.reps} min={1} max={ITEM_RANGES.reps[1]} onChange={v => onChange({ reps: v })} />
                      <Stepper id={`hold-${i}`} label="Mantener" unit="s" value={it.hold} optional min={1} max={ITEM_RANGES.hold[1]} step={5} onChange={v => onChange({ hold: v })} />
                    </>}
              </div>
            </>
          )}
          <Interruptor label="Con cada lado" detalle="Ejercicio unilateral: se repite con el otro lado" checked={!!it.perSide} onChange={v => onChange({ perSide: v })} />
          <p class="grupo-t">Descansos</p>
          <div class="steppers">
            {(it.reps ?? 1) > 1 && it.time == null && !it.perSet ? <Stepper id={`rr-${i}`} label="Entre repeticiones" unit="s" value={it.restRep} optional min={0} max={ITEM_RANGES.restRep[1]} onChange={v => onChange({ restRep: v })} /> : null}
            {it.perSide ? <Stepper id={`rs-${i}`} label="Al cambiar de lado" unit="s" value={it.restSide} optional min={0} max={ITEM_RANGES.restSide[1]} step={5} onChange={v => onChange({ restSide: v })} /> : null}
            {it.sets > 1 && !it.perSet ? <Stepper id={`rset-${i}`} label="Entre series" unit="s" value={it.restSet} optional min={0} max={ITEM_RANGES.restSet[1]} step={15} onChange={v => onChange({ restSet: v })} /> : null}
            {i < n - 1 ? <Stepper id={`ra-${i}`} label="Al terminar" unit="s" value={it.restAfter} optional placeholder={String(restBetween)} min={0} max={ITEM_RANGES.restAfter[1]} step={15} onChange={v => onChange({ restAfter: v })} /> : null}
          </div>
          {it.sets > 1 && !it.perSet && it.restSet > 0 ? <TipoDescanso id={`rtipo-${i}`} label="Tipo de descanso entre series" value={it.restType} onChange={v => onChange({ restType: v })} /> : null}
          <label class="campo"><span>Carga o ángulo</span>
            <input type="text" value={it.load ?? ''} maxLength={LIMITS.load} placeholder="Banda roja, 60° de rodilla…" onInput={e => onChange({ load: e.currentTarget.value }, true)} />
          </label>
          <label class="campo"><span>Nota para este ejercicio</span>
            <textarea rows={2} value={it.note ?? ''} maxLength={LIMITS.itemNote} placeholder="Si molesta, baja menos." onInput={e => onChange({ note: e.currentTarget.value }, true)} />
          </label>
          {acciones}
        </div>
      ) : null}
    </li>
  );
}

export function PautaEditor({ params }) {
  const { lib } = useLibrary();
  const id = params.id;
  const inicial = useMemo(() => getPauta(id), [id]);
  const [pauta, setPauta] = useState(inicial?.pauta);
  const [pacienteId, setPacienteId] = useState(inicial?.pacienteId ?? null);
  const [abierto, setAbierto] = useState(null);
  const [confirmar, setConfirmar] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState('');
  const [aviso, setAviso] = useState('');
  const [generando, setGenerando] = useState(false);
  version.value;

  // Guardado automático: inmediato para botones, con retardo para lo que se escribe.
  const guardar = useRef(debounce(p => savePauta(id, { pauta: p }), 400)).current;
  useEffect(() => () => guardar.flush(), []);
  // Cada cambio se aplica sobre la última versión (ref), no sobre la del último pintado: dos
  // toques seguidos no se pisan.
  const ultima = useRef(pauta);
  const cambiar = (f, escribiendo = false) => {
    const p = f(ultima.current);
    ultima.current = p;
    setPauta(p); guardar(p); if (!escribiendo) guardar.flush();
  };

  if (!inicial || !pauta) {
    return <main class="pantalla con-nav"><Barra titulo="Pauta" volver="/pro" ajustes={false} /><h1>Pauta no encontrada</h1></main>;
  }
  const known = lib ? new Set(lib.byId.keys()) : null;
  const est = lib ? summary(pauta, lib.byId) : null;
  const avisos = known && pauta.items.length ? problems(pauta, known) : [];
  const restBetween = pauta.restBetween ?? 90;

  return (
    <main class="pantalla con-nav editor">
      <Barra titulo="Pauta" volver="/pro" ajustes={false} />
      <label class="campo"><span>Título</span>
        <input type="text" class="titulo-pauta" value={pauta.title ?? ''} maxLength={LIMITS.title} placeholder="Rodilla · fase 1"
          onInput={e => cambiar(p => updatePauta(p, { title: e.currentTarget.value }), true)} />
      </label>
      <SelectorPaciente value={pacienteId} onChange={v => { setPacienteId(v); savePauta(id, { pacienteId: v }); }} />
      <p class="resumen-pauta" aria-live="polite">
        {scheduleText(pauta.schedule)}
        {est && pauta.items.length ? <> · ~{est.minutes} min · ~{est.kcal} kcal</> : null}
      </p>

      <section class="bloque" aria-labelledby="ej-t">
        <div class="cabecera-lista">
          <h2 id="ej-t">Ejercicios y descansos <span class="apagado">({pauta.items.length}/{LIMITS.items})</span></h2>
        </div>
        {pauta.items.length ? (
          <ol class="items">
            {pauta.items.map((it, i) => (
              <Item key={`${i}-${it.id}`} it={it} i={i} n={pauta.items.length} ex={lib?.byId.get(it.id)} restBetween={restBetween}
                abierto={abierto === i} onToggle={() => setAbierto(abierto === i ? null : i)}
                onChange={(patch, escribiendo) => cambiar(p => updateItem(p, i, patch), escribiendo)}
                onSet={(k, patch) => cambiar(p => updateSet(p, i, k, patch))}
                onRestAfter={() => { cambiar(p => insertRest(p, i + 1).pauta); setAbierto(i + 1); }}
                onMove={to => { cambiar(p => moveItem(p, i, to)); setAbierto(to); }}
                onDup={() => cambiar(p => duplicateItem(p, i))}
                onRemove={() => { cambiar(p => removeItem(p, i)); setAbierto(null); }} />
            ))}
          </ol>
        ) : <p class="aviso">Todavía no hay ejercicios.</p>}
        <div class="item-acciones">
        <a class="boton" href={`#/pro/catalogo?para=${id}`} aria-disabled={pauta.items.length >= LIMITS.items}
          onClick={e => { if (pauta.items.length >= LIMITS.items) e.preventDefault(); else guardar.flush(); }}>+ Añadir ejercicios</a>
        <button type="button" class="boton secundario" disabled={pauta.items.length >= LIMITS.items}
          onClick={() => { cambiar(p => insertRest(p).pauta); setAbierto(ultima.current.items.length - 1); }}>+ Añadir descanso</button>
        </div>
      </section>

      <section class="bloque" aria-labelledby="cal-t">
        <h2 id="cal-t">Calendario y descansos</h2>
        <div class="steppers">
          <Stepper id="perWeek" label="Días por semana" value={pauta.schedule?.perWeek} optional min={PAUTA_RANGES.perWeek[0]} max={PAUTA_RANGES.perWeek[1]}
            onChange={v => cambiar(p => updatePauta(p, { perWeek: v ?? '' }))} />
          <Stepper id="weeks" label="Semanas" value={pauta.schedule?.weeks} optional min={PAUTA_RANGES.weeks[0]} max={PAUTA_RANGES.weeks[1]}
            onChange={v => cambiar(p => updatePauta(p, { weeks: v ?? '' }))} />
          <Stepper id="restBetween" label="Descanso entre ejercicios" unit="s" value={restBetween} min={0} max={PAUTA_RANGES.restBetween[1]} step={15}
            onChange={v => cambiar(p => updatePauta(p, { restBetween: v ?? 0 }))} />
        </div>
      </section>

      <section class="bloque" aria-labelledby="pac-t">
        <h2 id="pac-t">Para el paciente</h2>
        <label class="campo"><span>Mensaje</span>
          <textarea rows={3} value={pauta.note ?? ''} maxLength={LIMITS.note} placeholder="Si molesta la rodilla, baja menos. Nos vemos el día 24."
            onInput={e => cambiar(p => updatePauta(p, { note: e.currentTarget.value }), true)} />
        </label>
        <Interruptor label="Mostrar calorías estimadas" detalle="Desactívalo si no conviene a este paciente" checked={!!pauta.show?.kcal} onChange={v => cambiar(p => updatePauta(p, { kcal: v }))} />
        <Interruptor label="Mostrar el texto técnico" detalle="Objetivo y notas profesionales de cada ejercicio" checked={!!pauta.show?.proText} onChange={v => cambiar(p => updatePauta(p, { proText: v }))} />
      </section>

      {avisos.length ? <ul class="aviso error" role="status">{avisos.map(a => <li key={a}>{a}</li>)}</ul> : null}
      <p class="apagado">Se guarda sola en este dispositivo.</p>
      <div class="acciones-envio">
        {(() => {
          const rec = getPauta(id);
          const est = estadoEnvio({ ...rec, pauta }, ajustes.value);
          const total = getRespuestas(id).items.length, nuevas = nuevasRespuestas(id);
          return (
            <>
              <a class="boton" href={`#/pro/pauta/${id}/enviar`} onClick={() => guardar.flush()}>
                {est === 'borrador' ? 'Enviar al paciente' : est === 'cambios' ? 'Actualizar envío' : 'Ver envío y QR'}
              </a>
              {est !== 'borrador' ? <span class="sello">{ESTADO_LABEL[est]}</span> : null}
              {rec?.envio && !rec.envio.offline ? (
                <a class="boton secundario" href={`#/pro/pauta/${id}/respuestas`}>
                  Respuestas{total ? ` (${total})` : ''}{nuevas ? <span class="punto-nuevo" aria-label={`${nuevas} nuevas`}>{nuevas}</span> : null}
                </a>
              ) : null}
            </>
          );
        })()}
      </div>

      <section class="bloque" aria-labelledby="pro-t">
        <h2 id="pro-t">Más</h2>
        {esPro.value ? (
          <div class="item-acciones">
            <button type="button" class="boton secundario" disabled={!pauta.items.length} onClick={async () => { await savePlantilla(pauta, pauta.title); setAviso('Guardada como plantilla. La tienes en «Mis pautas».'); }}>Guardar como plantilla</button>
            <button type="button" class="boton secundario" disabled={!pauta.items.length || !lib || generando} onClick={async () => {
              setGenerando(true); setAviso('');
              try {
                const { generarPdf } = await import('../lib/pdf.js');
                const rec = getPauta(id);
                const base64 = await generarPdf({ pauta: pautaParaEnviar(pauta, ajustes.value), byId: lib.byId, ajustes: ajustes.value, link: rec?.envio?.link });
                const nombre = `${(pauta.title || 'pauta').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'pauta'}.pdf`;
                await compartirArchivo({ base64, nombre, mime: 'application/pdf', title: pauta.title || 'Pauta' });
              } catch (e) { setAviso(`No se pudo crear el PDF (${e?.message || e}).`); }
              setGenerando(false);
            }}>{generando ? 'Creando PDF…' : 'PDF'}</button>
          </div>
        ) : <BloqueoPro texto="Plantillas y PDF de la pauta" />}
        <div aria-live="polite">{aviso ? <p class="aviso ok">{aviso}</p> : null}</div>
      </section>
      <div class="item-acciones">
        <button type="button" class="boton secundario" onClick={async () => { guardar.flush(); const nid = await duplicatePauta(id); navigate(`/pro/pauta/${nid}`); }}>Duplicar pauta</button>
        {confirmar ? (
          <>
            <button type="button" class="boton peligro" onClick={async () => {
              try { if (getPauta(id)?.envio) await retirar(id); } catch (e) { setErrorBorrar(`No se pudo retirar el enlace: ${mensajeError(e)}`); return; }
              await deletePauta(id); navigate('/pro', undefined, { replace: true });
            }}>Sí, eliminar</button>
            <button type="button" class="boton secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
          </>
        ) : <button type="button" class="boton peligro" onClick={() => setConfirmar(true)}>Eliminar pauta</button>}
      </div>
      {confirmar && getPauta(id)?.envio ? <p class="apagado">Se retirará también el enlace que tiene el paciente.</p> : null}
      {errorBorrar ? <p class="aviso error" role="alert">{errorBorrar}</p> : null}
    </main>
  );
}
