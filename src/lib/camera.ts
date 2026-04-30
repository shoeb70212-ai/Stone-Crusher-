/**
 * Camera capture helper for attaching document photos to slips.
 * Uses @capacitor/camera on native with a web file-input fallback.
 *
 * Returns a local file URI (native) or a base64 data URL (web fallback)
 * that can be stored in `Slip.attachmentUri` and displayed with <img>.
 */

import { isNative } from './capacitor';

export interface CaptureResult {
  /** URI or data URL suitable for use as an <img> src */
  uri: string;
  /** 'file' on native (local filesystem URI), 'dataurl' on web */
  type: 'file' | 'dataurl';
}

/**
 * Opens the camera (native) or a file picker (web) to capture a document photo.
 * Returns the captured image info, or undefined if the user cancelled.
 */
export async function captureDocument(): Promise<CaptureResult | undefined> {
  if (isNative()) {
    return captureNative();
  }
  return captureWeb();
}

async function captureNative(): Promise<CaptureResult | undefined> {
  try {
    const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');

    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: true,        // iOS auto-crop / perspective correction
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      saveToGallery: false,
    });

    if (!photo.path) return undefined;
    return { uri: photo.path, type: 'file' };
  } catch (err: unknown) {
    // User cancelled — Camera throws with message 'User cancelled photos app'
    if (err instanceof Error && err.message.toLowerCase().includes('cancel')) {
      return undefined;
    }
    throw err;
  }
}

function captureWeb(): Promise<CaptureResult | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // prefer back camera on mobile browsers

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(undefined);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ uri: reader.result as string, type: 'dataurl' });
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    };

    // Cancelled without selecting a file — resolve undefined after a tick
    input.oncancel = () => resolve(undefined);

    input.click();
  });
}
