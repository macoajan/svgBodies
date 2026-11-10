// Límite de peticiones por IP con ventanas fijas, solo en memoria: las IP no se guardan en
// disco ni en registros, y se olvidan al acabar cada ventana.
export function createRateLimiter({ windowMs, limits }) {
  let windowStart = 0;
  let counts = new Map();
  // Devuelve 0 si se permite la petición, o los milisegundos que faltan para poder repetirla.
  return {
    hit(ip, kind, now = Date.now()) {
      if (now - windowStart >= windowMs) { windowStart = now - ((now - windowStart) % windowMs); counts = new Map(); }
      const key = `${kind}:${ip}`;
      const n = (counts.get(key) || 0) + 1;
      counts.set(key, n);
      return n > limits[kind] ? windowStart + windowMs - now : 0;
    },
  };
}
