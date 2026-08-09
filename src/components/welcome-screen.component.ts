import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../services/i18n.service';
import { GameHistoryService } from '../services/game-history.service';
import { GameMode, LevelId, LEVELS, DEFAULT_LEVEL } from '../models/app.types';

@Component({
  selector: 'app-welcome-screen',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; }

    /* The level ladder itself is styled once, globally, in index.css -
       the settings screen renders the same control. */

    /* A wordmark rule: a hairline that stops at the text. Cheap, quiet,
       and it gives the hero a horizon line instead of a glowing tile. */
    .rule {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .rule::before,
    .rule::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e6ded1;
    }
  `],
  template: `
    <div class="screen-scroll">
      <main class="mx-auto w-full max-w-xl px-4 py-6 sm:py-8">
        <div class="card card-pad rounded-5xl animate-slide-up">

          <!-- Hero: the logo sits on paper, not on a glowing tile. -->
          <div class="text-center mb-7">
            <img src="src/assets/logo.png" alt="" class="mx-auto mb-4 w-20 h-20 object-contain">
            <h2 class="text-[1.75rem] sm:text-4xl font-bold text-sand-900 leading-tight tracking-tight mb-2">
              {{ i18n.t().welcome }}
            </h2>
            <p class="text-sand-600 text-sm leading-relaxed max-w-sm mx-auto">
              {{ i18n.t().welcomeMessage }}
            </p>
          </div>

          <!-- Game Mode -->
          <div class="mb-5">
            <label class="label-cap">
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
            <!-- Level ladder -->
            <div class="mb-5 animate-slide-up">
              <label id="level-label" class="label-cap">
                {{ i18n.t().level }}
              </label>
              <div class="level-grid" role="group" aria-labelledby="level-label">
                @for (lvl of levels; track lvl.id) {
                  <button
                    type="button"
                    (click)="selectedLevel = lvl.id"
                    class="level-card"
                    [class.is-active]="selectedLevel === lvl.id"
                    [attr.aria-pressed]="selectedLevel === lvl.id"
                    [attr.aria-label]="i18n.t().level + ' ' + lvl.id + ' - ' + i18n.t()[lvl.nameKey] + ', ' + i18n.t().estimatedRating + ' ' + lvl.elo">
                    <span class="level-head">
                      <span class="level-badge">{{ lvl.id }}</span>
                      <span class="level-name">{{ i18n.t()[lvl.nameKey] }}</span>
                    </span>
                    <span class="chip level-elo">~{{ lvl.elo }}</span>
                    <span class="level-dots" aria-hidden="true">
                      @for (d of dots; track d) {
                        <span class="level-dot" [class.is-on]="d <= lvl.id"></span>
                      }
                    </span>
                  </button>
                }
              </div>
            </div>

            <!-- Player Colour -->
            <div class="mb-6 animate-slide-up">
              <label class="label-cap">
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
          <div class="flex flex-col gap-2">
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
                <span class="chip bg-white/15 text-white">{{ history.savedGames().length }}</span>
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

        <p class="rule text-center text-[11px] uppercase tracking-label text-sand-400 mt-6 mx-2">
          {{ i18n.currentLang() === 'he' ? 'עובד גם ללא חיבור לאינטרנט' : 'Works fully offline' }}
        </p>
      </main>
    </div>
  `
})
export class WelcomeScreenComponent {
  i18n = inject(I18nService);
  history = inject(GameHistoryService);

  readonly levels = LEVELS;
  readonly dots = [1, 2, 3, 4, 5, 6];

  selectedGameMode: GameMode = 'human';
  selectedLevel: LevelId = DEFAULT_LEVEL;
  selectedPlayerColor: 'w' | 'b' = 'w';

  startNewGame = output<{ gameMode: GameMode; level: LevelId; playerColor: 'w' | 'b' }>();
  goToHistory = output<void>();

  onStartNewGame() {
    this.startNewGame.emit({
      gameMode: this.selectedGameMode,
      level: this.selectedLevel,
      playerColor: this.selectedPlayerColor
    });
  }

  onGoToHistory() {
    this.goToHistory.emit();
  }
}
