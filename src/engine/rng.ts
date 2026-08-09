/**
 * Deterministic pseudo-random numbers.
 *
 * The engine must never call Math.random(): a game played at a given level
 * with a given seed has to be reproducible, both for debugging a reported bad
 * move and for the self-play harness that measures whether an evaluation
 * change actually helped. xorshift32 is fast, has no state beyond one 32-bit
 * word, and is more than good enough for move jitter and book selection.
 */

export interface Rng {
  /** Next uniform float in [0, 1). */
  next(): number;
  /** Next integer in [0, n). */
  int(n: number): number;
  /** Raw 32-bit word. Used to seed the Zobrist tables. */
  raw(): number;
}

export function createRng(seed = 0x2545f491): Rng {
  // A zero state is a fixed point for xorshift, so never allow it.
  let s = seed >>> 0 || 0x2545f491;

  const raw = (): number => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s;
  };

  return {
    raw,
    next: () => raw() / 0x100000000,
    int: (n: number) => (raw() % n) >>> 0,
  };
}

/**
 * Picks an index from a weight array, proportional to the weights.
 * Returns -1 for an empty or all-zero array.
 */
export function weightedPick(weights: number[], rng: Rng): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return -1;

  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= Math.max(0, weights[i]);
    if (roll < 0) return i;
  }
  return weights.length - 1;
}
