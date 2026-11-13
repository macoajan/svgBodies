import { useState } from 'preact/hooks';

/**
 * Número con − y + y escritura directa. `optional`: admite quedar vacío (botón «Quitar»).
 * @param {{ label: string, value?: number, unit?: string, step?: number, min: number, max: number, optional?: boolean, placeholder?: string, onChange: (v: number|null) => void, id?: string }} props
 */
export function Stepper({ label, value, unit = '', step = 1, min, max, optional = false, placeholder = 'sin', onChange, id }) {
  // Mientras se escribe, el campo no se controla desde fuera: así un repintado (por ejemplo, al
  // guardarse otro cambio) no devuelve el campo al valor anterior. Se aplica al salir o con Intro.
  const [editando, setEditando] = useState(false);
  const base = value ?? (optional ? null : min);
  const set = v => onChange(v == null ? null : Math.min(max, Math.max(min, v)));
  const aplicar = el => {
    const s = el.value.trim();
    const v = s === '' ? (optional ? null : min) : Number(s);
    if (v !== (value ?? null) && (v === null || Number.isFinite(v))) set(v);
    else el.value = String(value ?? '');
  };
  const inputId = id || `st-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div class="stepper">
      <label for={inputId}>{label}</label>
      <div class="stepper-fila">
        <button type="button" aria-label={`Menos ${label.toLowerCase()}`} disabled={base == null || base <= min}
          onClick={() => set(base == null ? min : base - step)}>−</button>
        <span class="stepper-valor">
          <input id={inputId} type="number" inputMode="numeric" min={min} max={max} step={step} placeholder={placeholder}
            {...(editando ? {} : { value: value ?? '' })}
            onFocus={() => setEditando(true)}
            onBlur={e => { setEditando(false); aplicar(e.currentTarget); }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          {unit ? <span class="unidad" aria-hidden="true">{unit}</span> : null}
        </span>
        <button type="button" aria-label={`Más ${label.toLowerCase()}`} disabled={base != null && base >= max}
          onClick={() => set(base == null ? (min > 0 ? min : step) : base + step)}>+</button>
      </div>
    </div>
  );
}

/** Interruptor accesible (checkbox con rol switch). */
export function Interruptor({ label, checked, onChange, detalle }) {
  return (
    <label class="interruptor">
      <span class="interruptor-texto">{label}{detalle ? <small>{detalle}</small> : null}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.currentTarget.checked)} />
      <span class="interruptor-pista" aria-hidden="true" />
    </label>
  );
}

/** Ejecuta `fn` con retardo; `flush` lo ejecuta ya (al salir de la pantalla). */
export function debounce(fn, ms = 300) {
  let t = null, last = null;
  const run = () => { t = null; const a = last; last = null; if (a) fn(...a); };
  const d = (...args) => { last = args; clearTimeout(t); t = setTimeout(run, ms); };
  d.flush = () => { clearTimeout(t); run(); };
  return d;
}
