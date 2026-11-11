import { useEffect, useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { fetchPauta } from '@shared/api-client.js';
import { pendingLink, isPautaLink } from '../platform/links.js';

/** Abre una pauta pegando el enlace (o desde un enlace universal). La ejecución llega en F4. */
export function PacienteInicio() {
  const [link, setLink] = useState(pendingLink.value || '');
  /** @type {[{ tipo: 'nada'|'cargando'|'error'|'ok', texto?: string, pauta?: any }, Function]} */
  const [estado, setEstado] = useState({ tipo: 'nada' });

  const abrir = async url => {
    if (!isPautaLink(url)) { setEstado({ tipo: 'error', texto: 'Ese enlace no es de una pauta.' }); return; }
    setEstado({ tipo: 'cargando' });
    // TODO(F4): avisar si el enlace es de otro dominio distinto de SERVER_URL (la CSP lo bloquea).
    try {
      const r = await fetchPauta(url);
      setEstado({ tipo: 'ok', pauta: r.pauta });
    } catch (e) {
      const texto = e?.status === 404 ? 'Esta pauta ya no existe.' : e?.status === 403 ? 'Esta pauta aún no está disponible.' : 'No se pudo abrir la pauta. Comprueba la conexión.';
      setEstado({ tipo: 'error', texto });
    }
  };

  useEffect(() => {
    if (pendingLink.value) { abrir(pendingLink.value); pendingLink.value = null; }
  }, []);

  return (
    <main class="pantalla">
      <Barra titulo="Mi pauta" volver="/" />
      <h1>Abre tu pauta</h1>
      <p>Toca el enlace o lee el QR que te ha enviado tu profesional. También puedes pegar el enlace aquí.</p>
      <form class="campo" onSubmit={e => { e.preventDefault(); abrir(link.trim()); }}>
        <label class="campo"><span>Enlace</span>
          <input type="url" inputMode="url" autoComplete="off" value={link} onInput={e => setLink(e.currentTarget.value)} placeholder="https://…" />
        </label>
        <button class="boton" type="submit" disabled={!link.trim() || estado.tipo === 'cargando'}>
          {estado.tipo === 'cargando' ? 'Abriendo…' : 'Abrir'}
        </button>
      </form>
      <div aria-live="polite">
        {estado.tipo === 'error' ? <p class="aviso error">{estado.texto}</p> : null}
        {estado.tipo === 'ok' ? (
          <section class="tarjeta">
            <h2>{estado.pauta.title || 'Tu pauta'}</h2>
            <p>{estado.pauta.items?.length || 0} ejercicios{estado.pauta.pro?.name ? ` · ${estado.pauta.pro.name}` : ''}</p>
            <p class="apagado">La sesión guiada llega en la fase F4.</p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
