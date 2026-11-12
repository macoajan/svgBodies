// Compra única Pro con capacitor-plugin-cdv-purchase (StoreKit 2 y Google Play Billing 8).
// Sin validador externo: la tienda verifica la compra en el dispositivo y no se envían datos a
// terceros. Solo en la app nativa; en el navegador la tienda no está disponible.
import { Capacitor } from '@capacitor/core';
import { PRO_PRODUCT_ID } from '../config.js';

export const tiendaDisponible = () => Capacitor.isNativePlatform();
let mod = null;

export async function iniciarTienda({ onPrecio, onPropiedad }) {
  mod = await import('capacitor-plugin-cdv-purchase');
  const { store, ProductType, Platform } = mod;
  const platform = Capacitor.getPlatform() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;
  store.register([{ id: PRO_PRODUCT_ID, type: ProductType.NON_CONSUMABLE, platform }]);
  const comprobar = () => onPropiedad(store.owned(PRO_PRODUCT_ID));
  store.when()
    .productUpdated(p => { if (p.id === PRO_PRODUCT_ID) { if (p.pricing?.price) onPrecio(p.pricing.price); comprobar(); } })
    .approved(t => t.verify())
    .verified(r => r.finish())
    .finished(() => comprobar())
    .receiptUpdated(() => comprobar());
  await store.initialize([platform]);
  comprobar();
}

export async function comprarPro() {
  if (!mod) throw new Error('La tienda no está disponible.');
  const offer = mod.store.get(PRO_PRODUCT_ID)?.getOffer();
  if (!offer) throw new Error('El producto no está disponible ahora mismo.');
  const err = await offer.order();
  if (err && err.code !== mod.ErrorCode.PAYMENT_CANCELLED) throw new Error(err.message);
}

export async function restaurarCompras() {
  if (!mod) throw new Error('La tienda no está disponible.');
  await mod.store.restorePurchases();
  return mod.store.owned(PRO_PRODUCT_ID);
}
