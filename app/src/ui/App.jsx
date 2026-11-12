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
import { PautaEditor } from './PautaEditor.jsx';
import { Pacientes } from './Pacientes.jsx';
import { Paciente } from './Paciente.jsx';
import { NavPro } from './NavPro.jsx';
import { Envio } from './Envio.jsx';
import { Seguimiento } from './Seguimiento.jsx';
import { PautaRecibida, FichaPaciente } from './PautaRecibida.jsx';
import { Sesion } from './Sesion.jsx';
import { ProCompra } from './ProCompra.jsx';

/** Rutas: `lado` decide el tema (profesional o paciente). */
export const ROUTES = [
  { path: '/', lado: 'pro', Screen: Inicio },
  { path: '/pro', lado: 'pro', Screen: ProInicio },
  { path: '/pro/catalogo', lado: 'pro', Screen: Catalogo },
  { path: '/pro/ejercicio/:id', lado: 'pro', Screen: Ejercicio },
  { path: '/pro/pauta/:id', lado: 'pro', Screen: PautaEditor },
  { path: '/pro/pauta/:id/enviar', lado: 'pro', Screen: Envio },
  { path: '/pro/pauta/:id/respuestas', lado: 'pro', Screen: Seguimiento },
  { path: '/pro/pacientes', lado: 'pro', Screen: Pacientes },
  { path: '/pro/pro', lado: 'pro', Screen: ProCompra },
  { path: '/pro/paciente/:id', lado: 'pro', Screen: Paciente },
  { path: '/paciente', lado: 'paciente', Screen: PacienteInicio },
  { path: '/paciente/p/:clave', lado: 'paciente', Screen: PautaRecibida },
  { path: '/paciente/p/:clave/e/:i', lado: 'paciente', Screen: FichaPaciente },
  { path: '/paciente/p/:clave/sesion', lado: 'paciente', Screen: Sesion },
  { path: '/ajustes', lado: 'pro', Screen: Ajustes, nav: true },
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
  const nav = m.route.nav || m.route.path.startsWith('/pro');
  return (
    <>
      <Screen key={location.value.path} params={m.params} query={location.value.query} version={{ app: __APP_VERSION__, lib: libVersion }} />
      {nav ? <NavPro /> : null}
    </>
  );
}
