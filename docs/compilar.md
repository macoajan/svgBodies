# Compilar la app (Android y iPhone/iPad en el Mac)

Guía para compilar la app y probarla en un emulador o en un dispositivo propio. Para firmar y subir
a las tiendas, sigue después [`tiendas/publicar.md`](tiendas/publicar.md).

Todo se hace en el **Mac**: Android Studio también funciona ahí. Para iOS el Mac es obligatorio.

## 1. Requisitos (una sola vez)

| Herramienta | Versión | Para qué |
|---|---|---|
| macOS | reciente, que admita la versión actual de Xcode | iOS |
| Xcode | la última de la App Store | iOS (iPhone, iPad y Mac con chip Apple) |
| Node.js | 22 o superior (LTS) | preparar la web de la app |
| Git | el que trae Xcode | descargar el repositorio |
| Android Studio | la última estable | Android |
| JDK | 21 (lo trae Android Studio) | Android |

Instalación:

1. **Xcode**: desde la App Store. Ábrelo una vez y acepta la licencia. Si pide componentes
   adicionales (simuladores de iOS), instálalos.
2. **Herramientas de línea de comandos de Xcode** (incluyen Git):

   ```bash
   xcode-select --install
   ```

3. **Node.js 22**: el instalador de <https://nodejs.org> (versión LTS) o, con Homebrew:

   ```bash
   brew install node@22
   ```

   Comprueba la versión:

   ```bash
   node -v
   ```

4. **Android Studio**: <https://developer.android.com/studio>. En el primer arranque elige la
   instalación estándar: descarga el SDK de Android, las herramientas y un emulador. En
   *Settings → Languages & Frameworks → Android SDK* comprueba que está instalado **Android 16
   (API 36)**: el proyecto compila contra él y funciona desde Android 7 (API 24).

## 2. Descargar el proyecto

Hace falta el repositorio **entero**, no solo la carpeta `app/`: la app copia la biblioteca de
ejercicios de `library/` y `taxonomy/`, y comparte código con `server/`.

```bash
git clone -b main https://github.com/macoajan/svgBodies.git
```

El `-b main` importa: la rama por defecto del repositorio en GitHub no es `main`, y sin él se
descarga una rama antigua. Para comprobar en qué rama estás:

```bash
git branch --show-current
```

```bash
cd svgBodies/app
```

Si ya lo tenías (o se bajó otra rama), cambia a `main` y actualízalo:

```bash
git fetch origin
```

```bash
git checkout main
```

```bash
git pull origin main
```

## 3. Preparar la web de la app (siempre antes de compilar)

Dentro de `svgBodies/app`:

```bash
npm install
```

```bash
npm run build
```

```bash
npx cap sync
```

- `npm install` descarga las dependencias (la primera vez tarda unos minutos).
- `npm run build` copia la biblioteca de ejercicios a `public/lib/` y genera la web en `dist/`.
- `npx cap sync` copia esa web a los proyectos `ios/` y `android/` y actualiza los plugins
  nativos.

**Repite `npm run build` y `npx cap sync` cada vez que cambie el código** (después de un
`git pull`). Si no, el dispositivo seguirá mostrando la versión anterior.

Opcional, para comprobar que todo está bien:

```bash
npm test
```

## 4. iPhone y iPad (Xcode)

### Abrir el proyecto

```bash
npx cap open ios
```

Se abre Xcode con el proyecto `App`. La primera vez descarga los paquetes de Swift: espera a que
termine la barra de progreso de arriba.

### Probar en el simulador

1. Arriba, en el selector de destino, elige un simulador (por ejemplo, *iPhone 16*).
2. Pulsa ▶ (*Run*) o `⌘R`.

En el simulador funcionan casi todo: biblioteca, editor, envío, sesión guiada… No funcionan la
vibración, la compra real ni los enlaces universales.

### Probar en tu iPhone o iPad

1. Conecta el dispositivo por cable y desbloquéalo. Si pregunta, pulsa «Confiar en este
   ordenador».
2. En el dispositivo, activa el **modo desarrollador**: *Ajustes → Privacidad y seguridad → Modo
   de desarrollador*. Se reinicia.
3. En Xcode: panel izquierdo, proyecto **App** → target **App** → pestaña *Signing &
   Capabilities*:
   - Marca *Automatically manage signing*.
   - En *Team* elige tu cuenta de desarrollador (*Xcode → Settings → Accounts* para añadirla si no
     aparece).
   - Si da error porque `es.maroto.pautas` ya está en uso o no es tuyo, cambia el *Bundle
     Identifier* por uno tuyo para pruebas (por ejemplo, `es.tunombre.pautas.pruebas`). No hace
     falta cambiar nada más para probar.
4. Elige tu dispositivo en el selector de destino y pulsa ▶.

La primera vez, iOS puede pedir que confíes en el desarrollador: *Ajustes → General → VPN y
gestión de dispositivos*.

### En un Mac con chip Apple (M1 o posterior)

La versión de iPad se puede ejecutar en el propio Mac: en el selector de destino elige
**My Mac (Designed for iPad)** y pulsa ▶. Es útil para probar, pero no es una app de Mac
diseñada para escritorio.

### Qué comprobar en el dispositivo

- La sesión guiada con el teléfono bloqueado y al volver: el tiempo debe seguir correctamente.
- Los avisos al terminar un descanso con la app en segundo plano (la primera vez pide permiso
  de notificaciones).
- El sonido con el interruptor de silencio activado y desactivado.
- La vibración.
- Compartir el enlace y el QR.
- La compra Pro en modo de pruebas (*sandbox*): necesita que el producto exista en App Store
  Connect (ver `tiendas/publicar.md`).
- Abrir un enlace de pauta desde Mensajes o Notas: solo abre la app si el servidor tiene
  configurado `IOS_APP_IDS` con tu *Team ID* y el *Bundle Identifier* que uses. Si no, abre el
  visor web, que también funciona.

## 5. Android (Android Studio)

### Abrir el proyecto

```bash
npx cap open android
```

Se abre Android Studio. La primera vez sincroniza Gradle y descarga lo que falte (varios minutos;
abajo se ve el progreso). Si avisa de que falta algún componente del SDK, pulsa el enlace para
instalarlo.

Si se queja del JDK: *Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle
JDK* y elige el JDK 21 incluido en Android Studio (*jbr-21*).

### Probar en el emulador

1. *Tools → Device Manager → Create Virtual Device*: elige un teléfono (por ejemplo, *Pixel 8*)
   con una imagen de sistema reciente (API 35 o 36) y créalo.
2. Arriba, elige ese emulador y pulsa ▶ (*Run 'app'*).

### Probar en tu teléfono Android

1. En el teléfono, activa las **opciones de desarrollador**: *Ajustes → Información del
   teléfono* y toca 7 veces en *Número de compilación*.
2. En *Ajustes → Sistema → Opciones de desarrollador*, activa **Depuración por USB**.
3. Conéctalo por cable al Mac y acepta el aviso «¿Permitir depuración USB?».
4. Elígelo en Android Studio y pulsa ▶.

### Generar un APK para instalarlo a mano o pasarlo a alguien

*Build → Generate App Bundles or APKs → Generate APKs*. Al terminar, el aviso de abajo tiene un
enlace *locate* que abre la carpeta (`android/app/build/outputs/apk/debug/app-debug.apk`).

O desde la terminal, en `svgBodies/app/android`:

```bash
./gradlew assembleDebug
```

Para instalarlo en otro teléfono, envíale el `.apk`. Al abrirlo, el teléfono pedirá permitir la
instalación de apps desconocidas. Este APK es **solo para pruebas**: la versión de Google Play se
firma y se sube como `.aab` (ver `tiendas/publicar.md`).

### Qué comprobar en el dispositivo

Lo mismo que en iOS, y además:

- Los avisos con la app en segundo plano: en Android pueden llegar con algo de retraso, porque la
  app no usa alarmas exactas (Google Play las reserva a apps de alarma).
- Abrir un enlace de pauta: solo abre la app si el servidor tiene `ANDROID_PACKAGE` y
  `ANDROID_SHA256` con la huella del certificado con el que se firmó.

## 6. Problemas frecuentes

| Problema | Solución |
|---|---|
| La app muestra una versión antigua | `npm run build` y `npx cap sync` otra vez, y vuelve a pulsar ▶ |
| Se ha descargado otra rama (no `main`) | `git fetch origin`, `git checkout main` y `git pull origin main` |
| `npm run build` falla con «no such file … library» | Falta el repositorio completo: hay que clonar `svgBodies`, no solo `app/` |
| Xcode: *Signing requires a development team* | Elige tu *Team* en *Signing & Capabilities* (paso 4.3) |
| Xcode: *Failed to register bundle identifier* | Cambia el *Bundle Identifier* por uno tuyo para pruebas |
| Xcode tarda mucho en *Resolving Package Graph* | Es la descarga inicial de paquetes de Swift; espera. Si se atasca: *File → Packages → Reset Package Caches* |
| Android: *SDK location not found* | Abre el proyecto desde Android Studio (no desde la terminal) una vez; crea `android/local.properties` con la ruta del SDK |
| Android: error de versión de Java | Gradle JDK = 21 (ver el apartado «Abrir el proyecto» de Android) |
| Pantalla en blanco al abrir la app | Falta `npm run build` antes de `npx cap sync` |
| No llegan las respuestas o no se envía la pauta | Comprueba la conexión y que el servidor responde: <https://pautas.maroto.es/healthz> |

## 7. Resumen rápido (cuando ya está todo instalado)

```bash
cd svgBodies && git checkout main && git pull origin main && cd app
```

```bash
npm install && npm run build && npx cap sync
```

Después, uno de estos:

```bash
npx cap open ios
```

```bash
npx cap open android
```

y ▶ en Xcode o en Android Studio.
