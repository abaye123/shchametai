import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../services/i18n.service';
import { GameHistoryService, GameRecord } from '../services/game-history.service';

@Component({
  selector: 'app-history-screen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="max-w-4xl mx-auto p-4">
      <div class="bg-white rounded-xl shadow-lg p-6 mb-4">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-amber-900">{{ i18n.t().savedGames }}</h2>
          <button 
            (click)="onBack()"
            class="px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-lg font-medium transition-colors">
            {{ i18n.t().backToMenu }}
          </button>
        </div>

        <!-- Export/Import Actions -->
        <div class="flex flex-wrap gap-2 mb-6">
          <button 
            (click)="onExportGames()"
            [disabled]="history.savedGames().length === 0"
            class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            {{ i18n.t().exportGames }}
          </button>

          <label class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {{ i18n.t().importGames }}
            <input type="file" accept=".json" (change)="onImportGames($event)" class="hidden" />
          </label>

          <button 
            (click)="onClearAllGames()"
            [disabled]="history.savedGames().length === 0"
            class="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            {{ i18n.t().clearAll }}
          </button>
        </div>

        <!-- Games List -->
        @if (history.savedGames().length === 0) {
          <div class="text-center py-12 text-stone-500">
            <div class="text-6xl mb-4">📋</div>
            <p class="text-lg">{{ i18n.t().noSavedGames }}</p>
          </div>
        } @else {
          <div class="space-y-3">
            @for (game of history.savedGames(); track game.id) {
              <div class="border border-stone-200 rounded-lg p-4 hover:bg-stone-50 transition-colors">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      @if (game.gameName) {
                        <span class="font-bold text-lg text-amber-900">
                          {{ game.gameName }}
                        </span>
                        <span class="text-stone-400">•</span>
                      }
                      <span class="font-semibold text-base">
                        {{ game.playerWhite }} ⚔️ {{ game.playerBlack }}
                      </span>
                      <span 
                        class="px-2 py-1 rounded text-xs font-semibold"
                        [class.bg-green-100]="game.result === 'white'"
                        [class.text-green-800]="game.result === 'white'"
                        [class.bg-stone-800]="game.result === 'black'"
                        [class.text-white]="game.result === 'black'"
                        [class.bg-yellow-100]="game.result === 'draw'"
                        [class.text-yellow-800]="game.result === 'draw'"
                        [class.bg-blue-100]="game.result === 'ongoing'"
                        [class.text-blue-800]="game.result === 'ongoing'">
                        {{ getResultText(game.result) }}
                      </span>
                    </div>
                    <div class="text-sm text-stone-600 space-y-1">
                      <p>{{ i18n.t().gameDate }}: {{ formatDate(game.date) }}</p>
                      <p>{{ i18n.t().totalMoves }}: {{ game.moves.length }}</p>
                      <p>{{ i18n.t().gameMode }}: {{ game.gameMode === 'computer' ? i18n.t().vsComputer : i18n.t().vsHuman }}</p>
                    </div>
                  </div>
                  
                  <div class="flex flex-col gap-2">
                    <button 
                      (click)="onToggleFavorite(game.id)"
                      class="px-3 py-2 bg-yellow-500 text-white hover:bg-yellow-600 rounded text-sm font-semibold transition-colors whitespace-nowrap flex items-center justify-center gap-1">
                      @if (game.isFavorite) {
                        ⭐
                      } @else {
                        ☆
                      }
                      {{ i18n.t().favorite }}
                    </button>
                    <button 
                      (click)="onLoadGame(game.id)"
                      class="px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded text-sm font-semibold transition-colors whitespace-nowrap">
                      {{ i18n.t().loadGame }}
                    </button>
                    <button 
                      (click)="onExportSingleGame(game.id)"
                      class="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm font-semibold transition-colors whitespace-nowrap">
                      {{ i18n.t().exportSingle }}
                    </button>
                    <button 
                      (click)="onDeleteGame(game.id)"
                      class="px-3 py-2 bg-red-600 text-white hover:bg-red-700 rounded text-sm font-semibold transition-colors whitespace-nowrap">
                      {{ i18n.t().deleteGame }}
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </main>
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
}
