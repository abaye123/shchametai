import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../services/i18n.service';
import { GameMode, LevelId, LEVELS, DEFAULT_LEVEL } from '../models/app.types';

@Component({
  selector: 'app-settings-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display: block; }

    /* The level ladder is styled once, globally, in index.css - the
       welcome screen renders the same control. */
  `],
  template: `
    <div class="screen-scroll">
      <main class="mx-auto w-full max-w-xl px-4 py-6 sm:py-8">
        <div class="card card-pad rounded-5xl animate-slide-up">

          <!-- Header -->
          <div class="text-center mb-7">
            <div class="mx-auto mb-3 grid place-items-center w-12 h-12 rounded-2xl
                        bg-sand-100 border border-sand-200 text-sand-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.03 7.03 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.397-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </div>
            <h2 class="text-2xl sm:text-3xl font-bold text-sand-900 tracking-tight mb-1">{{ i18n.t().settings }}</h2>
            <p class="text-sand-600 text-sm">
              {{ i18n.currentLang() === 'he' ? 'התאם את הגדרות המשחק' : 'Configure game settings' }}
            </p>
          </div>

          <!-- Game Mode -->
          <div class="mb-5">
            <label class="label-cap">
              {{ i18n.t().gameMode }}
            </label>
            <div class="segment">
              <button (click)="currentGameMode = 'human'" class="segment-item"
                      [class.is-active]="currentGameMode === 'human'">
                {{ i18n.t().vsHuman }}
              </button>
              <button (click)="currentGameMode = 'computer'" class="segment-item"
                      [class.is-active]="currentGameMode === 'computer'">
                {{ i18n.t().vsComputer }}
              </button>
            </div>
          </div>

          @if (currentGameMode === 'computer') {
            <div class="mb-5 animate-slide-up">
              <label id="settings-level-label" class="label-cap">
                {{ i18n.t().level }}
              </label>
              <div class="level-grid" role="group" aria-labelledby="settings-level-label">
                @for (lvl of levels; track lvl.id) {
                  <button
                    type="button"
                    (click)="currentLevel = lvl.id"
                    class="level-card"
                    [class.is-active]="currentLevel === lvl.id"
                    [attr.aria-pressed]="currentLevel === lvl.id"
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

            <div class="mb-6 animate-slide-up">
              <label class="label-cap">
                {{ i18n.currentLang() === 'he' ? 'בחר צבע' : 'Choose Colour' }}
              </label>
              <div class="segment">
                <button (click)="currentPlayerColor = 'w'" class="segment-item"
                        [class.is-active]="currentPlayerColor === 'w'">
                  <span class="grid place-items-center w-6 h-6 rounded-lg bg-white border border-sand-300 text-sand-800 text-sm">♚</span>
                  {{ i18n.t().white }}
                </button>
                <button (click)="currentPlayerColor = 'b'" class="segment-item"
                        [class.is-active]="currentPlayerColor === 'b'">
                  <span class="grid place-items-center w-6 h-6 rounded-lg bg-sand-800 text-white text-sm">♚</span>
                  {{ i18n.t().black }}
                </button>
              </div>
            </div>
          }

          <!-- API Key -->
          <div class="card-flat p-5 mb-6">
            <h3 class="section-title text-sm mb-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor" class="size-4 text-sand-500">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
              {{ i18n.t().apiKey }}
            </h3>
            <p class="text-xs text-sand-500 mb-3 leading-relaxed">{{ i18n.t().apiKeyInfo }}</p>

            @if (!editingApiKey) {
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <div class="flex-1 min-w-0 px-3.5 py-2.5 bg-white rounded-2xl border border-sand-300 text-sm font-mono truncate text-sand-500">
                    {{ apiKey() ? '••••••••••••••••' : i18n.t().apiKeyPlaceholder }}
                  </div>
                  <button (click)="startEditingApiKey()" class="btn-accent btn-sm flex-none">
                    {{ apiKey() ? i18n.t().editApiKey : i18n.t().saveApiKey }}
                  </button>
                </div>
                @if (apiKey()) {
                  <button (click)="deleteApiKey()" class="btn-danger btn-sm w-full">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="size-4">
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
                  class="field font-mono"
                  placeholder="{{ i18n.t().apiKeyPlaceholder }}"
                  (keyup.enter)="saveApiKey()"
                  (keyup.escape)="cancelEditApiKey()" />
                <div class="flex gap-2">
                  <button (click)="saveApiKey()" class="btn-accent btn-sm flex-1">{{ i18n.t().saveApiKey }}</button>
                  <button (click)="cancelEditApiKey()" class="btn-soft btn-sm flex-1">{{ i18n.t().cancel }}</button>
                </div>
              </div>
            }
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2">
            <button (click)="onApplySettings()" class="btn-primary btn-lg w-full">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {{ i18n.currentLang() === 'he' ? 'החל הגדרות' : 'Apply Settings' }}
            </button>

            <button (click)="onStartNewGame()" class="btn-success btn-lg w-full">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="size-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              {{ i18n.t().newGame }}
            </button>

            <button (click)="onBack()" class="btn-soft btn-lg w-full">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="size-5 rtl:rotate-180">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              {{ i18n.t().backToMenu }}
            </button>
          </div>
        </div>
      </main>
    </div>
  `
})
export class SettingsScreenComponent {
  i18n = inject(I18nService);

  readonly levels = LEVELS;
  readonly dots = [1, 2, 3, 4, 5, 6];

  // Inputs
  gameMode = input.required<GameMode>();
  level = input.required<LevelId>();
  apiKey = input.required<string>();

  // Outputs
  applySettings = output<{ gameMode: GameMode; level: LevelId }>();
  startNewGame = output<{ gameMode: GameMode; level: LevelId; playerColor: 'w' | 'b' }>();
  updateApiKey = output<string>();
  back = output<void>();

  // Local state
  currentGameMode: GameMode = 'human';
  currentLevel: LevelId = DEFAULT_LEVEL;
  currentPlayerColor: 'w' | 'b' = 'w';
  editingApiKey = false;
  tempApiKey = '';

  ngOnInit() {
    this.currentGameMode = this.gameMode();
    this.currentLevel = this.level();
  }

  onApplySettings() {
    this.applySettings.emit({
      gameMode: this.currentGameMode,
      level: this.currentLevel
    });
  }

  onStartNewGame() {
    this.startNewGame.emit({
      gameMode: this.currentGameMode,
      level: this.currentLevel,
      playerColor: this.currentPlayerColor
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
