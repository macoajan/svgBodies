import { useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { Figura } from './Figura.jsx';
import { useLibrary } from './useLibrary.js';
import { catalogoMemoria, anadirAPauta } from './Catalogo.jsx';
import { href } from '../router.js';
import { ajustes } from '../data/app-store.js';
import { kcalPerMin } from '../domain/catalogo.js';

const fmt1 = n => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });

function Musculos({ ex, vocab }) {
  const list = [...(ex.muscles || [])].sort((a, b) => b.pct - a.pct);
  if (!list.length) return null;
  return (
    <section class="bloque" aria-labelledby="mus">
      <h2 id="mus">Músculos</h2>
      <ul class="barras">
        {list.map(m => (
          <li key={m.id}>
            <span>{vocab.muscles[m.id]?.es ?? m.id}</span>
            <span class="barra-pista" aria-hidden="true"><span style={{ width: `${m.pct}%` }} /></span>
            <span class="barra-n">{m.pct} %</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Textos({ ex, byId }) {
  const sheet = ex.sheet;
  const [tab, setTab] = useState('pro');
  const link = id => byId.get(id) ? <a href={`#/pro/ejercicio/${id}`}>{byId.get(id).name.es}</a> : id;
  const relacion = (titulo, ids) => ids?.length ? <p><strong>{titulo}:</strong> {ids.map((id, i) => <>{i ? ', ' : ''}{link(id)}</>)}</p> : null;
  const rel = <>{relacion('Progresión', ex.progressions)}{relacion('Regresión', ex.regressions)}</>;
  if (!sheet) {
    return (
      <section class="bloque" aria-labelledby="como">
        <h2 id="como">Cómo se hace</h2>
        {ex.animation?.cue ? <p>{ex.animation.cue}</p> : <p class="apagado">Sin descripción.</p>}
        {rel}
      </section>
    );
  }
  return (
    <section class="bloque">
      <div class="segmentos pestañas" role="tablist" aria-label="Texto">
        <button type="button" role="tab" id="tab-pro" aria-selected={tab === 'pro'} aria-controls="panel-texto" onClick={() => setTab('pro')}>Profesional</button>
        <button type="button" role="tab" id="tab-pac" aria-selected={tab === 'pac'} aria-controls="panel-texto" onClick={() => setTab('pac')}>Paciente</button>
      </div>
      <div id="panel-texto" role="tabpanel" aria-labelledby={tab === 'pro' ? 'tab-pro' : 'tab-pac'} class="texto">
        {tab === 'pro' ? (
          <>
            <p><strong>Objetivo:</strong> {sheet.pro.goal}</p>
            {sheet.pro.notes?.length ? <ul>{sheet.pro.notes.map(n => <li key={n}>{n}</li>)}</ul> : null}
            {rel}
          </>
        ) : (
          <>
            <p>{sheet.patient.start}</p>
            <ol>{sheet.patient.steps.map(s => <li key={s}>{s}</li>)}</ol>
            {sheet.patient.avoid?.length ? <ul class="evitar">{sheet.patient.avoid.map(s => <li key={s}>{s}</li>)}</ul> : null}
          </>
        )}
      </div>
    </section>
  );
}

function Datos({ ex, vocab }) {
  const l = (v, k) => vocab[v]?.[k]?.es ?? k;
  const filas = [
    ['Material', (ex.equipment || []).map(q => l('equipment', q)).join(', ')],
    ['Posición', l('positions', ex.position)],
    ['Lateralidad', l('laterality', ex.laterality)],
    ['Patrón', l('patterns', ex.pattern)],
    ['Dónde', (ex.places || []).map(p => l('places', p)).join(', ')],
    ['Exige', (ex.demands || []).map(d => l('demands', d)).join(', ')],
  ].filter(([, v]) => v);
  return (
    <section class="bloque" aria-labelledby="datos">
      <h2 id="datos">Datos</h2>
      <dl class="datos">{filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </section>
  );
}

export function Ejercicio({ params }) {
  const { lib, error } = useLibrary();
  const volver = href('/pro/catalogo', catalogoMemoria.query).slice(1);
  if (error) return <main class="pantalla"><Barra titulo="Ejercicio" volver={volver} ajustes={false} /><p class="aviso error">{error}</p></main>;
  if (!lib) return <main class="pantalla"><Barra titulo="Ejercicio" volver={volver} ajustes={false} /><p class="apagado">Cargando…</p></main>;
  const ex = lib.byId.get(params.id);
  if (!ex) {
    return (
      <main class="pantalla">
        <Barra titulo="Ejercicio" volver={volver} ajustes={false} />
        <h1>Ejercicio no disponible</h1>
        <p>Esta versión de la app no tiene este ejercicio. Actualiza la app.</p>
      </main>
    );
  }
  const { vocab } = lib.catalog;
  const kg = ajustes.value?.pesoKg || 70;
  const chips = [
    ...(ex.regions || []).map(r => vocab.regions[r]?.es),
    ...(ex.goals || []).map(g => vocab['therapy-goals'][g]?.es),
    `Nivel ${ex.level} · ${vocab.levels[ex.level]?.es ?? ''}`,
    vocab.actions?.[ex.action]?.es,
  ].filter(Boolean);
  return (
    <main class={`pantalla ancha ficha con-nav${catalogoMemoria.para ? ' con-barra-sel' : ''}`}>
      <Barra titulo="Ejercicio" volver={volver} ajustes={false} />
      <Figura ex={ex} />
      <div class="cabecera-ej">
        <h1 class="h1-ej">{ex.name.es}</h1>
        <div class="etiquetas">
          {chips.map(c => <span key={c}>{c}</span>)}
          {ex.met ? <span class="met" title={`Con ${fmt1(kg)} kg`}>{fmt1(ex.met)} MET · ~{fmt1(kcalPerMin(ex.met, kg))} kcal/min</span> : null}
        </div>
      </div>
      <Musculos ex={ex} vocab={vocab} />
      <Textos ex={ex} byId={lib.byId} />
      <Datos ex={ex} vocab={vocab} />
      {catalogoMemoria.para ? (
        <div class="barra-sel">
          <span>{catalogoMemoria.sel.size ? `${catalogoMemoria.sel.size} ya elegidos` : ''}</span>
          <button type="button" class="boton" onClick={() => anadirAPauta(catalogoMemoria.para, [...new Set([...catalogoMemoria.sel, ex.id])].map(id => lib.byId.get(id)).filter(Boolean))}>
            Añadir a la pauta
          </button>
        </div>
      ) : null}
    </main>
  );
}
