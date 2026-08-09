/**
 * Move classification and game accuracy.
 *
 * The scheme is the one players recognise from the big sites: every move is
 * compared against what the engine would have played, and the resulting loss
 * decides the label. Two details matter for it to be honest:
 *
 * 1. Centipawn loss alone is a bad measure once a position is already decided.
 *    Dropping from +900 to +600 is not a mistake in any meaningful sense, while
 *    dropping from +20 to -280 is losing the game. So the loss is measured in
 *    WIN PROBABILITY, not raw centipawns, using the standard logistic mapping.
 *    The centipawn figure is still reported for display, because that is what
 *    people expect to read.
 *
 * 2. Mate scores cannot be fed through that mapping directly. They are clamped
 *    to a large-but-finite evaluation first, so "mate in 3" and "mate in 8" both
 *    read as completely winning rather than as different numbers.
 */

import type { PackedMove } from './types.ts';
import { MATE_THRESHOLD } from './types.ts';

export type MoveQuality =
  | 'book'         // still in opening theory
  | 'forced'       // only legal move, no choice was made
  | 'brilliant'    // best, and a sound sacrifice
  | 'great'        // best, and clearly the only move that held
  | 'best'         // what the engine would have played
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface MoveAssessment {
  /** Index of the move in the game, 0-based. */
  ply: number;
  /** The move actually played, in UCI. */
  uci: string;
  quality: MoveQuality;
  /** Centipawn loss versus the engine's choice, clamped at 0. */
  centipawnLoss: number;
  /** Per-move accuracy, 0-100. */
  accuracy: number;
  /** Evaluation before the move, in centipawns from WHITE's point of view. */
  evalBefore: number;
  /** Evaluation after the move, in centipawns from WHITE's point of view. */
  evalAfter: number;
  /** What the engine would have played instead, UCI. Empty when it agrees. */
  bestUci: string;
}

export interface PlayerAccuracy {
  /** 0-100. */
  accuracy: number;
  moves: number;
  averageCentipawnLoss: number;
  counts: Record<MoveQuality, number>;
}

export interface GameAssessment {
  moves: MoveAssessment[];
  white: PlayerAccuracy;
  black: PlayerAccuracy;
}

// ---------------------------------------------------------------------------
// Evaluation -> win probability
// ---------------------------------------------------------------------------

/**
 * Beyond this the position is decided; treating a mate score as a huge number
 * would make every later move look like a catastrophic loss.
 */
const EVAL_CLAMP = 1500;

export function clampEval(cp: number): number {
  if (cp > MATE_THRESHOLD) return EVAL_CLAMP;
  if (cp < -MATE_THRESHOLD) return -EVAL_CLAMP;
  return Math.max(-EVAL_CLAMP, Math.min(EVAL_CLAMP, cp));
}

/**
 * The standard logistic mapping from centipawns to expected score, 0..100.
 * The constant is the widely used fit of evaluation against real game results.
 */
export function winPercent(cp: number): number {
  const c = clampEval(cp);
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/**
 * Per-move accuracy from the drop in win probability. This is the published
 * curve: an exact move scores ~100, and accuracy falls off steeply as the drop
 * grows. Clamped to 0..100 because the fit overshoots slightly at zero loss.
 */
export function accuracyFromWinDrop(drop: number): number {
  if (drop <= 0) return 100;
  const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Centipawn-loss cut-offs. These are the familiar ones. */
const T_EXCELLENT = 20;
const T_GOOD = 50;
const T_INACCURACY = 100;
const T_MISTAKE = 300;

export interface ClassifyInput {
  /** True when the position was still in the opening book. */
  inBook: boolean;
  /** Number of legal moves the player had. */
  legalMoves: number;
  /** True when the played move is the engine's first choice. */
  isBest: boolean;
  /** Centipawn loss versus the engine's choice, >= 0. */
  centipawnLoss: number;
  /** Drop in win probability caused by the move, >= 0. */
  winDrop: number;
  /**
   * How much worse the engine's SECOND choice was than its first, in
   * centipawns. A large gap means there was really only one move.
   */
  secondBestGap: number;
  /** True when the move gives up material that the opponent can just take. */
  isSacrifice: boolean;
  /** Evaluation after the move, from the mover's point of view. */
  evalAfterForMover: number;
}

export function classifyMove(input: ClassifyInput): MoveQuality {
  if (input.inBook) return 'book';
  if (input.legalMoves <= 1) return 'forced';

  if (input.isBest) {
    // A sacrifice that is still the best move, in a position that is not lost,
    // is the thing everyone means by "brilliant".
    if (input.isSacrifice && input.evalAfterForMover > -100) {
      return 'brilliant';
    }
    // The only move that held the position.
    if (input.secondBestGap >= 150) return 'great';
    return 'best';
  }

  const loss = input.centipawnLoss;
  if (loss < T_EXCELLENT) return 'excellent';
  if (loss < T_GOOD) return 'good';
  if (loss < T_INACCURACY) return 'inaccuracy';
  if (loss < T_MISTAKE) return 'mistake';
  return 'blunder';
}

/** Qualities that do not represent a real decision, so they skip the average. */
const EXCLUDED_FROM_ACCURACY: MoveQuality[] = ['book', 'forced'];

export function summarisePlayer(moves: MoveAssessment[]): PlayerAccuracy {
  const counts = emptyCounts();
  let accSum = 0;
  let cplSum = 0;
  let counted = 0;

  for (const m of moves) {
    counts[m.quality]++;
    if (EXCLUDED_FROM_ACCURACY.includes(m.quality)) continue;
    accSum += m.accuracy;
    cplSum += m.centipawnLoss;
    counted++;
  }

  return {
    accuracy: counted === 0 ? 100 : Math.round((accSum / counted) * 10) / 10,
    moves: moves.length,
    averageCentipawnLoss: counted === 0 ? 0 : Math.round(cplSum / counted),
    counts,
  };
}

export function emptyCounts(): Record<MoveQuality, number> {
  return {
    book: 0, forced: 0, brilliant: 0, great: 0, best: 0,
    excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0,
  };
}

/** Convenience for the UI: is this label a negative one? */
export function isMistakeLike(q: MoveQuality): boolean {
  return q === 'inaccuracy' || q === 'mistake' || q === 'blunder';
}

export type { PackedMove };
