import { useMemo, useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { useLibrary } from './useLibrary.js';
import { version, getPauta, getPaciente } from '../data/repo.js';
import { ajustes } from '../data/app-store.js';
import { enviar, actualizar, retirar, mensajeError } from '../data/envio-service.js';
import { estadoEnvio, formAVisibilidad, visibilidadAForm, visibilidadTexto, huella, ESTADO_LABEL } from '../domain/envio.js';
import { problems, scheduleText, ejerciciosTexto } from '../domain/pautas.js';
import { qrPath, qrPngConLogo } from '../lib/qr.js';
import { listPautas } from '../data/repo.js';
import { esPro } from '../data/pro.js';
import { puedeEnviar, FREE_LIMITS } from '../domain/limites.js';
import { BloqueoPro } from './ProCompra.jsx';
import { compartirEnlace, compartirImagen, copiar } from '../platform/share.js';

function Qr({ link, label }) {
  const { size, d } = useMemo(() => qrPath(link), [link]);
  return (
    <svg class="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shape-rendering="crispEdges">
      <rect width={size} height={size} fill="#FFFFFF" />
      <path d={d} fill="#000000" />
    </svg>
  );
}

/** Formulario de visibilidad: disponible ya, desde un día u oculta; último día opcional. */
function Visibilidad({ form, onChange }) {
  const set = patch => onChange({ ...form, ...patch });
  const hoy = new Date().toLocaleDateString('sv-SE');
  return (
    <fieldset class="visibilidad">
      <legend>Cuándo puede verla</legend>
      {[['ya', 'Disponible ya'], ['desde', 'A partir de un día'], ['oculta', 'Ocultar por ahora']].map(([v, l]) => (
        <label class="opcion" key={v}><input type="radio" name="modo" checked={form.modo === v} onChange={() => set({ modo: v })} /><span class="opcion-texto">{l}</span></label>
      ))}
      {form.modo === 'desde' ? (
        <label class="campo"><span>Primer día</span><input type="date" min={hoy} value={form.desde || ''} onInput={e => set({ desde: e.currentTarget.value })} /></label>
      ) : null}
      {form.modo !== 'oculta' ? (
        <label class="campo"><span>Último día (opcional)</span><input type="date" min={form.desde || hoy} value={form.hasta || ''} onInput={e => set({ hasta: e.currentTarget.value || undefined })} /></label>
      ) : null}
    </fieldset>
  );
}

export function Envio({ params }) {
  const { lib } = useLibrary();
  version.value;
  const id = params.id;
  const rec = getPauta(id);
  const [form, setForm] = useState(() => visibilidadAForm(rec?.envio?.visibility));
  const [estado, setEstado] = useState({ ocupado: false, error: '', ok: '' });
  const [confirmar, setConfirmar] = useState(false);
  if (!rec) return <main class="pantalla con-nav"><Barra titulo="Enviar" volver="/pro" ajustes={false} /><h1>Pauta no encontrada</h1></main>;

  const env = rec.envio;
  const est = estadoEnvio(rec, ajustes.value);
  const paciente = rec.pacienteId ? getPaciente(rec.pacienteId) : null;
  const avisos = lib ? problems(rec.pauta, new Set(lib.byId.keys())) : [];
  const vis = formAVisibilidad(form);
  const visCambiada = env && !env.offline && vis.visibility && huella(vis.visibility) !== huella(env.visibility || { mode: 'auto' });
  const titulo = rec.pauta.title || 'Tu pauta de ejercicios';
  const quien = [ajustes.value?.nombre, ajustes.value?.centro].filter(Boolean).join(' · ');

  const hacer = async (fn, ok) => {
    setEstado({ ocupado: true, error: '', ok: '' });
    try { await fn(); setEstado({ ocupado: false, error: '', ok }); } catch (e) { setEstado({ ocupado: false, error: mensajeError(e), ok: '' }); }
  };
  const textoCompartir = `${titulo}${quien ? ` (de ${quien})` : ''}. Ábrela en este enlace:`;

  return (
    <main class="pantalla con-nav">
      <Barra titulo={env ? 'Envío' : 'Enviar'} volver={`/pro/pauta/${id}`} ajustes={false} />
      <h1>{env ? 'Pauta enviada' : 'Enviar pauta'}</h1>
      <section class="tarjeta">
        <h2>{titulo}</h2>
        <p>{paciente ? `${paciente.alias} · ` : ''}{ejerciciosTexto(rec.pauta)} · {scheduleText(rec.pauta.schedule)}</p>
        {env ? <p><span class="sello">{ESTADO_LABEL[est]}</span> {!env.offline ? visibilidadTexto(env.visibility) : null}</p> : null}
        {quien ? <p class="apagado">Firmada como {quien}.</p>
          : <p class="apagado">Añade tu nombre en <a href="#/ajustes">Ajustes</a> para que el paciente sepa quién se la envía.</p>}
      </section>

      {avisos.length ? <ul class="aviso error">{avisos.map(a => <li key={a}>{a}</li>)}</ul> : null}
      <div aria-live="polite">
        {estado.error ? <p class="aviso error">{estado.error}</p> : null}
        {estado.ok ? <p class="aviso ok">{estado.ok}</p> : null}
      </div>

      {env ? (
        <section class="bloque envio" aria-labelledby="enl-t">
          <h2 id="enl-t">Enlace y QR</h2>
          <Qr link={env.link} label={`Código QR de la pauta ${titulo}`} />
          <p class="enlace-texto">{env.link}</p>
          <div class="item-acciones">
            <button type="button" class="boton" onClick={async () => setEstado({ ...estado, ok: (await compartirEnlace({ title: titulo, text: textoCompartir, url: env.link })) === 'copiado' ? 'Enlace copiado.' : '' })}>Compartir enlace</button>
            <button type="button" class="boton secundario" onClick={async () => setEstado({ ...estado, ok: (await copiar(env.link)) === 'copiado' ? 'Enlace copiado.' : 'No se pudo copiar.' })}>Copiar</button>
            <button type="button" class="boton secundario" onClick={async () => compartirImagen(await qrPngConLogo(env.link, { pie: titulo, logo: esPro.value ? ajustes.value?.logo : null }), 'pauta-qr.png', titulo)}>Compartir QR</button>
          </div>
          {env.offline ? (
            <p class="aviso">No había conexión con el servidor y se ha creado un <strong>enlace largo</strong>: funciona sin servidor, pero no podrás cambiar la pauta con él ni recibir respuestas. Cuando haya conexión, retíralo y vuelve a enviarla.</p>
          ) : est === 'cambios' ? (
            <div class="aviso campo">
              <p><strong>Has cambiado la pauta después de enviarla.</strong> El paciente sigue viendo la versión anterior hasta que la actualices; el enlace no cambia.</p>
              <button type="button" class="boton" disabled={estado.ocupado || avisos.length > 0} onClick={() => hacer(() => actualizar(id), 'Pauta actualizada. El paciente verá los cambios al abrir el enlace.')}>Actualizar pauta enviada</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {!env || !env.offline ? <Visibilidad form={form} onChange={f => { setForm(f); setEstado({ ...estado, error: '', ok: '' }); }} /> : null}
      {vis.error ? <p class="aviso error" role="alert">{vis.error}</p> : null}


      {!env && !puedeEnviar(listPautas(), id, esPro.value) ? (
        <BloqueoPro texto={`La versión gratuita permite ${FREE_LIMITS.pacientesActivos} pacientes con pauta activa. Retira el enlace de otro paciente o pásate a Pro.`} />
      ) : !env ? (
        <>
          <p class="apagado">La pauta viaja cifrada: el servidor no puede leerla. La clave va dentro del enlace, así que compártelo solo con tu paciente.</p>
          <button type="button" class="boton" disabled={estado.ocupado || avisos.length > 0 || !vis.visibility}
            onClick={() => hacer(() => enviar(id, vis.visibility), 'Pauta enviada. Compártela con el enlace o el QR.')}>
            {estado.ocupado ? 'Enviando…' : 'Enviar'}
          </button>
        </>
      ) : visCambiada ? (
        <button type="button" class="boton" disabled={estado.ocupado} onClick={() => hacer(() => actualizar(id, { contenido: false, visibility: vis.visibility }), 'Visibilidad guardada.')}>Guardar cuándo puede verla</button>
      ) : null}

      {env ? (
        <section class="bloque" aria-labelledby="ret-t">
          <h2 id="ret-t">Retirar</h2>
          <p class="apagado">El enlace dejará de funcionar y se borrarán del servidor la pauta y sus respuestas pendientes. La pauta seguirá en tu dispositivo como borrador.</p>
          {confirmar ? (
            <div class="item-acciones">
              <button type="button" class="boton peligro" disabled={estado.ocupado} onClick={() => hacer(async () => { await retirar(id); setConfirmar(false); setForm({ modo: 'ya' }); }, 'Enlace retirado.')}>Sí, retirar enlace</button>
              <button type="button" class="boton secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
            </div>
          ) : <button type="button" class="boton peligro" onClick={() => setConfirmar(true)}>Retirar enlace</button>}
        </section>
      ) : null}
    </main>
  );
}
