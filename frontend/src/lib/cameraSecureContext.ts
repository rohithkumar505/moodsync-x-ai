function isLocalHostname(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function isPrivateLanHost(host: string): boolean {
  if (host.endsWith('.local')) return true;
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

/** Whether getUserMedia is allowed in this browser context. */
export function canUseCamera(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  return isLocalHostname(window.location.hostname);
}

export function getCameraBlockedMessage(): string {
  const { protocol, hostname, host } = window.location;

  if (protocol === 'https:') {
    return 'Camera access is blocked. Allow camera in browser settings, then tap Enable Camera again.';
  }

  if (isPrivateLanHost(hostname)) {
    return (
      `On your phone, the camera only works over HTTPS. ` +
      `Open https://${host} (your computer's Wi‑Fi address from the terminal — not localhost), ` +
      `accept the certificate warning once, then allow camera access.`
    );
  }

  if (!isLocalHostname(hostname)) {
    return 'Camera requires HTTPS. Use your deployed site with https:// — plain http:// will not work on mobile.';
  }

  return 'Camera needs a secure connection. Use https://localhost:5173 (or http://localhost:5173 on this computer only).';
}

export function cameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Camera permission denied. Allow camera in your browser or phone settings, then tap Enable Camera again.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'No camera found on this device.';
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return 'Camera is in use by another app. Close it and try again.';
    }
    if (err.name === 'OverconstrainedError') {
      return 'Camera settings not supported. Try again — we will use simpler settings.';
    }
    if (err.name === 'SecurityError') {
      return getCameraBlockedMessage();
    }
    return `Camera error: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return 'Could not access the camera. Please try again.';
}

export async function openCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('Camera API not available', 'NotSupportedError');
  }

  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === 'NotAllowedError') throw err;
    }
  }
  throw lastError ?? new Error('Could not open camera');
}
