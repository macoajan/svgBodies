import { useEffect, useState } from 'preact/hooks';

/**
 * Número con − y + y escritura directa. `optional`: admite quedar vacío (botón «Quitar»).
 * @param {{ label: string, value?: number, unit?: string, step?: number, min: number, max: number, optional?: boolean, placeholder?: string, onChange: (v: number|null) => void, id?: string }} props
 */
export function Stepper({ label, value, unit = '', step = 1, min, max, optional = false, placeholder = 'sin', onChange, id }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  const base = value ?? (optional ? null : min);
  const set = v => onChange(v == null ? null : Math.min(max, Math.max(min, v)));
  const inputId = id || `st-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div class="stepper">
      <label for={inputId}>{label}</label>
      <div class="stepper-fila">
        <button type="button" aria-label={`Menos ${label.toLowerCase()}`} disabled={base == null || base <= min}
          onClick={() => set(base == null ? min : base - step)}>−</button>
        <span class="stepper-valor">
          <input id={inputId} type="number" inputMode="numeric" min={min} max={max} step={step} value={text} placeholder={placeholder}
            onInput={e => setText(e.currentTarget.value)}
            onChange={e => { const s = e.currentTarget.value.trim(); set(s === '' ? (optional ? null : min) : Number(s)); }} />
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
