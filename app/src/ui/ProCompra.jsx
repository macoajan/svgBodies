import { useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { esPro, tienda, comprar, restaurar, desbloquearPruebas } from '../data/pro.js';
import { DESBLOQUEO_PRUEBAS } from '../config.js';
import { version, listPautas } from '../data/repo.js';
import { PRO_FEATURES, uso } from '../domain/limites.js';

/** Pantalla Pro: qué incluye, uso del límite gratuito, compra y restaurar compras. */
export function ProCompra() {
  version.value;
  const [estado, setEstado] = useState({ ocupado: false, texto: '', error: false });
  const u = uso(listPautas());
  const t = tienda.value;
  const hacer = async (fn, ok) => {
    setEstado({ ocupado: true, texto: '', error: false });
    try { const r = await fn(); setEstado({ ocupado: false, texto: typeof ok === 'function' ? ok(r) : ok, error: false }); }
    catch (e) { setEstado({ ocupado: false, texto: e?.message || 'No se pudo completar.', error: true }); }
  };
  return (
    <main class="pantalla con-nav">
      <Barra titulo="Pro" volver="/pro" ajustes={false} />
      <h1>{esPro.value ? 'Tienes Pro' : 'Pásate a Pro'}</h1>
      <p>{esPro.value ? 'Gracias por apoyar la app. Tienes todo desbloqueado en este dispositivo y en los que usen tu misma cuenta de la tienda.'
        : 'Un solo pago, para siempre. Sin suscripción. Tus pacientes nunca pagan nada.'}</p>
      <ul class="lista-pro">{PRO_FEATURES.map(f => <li key={f}>{f}</li>)}</ul>
      {!esPro.value ? <p class="aviso">Versión gratuita: <strong>{u.usados} de {u.limite}</strong> pacientes con pauta activa.</p> : null}
      {t.estado === 'no-disponible' ? (
        <p class="apagado">La compra está disponible en la app para iPhone, iPad y Android.</p>
      ) : !esPro.value ? (
        <button type="button" class="boton grande" disabled={estado.ocupado || t.estado !== 'lista'}
          onClick={() => hacer(comprar, () => (esPro.value ? '¡Listo! Ya tienes Pro.' : ''))}>
          {t.estado === 'cargando' ? 'Conectando con la tienda…' : `Comprar Pro${t.precio ? ` · ${t.precio}` : ''}`}
        </button>
      ) : null}
      {t.estado !== 'no-disponible' ? (
        <button type="button" class="boton secundario" disabled={estado.ocupado || t.estado === 'cargando'}
          onClick={() => hacer(restaurar, owned => (owned ? 'Compra restaurada.' : 'No hay ninguna compra de Pro en esta cuenta de la tienda.'))}>
          Restaurar compras
        </button>
      ) : null}
      {t.estado === 'error' ? <p class="aviso error">No se pudo conectar con la tienda ({t.error}).</p> : null}
      {DESBLOQUEO_PRUEBAS ? (
        <div class="aviso pruebas campo">
          <p><strong>Modo pruebas</strong> (se quitará antes de publicar)</p>
          <button type="button" class="boton secundario" onClick={() => hacer(() => desbloquearPruebas(!esPro.value), () => (esPro.value ? 'Pro desbloqueado para pruebas.' : 'Vuelves a la versión gratuita.'))}>
            {esPro.value ? 'Volver a la versión gratuita' : 'Desbloquear'}
          </button>
        </div>
      ) : null}
      <div aria-live="polite">{estado.texto ? <p class={`aviso${estado.error ? ' error' : ' ok'}`}>{estado.texto}</p> : null}</div>
    </main>
  );
}

/** Aviso con enlace a Pro para una función bloqueada. */
export function BloqueoPro({ texto }) {
  return <a class="aviso bloqueo" href="#/pro/pro"><span>{texto}</span><strong>Pro →</strong></a>;
}
