import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../services/i18n.service';
import { GameHistoryService } from '../services/game-history.service';
import { GameMode, Difficulty } from '../models/app.types';

@Component({
  selector: 'app-welcome-screen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-[80vh]">
      <div class="bg-white rounded-2xl shadow-xl p-8 w-full">
        <div class="text-center mb-8">
          <img src="src/assets/logo.png" alt="ShchametAI Logo" class="w-24 h-24 mx-auto mb-4">
          <h2 class="text-3xl font-bold text-amber-900 mb-2">{{ i18n.t().welcome }}</h2>
          <p class="text-stone-600">{{ i18n.t().welcomeMessage }}</p>
        </div>

        <!-- Game Settings -->
        <div class="mb-6 p-6 bg-stone-50 rounded-xl">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- Game Mode -->
            <div class="flex flex-col gap-2">
              <label class="font-semibold text-stone-700">{{ i18n.t().gameMode }}</label>
              <div class="flex gap-2">
                <button 
                  (click)="selectedGameMode = 'human'"
                  class="flex-1 py-2 rounded border transition-colors"
                  [class.bg-amber-600]="selectedGameMode === 'human'"
                  [class.text-white]="selectedGameMode === 'human'"
                  [class.bg-stone-100]="selectedGameMode !== 'human'">
                  {{ i18n.t().vsHuman }}
                </button>
                <button 
                  (click)="selectedGameMode = 'computer'"
                  class="flex-1 py-2 rounded border transition-colors"
                  [class.bg-amber-600]="selectedGameMode === 'computer'"
                  [class.text-white]="selectedGameMode === 'computer'"
                  [class.bg-stone-100]="selectedGameMode !== 'computer'">
                  {{ i18n.t().vsComputer }}
                </button>
              </div>
            </div>

            <!-- Difficulty -->
            @if (selectedGameMode === 'computer') {
              <div class="flex flex-col gap-2">
                <label class="font-semibold text-stone-700">{{ i18n.t().difficulty }}</label>
                <div class="flex gap-2">
                  <button (click)="selectedDifficulty = 'easy'" class="flex-1 py-2 rounded border text-sm" [class.bg-green-600]="selectedDifficulty === 'easy'" [class.text-white]="selectedDifficulty === 'easy'">{{ i18n.t().easy }}</button>
                  <button (click)="selectedDifficulty = 'medium'" class="flex-1 py-2 rounded border text-sm" [class.bg-yellow-600]="selectedDifficulty === 'medium'" [class.text-white]="selectedDifficulty === 'medium'">{{ i18n.t().medium }}</button>
                  <button (click)="selectedDifficulty = 'hard'" class="flex-1 py-2 rounded border text-sm" [class.bg-red-600]="selectedDifficulty === 'hard'" [class.text-white]="selectedDifficulty === 'hard'">{{ i18n.t().hard }}</button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-3">
          <button 
            (click)="onStartNewGame()"
            class="w-full py-4 bg-amber-900 text-amber-50 rounded-xl font-bold text-lg shadow-lg hover:bg-amber-800 transition-colors flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
            </svg>
            {{ i18n.t().newGame }}
          </button>

          <button 
            (click)="onGoToHistory()"
            class="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {{ i18n.t().viewHistory }}
          </button>
        </div>

        <!-- Auto Save Toggle -->
        <div class="mt-6 p-4 bg-stone-50 rounded-lg flex items-center justify-between">
          <span class="text-sm font-medium text-stone-700">{{ i18n.t().autoSave }}</span>
          <button 
            (click)="history.toggleAutoSave()"
            class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            [class.bg-green-600]="history.autoSave()"
            [class.text-white]="history.autoSave()"
            [class.bg-stone-300]="!history.autoSave()">
            {{ history.autoSave() ? i18n.t().autoSaveOn : i18n.t().autoSaveOff }}
          </button>
        </div>
      </div>
    </main>
  `
})
export class WelcomeScreenComponent {
  i18n = inject(I18nService);
  history = inject(GameHistoryService);

  selectedGameMode: GameMode = 'human';
  selectedDifficulty: Difficulty = 'medium';

  startNewGame = output<{ gameMode: GameMode; difficulty: Difficulty }>();
  goToHistory = output<void>();

  onStartNewGame() {
    this.startNewGame.emit({
      gameMode: this.selectedGameMode,
      difficulty: this.selectedDifficulty
    });
  }

  onGoToHistory() {
    this.goToHistory.emit();
  }
}
