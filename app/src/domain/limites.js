// Límites de la versión gratuita y funciones Pro. CAMBIAR AQUÍ el límite gratuito.
//
// «Paciente con pauta activa»: un paciente con al menos una pauta enviada (su enlace sigue
// publicado). Las pautas enviadas sin paciente cuentan cada una como un paciente.
// Lo ya enviado nunca se bloquea: el límite solo impide enviar a un paciente nuevo.
export const FREE_LIMITS = Object.freeze({ pacientesActivos: 3 });

/** Qué desbloquea Pro (para la pantalla de compra). */
export const PRO_FEATURES = Object.freeze([
  'Pacientes con pauta activa sin límite',
  'Plantillas de pautas reutilizables',
  'Tu logo en el PDF y en el QR',
  'PDF de la pauta para imprimir o enviar',
]);

const slot = r => (r.pacienteId ? `p:${r.pacienteId}` : `u:${r.id}`);

/** Pacientes (o pautas sueltas) con alguna pauta enviada. */
export const activos = pautas => new Set(pautas.filter(r => r.envio).map(slot));

/** Uso del límite gratuito: { usados, limite }. */
export const uso = pautas => ({ usados: activos(pautas).size, limite: FREE_LIMITS.pacientesActivos });

/**
 * ¿Se puede enviar esta pauta? Siempre si es Pro, si ya estaba enviada o si su paciente ya
 * tiene otra pauta activa. Si no, solo si queda hueco en el límite gratuito.
 */
export function puedeEnviar(pautas, id, pro) {
  if (pro) return true;
  const r = pautas.find(x => x.id === id);
  if (!r) return false;
  const a = activos(pautas);
  if (r.envio || a.has(slot(r))) return true;
  return a.size < FREE_LIMITS.pacientesActivos;
}
