import { useEffect, useRef } from 'react';

type Handler = () => void;
const stack: { id: number; handler: { current: Handler } }[] = [];
let nextId = 1;

/**
 * Registers what the Android back button should do while `active` is true — usually closing a
 * modal or leaving a minigame. The most recently registered handler wins.
 */
export function useBackHandler(active: boolean, handler: Handler): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const entry = { id: nextId++, handler: ref };
    stack.push(entry);
    return () => {
      const i = stack.findIndex((e) => e.id === entry.id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

/** Runs the top handler. Returns false when nothing claimed the back press. */
export function runBackHandler(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.handler.current();
  return true;
}
