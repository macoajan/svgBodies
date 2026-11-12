import { useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { ajustes, saveAjustes, clearAll, storage } from '../data/app-store.js';
import { esPro, cargarCompra } from '../data/pro.js';
import { version as versionDatos } from '../data/repo.js';
import { versionRecibidas } from '../data/recibidas.js';
import { BloqueoPro } from './ProCompra.jsx';
import { logoDesdeArchivo } from '../lib/imagenes.js';
import { cifrarCopia, descifrarCopia } from '../domain/copia.js';
import { compartirArchivo, textoABase64 } from '../platform/share.js';

/** Copia de seguridad cifrada: exportar e importar (sustituye todos los datos). */
function Copia() {
  const [frase, setFrase] = useState('');
  const [frase2, setFrase2] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [fraseImp, setFraseImp] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [estado, setEstado] = useState({ ocupado: false, texto: '', error: false });
  const msg = (texto, error = false) => setEstado({ ocupado: false, texto, error });
  const exportar = async e => {
    e.preventDefault();
    if (frase !== frase2) return msg('Las dos frases no coinciden.', true);
    setEstado({ ocupado: true, texto: '', error: false });
    try {
      const json = await cifrarCopia(storage.snapshot(), frase);
      const dia = new Date().toLocaleDateString('sv-SE');
      const r = await compartirArchivo({ base64: textoABase64(json), nombre: `pautas-copia-${dia}.pautas`, mime: 'application/octet-stream', title: 'Copia de seguridad' });
      setFrase(''); setFrase2('');
      msg(r === 'cancelado' ? '' : 'Copia creada. Guárdala en un lugar seguro y no olvides la frase: sin ella no se puede abrir.');
    } catch (err) { msg(err.message, true); }
  };
  const importar = async () => {
    setEstado({ ocupado: true, texto: '', error: false });
    try {
      const { snapshot, at } = await descifrarCopia(await archivo.text(), fraseImp);
      // La compra no viaja en la copia: se comprueba siempre con la tienda.
      snapshot.collections.compra = { v: 1, data: storage.get('compra') };
      await storage.restore(snapshot);
      ajustes.value = storage.get('ajustes'); cargarCompra(); versionDatos.value++; versionRecibidas.value++;
      setArchivo(null); setFraseImp(''); setConfirmar(false);
      msg(`Datos restaurados (copia del ${new Date(at).toLocaleDateString('es-ES')}).`);
    } catch (err) { setConfirmar(false); msg(err.message, true); }
  };
  return (
    <fieldset>
      <legend>Copia de seguridad</legend>
      <p class="apagado">Incluye pacientes, pautas, respuestas y los permisos para cambiar las pautas enviadas. Va cifrada con una frase que solo sabes tú.</p>
      <form class="campo" onSubmit={exportar}>
        <label class="campo"><span>Frase (mínimo 8 caracteres)</span><input type="password" autoComplete="new-password" value={frase} onInput={e => setFrase(e.currentTarget.value)} /></label>
        <label class="campo"><span>Repite la frase</span><input type="password" autoComplete="new-password" value={frase2} onInput={e => setFrase2(e.currentTarget.value)} /></label>
        <button class="boton secundario" type="submit" disabled={estado.ocupado || frase.length < 8}>Crear copia</button>
      </form>
      <label class="campo"><span>Restaurar una copia</span>
        <input type="file" accept=".pautas,application/octet-stream,application/json" onChange={e => { setArchivo(e.currentTarget.files?.[0] || null); setConfirmar(false); }} />
      </label>
      {archivo ? (
        <>
          <label class="campo"><span>Frase de esa copia</span><input type="password" autoComplete="current-password" value={fraseImp} onInput={e => setFraseImp(e.currentTarget.value)} /></label>
          {confirmar ? (
            <div class="aviso error campo">
              <p><strong>Se sustituirán todos los datos de este dispositivo por los de la copia.</strong></p>
              <button class="boton peligro" type="button" disabled={estado.ocupado} onClick={importar}>Sí, restaurar</button>
              <button class="boton secundario" type="button" onClick={() => setConfirmar(false)}>Cancelar</button>
            </div>
          ) : <button class="boton secundario" type="button" disabled={!fraseImp} onClick={() => setConfirmar(true)}>Restaurar</button>}
        </>
      ) : null}
      <div aria-live="polite">{estado.texto ? <p class={`aviso${estado.error ? ' error' : ' ok'}`}>{estado.texto}</p> : null}</div>
    </fieldset>
  );
}

function Logo() {
  const [error, setError] = useState('');
  const logo = ajustes.value?.logo;
  if (!esPro.value) return <BloqueoPro texto="Tu logo en el PDF y en el QR" />;
  return (
    <div class="campo">
      <span><strong>Logo</strong> (se usa en el PDF y en la imagen del QR; no se envía al paciente)</span>
      {logo ? <img class="logo-prev" src={logo} alt="Tu logo" /> : null}
      <input type="file" accept="image/*" onChange={async e => {
        setError('');
        try { await saveAjustes({ logo: await logoDesdeArchivo(e.currentTarget.files?.[0]) }); } catch (err) { setError(err.message); }
      }} />
      {logo ? <button type="button" class="enlace" onClick={() => saveAjustes({ logo: null })}>Quitar logo</button> : null}
      {error ? <p class="aviso error">{error}</p> : null}
    </div>
  );
}
import { THEMES, THEMES_PRO, THEMES_PACIENTE, themeFor } from '../themes/themes.js';

function Temas({ legend, lista, valor, onChange, name }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div class="temas">
        {lista.map(id => (
          <label class="tema" key={id}>
            <input type="radio" name={name} value={id} checked={valor === id} onChange={() => onChange(id)} />
            <span class="muestra" aria-hidden="true">{THEMES[id].muestra.map(c => <i key={c} style={{ background: c }} />)}</span>
            <span>{THEMES[id].nombre}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Ajustes({ version }) {
  const a = ajustes.value;
  const [confirmar, setConfirmar] = useState(false);
  return (
    <main class="pantalla con-nav">
      <Barra titulo="Ajustes" volver="/pro" ajustes={false} />
      <Temas legend="Tema del profesional" name="temaPro" lista={THEMES_PRO} valor={themeFor('pro', a)} onChange={id => saveAjustes({ temaPro: id })} />
      <Temas legend="Tema del paciente" name="temaPaciente" lista={THEMES_PACIENTE} valor={themeFor('paciente', a)} onChange={id => saveAjustes({ temaPaciente: id })} />
      <fieldset>
        <legend>Tus datos de profesional</legend>
        <label class="campo"><span>Nombre que verán tus pacientes</span>
          <input type="text" value={a.nombre} onChange={e => saveAjustes({ nombre: e.currentTarget.value.trim() })} autoComplete="name" />
        </label>
        <label class="campo"><span>Centro (opcional)</span>
          <input type="text" value={a.centro} onChange={e => saveAjustes({ centro: e.currentTarget.value.trim() })} autoComplete="organization" />
        </label>
        <Logo />
      </fieldset>
      <fieldset>
        <legend>Pro</legend>
        <a class="fila-pauta" href="#/pro/pro"><span class="fila-texto"><strong>{esPro.value ? 'Tienes Pro' : 'Versión gratuita'}</strong><span>Comprar o restaurar compras</span></span><span aria-hidden="true">→</span></a>
      </fieldset>
      <fieldset>
        <legend>Calorías</legend>
        <label class="campo"><span>Tu peso en kg (solo se guarda en este dispositivo)</span>
          <input type="number" inputMode="decimal" min="25" max="250" step="0.5" value={a.pesoKg ?? ''}
            onChange={e => { const n = parseFloat(e.currentTarget.value); saveAjustes({ pesoKg: n >= 25 && n <= 250 ? n : null }); }} />
        </label>
      </fieldset>
      <Copia />
      <fieldset>
        <legend>Datos</legend>
        <p class="apagado">Todo se guarda solo en este dispositivo. Borrarlo no retira las pautas ya enviadas.</p>
        {confirmar ? (
          <div class="campo">
            <p><strong>¿Borrar todos los datos de la app en este dispositivo?</strong> No se puede deshacer.</p>
            <button class="boton peligro" type="button" onClick={async () => { await clearAll(); setConfirmar(false); }}>Sí, borrar todo</button>
            <button class="boton secundario" type="button" onClick={() => setConfirmar(false)}>Cancelar</button>
          </div>
        ) : <button class="boton peligro" type="button" onClick={() => setConfirmar(true)}>Borrar todos los datos</button>}
      </fieldset>
      <p class="pie">Versión {version.app} · biblioteca {version.lib}</p>
    </main>
  );
}
