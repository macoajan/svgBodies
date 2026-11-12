import { useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { ajustes, saveAjustes, clearAll } from '../data/app-store.js';
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
      </fieldset>
      <fieldset>
        <legend>Calorías</legend>
        <label class="campo"><span>Tu peso en kg (solo se guarda en este dispositivo)</span>
          <input type="number" inputMode="decimal" min="25" max="250" step="0.5" value={a.pesoKg ?? ''}
            onChange={e => { const n = parseFloat(e.currentTarget.value); saveAjustes({ pesoKg: n >= 25 && n <= 250 ? n : null }); }} />
        </label>
      </fieldset>
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
