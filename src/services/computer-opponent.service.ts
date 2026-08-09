import { Injectable, signal } from '@angular/core';
import { getLevel } from '../engine/levels.ts';
import { runSearch } from '../engine/search-entry.ts';
import { STARTING_FEN, type LevelId } from '../engine/types.ts';
import type { EngineResponse, SearchRequest } from '../engine/worker-protocol.ts';

export interface EngineMoveResult {
  /** UCI move, or '' when the position is terminal. */
  uci: string;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
  fromBook: boolean;
}

/**
 * Talks to the search engine.
 *
 * The search is a synchronous loop that can hold a core for several seconds at
 * the top levels, so it runs in a Web Worker and the UI stays at 60fps while it
 * thinks. If Worker construction fails - an unusual browser, a restrictive
 * Tauri webview, a bundler that did not emit the chunk - the service silently
 * falls back to running the identical search function on the main thread. The
 * game stays playable either way; only smoothness differs.
 */
@Injectable({
  providedIn: 'root',
})
export class ComputerOpponentService {
  private worker: Worker | null = null;
  private workerFailed = false;
  private nextRequestId = 1;

  /** Live search telemetry, for the "thinking" readout in the UI. */
  lastDepth = signal<number>(0);
  lastScore = signal<number>(0);
  lastNodes = signal<number>(0);
  lastFromBook = signal<boolean>(false);
  usingWorker = signal<boolean>(false);

  /**
   * Picks a move for the given position.
   *
   * @param history UCI moves played from the starting position. Passing the
   *   move list rather than a FEN is what lets the engine see repetitions and
   *   probe the opening book.
   */
  async getBestMove(
    history: string[],
    level: LevelId,
    seed?: number,
  ): Promise<EngineMoveResult> {
    const request: SearchRequest = {
      type: 'search',
      id: this.nextRequestId++,
      startFen: STARTING_FEN,
      history,
      level,
      seed,
    };

    let response: EngineResponse;
    try {
      response = await this.ask(request);
    } catch {
      // Worker died mid-search. Fall back for this move and every later one.
      this.disposeWorker();
      this.workerFailed = true;
      response = runSearch(request);
    }

    if (response.type !== 'result') {
      if (response.type === 'error') console.error('Engine error:', response.message);
      return { uci: '', score: 0, depth: 0, nodes: 0, timeMs: 0, fromBook: false };
    }

    this.lastDepth.set(response.depth);
    this.lastScore.set(response.score);
    this.lastNodes.set(response.nodes);
    this.lastFromBook.set(response.fromBook);

    return {
      uci: response.uci,
      score: response.score,
      depth: response.depth,
      nodes: response.nodes,
      timeMs: response.timeMs,
      fromBook: response.fromBook,
    };
  }

  /** How long this level is allowed to think, for the UI's minimum delay. */
  budgetMsFor(level: LevelId): number {
    return getLevel(level).limits.timeBudgetMs;
  }

  private ask(request: SearchRequest): Promise<EngineResponse> {
    const worker = this.ensureWorker();
    if (!worker) {
      // No worker available - run the same code synchronously.
      return Promise.resolve(runSearch(request));
    }

    return new Promise<EngineResponse>((resolve, reject) => {
      const onMessage = (ev: MessageEvent<EngineResponse>) => {
        if (ev.data?.id !== request.id) return; // a stale reply
        cleanup();
        resolve(ev.data);
      };
      const onError = (ev: ErrorEvent) => {
        cleanup();
        reject(new Error(ev.message || 'worker error'));
      };
      const cleanup = () => {
        worker.removeEventListener('message', onMessage as EventListener);
        worker.removeEventListener('error', onError as EventListener);
      };

      worker.addEventListener('message', onMessage as EventListener);
      worker.addEventListener('error', onError as EventListener);
      worker.postMessage(request);
    });
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.workerFailed || typeof Worker === 'undefined') return null;

    try {
      this.worker = new Worker(
        new URL('../engine/engine.worker', import.meta.url),
        { type: 'module' },
      );
      this.usingWorker.set(true);
      return this.worker;
    } catch (e) {
      console.warn('Engine worker unavailable, searching on the main thread.', e);
      this.workerFailed = true;
      this.usingWorker.set(false);
      return null;
    }
  }

  private disposeWorker() {
    this.worker?.terminate();
    this.worker = null;
    this.usingWorker.set(false);
  }
}
