/**
 * The difficulty ladder.
 *
 * Every knob that separates a beginner opponent from an expert one lives in
 * this one table, rather than being scattered through the search as ad-hoc
 * conditionals. Adding a level means adding a row here.
 *
 * On the weak end, strength is reduced by *choosing a worse move*, never by
 * playing randomly. A random legal move produces alien play - the engine hangs
 * its queen to a pawn for no reason, which reads as broken rather than easy.
 * Instead the search scores every root move and the level's blunder settings
 * pick from the moves within `blunderWindowCp` of the best one. That looks like
 * a weaker human: the second- or third-best move, not nonsense.
 */

import type { EvalFeatures, LevelId, SearchLimits } from './types.ts';

export interface EngineLevel {
  id: LevelId;
  /** i18n key, resolved by the UI. */
  key: string;
  limits: SearchLimits;
  openingBookPlies: number;
  approxElo: number;
}

const NO_FEATURES: EvalFeatures = {
  pst: false,
  taperedEval: false,
  mobility: false,
  kingSafety: false,
  pawnStructure: false,
  endgameKnowledge: false,
};

const feat = (over: Partial<EvalFeatures>): EvalFeatures => ({ ...NO_FEATURES, ...over });

export const LEVELS: Record<LevelId, EngineLevel> = {
  1: {
    id: 1,
    key: 'levelBeginner',
    approxElo: 400,
    openingBookPlies: 0, // a weak engine that plays 16 plies of theory then
                         // collapses is a worse experience than no book at all
    limits: {
      maxDepth: 1,
      timeBudgetMs: 50,
      features: feat({}),
      quiescence: false,
      transpositionTable: false,
      nullMovePruning: false,
      blunderRate: 0.55,
      blunderWindowCp: 900,
      contemptCp: 0,
    },
  },
  2: {
    id: 2,
    key: 'levelCasual',
    approxElo: 800,
    openingBookPlies: 0,
    limits: {
      maxDepth: 2,
      timeBudgetMs: 100,
      features: feat({ pst: true }),
      quiescence: false,
      transpositionTable: false,
      nullMovePruning: false,
      blunderRate: 0.30,
      blunderWindowCp: 400,
      contemptCp: 0,
    },
  },
  3: {
    id: 3,
    key: 'levelImprover',
    approxElo: 1200,
    openingBookPlies: 4,
    limits: {
      maxDepth: 4,
      timeBudgetMs: 250,
      features: feat({ pst: true, taperedEval: true }),
      quiescence: true,
      transpositionTable: true,
      nullMovePruning: false,
      blunderRate: 0.12,
      blunderWindowCp: 200,
      contemptCp: 0,
    },
  },
  4: {
    id: 4,
    key: 'levelClub',
    approxElo: 1600,
    openingBookPlies: 10,
    limits: {
      maxDepth: 6,
      timeBudgetMs: 800,
      features: feat({ pst: true, taperedEval: true, mobility: true, pawnStructure: true }),
      quiescence: true,
      transpositionTable: true,
      nullMovePruning: false,
      blunderRate: 0.04,
      blunderWindowCp: 100,
      contemptCp: 0,
    },
  },
  5: {
    id: 5,
    key: 'levelStrong',
    approxElo: 2000,
    openingBookPlies: 16,
    limits: {
      maxDepth: 10,
      timeBudgetMs: 2500,
      features: feat({
        pst: true, taperedEval: true, mobility: true,
        pawnStructure: true, kingSafety: true, endgameKnowledge: true,
      }),
      quiescence: true,
      transpositionTable: true,
      nullMovePruning: true,
      blunderRate: 0.01,
      blunderWindowCp: 50,
      contemptCp: 10,
    },
  },
  6: {
    id: 6,
    key: 'levelExpert',
    approxElo: 2250,
    openingBookPlies: 20,
    limits: {
      maxDepth: 20,
      timeBudgetMs: 6000,
      features: feat({
        pst: true, taperedEval: true, mobility: true,
        pawnStructure: true, kingSafety: true, endgameKnowledge: true,
      }),
      quiescence: true,
      transpositionTable: true,
      nullMovePruning: true,
      blunderRate: 0,
      blunderWindowCp: 0,
      contemptCp: 20,
    },
  },
};

export const LEVEL_IDS: LevelId[] = [1, 2, 3, 4, 5, 6];

export const DEFAULT_LEVEL: LevelId = 3;

export function getLevel(id: LevelId): EngineLevel {
  return LEVELS[id] ?? LEVELS[DEFAULT_LEVEL];
}

/**
 * Saved games from before the ladder existed store 'easy' | 'medium' | 'hard'.
 * Map them onto the nearest new level so old history still renders and can be
 * replayed without a migration step.
 */
export function levelFromLegacyDifficulty(d: string | number | undefined | null): LevelId {
  if (typeof d === 'number' && d >= 1 && d <= 6) return d as LevelId;
  switch (d) {
    case 'easy': return 1;
    case 'medium': return 3;
    case 'hard': return 5;
    default: return DEFAULT_LEVEL;
  }
}

/** Inverse mapping, so new games still write a legacy-readable label. */
export function legacyDifficultyFromLevel(id: LevelId): 'easy' | 'medium' | 'hard' {
  if (id <= 2) return 'easy';
  if (id <= 4) return 'medium';
  return 'hard';
}
