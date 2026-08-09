/**
 * Board state, make/unmake, Zobrist hashing and attack detection.
 *
 * Constraints (see API.md):
 *   - No external libraries, no Angular, runnable under bare `node file.ts`.
 *   - No allocation in hot paths: the board is an Int8Array, the undo stack is
 *     a preallocated Int32Array, and nothing is cloned per move.
 *   - Zobrist keys are two 32-bit halves, never BigInt.
 */

import {
  type ColorCode,
  type PieceCode,
  type Square,
  type PackedMove,
  WHITE,
  BLACK,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  makePiece,
  pieceType,
  pieceColor,
  CASTLE_WK,
  CASTLE_WQ,
  CASTLE_BK,
  CASTLE_BQ,
  CASTLE_ALL,
  A1,
  H1,
  E1,
  A8,
  H8,
  E8,
  rowOf,
  colOf,
  squareToAlgebraic,
  algebraicToSquare,
  moveFrom,
  moveTo,
  movePromotion,
  MF_EN_PASSANT,
  MF_DOUBLE_PUSH,
  MF_CASTLE_KING,
  MF_CASTLE_QUEEN,
  PIECE_TO_CHAR,
  PIECE_FROM_CHAR,
  PIECE_VALUE,
  STARTING_FEN,
} from './types.ts';

// ---------------------------------------------------------------------------
// Geometry tables (built once at module load)
// ---------------------------------------------------------------------------

/**
 * Ray directions. Index 0..3 are the orthogonals (rook / queen), 4..7 the
 * diagonals (bishop / queen). Offsets are in the `row * 8 + col` layout, so
 * "north" (towards rank 8 / row 0) is -8.
 */
const DIR_OFFSET = new Int32Array([-8, 8, -1, 1, -9, -7, 7, 9]);
const DIR_DR = [-1, 1, 0, 0, -1, -1, 1, 1];
const DIR_DC = [0, 0, -1, 1, -1, 1, -1, 1];

/** SLIDE_LIMIT[dir * 64 + sq] = how many steps fit before falling off board. */
const SLIDE_LIMIT = new Int8Array(8 * 64);
for (let d = 0; d < 8; d++) {
  for (let sq = 0; sq < 64; sq++) {
    let r = rowOf(sq);
    let c = colOf(sq);
    let n = 0;
    for (;;) {
      r += DIR_DR[d];
      c += DIR_DC[d];
      if (r < 0 || r > 7 || c < 0 || c > 7) break;
      n++;
    }
    SLIDE_LIMIT[d * 64 + sq] = n;
  }
}

function buildStepTable(deltas: number[][]): { targets: Int8Array; counts: Int8Array } {
  const targets = new Int8Array(64 * 8);
  const counts = new Int8Array(64);
  for (let sq = 0; sq < 64; sq++) {
    const r = rowOf(sq);
    const c = colOf(sq);
    let n = 0;
    for (let i = 0; i < deltas.length; i++) {
      const rr = r + deltas[i][0];
      const cc = c + deltas[i][1];
      if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
      targets[sq * 8 + n] = (rr << 3) | cc;
      n++;
    }
    counts[sq] = n;
  }
  return { targets, counts };
}

const KNIGHT_DELTAS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_DELTAS = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

const KNIGHT_TABLE = buildStepTable(KNIGHT_DELTAS);
const KNIGHT_TARGETS = KNIGHT_TABLE.targets;
const KNIGHT_COUNT = KNIGHT_TABLE.counts;

const KING_TABLE = buildStepTable(KING_DELTAS);
const KING_TARGETS = KING_TABLE.targets;
const KING_COUNT = KING_TABLE.counts;

/**
 * PAWN_ATTACKER_FROM[color][sq * 2 + i] = squares a pawn of `color` could
 * stand on in order to attack `sq`. Used only by isSquareAttacked.
 */
const PAWN_ATTACKER_FROM: Int8Array[] = [new Int8Array(64 * 2), new Int8Array(64 * 2)];
const PAWN_ATTACKER_COUNT: Int8Array[] = [new Int8Array(64), new Int8Array(64)];
for (let sq = 0; sq < 64; sq++) {
  const r = rowOf(sq);
  const c = colOf(sq);
  // A white pawn on `p` attacks p-9 (up-left) and p-7 (up-right); so an
  // attacker of `sq` sits one row below (row + 1) and one file either side.
  let nw = 0;
  if (r + 1 <= 7) {
    if (c - 1 >= 0) PAWN_ATTACKER_FROM[WHITE][sq * 2 + nw++] = ((r + 1) << 3) | (c - 1);
    if (c + 1 <= 7) PAWN_ATTACKER_FROM[WHITE][sq * 2 + nw++] = ((r + 1) << 3) | (c + 1);
  }
  PAWN_ATTACKER_COUNT[WHITE][sq] = nw;
  // A black pawn on `p` attacks p+7 and p+9, so its attackers sit one row above.
  let nb = 0;
  if (r - 1 >= 0) {
    if (c - 1 >= 0) PAWN_ATTACKER_FROM[BLACK][sq * 2 + nb++] = ((r - 1) << 3) | (c - 1);
    if (c + 1 <= 7) PAWN_ATTACKER_FROM[BLACK][sq * 2 + nb++] = ((r - 1) << 3) | (c + 1);
  }
  PAWN_ATTACKER_COUNT[BLACK][sq] = nb;
}

/**
 * Castling-rights mask per square. ANDing the rights with the mask of the
 * `from` square AND the mask of the `to` square handles every case at once:
 * a king moving, a rook moving, and - critically - a rook being CAPTURED on
 * its home square.
 */
const CASTLE_MASK = new Int32Array(64).fill(CASTLE_ALL);
CASTLE_MASK[A1] = CASTLE_ALL & ~CASTLE_WQ;
CASTLE_MASK[H1] = CASTLE_ALL & ~CASTLE_WK;
CASTLE_MASK[E1] = CASTLE_ALL & ~(CASTLE_WK | CASTLE_WQ);
CASTLE_MASK[A8] = CASTLE_ALL & ~CASTLE_BQ;
CASTLE_MASK[H8] = CASTLE_ALL & ~CASTLE_BK;
CASTLE_MASK[E8] = CASTLE_ALL & ~(CASTLE_BK | CASTLE_BQ);

// ---------------------------------------------------------------------------
// Zobrist tables - deterministic xorshift32 seeding, two 32-bit halves
// ---------------------------------------------------------------------------

let prngState = 0x9e3779b9;
function xorshift32(): number {
  let x = prngState;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  prngState = x;
  return x | 0;
}

/** Indexed by `pieceCode * 64 + square`. Piece codes run 0..14. */
const ZOB_PIECE_LO = new Int32Array(16 * 64);
const ZOB_PIECE_HI = new Int32Array(16 * 64);
const ZOB_CASTLE_LO = new Int32Array(16);
const ZOB_CASTLE_HI = new Int32Array(16);
const ZOB_EP_LO = new Int32Array(8);
const ZOB_EP_HI = new Int32Array(8);
let ZOB_SIDE_LO = 0;
let ZOB_SIDE_HI = 0;

(function initZobrist(): void {
  prngState = 0x9e3779b9;
  // Burn a few values so the very first outputs are well mixed.
  for (let i = 0; i < 16; i++) xorshift32();
  for (let i = 0; i < 16 * 64; i++) {
    ZOB_PIECE_LO[i] = xorshift32();
    ZOB_PIECE_HI[i] = xorshift32();
  }
  for (let i = 0; i < 16; i++) {
    ZOB_CASTLE_LO[i] = xorshift32();
    ZOB_CASTLE_HI[i] = xorshift32();
  }
  for (let i = 0; i < 8; i++) {
    ZOB_EP_LO[i] = xorshift32();
    ZOB_EP_HI[i] = xorshift32();
  }
  ZOB_SIDE_LO = xorshift32();
  ZOB_SIDE_HI = xorshift32();
})();

// ---------------------------------------------------------------------------
// Undo stack layout
// ---------------------------------------------------------------------------

const UNDO_STRIDE = 9;
const U_MOVE = 0;
const U_CAPTURED = 1;
const U_CASTLING = 2;
const U_EP = 3;
const U_HALFMOVE = 4;
const U_KEY_LO = 5;
const U_KEY_HI = 6;
const U_KING_W = 7;
const U_KING_B = 8;

/** Sentinel stored in U_MOVE for a null move (a real move is always >= 0). */
const NULL_MOVE_MARKER = -1;

// ---------------------------------------------------------------------------

export class Position {
  /** Board slots, 64 entries, `(color << 3) | pieceType`, 0 = empty. */
  readonly squares = new Int8Array(64);

  /** Side to move: WHITE or BLACK. */
  turn: ColorCode = WHITE;

  /** Castling-rights bitmask built from CASTLE_WK | CASTLE_WQ | ... */
  castling = 0;

  /** En-passant TARGET square, or -1 when there is none. */
  epSquare = -1;

  /** Halfmove clock for the fifty-move rule. */
  halfmoveClock = 0;

  /** Full move number, starts at 1, increments after black moves. */
  fullmoveNumber = 1;

  /** Zobrist key, split into two 32-bit halves. */
  keyLo = 0;
  keyHi = 0;

  /** King square per colour, kept incrementally. */
  readonly kingSquare = new Int32Array(2);

  /** Plies played from the initial position of this Position object. */
  ply = 0;

  // --- internals -----------------------------------------------------------

  /** Preallocated undo stack, UNDO_STRIDE ints per record. */
  private undo = new Int32Array(512 * UNDO_STRIDE);
  private undoCount = 0;

  /** Zobrist key of every position reached, indexed by ply. */
  private histLo = new Int32Array(1024);
  private histHi = new Int32Array(1024);

  constructor() {
    this.kingSquare[WHITE] = -1;
    this.kingSquare[BLACK] = -1;
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  static initial(): Position {
    return Position.fromFen(STARTING_FEN);
  }

  static fromFen(fen: string): Position {
    const pos = new Position();
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4) throw new Error('Invalid FEN: ' + fen);

    // 1. Piece placement, rank 8 first (= row 0).
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Invalid FEN board: ' + fen);
    for (let r = 0; r < 8; r++) {
      let c = 0;
      const rowStr = rows[r];
      for (let i = 0; i < rowStr.length; i++) {
        const ch = rowStr[i];
        if (ch >= '1' && ch <= '8') {
          c += ch.charCodeAt(0) - 48;
          continue;
        }
        const lower = ch.toLowerCase();
        const type = PIECE_FROM_CHAR[lower];
        if (type === undefined) throw new Error('Invalid FEN piece "' + ch + '" in ' + fen);
        const color: ColorCode = ch === lower ? BLACK : WHITE;
        if (c > 7) throw new Error('Invalid FEN row overflow: ' + fen);
        const sq = (r << 3) | c;
        pos.squares[sq] = makePiece(color, type);
        if (type === KING) pos.kingSquare[color] = sq;
        c++;
      }
      if (c !== 8) throw new Error('Invalid FEN row width: ' + fen);
    }

    // 2. Side to move.
    pos.turn = parts[1] === 'b' ? BLACK : WHITE;

    // 3. Castling rights.
    let rights = 0;
    if (parts[2] !== '-') {
      for (let i = 0; i < parts[2].length; i++) {
        switch (parts[2][i]) {
          case 'K': rights |= CASTLE_WK; break;
          case 'Q': rights |= CASTLE_WQ; break;
          case 'k': rights |= CASTLE_BK; break;
          case 'q': rights |= CASTLE_BQ; break;
        }
      }
    }
    pos.castling = rights;

    // 4. En-passant target.
    pos.epSquare = parts[3] === '-' ? -1 : algebraicToSquare(parts[3]);

    // 5 / 6. Clocks.
    pos.halfmoveClock = parts.length > 4 ? Number(parts[4]) | 0 : 0;
    pos.fullmoveNumber = parts.length > 5 ? Number(parts[5]) | 0 : 1;
    if (pos.fullmoveNumber < 1) pos.fullmoveNumber = 1;

    pos.recomputeKey();
    pos.ply = 0;
    pos.undoCount = 0;
    pos.histLo[0] = pos.keyLo;
    pos.histHi[0] = pos.keyHi;
    return pos;
  }

  toFen(): string {
    let board = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = this.squares[(r << 3) | c];
        if (p === 0) {
          empty++;
          continue;
        }
        if (empty > 0) {
          board += empty;
          empty = 0;
        }
        const ch = PIECE_TO_CHAR[pieceType(p)];
        board += pieceColor(p) === WHITE ? ch.toUpperCase() : ch;
      }
      if (empty > 0) board += empty;
      if (r < 7) board += '/';
    }

    let rights = '';
    if (this.castling & CASTLE_WK) rights += 'K';
    if (this.castling & CASTLE_WQ) rights += 'Q';
    if (this.castling & CASTLE_BK) rights += 'k';
    if (this.castling & CASTLE_BQ) rights += 'q';
    if (rights === '') rights = '-';

    const ep = this.epSquare < 0 ? '-' : squareToAlgebraic(this.epSquare);

    return board + ' ' + (this.turn === WHITE ? 'w' : 'b') + ' ' + rights + ' ' +
      ep + ' ' + this.halfmoveClock + ' ' + this.fullmoveNumber;
  }

  clone(): Position {
    const p = new Position();
    p.squares.set(this.squares);
    p.turn = this.turn;
    p.castling = this.castling;
    p.epSquare = this.epSquare;
    p.halfmoveClock = this.halfmoveClock;
    p.fullmoveNumber = this.fullmoveNumber;
    p.keyLo = this.keyLo;
    p.keyHi = this.keyHi;
    p.kingSquare[WHITE] = this.kingSquare[WHITE];
    p.kingSquare[BLACK] = this.kingSquare[BLACK];
    p.ply = this.ply;

    if (p.undo.length < this.undo.length) p.undo = new Int32Array(this.undo.length);
    p.undo.set(this.undo.subarray(0, this.undoCount * UNDO_STRIDE));
    p.undoCount = this.undoCount;

    if (p.histLo.length < this.ply + 1) {
      p.histLo = new Int32Array(this.histLo.length);
      p.histHi = new Int32Array(this.histHi.length);
    }
    p.histLo.set(this.histLo.subarray(0, this.ply + 1));
    p.histHi.set(this.histHi.subarray(0, this.ply + 1));
    return p;
  }

  // -------------------------------------------------------------------------
  // Zobrist
  // -------------------------------------------------------------------------

  /** Rebuilds the key from scratch. Only used when loading a FEN. */
  private recomputeKey(): void {
    let lo = 0;
    let hi = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = this.squares[sq];
      if (p === 0) continue;
      const idx = p * 64 + sq;
      lo ^= ZOB_PIECE_LO[idx];
      hi ^= ZOB_PIECE_HI[idx];
    }
    lo ^= ZOB_CASTLE_LO[this.castling];
    hi ^= ZOB_CASTLE_HI[this.castling];
    if (this.epSquare >= 0) {
      const f = colOf(this.epSquare);
      lo ^= ZOB_EP_LO[f];
      hi ^= ZOB_EP_HI[f];
    }
    if (this.turn === BLACK) {
      lo ^= ZOB_SIDE_LO;
      hi ^= ZOB_SIDE_HI;
    }
    this.keyLo = lo | 0;
    this.keyHi = hi | 0;
  }

  // -------------------------------------------------------------------------
  // Attack detection - ray based, never generates move lists
  // -------------------------------------------------------------------------

  isSquareAttacked(sq: Square, by: ColorCode): boolean {
    const b = this.squares;

    // Pawns.
    const pawn = makePiece(by, PAWN);
    const pn = PAWN_ATTACKER_COUNT[by][sq];
    const pbase = sq * 2;
    for (let i = 0; i < pn; i++) {
      if (b[PAWN_ATTACKER_FROM[by][pbase + i]] === pawn) return true;
    }

    // Knights.
    const knight = makePiece(by, KNIGHT);
    const kn = KNIGHT_COUNT[sq];
    const kbase = sq * 8;
    for (let i = 0; i < kn; i++) {
      if (b[KNIGHT_TARGETS[kbase + i]] === knight) return true;
    }

    // King.
    const king = makePiece(by, KING);
    const gn = KING_COUNT[sq];
    for (let i = 0; i < gn; i++) {
      if (b[KING_TARGETS[kbase + i]] === king) return true;
    }

    // Orthogonal rays: rook or queen.
    const rook = makePiece(by, ROOK);
    const queen = makePiece(by, QUEEN);
    for (let d = 0; d < 4; d++) {
      const steps = SLIDE_LIMIT[d * 64 + sq];
      const off = DIR_OFFSET[d];
      let s = sq;
      for (let i = 0; i < steps; i++) {
        s += off;
        const p = b[s];
        if (p !== 0) {
          if (p === rook || p === queen) return true;
          break;
        }
      }
    }

    // Diagonal rays: bishop or queen.
    const bishop = makePiece(by, BISHOP);
    for (let d = 4; d < 8; d++) {
      const steps = SLIDE_LIMIT[d * 64 + sq];
      const off = DIR_OFFSET[d];
      let s = sq;
      for (let i = 0; i < steps; i++) {
        s += off;
        const p = b[s];
        if (p !== 0) {
          if (p === bishop || p === queen) return true;
          break;
        }
      }
    }

    return false;
  }

  isKingInCheck(color: ColorCode): boolean {
    const ks = this.kingSquare[color];
    if (ks < 0) return false;
    return this.isSquareAttacked(ks, (color ^ 1) as ColorCode);
  }

  inCheck(): boolean {
    return this.isKingInCheck(this.turn);
  }

  // -------------------------------------------------------------------------
  // Make / unmake
  // -------------------------------------------------------------------------

  private ensureUndoCapacity(): void {
    if ((this.undoCount + 1) * UNDO_STRIDE <= this.undo.length) return;
    const bigger = new Int32Array(this.undo.length * 2);
    bigger.set(this.undo);
    this.undo = bigger;
  }

  private ensureHistCapacity(n: number): void {
    if (n < this.histLo.length) return;
    const size = Math.max(this.histLo.length * 2, n + 1);
    const lo = new Int32Array(size);
    const hi = new Int32Array(size);
    lo.set(this.histLo);
    hi.set(this.histHi);
    this.histLo = lo;
    this.histHi = hi;
  }

  makeMove(move: PackedMove): boolean {
    const b = this.squares;
    const from = moveFrom(move);
    const to = moveTo(move);
    const us = this.turn;
    const them = (us ^ 1) as ColorCode;
    const piece = b[from];
    const ptype = pieceType(piece);
    const promo = movePromotion(move);
    const isEp = (move & MF_EN_PASSANT) !== 0;

    // --- push the undo record ---------------------------------------------
    this.ensureUndoCapacity();
    const u = this.undoCount * UNDO_STRIDE;
    const undo = this.undo;
    const captureSquare = isEp ? (us === WHITE ? to + 8 : to - 8) : to;
    const captured = isEp ? b[captureSquare] : b[to];
    undo[u + U_MOVE] = move;
    undo[u + U_CAPTURED] = captured;
    undo[u + U_CASTLING] = this.castling;
    undo[u + U_EP] = this.epSquare;
    undo[u + U_HALFMOVE] = this.halfmoveClock;
    undo[u + U_KEY_LO] = this.keyLo;
    undo[u + U_KEY_HI] = this.keyHi;
    undo[u + U_KING_W] = this.kingSquare[WHITE];
    undo[u + U_KING_B] = this.kingSquare[BLACK];
    this.undoCount++;

    let lo = this.keyLo;
    let hi = this.keyHi;

    // --- clear the old en-passant square from the key ----------------------
    if (this.epSquare >= 0) {
      const f = colOf(this.epSquare);
      lo ^= ZOB_EP_LO[f];
      hi ^= ZOB_EP_HI[f];
    }

    // --- remove the captured piece ----------------------------------------
    if (captured !== 0) {
      const ci = captured * 64 + captureSquare;
      lo ^= ZOB_PIECE_LO[ci];
      hi ^= ZOB_PIECE_HI[ci];
      b[captureSquare] = 0;
    }

    // --- move the piece ----------------------------------------------------
    const fi = piece * 64 + from;
    lo ^= ZOB_PIECE_LO[fi];
    hi ^= ZOB_PIECE_HI[fi];
    b[from] = 0;

    const landed = promo !== 0 ? makePiece(us, promo) : piece;
    const ti = landed * 64 + to;
    lo ^= ZOB_PIECE_LO[ti];
    hi ^= ZOB_PIECE_HI[ti];
    b[to] = landed;

    // --- castling rook hop -------------------------------------------------
    if (move & MF_CASTLE_KING) {
      const rf = to + 1;
      const rt = to - 1;
      const rook = b[rf];
      b[rf] = 0;
      b[rt] = rook;
      const a = rook * 64 + rf;
      const c = rook * 64 + rt;
      lo ^= ZOB_PIECE_LO[a] ^ ZOB_PIECE_LO[c];
      hi ^= ZOB_PIECE_HI[a] ^ ZOB_PIECE_HI[c];
    } else if (move & MF_CASTLE_QUEEN) {
      const rf = to - 2;
      const rt = to + 1;
      const rook = b[rf];
      b[rf] = 0;
      b[rt] = rook;
      const a = rook * 64 + rf;
      const c = rook * 64 + rt;
      lo ^= ZOB_PIECE_LO[a] ^ ZOB_PIECE_LO[c];
      hi ^= ZOB_PIECE_HI[a] ^ ZOB_PIECE_HI[c];
    }

    // --- castling rights ---------------------------------------------------
    // The `to` mask is what kills the rights when a rook is CAPTURED on its
    // home square, not just when it moves.
    const newCastling = this.castling & CASTLE_MASK[from] & CASTLE_MASK[to];
    if (newCastling !== this.castling) {
      lo ^= ZOB_CASTLE_LO[this.castling] ^ ZOB_CASTLE_LO[newCastling];
      hi ^= ZOB_CASTLE_HI[this.castling] ^ ZOB_CASTLE_HI[newCastling];
      this.castling = newCastling;
    }

    // --- king square -------------------------------------------------------
    if (ptype === KING) this.kingSquare[us] = to;

    // --- new en-passant target --------------------------------------------
    if (move & MF_DOUBLE_PUSH) {
      const epSq = us === WHITE ? to + 8 : to - 8;
      this.epSquare = epSq;
      const f = colOf(epSq);
      lo ^= ZOB_EP_LO[f];
      hi ^= ZOB_EP_HI[f];
    } else {
      this.epSquare = -1;
    }

    // --- clocks ------------------------------------------------------------
    if (ptype === PAWN || captured !== 0) this.halfmoveClock = 0;
    else this.halfmoveClock++;
    if (us === BLACK) this.fullmoveNumber++;

    // --- side to move ------------------------------------------------------
    this.turn = them;
    lo ^= ZOB_SIDE_LO;
    hi ^= ZOB_SIDE_HI;

    this.keyLo = lo | 0;
    this.keyHi = hi | 0;

    this.ply++;
    this.ensureHistCapacity(this.ply);
    this.histLo[this.ply] = this.keyLo;
    this.histHi[this.ply] = this.keyHi;

    // --- legality ----------------------------------------------------------
    if (this.isSquareAttacked(this.kingSquare[us], them)) {
      this.unmakeMove();
      return false;
    }
    return true;
  }

  unmakeMove(): void {
    if (this.undoCount === 0) return;
    this.undoCount--;
    const u = this.undoCount * UNDO_STRIDE;
    const undo = this.undo;
    const move = undo[u + U_MOVE];

    if (move === NULL_MOVE_MARKER) {
      this.restoreCommon(u);
      return;
    }

    const b = this.squares;
    const from = moveFrom(move);
    const to = moveTo(move);
    const us = (this.turn ^ 1) as ColorCode; // the side that made the move
    const captured = undo[u + U_CAPTURED];
    const isEp = (move & MF_EN_PASSANT) !== 0;
    const promo = movePromotion(move);

    // Undo the castling rook hop first (the king is still on `to`).
    if (move & MF_CASTLE_KING) {
      const rf = to + 1;
      const rt = to - 1;
      b[rf] = b[rt];
      b[rt] = 0;
    } else if (move & MF_CASTLE_QUEEN) {
      const rf = to - 2;
      const rt = to + 1;
      b[rf] = b[rt];
      b[rt] = 0;
    }

    // Put the mover back (undoing promotion by restoring a pawn).
    b[from] = promo !== 0 ? makePiece(us, PAWN) : b[to];
    b[to] = 0;

    // Restore the captured piece on the right square.
    if (captured !== 0) {
      const capSq = isEp ? (us === WHITE ? to + 8 : to - 8) : to;
      b[capSq] = captured;
    }

    this.restoreCommon(u);
  }

  /** Restores every scalar saved in an undo record. Shared by move + null. */
  private restoreCommon(u: number): void {
    const undo = this.undo;
    const wasBlack = this.turn === WHITE; // we are flipping back to the mover
    this.turn = (this.turn ^ 1) as ColorCode;
    if (wasBlack) this.fullmoveNumber--;
    this.castling = undo[u + U_CASTLING];
    this.epSquare = undo[u + U_EP];
    this.halfmoveClock = undo[u + U_HALFMOVE];
    this.keyLo = undo[u + U_KEY_LO];
    this.keyHi = undo[u + U_KEY_HI];
    this.kingSquare[WHITE] = undo[u + U_KING_W];
    this.kingSquare[BLACK] = undo[u + U_KING_B];
    this.ply--;
  }

  makeNullMove(): void {
    this.ensureUndoCapacity();
    const u = this.undoCount * UNDO_STRIDE;
    const undo = this.undo;
    undo[u + U_MOVE] = NULL_MOVE_MARKER;
    undo[u + U_CAPTURED] = 0;
    undo[u + U_CASTLING] = this.castling;
    undo[u + U_EP] = this.epSquare;
    undo[u + U_HALFMOVE] = this.halfmoveClock;
    undo[u + U_KEY_LO] = this.keyLo;
    undo[u + U_KEY_HI] = this.keyHi;
    undo[u + U_KING_W] = this.kingSquare[WHITE];
    undo[u + U_KING_B] = this.kingSquare[BLACK];
    this.undoCount++;

    let lo = this.keyLo;
    let hi = this.keyHi;
    if (this.epSquare >= 0) {
      const f = colOf(this.epSquare);
      lo ^= ZOB_EP_LO[f];
      hi ^= ZOB_EP_HI[f];
      this.epSquare = -1;
    }
    lo ^= ZOB_SIDE_LO;
    hi ^= ZOB_SIDE_HI;
    this.keyLo = lo | 0;
    this.keyHi = hi | 0;

    if (this.turn === BLACK) this.fullmoveNumber++;
    this.turn = (this.turn ^ 1) as ColorCode;
    this.halfmoveClock++;

    this.ply++;
    this.ensureHistCapacity(this.ply);
    this.histLo[this.ply] = this.keyLo;
    this.histHi[this.ply] = this.keyHi;
  }

  unmakeNullMove(): void {
    if (this.undoCount === 0) return;
    this.undoCount--;
    this.restoreCommon(this.undoCount * UNDO_STRIDE);
  }

  // -------------------------------------------------------------------------
  // Draw detection
  // -------------------------------------------------------------------------

  repetitionCount(): number {
    const lo = this.keyLo;
    const hi = this.keyHi;
    let count = 1;
    // Only positions since the last irreversible move can repeat, and only
    // every second ply has the same side to move.
    let stop = this.ply - this.halfmoveClock;
    if (stop < 0) stop = 0;
    for (let i = this.ply - 2; i >= stop; i -= 2) {
      if (this.histLo[i] === lo && this.histHi[i] === hi) count++;
    }
    return count;
  }

  isDrawByRule(): boolean {
    if (this.halfmoveClock >= 100) return true;
    if (this.isInsufficientMaterial()) return true;
    return this.repetitionCount() >= 3;
  }

  isInsufficientMaterial(): boolean {
    // Counts per colour: [pawns, knights, bishops, rooks, queens]
    let minorW = 0;
    let minorB = 0;
    let bishopW = -1;
    let bishopB = -1;
    for (let sq = 0; sq < 64; sq++) {
      const p = this.squares[sq];
      if (p === 0) continue;
      const t = pieceType(p);
      if (t === KING) continue;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      // Knight or bishop.
      if (pieceColor(p) === WHITE) {
        minorW++;
        if (t === BISHOP) bishopW = (rowOf(sq) + colOf(sq)) & 1;
      } else {
        minorB++;
        if (t === BISHOP) bishopB = (rowOf(sq) + colOf(sq)) & 1;
      }
      if (minorW > 1 || minorB > 1) return false;
    }
    // K vs K, K+minor vs K.
    if (minorW + minorB <= 1) return true;
    // K+B vs K+B with same-coloured bishops.
    if (minorW === 1 && minorB === 1 && bishopW >= 0 && bishopB >= 0) {
      return bishopW === bishopB;
    }
    return false;
  }

  /** Sum of non-pawn, non-king material in centipawns, both colours. */
  phase(): number {
    let total = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = this.squares[sq];
      if (p === 0) continue;
      const t = pieceType(p);
      if (t === PAWN || t === KING) continue;
      total += PIECE_VALUE[t];
    }
    return total;
  }
}
