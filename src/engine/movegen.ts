/**
 * Move generation.
 *
 * `generateMoves` and `generateCaptures` are PSEUDO-legal: they may leave the
 * mover's own king in check. `Position.makeMove` returns false for those, so
 * the search filters legality for free while it descends. Castling is the one
 * exception - it is fully validated here, because the "may not pass through
 * an attacked square" rule cannot be caught by a post-move king check.
 *
 * Everything writes into a caller-supplied Int32Array so the search never
 * allocates.
 */

import { Position } from './position.ts';
import {
  type ColorCode,
  type PieceCode,
  type Square,
  type PackedMove,
  type StatusReport,
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
  A1,
  H1,
  E1,
  C1,
  D1,
  F1,
  G1,
  A8,
  H8,
  E8,
  C8,
  D8,
  F8,
  G8,
  rowOf,
  colOf,
  encodeMove,
  moveFrom,
  MF_CAPTURE,
  MF_DOUBLE_PUSH,
  MF_EN_PASSANT,
  MF_CASTLE_KING,
  MF_CASTLE_QUEEN,
  MF_PROMOTION,
  MAX_MOVES,
} from './types.ts';

// ---------------------------------------------------------------------------
// Geometry (duplicated here rather than exported from position.ts so that
// position.ts stays a leaf module with no movegen dependency)
// ---------------------------------------------------------------------------

const DIR_OFFSET = new Int32Array([-8, 8, -1, 1, -9, -7, 7, 9]);
const DIR_DR = [-1, 1, 0, 0, -1, -1, 1, 1];
const DIR_DC = [0, 0, -1, 1, -1, 1, -1, 1];

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

const KNIGHT_TABLE = buildStepTable([
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
]);
const KING_TABLE = buildStepTable([
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
]);

/** Promotion pieces, generated as four separate moves. */
const PROMO_PIECES: PieceCode[] = [QUEEN, ROOK, BISHOP, KNIGHT];

/** Ray direction ranges per sliding piece type. */
const SLIDER_START = [0, 0, 0, 4, 0, 0, 0]; // indexed by piece type
const SLIDER_END = [0, 0, 0, 8, 4, 8, 0];
// BISHOP -> dirs 4..7, ROOK -> 0..3, QUEEN -> 0..7

// ---------------------------------------------------------------------------
// Scratch buffer pool for the helpers that need their own move list.
// A tiny stack keeps them reentrant without allocating.
// ---------------------------------------------------------------------------

const BUF_POOL: Int32Array[] = [];
let bufDepth = 0;

function acquireBuffer(): Int32Array {
  if (bufDepth === BUF_POOL.length) BUF_POOL.push(new Int32Array(MAX_MOVES));
  return BUF_POOL[bufDepth++];
}

function releaseBuffer(): void {
  bufDepth--;
}

// ---------------------------------------------------------------------------
// Pseudo-legal generation
// ---------------------------------------------------------------------------

export function generateMoves(pos: Position, out: Int32Array, start: number): number {
  return generate(pos, out, start, false);
}

export function generateCaptures(pos: Position, out: Int32Array, start: number): number {
  return generate(pos, out, start, true);
}

function generate(
  pos: Position,
  out: Int32Array,
  start: number,
  capturesOnly: boolean,
): number {
  const b = pos.squares;
  const us = pos.turn;
  const them = (us ^ 1) as ColorCode;
  let n = start;

  const forward = us === WHITE ? -8 : 8;
  const startRow = us === WHITE ? 6 : 1;
  const promoRow = us === WHITE ? 0 : 7;
  const epSq = pos.epSquare;

  for (let from = 0; from < 64; from++) {
    const piece = b[from];
    if (piece === 0 || pieceColor(piece) !== us) continue;
    const type = pieceType(piece);

    switch (type) {
      case PAWN: {
        const r = rowOf(from);
        const c = colOf(from);

        // Forward pushes.
        const one = from + forward;
        if (b[one] === 0) {
          if (rowOf(one) === promoRow) {
            for (let i = 0; i < 4; i++) {
              out[n++] = encodeMove(from, one, PROMO_PIECES[i], MF_PROMOTION);
            }
          } else if (!capturesOnly) {
            out[n++] = encodeMove(from, one, 0, 0);
            if (r === startRow) {
              const two = one + forward;
              if (b[two] === 0) {
                out[n++] = encodeMove(from, two, 0, MF_DOUBLE_PUSH);
              }
            }
          }
        }

        // Diagonal captures + en passant.
        for (let s = -1; s <= 1; s += 2) {
          const cc = c + s;
          if (cc < 0 || cc > 7) continue;
          const to = one + s;
          const target = b[to];
          if (target !== 0) {
            if (pieceColor(target) !== them) continue;
            if (rowOf(to) === promoRow) {
              for (let i = 0; i < 4; i++) {
                out[n++] = encodeMove(
                  from, to, PROMO_PIECES[i], MF_PROMOTION | MF_CAPTURE,
                );
              }
            } else {
              out[n++] = encodeMove(from, to, 0, MF_CAPTURE);
            }
          } else if (to === epSq) {
            out[n++] = encodeMove(from, to, 0, MF_CAPTURE | MF_EN_PASSANT);
          }
        }
        break;
      }

      case KNIGHT: {
        const base = from * 8;
        const count = KNIGHT_TABLE.counts[from];
        for (let i = 0; i < count; i++) {
          const to = KNIGHT_TABLE.targets[base + i];
          const target = b[to];
          if (target === 0) {
            if (!capturesOnly) out[n++] = encodeMove(from, to, 0, 0);
          } else if (pieceColor(target) === them) {
            out[n++] = encodeMove(from, to, 0, MF_CAPTURE);
          }
        }
        break;
      }

      case BISHOP:
      case ROOK:
      case QUEEN: {
        const dStart = SLIDER_START[type];
        const dEnd = SLIDER_END[type];
        for (let d = dStart; d < dEnd; d++) {
          const steps = SLIDE_LIMIT[d * 64 + from];
          const off = DIR_OFFSET[d];
          let to = from;
          for (let i = 0; i < steps; i++) {
            to += off;
            const target = b[to];
            if (target === 0) {
              if (!capturesOnly) out[n++] = encodeMove(from, to, 0, 0);
              continue;
            }
            if (pieceColor(target) === them) {
              out[n++] = encodeMove(from, to, 0, MF_CAPTURE);
            }
            break;
          }
        }
        break;
      }

      case KING: {
        const base = from * 8;
        const count = KING_TABLE.counts[from];
        for (let i = 0; i < count; i++) {
          const to = KING_TABLE.targets[base + i];
          const target = b[to];
          if (target === 0) {
            if (!capturesOnly) out[n++] = encodeMove(from, to, 0, 0);
          } else if (pieceColor(target) === them) {
            out[n++] = encodeMove(from, to, 0, MF_CAPTURE);
          }
        }
        if (!capturesOnly) n = addCastles(pos, out, n, us, them);
        break;
      }
    }
  }

  return n;
}

/**
 * Castling. All conditions are checked here, so a generated castle is legal
 * except for nothing at all - make/unmake will never reject it.
 *   - the right is still present
 *   - king and rook are actually on their home squares
 *   - every square between them is empty
 *   - the king is not currently in check
 *   - the king neither passes through nor lands on an attacked square
 */
function addCastles(
  pos: Position,
  out: Int32Array,
  n: number,
  us: ColorCode,
  them: ColorCode,
): number {
  const b = pos.squares;
  const rook = makePiece(us, ROOK);
  const king = makePiece(us, KING);

  const kingHome = us === WHITE ? E1 : E8;
  if (b[kingHome] !== king) return n;

  const kingRight = us === WHITE ? CASTLE_WK : CASTLE_BK;
  const queenRight = us === WHITE ? CASTLE_WQ : CASTLE_BQ;
  if ((pos.castling & (kingRight | queenRight)) === 0) return n;

  // Evaluate the "king is currently in check" test at most once.
  let inCheck = -1;

  if (pos.castling & kingRight) {
    const rookHome = us === WHITE ? H1 : H8;
    const fSq = us === WHITE ? F1 : F8;
    const gSq = us === WHITE ? G1 : G8;
    if (b[rookHome] === rook && b[fSq] === 0 && b[gSq] === 0) {
      if (inCheck < 0) inCheck = pos.isSquareAttacked(kingHome, them) ? 1 : 0;
      if (
        inCheck === 0 &&
        !pos.isSquareAttacked(fSq, them) &&
        !pos.isSquareAttacked(gSq, them)
      ) {
        out[n++] = encodeMove(kingHome, gSq, 0, MF_CASTLE_KING);
      }
    }
  }

  if (pos.castling & queenRight) {
    const rookHome = us === WHITE ? A1 : A8;
    const dSq = us === WHITE ? D1 : D8;
    const cSq = us === WHITE ? C1 : C8;
    const bSq = us === WHITE ? A1 + 1 : A8 + 1;
    if (b[rookHome] === rook && b[bSq] === 0 && b[cSq] === 0 && b[dSq] === 0) {
      if (inCheck < 0) inCheck = pos.isSquareAttacked(kingHome, them) ? 1 : 0;
      if (
        inCheck === 0 &&
        !pos.isSquareAttacked(dSq, them) &&
        !pos.isSquareAttacked(cSq, them)
      ) {
        out[n++] = encodeMove(kingHome, cSq, 0, MF_CASTLE_QUEEN);
      }
    }
  }

  return n;
}

// ---------------------------------------------------------------------------
// Legal generation
// ---------------------------------------------------------------------------

/**
 * Filters `generateMoves` through make/unmake, compacting in place. No extra
 * buffer is needed because make/unmake never touches the move list.
 */
export function generateLegalMoves(pos: Position, out: Int32Array, start: number): number {
  const end = generateMoves(pos, out, start);
  let write = start;
  for (let i = start; i < end; i++) {
    const move = out[i];
    if (pos.makeMove(move)) {
      pos.unmakeMove();
      out[write++] = move;
    }
  }
  return write;
}

export function hasLegalMove(pos: Position): boolean {
  const buf = acquireBuffer();
  try {
    const end = generateMoves(pos, buf, 0);
    for (let i = 0; i < end; i++) {
      if (pos.makeMove(buf[i])) {
        pos.unmakeMove();
        return true;
      }
    }
    return false;
  } finally {
    releaseBuffer();
  }
}

export function legalMovesFrom(pos: Position, from: Square): PackedMove[] {
  const buf = acquireBuffer();
  try {
    const end = generateMoves(pos, buf, 0);
    const result: PackedMove[] = [];
    for (let i = 0; i < end; i++) {
      const move = buf[i];
      if (moveFrom(move) !== from) continue;
      if (pos.makeMove(move)) {
        pos.unmakeMove();
        result.push(move);
      }
    }
    return result;
  } finally {
    releaseBuffer();
  }
}

export function getStatus(pos: Position): StatusReport {
  const buf = acquireBuffer();
  let legalMoveCount: number;
  try {
    legalMoveCount = generateLegalMoves(pos, buf, 0);
  } finally {
    releaseBuffer();
  }

  const inCheck = pos.inCheck();

  if (legalMoveCount === 0) {
    if (inCheck) {
      return {
        result: 'checkmate',
        winner: (pos.turn ^ 1) as ColorCode,
        inCheck: true,
        legalMoveCount: 0,
      };
    }
    return { result: 'stalemate', winner: null, inCheck: false, legalMoveCount: 0 };
  }

  if (pos.isInsufficientMaterial()) {
    return { result: 'insufficient-material', winner: null, inCheck, legalMoveCount };
  }
  if (pos.halfmoveClock >= 100) {
    return { result: 'fifty-move', winner: null, inCheck, legalMoveCount };
  }
  if (pos.repetitionCount() >= 3) {
    return { result: 'threefold', winner: null, inCheck, legalMoveCount };
  }

  return { result: 'ongoing', winner: null, inCheck, legalMoveCount };
}
