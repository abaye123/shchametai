/**
 * Negamax search with alpha-beta, iterative deepening, a transposition table,
 * quiescence search and staged move ordering.
 *
 * Design notes worth knowing before editing:
 *
 * - Scores are ALWAYS from the side to move's point of view. `evaluate` follows
 *   the same convention, which is what makes the single negamax recursion valid
 *   in place of a duplicated max/min pair.
 *
 * - Move ordering is where most of the strength lives, not raw depth. Alpha-beta
 *   only reaches its best case when the best move is searched first, so the
 *   order below (TT move, then winning captures by MVV-LVA, then killers, then
 *   history) matters more than any single pruning trick. The previous engine
 *   deliberately *shuffled* the root moves, which is the worst possible order.
 *
 * - Search variety comes from the level's blunder settings at the root, never
 *   from randomising the ordering.
 *
 * - Nothing allocates inside the recursion. Move lists live in one flat
 *   preallocated buffer indexed by ply.
 */

import { Position } from './position.ts';
import { generateCaptures, generateMoves } from './movegen.ts';
import { evaluate } from './eval.ts';
import { createRng } from './rng.ts';
import {
  DRAW_SCORE,
  INFINITY,
  MATE_SCORE,
  MATE_THRESHOLD,
  MAX_MOVES,
  MAX_PLY,
  PAWN,
  PIECE_VALUE,
  QUEEN,
  moveFrom,
  moveIsCapture,
  moveIsEnPassant,
  moveIsPromotion,
  movePromotion,
  moveTo,
  pieceType,
  type PackedMove,
  type SearchLimits,
  type SearchResult,
} from './types.ts';

// ---------------------------------------------------------------------------
// Transposition table
// ---------------------------------------------------------------------------

const TT_EXACT = 0;
const TT_LOWER = 1; // fail-high: the true score is at least `score`
const TT_UPPER = 2; // fail-low:  the true score is at most `score`

/** 2^20 entries ~= 16 MB across the four arrays. */
const TT_BITS = 20;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;

class TranspositionTable {
  private readonly keys = new Int32Array(TT_SIZE);
  private readonly moves = new Int32Array(TT_SIZE);
  private readonly scores = new Int32Array(TT_SIZE);
  /** depth in the low 8 bits, flag in bits 8-9, generation in bits 10+ */
  private readonly meta = new Int32Array(TT_SIZE);
  private generation = 0;
  /** Slot 0 is never a valid stored key, so an all-zero table reads as empty. */
  private used = false;

  newSearch(): void {
    this.generation = (this.generation + 1) & 0x3fffff;
  }

  clear(): void {
    if (!this.used) return;
    this.keys.fill(0);
    this.moves.fill(0);
    this.scores.fill(0);
    this.meta.fill(0);
    this.used = false;
  }

  probe(keyLo: number, keyHi: number, out: TTProbe): boolean {
    const i = keyLo & TT_MASK;
    if (this.keys[i] !== keyHi || (this.meta[i] === 0 && this.moves[i] === 0)) {
      return false;
    }
    const meta = this.meta[i];
    out.depth = meta & 0xff;
    out.flag = (meta >> 8) & 3;
    out.score = this.scores[i];
    out.move = this.moves[i];
    return true;
  }

  store(
    keyLo: number, keyHi: number,
    depth: number, flag: number, score: number, move: PackedMove,
  ): void {
    const i = keyLo & TT_MASK;
    const existing = this.meta[i];
    const existingDepth = existing & 0xff;
    const existingGen = existing >>> 10;

    // Depth-preferred, but always overwrite entries from an older search.
    if (this.keys[i] === keyHi && existingDepth > depth && existingGen === this.generation) {
      // Keep the deeper entry, but remember a move if we did not have one.
      if (this.moves[i] === 0 && move !== 0) this.moves[i] = move;
      return;
    }

    this.keys[i] = keyHi;
    this.moves[i] = move;
    this.scores[i] = score;
    this.meta[i] = (depth & 0xff) | ((flag & 3) << 8) | (this.generation << 10);
    this.used = true;
  }
}

interface TTProbe {
  depth: number;
  flag: number;
  score: number;
  move: PackedMove;
}

// One table shared across searches, so the engine benefits from the previous
// move's work. Cleared on a new game.
const tt = new TranspositionTable();

export function clearTranspositionTable(): void {
  tt.clear();
}

// ---------------------------------------------------------------------------
// Preallocated search state
// ---------------------------------------------------------------------------

/** Flat move buffer: ply `p` owns slots [p*MAX_MOVES, (p+1)*MAX_MOVES). */
const moveBuffer = new Int32Array(MAX_PLY * MAX_MOVES);
const scoreBuffer = new Int32Array(MAX_PLY * MAX_MOVES);

/** Two killer moves per ply - quiet moves that caused a cutoff at this depth. */
const killers = new Int32Array(MAX_PLY * 2);

/** history[piece][toSquare], incremented by depth^2 on a quiet cutoff. */
const historyTable = new Int32Array(16 * 64);

/** Principal variation, triangular table. */
const pvTable = new Int32Array(MAX_PLY * MAX_PLY);
const pvLength = new Int32Array(MAX_PLY);

const probeResult: TTProbe = { depth: 0, flag: 0, score: 0, move: 0 };

// ---------------------------------------------------------------------------
// Search context
// ---------------------------------------------------------------------------

interface Ctx {
  pos: Position;
  limits: SearchLimits;
  deadline: number;
  nodes: number;
  aborted: boolean;
  useTT: boolean;
}

/** Checked every 2048 nodes so a long search stays responsive to the budget. */
function outOfTime(ctx: Ctx): boolean {
  if (ctx.aborted) return true;
  if ((ctx.nodes & 2047) === 0 && Date.now() >= ctx.deadline) {
    ctx.aborted = true;
  }
  return ctx.aborted;
}

// ---------------------------------------------------------------------------
// Move ordering
// ---------------------------------------------------------------------------

/**
 * MVV-LVA: prefer capturing a valuable victim with a cheap attacker.
 * Multiplying the victim by 16 guarantees victim value dominates attacker value,
 * so PxQ always sorts above QxP.
 */
function mvvLva(pos: Position, move: PackedMove): number {
  const victim = moveIsEnPassant(move)
    ? PAWN
    : pieceType(pos.squares[moveTo(move)]);
  const attacker = pieceType(pos.squares[moveFrom(move)]);
  return PIECE_VALUE[victim] * 16 - PIECE_VALUE[attacker];
}

const SCORE_TT = 2_000_000;
const SCORE_PROMO = 1_500_000;
const SCORE_CAPTURE = 1_000_000;
const SCORE_KILLER_1 = 900_000;
const SCORE_KILLER_2 = 800_000;

function scoreMoves(
  ctx: Ctx, base: number, count: number, ttMove: PackedMove, ply: number,
): void {
  const pos = ctx.pos;
  const k1 = killers[ply * 2];
  const k2 = killers[ply * 2 + 1];

  for (let i = base; i < base + count; i++) {
    const m = moveBuffer[i];
    let s: number;

    if (ttMove !== 0 && sameMove(m, ttMove)) {
      s = SCORE_TT;
    } else if (moveIsPromotion(m)) {
      // Queen promotions first; underpromotions are almost always noise, but
      // they still need to be searchable because they occasionally mate or
      // dodge a stalemate.
      s = SCORE_PROMO + PIECE_VALUE[movePromotion(m)] +
        (moveIsCapture(m) ? PIECE_VALUE[pieceType(pos.squares[moveTo(m)])] : 0);
    } else if (moveIsCapture(m)) {
      s = SCORE_CAPTURE + mvvLva(pos, m);
    } else if (m === k1) {
      s = SCORE_KILLER_1;
    } else if (m === k2) {
      s = SCORE_KILLER_2;
    } else {
      s = historyTable[pos.squares[moveFrom(m)] * 64 + moveTo(m)];
    }

    scoreBuffer[i] = s;
  }
}

/**
 * Selection sort, one move at a time. A full sort is wasted work because most
 * nodes cut off after the first few moves.
 */
function pickMove(base: number, count: number, index: number): PackedMove {
  const end = base + count;
  let best = index;
  for (let i = index + 1; i < end; i++) {
    if (scoreBuffer[i] > scoreBuffer[best]) best = i;
  }
  if (best !== index) {
    const tm = moveBuffer[index]; moveBuffer[index] = moveBuffer[best]; moveBuffer[best] = tm;
    const ts = scoreBuffer[index]; scoreBuffer[index] = scoreBuffer[best]; scoreBuffer[best] = ts;
  }
  return moveBuffer[index];
}

/** Compares identity, ignoring flags, since flags can differ across sources. */
function sameMove(a: PackedMove, b: PackedMove): boolean {
  return (a & 0x7fff) === (b & 0x7fff);
}

// ---------------------------------------------------------------------------
// Quiescence search
// ---------------------------------------------------------------------------

/**
 * Extends the search past the horizon along captures only, so the evaluation
 * is never taken in the middle of an exchange. Without this, an odd-depth
 * search systematically overvalues capture lines - the single biggest
 * weakness of the engine this replaces.
 */
function quiescence(ctx: Ctx, alpha: number, beta: number, ply: number): number {
  ctx.nodes++;
  if (outOfTime(ctx)) return 0;
  if (ply >= MAX_PLY - 1) return evaluate(ctx.pos, ctx.limits.features);

  const standPat = evaluate(ctx.pos, ctx.limits.features);
  if (standPat >= beta) return standPat;

  // Delta pruning: if even winning a queen for free could not raise alpha,
  // no capture in this position is worth searching.
  if (standPat + PIECE_VALUE[QUEEN] + 200 < alpha) return standPat;

  if (standPat > alpha) alpha = standPat;

  const base = ply * MAX_MOVES;
  const count = generateCaptures(ctx.pos, moveBuffer, base) - base;
  scoreMoves(ctx, base, count, 0, ply);

  let best = standPat;

  for (let i = 0; i < count; i++) {
    const move = pickMove(base, count, base + i);

    // Skip obviously losing captures once we are not in trouble.
    if (!moveIsPromotion(move)) {
      const victim = moveIsEnPassant(move) ? PAWN : pieceType(ctx.pos.squares[moveTo(move)]);
      if (standPat + PIECE_VALUE[victim] + 200 < alpha) continue;
    }

    if (!ctx.pos.makeMove(move)) continue;
    const score = -quiescence(ctx, -beta, -alpha, ply + 1);
    ctx.pos.unmakeMove();

    if (ctx.aborted) return 0;

    if (score > best) {
      best = score;
      if (score > alpha) {
        alpha = score;
        if (alpha >= beta) break;
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Main search
// ---------------------------------------------------------------------------

function negamax(
  ctx: Ctx, depth: number, alpha: number, beta: number, ply: number, allowNull: boolean,
): number {
  pvLength[ply] = ply;

  if (outOfTime(ctx)) return 0;

  const pos = ctx.pos;
  const isRoot = ply === 0;
  const isPv = beta - alpha > 1;

  // A repetition or the fifty-move rule is a draw regardless of material, and
  // detecting it here stops the engine from shuffling forever in a won game.
  if (!isRoot && (pos.repetitionCount() >= 2 || pos.halfmoveClock >= 100 ||
                  pos.isInsufficientMaterial())) {
    return DRAW_SCORE;
  }

  // Hard ply ceiling. Without it a perpetual-check line would extend forever
  // below and never unwind, since the check extension cancels the depth
  // decrement on every ply.
  if (ply >= MAX_PLY - 2) return evaluate(pos, ctx.limits.features);

  const inCheck = pos.inCheck();

  // Never evaluate while in check - the position is far too volatile.
  if (inCheck) depth++;

  if (depth <= 0) {
    return ctx.limits.quiescence
      ? quiescence(ctx, alpha, beta, ply)
      : evaluate(pos, ctx.limits.features);
  }

  ctx.nodes++;

  // --- Transposition probe ---
  let ttMove: PackedMove = 0;
  if (ctx.useTT && tt.probe(pos.keyLo, pos.keyHi, probeResult)) {
    ttMove = probeResult.move;
    if (!isRoot && !isPv && probeResult.depth >= depth) {
      const score = scoreFromTT(probeResult.score, ply);
      if (probeResult.flag === TT_EXACT) return score;
      if (probeResult.flag === TT_LOWER && score >= beta) return score;
      if (probeResult.flag === TT_UPPER && score <= alpha) return score;
    }
  }

  // --- Null-move pruning ---
  // Give the opponent a free move; if the position is still good enough to
  // fail high, the real move will be at least as good. Skipped in check and in
  // pawn-only endgames, where zugzwang makes "passing" a false assumption.
  if (ctx.limits.nullMovePruning && allowNull && !isPv && !inCheck &&
      depth >= 3 && pos.phase() > 0) {
    const r = depth > 6 ? 3 : 2;
    pos.makeNullMove();
    const score = -negamax(ctx, depth - r - 1, -beta, -beta + 1, ply + 1, false);
    pos.unmakeNullMove();
    if (ctx.aborted) return 0;
    if (score >= beta && score < MATE_THRESHOLD) return beta;
  }

  const base = ply * MAX_MOVES;
  const count = generateMoves(pos, moveBuffer, base) - base;
  scoreMoves(ctx, base, count, ttMove, ply);

  let bestScore = -INFINITY;
  let bestMove: PackedMove = 0;
  let legal = 0;
  const originalAlpha = alpha;

  for (let i = 0; i < count; i++) {
    const move = pickMove(base, count, base + i);

    if (!pos.makeMove(move)) continue; // left own king in check
    legal++;

    const isQuiet = !moveIsCapture(move) && !moveIsPromotion(move);
    let score: number;

    if (legal === 1) {
      score = -negamax(ctx, depth - 1, -beta, -alpha, ply + 1, true);
    } else {
      // Late move reduction: quiet moves ordered this far down are rarely best,
      // so search them shallower first and only re-search if one surprises us.
      let reduction = 0;
      if (depth >= 3 && legal > 3 && isQuiet && !inCheck) {
        reduction = legal > 6 ? 2 : 1;
        if (isPv && reduction > 1) reduction = 1;
      }

      score = -negamax(ctx, depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, true);

      if (score > alpha && reduction > 0) {
        score = -negamax(ctx, depth - 1, -alpha - 1, -alpha, ply + 1, true);
      }
      if (score > alpha && score < beta) {
        score = -negamax(ctx, depth - 1, -beta, -alpha, ply + 1, true);
      }
    }

    pos.unmakeMove();
    if (ctx.aborted) return 0;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;

      if (score > alpha) {
        alpha = score;
        updatePv(ply, move);

        if (alpha >= beta) {
          if (isQuiet) {
            recordKiller(ply, move);
            const idx = pos.squares[moveFrom(move)] * 64 + moveTo(move);
            historyTable[idx] += depth * depth;
            if (historyTable[idx] > SCORE_KILLER_2) ageHistory();
          }
          break;
        }
      }
    }
  }

  // --- Terminal positions ---
  if (legal === 0) {
    // Mate scores encode distance so the engine prefers a faster mate and the
    // longest possible defence. Without this the engine cannot see that
    // delivering mate is better than any material gain.
    return inCheck ? -MATE_SCORE + ply : DRAW_SCORE;
  }

  if (ctx.useTT && !ctx.aborted) {
    const flag = bestScore >= beta ? TT_LOWER
      : bestScore > originalAlpha ? TT_EXACT
      : TT_UPPER;
    tt.store(pos.keyLo, pos.keyHi, depth, flag, scoreToTT(bestScore, ply), bestMove);
  }

  return bestScore;
}

/**
 * Mate scores are relative to the root, but a TT entry may be probed at a
 * different ply. Store distance-from-this-node and convert back on probe, or
 * the table corrupts every mate distance it touches.
 */
function scoreToTT(score: number, ply: number): number {
  if (score > MATE_THRESHOLD) return score + ply;
  if (score < -MATE_THRESHOLD) return score - ply;
  return score;
}

function scoreFromTT(score: number, ply: number): number {
  if (score > MATE_THRESHOLD) return score - ply;
  if (score < -MATE_THRESHOLD) return score + ply;
  return score;
}

function recordKiller(ply: number, move: PackedMove): void {
  const i = ply * 2;
  if (killers[i] !== move) {
    killers[i + 1] = killers[i];
    killers[i] = move;
  }
}

/** Halves every entry so old cutoffs stop dominating fresh information. */
function ageHistory(): void {
  for (let i = 0; i < historyTable.length; i++) historyTable[i] >>= 1;
}

function updatePv(ply: number, move: PackedMove): void {
  pvTable[ply * MAX_PLY + ply] = move;
  for (let i = ply + 1; i < pvLength[ply + 1]; i++) {
    pvTable[ply * MAX_PLY + i] = pvTable[(ply + 1) * MAX_PLY + i];
  }
  pvLength[ply] = pvLength[ply + 1];
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

interface RootMove {
  move: PackedMove;
  score: number;
}

/**
 * Runs a full search of the root moves at one depth, returning every move with
 * its score. Keeping all of them is what makes the level system's deliberate
 * weakening possible: a weak level picks a plausible worse move, rather than a
 * random legal one.
 */
function searchRoot(ctx: Ctx, depth: number, rootMoves: RootMove[]): void {
  const pos = ctx.pos;
  let alpha = -INFINITY;
  const beta = INFINITY;
  let first = true;

  for (const rm of rootMoves) {
    if (!pos.makeMove(rm.move)) {
      rm.score = -INFINITY;
      continue;
    }

    let score: number;
    if (first) {
      score = -negamax(ctx, depth - 1, -beta, -alpha, 1, true);
    } else {
      score = -negamax(ctx, depth - 1, -alpha - 1, -alpha, 1, true);
      if (score > alpha) {
        score = -negamax(ctx, depth - 1, -beta, -alpha, 1, true);
      }
    }

    pos.unmakeMove();

    if (ctx.aborted) return;

    rm.score = score;
    if (score > alpha) {
      alpha = score;
      updatePv(0, rm.move);
    }
    first = false;
  }

  // Best first, so the next iteration's ordering starts from what we learned.
  rootMoves.sort((a, b) => b.score - a.score);
}

export function search(pos: Position, limits: SearchLimits): SearchResult {
  const started = Date.now();

  const ctx: Ctx = {
    pos,
    limits,
    deadline: started + Math.max(10, limits.timeBudgetMs),
    nodes: 0,
    aborted: false,
    useTT: limits.transpositionTable,
  };

  killers.fill(0);
  pvLength.fill(0);
  tt.newSearch();

  // Collect the legal root moves once.
  const buf = new Int32Array(MAX_MOVES);
  const pseudoCount = generateMoves(pos, buf, 0);
  const rootMoves: RootMove[] = [];
  for (let i = 0; i < pseudoCount; i++) {
    if (pos.makeMove(buf[i])) {
      pos.unmakeMove();
      rootMoves.push({ move: buf[i], score: -INFINITY });
    }
  }

  if (rootMoves.length === 0) {
    return { bestMove: 0, score: 0, depth: 0, nodes: 0, pv: [], timeMs: Date.now() - started };
  }

  let completedDepth = 0;
  let finished: RootMove[] = rootMoves.map(rm => ({ ...rm }));

  for (let depth = 1; depth <= limits.maxDepth; depth++) {
    searchRoot(ctx, depth, rootMoves);

    if (ctx.aborted) break;

    completedDepth = depth;
    finished = rootMoves.map(rm => ({ ...rm }));

    // A forced mate is found; searching deeper cannot improve on it.
    if (Math.abs(finished[0].score) > MATE_THRESHOLD) break;

    // Do not start an iteration we have no realistic chance of finishing.
    const elapsed = Date.now() - started;
    if (elapsed > limits.timeBudgetMs * 0.5) break;
  }

  const chosen = chooseMove(finished, limits);

  const pv: PackedMove[] = [];
  if (chosen.move === finished[0].move) {
    for (let i = 0; i < pvLength[0]; i++) pv.push(pvTable[i]);
  }
  if (pv.length === 0) pv.push(chosen.move);

  return {
    bestMove: chosen.move,
    score: chosen.score,
    depth: completedDepth,
    nodes: ctx.nodes,
    pv,
    timeMs: Date.now() - started,
  };
}

/**
 * Applies the level's deliberate weakening.
 *
 * Weak levels do NOT play randomly. They play a move that is genuinely worse
 * but still comprehensible - the second- or third-best option - which is how a
 * weaker human actually errs. A uniformly random legal move instead produces
 * alien play (hanging a queen to a pawn for no reason) that reads as a bug.
 */
function chooseMove(rootMoves: RootMove[], limits: SearchLimits): RootMove {
  const best = rootMoves[0];
  if (limits.blunderRate <= 0 || rootMoves.length < 2) return best;

  const rng = createRng(limits.seed ?? (best.move * 2654435761) >>> 0);
  if (rng.next() >= limits.blunderRate) return best;

  // Never throw away a forced mate, in either direction - blundering out of a
  // mate in one is the kind of move that looks broken rather than weak.
  if (Math.abs(best.score) > MATE_THRESHOLD) return best;

  const cutoff = best.score - limits.blunderWindowCp;
  const candidates = rootMoves.filter(
    rm => rm.score >= cutoff && rm.score > -MATE_THRESHOLD,
  );
  if (candidates.length < 2) return best;

  return candidates[rng.int(candidates.length)];
}
