// PDF de la pauta (Pro), generado en el dispositivo con jsPDF: cabecera con logo, nombre y
// centro, mensaje, cada ejercicio con su figura, dosis, nota e instrucciones, y QR del enlace.
import { doseText } from '@shared/pauta-schema.js';
import { scheduleText } from '../domain/pautas.js';
import { figureUrls } from './library.js';
import { svgAJpeg } from './imagenes.js';
import { qrPng } from './qr.js';

const M = 16, W = 210, H = 297;
/** @type {[number, number, number]} */ const INK = [20, 33, 61];
/** @type {[number, number, number]} */ const MUTED = [90, 100, 120];

/**
 * Devuelve el PDF en base64.
 * @param {{ pauta: any, byId: Map<string, any>, ajustes?: { logo?: string, nombre?: string, centro?: string }, link?: string|null }} opts
 */
export async function generarPdf({ pauta, byId, ajustes = {}, link = null }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;
  const salto = need => { if (y + need > H - M) { doc.addPage(); y = M; } };
  /** @param {string} t @param {{ size?: number, bold?: boolean, color?: [number, number, number], x?: number, width?: number, lh?: number }} [o] */
  const texto = (t, { size = 11, bold = false, color = INK, x = M, width = W - 2 * M, lh = 1.35 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(t), width);
    const h = lines.length * size * 0.3528 * lh;
    salto(h);
    doc.text(lines, x, y + size * 0.3528);
    y += h;
    return h;
  };

  // Cabecera
  let xTxt = M;
  if (ajustes.logo) {
    try { doc.addImage(ajustes.logo, 'PNG', M, y, 18, 18); xTxt = M + 22; } catch { /* logo no válido */ }
  }
  const y0 = y;
  if (ajustes.nombre) { texto(ajustes.nombre, { size: 13, bold: true, x: xTxt, width: W - xTxt - M }); }
  if (ajustes.centro) { texto(ajustes.centro, { size: 10, color: MUTED, x: xTxt, width: W - xTxt - M }); }
  y = Math.max(y, y0 + (ajustes.logo ? 20 : 0)) + 4;
  texto(pauta.title || 'Tu pauta de ejercicios', { size: 20, bold: true });
  texto(`${scheduleText(pauta.schedule)} · ${pauta.items.length} ejercicios`, { size: 10, color: MUTED });
  y += 3;
  if (pauta.note) {
    doc.setFillColor(238, 241, 247);
    const lines = doc.splitTextToSize(pauta.note, W - 2 * M - 8);
    const h = lines.length * 11 * 0.3528 * 1.35 + 6;
    salto(h); doc.roundedRect(M, y, W - 2 * M, h, 3, 3, 'F');
    y += 3; texto(pauta.note, { x: M + 4, width: W - 2 * M - 8 }); y += 5;
  }

  // Ejercicios
  for (const [i, it] of pauta.items.entries()) {
    const ex = byId.get(it.id);
    const fig = 34;
    salto(fig + 4);
    const top = y;
    const src = ex ? figureUrls(ex)[0] : null;
    if (src) {
      try { doc.addImage(await svgAJpeg(src), 'JPEG', M, top, fig, fig); } catch { /* sin figura */ }
      doc.setDrawColor(227, 231, 240); doc.roundedRect(M, top, fig, fig, 2, 2, 'S');
    }
    const x = M + fig + 6, width = W - x - M;
    texto(`${i + 1}. ${ex?.name.es ?? it.id}`, { size: 13, bold: true, x, width });
    texto(doseText(it, pauta.format), { size: 10.5, x, width });
    if (it.note) texto(it.note, { size: 10, color: MUTED, x, width });
    const pasos = ex?.sheet?.patient;
    if (pasos) {
      y += 1;
      texto(pasos.start, { size: 9.5, x, width });
      for (const st of pasos.steps) texto(`• ${st}`, { size: 9.5, x: x + 2, width: width - 2 });
      for (const av of pasos.avoid || []) texto(`Evita: ${av}`, { size: 9.5, color: /** @type {[number, number, number]} */ ([127, 29, 29]), x: x + 2, width: width - 2 });
    } else if (ex?.animation?.cue) texto(ex.animation.cue, { size: 9.5, x, width });
    y = Math.max(y, top + fig) + 6;
  }

  // QR del enlace
  if (link) {
    salto(52);
    doc.addImage(qrPng(link, { px: 6 }), 'PNG', M, y, 40, 40);
    const yq = y; y += 8;
    texto('Ábrela en el móvil', { size: 12, bold: true, x: M + 46, width: W - 2 * M - 46 });
    texto('Lee este código con la cámara para hacer la sesión guiada, con descansos y avisos, y enviar tu valoración.', { size: 10, color: MUTED, x: M + 46, width: W - 2 * M - 46 });
    y = yq + 44;
  }
  return doc.output('datauristring').split(',')[1];
}
