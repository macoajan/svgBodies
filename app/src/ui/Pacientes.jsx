import { useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { navigate } from '../router.js';
import { version, listPacientes, listPautas, savePaciente } from '../data/repo.js';

/** Lista de pacientes por alias (nunca hace falta el nombre real). */
export function Pacientes() {
  version.value;
  const [alias, setAlias] = useState('');
  const [error, setError] = useState('');
  const pautas = listPautas();
  const n = id => pautas.filter(p => p.pacienteId === id).length;
  const crear = async e => {
    e.preventDefault();
    try { const id = await savePaciente({ alias }); setAlias(''); navigate(`/pro/paciente/${id}`); } catch (err) { setError(err.message); }
  };
  return (
    <main class="pantalla con-nav">
      <Barra titulo="Pacientes" volver="/pro" ajustes={false} />
      <h1>Pacientes</h1>
      <p class="apagado">Usa un alias (iniciales, «Rodilla L.G.»…). El nombre real no hace falta y todo se queda en este dispositivo.</p>
      <form class="fila-form" onSubmit={crear}>
        <label class="campo crece"><span>Nuevo paciente</span>
          <input type="text" value={alias} maxLength={60} onInput={e => { setAlias(e.currentTarget.value); setError(''); }} placeholder="Alias" autoComplete="off" />
        </label>
        <button class="boton" type="submit" disabled={!alias.trim()}>Añadir</button>
      </form>
      {error ? <p class="aviso error" role="alert">{error}</p> : null}
      <ul class="lista-pautas">
        {listPacientes().map(p => (
          <li key={p.id}>
            <a class="fila-pauta" href={`#/pro/paciente/${p.id}`}>
              <span class="inicial" aria-hidden="true">{p.alias.slice(0, 2).toUpperCase()}</span>
              <span class="fila-texto"><strong>{p.alias}</strong><span>{n(p.id)} {n(p.id) === 1 ? 'pauta' : 'pautas'}</span></span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
