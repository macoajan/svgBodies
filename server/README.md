# Servidor de pautas (acortador privado) — PROVISIONAL

Guarda pautas cifradas que no puede leer y sirve el visor web. **Es provisional y está hecho
para poder sustituirse**:

- La app y el visor solo hablan con él a través de `public/api-client.js`. Si se cambia de
  servidor o de proveedor, solo cambia ese fichero.
- La API está versionada (`/api/v1`); una API nueva convive con la anterior.
- El almacenamiento está detrás de la interfaz de `src/store.mjs` (hoy SQLite con
  `node:sqlite`); otro motor es otra implementación con los mismos métodos.

Node ≥ 22.5, sin dependencias. Dominio configurable (`PUBLIC_URL`); para pruebas,
`https://maroto.es`.

```
npm test        # pruebas (unitarias y de extremo a extremo con el servidor real)
npm start       # arranca en el puerto 3000
```

## Ficheros

| Fichero | Contenido |
|---|---|
| `public/api-client.js` | Cliente único: publicar, abrir, actualizar y borrar pautas; respuestas; canales y sesiones. Cifra antes de enviar. Sin conexión, genera el enlace largo. |
| `public/pauta-crypto.js` | AES-GCM con la clave en el fragmento del enlace; enlaces corto y largo. |
| `public/pauta-schema.js` | Formato v1 de pauta (dosis, descansos, `show.kcal`, `format`) y respuesta; validación; duración, calorías y dosis en lenguaje sencillo. |
| `public/visibility.js` | Visibilidad `{ mode: auto\|show\|hide, from?, until? }`. |
| `public/viewer.*` | Visor web de `/p/<código>` y `/c/<código>` (descifra en el navegador; respuesta del paciente). |
| `src/app.mjs` | Rutas HTTP, permisos por token, límites. |
| `src/store.mjs` | Almacenamiento (interfaz + SQLite). |
| `src/ratelimit.mjs` | Límite por IP en memoria (las IP no se guardan). |
| `src/config.mjs` | Variables de entorno. |
| `Dockerfile` | Imagen para Coolify (se construye desde la raíz del repositorio). |

## Ámbitos y visibilidad

- **Privada**: una pauta, una persona. Enlace `/p/<código>#<clave>`.
- **Pública**: un canal (p. ej. el WOD de un gimnasio) con muchas sesiones. Enlace o QR
  `/c/<código>#<clave>`.

La visibilidad va en claro junto al bloque cifrado y la aplica el servidor: lo programado o
forzado oculto no se entrega (403 con `estado` y, si está programado, `desde`). Quien tiene el
token de edición lo ve siempre.

## API v1

Las escrituras exigen `Authorization: Bearer <token>`; el token se devuelve al crear y el
servidor solo guarda su SHA-256. Los cuerpos son JSON `{ blob, visibility? }`, con `blob` =
`v1.<base64url>`.

| Petición | Qué hace |
|---|---|
| `POST /api/v1/p` | Crea una pauta → `{ code, token, url }` |
| `GET /api/v1/p/<código>` | `{ blob, updated }` si es visible (con token: también `visibility` y `estado`) |
| `PUT /api/v1/p/<código>` | Sustituye `blob` y/o `visibility` (token) |
| `DELETE /api/v1/p/<código>` | Borra la pauta y sus respuestas (token) |
| `POST /api/v1/p/<código>/r` | El paciente sube una respuesta cifrada |
| `GET /api/v1/p/<código>/r?after=<id>` | Respuestas para el profesional (token) |
| `POST /api/v1/c` | Crea un canal → `{ code, token, url }` |
| `GET /api/v1/c/<código>` | Cabecera y sesiones visibles; `?all=1` con token: todas, con `estado` |
| `PUT` / `DELETE /api/v1/c/<código>` | Edita o borra el canal (token) |
| `POST /api/v1/c/<código>/s` | Añade una sesión con su visibilidad (token) |
| `PUT` / `DELETE /api/v1/c/<código>/s/<id>` | Edita o borra una sesión (token) |

Además: `/p/<código>` y `/c/<código>` (visor), `/assets/*` (visor y módulos compartidos),
`/lib/catalog.json` y `/lib/svg/*.svg` (biblioteca), `/healthz`, y
`/.well-known/apple-app-site-association` y `/.well-known/assetlinks.json` si se configuran.

Errores: `{ error }` con 400 (no válido), 401 (token), 403 (no visible), 404, 405, 409 (límite
de respuestas o sesiones), 413 (demasiado grande), 429 (demasiadas peticiones).

## Configuración

| Variable | Por defecto | Uso |
|---|---|---|
| `PUBLIC_URL` | `https://maroto.es` | Dominio de los enlaces |
| `PORT` | `3000` | Puerto |
| `DATA_DIR` | `server/data` (`/data` en Docker) | Base de datos SQLite (volumen persistente) |
| `LIBRARY_DIR` | `library/` | Catálogo y SVG |
| `TTL_DAYS` | `120` | Días sin uso hasta el borrado |
| `MAX_BLOB_BYTES` / `MAX_RESPONSE_BYTES` | 16 KB / 8 KB | Tamaño máximo |
| `MAX_RESPONSES` / `MAX_SESIONES` | 1000 / 2000 | Por pauta / por canal |
| `RATE_WRITES` / `RATE_READS` | 60 / 600 | Peticiones por IP cada 10 min |
| `TRUST_PROXY` | `1` | Leer la IP de `X-Forwarded-For` (detrás de Coolify) |
| `IOS_APP_IDS`, `ANDROID_PACKAGE`, `ANDROID_SHA256` | — | Enlaces que abren la app |

## Despliegue en Coolify

Aplicación desde el repositorio con *Build Pack* Dockerfile: *Base Directory* `/`,
*Dockerfile Location* `/server/Dockerfile`, puerto `3000`, volumen persistente montado en
`/data`, dominio en `PUBLIC_URL`. Copia de seguridad: el fichero `/data/pautas.sqlite`.
