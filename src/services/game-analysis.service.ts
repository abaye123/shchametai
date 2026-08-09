import { Injectable, computed, signal } from '@angular/core';
import {
  emptyCounts,
  type GameAssessment,
  type MoveAssessment,
  type MoveQuality,
} from '../engine/analysis.ts';
import { analyzeGame } from '../engine/analyze-entry.ts';
import { STARTING_FEN } from '../engine/types.ts';
import type { AnalyzeRequest, EngineResponse } from '../engine/worker-protocol.ts';

/** How hard to think per position. */
export type AnalysisDepth = 'quick' | 'standard' | 'deep';

const DEPTH_SETTINGS: Record<AnalysisDepth, { msPerMove: number; maxDepth: number }> = {
  quick: { msPerMove: 120, maxDepth: 8 },
  standard: { msPerMove: 300, maxDepth: 12 },
  deep: { msPerMove: 900, maxDepth: 16 },
};

/**
 * Scores every move of a game.
 *
 * This runs in its own Web Worker rather than sharing the opponent's, because a
 * full-game analysis occupies a core for tens of seconds. Sharing would mean the
 * computer could not move while a review was running, and cancelling a review to
 * make a move would throw away all the work.
 */
@Injectable({
  providedIn: 'root',
})
export class GameAnalysisService {
  private worker: Worker | null = null;
  private workerFailed = false;
  private nextId = 1;
  private activeId = 0;

  /** Assessment per ply, keyed by move index. Empty until a review is run. */
  byPly = signal<Map<number, MoveAssessment>>(new Map());

  assessment = signal<GameAssessment | null>(null);
  isRunning = signal<boolean>(false);
  progress = signal<{ done: number; total: number }>({ done: 0, total: 0 });
  error = signal<string>('');

  progressPercent = computed(() => {
    const { done, total } = this.progress();
    return total === 0 ? 0 : Math.round((done / total) * 100);
  });

  /** True once there is something to show. */
  hasResults = computed(() => this.byPly().size > 0);

  /**
   * Analyses a game given as UCI moves. Safe to call again while one is
   * running - the previous run is cancelled first.
   */
  async analyze(history: string[], depth: AnalysisDepth = 'standard'): Promise<void> {
    if (history.length === 0) return;

    this.cancel();

    const settings = DEPTH_SETTINGS[depth];
    const request: AnalyzeRequest = {
      type: 'analyze',
      id: this.nextId++,
      startFen: STARTING_FEN,
      history,
      msPerMove: settings.msPerMove,
      maxDepth: settings.maxDepth,
    };

    this.activeId = request.id;
    this.isRunning.set(true);
    this.error.set('');
    this.progress.set({ done: 0, total: history.length });
    this.byPly.set(new Map());
    this.assessment.set(null);

    const worker = this.ensureWorker();

    if (!worker) {
      // No worker: run inline. This does block the UI, so it uses the cheapest
      // setting available rather than whatever was asked for.
      try {
        const result = analyzeGame({
          startFen: request.startFen,
          history,
          msPerMove: DEPTH_SETTINGS.quick.msPerMove,
          maxDepth: DEPTH_SETTINGS.quick.maxDepth,
          shouldAbort: () => this.activeId !== request.id,
        });
        this.applyResult(result);
      } catch (e) {
        this.error.set(e instanceof Error ? e.message : String(e));
      } finally {
        this.isRunning.set(false);
      }
      return;
    }

    return new Promise<void>(resolve => {
      const onMessage = (ev: MessageEvent<EngineResponse>) => {
        const data = ev.data;
        if (!data || data.id !== request.id) return;

        if (data.type === 'analysis-progress') {
          this.progress.set({ done: data.done, total: data.total });
          this.byPly.update(map => {
            const next = new Map(map);
            next.set(data.move.ply, data.move);
            return next;
          });
          return;
        }

        if (data.type === 'analysis-done') {
          this.applyResult(data.assessment);
          finish();
          return;
        }

        if (data.type === 'error') {
          this.error.set(data.message);
          finish();
        }
      };

      const onError = (ev: ErrorEvent) => {
        this.error.set(ev.message || 'analysis worker error');
        this.disposeWorker();
        this.workerFailed = true;
        finish();
      };

      const finish = () => {
        worker.removeEventListener('message', onMessage as EventListener);
        worker.removeEventListener('error', onError as EventListener);
        this.isRunning.set(false);
        resolve();
      };

      worker.addEventListener('message', onMessage as EventListener);
      worker.addEventListener('error', onError as EventListener);
      worker.postMessage(request);
    });
  }

  cancel(): void {
    if (!this.isRunning()) return;
    this.worker?.postMessage({ type: 'cancel', id: this.activeId });
    this.activeId = 0;
    this.isRunning.set(false);
  }

  /** Drops the current review, e.g. when a new game starts. */
  reset(): void {
    this.cancel();
    this.byPly.set(new Map());
    this.assessment.set(null);
    this.progress.set({ done: 0, total: 0 });
    this.error.set('');
  }

  countsFor(color: 'w' | 'b'): Record<MoveQuality, number> {
    const a = this.assessment();
    if (!a) return emptyCounts();
    return color === 'w' ? a.white.counts : a.black.counts;
  }

  private applyResult(result: GameAssessment) {
    this.assessment.set(result);
    const map = new Map<number, MoveAssessment>();
    for (const m of result.moves) map.set(m.ply, m);
    this.byPly.set(map);
    this.progress.set({ done: result.moves.length, total: result.moves.length });
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (this.workerFailed || typeof Worker === 'undefined') return null;

    try {
      this.worker = new Worker(
        new URL('../engine/engine.worker', import.meta.url),
        { type: 'module' },
      );
      return this.worker;
    } catch (e) {
      console.warn('Analysis worker unavailable, reviewing on the main thread.', e);
      this.workerFailed = true;
      return null;
    }
  }

  private disposeWorker() {
    this.worker?.terminate();
    this.worker = null;
  }
}
