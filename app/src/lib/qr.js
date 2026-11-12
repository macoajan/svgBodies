// Código QR generado en el dispositivo (qrcode-generator, MIT). Nunca se usa un servicio externo.
import qrcode from 'qrcode-generator';

/** Matriz del QR: { n, dark(r, c) }. Corrección M (o L si el texto es largo). */
export function qrMatrix(text) {
  let q;
  try { q = qrcode(0, 'M'); q.addData(text); q.make(); }
  catch { q = qrcode(0, 'L'); q.addData(text); q.make(); }
  const n = q.getModuleCount();
  return { n, dark: (r, c) => q.isDark(r, c) };
}

/** Trazado SVG (un único path) del QR con margen de 4 módulos. */
export function qrPath(text) {
  const { n, dark } = qrMatrix(text);
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
  return { size: n + 8, d };
}

/** PNG del QR (data URL) para compartirlo como imagen, con un pie de texto opcional. */
export function qrPng(text, { px = 10, pie = '' } = {}) {
  const { n, dark } = qrMatrix(text);
  const side = (n + 8) * px;
  const extra = pie ? Math.round(px * 6) : 0;
  const canvas = document.createElement('canvas');
  canvas.width = side; canvas.height = side + extra;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) ctx.fillRect((c + 4) * px, (r + 4) * px, px, px);
  if (pie) {
    ctx.font = `600 ${Math.round(px * 2.4)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(pie.slice(0, 40), side / 2, side + extra * 0.45);
  }
  return canvas.toDataURL('image/png');
}

/** PNG del QR con el logo del profesional encima (Pro). */
export async function qrPngConLogo(text, { pie = '', logo = null, px = 10 } = {}) {
  if (!logo) return qrPng(text, { px, pie });
  const { cargarImagen } = await import('./imagenes.js');
  const [qrImg, logoImg] = await Promise.all([cargarImagen(qrPng(text, { px, pie })), cargarImagen(logo)]);
  const cab = Math.round(px * 12);
  const c = Object.assign(document.createElement('canvas'), { width: qrImg.width, height: qrImg.height + cab });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
  const k = Math.min((cab - px * 2) / logoImg.height, (c.width * 0.6) / logoImg.width);
  const w = logoImg.width * k, h = logoImg.height * k;
  ctx.drawImage(logoImg, (c.width - w) / 2, px * 2, w, h);
  ctx.drawImage(qrImg, 0, cab);
  return c.toDataURL('image/png');
}
