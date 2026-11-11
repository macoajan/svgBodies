import { Atras, Ajustes } from './iconos.jsx';

/**
 * Barra superior: volver (opcional), título y acceso a Ajustes.
 * @param {{ titulo: string, volver?: string, ajustes?: boolean }} props
 */
export function Barra({ titulo, volver, ajustes = true }) {
  return (
    <header class="barra">
      {volver ? <a class="icono-btn" href={'#' + volver} aria-label="Volver"><Atras /></a> : null}
      <span class="titulo">{titulo}</span>
      {ajustes ? <a class="icono-btn" href="#/ajustes" aria-label="Ajustes"><Ajustes /></a> : null}
    </header>
  );
}
