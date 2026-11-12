// Avisos de la sesión guiada: sonido corto (Web Audio), vibración, pantalla encendida y
// notificaciones locales programadas para cuando la app está en segundo plano.
// Todo es opcional: si algo no está disponible o se deniega el permiso, la sesión sigue igual.
import { Capacitor } from '@capacitor/core';

const native = () => Capacitor.isNativePlatform();
let audio = null;

/** Tono: 'cuenta' (últimos segundos), 'fin' (acaba un tiempo), 'inicio' (empieza a trabajar). */
export function sonar(tipo = 'fin') {
  try {
    audio = audio || new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const notas = tipo === 'cuenta' ? [[880, 0, 0.08]] : tipo === 'inicio' ? [[660, 0, 0.12], [990, 0.14, 0.18]] : [[990, 0, 0.12], [660, 0.14, 0.2]];
    for (const [f, t0, dur] of notas) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = audio.currentTime + t0;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
    }
  } catch { /* sin audio */ }
}

export async function vibrar(tipo = 'fin') {
  try {
    if (native()) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (tipo === 'cuenta') await Haptics.impact({ style: ImpactStyle.Light });
      else await Haptics.notification({ type: NotificationType.Success });
    } else navigator.vibrate?.(tipo === 'cuenta' ? 30 : [80, 60, 120]);
  } catch { /* sin vibración */ }
}

let wakeLock = null;
export async function pantallaEncendida(on) {
  try {
    if (native()) {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
    } else if (on) wakeLock = await /** @type {any} */ (navigator).wakeLock?.request('screen');
    else { await wakeLock?.release(); wakeLock = null; }
  } catch { /* no disponible */ }
}

const BASE_ID = 7100;
let programadas = 0;

/** Programa notificaciones para los próximos fines de tiempo ({ at, title, body }[]); cancela las anteriores. */
export async function programarAvisos(lista) {
  if (!native()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    if (programadas) await LocalNotifications.cancel({ notifications: Array.from({ length: programadas }, (_, k) => ({ id: BASE_ID + k })) });
    programadas = 0;
    if (!lista.length) return;
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: lista.map((n, k) => ({ id: BASE_ID + k, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true } })),
    });
    programadas = lista.length;
  } catch { /* sin permiso o sin plugin */ }
}
