import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const STYLE = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy } as const;
const WEB_MS = { light: 10, medium: 25, heavy: 50 } as const;

/** A short impact. Callers check the player's haptics setting first. */
export function impact(strength: keyof typeof STYLE): void {
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: STYLE[strength] }).catch(() => undefined);
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(WEB_MS[strength]);
    } catch {
      // unsupported
    }
  }
}
