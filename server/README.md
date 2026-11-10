# Servidor de pautas (acortador privado)

Guarda pautas cifradas que no puede leer y sirve el visor web. El dominio es configurable
(`PUBLIC_URL`); para pruebas, `https://maroto.es`. Node ≥ 22.5, sin dependencias.

```
npm test        # pruebas
npm start       # servidor (pendiente: src/main.mjs)
```

## Qué está hecho

| Fichero | Contenido |
|---|---|
| `public/pauta-crypto.js` | Cifrado AES-GCM con la clave en el fragmento del enlace; enlaces corto (`/p/<código>#<clave>`) y largo (`/p#<clave>.<bloque>`). |
| `public/pauta-schema.js` | Formato v1 de la pauta (dosis, descansos, `show.kcal`, `format` tipo WOD) y de la respuesta del paciente; validación; duración y calorías estimadas. |
| `public/visibility.js` | Visibilidad por fechas y modo (`auto`, `show`, `hide`). |
| `src/config.mjs` | Configuración por variables de entorno. |

## Ámbitos

- **Privada**: una pauta para una persona. Enlace `/p/<código>#<clave>`.
- **Pública**: un canal (p. ej. el WOD de un gimnasio) con muchas sesiones y muchos
  suscriptores. Enlace o QR `/c/<código>#<clave>`. La clave del canal la tienen todos los
  suscriptores; el contenido sigue cifrado para el servidor.

Cada pauta y cada sesión de un canal lleva una **visibilidad en claro** (`visibility.js`):
`{ mode, from?, until? }`. El servidor solo entrega lo visible en ese momento, así que nadie
puede leer por adelantado una sesión programada. Las fechas y el modo no son datos de salud.

## API prevista

Las escrituras exigen el token de edición (`Authorization: Bearer <token>`), que se crea con
la pauta o el canal y que el servidor guarda resumido (SHA-256).

| Petición | Qué hace |
|---|---|
| `POST /api/p` | Crea una pauta privada `{ blob, visibility? }` → `{ code, token, url }` |
| `GET /api/p/<código>` | Devuelve el bloque si es visible (404 si no existe, 403 si aún no se puede ver) |
| `PUT /api/p/<código>` | Sustituye bloque o visibilidad (token) |
| `DELETE /api/p/<código>` | Borra la pauta y sus respuestas (token) |
| `POST /api/p/<código>/r` | El paciente sube una respuesta cifrada |
| `GET /api/p/<código>/r` | El profesional recoge las respuestas (token) |
| `POST /api/c` | Crea un canal `{ blob }` (nombre, logo…, cifrados) → `{ code, token, url }` |
| `GET /api/c/<código>` | Cabecera del canal y sesiones **visibles ahora** |
| `GET /api/c/<código>?all=1` | Todas las sesiones con su estado (token) |
| `POST /api/c/<código>/s` | Añade una sesión `{ blob, visibility }` (token) |
| `PUT` / `DELETE /api/c/<código>/s/<id>` | Edita o borra una sesión (token) |
| `GET /p/<código>`, `GET /c/<código>` | Visor web |

Límites: tamaño por bloque, número de respuestas por pauta, peticiones por IP en memoria (sin
registrar IP), caducidad por inactividad (`TTL_DAYS`).
