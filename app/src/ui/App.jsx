import { useEffect, useState } from 'preact/hooks';
import { location, match } from '../router.js';
import { ajustes } from '../data/app-store.js';
import { applyTheme, themeFor } from '../themes/themes.js';
import { loadLibrary } from '../lib/library.js';
import { Inicio } from './Inicio.jsx';
import { ProInicio } from './ProInicio.jsx';
import { PacienteInicio } from './PacienteInicio.jsx';
import { Ajustes } from './Ajustes.jsx';
import { Catalogo } from './Catalogo.jsx';
import { Ejercicio } from './Ejercicio.jsx';

/** Rutas: `lado` decide el tema (profesional o paciente). */
export const ROUTES = [
  { path: '/', lado: 'pro', Screen: Inicio },
  { path: '/pro', lado: 'pro', Screen: ProInicio },
  { path: '/pro/catalogo', lado: 'pro', Screen: Catalogo },
  { path: '/pro/ejercicio/:id', lado: 'pro', Screen: Ejercicio },
  { path: '/paciente', lado: 'paciente', Screen: PacienteInicio },
  { path: '/ajustes', lado: 'pro', Screen: Ajustes },
];

function NoEncontrada() {
  return <main class="pantalla"><h1>Página no encontrada</h1><a class="boton" href="#/">Ir al inicio</a></main>;
}

export function App() {
  const m = match(ROUTES, location.value.path);
  const lado = m?.route.lado || 'pro';
  const tema = themeFor(lado, ajustes.value);
  useEffect(() => applyTheme(tema), [tema]);
  useEffect(() => { window.scrollTo(0, 0); }, [location.value.path]);

  const [libVersion, setLibVersion] = useState('…');
  useEffect(() => { loadLibrary().then(l => setLibVersion(l.manifest.version.slice(0, 8)), () => setLibVersion('sin cargar')); }, []);

  if (!m) return <NoEncontrada />;
  const { Screen } = m.route;
  return <Screen params={m.params} query={location.value.query} version={{ app: __APP_VERSION__, lib: libVersion }} />;
}
