# Publicar la app en las tiendas (guía)

Pasos para compilar, firmar y subir la app a TestFlight (iOS) y a la prueba interna de Google
Play. **Requiere decisiones pendientes**; mientras tanto, lo provisional está marcado.

## 0. Decisiones antes de compilar para las tiendas

| Decisión | Dónde se cambia | Valor provisional |
|---|---|---|
| Nombre de la app | `app/capacitor.config.json` (`appName`), `ios/App/App/Info.plist` (`CFBundleDisplayName`), `android/app/src/main/res/values/strings.xml` | Pautas |
| Identificador (bundle id / package) | `capacitor.config.json` (`appId`), Xcode (Bundle Identifier), `android/app/build.gradle` (`applicationId`, `namespace`) y `strings.xml` | `es.maroto.pautas` |
| Dominio del servidor | `app/.env` (`VITE_SERVER_URL`), `AndroidManifest.xml` (intent-filter), `ios/App/App/App.entitlements` (`applinks:`), Coolify (`PUBLIC_URL`) | `pautas.maroto.es` |
| Producto Pro (id) | `app/.env` (`VITE_PRO_ID`) y la consola de cada tienda | `pro` |
| Precio de Pro | Consola de cada tienda | sin fijar |
| Límite gratuito | `app/src/domain/limites.js` (`FREE_LIMITS`) | 3 pacientes con pauta activa |
| Icono definitivo | `app/resources/figura.svg` y colores en `app/tools/iconos.mjs`; luego `node tools/iconos.mjs` | figura provisional |

Las cuentas de desarrollador son **las del publisher**; el propietario entra como miembro del
equipo (Apple: rol *App Manager* o *Developer*; Google Play: usuario con permisos sobre la app).

## 1. Preparar la web de la app

```bash
cd app
npm install
npm test
npm run build
npx cap sync
```

`npm run build` genera la biblioteca (`public/lib/`) y la web (`dist/`); `cap sync` la copia a
`ios/` y `android/` y actualiza los plugins nativos.

## 2. iOS (en un Mac con Xcode)

1. `npx cap open ios` abre el proyecto (Swift Package Manager, sin CocoaPods).
2. Target **App** → *Signing & Capabilities*:
   - *Team*: el equipo del publisher. *Bundle Identifier*: el definitivo.
   - Comprobar que aparecen **Associated Domains** (`applinks:<dominio>`, del archivo
     `App.entitlements`) e **In-App Purchase** (añadirla con *+ Capability* si no está).
3. *General* → *Version* (p. ej. 1.0.0) y *Build* (1, 2, 3… sube en cada envío).
4. Probar en un iPhone real (cable o red): enlace de pauta, sesión guiada con el teléfono
   bloqueado, avisos, sonido con el modo silencio, compra en el *sandbox*.
5. *Product → Archive* → *Distribute App* → *App Store Connect* → subir.
6. En App Store Connect: crear la app con el bundle id, crear el producto **no consumible** con el
   id de `VITE_PRO_ID`, rellenar la ficha (ver `ficha.md`) y la privacidad (ver `privacidad.md`),
   y añadir probadores en **TestFlight**.

El archivo `Info.plist` declara `ITSAppUsesNonExemptEncryption = NO`: la app solo usa cifrado
estándar del sistema (AES-GCM de WebCrypto y HTTPS) para proteger datos del usuario. **El
publisher debe confirmar** que esta declaración es correcta para su caso.

## 3. Android (Android Studio)

1. Crear el almacén de claves de subida **una sola vez** y guardarlo fuera del repositorio:

   ```bash
   keytool -genkeypair -v -keystore ~/claves/pautas-subida.jks -alias subida -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Crear `app/android/keystore.properties` (está en `.gitignore`):

   ```properties
   storeFile=/Users/<usuario>/claves/pautas-subida.jks
   storePassword=…
   keyAlias=subida
   keyPassword=…
   ```

3. `npx cap open android`. Subir `versionCode` (entero, +1 en cada envío) y `versionName` en
   `android/app/build.gradle`.
4. *Build → Generate Signed App Bundle* (o `./gradlew bundleRelease` en `app/android`): genera
   el `.aab`.
5. En Play Console: crear la app, activar **Play App Signing**, subir el `.aab` a **Prueba
   interna**, crear el producto de compra única con el id de `VITE_PRO_ID`, rellenar la ficha,
   la sección **Seguridad de los datos** y el cuestionario de clasificación (ver `ficha.md` y
   `privacidad.md`).

Desde este contenedor no se puede compilar Android (la red no permite `dl.google.com` ni
`maven.google.com`); se compila en el equipo del propietario.

## 4. Enlaces universales (abrir la pauta en la app)

El servidor publica los archivos de verificación si tiene estas variables en Coolify:

| Variable | Valor |
|---|---|
| `IOS_APP_IDS` | `<TEAMID>.<bundle id>` (el Team ID está en developer.apple.com → Membership) |
| `ANDROID_PACKAGE` | el package definitivo |
| `ANDROID_SHA256` | huella SHA-256 del certificado de **firma de la app** de Play (Play Console → Integridad de la app); si se prueba con el `.aab` firmado localmente, también la del almacén de subida, separadas por comas |

Comprobar después: `https://<dominio>/.well-known/apple-app-site-association` y
`https://<dominio>/.well-known/assetlinks.json`. Sin esto, los enlaces abren el visor web (que
funciona igual, pero sin la sesión guiada de la app).

## 5. Antes de dar la app a pacientes reales

- Copia de seguridad automática de `/data/pautas.sqlite` en Coolify.
- Revisar que el proxy de Coolify no guarde registros de acceso con IP más tiempo del necesario
  (la política de privacidad dice que el servidor no conserva IP).
- Decidir si el servidor provisional sigue o se sustituye (la app solo depende de la API v1).
- Probar en dispositivo: enlaces, notificaciones (en Android, sin alarmas exactas pueden llegar
  con retraso), sonido en modo silencio, compra y restauración, copia de seguridad.

## 6. Capturas para las fichas

Generar desde la app en el simulador o el dispositivo (sin datos reales de pacientes):

- iPhone 6,9" (1320 × 2868) y iPad 13" (2064 × 2752); Google Play: teléfono (mínimo 1080 px) y
  tableta de 7" y 10".
- Pantallas sugeridas: Mis pautas, editor con descansos, catálogo con filtros, ficha 3D, envío
  con QR, sesión guiada (descanso), valoración del paciente, respuestas.
