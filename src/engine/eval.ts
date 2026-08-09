/**
 * Static evaluation.
 *
 * Returns centipawns FROM THE SIDE TO MOVE'S POINT OF VIEW - positive means the
 * side to move is better. Everything is accumulated from white's perspective
 * and negated once at the end, which is the convention negamax depends on.
 *
 * Material is always counted. Every other term is gated behind an EvalFeatures
 * flag, so a level-1 opponent really does play with nothing but material and a
 * level-6 opponent gets the whole thing. That is what makes the difficulty
 * ladder a genuine ladder rather than six copies of the same engine at
 * different depths.
 *
 * Square orientation is documented at the top of eval-tables.ts - briefly,
 * square 0 is a8 and 63 is h1, the tables are written in that same order so
 * white indexes them directly, and black mirrors with `sq ^ 56`.
 */

import { Position } from './position.ts';
import {
  BISHOP,
  BLACK,
  KING,
  KNIGHT,
  PAWN,
  PIECE_VALUE,
  QUEEN,
  ROOK,
  WHITE,
  colOf,
  pieceColor,
  pieceType,
  rowOf,
  type ColorCode,
  type EvalFeatures,
} from './types.ts';
import {
  CORNER_DISTANCE,
  KING_DISTANCE,
  KING_SAFETY_TABLE,
  PASSED_PAWN_EG,
  PASSED_PAWN_MG,
  PST_EG,
  PST_MG,
} from './eval-tables.ts';

export const ALL_FEATURES: EvalFeatures = {
  pst: true,
  taperedEval: true,
  mobility: true,
  kingSafety: true,
  pawnStructure: true,
  endgameKnowledge: true,
};

export const MATERIAL_ONLY: EvalFeatures = {
  pst: false,
  taperedEval: false,
  mobility: false,
  kingSafety: false,
  pawnStructure: false,
  endgameKnowledge: false,
};

// ---------------------------------------------------------------------------
// Tunable weights
// ---------------------------------------------------------------------------

const BISHOP_PAIR_MG = 35;
const BISHOP_PAIR_EG = 55;

const ROOK_OPEN_FILE = 22;
const ROOK_SEMI_OPEN_FILE = 11;
const ROOK_ON_SEVENTH_EG = 25;

const TEMPO_BONUS = 10;

const DOUBLED_PAWN_MG = -12;
const DOUBLED_PAWN_EG = -22;
const ISOLATED_PAWN_MG = -16;
const ISOLATED_PAWN_EG = -18;
const BACKWARD_PAWN_MG = -10;
const BACKWARD_PAWN_EG = -12;
const PROTECTED_PASSER_BONUS = 18;
const CONNECTED_PASSER_BONUS = 14;

/** Mobility is worth more for pieces that can actually use the freedom. */
const MOBILITY_MG = [0, 0, 4, 5, 2, 1, 0];
const MOBILITY_EG = [0, 0, 4, 5, 4, 2, 0];

/** Roughly the average number of destinations, so the term is centred on 0. */
const MOBILITY_BASE = [0, 0, 4, 6, 7, 14, 0];

/** Attack weight each piece type contributes near the enemy king. */
const KING_ATTACK_WEIGHT = [0, 0, 20, 20, 40, 80, 0];

/** Phase units per piece, summing to 24 at the start of a game. */
const PHASE_WEIGHT = [0, 0, 1, 1, 2, 4, 0];
const PHASE_TOTAL = 24;

// ---------------------------------------------------------------------------
// Direction tables
// ---------------------------------------------------------------------------

/** [rowStep, colStep] pairs. Walking by row/col avoids file-wrap bugs. */
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_DIRS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_DIRS = QUEEN_DIRS;

// ---------------------------------------------------------------------------
// Scratch state - reused across calls so `evaluate` allocates nothing
// ---------------------------------------------------------------------------

/** pawnsOnFile[color * 8 + file] */
const pawnsOnFile = new Int8Array(16);
/** Most advanced pawn per colour and file, as a rank from that side's home. */
const pawnFrontier = new Int8Array(16);
/** Square list per colour, so the mobility pass does not rescan the board. */
const pieceSquares = new Int32Array(64);

// ---------------------------------------------------------------------------

export function evaluate(pos: Position, features: EvalFeatures = ALL_FEATURES): number {
  const sq = pos.squares;

  let mg = 0;
  let eg = 0;
  let phase = 0;

  let bishopsW = 0;
  let bishopsB = 0;
  let pieceCount = 0;

  pawnsOnFile.fill(0);
  pawnFrontier.fill(-1);

  // --- Pass 1: material, piece-square tables, pawn file census -------------
  for (let s = 0; s < 64; s++) {
    const p = sq[s];
    if (p === 0) continue;

    const type = pieceType(p);
    const color = pieceColor(p);
    const sign = color === WHITE ? 1 : -1;

    const value = PIECE_VALUE[type];
    mg += sign * value;
    eg += sign * value;
    phase += PHASE_WEIGHT[type];

    if (features.pst) {
      // White reads the table directly; black mirrors the rank.
      const idx = color === WHITE ? s : s ^ 56;
      mg += sign * PST_MG[type]![idx];
      eg += sign * PST_EG[type]![idx];
    }

    if (type === PAWN) {
      const file = colOf(s);
      pawnsOnFile[color * 8 + file]++;
      // "Advancement" measured from that colour's own back rank.
      const advance = color === WHITE ? 7 - rowOf(s) : rowOf(s);
      const key = color * 8 + file;
      if (advance > pawnFrontier[key]) pawnFrontier[key] = advance;
    } else if (type === BISHOP) {
      if (color === WHITE) bishopsW++; else bishopsB++;
    }

    if (type !== KING) pieceSquares[pieceCount++] = s;
  }

  if (phase > PHASE_TOTAL) phase = PHASE_TOTAL; // early promotions

  // --- Always-on positional extras ----------------------------------------
  if (bishopsW >= 2) { mg += BISHOP_PAIR_MG; eg += BISHOP_PAIR_EG; }
  if (bishopsB >= 2) { mg -= BISHOP_PAIR_MG; eg -= BISHOP_PAIR_EG; }

  for (let i = 0; i < pieceCount; i++) {
    const s = pieceSquares[i];
    const p = sq[s];
    if (pieceType(p) !== ROOK) continue;

    const color = pieceColor(p);
    const sign = color === WHITE ? 1 : -1;
    const file = colOf(s);
    const own = pawnsOnFile[color * 8 + file];
    const enemy = pawnsOnFile[(color ^ 1) * 8 + file];

    if (own === 0) {
      mg += sign * (enemy === 0 ? ROOK_OPEN_FILE : ROOK_SEMI_OPEN_FILE);
    }
    // Rank 7 from the rook's own point of view: row 1 for white, row 6 for black.
    if (rowOf(s) === (color === WHITE ? 1 : 6)) {
      eg += sign * ROOK_ON_SEVENTH_EG;
    }
  }

  // --- Optional terms ------------------------------------------------------
  if (features.mobility) {
    const m = mobilityTerm(pos, pieceCount);
    mg += m.mg;
    eg += m.eg;
  }

  if (features.pawnStructure) {
    const s = pawnStructureTerm(pos);
    mg += s.mg;
    eg += s.eg;
  }

  if (features.kingSafety) {
    // King safety is a midgame concern; with the queens off it is mostly noise.
    mg += kingSafetyTerm(pos, WHITE) - kingSafetyTerm(pos, BLACK);
  }

  // --- Blend -------------------------------------------------------------
  let score = features.taperedEval
    ? (mg * phase + eg * (PHASE_TOTAL - phase)) / PHASE_TOTAL
    : mg;

  if (features.endgameKnowledge) {
    score = applyEndgameKnowledge(pos, score, phase);
  }

  score = Math.round(score);

  // Having the move is worth something in itself.
  score += pos.turn === WHITE ? TEMPO_BONUS : -TEMPO_BONUS;

  return pos.turn === WHITE ? score : -score;
}

// ---------------------------------------------------------------------------
// Mobility
// ---------------------------------------------------------------------------

const mobilityResult = { mg: 0, eg: 0 };

/**
 * Counts destination squares per piece. Deliberately implemented here with its
 * own ray walks rather than by calling movegen: movegen builds full move
 * records with flags and legality, which is far more work than this needs, and
 * it would tie the evaluator to the search's buffers.
 */
function mobilityTerm(pos: Position, pieceCount: number): { mg: number; eg: number } {
  const sq = pos.squares;
  let mg = 0;
  let eg = 0;

  for (let i = 0; i < pieceCount; i++) {
    const from = pieceSquares[i];
    const p = sq[from];
    const type = pieceType(p);
    if (type === PAWN) continue;

    const color = pieceColor(p);
    const sign = color === WHITE ? 1 : -1;
    const count = countDestinations(sq, from, type, color);
    const delta = count - MOBILITY_BASE[type];

    mg += sign * delta * MOBILITY_MG[type];
    eg += sign * delta * MOBILITY_EG[type];
  }

  mobilityResult.mg = mg;
  mobilityResult.eg = eg;
  return mobilityResult;
}

function countDestinations(
  sq: Int8Array, from: number, type: number, color: ColorCode,
): number {
  const r0 = rowOf(from);
  const c0 = colOf(from);
  let count = 0;

  if (type === KNIGHT || type === KING) {
    const dirs = type === KNIGHT ? KNIGHT_DIRS : KING_DIRS;
    for (const [dr, dc] of dirs) {
      const r = r0 + dr;
      const c = c0 + dc;
      if (r < 0 || r > 7 || c < 0 || c > 7) continue;
      const target = sq[(r << 3) | c];
      if (target === 0 || pieceColor(target) !== color) count++;
    }
    return count;
  }

  const dirs = type === ROOK ? ROOK_DIRS : type === BISHOP ? BISHOP_DIRS : QUEEN_DIRS;
  for (const [dr, dc] of dirs) {
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
      const target = sq[(r << 3) | c];
      if (target === 0) {
        count++;
      } else {
        if (pieceColor(target) !== color) count++;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Pawn structure
// ---------------------------------------------------------------------------

const pawnResult = { mg: 0, eg: 0 };

function pawnStructureTerm(pos: Position): { mg: number; eg: number } {
  const sq = pos.squares;
  let mg = 0;
  let eg = 0;

  for (let s = 0; s < 64; s++) {
    const p = sq[s];
    if (p === 0 || pieceType(p) !== PAWN) continue;

    const color = pieceColor(p);
    const sign = color === WHITE ? 1 : -1;
    const file = colOf(s);
    const own = color * 8 + file;
    const foe = (color ^ 1) * 8 + file;
    const advance = color === WHITE ? 7 - rowOf(s) : rowOf(s);

    // Doubled: more than one of our pawns on this file.
    if (pawnsOnFile[own] > 1) {
      mg += sign * DOUBLED_PAWN_MG;
      eg += sign * DOUBLED_PAWN_EG;
    }

    // Isolated: no friendly pawn on either neighbouring file.
    const leftOwn = file > 0 ? pawnsOnFile[own - 1] : 0;
    const rightOwn = file < 7 ? pawnsOnFile[own + 1] : 0;
    const isolated = leftOwn === 0 && rightOwn === 0;
    if (isolated) {
      mg += sign * ISOLATED_PAWN_MG;
      eg += sign * ISOLATED_PAWN_EG;
    } else {
      // Backward: both neighbours are further from promotion than this pawn,
      // so it cannot be defended by a pawn and must advance alone.
      const leftAdv = file > 0 ? pawnFrontier[own - 1] : 99;
      const rightAdv = file < 7 ? pawnFrontier[own + 1] : 99;
      const support = Math.max(
        leftOwn > 0 ? leftAdv : -1,
        rightOwn > 0 ? rightAdv : -1,
      );
      if (support < advance) {
        mg += sign * BACKWARD_PAWN_MG;
        eg += sign * BACKWARD_PAWN_EG;
      }
    }

    // Passed: no enemy pawn ahead on this file or on either neighbour.
    if (isPassedPawn(sq, s, color)) {
      mg += sign * PASSED_PAWN_MG[advance];
      eg += sign * PASSED_PAWN_EG[advance];

      if (isPawnProtected(sq, s, color)) {
        eg += sign * PROTECTED_PASSER_BONUS;
      }
      // Connected: a friendly pawn on an adjacent file at the same advance.
      const connected =
        (file > 0 && pawnFrontier[own - 1] === advance) ||
        (file < 7 && pawnFrontier[own + 1] === advance);
      if (connected) eg += sign * CONNECTED_PASSER_BONUS;
    }

    void foe;
  }

  pawnResult.mg = mg;
  pawnResult.eg = eg;
  return pawnResult;
}

function isPassedPawn(sq: Int8Array, s: number, color: ColorCode): boolean {
  const file = colOf(s);
  const row = rowOf(s);
  const step = color === WHITE ? -1 : 1; // white advances towards row 0
  const enemyPawn = ((color ^ 1) << 3) | PAWN;

  for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
    for (let r = row + step; r >= 0 && r <= 7; r += step) {
      if (sq[(r << 3) | f] === enemyPawn) return false;
    }
  }
  return true;
}

function isPawnProtected(sq: Int8Array, s: number, color: ColorCode): boolean {
  const file = colOf(s);
  const row = rowOf(s);
  const behind = color === WHITE ? row + 1 : row - 1;
  if (behind < 0 || behind > 7) return false;

  const ownPawn = (color << 3) | PAWN;
  if (file > 0 && sq[(behind << 3) | (file - 1)] === ownPawn) return true;
  if (file < 7 && sq[(behind << 3) | (file + 1)] === ownPawn) return true;
  return false;
}

// ---------------------------------------------------------------------------
// King safety
// ---------------------------------------------------------------------------

/**
 * Penalty (returned as a bonus for `color`, i.e. negative when unsafe) built
 * from three parts: a missing pawn shield, open files beside the king, and how
 * many enemy pieces attack the ring of squares around it. The attacker term
 * runs through a non-linear table because danger scales far faster than the
 * number of attackers.
 */
function kingSafetyTerm(pos: Position, color: ColorCode): number {
  const sq = pos.squares;
  const kingSq = pos.kingSquare[color];
  if (kingSq < 0) return 0;

  const kr = rowOf(kingSq);
  const kc = colOf(kingSq);
  let penalty = 0;

  // --- Pawn shield and open files on the king's file and its neighbours ---
  const shieldRow = color === WHITE ? kr - 1 : kr + 1;
  const ownPawn = (color << 3) | PAWN;

  for (let f = Math.max(0, kc - 1); f <= Math.min(7, kc + 1); f++) {
    let sheltered = false;
    if (shieldRow >= 0 && shieldRow <= 7 && sq[(shieldRow << 3) | f] === ownPawn) {
      sheltered = true;
    }
    if (!sheltered) penalty += 12;

    if (pawnsOnFile[color * 8 + f] === 0) {
      penalty += pawnsOnFile[(color ^ 1) * 8 + f] === 0 ? 20 : 10;
    }
  }

  // --- Attackers on the king ring ----------------------------------------
  let attackWeight = 0;
  const enemy = (color ^ 1) as ColorCode;

  for (const [dr, dc] of KING_DIRS) {
    const r = kr + dr;
    const c = kc + dc;
    if (r < 0 || r > 7 || c < 0 || c > 7) continue;
    const ring = (r << 3) | c;
    if (!pos.isSquareAttacked(ring, enemy)) continue;

    // Charge by the heaviest enemy piece that can reach this square, which is
    // cheap to approximate by scanning the enemy's remaining material once.
    attackWeight += 10;
  }

  // Scale by the enemy's attacking material - two attackers with a queen on
  // the board are far more dangerous than two in a queenless middlegame.
  let heavy = 0;
  for (let s = 0; s < 64; s++) {
    const p = sq[s];
    if (p === 0 || pieceColor(p) !== enemy) continue;
    const t = pieceType(p);
    if (t === PAWN || t === KING) continue;
    if (KING_DISTANCE[kingSq * 64 + s] <= 4) heavy += KING_ATTACK_WEIGHT[t] / 20;
  }

  const index = Math.min(
    KING_SAFETY_TABLE.length - 1,
    Math.round(attackWeight * 0.4 + heavy * 2),
  );
  penalty += KING_SAFETY_TABLE[index];

  return -penalty;
}

// ---------------------------------------------------------------------------
// Endgame knowledge
// ---------------------------------------------------------------------------

/**
 * Two jobs:
 *  1. Scale down positions that are materially unbalanced but still drawn -
 *     otherwise the engine happily trades into K+B vs K thinking it is winning.
 *  2. Add a mating drive for K+Q and K+R endings. Without a term that rewards
 *     shrinking the defending king's space, a material-only engine shuffles
 *     forever and never actually delivers mate.
 */
function applyEndgameKnowledge(pos: Position, score: number, phase: number): number {
  // Only relevant once the board has emptied out.
  if (phase > 8) return score;

  const sq = pos.squares;
  let pawnsW = 0, pawnsB = 0;
  let knightsW = 0, knightsB = 0;
  let bishopsW = 0, bishopsB = 0;
  let rooksW = 0, rooksB = 0;
  let queensW = 0, queensB = 0;
  let bishopColorW = -1, bishopColorB = -1;

  for (let s = 0; s < 64; s++) {
    const p = sq[s];
    if (p === 0) continue;
    const t = pieceType(p);
    const white = pieceColor(p) === WHITE;
    switch (t) {
      case PAWN: white ? pawnsW++ : pawnsB++; break;
      case KNIGHT: white ? knightsW++ : knightsB++; break;
      case BISHOP:
        if (white) { bishopsW++; bishopColorW = (rowOf(s) + colOf(s)) & 1; }
        else { bishopsB++; bishopColorB = (rowOf(s) + colOf(s)) & 1; }
        break;
      case ROOK: white ? rooksW++ : rooksB++; break;
      case QUEEN: white ? queensW++ : queensB++; break;
    }
  }

  const minorsW = knightsW + bishopsW;
  const minorsB = knightsB + bishopsB;
  const heavyW = rooksW + queensW;
  const heavyB = rooksB + queensB;

  // K + one minor vs K (+ minor) with no pawns cannot be won.
  if (pawnsW === 0 && pawnsB === 0 && heavyW === 0 && heavyB === 0 &&
      minorsW <= 1 && minorsB <= 1) {
    return 0;
  }

  // Opposite-coloured bishops with no other pieces are extremely drawish.
  if (bishopsW === 1 && bishopsB === 1 && knightsW === 0 && knightsB === 0 &&
      heavyW === 0 && heavyB === 0 &&
      bishopColorW >= 0 && bishopColorB >= 0 && bishopColorW !== bishopColorB) {
    score *= 0.35;
  }

  // --- Mating drive -------------------------------------------------------
  // Only when one side has mating material and the other is bare.
  const winner: ColorCode | null =
    (heavyW > 0 && minorsB + heavyB === 0 && pawnsB === 0) ? WHITE
    : (heavyB > 0 && minorsW + heavyW === 0 && pawnsW === 0) ? BLACK
    : null;

  if (winner !== null) {
    const loser = (winner ^ 1) as ColorCode;
    const loserKing = pos.kingSquare[loser];
    const winnerKing = pos.kingSquare[winner];
    if (loserKing >= 0 && winnerKing >= 0) {
      // Push the defender towards a corner, and bring our own king close.
      const drive = CORNER_DISTANCE[loserKing] * 10
        + (7 - KING_DISTANCE[winnerKing * 64 + loserKing]) * 8;
      score += winner === WHITE ? drive : -drive;
    }
  }

  return score;
}
