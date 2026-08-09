/**
 * Offline opening book - lookup.
 *
 * The book is keyed by the UCI move sequence played from the initial position
 * (see book-data.ts for why, and for the data itself). Lookup is therefore a
 * single Map hit on a joined string - no hashing, no dependency on how
 * `position.ts` computes its Zobrist keys.
 *
 * Selection is weighted-random so the engine does not play the same opening
 * every game. Randomness comes from a caller-supplied `rng`, so a game seeded
 * from `SearchLimits.seed` replays exactly.
 */

import { Position } from './position.ts';
import { generateLegalMoves } from './movegen.ts';
import { BOOK, BOOK_POSITIONS } from './book-data.ts';
import {
  MAX_MOVES,
  PIECE_FROM_CHAR,
  algebraicToSquare,
  moveFrom,
  movePromotion,
  moveTo,
} from './types.ts';
import type { PackedMove, PieceCode } from './types.ts';

/** Number of distinct positions (move sequences) the book knows a reply for. */
export const BOOK_SIZE: number = BOOK_POSITIONS;

/**
 * Looks up a book reply. `history` is the UCI move list played so far from
 * the initial position. Returns '' when the position is out of book or when
 * `history.length >= maxPlies`. Uses `rng` (a 0..1 function) for weighted
 * selection so the caller controls determinism.
 */
export function probeBook(
  history: string[],
  maxPlies: number,
  rng: () => number,
): string {
  if (maxPlies <= 0 || history.length >= maxPlies) return '';

  const entries = BOOK.get(history.length === 0 ? '' : history.join(' '));
  if (entries === undefined || entries.length === 0) return '';
  if (entries.length === 1) return entries[0].uci;

  let total = 0;
  for (let i = 0; i < entries.length; i++) total += entries[i].weight;
  if (total <= 0) return entries[0].uci;

  // A hostile rng (NaN, out of range) must not push us past the end of the
  // list, so the last entry doubles as the fallback.
  let r = rng() * total;
  if (!(r >= 0)) r = 0;

  for (let i = 0; i < entries.length; i++) {
    r -= entries[i].weight;
    if (r < 0) return entries[i].uci;
  }
  return entries[entries.length - 1].uci;
}

/** Scratch buffer for legality checking. The book is probed once per move at
 *  the root, never inside the search, so a single shared buffer is safe. */
const legalBuf = new Int32Array(MAX_MOVES);

/**
 * Convenience: converts a UCI book string into a PackedMove that is legal in
 * `pos`, or 0 if it is not legal there.
 *
 * The legality check is the point: it means a mistake in the book data
 * degrades to "out of book" and a normal search, instead of the engine
 * confidently playing an illegal move.
 */
export function bookMoveFor(
  pos: Position,
  history: string[],
  maxPlies: number,
  rng: () => number,
): PackedMove {
  const uci = probeBook(history, maxPlies, rng);
  if (uci === '') return 0;

  if (uci.length < 4 || uci.length > 5) return 0;
  const from = algebraicToSquare(uci.slice(0, 2));
  const to = algebraicToSquare(uci.slice(2, 4));
  if (!(from >= 0 && from < 64) || !(to >= 0 && to < 64)) return 0;

  let promotion: PieceCode = 0;
  if (uci.length === 5) {
    const p = PIECE_FROM_CHAR[uci[4]];
    if (p === undefined) return 0;
    promotion = p;
  }

  // Match on from/to/promotion rather than on the packed value: flags are
  // owned by the move generator and must not be guessed here.
  const n = generateLegalMoves(pos, legalBuf, 0);
  for (let i = 0; i < n; i++) {
    const m = legalBuf[i];
    if (moveFrom(m) === from && moveTo(m) === to && movePromotion(m) === promotion) {
      return m;
    }
  }
  return 0;
}
