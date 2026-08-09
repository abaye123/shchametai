import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../services/i18n.service';
import { GameHistoryService } from '../services/game-history.service';
import { GameMode, Difficulty } from '../models/app.types';

@Component({
  selector: 'app-welcome-screen',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; }
  `],
  template: `
    <div class="screen-scroll">
      <main class="mx-auto w-full max-w-xl px-4 py-6 sm:py-8">
        <div class="card card-pad rounded-5xl shadow-lift animate-slide-up">

          <!-- Hero -->
          <div class="text-center mb-6">
            <div class="mx-auto mb-4 grid place-items-center w-24 h-24 rounded-[2rem] shadow-lift
                        bg-gradient-to-br from-honey-100 via-white to-orchid-100 border border-white">
              <img src="src/assets/logo.png" alt="" class="w-16 h-16 object-contain">
            </div>
            <h2 class="text-2xl sm:text-3xl font-bold text-sand-900 mb-1.5">{{ i18n.t().welcome }}</h2>
            <p class="text-sand-600 text-sm leading-relaxed">{{ i18n.t().welcomeMessage }}</p>
          </div>

          <!-- Game Mode -->
          <div class="mb-4">
            <label class="block text-xs font-bold text-sand-500 uppercase tracking-wide mb-2 px-1">
              {{ i18n.t().gameMode }}
            </label>
            <div class="segment">
              <button
                (click)="selectedGameMode = 'human'"
                class="segment-item"
                [class.is-active]="selectedGameMode === 'human'">
                {{ i18n.t().vsHuman }}
              </button>
              <button
                (click)="selectedGameMode = 'computer'"
                class="segment-item"
                [class.is-active]="selectedGameMode === 'computer'">
                {{ i18n.t().vsComputer }}
              </button>
            </div>
          </div>

          @if (selectedGameMode === 'computer') {
            <!-- Difficulty -->
            <div class="mb-4 animate-slide-up">
              <label class="block text-xs font-bold text-sand-500 uppercase tracking-wide mb-2 px-1">
                {{ i18n.t().difficulty }}
              </label>
              <div class="segment">
                <button (click)="selectedDifficulty = 'easy'" class="segment-item"
                        [class.is-active]="selectedDifficulty === 'easy'">{{ i18n.t().easy }}</button>
                <button (click)="selectedDifficulty = 'medium'" class="segment-item"
                        [class.is-active]="selectedDifficulty === 'medium'">{{ i18n.t().medium }}</button>
                <button (click)="selectedDifficulty = 'hard'" class="segment-item"
                        [class.is-active]="selectedDifficulty === 'hard'">{{ i18n.t().hard }}</button>
              </div>
            </div>

            <!-- Player Colour -->
            <div class="mb-5 animate-slide-up">
              <label class="block text-xs font-bold text-sand-500 uppercase tracking-wide mb-2 px-1">
                {{ i18n.currentLang() === 'he' ? 'בחר צבע' : 'Choose Colour' }}
              </label>
              <div class="segment">
                <button (click)="selectedPlayerColor = 'w'" class="segment-item"
                        [class.is-active]="selectedPlayerColor === 'w'">
                  <span class="grid place-items-center w-6 h-6 rounded-lg bg-white border border-sand-300 text-sand-800 text-sm">♚</span>
                  {{ i18n.t().white }}
                </button>
                <button (click)="selectedPlayerColor = 'b'" class="segment-item"
                        [class.is-active]="selectedPlayerColor === 'b'">
                  <span class="grid place-items-center w-6 h-6 rounded-lg bg-sand-800 text-white text-sm">♚</span>
                  {{ i18n.t().black }}
                </button>
              </div>
            </div>
          }

          <!-- Actions -->
          <div class="flex flex-col gap-2.5">
            <button (click)="onStartNewGame()" class="btn-primary btn-lg w-full">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="size-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              {{ i18n.t().newGame }}
            </button>

            <button (click)="onGoToHistory()" class="btn-accent btn-lg w-full">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="size-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {{ i18n.t().viewHistory }}
              @if (history.savedGames().length) {
                <span class="chip bg-white/25 text-white">{{ history.savedGames().length }}</span>
              }
            </button>
          </div>

          <!-- Auto Save -->
          <div class="mt-5 card-flat p-4 flex items-center justify-between gap-3">
            <span class="text-sm font-medium text-sand-700">{{ i18n.t().autoSave }}</span>
            <button
              (click)="history.toggleAutoSave()"
              class="btn btn-sm"
              [class.btn-success]="history.autoSave()"
              [class.btn-soft]="!history.autoSave()">
              {{ history.autoSave() ? i18n.t().autoSaveOn : i18n.t().autoSaveOff }}
            </button>
          </div>
        </div>

        <p class="text-center text-xs text-sand-400 mt-4">
          {{ i18n.currentLang() === 'he' ? 'עובד גם ללא חיבור לאינטרנט' : 'Works fully offline' }}
        </p>
      </main>
    </div>
  `
})
export class WelcomeScreenComponent {
  i18n = inject(I18nService);
  history = inject(GameHistoryService);

  selectedGameMode: GameMode = 'human';
  selectedDifficulty: Difficulty = 'medium';
  selectedPlayerColor: 'w' | 'b' = 'w';

  startNewGame = output<{ gameMode: GameMode; difficulty: Difficulty; playerColor: 'w' | 'b' }>();
  goToHistory = output<void>();

  onStartNewGame() {
    this.startNewGame.emit({
      gameMode: this.selectedGameMode,
      difficulty: this.selectedDifficulty,
      playerColor: this.selectedPlayerColor
    });
  }

  onGoToHistory() {
    this.goToHistory.emit();
  }
}
