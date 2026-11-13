import { useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { navigate } from '../router.js';
import { version, getPaciente, listPautas, savePaciente, deletePaciente, createPauta } from '../data/repo.js';
import { newPauta, scheduleText, ejerciciosTexto } from '../domain/pautas.js';
import { retirar, mensajeError } from '../data/envio-service.js';

export function Paciente({ params }) {
  version.value;
  const p = getPaciente(params.id);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState('');
  if (!p) return <main class="pantalla con-nav"><Barra titulo="Paciente" volver="/pro/pacientes" ajustes={false} /><h1>Paciente no encontrado</h1></main>;
  const pautas = listPautas().filter(r => r.pacienteId === p.id).sort((a, b) => b.editada.localeCompare(a.editada));
  const guardar = patch => savePaciente({ ...p, ...patch }).catch(() => {});
  return (
    <main class="pantalla con-nav">
      <Barra titulo="Paciente" volver="/pro/pacientes" ajustes={false} />
      <label class="campo"><span>Alias</span>
        <input type="text" value={p.alias} maxLength={60} onChange={e => e.currentTarget.value.trim() && guardar({ alias: e.currentTarget.value })} />
      </label>
      <label class="campo"><span>Nota privada (no se envía)</span>
        <textarea rows={3} maxLength={500} value={p.nota} onChange={e => guardar({ nota: e.currentTarget.value })} />
      </label>
      <div class="cabecera-lista">
        <h2>Pautas</h2>
        <button type="button" class="boton secundario" onClick={async () => navigate(`/pro/pauta/${await createPauta(newPauta({ title: p.alias }), p.id)}`)}>+ Nueva pauta</button>
      </div>
      {pautas.length ? (
        <ul class="lista-pautas">
          {pautas.map(r => (
            <li key={r.id}><a class="fila-pauta" href={`#/pro/pauta/${r.id}`}>
              <span class="fila-texto"><strong>{r.pauta.title || 'Sin título'}</strong><span>{ejerciciosTexto(r.pauta)} · {scheduleText(r.pauta.schedule)}</span></span>
            </a></li>
          ))}
        </ul>
      ) : <p class="apagado">Sin pautas todavía.</p>}
      {confirmar ? (
        <div class="aviso error campo" role="alert">
          <p><strong>¿Borrar a {p.alias} y sus {pautas.length} pautas de este dispositivo?</strong> Se retirarán los enlaces enviados.</p>
          {error ? <p>{error}</p> : null}
          <button type="button" class="boton peligro" onClick={async () => {
            try { for (const r of pautas) if (r.envio) await retirar(r.id); } catch (e) { setError(`No se pudo retirar algún enlace: ${mensajeError(e)}`); return; }
            await deletePaciente(p.id); navigate('/pro/pacientes', undefined, { replace: true });
          }}>Sí, borrar</button>
          <button type="button" class="boton secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
        </div>
      ) : <button type="button" class="boton peligro" onClick={() => setConfirmar(true)}>Borrar paciente</button>}
    </main>
  );
}
