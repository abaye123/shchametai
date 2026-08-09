// Application-wide type definitions
export type GameMode = 'human' | 'computer';

/**
 * Legacy difficulty. Kept because games already saved in localStorage store
 * one of these strings and the history screen must keep rendering them.
 * New games use LevelId instead.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** The six-step engine strength ladder. */
export type LevelId = 1 | 2 | 3 | 4 | 5 | 6;

/** Display metadata for one rung of the ladder. */
export interface LevelMeta {
  id: LevelId;
  /** Key into the i18n dictionary holding the level name. */
  nameKey: 'levelBeginner' | 'levelCasual' | 'levelImprover' | 'levelClub' | 'levelStrong' | 'levelExpert';
  /** Approximate Elo, for display only. */
  elo: number;
}

/** Source of truth for how the level ladder is presented in the UI. */
export const LEVELS: readonly LevelMeta[] = [
  { id: 1, nameKey: 'levelBeginner', elo: 400 },
  { id: 2, nameKey: 'levelCasual', elo: 800 },
  { id: 3, nameKey: 'levelImprover', elo: 1200 },
  { id: 4, nameKey: 'levelClub', elo: 1600 },
  { id: 5, nameKey: 'levelStrong', elo: 2000 },
  { id: 6, nameKey: 'levelExpert', elo: 2250 },
] as const;

export const DEFAULT_LEVEL: LevelId = 3;

/** Maps a legacy saved difficulty onto the closest rung of the new ladder. */
export const LEGACY_DIFFICULTY_TO_LEVEL: Record<Difficulty, LevelId> = {
  easy: 1,
  medium: 3,
  hard: 5,
};

export type AppScreen = 'welcome' | 'settings' | 'game' | 'history';
