import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { Stepper, Interruptor, debounce } from './controles.jsx';
import { useLibrary } from './useLibrary.js';
import { figureUrls } from '../lib/library.js';
import { navigate } from '../router.js';
import { version, getPauta, savePauta, listPacientes, savePaciente, duplicatePauta, deletePauta } from '../data/repo.js';
import { updatePauta, updateItem, moveItem, removeItem, duplicateItem, scheduleText, doseShort, summary, problems, PAUTA_RANGES, ITEM_RANGES } from '../domain/pautas.js';
import { LIMITS } from '@shared/pauta-schema.js';

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

/** Tarjeta de un ejercicio: resumen plegado y, abierta, su dosis y descansos. */
function Item({ it, i, n, ex, restBetween, abierto, onToggle, onChange, onMove, onDup, onRemove }) {
  const nombre = ex?.name?.es ?? it.id;
  const panel = `item-${i}`;
  return (
    <li class={`item${abierto ? ' abierto' : ''}`}>
      <button type="button" class="item-cab" aria-expanded={abierto} aria-controls={panel} onClick={onToggle}>
        <span class="item-n">{String(i + 1).padStart(2, '0')}</span>
        <span class="fila-img">{ex ? <img src={figureUrls(ex)[0]} alt="" loading="lazy" /> : null}</span>
        <span class="fila-texto"><strong>{nombre}</strong><span>{doseShort(it)}</span></span>
        <span class="item-chevron" aria-hidden="true">{abierto ? '▴' : '▾'}</span>
      </button>
      {abierto ? (
        <div id={panel} class="item-panel">
          {!ex ? <p class="aviso error">Este ejercicio no está en la biblioteca de esta versión.</p> : null}
          <p class="grupo-t">Trabajo</p>
          <div class="steppers">
            <Stepper id={`sets-${i}`} label="Series" value={it.sets} min={ITEM_RANGES.sets[0]} max={ITEM_RANGES.sets[1]} onChange={v => onChange({ sets: v })} />
            <Stepper id={`reps-${i}`} label={it.perSide ? 'Repeticiones por lado' : 'Repeticiones'} value={it.reps} min={1} max={ITEM_RANGES.reps[1]} onChange={v => onChange({ reps: v })} />
            <Stepper id={`hold-${i}`} label="Mantener" unit="s" value={it.hold} optional min={1} max={ITEM_RANGES.hold[1]} step={5} onChange={v => onChange({ hold: v })} />
          </div>
          <Interruptor label="Con cada lado" detalle="Ejercicio unilateral: se repite con el otro lado" checked={!!it.perSide} onChange={v => onChange({ perSide: v })} />
          <p class="grupo-t">Descansos</p>
          <div class="steppers">
            {(it.reps ?? 1) > 1 ? <Stepper id={`rr-${i}`} label="Entre repeticiones" unit="s" value={it.restRep} optional min={0} max={ITEM_RANGES.restRep[1]} onChange={v => onChange({ restRep: v })} /> : null}
            {it.perSide ? <Stepper id={`rs-${i}`} label="Al cambiar de lado" unit="s" value={it.restSide} optional min={0} max={ITEM_RANGES.restSide[1]} step={5} onChange={v => onChange({ restSide: v })} /> : null}
            {it.sets > 1 ? <Stepper id={`rset-${i}`} label="Entre series" unit="s" value={it.restSet} optional min={0} max={ITEM_RANGES.restSet[1]} step={15} onChange={v => onChange({ restSet: v })} /> : null}
            {i < n - 1 ? <Stepper id={`ra-${i}`} label="Al terminar" unit="s" value={it.restAfter} optional placeholder={String(restBetween)} min={0} max={ITEM_RANGES.restAfter[1]} step={15} onChange={v => onChange({ restAfter: v })} /> : null}
          </div>
          <label class="campo"><span>Carga o ángulo</span>
            <input type="text" value={it.load ?? ''} maxLength={LIMITS.load} placeholder="Banda roja, 60° de rodilla…" onInput={e => onChange({ load: e.currentTarget.value }, true)} />
          </label>
          <label class="campo"><span>Nota para este ejercicio</span>
            <textarea rows={2} value={it.note ?? ''} maxLength={LIMITS.itemNote} placeholder="Si molesta, baja menos." onInput={e => onChange({ note: e.currentTarget.value }, true)} />
          </label>
          <div class="item-acciones">
            <button type="button" class="boton secundario" disabled={i === 0} onClick={() => onMove(i - 1)} aria-label={`Subir ${nombre}`}>↑ Subir</button>
            <button type="button" class="boton secundario" disabled={i === n - 1} onClick={() => onMove(i + 1)} aria-label={`Bajar ${nombre}`}>↓ Bajar</button>
            <button type="button" class="boton secundario" disabled={n >= LIMITS.items} onClick={onDup}>Duplicar</button>
            <button type="button" class="boton peligro" onClick={onRemove}>Quitar</button>
          </div>
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

  // Guardado automático: inmediato para botones, con retardo para lo que se escribe.
  const guardar = useRef(debounce(p => savePauta(id, { pauta: p }), 400)).current;
  useEffect(() => () => guardar.flush(), []);
  const cambiar = (p, escribiendo = false) => { setPauta(p); guardar(p); if (!escribiendo) guardar.flush(); };

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
          onInput={e => cambiar(updatePauta(pauta, { title: e.currentTarget.value }), true)} />
      </label>
      <SelectorPaciente value={pacienteId} onChange={v => { setPacienteId(v); savePauta(id, { pacienteId: v }); }} />
      <p class="resumen-pauta" aria-live="polite">
        {scheduleText(pauta.schedule)}
        {est && pauta.items.length ? <> · ~{est.minutes} min · ~{est.kcal} kcal</> : null}
      </p>

      <section class="bloque" aria-labelledby="ej-t">
        <div class="cabecera-lista">
          <h2 id="ej-t">Ejercicios <span class="apagado">({pauta.items.length}/{LIMITS.items})</span></h2>
        </div>
        {pauta.items.length ? (
          <ol class="items">
            {pauta.items.map((it, i) => (
              <Item key={`${i}-${it.id}`} it={it} i={i} n={pauta.items.length} ex={lib?.byId.get(it.id)} restBetween={restBetween}
                abierto={abierto === i} onToggle={() => setAbierto(abierto === i ? null : i)}
                onChange={(patch, escribiendo) => cambiar(updateItem(pauta, i, patch), escribiendo)}
                onMove={to => { cambiar(moveItem(pauta, i, to)); setAbierto(to); }}
                onDup={() => cambiar(duplicateItem(pauta, i))}
                onRemove={() => { cambiar(removeItem(pauta, i)); setAbierto(null); }} />
            ))}
          </ol>
        ) : <p class="aviso">Todavía no hay ejercicios.</p>}
        <a class="boton" href={`#/pro/catalogo?para=${id}`} aria-disabled={pauta.items.length >= LIMITS.items}
          onClick={e => { if (pauta.items.length >= LIMITS.items) e.preventDefault(); else guardar.flush(); }}>+ Añadir ejercicios</a>
      </section>

      <section class="bloque" aria-labelledby="cal-t">
        <h2 id="cal-t">Calendario y descansos</h2>
        <div class="steppers">
          <Stepper id="perWeek" label="Días por semana" value={pauta.schedule?.perWeek} optional min={PAUTA_RANGES.perWeek[0]} max={PAUTA_RANGES.perWeek[1]}
            onChange={v => cambiar(updatePauta(pauta, { perWeek: v ?? '' }))} />
          <Stepper id="weeks" label="Semanas" value={pauta.schedule?.weeks} optional min={PAUTA_RANGES.weeks[0]} max={PAUTA_RANGES.weeks[1]}
            onChange={v => cambiar(updatePauta(pauta, { weeks: v ?? '' }))} />
          <Stepper id="restBetween" label="Descanso entre ejercicios" unit="s" value={restBetween} min={0} max={PAUTA_RANGES.restBetween[1]} step={15}
            onChange={v => cambiar(updatePauta(pauta, { restBetween: v ?? 0 }))} />
        </div>
      </section>

      <section class="bloque" aria-labelledby="pac-t">
        <h2 id="pac-t">Para el paciente</h2>
        <label class="campo"><span>Mensaje</span>
          <textarea rows={3} value={pauta.note ?? ''} maxLength={LIMITS.note} placeholder="Si molesta la rodilla, baja menos. Nos vemos el día 24."
            onInput={e => cambiar(updatePauta(pauta, { note: e.currentTarget.value }), true)} />
        </label>
        <Interruptor label="Mostrar calorías estimadas" detalle="Desactívalo si no conviene a este paciente" checked={!!pauta.show?.kcal} onChange={v => cambiar(updatePauta(pauta, { kcal: v }))} />
        <Interruptor label="Mostrar el texto técnico" detalle="Objetivo y notas profesionales de cada ejercicio" checked={!!pauta.show?.proText} onChange={v => cambiar(updatePauta(pauta, { proText: v }))} />
      </section>

      {avisos.length ? <ul class="aviso error" role="status">{avisos.map(a => <li key={a}>{a}</li>)}</ul> : null}
      <p class="apagado">Se guarda sola en este dispositivo. El envío al paciente llega en la fase F3.</p>

      <div class="item-acciones">
        <button type="button" class="boton secundario" onClick={async () => { guardar.flush(); const nid = await duplicatePauta(id); navigate(`/pro/pauta/${nid}`); }}>Duplicar pauta</button>
        {confirmar ? (
          <>
            <button type="button" class="boton peligro" onClick={async () => { await deletePauta(id); navigate('/pro', undefined, { replace: true }); }}>Sí, eliminar</button>
            <button type="button" class="boton secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
          </>
        ) : <button type="button" class="boton peligro" onClick={() => setConfirmar(true)}>Eliminar pauta</button>}
      </div>
    </main>
  );
}
