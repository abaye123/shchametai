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
  // New translations for history/replay
  welcome: string;
  welcomeMessage: string;
  newGame: string;
  history: string;
  viewHistory: string;
  savedGames: string;
  noSavedGames: string;
  loadGame: string;
  deleteGame: string;
  clearAll: string;
  exportGames: string;
  importGames: string;
  exportSingle: string;
  autoSave: string;
  autoSaveOn: string;
  autoSaveOff: string;
  replayMode: string;
  exitReplay: string;
  firstMove: string;
  previousMove: string;
  nextMove: string;
  lastMove: string;
  moveNumber: string;
  totalMoves: string;
  gameResult: string;
  gameDate: string;
  players: string;
  backToMenu: string;
  continueGame: string;
  gameName: string;
  editName: string;
  saveName: string;
  cancel: string;
  favorite: string;
  addToFavorites: string;
  removeFromFavorites: string;
  moveHistory: string;
  showMoves: string;
  hideMoves: string;
  apiKey: string;
  apiKeyPlaceholder: string;
  saveApiKey: string;
  editApiKey: string;
  deleteApiKey: string;
  apiKeyInfo: string;
}

const DICTIONARY: Record<Language, Translations> = {
  he: {
    title: 'שחמטאי',
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
    sound: 'צלילים',
    welcome: 'ברוכים הבאים',
    welcomeMessage: 'בחר אפשרות להתחיל',
    newGame: 'משחק חדש',
    history: 'היסטוריה',
    viewHistory: 'צפה בהיסטוריה',
    savedGames: 'משחקים שמורים',
    noSavedGames: 'אין משחקים שמורים',
    loadGame: 'טען משחק',
    deleteGame: 'מחק משחק',
    clearAll: 'מחק הכל',
    exportGames: 'ייצא משחקים',
    importGames: 'ייבא משחקים',
    exportSingle: 'ייצא משחק',
    autoSave: 'שמירה אוטומטית',
    autoSaveOn: 'שמירה אוטומטית: מופעלת',
    autoSaveOff: 'שמירה אוטומטית: כבויה',
    replayMode: 'מצב צפייה',
    exitReplay: 'חזור למשחק',
    firstMove: 'מהלך ראשון',
    previousMove: 'מהלך קודם',
    nextMove: 'מהלך הבא',
    lastMove: 'מהלך אחרון',
    moveNumber: 'מהלך',
    totalMoves: 'סה"כ מהלכים',
    gameResult: 'תוצאה',
    gameDate: 'תאריך',
    players: 'שחקנים',
    backToMenu: 'חזור לתפריט',
    continueGame: 'המשך משחק',
    gameName: 'שם המשחק',
    editName: 'ערוך שם',
    saveName: 'שמור',
    cancel: 'בטל',
    favorite: 'מועדף',
    addToFavorites: 'הוסף למועדפים',
    removeFromFavorites: 'הסר ממועדפים',
    moveHistory: 'היסטוריית מהלכים',
    showMoves: 'הצג מהלכים',
    hideMoves: 'הסתר מהלכים',
    apiKey: 'מפתח API של Gemini',
    apiKeyPlaceholder: 'הזן מפתח API',
    saveApiKey: 'שמור מפתח',
    editApiKey: 'ערוך מפתח',
    deleteApiKey: 'מחק מפתח',
    apiKeyInfo: 'מפתח API נדרש לתכונת AI Coach'
  },
  en: {
    title: 'ShchametAI',
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
    sound: 'Sound',
    welcome: 'Welcome',
    welcomeMessage: 'Choose an option to begin',
    newGame: 'New Game',
    history: 'History',
    viewHistory: 'View History',
    savedGames: 'Saved Games',
    noSavedGames: 'No saved games',
    loadGame: 'Load Game',
    deleteGame: 'Delete Game',
    clearAll: 'Clear All',
    exportGames: 'Export Games',
    importGames: 'Import Games',
    exportSingle: 'Export Game',
    autoSave: 'Auto Save',
    autoSaveOn: 'Auto Save: On',
    autoSaveOff: 'Auto Save: Off',
    replayMode: 'Replay Mode',
    exitReplay: 'Exit Replay',
    firstMove: 'First Move',
    previousMove: 'Previous',
    nextMove: 'Next',
    lastMove: 'Last Move',
    moveNumber: 'Move',
    totalMoves: 'Total Moves',
    gameResult: 'Result',
    gameDate: 'Date',
    players: 'Players',
    backToMenu: 'Back to Menu',
    continueGame: 'Continue Game',
    gameName: 'Game Name',
    editName: 'Edit Name',
    saveName: 'Save',
    cancel: 'Cancel',
    favorite: 'Favorite',
    addToFavorites: 'Add to Favorites',
    removeFromFavorites: 'Remove from Favorites',
    moveHistory: 'Move History',
    showMoves: 'Show Moves',
    hideMoves: 'Hide Moves',
    apiKey: 'Gemini API Key',
    apiKeyPlaceholder: 'Enter API Key',
    saveApiKey: 'Save Key',
    editApiKey: 'Edit Key',
    deleteApiKey: 'Delete Key',
    apiKeyInfo: 'API Key required for AI Coach feature'
  }
};

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly STORAGE_KEY = 'shchametai_language';
  
  currentLang = signal<Language>(this.loadLanguage());
  
  t = computed(() => DICTIONARY[this.currentLang()]);
  dir = computed(() => this.currentLang() === 'he' ? 'rtl' : 'ltr');

  private loadLanguage(): Language {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return (saved === 'he' || saved === 'en') ? saved : 'he';
  }

  private saveLanguage(lang: Language) {
    localStorage.setItem(this.STORAGE_KEY, lang);
  }

  toggleLanguage() {
    this.currentLang.update(l => {
      const newLang = l === 'he' ? 'en' : 'he';
      this.saveLanguage(newLang);
      return newLang;
    });
  }
}
