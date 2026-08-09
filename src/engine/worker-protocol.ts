/**
 * Message shapes exchanged with the engine Web Worker.
 *
 * The position is sent as a starting FEN plus the list of UCI moves played,
 * rather than as a single FEN of the current position. Replaying the moves
 * costs microseconds and is what lets the worker see the full repetition
 * history and probe the opening book, neither of which a bare FEN can express.
 */

import type { LevelId } from './types.ts';
import type { GameAssessment, MoveAssessment } from './analysis.ts';

export interface SearchRequest {
  type: 'search';
  /** Correlates the response with the request; stale replies are dropped. */
  id: number;
  startFen: string;
  /** UCI moves from `startFen` to the position to search. */
  history: string[];
  level: LevelId;
  seed?: number;
}

export interface AnalyzeRequest {
  type: 'analyze';
  id: number;
  startFen: string;
  /** The complete game, as UCI moves. */
  history: string[];
  /** Thinking time per position. The whole run costs roughly this x plies. */
  msPerMove: number;
  maxDepth?: number;
}

export interface CancelRequest {
  type: 'cancel';
  id: number;
}

export type EngineRequest = SearchRequest | AnalyzeRequest | CancelRequest;

export interface SearchResponse {
  type: 'result';
  id: number;
  /** UCI move, or '' when the position is terminal. */
  uci: string;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
  fromBook: boolean;
}

/** Emitted after each move is scored, so the UI can show a progress bar. */
export interface AnalysisProgressResponse {
  type: 'analysis-progress';
  id: number;
  done: number;
  total: number;
  move: MoveAssessment;
}

export interface AnalysisDoneResponse {
  type: 'analysis-done';
  id: number;
  assessment: GameAssessment;
  timeMs: number;
}

export interface ErrorResponse {
  type: 'error';
  id: number;
  message: string;
}

export type EngineResponse =
  | SearchResponse
  | AnalysisProgressResponse
  | AnalysisDoneResponse
  | ErrorResponse;
