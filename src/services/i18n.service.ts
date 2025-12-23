import { Injectable, signal, computed } from '@angular/core';

export type Language = 'he' | 'en';

export interface Translations {
  title: string;
  turnWhite: string;
  turnBlack: string;
  check: string;
  checkmate: string;
  stalemate: string;
  restart: string;
  undo: string;
  language: string;
  white: string;
  black: string;
  captured: string;
  aiHint: string;
  aiThinking: string;
  offline: string;
  gameMode: string;
  vsHuman: string;
  vsComputer: string;
  difficulty: string;
  easy: string;
  medium: string;
  hard: string;
  start: string;
  settings: string;
  sound: string;
}

const DICTIONARY: Record<Language, Translations> = {
  he: {
    title: 'שחמט אונליין',
    turnWhite: 'תור הלבן',
    turnBlack: 'תור השחור',
    check: 'שח!',
    checkmate: 'מט! המנצח: ',
    stalemate: 'תיקו (פט)!',
    restart: 'משחק חדש',
    undo: 'בטל מהלך',
    language: 'English',
    white: 'לבן',
    black: 'שחור',
    captured: 'כלים שנאכלו',
    aiHint: 'קבל רמז (AI)',
    aiThinking: 'חושב...',
    offline: 'מצב לא מקוון',
    gameMode: 'מצב משחק',
    vsHuman: 'נגד חבר',
    vsComputer: 'נגד מחשב',
    difficulty: 'רמת קושי',
    easy: 'קל',
    medium: 'בינוני',
    hard: 'קשה',
    start: 'התחל',
    settings: 'הגדרות',
    sound: 'צלילים'
  },
  en: {
    title: 'Chess Online',
    turnWhite: "White's Turn",
    turnBlack: "Black's Turn",
    check: 'Check!',
    checkmate: 'Checkmate! Winner: ',
    stalemate: 'Stalemate!',
    restart: 'New Game',
    undo: 'Undo',
    language: 'עברית',
    white: 'White',
    black: 'Black',
    captured: 'Captured',
    aiHint: 'Get AI Hint',
    aiThinking: 'Thinking...',
    offline: 'Offline Mode',
    gameMode: 'Game Mode',
    vsHuman: 'Vs Human',
    vsComputer: 'Vs Computer',
    difficulty: 'Difficulty',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    start: 'Start',
    settings: 'Settings',
    sound: 'Sound'
  }
};

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  currentLang = signal<Language>('he');
  
  t = computed(() => DICTIONARY[this.currentLang()]);
  dir = computed(() => this.currentLang() === 'he' ? 'rtl' : 'ltr');

  toggleLanguage() {
    this.currentLang.update(l => l === 'he' ? 'en' : 'he');
  }
}