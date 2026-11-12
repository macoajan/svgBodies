# App de pautas (v1, en construcción)

App para iOS y Android hecha con **Capacitor 8 + Preact + Vite**. Un solo binario con dos
papeles: el profesional crea y envía pautas; el paciente las abre por enlace o QR y las hace.
Diseño completo y fases en [`docs/app-diseno-tecnico.md`](../docs/app-diseno-tecnico.md).

Estado: **F0 (esqueleto)**, **F1 (biblioteca)** y **F2 (editor)** hechas — arranque, router,
temas, datos locales con migraciones, apertura de una pauta por enlace, catálogo con búsqueda y
filtros, ficha de ejercicio con vistas 2D/3D, pacientes por alias y editor de pautas con guardado
automático. Pruebas de interfaz: `test/e2e-smoke.mjs`, `test/e2e-catalogo.mjs` y
`test/e2e-editor.mjs`.

## Uso

```bash
npm install
npm run dev          # copia la biblioteca y abre el servidor de desarrollo
npm test             # lógica: almacenamiento, router, temas, biblioteca
npm run typecheck    # JSDoc comprobado con tsc
npm run build        # dist/ para Capacitor
npx cap sync         # copia dist/ a ios/ y android/
```

La biblioteca (`public/lib/`) se genera desde `../library/` con `tools/build-app-library.mjs`
(`npm run lib`); no se versiona.

## Estructura

- `src/main.jsx` arranque; `src/router.js` rutas por hash.
- `src/data/` almacenamiento local (`storage.js`: un JSON por colección, escritura atómica en
  archivos en la app nativa, IndexedDB en el navegador) y `migraciones.js`.
- `src/themes/` tokens de los temas A1, A, A2, C, C1, C2. El paciente solo ve temas de fondo blanco.
- `src/platform/` envoltorios de plugins nativos (almacenamiento, enlaces universales).
- `src/lib/library.js` acceso a la biblioteca empaquetada (catálogo, figuras, visor 3D, posturas).
- `src/domain/` lógica pura: `catalogo.js` (búsqueda, filtros, recuentos, kcal) y `pautas.js`
  (crear y editar pautas, valores por defecto, resumen, búsqueda).
- `src/data/repo.js` pacientes y pautas sobre el almacenamiento local.
- Las pruebas resuelven `@shared` con `test/register.mjs`.
- `src/ui/` pantallas.
- Código compartido con el servidor y el visor web: alias `@shared` → `../server/public/`.
- `.env`: `VITE_SERVER_URL` (servidor **provisional**, también entra en la CSP de `index.html`).

## Compilar en el dispositivo

- **Android**: Android Studio (`npx cap open android`). En el contenedor de Claude no se puede
  compilar sin permitir `dl.google.com` y `maven.google.com`.
- **iOS**: en un Mac con Xcode (`npx cap open ios`). Usa Swift Package Manager (sin CocoaPods).
- El identificador `es.maroto.pautas` es **provisional**: cambiará cuando se decida el nombre y
  las cuentas del publisher.
