import { Barra } from './Barra.jsx';

export function Inicio() {
  return (
    <main class="pantalla">
      <Barra titulo="Pautas" />
      <h1>¿Qué quieres hacer?</h1>
      <a class="tarjeta destacada" href="#/pro">
        <h2>Crear pautas</h2>
        <p>Para profesionales: diseña ejercicios y envíalos con un enlace o un QR.</p>
        <span class="flecha" aria-hidden="true">→</span>
      </a>
      <a class="tarjeta" href="#/paciente">
        <h2>Hacer mi pauta</h2>
        <p>Abre el enlace que te ha enviado tu profesional.</p>
        <span class="flecha" aria-hidden="true">→</span>
      </a>
    </main>
  );
}
