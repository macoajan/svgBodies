// Estado global de la app: almacenamiento abierto y ajustes como señal reactiva.
import { signal } from '@preact/signals';
import { createStorage } from './storage.js';

/** @type {ReturnType<typeof createStorage>} */
export let storage = null;
export const ajustes = signal(null);

export async function initStore(backend) {
  storage = await createStorage({ backend }).open();
  ajustes.value = storage.get('ajustes');
  return storage;
}

export function saveAjustes(patch) {
  ajustes.value = { ...ajustes.value, ...patch };
  return storage.set('ajustes', ajustes.value);
}

export async function clearAll() {
  await storage.clear();
  ajustes.value = storage.get('ajustes');
}
