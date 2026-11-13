// Configuración de la app. El servidor es el PROVISIONAL (susceptible de cambio): su URL sale de
// VITE_SERVER_URL (archivo .env) y también entra en la CSP de index.html.
export const SERVER_URL = (import.meta.env?.VITE_SERVER_URL || 'https://pautas.maroto.es').replace(/\/+$/, '');
export const LIB_BASE = './lib';
// Identificador del producto Pro en App Store y Google Play (PROVISIONAL, lo fija el publisher).
export const PRO_PRODUCT_ID = import.meta.env?.VITE_PRO_ID || 'pro';

// PRUEBAS: botón «Desbloquear Pro» sin compra. QUITAR ANTES DE PUBLICAR (poner a false).
export const DESBLOQUEO_PRUEBAS = true;
