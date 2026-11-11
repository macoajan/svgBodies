// Enlaces de pauta que abren la app (Universal Links / App Links). El enlace completo, con la
// clave en el fragmento, llega en el evento appUrlOpen; se deja en una señal y se lleva al
// paciente a su pantalla. La ejecución guiada (F4) lo consumirá.
import { signal } from '@preact/signals';
import { Capacitor } from '@capacitor/core';
import { parseLink } from '@shared/pauta-crypto.js';
import { navigate } from '../router.js';

export const pendingLink = signal(null);

/** true si la URL es un enlace de pauta (corto o largo) con su clave. */
export function isPautaLink(url) {
  try { return !!parseLink(url); } catch { return false; }
}

export function acceptLink(url) {
  if (!isPautaLink(url)) return false;
  pendingLink.value = url;
  navigate('/paciente');
  return true;
}

export async function listenLinks() {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  App.addListener('appUrlOpen', ({ url }) => acceptLink(url));
  const launch = await App.getLaunchUrl();
  if (launch?.url) acceptLink(launch.url);
}
