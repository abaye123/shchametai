import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../services/i18n.service';
import { GameHistoryService } from '../services/game-history.service';
import { Difficulty, LevelId, LEVELS, LEGACY_DIFFICULTY_TO_LEVEL } from '../models/app.types';

@Component({
  selector: 'app-history-screen',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; }
  `],
  template: `
    <div class="screen-scroll">
      <main class="mx-auto w-full max-w-3xl px-4 py-5 sm:py-6">

        <!-- Header card -->
        <div class="card card-pad mb-3 animate-slide-up">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h2 class="text-xl sm:text-2xl font-bold text-sand-900 tracking-tight">{{ i18n.t().savedGames }}</h2>
            <button (click)="onBack()" class="btn-soft btn-sm flex-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="size-4 rtl:rotate-180">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              {{ i18n.t().backToMenu }}
            </button>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              (click)="onExportGames()"
              [disabled]="history.savedGames().length === 0"
              class="btn-accent btn-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="size-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              {{ i18n.t().exportGames }}
            </button>

            <label class="btn-success btn-sm cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="size-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {{ i18n.t().importGames }}
              <input type="file" accept=".json" (change)="onImportGames($event)" class="hidden" />
            </label>

            <button
              (click)="onClearAllGames()"
              [disabled]="history.savedGames().length === 0"
              class="btn-danger btn-sm ms-auto">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="size-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              {{ i18n.t().clearAll }}
            </button>
          </div>
        </div>

        <!-- Games -->
        @if (history.savedGames().length === 0) {
          <div class="card card-pad text-center py-16 animate-slide-up">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.2" stroke="currentColor" class="size-12 mx-auto mb-4 text-sand-300">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
            <p class="text-sm uppercase tracking-label text-sand-500">{{ i18n.t().noSavedGames }}</p>
          </div>
        } @else {
          <div class="flex flex-col gap-2">
            @for (game of history.savedGames(); track game.id) {
              <div class="card p-4 sm:p-5 transition-colors duration-150 hover:border-sand-300 animate-slide-up">
                <div class="flex flex-col sm:flex-row items-start gap-4">

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                      @if (game.isFavorite) {
                        <span class="text-honey-500 text-base leading-none">★</span>
                      }
                      @if (game.gameName) {
                        <span class="font-bold text-base text-sand-900 truncate max-w-[16rem]" [title]="game.gameName">
                          {{ game.gameName }}
                        </span>
                        <span class="text-sand-300">•</span>
                      }
                      <span class="font-semibold text-sm text-sand-700">
                        {{ game.playerWhite }}
                        <span class="text-sand-400 font-normal mx-0.5">{{ i18n.currentLang() === 'he' ? 'נגד' : 'vs' }}</span>
                        {{ game.playerBlack }}
                      </span>
                      <span class="chip uppercase tracking-label"
                            [class.bg-green-100]="game.result === 'white'"
                            [class.text-green-800]="game.result === 'white'"
                            [class.bg-sand-800]="game.result === 'black'"
                            [class.text-white]="game.result === 'black'"
                            [class.bg-honey-100]="game.result === 'draw'"
                            [class.text-honey-800]="game.result === 'draw'"
                            [class.bg-orchid-100]="game.result === 'ongoing'"
                            [class.text-orchid-800]="game.result === 'ongoing'">
                        {{ getResultText(game.result) }}
                      </span>
                    </div>

                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sand-500">
                      <span>{{ i18n.t().gameDate }}: {{ formatDate(game.date) }}</span>
                      <span>{{ i18n.t().totalMoves }}: {{ game.moves.length }}</span>
                      <span class="flex items-center gap-1.5">
                        {{ game.gameMode === 'computer' ? i18n.t().vsComputer : i18n.t().vsHuman }}
                        @if (game.gameMode === 'computer' && game.difficulty) {
                          <span class="chip !py-0.5" [ngClass]="getDifficultyChipClass(game.difficulty)">
                            {{ getDifficultyText(game.difficulty) }}
                          </span>
                        }
                      </span>
                    </div>
                  </div>

                  <div class="flex flex-wrap sm:flex-col gap-2 w-full sm:w-auto flex-none">
                    <button (click)="onLoadGame(game.id)" class="btn-accent btn-sm sm:w-full">
                      {{ i18n.t().loadGame }}
                    </button>
                    <button (click)="onToggleFavorite(game.id)" class="btn-soft btn-sm sm:w-full">
                      {{ game.isFavorite ? '★' : '☆' }} {{ i18n.t().favorite }}
                    </button>
                    <button (click)="onExportSingleGame(game.id)" class="btn-soft btn-sm sm:w-full">
                      {{ i18n.t().exportSingle }}
                    </button>
                    <button (click)="onDeleteGame(game.id)" class="btn-soft btn-sm sm:w-full !text-rose-700">
                      {{ i18n.t().deleteGame }}
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </main>
    </div>
  `
})
export class HistoryScreenComponent {
  i18n = inject(I18nService);
  history = inject(GameHistoryService);

  // Outputs
  loadGame = output<string>();
  deleteGame = output<string>();
  clearAllGames = output<void>();
  exportGames = output<void>();
  exportSingleGame = output<string>();
  importGames = output<Event>();
  toggleFavorite = output<string>();
  back = output<void>();

  onLoadGame(gameId: string) {
    this.loadGame.emit(gameId);
  }

  onDeleteGame(gameId: string) {
    if (confirm(this.i18n.currentLang() === 'he' ? 'למחוק משחק זה?' : 'Delete this game?')) {
      this.deleteGame.emit(gameId);
    }
  }

  onClearAllGames() {
    if (confirm(this.i18n.currentLang() === 'he' ? 'למחוק את כל המשחקים?' : 'Delete all games?')) {
      this.clearAllGames.emit();
    }
  }

  onExportGames() {
    this.exportGames.emit();
  }

  onExportSingleGame(gameId: string) {
    this.exportSingleGame.emit(gameId);
  }

  onImportGames(event: Event) {
    this.importGames.emit(event);
  }

  onToggleFavorite(gameId: string) {
    this.toggleFavorite.emit(gameId);
  }

  onBack() {
    this.back.emit();
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat(this.i18n.currentLang(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  getResultText(result: string): string {
    const lang = this.i18n.currentLang();
    switch (result) {
      case 'white': return lang === 'he' ? 'לבן ניצח' : 'White Won';
      case 'black': return lang === 'he' ? 'שחור ניצח' : 'Black Won';
      case 'draw': return lang === 'he' ? 'תיקו' : 'Draw';
      case 'ongoing': return lang === 'he' ? 'בתהליך' : 'Ongoing';
      default: return result;
    }
  }

  /**
   * Saved games may store either a legacy difficulty string
   * ('easy' | 'medium' | 'hard') or a numeric level id 1-6, so both are
   * accepted here and rendered with the current level vocabulary.
   */
  getDifficultyText(difficulty: string | number | undefined | null): string {
    if (difficulty === undefined || difficulty === null || difficulty === '') return '';

    const level = this.toLevelId(difficulty);
    if (level !== null) {
      const meta = LEVELS.find(l => l.id === level)!;
      return `${this.i18n.t().level} ${level} - ${this.i18n.t()[meta.nameKey]}`;
    }

    // Unknown value - show it verbatim rather than swallowing it.
    return String(difficulty);
  }

  getDifficultyChipClass(difficulty: string | number | undefined | null): string {
    const level = this.toLevelId(difficulty);
    if (level === null) return 'bg-sand-100 text-sand-700';
    if (level <= 2) return 'bg-green-100 text-green-700';
    if (level <= 4) return 'bg-honey-100 text-honey-800';
    return 'bg-rose-100 text-rose-700';
  }

  /** Normalises a legacy difficulty string or a numeric level onto LevelId. */
  private toLevelId(value: string | number | undefined | null): LevelId | null {
    if (value === undefined || value === null) return null;

    if (typeof value === 'string' && value in LEGACY_DIFFICULTY_TO_LEVEL) {
      return LEGACY_DIFFICULTY_TO_LEVEL[value as Difficulty];
    }

    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= 6) return n as LevelId;

    return null;
  }
}
