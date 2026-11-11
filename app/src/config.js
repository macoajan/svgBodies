// Configuración de la app. El servidor es el PROVISIONAL (susceptible de cambio): su URL sale de
// VITE_SERVER_URL (archivo .env) y también entra en la CSP de index.html.
export const SERVER_URL = (import.meta.env?.VITE_SERVER_URL || 'https://pautas.maroto.es').replace(/\/+$/, '');
export const LIB_BASE = './lib';
