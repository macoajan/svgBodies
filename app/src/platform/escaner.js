// Lector de códigos QR con la cámara (@capacitor/barcode-scanner, oficial de Capacitor): pantalla
// nativa a pantalla completa. Solo en la app; en el navegador se usa la cámara del sistema.
import { Capacitor } from '@capacitor/core';

export const escanerDisponible = () => Capacitor.isNativePlatform();

/** Abre la cámara y devuelve el texto del QR, o null si el usuario cancela. */
export async function escanearQr() {
  const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint, CapacitorBarcodeScannerCameraDirection } = await import('@capacitor/barcode-scanner');
  try {
    const r = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: 'Apunta al código QR de tu pauta',
      cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
      cancelButtonAccessibilityLabel: 'Cancelar',
      torchButtonOnAccessibilityLabel: 'Apagar la linterna',
      torchButtonOffAccessibilityLabel: 'Encender la linterna',
    });
    return r?.ScanResult || null;
  } catch (e) {
    if (/cancel/i.test(String(e?.message || e))) return null;
    throw e;
  }
}
