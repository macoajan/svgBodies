// Estado de la compra Pro (en caché local) y acciones de compra y restauración.
import { signal, computed } from '@preact/signals';
import { storage } from './app-store.js';
import { iniciarTienda, comprarPro as comprarNativo, restaurarCompras as restaurarNativo, tiendaDisponible } from '../platform/compras.js';

export const compra = signal(null);
export const esPro = computed(() => !!compra.value?.pro);
/** @typedef {{ estado: 'cargando'|'lista'|'no-disponible'|'error', precio?: string, error?: string }} EstadoTienda */
export const tienda = signal(/** @type {EstadoTienda} */ ({ estado: 'cargando' }));

export function cargarCompra() { compra.value = storage.get('compra'); }

async function marcarPro(pro) {
  compra.value = { pro, comprobado: new Date().toISOString() };
  await storage.set('compra', compra.value);
}

/** Arranca la tienda (solo app nativa). La caché manda si no hay red. */
export async function iniciarCompras() {
  cargarCompra();
  if (!tiendaDisponible()) { tienda.value = { estado: 'no-disponible' }; return; }
  try {
    await iniciarTienda({
      onPrecio: precio => { tienda.value = { ...tienda.value, estado: 'lista', precio }; },
      onPropiedad: owned => { if (owned && !esPro.value) marcarPro(true); },
    });
    if (tienda.value.estado === 'cargando') tienda.value = { estado: 'lista' };
  } catch (e) { tienda.value = { estado: 'error', error: String(e?.message || e) }; }
}

export async function comprar() { await comprarNativo(); }

/** SOLO PRUEBAS (config DESBLOQUEO_PRUEBAS): activa o quita Pro sin compra. */
export const desbloquearPruebas = on => marcarPro(!!on);
export async function restaurar() { return restaurarNativo(); }
