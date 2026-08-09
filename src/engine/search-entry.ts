/**
 * The "pick a move for this game" entry point, shared by the Web Worker and by
 * the main-thread fallback.
 *
 * It lives apart from `engine.worker.ts` because that file registers a
 * `message` listener at import time. Importing it on the main thread for the
 * fallback path would attach that listener to `window`, so the reusable part
 * is here and the worker file contains only its own plumbing.
 */

import { Position } from './position.ts';
import { generateLegalMoves } from './movegen.ts';
import { search } from './search.ts';
import { bookMoveFor } from './book.ts';
import { getLevel } from './levels.ts';
import { createRng } from './rng.ts';
import { MAX_MOVES, moveToUci, type PackedMove } from './types.ts';
import type { EngineResponse, SearchRequest } from './worker-protocol.ts';

export function runSearch(msg: SearchRequest): EngineResponse {
  const started = Date.now();
  const level = getLevel(msg.level);

  // Replaying the moves rather than jumping straight to a FEN is what gives the
  // engine its repetition history and its opening-book context.
  const pos = Position.fromFen(msg.startFen);
  const buf = new Int32Array(MAX_MOVES);

  for (const uci of msg.history) {
    const move = findUciMove(pos, uci, buf);
    if (move === 0) {
      return { type: 'error', id: msg.id, message: `illegal move in history: ${uci}` };
    }
    pos.makeMove(move);
  }

  // --- Opening book ---
  if (level.openingBookPlies > 0 && msg.history.length < level.openingBookPlies) {
    const rng = createRng(msg.seed ?? (Date.now() & 0x7fffffff));
    const bookMove = bookMoveFor(pos, msg.history, level.openingBookPlies, () => rng.next());
    if (bookMove !== 0) {
      return {
        type: 'result',
        id: msg.id,
        uci: moveToUci(bookMove),
        score: 0,
        depth: 0,
        nodes: 0,
        timeMs: Date.now() - started,
        fromBook: true,
      };
    }
  }

  const result = search(pos, { ...level.limits, seed: msg.seed });

  return {
    type: 'result',
    id: msg.id,
    uci: result.bestMove === 0 ? '' : moveToUci(result.bestMove),
    score: result.score,
    depth: result.depth,
    nodes: result.nodes,
    timeMs: result.timeMs,
    fromBook: false,
  };
}

/**
 * Resolves a UCI string against the real legal move list. Going through the
 * generator rather than parsing squares directly means the flags, the castle
 * detection and the promotion piece are whatever movegen says they are, so a
 * hand-written history string can never produce a malformed move.
 */
export function findUciMove(pos: Position, uci: string, buf: Int32Array): PackedMove {
  const n = generateLegalMoves(pos, buf, 0);
  for (let i = 0; i < n; i++) {
    if (moveToUci(buf[i]) === uci) return buf[i];
  }
  // Tolerate a missing promotion suffix by defaulting to a queen.
  if (uci.length === 4) {
    for (let i = 0; i < n; i++) {
      if (moveToUci(buf[i]) === uci + 'q') return buf[i];
    }
  }
  return 0;
}
