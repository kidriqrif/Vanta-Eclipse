/** A source of uniform numbers in [0, 1). The store passes Math.random; tests pass a seeded one. */
export type Rng = () => number;

/** Deterministic RNG for tests and reproducible simulations. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, maxExclusive: number): number {
  return Math.min(maxExclusive - 1, Math.floor(rng() * maxExclusive));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, items.length)];
}

/** Index chosen by weight; weights need not sum to 1. Zero-weight entries are never chosen. */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (total <= 0) return 0;
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    const w = Math.max(0, weights[i]);
    if (w === 0) continue;
    if (roll < w) return i;
    roll -= w;
  }
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
  return 0;
}

/** Fisher–Yates; returns a new array. */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
