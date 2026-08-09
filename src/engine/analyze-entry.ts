/**
 * Whole-game analysis: replays a game and scores every move.
 *
 * The obvious implementation searches twice per move - once for "what was
 * best" and once for "what did the move actually achieve". That is wasteful,
 * because the position after move N is the position before move N+1. So this
 * walks the game once and reuses each search as both halves of the comparison,
 * costing N+1 searches for N moves instead of 2N.
 */

import { Position } from './position.ts';
import { generateLegalMoves } from './movegen.ts';
import { search } from './search.ts';
import { probeBook } from './book.ts';
import {
  MAX_MOVES,
  PIECE_VALUE,
  WHITE,
  moveIsCapture,
  moveIsEnPassant,
  moveTo,
  moveToUci,
  pieceType,
  type EvalFeatures,
  type PackedMove,
  type SearchLimits,
} from './types.ts';
import {
  accuracyFromWinDrop,
  clampEval,
  classifyMove,
  summarisePlayer,
  winPercent,
  type GameAssessment,
  type MoveAssessment,
} from './analysis.ts';

const ANALYSIS_FEATURES: EvalFeatures = {
  pst: true,
  taperedEval: true,
  mobility: true,
  kingSafety: true,
  pawnStructure: true,
  endgameKnowledge: true,
};

/** Analysis always plays at full strength - no blunders, no contempt. */
export function analysisLimits(msPerMove: number, maxDepth = 14): SearchLimits {
  return {
    maxDepth,
    timeBudgetMs: msPerMove,
    features: ANALYSIS_FEATURES,
    quiescence: true,
    transpositionTable: true,
    nullMovePruning: true,
    blunderRate: 0,
    blunderWindowCp: 0,
    contemptCp: 0,
    seed: 1,
  };
}

/** One search's worth of information about a position. */
interface Probe {
  /** Best score from the side-to-move's point of view. */
  score: number;
  bestMove: PackedMove;
  bestUci: string;
  /** How much worse the engine's second choice was. */
  secondBestGap: number;
  legalMoves: number;
  /** The opponent's best reply, used for sacrifice detection. */
  replyUci: string;
}

export interface AnalysisOptions {
  startFen: string;
  history: string[];
  msPerMove: number;
  maxDepth?: number;
  bookPlies?: number;
  /** Called after each move is scored, for progress reporting. */
  onProgress?: (done: number, total: number, assessment: MoveAssessment) => void;
  /** Returning true aborts the run and yields what has been scored so far. */
  shouldAbort?: () => boolean;
}

export function analyzeGame(options: AnalysisOptions): GameAssessment {
  const {
    startFen, history, msPerMove,
    maxDepth = 14, bookPlies = 20,
    onProgress, shouldAbort,
  } = options;

  const limits = analysisLimits(msPerMove, maxDepth);
  const pos = Position.fromFen(startFen);
  const buf = new Int32Array(MAX_MOVES);

  const assessments: MoveAssessment[] = [];
  let before = probe(pos, limits, buf);

  for (let ply = 0; ply < history.length; ply++) {
    if (shouldAbort?.()) break;

    const uci = history[ply];
    const played = findMove(pos, uci, buf);
    if (played === 0) break; // corrupt history; stop rather than guess

    const moverIsWhite = pos.turn === WHITE;
    const inBook = ply < bookPlies &&
      probeBook(history.slice(0, ply), bookPlies, () => 0) !== '';

    // Material the mover gains with this move, for sacrifice detection.
    const capturedValue = moveIsEnPassant(played)
      ? PIECE_VALUE[1]
      : moveIsCapture(played)
        ? PIECE_VALUE[pieceType(pos.squares[moveTo(played)])]
        : 0;

    pos.makeMove(played);
    const after = probe(pos, limits, buf);

    // `after.score` is from the OPPONENT's point of view now, so negating it
    // gives what the move actually achieved for the mover.
    const achieved = -after.score;
    const bestPossible = before.score;

    // Clamp before subtracting. A mate score is ~30000, so walking into mate
    // would otherwise report a "30006 centipawn loss", and one such move would
    // drag the whole game's average into nonsense. Clamping keeps the figure
    // in the range a reader can interpret while still marking it as terrible.
    const centipawnLoss = Math.max(0, clampEval(bestPossible) - clampEval(achieved));

    const drop = Math.max(0, winPercent(bestPossible) - winPercent(achieved));

    // A sacrifice: the opponent's best reply wins back more than we just took.
    const replyGain = replyCaptureValue(pos, after.bestMove);
    const isSacrifice = replyGain - capturedValue >= 200;

    const quality = classifyMove({
      inBook,
      legalMoves: before.legalMoves,
      isBest: before.bestUci === uci,
      centipawnLoss,
      winDrop: drop,
      secondBestGap: before.secondBestGap,
      isSacrifice,
      evalAfterForMover: achieved,
    });

    const assessment: MoveAssessment = {
      ply,
      uci,
      quality,
      centipawnLoss,
      accuracy: Math.round(accuracyFromWinDrop(drop) * 10) / 10,
      // Both evaluations reported from white's point of view, which is the
      // convention every evaluation bar uses.
      evalBefore: moverIsWhite ? bestPossible : -bestPossible,
      evalAfter: moverIsWhite ? achieved : -achieved,
      bestUci: before.bestUci === uci ? '' : before.bestUci,
    };

    assessments.push(assessment);
    onProgress?.(ply + 1, history.length, assessment);

    before = after;
  }

  return {
    moves: assessments,
    white: summarisePlayer(assessments.filter(a => a.ply % 2 === 0)),
    black: summarisePlayer(assessments.filter(a => a.ply % 2 === 1)),
  };
}

/**
 * Searches a position and reports what the engine thinks, including how much
 * worse its second choice was - the gap is what separates "the only move" from
 * "one of several fine moves".
 */
function probe(pos: Position, limits: SearchLimits, buf: Int32Array): Probe {
  const legalMoves = generateLegalMoves(pos, buf, 0);
  if (legalMoves === 0) {
    return { score: 0, bestMove: 0, bestUci: '', secondBestGap: 0, legalMoves: 0, replyUci: '' };
  }

  const result = search(pos, limits);
  if (result.bestMove === 0) {
    return { score: result.score, bestMove: 0, bestUci: '', secondBestGap: 0, legalMoves, replyUci: '' };
  }

  // Re-search excluding the best move to learn the gap. Only worth doing when
  // there is an alternative, and it is the same cost as one more move's search.
  let secondBestGap = 0;
  if (legalMoves > 1) {
    const second = searchExcluding(pos, limits, result.bestMove, buf);
    secondBestGap = Math.max(0, result.score - second);
  }

  return {
    score: result.score,
    bestMove: result.bestMove,
    bestUci: moveToUci(result.bestMove),
    secondBestGap,
    legalMoves,
    replyUci: result.pv.length > 1 ? moveToUci(result.pv[1]) : '',
  };
}

/**
 * The best score available when the given move is off the table. Implemented by
 * searching each alternative to a shallower depth - full depth here would double
 * the cost of the whole analysis for a number that only feeds one label.
 */
function searchExcluding(
  pos: Position, limits: SearchLimits, exclude: PackedMove, buf: Int32Array,
): number {
  const shallow: SearchLimits = {
    ...limits,
    maxDepth: Math.max(2, Math.floor(limits.maxDepth / 2)),
    timeBudgetMs: Math.max(20, Math.floor(limits.timeBudgetMs / 3)),
  };

  const moves: PackedMove[] = [];
  const n = generateLegalMoves(pos, buf, 0);
  for (let i = 0; i < n; i++) {
    if (buf[i] !== exclude) moves.push(buf[i]);
  }
  if (moves.length === 0) return -30000;

  let best = -30000;
  for (const m of moves) {
    if (!pos.makeMove(m)) continue;
    const r = search(pos, shallow);
    pos.unmakeMove();
    const score = -r.score;
    if (score > best) best = score;
  }
  return best;
}

/** Value the given reply would win, 0 when it is not a capture. */
function replyCaptureValue(pos: Position, reply: PackedMove): number {
  if (reply === 0 || !moveIsCapture(reply)) return 0;
  if (moveIsEnPassant(reply)) return PIECE_VALUE[1];
  return PIECE_VALUE[pieceType(pos.squares[moveTo(reply)])];
}

function findMove(pos: Position, uci: string, buf: Int32Array): PackedMove {
  const n = generateLegalMoves(pos, buf, 0);
  for (let i = 0; i < n; i++) {
    if (moveToUci(buf[i]) === uci) return buf[i];
  }
  if (uci.length === 4) {
    for (let i = 0; i < n; i++) {
      if (moveToUci(buf[i]) === uci + 'q') return buf[i];
    }
  }
  return 0;
}
