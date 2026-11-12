# Diseño técnico de la app — v1

Estado: propuesta para revisar con el propietario (noviembre de 2026). Las decisiones de
producto y alcance están en `docs/handoff.md` (sección «App»); aquí se describe cómo
construirlo. **No añadir funcionalidades fuera del alcance de v1 sin acordarlo.**

## 1. Resumen

- Una sola app para iOS y Android (y web para desarrollo), hecha con tecnología web dentro de
  **Capacitor 8** (versión estable actual; Capacitor 9 aún no ha salido).
- **Un único binario con dos papeles**: el profesional crea y envía pautas; el paciente las
  abre desde el enlace o el QR y las hace con ejecución guiada. El paciente nunca paga.
- **Funciona sin conexión**: la biblioteca (catálogo, figuras y posturas 3D) va dentro de la
  app. La red solo hace falta para publicar una pauta, abrir una pauta por enlace corto y
  enviar o leer respuestas.
- **Sin cuentas y sin datos legibles en el servidor**: reutiliza el cifrado, el esquema y el
  cliente que ya funcionan en `server/public/`.
- **Compra única «Pro»** con StoreKit 2 y Google Play Billing 8, sin servidor propio de
  validación.

## 2. Pila y estructura

| Pieza | Elección | Motivo |
|---|---|---|
| Contenedor nativo | Capacitor 8, iOS con Swift Package Manager | Oficial y mantenido; SPM porque CocoaPods trunk pasa a solo lectura el 2 de diciembre de 2026 |
| Interfaz | Preact + `@preact/signals`, JavaScript con tipos en JSDoc (`tsc --checkJs`) | Unos 5 KB, componentes sin la carga de React, y el mismo JavaScript sin compilar de los módulos compartidos |
| Empaquetado | Vite | Servidor de desarrollo rápido; salida estática que Capacitor copia |
| Rutas | Router propio por hash (`#/pauta/…`), unas 60 líneas | Sin dependencias; funciona igual en web y en la app |
| Estilos | CSS con variables (tokens por tema), sin framework | Los temas A/C ya están definidos como tokens en el lienzo |
| Pruebas | `node --test` para la lógica y Playwright contra el servidor de Vite para la interfaz | Lo mismo que ya usa `server/` |

Estructura del repositorio:

```
app/
  index.html, vite.config.js, capacitor.config.json, package.json
  src/
    main.js            arranque, router, tema
    ui/                componentes y pantallas (pro/, paciente/, comun/)
    domain/            lógica pura y probada: ejecucion.js, limites.js, plantillas.js
    data/              repositorio local (storage.js) y ajustes
    platform/          envoltorios de plugins (share, haptics, avisos, compras, enlaces)
    themes/            tokens A, A1, A2, C, C1, C2 y fuentes
  public/lib/          GENERADO por tools/build-app-library.mjs (no se versiona)
  test/
  ios/, android/       proyectos nativos generados por Capacitor (sí se versionan)
```

**Código compartido.** La app importa los módulos de `server/public/`
(`pauta-crypto.js`, `pauta-schema.js`, `visibility.js`, `api-client.js`) mediante el alias de
Vite `@shared`. Hay una sola copia; el visor web, el servidor y la app no pueden divergir. Si
algún día se sustituye el servidor provisional, esos módulos se mueven a `shared/` sin tocar la
app (solo cambia el alias).

## 3. Biblioteca sin conexión

`tools/build-app-library.mjs` genera `app/public/lib/` a partir de `library/`, la misma fuente
que usa el servidor:

- `catalog.json` tal cual (113 ejercicios, vocabularios, textos es/en, `met`).
- Figuras `svg/` optimizadas (quitar metadatos y redondear decimales): unos 13 MB sin
  comprimir, 1,3 MB comprimidos. La ficha usa las tres vistas; las listas, una.
- `poses/<id>.json` partido por ejercicio, como en el servidor. Se cargan bajo demanda al
  abrir el 3D; el `poses.json` entero (3,4 MB) no se carga nunca.
- `viewer.js` (PoseViewer) sin cambios.

**Versiones de la biblioteca.** Una pauta solo lleva `id` de ejercicio. Si llega una pauta con
un `id` que esta versión de la app no tiene (creada con una app más nueva), se muestra una
tarjeta «Actualiza la app para ver este ejercicio» y un enlace al visor web, que siempre tiene
la biblioteca al día. `checkPauta(p, known)` ya separa los `id` desconocidos.

## 4. Datos locales

Todo vive en el dispositivo. Para no perder datos importantes (claves y tokens de edición de
las pautas publicadas), **no se usa IndexedDB ni localStorage** en la app nativa: iOS y
Android pueden vaciarlos cuando falta espacio. Se usa `@capacitor/filesystem` en
`Directory.Data`: un archivo JSON por colección, escrito de forma atómica (temporal + renombrar)
y con todo el contenido en memoria mientras la app está abierta. Los volúmenes son pequeños
(cientos de pautas de pocos KB). En el navegador (desarrollo) se usa IndexedDB detrás de la
misma interfaz.

| Colección | Contenido | Papel |
|---|---|---|
| `ajustes` | tema, nombre y centro del profesional, logo (Pro), peso del usuario para kcal, idioma | ambos |
| `pacientes` | alias, nota privada, fecha de alta. Nunca nombre real obligatorio | profesional |
| `pautas` | pauta v1 en claro + `{code, key, token, publicada, versión, visibilidad}` | profesional |
| `respuestas` | respuestas descifradas por pauta y último `after` leído | profesional |
| `plantillas` | pautas sin paciente reutilizables (Pro) | profesional |
| `recibidas` | enlace, pauta descifrada en caché, progreso por día, respuestas enviadas | paciente |
| `compra` | derecho Pro en caché y fecha de la última comprobación | ambos |

**Copia de seguridad.** Exportar e importar un archivo `.pautas` cifrado con una frase de paso
(AES-GCM con clave derivada por PBKDF2, mismas primitivas WebCrypto), mediante la hoja de
compartir. Además, la copia de seguridad del sistema (iCloud o Google) incluye el directorio de
datos. Es la copia del propio profesional, que es el responsable del tratamiento de los datos
de sus pacientes. Hay que indicarlo en la política de privacidad.

**Migraciones.** Cada archivo lleva `{v, data}`. Al arrancar se aplican en orden las
migraciones de `data/migraciones.js`, cada una probada con una fixture.

## 5. Enlaces, QR y compartir

- **Abrir enlaces en la app**: Universal Links (iOS) y App Links (Android) sobre el dominio de
  `PUBLIC_URL`. El servidor ya publica `apple-app-site-association` y `assetlinks.json` a
  partir de `IOS_APP_IDS` y `ANDROID_*`; falta rellenarlos cuando existan las cuentas del
  publisher. El fragmento `#clave` llega a la app dentro de la URL (evento `appUrlOpen` del
  plugin `@capacitor/app`). Sin la app instalada, el mismo enlace abre el visor web, que ya
  funciona.
- **QR**: se genera en el dispositivo con `qrcode-generator` (MIT, sin dependencias, copiado en
  `vendor/`), nunca con un servicio externo. El paciente lo lee con la cámara del sistema; la
  app no necesita lector en v1.
- **Compartir**: `@capacitor/share` con el texto, el enlace y la imagen del QR (PNG generado
  con canvas).
- **Publicar**: `publishPauta()` del `api-client`. Si el servidor no responde, se usa el enlace
  largo sin conexión (ya implementado) y se avisa de que no recibirá respuestas.
- **Actualizar o retirar**: `updatePauta` y `deletePauta` con el token guardado; el enlace no
  cambia.
- **Respuestas**: `fetchRespuestas(after)` al abrir Seguimiento y al deslizar para refrescar.
  No hay notificaciones push en v1, porque exigirían que el servidor supiera a quién avisar.
  Un contador local marca las respuestas nuevas.

## 6. Ejecución guiada (lado paciente)

Es el núcleo de la app y va en un módulo puro, `domain/ejecucion.js`, sin interfaz y probado a
fondo.

**Máquina de estados**, alimentada por los campos de cada ítem (`sets`, `reps`, `hold`, `tempo`,
`perSide`, `restRep`, `restSide`, `restSet`, `restAfter`) y por `restBetween`:

```
preparar → trabajo ─┬→ descansoRep ──→ trabajo
                    ├→ cambioLado ───→ trabajo
                    ├→ descansoSerie → trabajo
                    └→ fin ejercicio → valorar → descansoEjercicio → preparar (siguiente)
                                                          … → resumen → enviar respuesta
```

- **Tiempo por marcas absolutas**: cada estado guarda `terminaEn` (`Date.now()` + duración) y
  la pantalla calcula lo que queda. Así nada se desfasa al bloquear el teléfono o pasar a
  segundo plano. El estado se guarda en `recibidas` en cada transición: si el sistema cierra
  la app, al volver se reanuda donde estaba.
- **Repeticiones** sin `hold`: el paciente pulsa «Serie hecha». Con `hold`: cuenta atrás por
  repetición y avance automático. El `tempo` solo ajusta la duración estimada.
- **Alargar o acortar descansos**: botones −15 s y +15 s y «Saltar». Solo cambian `terminaEn`
  de ese descanso.
- **Avisos**: sonido corto con Web Audio y vibración con `@capacitor/haptics` al acabar cada
  descanso y cada aguante. Si la app está en segundo plano, una notificación local programada
  para `terminaEn` (`@capacitor/local-notifications`); se pide permiso la primera vez, y si se
  rechaza todo sigue funcionando.
- **Pantalla encendida** durante la sesión con `@capacitor-community/keep-awake`.
- **Valoración** por ejercicio (fácil/bien/difícil, dolor 0–10, comentario) al terminarlo. En
  el resumen se envía todo junto con `sendRespuesta`. Si no hay red, queda en cola y se reintenta.
- **Calorías**: solo si la pauta trae `show.kcal`, con `estimateSession()` y el peso guardado en
  el dispositivo (70 kg si no se indica).
- **Formatos de WOD** (AMRAP, EMOM, for time, tabata): fuera de v1. Llegan con los canales en
  v1.1; en v1 esas sesiones se muestran como lista, igual que en el visor web.

## 7. Temas y accesibilidad

- Tokens como variables CSS en `themes/*.css`. **A1 «Pista clara»** es el tema por defecto del
  lado del profesional y **C «Cercano»** el del paciente (siempre con fondo blanco). A, C1 y C2
  se pueden elegir en Ajustes. **A2** (oscuro, para la pantalla del box) queda para v1.1.
- Fuentes Barlow, Barlow Condensed y Lexend (OFL) incluidas en la app, sin Google Fonts.
- Objetivos táctiles de al menos 44 px, contraste AA, respeto a «reducir movimiento» (el 3D
  muestra la postura quieta) y al tamaño de texto del sistema.
- Diseño adaptable: móvil, y en tablet dos columnas (lista + detalle), como en los mockups de
  tablet.
- Idioma: interfaz en español en v1, con las cadenas en `i18n/es.js` para añadir inglés después.
  Las fichas ya tienen texto `en` en la taxonomía.

## 8. Compra Pro

- **Producto**: un único no consumible `pro` en App Store y Google Play, en las cuentas del
  publisher.
- **Plugin**: `capacitor-plugin-cdv-purchase` (edición Capacitor de `cordova-plugin-purchase`,
  código abierto). Usa StoreKit 2 y Google Play Billing 8, gestiona el *acknowledge* de Google y
  la restauración, y **no envía datos a terceros**. RevenueCat y similares quedan descartados:
  añaden un encargado del tratamiento y no hacen falta para una compra única.
- **Validación en el dispositivo**: StoreKit 2 verifica la firma; en Google cuenta el estado
  `PURCHASED` reconocido. No hay validación en servidor en v1: con un precio bajo, el riesgo de
  piratería es aceptable.
- **Derecho en caché**: se guarda en `compra` y se vuelve a comprobar al arrancar si hay red.
  Sin red, se confía en la caché. Botón «Restaurar compras» en Ajustes (obligatorio en Apple).
- **Qué desbloquea**: pautas activas ilimitadas, plantillas, logo propio y PDF. Los límites
  gratuitos están en `domain/limites.js` como constantes **decididos: 3 pacientes con pauta activa** (constante
  fácil de cambiar). Lo ya publicado nunca se bloquea: si se superan los límites
  gratuitos, solo se impide crear más.
- **PDF de la pauta** (Pro): se genera en el dispositivo con `jspdf` + `svg2pdf.js` (figuras
  vectoriales) y se comparte con la hoja del sistema.

## 9. Privacidad, seguridad y tiendas

- **Sin analítica, sin SDK de errores y sin anuncios.** Los fallos los envía el usuario a mano
  («Copiar informe» en Ajustes).
- CSP estricta en la app: sin `eval` y con `connect-src` limitado al dominio de `PUBLIC_URL`.
- **Etiquetas de privacidad** (para el publisher): el contenido viaja cifrado de extremo a
  extremo, el servidor no guarda IP (el límite de peticiones está solo en memoria) y no hay
  identificadores. Previsiblemente «Datos no recopilados» en Apple y «Sin datos recopilados» en
  Google. El texto final lo confirma quien lleve la parte legal.
- **Categoría** «Salud y forma física», sin afirmaciones clínicas, con un aviso de que la pauta
  la indica el profesional. No se crean cuentas, así que no hace falta borrado de cuenta; sí una
  opción para borrar todos los datos locales.
- **Revisión de Apple 4.2 (funcionalidad mínima)**: biblioteca sin conexión, avisos,
  vibración, compartir nativo y enlaces universales, lo que la distingue de una web
  empaquetada.

## 10. Compilación y publicación

- **Android**: se puede compilar en este contenedor y en GitHub Actions (Gradle). Las pruebas en
  dispositivo las hace el propietario con el APK de pruebas.
- **iOS**: requiere un Mac con Xcode (lo hace el propietario) o un runner macOS de GitHub
  Actions (cuesta minutos de pago). En v1, compilación local en el Mac del propietario con la
  guía paso a paso que se incluirá en `app/README.md`.
- **Cuentas**: la app se publica en las cuentas del publisher, con el propietario como miembro
  del equipo (Apple: rol App Manager o Developer; Google: acceso a la app). Firmas y
  certificados en esas cuentas.
- **Distribución de pruebas**: TestFlight y prueba interna de Google Play antes de publicar.

## 11. Fases (una sesión y un PR cada una)

| Fase | Contenido | Resultado comprobable | Tokens aprox. |
|---|---|---|---|
| F0 Esqueleto (hecha) | `app/` con Vite, Preact y Capacitor; alias `@shared`; temas y fuentes; router; almacenamiento con migraciones; `build-app-library`; pruebas en marcha | La app arranca en web y en el emulador Android con el tema elegido | 250–400 k |
| F1 Biblioteca (hecha) | Catálogo con búsqueda y filtros (región, objetivo, material, nivel), ficha con 3 vistas y 3D | Navegar los 113 ejercicios sin red | 300–500 k |
| F2 Editor (hecha) | Pacientes por alias; pauta con dosis, descansos de tres niveles, notas, calendario y `show`; estimación de duración y kcal | Crear y editar pautas en local | 500–800 k |
| F3 Envío y seguimiento (hecha) | Publicar, QR, compartir, actualizar, retirar, visibilidad; leer respuestas | El paciente recibe el enlace y el profesional ve su respuesta | 300–500 k |
| F4 Paciente (hecha) | Enlaces universales, pauta recibida, ejecución guiada, valoración, resumen, cola sin red | Hacer una pauta completa con descansos y avisos | 600–900 k |
| F5 Pro (hecha) | Compra, restauración, límites, logo, plantillas, PDF, copia de seguridad | Comprar en el entorno de pruebas y desbloquear | 400–600 k |
| F6 Tiendas (preparada; faltan decisiones) | Iconos, pantalla de inicio, configuración de enlaces, textos de privacidad, compilación firmada, TestFlight y prueba interna | Versión de prueba instalable desde las tiendas | 200–400 k |

Total: unos 2,5–4 M tokens. El orden F0 → F4 da una app útil sin compras; F5 y F6 la llevan a
las tiendas.

## 12. Decisiones pendientes del propietario y del publisher

1. Límite gratuito (propuesta: 3 pacientes con pauta activa) y precio de Pro.
2. Si hay packs (por ahora no).
3. Nombre de la app, marca e icono.
4. Dominio definitivo (hoy `pautas.maroto.es`) y si el servidor provisional sigue tras v1.
5. Identificador de la app (`es.<algo>.pautas`), cuentas del publisher y alta del propietario
   como miembro; después, `IOS_APP_IDS`, `ANDROID_PACKAGE` y `ANDROID_SHA256` en Coolify.
6. Textos legales (privacidad, condiciones) y ficha de las tiendas, a cargo del publisher.
7. Antes de pacientes reales: copia de seguridad automática de `/data/pautas.sqlite`.
