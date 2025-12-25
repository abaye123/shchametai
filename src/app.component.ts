import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from './services/i18n.service';
import { ChessEngineService } from './services/chess-engine.service';
import { SoundService } from './services/sound.service';
import { GameHistoryService } from './services/game-history.service';
import { WelcomeScreenComponent } from './components/welcome-screen.component';
import { SettingsScreenComponent } from './components/settings-screen.component';
import { GameScreenComponent } from './components/game-screen.component';
import { HistoryScreenComponent } from './components/history-screen.component';
import { GameMode, Difficulty, AppScreen } from './models/app.types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    WelcomeScreenComponent,
    SettingsScreenComponent,
    GameScreenComponent,
    HistoryScreenComponent
  ],
  templateUrl: './app.component.html'
})
export class AppComponent {
  i18n = inject(I18nService);
  chess = inject(ChessEngineService);
  sound = inject(SoundService);
  history = inject(GameHistoryService);

  // App State
  currentScreen = signal<AppScreen>('welcome');

  // Game Settings
  gameMode = signal<GameMode>('human');
  difficulty = signal<Difficulty>('medium');

  // API Key management
  apiKey = signal<string>('');

  constructor() {
    // Load saved API key
    this.loadApiKey();
  }

  // Navigation
  goToWelcome() {
    this.currentScreen.set('welcome');
  }

  goToHistory() {
    this.currentScreen.set('history');
  }

  goToGame() {
    this.currentScreen.set('game');
  }

  goToSettings() {
    this.currentScreen.set('settings');
  }

  // Game Management
  startNewGame(config: { gameMode: GameMode; difficulty: Difficulty }) {
    this.gameMode.set(config.gameMode);
    this.difficulty.set(config.difficulty);

    // Start game in history service
    this.history.startNewGame(config.gameMode, config.difficulty);

    // Reset chess engine
    this.chess.resetGame();
    this.currentScreen.set('game');
  }

  applySettings(config: { gameMode: GameMode; difficulty: Difficulty }) {
    this.gameMode.set(config.gameMode);
    this.difficulty.set(config.difficulty);
    this.goToGame();
  }

  // History Screen Actions
  loadGame(gameId: string) {
    this.history.loadGameForReplay(gameId);
    this.currentScreen.set('game');
  }

  deleteGame(gameId: string) {
    this.history.deleteGame(gameId);
  }

  clearAllGames() {
    this.history.clearAllGames();
  }

  exportGames() {
    const data = this.history.exportGames();
    this.downloadJSON(data, 'shachmatai-games.json');
  }

  exportSingleGame(gameId: string) {
    const data = this.history.exportGame(gameId);
    if (data) {
      this.downloadJSON(data, `shachmatai-game-${gameId}.json`);
    }
  }

  toggleFavorite(gameId: string) {
    this.history.toggleFavorite(gameId);
  }

  importGames(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const success = this.history.importGames(content);

        if (success) {
          alert(this.i18n.currentLang() === 'he' ? 'ייבוא הצליח!' : 'Import successful!');
        } else {
          alert(this.i18n.currentLang() === 'he' ? 'שגיאה: פורמט קובץ לא תקין' : 'Error: Invalid file format');
        }
      } catch (e) {
        alert(this.i18n.currentLang() === 'he' ? 'שגיאה בקריאת הקובץ' : 'Error reading file');
      }
      // Reset input
      input.value = '';
    };

    reader.readAsText(file);
  }

  // Utility
  private downloadJSON(data: string, filename: string) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // API Key Management
  loadApiKey() {
    try {
      const saved = localStorage.getItem('gemini_api_key');
      if (saved) {
        this.apiKey.set(saved);
      }
    } catch (e) {
      console.error('Failed to load API key:', e);
    }
  }

  updateApiKey(key: string) {
    this.apiKey.set(key);
    try {
      localStorage.setItem('gemini_api_key', key);
    } catch (e) {
      console.error('Failed to save API key:', e);
    }
  }
}
