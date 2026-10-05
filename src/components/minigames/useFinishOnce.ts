import { useEffect, useRef } from 'react';
import type { MinigameProps, MinigameResult } from './types';

/**
 * Reports a decided result to the host exactly once, after `delayMs` so the final board stays
 * readable. Survives re-renders and a changing `onFinish` identity; the timer is cleared if the
 * game unmounts first (the host then treats the run as quit).
 */
export function useFinishOnce(result: MinigameResult | null, onFinish: MinigameProps['onFinish'], delayMs: number): void {
  const onFinishRef = useRef(onFinish);
  const sentRef = useRef(false);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    if (!result || sentRef.current) return;
    const timer = window.setTimeout(() => {
      if (sentRef.current) return;
      sentRef.current = true;
      onFinishRef.current(result);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [result, delayMs]);
}
