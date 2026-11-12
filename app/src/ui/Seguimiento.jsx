import { useEffect, useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { useLibrary } from './useLibrary.js';
import { version, getPauta, getRespuestas, marcarVistas } from '../data/repo.js';
import { leerRespuestas, mensajeError } from '../data/envio-service.js';
import { resumenRespuestas, nivelDolor, DIFF_LABEL } from '../domain/envio.js';

const fecha = iso => new Date(iso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const TENDENCIA = { sube: '↑ sube', baja: '↓ baja', igual: '= igual' };

function Dolor({ v }) {
  if (v == null) return <span class="dolor-n">—</span>;
  return <span class={`dolor-n ${nivelDolor(v)}`} aria-label={`Dolor ${v} de 10`}>{v}</span>;
}

export function Seguimiento({ params }) {
  const { lib } = useLibrary();
  version.value;
  const id = params.id;
  const rec = getPauta(id);
  const [estado, setEstado] = useState({ cargando: false, error: '', nuevas: null });
  const comprobar = async () => {
    setEstado({ cargando: true, error: '', nuevas: null });
    try { const n = await leerRespuestas(id); setEstado({ cargando: false, error: '', nuevas: n }); }
    catch (e) { setEstado({ cargando: false, error: mensajeError(e), nuevas: null }); }
    marcarVistas(id);
  };
  useEffect(() => { if (rec?.envio && !rec.envio.offline) comprobar(); else marcarVistas(id); }, [id]);
  if (!rec) return <main class="pantalla con-nav"><Barra titulo="Respuestas" volver="/pro" ajustes={false} /><h1>Pauta no encontrada</h1></main>;

  const { items: respuestas } = getRespuestas(id);
  const nombre = i => { const it = rec.pauta.items[i]; return (it && lib?.byId.get(it.id)?.name.es) || `Ejercicio ${i + 1}`; };
  const resumen = resumenRespuestas(respuestas, rec.pauta.items.length);

  return (
    <main class="pantalla con-nav">
      <Barra titulo="Seguimiento" volver={`/pro/pauta/${id}`} ajustes={false} />
      <div class="cabecera-lista">
        <h1>Respuestas</h1>
        {rec.envio && !rec.envio.offline ? (
          <button type="button" class="boton secundario" disabled={estado.cargando} onClick={comprobar}>{estado.cargando ? 'Comprobando…' : 'Comprobar'}</button>
        ) : null}
      </div>
      <p class="apagado">{rec.pauta.title || 'Pauta'} · {respuestas.length} {respuestas.length === 1 ? 'sesión valorada' : 'sesiones valoradas'}</p>
      <div aria-live="polite">
        {estado.error ? <p class="aviso error">{estado.error}</p> : null}
        {estado.nuevas ? <p class="aviso ok">{estado.nuevas === 1 ? 'Ha llegado 1 respuesta nueva.' : `Han llegado ${estado.nuevas} respuestas nuevas.`}</p> : null}
      </div>
      {!rec.envio ? <p class="aviso">Esta pauta no está enviada. Envíala para recibir respuestas.</p>
        : rec.envio.offline ? <p class="aviso">Se envió con un enlace largo, sin servidor: no recibe respuestas.</p> : null}

      {respuestas.length ? (
        <>
          <section class="bloque" aria-labelledby="res-t">
            <h2 id="res-t">Por ejercicio</h2>
            <ul class="lista-pautas">
              {resumen.map((s, i) => (
                <li key={i} class="fila-resumen">
                  <span class="fila-texto">
                    <strong>{nombre(i)}</strong>
                    <span>{s.veces ? `Valorado ${s.veces} ${s.veces === 1 ? 'vez' : 'veces'}${s.dificil ? ` · difícil ${s.dificil}` : ''}${s.facil ? ` · fácil ${s.facil}` : ''}${s.max != null ? ` · máx. ${s.max}` : ''}${s.tendencia ? ` · ${TENDENCIA[s.tendencia]}` : ''}` : 'Sin valorar'}</span>
                  </span>
                  <span class="dolor-ultimo"><small>Último dolor</small><Dolor v={s.ultimo} /></span>
                </li>
              ))}
            </ul>
          </section>
          <section class="bloque" aria-labelledby="ses-t">
            <h2 id="ses-t">Sesiones</h2>
            <ol class="sesiones">
              {[...respuestas].reverse().map(r => (
                <li key={r.id} class="sesion-r">
                  <p class="sesion-fecha">{fecha(r.respuesta.at || r.at)}</p>
                  <ul>
                    {(r.respuesta.items || []).map(it => (
                      <li key={it.i}>
                        <span class="fila-texto"><strong>{nombre(it.i)}</strong>{it.note ? <span class="nota-r">«{it.note}»</span> : null}</span>
                        {it.diff ? <span class={`sello diff-${it.diff}`}>{DIFF_LABEL[it.diff]}</span> : null}
                        <Dolor v={it.pain} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : rec.envio && !rec.envio.offline && !estado.cargando ? (
        <p class="aviso">Aún no hay respuestas. El paciente las envía al terminar cada sesión.</p>
      ) : null}
    </main>
  );
}
