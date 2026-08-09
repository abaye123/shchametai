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
  // Engine strength ladder
  level: string;
  estimatedRating: string;
  levelBeginner: string;
  levelCasual: string;
  levelImprover: string;
  levelClub: string;
  levelStrong: string;
  levelExpert: string;
  // Promotion
  promotionTitle: string;
  queen: string;
  rook: string;
  bishop: string;
  knight: string;
  // Draw reasons
  draw: string;
  drawFiftyMove: string;
  drawThreefold: string;
  drawInsufficientMaterial: string;
  // Search feedback
  searchDepth: string;
  evaluation: string;
  bookMove: string;
  // Move review
  reviewGame: string;
  reviewing: string;
  reviewCancel: string;
  reviewAgain: string;
  accuracy: string;
  avgLoss: string;
  bestMoveWas: string;
  qBrilliant: string;
  qGreat: string;
  qBest: string;
  qExcellent: string;
  qGood: string;
  qBook: string;
  qForced: string;
  qInaccuracy: string;
  qMistake: string;
  qBlunder: string;
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
    apiKeyInfo: 'מפתח API נדרש לתכונת AI Coach',
    level: 'רמה',
    estimatedRating: 'דירוג',
    levelBeginner: 'מתחיל',
    levelCasual: 'חובב',
    levelImprover: 'מתקדם',
    levelClub: 'מועדון',
    levelStrong: 'חזק',
    levelExpert: 'מומחה',
    promotionTitle: 'בחר כלי',
    queen: 'מלכה',
    rook: 'צריח',
    bishop: 'רץ',
    knight: 'סוס',
    draw: 'תיקו',
    drawFiftyMove: 'תיקו - חוק 50 המהלכים',
    drawThreefold: 'תיקו - חזרה משולשת',
    drawInsufficientMaterial: 'תיקו - חומר בלתי מספיק',
    searchDepth: 'עומק',
    evaluation: 'הערכה',
    bookMove: 'מהלך מספר הפתיחות',
    // Move review
    reviewGame: 'נתח משחק',
    reviewing: 'מנתח',
    reviewCancel: 'עצור ניתוח',
    reviewAgain: 'נתח מחדש',
    accuracy: 'דיוק',
    avgLoss: 'הפסד ממוצע',
    bestMoveWas: 'המהלך הטוב היה',
    qBrilliant: 'מבריק',
    qGreat: 'מצוין מאוד',
    qBest: 'הטוב ביותר',
    qExcellent: 'מצוין',
    qGood: 'טוב',
    qBook: 'ספר פתיחות',
    qForced: 'מאולץ',
    qInaccuracy: 'אי-דיוק',
    qMistake: 'טעות',
    qBlunder: 'טעות גסה'
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
    apiKeyInfo: 'API Key required for AI Coach feature',
    level: 'Level',
    estimatedRating: 'Rating',
    levelBeginner: 'Beginner',
    levelCasual: 'Casual',
    levelImprover: 'Improver',
    levelClub: 'Club',
    levelStrong: 'Strong',
    levelExpert: 'Expert',
    promotionTitle: 'Choose a piece',
    queen: 'Queen',
    rook: 'Rook',
    bishop: 'Bishop',
    knight: 'Knight',
    draw: 'Draw',
    drawFiftyMove: 'Draw - fifty-move rule',
    drawThreefold: 'Draw - threefold repetition',
    drawInsufficientMaterial: 'Draw - insufficient material',
    searchDepth: 'Depth',
    evaluation: 'Evaluation',
    bookMove: 'Book move',
    // Move review
    reviewGame: 'Review game',
    reviewing: 'Reviewing',
    reviewCancel: 'Stop review',
    reviewAgain: 'Review again',
    accuracy: 'Accuracy',
    avgLoss: 'Avg. loss',
    bestMoveWas: 'Best was',
    qBrilliant: 'Brilliant',
    qGreat: 'Great',
    qBest: 'Best',
    qExcellent: 'Excellent',
    qGood: 'Good',
    qBook: 'Book',
    qForced: 'Forced',
    qInaccuracy: 'Inaccuracy',
    qMistake: 'Mistake',
    qBlunder: 'Blunder'
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
