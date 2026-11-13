# Privacidad (borrador)

**BORRADOR técnico para el publisher y su asesoría legal.** Describe con exactitud qué hace la
app; la redacción legal final (responsable, base jurídica, contacto del delegado si procede)
corresponde al publisher. Los marcadores `{…}` están por rellenar.

## Política de privacidad

**Responsable**: {razón social del publisher}, {NIF}, {dirección}, {correo de privacidad}.

**Resumen**: {NOMBRE} no tiene cuentas, ni publicidad, ni analítica, ni rastreo. Lo que escribes
se guarda en tu dispositivo. Cuando un profesional envía una pauta, viaja cifrada de extremo a
extremo: nuestro servidor guarda solo un bloque que no puede leer.

### Qué datos se tratan y dónde

| Dato | Dónde está | Quién puede leerlo |
|---|---|---|
| Pacientes (alias y nota privada), pautas, plantillas, ajustes, logo | Solo en el dispositivo del profesional | Solo el profesional |
| Peso del usuario (para estimar calorías) | Solo en el dispositivo | Solo el usuario |
| Pauta enviada | Servidor, **cifrada** (AES-GCM 256) | Quien tenga el enlace completo: el profesional y su paciente. La clave va en la parte del enlace tras `#`, que el navegador y la app nunca envían al servidor |
| Valoraciones del paciente (esfuerzo, dolor 0–10, comentario) | Servidor, **cifradas** con la misma clave, hasta que el profesional las descarga | El profesional |
| Fechas de visibilidad de la pauta | Servidor, en claro (solo fechas, sin datos de salud) | El servidor, para decidir si la entrega |
| Dirección IP | Memoria del servidor, como máximo 10 minutos, para limitar abusos; **no se guarda** en disco | — |
| Compra Pro | Apple o Google, según su política; la app solo guarda en el dispositivo si la tienes | — |

No se usan cookies, identificadores publicitarios ni SDK de terceros de analítica o errores.

### Conservación

- En el dispositivo: hasta que el usuario lo borre (Ajustes → Borrar todos los datos) o
  desinstale la app.
- En el servidor: la pauta y sus valoraciones se borran cuando el profesional retira el enlace, y
  automáticamente tras {120} días sin uso.

### Datos de salud

Las valoraciones de dolor pueden ser datos de salud. El **profesional** que usa la app con sus
pacientes es el responsable de esos datos frente a ellos (informarles y, si procede, recabar su
consentimiento); {NOMBRE} le proporciona una herramienta que no permite al proveedor leerlos,
porque viajan cifrados de extremo a extremo y la clave nunca llega al servidor. {Revisar con la
asesoría si el publisher actúa como encargado del tratamiento respecto al almacenamiento cifrado
y si se necesita un contrato de encargo.}

### Copias de seguridad

- La copia de seguridad que exporta la app va cifrada con una frase que solo conoce el usuario.
- La copia de seguridad del sistema (iCloud o Google) puede incluir los datos de la app, según la
  configuración del dispositivo.

### Derechos

Como no tenemos tus datos en claro ni cuentas asociadas, puedes ejercer tus derechos borrando los
datos desde la app; el profesional puede retirar cualquier pauta enviada. Para cualquier consulta:
{correo de privacidad}. Puedes reclamar ante la Agencia Española de Protección de Datos
(www.aepd.es).

### Menores

La app no está dirigida a menores de 14 años sin la supervisión de sus padres o tutores; el
profesional decide si envía una pauta a un menor y es responsable de contar con la autorización.

## Respuestas para App Store Connect (*App Privacy*)

- **¿Recopila datos?** Previsiblemente **No** («Data Not Collected»):
  - no hay rastreo ni identificadores;
  - el contenido que se transmite va cifrado de extremo a extremo y el proveedor no puede leerlo;
  - la IP no se conserva.
  
  El publisher debe confirmarlo con la definición vigente de Apple.
- **Rastreo (ATT)**: no.
- El manifiesto `ios/App/App/PrivacyInfo.xcprivacy` declara: sin rastreo y sin datos recopilados.

## Respuestas para Google Play (*Seguridad de los datos*)

- **¿Recopila o comparte datos?** Previsiblemente **No recopila**, con la misma justificación que
  para Apple. Google considera «recopilados» los datos transmitidos fuera del dispositivo, salvo
  excepciones como el cifrado de extremo a extremo. Indicar que:
  - los datos se cifran en tránsito;
  - el usuario puede pedir que se borren (retirada del enlace por el profesional y borrado local).
- **Permisos de Android**: Internet; notificaciones (`POST_NOTIFICATIONS`, con
  `RECEIVE_BOOT_COMPLETED` y `WAKE_LOCK` del plugin) para avisar del fin de los descansos;
  vibración; facturación de Google Play (compra Pro); cámara, solo para leer el QR de la pauta
  (las imágenes no se guardan ni se envían). Se ha quitado `SCHEDULE_EXACT_ALARM`.
  No usa ubicación, contactos ni micrófono.
