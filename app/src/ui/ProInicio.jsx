import { useEffect, useState } from 'preact/hooks';
import { Barra } from './Barra.jsx';
import { loadLibrary, figureUrls } from '../lib/library.js';

export function ProInicio() {
  const [lib, setLib] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { loadLibrary().then(setLib, e => setError(String(e.message || e))); }, []);
  return (
    <main class="pantalla">
      <Barra titulo="Profesional" volver="/" />
      <h1>Tus pautas</h1>
      <div class="aviso">Aún no tienes pautas. El editor llega en la fase F2.</div>
      <a class="tarjeta" href="#/pro/catalogo" aria-labelledby="bib">
        <h2 id="bib">Biblioteca</h2>
        {error ? <p class="aviso error">No se pudo cargar la biblioteca: {error}</p>
          : !lib ? <p class="apagado">Cargando…</p>
          : <>
              <p>{lib.manifest.exercises} ejercicios con figuras animadas y 3D, sin conexión.</p>
              <div class="miniaturas">
                {lib.catalog.exercises.slice(0, 6).map(e => <img key={e.id} src={figureUrls(e)[0]} alt="" loading="lazy" />)}
              </div>
              <span class="flecha" aria-hidden="true">Ver catálogo →</span>
            </>}
      </a>
    </main>
  );
}
