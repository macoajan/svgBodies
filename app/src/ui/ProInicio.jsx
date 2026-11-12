import { useEffect, useMemo, useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { useLibrary } from './useLibrary.js';
import { figureUrls } from '../lib/library.js';
import { navigate } from '../router.js';
import { version, listPautas, listPacientes, createPauta } from '../data/repo.js';
import { newPauta, scheduleText, searchPautas } from '../domain/pautas.js';
import { estadoEnvio, ESTADO_LABEL } from '../domain/envio.js';
import { ajustes } from '../data/app-store.js';
import { nuevasRespuestas } from '../data/repo.js';
import { leerTodas } from '../data/envio-service.js';

const fechaCorta = iso => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

/** «Mis pautas»: lista con búsqueda y botón de nueva pauta. */
export function ProInicio() {
  const { lib } = useLibrary();
  const [q, setQ] = useState('');
  useEffect(() => { leerTodas(); }, []);
  version.value; // repinta al cambiar los datos
  const pacientes = Object.fromEntries(listPacientes().map(p => [p.id, p]));
  const lista = useMemo(() => searchPautas(listPautas(), q, pacientes, lib?.byId), [q, lib, version.value]);
  const nueva = async () => navigate(`/pro/pauta/${await createPauta(newPauta())}`);
  const total = listPautas().length;
  return (
    <main class="pantalla con-nav">
      <Barra titulo="Profesional" volver="/" ajustes={false} />
      <div class="cabecera-lista">
        <h1>Mis pautas</h1>
        <button type="button" class="boton" onClick={nueva}>+ Nueva</button>
      </div>
      {total ? (
        <label class="buscador">
          <input type="search" value={q} onInput={e => setQ(e.currentTarget.value)} placeholder="Buscar por título, paciente o ejercicio" aria-label="Buscar pautas" />
        </label>
      ) : (
        <div class="aviso">
          <p><strong>Aún no tienes pautas.</strong> Crea una, añade ejercicios del catálogo y ajusta series, repeticiones y descansos.</p>
        </div>
      )}
      <ul class="lista-pautas">
        {lista.map(r => {
          const ex0 = lib?.byId.get(r.pauta.items[0]?.id);
          return (
            <li key={r.id}>
              <a class="fila-pauta" href={`#/pro/pauta/${r.id}`}>
                <span class="fila-img">{ex0 ? <img src={figureUrls(ex0)[0]} alt="" loading="lazy" /> : null}</span>
                <span class="fila-texto">
                  <strong>{r.pauta.title || 'Sin título'}{pacientes[r.pacienteId] ? ` · ${pacientes[r.pacienteId].alias}` : ''}</strong>
                  <span>{r.pauta.items.length} {r.pauta.items.length === 1 ? 'ejercicio' : 'ejercicios'} · {scheduleText(r.pauta.schedule)}</span>
                </span>
                <span class="fila-estado">
                  <span class="sello">{ESTADO_LABEL[estadoEnvio(r, ajustes.value)]}</span>
                  {nuevasRespuestas(r.id) ? <span class="punto-nuevo">{nuevasRespuestas(r.id)} {nuevasRespuestas(r.id) === 1 ? 'respuesta' : 'respuestas'}</span> : <small>{fechaCorta(r.editada)}</small>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {total && !lista.length ? <p class="apagado">Ninguna pauta coincide con «{q}».</p> : null}
    </main>
  );
}
