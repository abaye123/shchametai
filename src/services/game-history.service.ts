import { Injectable, signal } from '@angular/core';
import { Move } from './chess-engine.service';

export interface GameRecord {
  id: string;
  date: Date;
  moves: Move[];
  gameMode: 'human' | 'computer';
  difficulty?: 'easy' | 'medium' | 'hard';
  result: 'white' | 'black' | 'draw' | 'ongoing';
  playerWhite: string;
  playerBlack: string;
  gameName?: string;
  isFavorite?: boolean;
}

export interface GameState {
  currentGame: GameRecord | null;
  savedGames: GameRecord[];
  isReplayMode: boolean;
  replayIndex: number;
}

@Injectable({
  providedIn: 'root'
})
export class GameHistoryService {
  private readonly STORAGE_KEY = 'shachmatai_games';
  
  // State
  currentGame = signal<GameRecord | null>(null);
  savedGames = signal<GameRecord[]>([]);
  isReplayMode = signal<boolean>(false);
  replayIndex = signal<number>(0);
  autoSave = signal<boolean>(true);

  constructor() {
    this.loadSavedGames();
  }

  // Start a new game
  startNewGame(gameMode: 'human' | 'computer', difficulty?: 'easy' | 'medium' | 'hard', gameName?: string): string {
    const gameId = this.generateGameId();
    const newGame: GameRecord = {
      id: gameId,
      date: new Date(),
      moves: [],
      gameMode,
      difficulty,
      result: 'ongoing',
      playerWhite: gameMode === 'computer' ? 'שחקן' : 'שחקן 1',
      playerBlack: gameMode === 'computer' ? 'מחשב' : 'שחקן 2',
      gameName: gameName || undefined,
      isFavorite: false
    };
    
    this.currentGame.set(newGame);
    this.isReplayMode.set(false);
    this.replayIndex.set(0);
    return gameId;
  }

  // Record a move in the current game
  recordMove(move: Move) {
    const game = this.currentGame();
    if (!game || this.isReplayMode()) return;

    game.moves.push(move);
    this.currentGame.set({ ...game });

    // Auto-save if enabled
    if (this.autoSave()) {
      this.saveCurrentGame();
    }
  }

  // Update game result
  updateGameResult(result: 'white' | 'black' | 'draw') {
    const game = this.currentGame();
    if (!game) return;

    game.result = result;
    this.currentGame.set({ ...game });
    this.saveCurrentGame();
  }

  // Save current game to history
  saveCurrentGame() {
    const game = this.currentGame();
    if (!game || game.moves.length === 0) return;

    const saved = this.savedGames();
    const existingIndex = saved.findIndex(g => g.id === game.id);

    if (existingIndex !== -1) {
      // Update existing game
      saved[existingIndex] = { ...game };
    } else {
      // Add new game
      saved.push({ ...game });
    }

    // Sort to maintain favorites at top
    this.sortGames(saved);
    this.savedGames.set([...saved]);
    this.persistToStorage();
  }

  // Load a game for replay
  loadGameForReplay(gameId: string) {
    const saved = this.savedGames();
    const game = saved.find(g => g.id === gameId);
    
    if (game) {
      this.currentGame.set({ ...game });
      this.isReplayMode.set(true);
      this.replayIndex.set(0);
    }
  }

  // Replay navigation
  goToMove(index: number) {
    const game = this.currentGame();
    if (!game || !this.isReplayMode()) return;
    
    const maxIndex = game.moves.length;
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));
    this.replayIndex.set(clampedIndex);
  }

  nextMove() {
    this.goToMove(this.replayIndex() + 1);
  }

  previousMove() {
    this.goToMove(this.replayIndex() - 1);
  }

  goToStart() {
    this.goToMove(0);
  }

  goToEnd() {
    const game = this.currentGame();
    if (game) {
      this.goToMove(game.moves.length);
    }
  }

  // Exit replay mode and continue game
  exitReplayMode() {
    this.isReplayMode.set(false);
    const game = this.currentGame();
    if (game) {
      this.replayIndex.set(game.moves.length);
    }
  }

  // Delete a saved game
  deleteGame(gameId: string) {
    const saved = this.savedGames();
    const filtered = saved.filter(g => g.id !== gameId);
    this.savedGames.set(filtered);
    this.persistToStorage();
  }

  // Clear all saved games
  clearAllGames() {
    this.savedGames.set([]);
    this.persistToStorage();
  }

  // Export games to JSON
  exportGames(): string {
    const saved = this.savedGames();
    return JSON.stringify(saved, null, 2);
  }

  // Import games from JSON
  importGames(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString) as GameRecord[];
      
      // Validate structure
      if (!Array.isArray(imported)) return false;
      
      const valid = imported.every(game => 
        game.id && 
        game.date && 
        Array.isArray(game.moves) &&
        game.gameMode &&
        game.result
      );
      
      if (!valid) return false;

      // Convert date strings back to Date objects
      imported.forEach(game => {
        game.date = new Date(game.date);
      });

      // Merge with existing games (avoid duplicates)
      const existing = this.savedGames();
      const merged = [...imported];
      
      existing.forEach(existingGame => {
        if (!merged.some(g => g.id === existingGame.id)) {
          merged.push(existingGame);
        }
      });

      // Sort by date (newest first)
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      this.savedGames.set(merged);
      this.persistToStorage();
      return true;
    } catch (e) {
      console.error('Failed to import games:', e);
      return false;
    }
  }

  // Export single game
  exportGame(gameId: string): string | null {
    const game = this.savedGames().find(g => g.id === gameId);
    return game ? JSON.stringify([game], null, 2) : null;
  }

  // Persistence
  private persistToStorage() {
    try {
      const saved = this.savedGames();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saved));
    } catch (e) {
      console.error('Failed to save games to storage:', e);
    }
  }

  private loadSavedGames() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as GameRecord[];
        // Convert date strings back to Date objects
        parsed.forEach(game => {
          game.date = new Date(game.date);
        });
        // Sort: favorites first, then by date
        this.sortGames(parsed);
        this.savedGames.set(parsed);
      }
    } catch (e) {
      console.error('Failed to load games from storage:', e);
    }
  }

  // Sort games: favorites first, then by date (newest first)
  private sortGames(games: GameRecord[]) {
    games.sort((a, b) => {
      // Favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      // Then by date (newest first)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }

  private generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Toggle auto-save
  toggleAutoSave() {
    this.autoSave.update(v => !v);
  }

  // Update game name
  updateGameName(gameName: string) {
    const game = this.currentGame();
    if (!game) return;

    game.gameName = gameName;
    this.currentGame.set({ ...game });
    this.saveCurrentGame();
  }

  // Toggle favorite status
  toggleFavorite(gameId: string) {
    const saved = this.savedGames();
    const game = saved.find(g => g.id === gameId);
    
    if (game) {
      game.isFavorite = !game.isFavorite;
      // Re-sort to move favorites to top
      this.sortGames(saved);
      this.savedGames.set([...saved]);
      this.persistToStorage();
    }
  }

  // Toggle current game favorite
  toggleCurrentFavorite() {
    const game = this.currentGame();
    if (!game) return;

    game.isFavorite = !game.isFavorite;
    this.currentGame.set({ ...game });
    this.saveCurrentGame();
  }
}
