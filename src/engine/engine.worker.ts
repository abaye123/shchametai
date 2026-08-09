/// <reference lib="webworker" />

/**
 * Runs the search off the UI thread.
 *
 * The search is a tight synchronous loop that can occupy a core for seconds at
 * the higher levels. On the main thread that would freeze rendering, animation
 * and touch handling for the whole think time, so it lives here instead. The
 * caller keeps a plain synchronous fallback for environments without Worker
 * support, which is why nothing in `src/engine` may import Angular or the DOM.
 *
 * The actual work is in `search-entry.ts`; this file is only the message
 * plumbing, so the fallback can reuse the logic without picking up the
 * `message` listener registered below.
 */

import { runSearch } from './search-entry.ts';
import { analyzeGame } from './analyze-entry.ts';
import type { EngineRequest, EngineResponse } from './worker-protocol.ts';

/** Replies older than this belong to a superseded request. */
let currentId = 0;

/** Set when a cancel arrives for the run in progress. */
let cancelledId = -1;

self.addEventListener('message', (ev: MessageEvent<EngineRequest>) => {
  const msg = ev.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'cancel') {
    cancelledId = msg.id;
    currentId = Math.max(currentId, msg.id);
    return;
  }

  currentId = msg.id;

  try {
    if (msg.type === 'search') {
      post(runSearch(msg));
      return;
    }

    if (msg.type === 'analyze') {
      const started = Date.now();
      const assessment = analyzeGame({
        startFen: msg.startFen,
        history: msg.history,
        msPerMove: msg.msPerMove,
        maxDepth: msg.maxDepth,
        onProgress: (done, total, move) => {
          post({ type: 'analysis-progress', id: msg.id, done, total, move });
        },
        // A long analysis has to stay interruptible, otherwise leaving the
        // screen leaves a core pinned for a minute.
        shouldAbort: () => cancelledId >= msg.id,
      });
      post({
        type: 'analysis-done',
        id: msg.id,
        assessment,
        timeMs: Date.now() - started,
      });
    }
  } catch (err) {
    post({
      type: 'error',
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

function post(response: EngineResponse): void {
  // A reply for a superseded request would overwrite a fresher one.
  if (response.id < currentId) return;
  (self as unknown as Worker).postMessage(response);
}
