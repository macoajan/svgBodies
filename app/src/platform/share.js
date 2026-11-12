// Compartir y copiar: hoja de compartir nativa en la app (@capacitor/share) y Web Share o
// portapapeles en el navegador. Devuelve 'compartido', 'copiado', 'descargado' o 'cancelado'.
import { Capacitor } from '@capacitor/core';

export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return 'copiado'; } catch {
    const t = document.createElement('textarea');
    t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.append(t); t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    return ok ? 'copiado' : 'cancelado';
  }
}

export async function compartirEnlace({ title, text, url }) {
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share');
    try { await Share.share({ title, text, url, dialogTitle: title }); return 'compartido'; } catch { return 'cancelado'; }
  }
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'compartido'; } catch (e) { if (e?.name === 'AbortError') return 'cancelado'; }
  }
  return copiar(url);
}

/**
 * Comparte un archivo (contenido en base64). En la app, hoja nativa; en el navegador, Web Share
 * con archivos o descarga.
 */
export async function compartirArchivo({ base64, nombre, mime, title = nombre }) {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const { uri } = await Filesystem.writeFile({ path: nombre, data: base64, directory: Directory.Cache });
    try { await Share.share({ title, files: [uri], dialogTitle: title }); return 'compartido'; } catch { return 'cancelado'; }
  }
  // Sin fetch(data:), que la CSP (connect-src) no permite.
  const bin = atob(base64);
  const blob = new Blob([Uint8Array.from(bin, ch => ch.charCodeAt(0))], { type: mime });
  const file = new File([blob], nombre, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'compartido'; } catch (e) { if (e?.name === 'AbortError') return 'cancelado'; }
  }
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return 'descargado';
}

/** Comparte una imagen PNG (data URL). */
export const compartirImagen = (dataUrl, nombre = 'pauta-qr.png', title = 'Código QR') =>
  compartirArchivo({ base64: dataUrl.split(',')[1], nombre, mime: 'image/png', title });

/** Base64 de un texto UTF-8. */
export function textoABase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
