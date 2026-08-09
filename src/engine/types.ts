/**
 * Shared vocabulary for the chess engine core.
 *
 * This file is the CONTRACT every other engine module builds against.
 * It contains only constants, types and pure bit-twiddling helpers - no state,
 * no imports, no side effects. Nothing here may import from another engine
 * module, so it is always safe to import.
 *
 * Hard project constraints that apply to the whole `src/engine` folder:
 *   - 100% offline. No network calls, ever.
 *   - No external libraries. Hand-written TypeScript only.
 *   - No Angular imports. The engine core must be usable from a Web Worker
 *     and from a plain `node file.ts` script.
 */

// ---------------------------------------------------------------------------
// Squares
// ---------------------------------------------------------------------------

/**
 * Squares are indexed 0..63 as `row * 8 + col`, matching the UI board exactly:
 *
 *   row 0 == rank 8 (black's back rank), row 7 == rank 1 (white's back rank)
 *   col 0 == file a,                     col 7 == file h
 *
 *   square  0 = a8   square  7 = h8
 *   square 56 = a1   square 63 = h1
 *
 * So white pawns move by -8 (towards row 0) and black pawns by +8.
 */
export type Square = number;

export const A8 = 0, H8 = 7, A1 = 56, H1 = 63;
export const E1 = 60, G1 = 62, C1 = 58, D1 = 59, F1 = 61, B1 = 57;
export const E8 = 4, G8 = 6, C8 = 2, D8 = 3, F8 = 5, B8 = 1;

export const rowOf = (sq: Square): number => sq >> 3;
export const colOf = (sq: Square): number => sq & 7;
export const squareOf = (row: number, col: number): Square => (row << 3) | col;

/** Rank 1..8 as printed on a board (row 7 -> rank 1). */
export const rankOf = (sq: Square): number => 8 - (sq >> 3);

/** "e4" style coordinate, for FEN / debugging / SAN. */
export function squareToAlgebraic(sq: Square): string {
  return String.fromCharCode(97 + colOf(sq)) + rankOf(sq);
}

export function algebraicToSquare(s: string): Square {
  const col = s.charCodeAt(0) - 97;
  const row = 8 - Number(s[1]);
  return squareOf(row, col);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** Piece type codes. 0 means "no piece". */
export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export type PieceCode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Colour codes. Used as an array index, so keep them 0 and 1. */
export const WHITE = 0;
export const BLACK = 1;
export type ColorCode = 0 | 1;

export const opposite = (c: ColorCode): ColorCode => (c ^ 1) as ColorCode;

/**
 * A board slot holds a single small integer: `(color << 3) | pieceType`.
 * Empty is 0. White pawn = 1, black pawn = 9, white king = 6, black king = 14.
 * Everything fits in an Int8Array.
 */
export const makePiece = (color: ColorCode, type: PieceCode): number =>
  (color << 3) | type;

export const pieceType = (p: number): PieceCode => (p & 7) as PieceCode;
export const pieceColor = (p: number): ColorCode => (p >> 3) as ColorCode;

/** Maps the UI's `'p' | 'r' | 'n' | 'b' | 'q' | 'k'` onto piece codes. */
export const PIECE_FROM_CHAR: Record<string, PieceCode> = {
  p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING,
};

/** Inverse of PIECE_FROM_CHAR. Index by piece code. */
export const PIECE_TO_CHAR = ['', 'p', 'n', 'b', 'r', 'q', 'k'] as const;

// ---------------------------------------------------------------------------
// Castling rights
// ---------------------------------------------------------------------------

export const CASTLE_WK = 1;  // white king-side  (e1-g1)
export const CASTLE_WQ = 2;  // white queen-side (e1-c1)
export const CASTLE_BK = 4;  // black king-side  (e8-g8)
export const CASTLE_BQ = 8;  // black queen-side (e8-c8)
export const CASTLE_ALL = 15;

// ---------------------------------------------------------------------------
// Move encoding
// ---------------------------------------------------------------------------

/**
 * A move is packed into one 32-bit integer so move lists can live in
 * preallocated Int32Arrays with zero GC pressure:
 *
 *   bits  0..5   from square (0..63)
 *   bits  6..11  to square   (0..63)
 *   bits 12..14  promotion piece code (0 = none, else KNIGHT..QUEEN)
 *   bits 15..20  flags (see MoveFlag)
 *
 * Never compare packed moves for "same move" across positions - compare
 * `from`/`to`/`promotion` instead, since flags may legitimately differ.
 */
export type PackedMove = number;

export const MF_QUIET = 0;
export const MF_CAPTURE = 1 << 15;
export const MF_DOUBLE_PUSH = 1 << 16;
export const MF_EN_PASSANT = 1 << 17;   // implies MF_CAPTURE is also set
export const MF_CASTLE_KING = 1 << 18;
export const MF_CASTLE_QUEEN = 1 << 19;
export const MF_PROMOTION = 1 << 20;

export const encodeMove = (
  from: Square,
  to: Square,
  promotion: PieceCode = 0,
  flags = 0,
): PackedMove => from | (to << 6) | (promotion << 12) | flags;

export const moveFrom = (m: PackedMove): Square => m & 63;
export const moveTo = (m: PackedMove): Square => (m >> 6) & 63;
export const movePromotion = (m: PackedMove): PieceCode => ((m >> 12) & 7) as PieceCode;
export const moveIsCapture = (m: PackedMove): boolean => (m & MF_CAPTURE) !== 0;
export const moveIsEnPassant = (m: PackedMove): boolean => (m & MF_EN_PASSANT) !== 0;
export const moveIsPromotion = (m: PackedMove): boolean => (m & MF_PROMOTION) !== 0;
export const moveIsCastle = (m: PackedMove): boolean =>
  (m & (MF_CASTLE_KING | MF_CASTLE_QUEEN)) !== 0;

/** UCI-ish text form, e.g. "e2e4", "e7e8q". Used for logging and the book. */
export function moveToUci(m: PackedMove): string {
  const promo = movePromotion(m);
  return squareToAlgebraic(moveFrom(m)) + squareToAlgebraic(moveTo(m)) +
    (promo ? PIECE_TO_CHAR[promo] : '');
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

/** Evaluation is in centipawns, always from the side-to-move's point of view. */
export const MATE_SCORE = 30000;

/** Any |score| above this is a forced mate, with distance encoded in it. */
export const MATE_THRESHOLD = MATE_SCORE - 1000;

export const INFINITY = 32000;

/** Draw score. Adjusted by contempt at the root by the search. */
export const DRAW_SCORE = 0;

/** Standard centipawn piece values, indexed by piece code. */
export const PIECE_VALUE = [0, 100, 320, 330, 500, 900, 0] as const;

// ---------------------------------------------------------------------------
// Game result
// ---------------------------------------------------------------------------

export type GameResult =
  | 'ongoing'
  | 'checkmate'
  | 'stalemate'
  | 'fifty-move'
  | 'threefold'
  | 'insufficient-material';

/** How a position ended, plus who won when it was a mate. */
export interface StatusReport {
  result: GameResult;
  /** Winning colour on checkmate, otherwise null. */
  winner: ColorCode | null;
  inCheck: boolean;
  /** Number of legal moves available to the side to move. */
  legalMoveCount: number;
}

// ---------------------------------------------------------------------------
// Move list buffers
// ---------------------------------------------------------------------------

/**
 * Move generation writes into a caller-supplied buffer and returns the new
 * count, so no arrays are allocated inside the search.
 *
 *   const buf = new Int32Array(256);
 *   const n = generateMoves(pos, buf, 0);
 *   for (let i = 0; i < n; i++) { ... buf[i] ... }
 *
 * 256 slots is safely above the theoretical maximum of 218 legal moves.
 */
export const MAX_MOVES = 256;

/** Deepest ply the search may reach. Sizes the killer / undo stacks. */
export const MAX_PLY = 128;

export const STARTING_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ---------------------------------------------------------------------------
// Engine configuration
// ---------------------------------------------------------------------------

/**
 * Which evaluation terms are switched on. Material is always counted; these
 * gate everything above it, so weak levels can run a deliberately blunt eval.
 * Lives here rather than in eval.ts so that levels.ts can build a config
 * without importing the evaluator.
 */
export interface EvalFeatures {
  pst: boolean;
  taperedEval: boolean;
  mobility: boolean;
  kingSafety: boolean;
  pawnStructure: boolean;
  endgameKnowledge: boolean;
}

/** Everything the search needs to know about how hard to try. */
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
  /** 0 when there is no legal move. */
  bestMove: PackedMove;
  score: number;
  depth: number;
  nodes: number;
  pv: PackedMove[];
  timeMs: number;
}

export type LevelId = 1 | 2 | 3 | 4 | 5 | 6;
