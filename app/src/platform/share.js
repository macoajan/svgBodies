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

/** Comparte una imagen PNG (data URL). En el navegador sin Web Share, la descarga. */
export async function compartirImagen(dataUrl, nombre = 'pauta-qr.png', title = 'Código QR') {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const { uri } = await Filesystem.writeFile({ path: nombre, data: dataUrl.split(',')[1], directory: Directory.Cache });
    try { await Share.share({ title, files: [uri], dialogTitle: title }); return 'compartido'; } catch { return 'cancelado'; }
  }
  // Sin fetch(data:), que la CSP (connect-src) no permite.
  const bin = atob(dataUrl.split(',')[1]);
  const blob = new Blob([Uint8Array.from(bin, ch => ch.charCodeAt(0))], { type: 'image/png' });
  const file = new File([blob], nombre, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'compartido'; } catch (e) { if (e?.name === 'AbortError') return 'cancelado'; }
  }
  const a = Object.assign(document.createElement('a'), { href: dataUrl, download: nombre });
  document.body.append(a); a.click(); a.remove();
  return 'descargado';
}
