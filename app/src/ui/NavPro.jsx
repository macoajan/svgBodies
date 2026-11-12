import { location } from '../router.js';

const I = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': /** @type {'round'} */ ('round'), 'stroke-linejoin': /** @type {'round'} */ ('round'), 'aria-hidden': true };
const TABS = [
  { href: '/pro', label: 'Pautas', match: p => p === '/pro' || p.startsWith('/pro/pauta'), icon: <svg {...I}><path d="M8 4h11v16H8zM5 7v13" /><path d="M11 9h5M11 13h5" /></svg> },
  { href: '/pro/pacientes', label: 'Pacientes', match: p => p.startsWith('/pro/paciente'), icon: <svg {...I}><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg> },
  { href: '/pro/catalogo', label: 'Catálogo', match: p => p.startsWith('/pro/catalogo') || p.startsWith('/pro/ejercicio'), icon: <svg {...I}><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></svg> },
  { href: '/ajustes', label: 'Ajustes', match: p => p === '/ajustes', icon: <svg {...I}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg> },
];

/** Barra de secciones del profesional. */
export function NavPro() {
  const p = location.value.path;
  return (
    <nav class="nav-pro" aria-label="Secciones">
      {TABS.map(t => (
        <a key={t.href} href={'#' + t.href} aria-current={t.match(p) ? 'page' : undefined}>{t.icon}<span>{t.label}</span></a>
      ))}
    </nav>
  );
}
