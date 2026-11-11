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
      <section class="tarjeta" aria-labelledby="bib">
        <h2 id="bib">Biblioteca sin conexión</h2>
        {error ? <p class="aviso error">No se pudo cargar la biblioteca: {error}</p>
          : !lib ? <p class="apagado">Cargando…</p>
          : <>
              <p>{lib.manifest.exercises} ejercicios con {lib.manifest.svg} figuras y {lib.manifest.poses} posturas 3D.</p>
              <div class="miniaturas">
                {lib.catalog.exercises.slice(0, 8).map(e => <img key={e.id} src={figureUrls(e)[0]} alt={e.name.es} loading="lazy" />)}
              </div>
            </>}
      </section>
    </main>
  );
}
