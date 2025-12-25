import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../services/i18n.service';
import { GameMode, Difficulty } from '../models/app.types';

@Component({
  selector: 'app-settings-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-[80vh]">
      <div class="bg-white rounded-2xl shadow-xl p-8 w-full">
        <div class="text-center mb-8">
          <div class="text-6xl mb-4">⚙️</div>
          <h2 class="text-3xl font-bold text-amber-900 mb-2">{{ i18n.t().settings }}</h2>
          <p class="text-stone-600">{{ i18n.currentLang() === 'he' ? 'התאם את הגדרות המשחק' : 'Configure game settings' }}</p>
        </div>

        <!-- Game Settings -->
        <div class="mb-6 p-6 bg-stone-50 rounded-xl">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- Game Mode -->
            <div class="flex flex-col gap-2">
              <label class="font-semibold text-stone-700">{{ i18n.t().gameMode }}</label>
              <div class="flex gap-2">
                <button 
                  (click)="currentGameMode = 'human'"
                  class="flex-1 py-2 rounded border transition-colors"
                  [class.bg-amber-600]="currentGameMode === 'human'"
                  [class.text-white]="currentGameMode === 'human'"
                  [class.bg-stone-100]="currentGameMode !== 'human'">
                  {{ i18n.t().vsHuman }}
                </button>
                <button 
                  (click)="currentGameMode = 'computer'"
                  class="flex-1 py-2 rounded border transition-colors"
                  [class.bg-amber-600]="currentGameMode === 'computer'"
                  [class.text-white]="currentGameMode === 'computer'"
                  [class.bg-stone-100]="currentGameMode !== 'computer'">
                  {{ i18n.t().vsComputer }}
                </button>
              </div>
            </div>

            <!-- Difficulty -->
            @if (currentGameMode === 'computer') {
              <div class="flex flex-col gap-2">
                <label class="font-semibold text-stone-700">{{ i18n.t().difficulty }}</label>
                <div class="flex gap-2">
                  <button (click)="currentDifficulty = 'easy'" class="flex-1 py-2 rounded border text-sm" [class.bg-green-600]="currentDifficulty === 'easy'" [class.text-white]="currentDifficulty === 'easy'">{{ i18n.t().easy }}</button>
                  <button (click)="currentDifficulty = 'medium'" class="flex-1 py-2 rounded border text-sm" [class.bg-yellow-600]="currentDifficulty === 'medium'" [class.text-white]="currentDifficulty === 'medium'">{{ i18n.t().medium }}</button>
                  <button (click)="currentDifficulty = 'hard'" class="flex-1 py-2 rounded border text-sm" [class.bg-red-600]="currentDifficulty === 'hard'" [class.text-white]="currentDifficulty === 'hard'">{{ i18n.t().hard }}</button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- API Key Configuration -->
        <div class="mb-6 p-6 bg-stone-50 rounded-xl">
          <h3 class="text-lg font-bold mb-3 text-amber-900 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
            {{ i18n.t().apiKey }}
          </h3>
          <p class="text-sm text-stone-600 mb-3">{{ i18n.t().apiKeyInfo }}</p>
          
          @if (!editingApiKey) {
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <div class="flex-1 px-3 py-2 bg-white rounded border border-stone-200 text-sm font-mono">
                  {{ apiKey() ? '••••••••••••••••' : i18n.t().apiKeyPlaceholder }}
                </div>
                <button 
                  (click)="startEditingApiKey()"
                  class="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded font-medium transition-colors">
                  {{ apiKey() ? i18n.t().editApiKey : i18n.t().saveApiKey }}
                </button>
              </div>
              @if (apiKey()) {
                <button 
                  (click)="deleteApiKey()"
                  class="w-full px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded font-medium transition-colors flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  {{ i18n.t().deleteApiKey }}
                </button>
              }
            </div>
          } @else {
            <div class="flex flex-col gap-2">
              <input 
                type="text" 
                [(ngModel)]="tempApiKey"
                class="px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-indigo-500 font-mono text-sm bg-white"
                placeholder="{{ i18n.t().apiKeyPlaceholder }}"
                (keyup.enter)="saveApiKey()"
                (keyup.escape)="cancelEditApiKey()" />
              <div class="flex gap-2">
                <button 
                  (click)="saveApiKey()"
                  class="flex-1 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded font-medium transition-colors">
                  {{ i18n.t().saveApiKey }}
                </button>
                <button 
                  (click)="cancelEditApiKey()"
                  class="flex-1 px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded font-medium transition-colors">
                  {{ i18n.t().cancel }}
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-3">
          <button 
            (click)="onApplySettings()"
            class="w-full py-4 bg-amber-900 text-amber-50 rounded-xl font-bold text-lg shadow-lg hover:bg-amber-800 transition-colors flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            {{ i18n.currentLang() === 'he' ? 'החל הגדרות' : 'Apply Settings' }}
          </button>

          <button 
            (click)="onStartNewGame()"
            class="w-full py-4 bg-green-700 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-green-800 transition-colors flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
            </svg>
            {{ i18n.t().newGame }}
          </button>

          <button 
            (click)="onBack()"
            class="w-full py-4 bg-stone-200 hover:bg-stone-300 rounded-xl font-bold text-lg shadow-lg transition-colors flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {{ i18n.t().backToMenu }}
          </button>
        </div>
      </div>
    </main>
  `
})
export class SettingsScreenComponent {
  i18n = inject(I18nService);

  // Inputs
  gameMode = input.required<GameMode>();
  difficulty = input.required<Difficulty>();
  apiKey = input.required<string>();

  // Outputs
  applySettings = output<{ gameMode: GameMode; difficulty: Difficulty }>();
  startNewGame = output<{ gameMode: GameMode; difficulty: Difficulty }>();
  updateApiKey = output<string>();
  back = output<void>();

  // Local state
  currentGameMode: GameMode = 'human';
  currentDifficulty: Difficulty = 'medium';
  editingApiKey = false;
  tempApiKey = '';

  ngOnInit() {
    this.currentGameMode = this.gameMode();
    this.currentDifficulty = this.difficulty();
  }

  onApplySettings() {
    this.applySettings.emit({
      gameMode: this.currentGameMode,
      difficulty: this.currentDifficulty
    });
  }

  onStartNewGame() {
    this.startNewGame.emit({
      gameMode: this.currentGameMode,
      difficulty: this.currentDifficulty
    });
  }

  onBack() {
    this.back.emit();
  }

  startEditingApiKey() {
    this.tempApiKey = this.apiKey();
    this.editingApiKey = true;
  }

  saveApiKey() {
    const key = this.tempApiKey.trim();
    if (key) {
      this.updateApiKey.emit(key);
    }
    this.editingApiKey = false;
  }

  cancelEditApiKey() {
    this.editingApiKey = false;
    this.tempApiKey = '';
  }

  deleteApiKey() {
    if (confirm(this.i18n.currentLang() === 'he' ? 'האם אתה בטוח שברצונך למחוק את המפתח?' : 'Are you sure you want to delete the API key?')) {
      this.updateApiKey.emit('');
    }
  }
}
