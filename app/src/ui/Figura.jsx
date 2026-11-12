import { useEffect, useRef, useState } from 'preact/hooks';
import { loadFigure, loadViewer, loadPoses, viewLabel } from '../lib/library.js';

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Figura animada en línea (SVG propio de la biblioteca) para poder pausarla. */
function Vista({ path, name }) {
  const ref = useRef(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setError(false);
    loadFigure(path).then(text => {
      if (!alive || !ref.current) return;
      ref.current.innerHTML = text;
      const svg = ref.current.querySelector('svg');
      if (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); svg.setAttribute('aria-label', `${name}, ${viewLabel(path).toLowerCase()}`); }
    }, () => alive && setError(true));
    return () => { alive = false; };
  }, [path]);
  return error ? <p class="figura-error">No se ha podido cargar la figura.</p> : <div class="figura-svg" ref={ref} />;
}

/** Figura 3D con cámara libre (arrastrar para girar) y encuadre automático. */
function Vista3D({ id, name, paused }) {
  const ref = useRef(null);
  const [error, setError] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    let raf = 0, alive = true;
    Promise.all([loadViewer(), loadPoses(id)]).then(([PV, ex]) => {
      const svg = ref.current;
      if (!alive || !svg) return;
      svg.replaceChildren();
      const fig = PV.mount(svg, ex);
      let fit = null, cam = '';
      const draw = t => {
        fig.render(t);
        const key = `${Math.round(fig.state.yaw)}|${Math.round(fig.state.pitch)}`;
        if (key !== cam) { cam = key; fit = null; }
        const b = svg.getBBox();
        fit = fit ? { x0: Math.min(fit.x0, b.x), y0: Math.min(fit.y0, b.y), x1: Math.max(fit.x1, b.x + b.width), y1: Math.max(fit.y1, b.y + b.height) }
          : { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height };
        const pad = 3;
        svg.setAttribute('viewBox', `${(fit.x0 - pad).toFixed(1)} ${(fit.y0 - pad).toFixed(1)} ${(fit.x1 - fit.x0 + 2 * pad).toFixed(1)} ${(fit.y1 - fit.y0 + 2 * pad).toFixed(1)}`);
      };
      // Tiempo de animación propio, para que pausar congele la postura y se pueda seguir girando.
      let t = ex.still ?? 0, last = performance.now();
      const frame = now => {
        if (!pausedRef.current) t += (now - last) / 1000;
        last = now;
        draw(t);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }).catch(() => alive && setError(true));
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [id]);
  if (error) return <p class="figura-error">No se ha podido cargar la vista 3D.</p>;
  return (
    <>
      <svg ref={ref} class="figura-3d" viewBox="-14 -22 92 96" fill="none" stroke="#C2410C" stroke-width="3.4"
        stroke-linecap="round" stroke-linejoin="round" role="img" aria-label={`${name}, figura en 3D`} />
      <p class="pista">Arrastra para girar · doble toque para volver</p>
    </>
  );
}

const Pausa = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>;
const Play = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg>;

/** Figura del ejercicio con selector de vista (2D o 3D) y pausa. */
export function Figura({ ex }) {
  const views = ex?.animation?.views || [];
  const [vista, setVista] = useState(views.length ? 0 : '3d');
  const [paused, setPaused] = useState(reduceMotion());
  useEffect(() => { setVista(views.length ? 0 : '3d'); }, [ex?.id]);
  const name = ex?.name?.es || '';
  const opciones = [...views.map((v, i) => ({ key: i, label: viewLabel(v) })), { key: '3d', label: '3D' }];
  return (
    <section class={`figura${paused ? ' pausada' : ''}`} aria-label="Figura del ejercicio">
      <div class="figura-lienzo">
        {vista === '3d' ? <Vista3D id={ex.id} name={name} paused={paused} /> : <Vista path={views[/** @type {number} */ (vista)]} name={name} />}
      </div>
      <div class="figura-controles">
        <div class="segmentos" role="group" aria-label="Vista">
          {opciones.map(o => (
            <button type="button" key={o.key} aria-pressed={vista === o.key} onClick={() => setVista(o.key)}>{o.label}</button>
          ))}
        </div>
        <button type="button" class="icono-btn" aria-label={paused ? 'Reanudar animación' : 'Pausar animación'} onClick={() => setPaused(!paused)}>
          {paused ? <Play /> : <Pausa />}
        </button>
      </div>
    </section>
  );
}
