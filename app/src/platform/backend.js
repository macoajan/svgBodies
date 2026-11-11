// Elige dónde se guardan los datos: archivos en la app nativa, IndexedDB en el navegador.
import { Capacitor } from '@capacitor/core';
import { fileBackend, indexedDbBackend } from '../data/storage.js';

export async function pickBackend() {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    return fileBackend({ Filesystem, Directory, Encoding });
  }
  return indexedDbBackend();
}
