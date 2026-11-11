// Temas visuales (tokens en themes.css). Lado profesional: variantes de A y C; lado paciente:
// solo temas con fondo blanco (decisión del propietario). A2 (oscuro, pantalla del box) queda
// para v1.1, con los canales públicos.
export const THEMES = Object.freeze({
  A1: { nombre: 'Pista clara', familia: 'A', oscuro: false, muestra: ['#F3F3EE', '#111214', '#D4FF3A'] },
  A:  { nombre: 'Pista', familia: 'A', oscuro: true, muestra: ['#111214', '#F2F2EE', '#D4FF3A'] },
  A2: { nombre: 'Box', familia: 'A', oscuro: true, muestra: ['#0E0F11', '#F2F2EE', '#FF6A3D'], v: '1.1' },
  C:  { nombre: 'Cercano', familia: 'C', oscuro: false, muestra: ['#FFFFFF', '#14213D', '#FFD2B3'] },
  C1: { nombre: 'Cercano legible', familia: 'C', oscuro: false, muestra: ['#FFFFFF', '#14213D', '#DCD2FF'] },
  C2: { nombre: 'Cercano noche', familia: 'C', oscuro: true, muestra: ['#121A2E', '#F4F1EA', '#FFB98F'] },
});
export const THEMES_PRO = Object.freeze(['A1', 'A', 'C', 'C1', 'C2']);
export const THEMES_PACIENTE = Object.freeze(['C', 'C1']);
export const DEFAULT_THEME = Object.freeze({ pro: 'A1', paciente: 'C' });

/** Tema válido para un lado ('pro' | 'paciente'), con el de por defecto si no lo es. */
export function themeFor(side, ajustes) {
  const list = side === 'paciente' ? THEMES_PACIENTE : THEMES_PRO;
  const want = side === 'paciente' ? ajustes?.temaPaciente : ajustes?.temaPro;
  return list.includes(want) ? want : DEFAULT_THEME[side === 'paciente' ? 'paciente' : 'pro'];
}

export function applyTheme(id, doc = document) {
  const root = doc.documentElement;
  root.dataset.theme = id;
  root.style.colorScheme = THEMES[id]?.oscuro ? 'dark' : 'light';
  const meta = doc.querySelector('meta[name="theme-color"]') || doc.head.appendChild(Object.assign(doc.createElement('meta'), { name: 'theme-color' }));
  meta.setAttribute('content', THEMES[id]?.muestra[0] || '#FFFFFF');
}
