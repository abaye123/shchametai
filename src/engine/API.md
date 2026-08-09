# Engine core API contract

Every module in `src/engine` builds against this document. It is frozen -
if you believe a signature is wrong, say so in your report rather than
silently changing it, because other modules are being written against it in
parallel.

## Ground rules

- 100% offline, zero external libraries, hand-written TypeScript only.
- No Angular imports anywhere in `src/engine`. The core must run inside a Web
  Worker and under a bare `node file.ts` (Node 24 strips types natively).
- All modules import shared constants from `./types.ts`.
- Performance matters: no allocation in hot paths. Use preallocated typed
  arrays, integer square indices, and packed 32-bit moves.

## `position.ts`

```ts
export class Position {
  /** Board slots, 64 entries, `(color << 3) | pieceType`, 0 = empty. */
  readonly squares: Int8Array;

  /** Side to move: WHITE or BLACK. */
  turn: ColorCode;

  /** Castling-rights bitmask built from CASTLE_WK | CASTLE_WQ | ... */
  castling: number;

  /** En-passant TARGET square (the square the capturing pawn lands on),
   *  or -1 when there is none. */
  epSquare: number;

  /** Halfmove clock for the fifty-move rule. Reset on pawn move or capture. */
  halfmoveClock: number;

  /** Full move number, starts at 1, increments after black moves. */
  fullmoveNumber: number;

  /** Zobrist key, split into two 32-bit halves (no BigInt - too slow). */
  keyLo: number;
  keyHi: number;

  /** King square per colour, kept incrementally. kingSquare[WHITE], [BLACK]. */
  readonly kingSquare: Int32Array;

  /** Plies played from the initial position of this Position object. */
  ply: number;

  static fromFen(fen: string): Position;
  static initial(): Position;

  toFen(): string;
  clone(): Position;

  /**
   * Applies a move. Pushes everything needed to reverse it onto an internal
   * undo stack. Assumes the move is pseudo-legal for this position.
   * Returns false and leaves the position UNCHANGED if the move would leave
   * the mover's own king in check (i.e. it was pseudo-legal but not legal).
   */
  makeMove(move: PackedMove): boolean;

  /** Reverses the most recent makeMove that returned true. */
  unmakeMove(): void;

  /** Plays a null move (side to move passes). For null-move pruning. */
  makeNullMove(): void;
  unmakeNullMove(): void;

  /** True if `sq` is attacked by any piece of colour `by`. Ray-based - this
   *  is the hottest function in the engine, do NOT implement it by generating
   *  move lists. */
  isSquareAttacked(sq: Square, by: ColorCode): boolean;

  /** True if the side to move is in check. */
  inCheck(): boolean;

  /** True if `color`'s king is in check. */
  isKingInCheck(color: ColorCode): boolean;

  /** Number of times the current position key has occurred in this game,
   *  including now. 3 means a threefold repetition. */
  repetitionCount(): number;

  /** True if the position is drawn by the fifty-move rule, threefold
   *  repetition, or insufficient material. */
  isDrawByRule(): boolean;

  /** True when neither side can possibly mate (K/K, K+B/K, K+N/K, K+B/K+B
   *  with same-coloured bishops). */
  isInsufficientMaterial(): boolean;

  /** Sum of non-pawn material, used by eval for tapering. */
  phase(): number;
}
```

`makeMove` returning `false` for self-check is deliberate: it lets movegen
stay pseudo-legal (fast) while the search filters legality for free as it
descends. `unmakeMove` must NOT be called after a `false` return.

## `movegen.ts`

```ts
/** Writes pseudo-legal moves into `out` starting at `start`.
 *  Returns the index one past the last move written. */
export function generateMoves(pos: Position, out: Int32Array, start: number): number;

/** Captures, en passant and promotions only. For quiescence search. */
export function generateCaptures(pos: Position, out: Int32Array, start: number): number;

/** Fully legal moves - generateMoves filtered through make/unmake.
 *  Used by the UI and by perft, not by the search. */
export function generateLegalMoves(pos: Position, out: Int32Array, start: number): number;

/** True if the side to move has at least one legal move. Cheaper than
 *  generating them all - returns as soon as one is found. */
export function hasLegalMove(pos: Position): boolean;

/** Legal moves originating from one square. For the UI's click handling. */
export function legalMovesFrom(pos: Position, from: Square): PackedMove[];

/** Terminal-state report for the current position. */
export function getStatus(pos: Position): StatusReport;
```

Move generation must be complete and correct: all piece moves, double pawn
pushes with the correct ep target, en-passant captures, castling with all
its conditions (rights intact, squares empty, king not in check, not passing
through or landing on an attacked square), and **all four promotion pieces**
(queen, rook, bishop, knight) as separate moves.

Flags on generated moves must be set correctly (`MF_CAPTURE`, `MF_DOUBLE_PUSH`,
`MF_EN_PASSANT`, `MF_CASTLE_KING`, `MF_CASTLE_QUEEN`, `MF_PROMOTION`) because
`makeMove` and the search's move ordering both rely on them.

## `eval.ts`

`EvalFeatures`, `SearchLimits`, `SearchResult` and `LevelId` are all declared
in `types.ts`, so `levels.ts` can build a config without importing the
evaluator or the search. Import them from `./types`.

```ts
import type { EvalFeatures } from './types';

/** Static evaluation in centipawns from the SIDE TO MOVE's point of view.
 *  Positive means the side to move is better. */
export function evaluate(pos: Position, features?: EvalFeatures): number;

export const ALL_FEATURES: EvalFeatures;
export const MATERIAL_ONLY: EvalFeatures;
```

Material is always counted; the flags gate everything above it, so weak
difficulty levels can run a deliberately simpler evaluation.

## `search.ts`

```ts
export interface SearchLimits {
  maxDepth: number;
  timeBudgetMs: number;
  features: EvalFeatures;
  quiescence: boolean;
  transpositionTable: boolean;
  nullMovePruning: boolean;
  /** Probability of not playing the best move, 0..1. */
  blunderRate: number;
  /** How much worse (centipawns) a substituted move may be. */
  blunderWindowCp: number;
  contemptCp: number;
  /** Deterministic seed so a game can be replayed exactly. */
  seed?: number;
}

export interface SearchResult {
  bestMove: PackedMove;   // 0 when there is no legal move
  score: number;
  depth: number;
  nodes: number;
  pv: PackedMove[];
  timeMs: number;
}

export function search(pos: Position, limits: SearchLimits): SearchResult;
```

`search` must be synchronous and self-limiting: it checks elapsed time every
2048 nodes and abandons the in-progress iterative-deepening iteration,
returning the best move from the last **completed** iteration.

## `levels.ts`

```ts
export type LevelId = 1 | 2 | 3 | 4 | 5 | 6;

export interface EngineLevel {
  id: LevelId;
  key: string;                 // i18n key
  limits: SearchLimits;
  openingBookPlies: number;
  approxElo: number;
}

export const LEVELS: Record<LevelId, EngineLevel>;

/** Maps the legacy 'easy' | 'medium' | 'hard' values stored in saved games
 *  onto levels 1 / 3 / 5 so old history still renders. */
export function levelFromLegacyDifficulty(d: string): LevelId;
