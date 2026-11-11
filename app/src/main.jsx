import { render } from 'preact';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-500.css';
import '@fontsource/lexend/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import './themes/themes.css';
import './ui/app.css';
import { App } from './ui/App.jsx';
import { initStore } from './data/app-store.js';
import { pickBackend } from './platform/backend.js';
import { listenLinks } from './platform/links.js';
import { startRouter } from './router.js';

const root = document.getElementById('app');
try {
  await initStore(await pickBackend());
  startRouter();
  render(<App />, root);
  listenLinks();
} catch (e) {
  // Datos de una versión más nueva o corruptos: no se escribe nada y se avisa.
  root.textContent = `No se pudieron abrir los datos de la app (${e?.code || e?.message || e}). Actualiza la app o contacta con soporte.`;
  console.error(e);
}
