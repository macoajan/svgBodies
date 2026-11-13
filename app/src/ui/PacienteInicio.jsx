import { useEffect, useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { navigate } from '../router.js';
import { pendingLink, isPautaLink } from '../platform/links.js';
import { versionRecibidas, listRecibidas, abrirEnlace, enviarTodasPendientes, hechasHoy } from '../data/recibidas.js';
import { ApiError } from '@shared/api-client.js';
import { scheduleText, ejerciciosTexto } from '../domain/pautas.js';
import { escanerDisponible, escanearQr } from '../platform/escaner.js';

export function mensajeApertura(e) {
  if (e instanceof ApiError && e.status === 404) return 'Esta pauta ya no existe. Pide a tu profesional que te la envíe de nuevo.';
  if (e instanceof ApiError && e.status === 403) {
    const desde = e.body?.desde ? new Date(e.body.desde).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : null;
    return desde ? `Tu pauta estará disponible a partir del ${desde}.` : 'Tu profesional aún no ha activado esta pauta.';
  }
  if (e instanceof ApiError) return 'No se ha podido abrir la pauta. Inténtalo más tarde.';
  return 'No se pudo abrir la pauta. Comprueba la conexión.';
}

/** Lado del paciente: sus pautas y apertura de un enlace (también desde un enlace universal). */
export function PacienteInicio() {
  versionRecibidas.value;
  const [link, setLink] = useState('');
  const [estado, setEstado] = useState({ tipo: 'nada', texto: '' });

  const abrir = async url => {
    if (!isPautaLink(url)) { setEstado({ tipo: 'error', texto: 'Ese enlace no es de una pauta.' }); return; }
    setEstado({ tipo: 'cargando', texto: '' });
    try { const clave = await abrirEnlace(url); navigate(`/paciente/p/${clave}`); }
    catch (e) { setEstado({ tipo: 'error', texto: mensajeApertura(e) }); }
  };
  useEffect(() => {
    if (pendingLink.value) { const l = pendingLink.value; pendingLink.value = null; abrir(l); }
    enviarTodasPendientes();
  }, [pendingLink.value]);

  const lista = listRecibidas();
  return (
    <main class="pantalla">
      <Barra titulo="Mis pautas" volver="/" />
      <h1>{lista.length ? 'Tus pautas' : 'Abre tu pauta'}</h1>
      {lista.length ? (
        <ul class="lista-pautas">
          {lista.map(r => (
            <li key={r.clave}>
              <a class="fila-pauta" href={`#/paciente/p/${r.clave}`}>
                <span class="inicial" aria-hidden="true">{(r.pauta.pro?.name || r.pauta.title || 'P').slice(0, 2).toUpperCase()}</span>
                <span class="fila-texto">
                  <strong>{r.pauta.title || 'Tu pauta'}</strong>
                  <span>{r.pauta.pro?.name ? `${r.pauta.pro.name} · ` : ''}{ejerciciosTexto(r.pauta)} · {scheduleText(r.pauta.schedule)}</span>
                </span>
                {r.sesion ? <span class="sello">A medias</span> : hechasHoy(r.clave) ? <span class="sello hecho">Hecha hoy</span> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : <p>Escanea el QR o toca el enlace que te ha enviado tu profesional. También puedes pegar el enlace aquí.</p>}
      {escanerDisponible() ? (
        <button type="button" class="boton grande" disabled={estado.tipo === 'cargando'} onClick={async () => {
          try {
            const texto = await escanearQr();
            if (texto) abrir(texto.trim());
          } catch { setEstado({ tipo: 'error', texto: 'No se pudo usar la cámara. Revisa el permiso de cámara de la app en los ajustes del teléfono.' }); }
        }}>Escanear QR</button>
      ) : null}
      <form class="campo" onSubmit={e => { e.preventDefault(); abrir(link.trim()); }}>
        <label class="campo"><span>{lista.length ? 'Abrir otro enlace' : 'Enlace'}</span>
          <input type="url" inputMode="url" autoComplete="off" value={link} onInput={e => setLink(e.currentTarget.value)} placeholder="https://…" />
        </label>
        <button class={`boton${lista.length ? ' secundario' : ''}`} type="submit" disabled={!link.trim() || estado.tipo === 'cargando'}>
          {estado.tipo === 'cargando' ? 'Abriendo…' : 'Abrir'}
        </button>
      </form>
      <div aria-live="polite">{estado.tipo === 'error' ? <p class="aviso error">{estado.texto}</p> : null}</div>
    </main>
  );
}
