// Utilidades de imagen en el dispositivo: cargar, reducir el logo y pasar figuras SVG a PNG.

export function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('imagen no válida'));
    img.src = src;
  });
}

/** Reduce una imagen (archivo elegido) a PNG cuadrado de `max` px como mucho, sobre blanco. */
export async function logoDesdeArchivo(file, max = 256) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Elige una imagen.');
  if (file.size > 8 * 1024 * 1024) throw new Error('La imagen es demasiado grande (máx. 8 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = await cargarImagen(url);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

/** Figura de la biblioteca (SVG) a JPEG data URL de `px` lado, fondo blanco (para el PDF). */
export async function svgAJpeg(src, px = 300) {
  const img = await cargarImagen(src);
  const c = Object.assign(document.createElement('canvas'), { width: px, height: px });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, px, px);
  ctx.drawImage(img, 0, 0, px, px);
  return c.toDataURL('image/jpeg', 0.82);
}
