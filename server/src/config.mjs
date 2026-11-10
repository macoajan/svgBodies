// Configuración por variables de entorno. Valores por defecto pensados para pruebas.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const int = (v, d) => (v === undefined || v === '' ? d : Number.parseInt(v, 10));
const list = v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : []);

export function loadConfig(env = process.env) {
  return {
    // Dominio público con el que se construyen los enlaces (sin barra final).
    publicUrl: (env.PUBLIC_URL || 'https://maroto.es').replace(/\/+$/, ''),
    port: int(env.PORT, 3000),
    host: env.HOST || '0.0.0.0',
    dataDir: env.DATA_DIR || path.resolve(here, '../data'),
    libraryDir: env.LIBRARY_DIR || path.resolve(here, '../../library'),
    publicDir: path.resolve(here, '../public'),
    // Días sin modificación tras los que una pauta y sus respuestas se borran.
    ttlDays: int(env.TTL_DAYS, 120),
    maxBlob: int(env.MAX_BLOB_BYTES, 16 * 1024),
    maxResponse: int(env.MAX_RESPONSE_BYTES, 8 * 1024),
    maxResponses: int(env.MAX_RESPONSES, 1000),
    // Límites por IP en ventanas de 10 minutos (solo en memoria; las IP no se registran).
    writeLimit: int(env.RATE_WRITES, 60),
    readLimit: int(env.RATE_READS, 600),
    // Detrás del proxy de Coolify la IP real llega en X-Forwarded-For.
    trustProxy: env.TRUST_PROXY !== '0',
    // Asociación de dominio con la app (opcional): enlaces universales e App Links.
    iosAppIds: list(env.IOS_APP_IDS),          // p. ej. ABCDE12345.es.ejemplo.app
    androidPackage: env.ANDROID_PACKAGE || '',
    androidSha256: list(env.ANDROID_SHA256),
  };
}
