import { Component, inject, signal, computed, effect, untracked, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../services/i18n.service';
import { ChessEngineService, Color, Piece, Move } from '../services/chess-engine.service';
import { BoardComponent } from './board.component';
import { PromotionDialogComponent, PromotionPiece } from './promotion-dialog.component';
import { ComputerOpponentService } from '../services/computer-opponent.service';
import { GameHistoryService } from '../services/game-history.service';
import { AiHintsService } from '../services/ai-hints.service';
import { GameAnalysisService } from '../services/game-analysis.service';
import type { MoveQuality } from '../engine/analysis.ts';
import { GameMode, LevelId } from '../models/app.types';

@Component({
  selector: 'app-game-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, BoardComponent, PromotionDialogComponent],
  templateUrl: './game-screen.component.html',
  styles: [`
    /* Move-quality marks.
       Typographic rather than pictorial: !! and ?? are the notation players
       already read, they stay legible at 11px, and they do not drag a second
       icon language into a UI that is otherwise text and chess glyphs. */
    .move-mark {
      display: grid;
      place-items: center;
      min-width: 1.5rem;
      height: 1.25rem;
      padding: 0 0.3rem;
      border-radius: 0.5rem;
      font-size: 0.6875rem;
      font-weight: 700;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      color: #fff;
      background: #b0a494;
    }

    .move-mark[data-q="brilliant"] { background: #2f7d78; }
    .move-mark[data-q="great"]     { background: #405a64; }
    .move-mark[data-q="best"]      { background: #3f5c3b; }
    .move-mark[data-q="excellent"] { background: #4f7049; }
    .move-mark[data-q="good"]      { background: #71916c; }

    /* Neutral, non-judgemental states stay quiet and low-contrast. */
    .move-mark[data-q="book"],
    .move-mark[data-q="forced"] {
      background: transparent;
      color: #7d7161;
      box-shadow: inset 0 0 0 1px #d3c8b7;
    }

    .move-mark[data-q="inaccuracy"] { background: #c49a4f; color: #3b2a13; }
    .move-mark[data-q="mistake"]    { background: #a94f43; }
    .move-mark[data-q="blunder"]    { background: #75342c; }
  `]
})
export class GameScreenComponent {
  i18n = inject(I18nService);
  chess = inject(ChessEngineService);
  computer = inject(ComputerOpponentService);
  history = inject(GameHistoryService);
  aiHints = inject(AiHintsService);
  analysis = inject(GameAnalysisService);

  // Inputs
  gameMode = input.required<GameMode>();
  level = input.required<LevelId>();
  apiKey = input.required<string>();
  playerColor = input<'w' | 'b'>('w');

  // Outputs
  backToMenu = output<void>();
  goToSettings = output<void>();

  // AI/Hint State
  aiHintText = signal<string>('');
  isThinking = signal<boolean>(false);
  isComputerMoving = signal<boolean>(false);

  // UI State
  showMoveHistory = signal<boolean>(true);
  editingGameName = signal<boolean>(false);
  tempGameName = signal<string>('');
  gameOverDismissed = signal<boolean>(false);

  /** The end-of-game overlay is shown until the player dismisses it. */
  showGameOver = computed(() => !this.gameOverDismissed());

  /** Number of moves in the game currently loaded, 0 when there is none. */
  totalMoves = computed(() => this.history.currentGame()?.moves.length ?? 0);

  /** Material balance in pawns. Positive = white is ahead. */
  materialDiff = computed(() => {
    const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let diff = 0;
    for (const move of this.chess.history()) {
      if (!move.captured) continue;
      const value = values[move.captured.type] ?? 0;
      // capturing a black piece is a gain for white, and vice versa
      diff += move.captured.color === 'b' ? value : -value;
    }
    return diff;
  });

  /** Human-readable reason for a drawn game. */
  drawText = computed(() => {
    switch (this.chess.drawReason()) {
      case 'fifty-move': return this.i18n.t().drawFiftyMove;
      case 'threefold': return this.i18n.t().drawThreefold;
      case 'insufficient-material': return this.i18n.t().drawInsufficientMaterial;
      default: return this.i18n.t().draw;
    }
  });

  /** Search telemetry, shown while the engine thinks and just after. */
  engineDepth = this.computer.lastDepth;
  engineScore = this.computer.lastScore;
  engineFromBook = this.computer.lastFromBook;

  /** Evaluation in pawns from white's point of view, for display. */
  engineEvalText = computed(() => {
    if (this.engineFromBook()) return '';
    const cp = this.engineScore();
    // The search reports from the side to move's view; the engine moves as the
    // colour opposite the player, so flip into white's frame for display.
    const white = this.computerColor() === 'w' ? cp : -cp;
    const pawns = white / 100;
    return (pawns > 0 ? '+' : '') + pawns.toFixed(1);
  });

  computerColor = computed<Color>(() => (this.playerColor() === 'w' ? 'b' : 'w'));

  /** Playing black means looking at the board from the other side, so the
      player's own pieces sit on the near rank - the same as sitting down at a
      real board. The strips above and below the board swap with it. */
  boardFlipped = computed(() => this.playerColor() === 'b');

  constructor() {
    // A fresh position means the previous result banner is no longer relevant
    effect(() => {
      const plies = this.chess.history().length;
      untracked(() => {
        this.gameOverDismissed.set(false);
        // A review is only meaningful for the moves it actually looked at.
        // Starting over discards it; playing on keeps the earlier verdicts,
        // which stay correct because each one only depends on its own position.
        if (plies === 0) this.analysis.reset();
      });
    });

    // Effect to trigger the computer's move
    effect(() => {
      const turn = this.chess.turn();
      const mode = this.gameMode();
      const computerColor = this.computerColor();
      const gameOver = this.chess.isGameOver();
      const replaying = this.history.isReplayMode();

      if (mode === 'computer' && turn === computerColor && !gameOver && !replaying &&
          !untracked(this.isComputerMoving)) {
        this.makeComputerMove();
      }
    });
  }

  ngOnInit() {
    // Apply history to board when entering game screen
    if (this.history.currentGame()) {
      this.applyHistoryToBoard();
    }
  }

  async makeComputerMove() {
    this.isComputerMoving.set(true);
    const started = Date.now();

    try {
      const result = await this.computer.getBestMove(
        this.chess.getUciHistory(),
        this.level(),
      );

      if (!result.uci) return;

      // A move that lands instantly reads as thoughtless, so hold a short floor
      // before playing it. This replaces the old unconditional 500ms delay,
      // which was added on top of however long the search already took.
      const minimumThinkMs = 350;
      const elapsed = Date.now() - started;
      if (elapsed < minimumThinkMs) {
        await new Promise(r => setTimeout(r, minimumThinkMs - elapsed));
      }

      // The player may have left the screen or undone a move while we searched.
      if (this.chess.turn() !== this.computerColor() || this.chess.isGameOver()) return;

      const move = this.chess.findUciMove(result.uci);
      if (move !== 0) {
        this.chess.playPackedMove(move);
      } else {
        console.error('Engine returned a move that is not legal here:', result.uci);
      }
    } finally {
      this.isComputerMoving.set(false);
    }
  }

  // --- Promotion ------------------------------------------------------------

  onPromotionChosen(piece: PromotionPiece) {
    this.chess.choosePromotion(piece);
  }

  onPromotionCancelled() {
    this.chess.cancelPromotion();
  }

  // Computed captured pieces
  getCaptured(color: Color): Piece[] {
    const history = this.chess.history();
    return history
      .filter(m => m.captured && m.captured.color === color)
      .map(m => m.captured!);
  }

  getPieceSymbol(piece: Piece): string {
    // Solid glyphs for both colours, matching the board - colour comes from CSS
    const symbols: Record<string, string> = {
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };
    return symbols[piece.type] || '';
  }

  async onGetAiHint() {
    if (this.isThinking() || this.chess.isGameOver()) {
      return;
    }

    this.isThinking.set(true);
    this.aiHintText.set('');

    try {
      const hint = await this.aiHints.getHint(this.apiKey());
      this.aiHintText.set(hint);
    } finally {
      this.isThinking.set(false);
    }
  }

  onBackToMenu() {
    this.backToMenu.emit();
  }

  onGoToSettings() {
    this.goToSettings.emit();
  }

  // Replay controls
  onReplayNext() {
    this.history.nextMove();
    this.applyHistoryToBoard();
  }

  onReplayPrevious() {
    this.history.previousMove();
    this.applyHistoryToBoard();
  }

  onReplayGoToStart() {
    this.history.goToStart();
    this.applyHistoryToBoard();
  }

  onReplayGoToEnd() {
    this.history.goToEnd();
    this.applyHistoryToBoard();
  }

  onExitReplay() {
    this.history.exitReplayMode();
    this.applyHistoryToBoard();
  }

  private applyHistoryToBoard() {
    const game = this.history.currentGame();
    if (!game) return;

    this.chess.resetGame();

    // Replay by coordinates and let the engine resolve each one against its own
    // legal move list. Games saved before promotion choice existed carry no
    // promotion piece, so those resolve to a queen, which is what the old
    // auto-promoting engine would have played anyway.
    const replayIndex = this.history.replayIndex();
    for (let i = 0; i < replayIndex && i < game.moves.length; i++) {
      const move = game.moves[i];
      if (!this.chess.makeMove(move.from, move.to, true)) {
        console.warn('Stopping replay: move', i + 1, 'is not legal in this position');
        break;
      }
    }
  }

  // Get move description
  getMoveDescription(move: Move, moveNumber: number): string {
    const pieceNames: Record<string, string> = this.i18n.currentLang() === 'he' ? {
      'p': 'רגלי',
      'r': 'צריח',
      'n': 'סוס',
      'b': 'רץ',
      'q': 'מלכה',
      'k': 'מלך'
    } : {
      'p': 'Pawn',
      'r': 'Rook',
      'n': 'Knight',
      'b': 'Bishop',
      'q': 'Queen',
      'k': 'King'
    };

    const from = this.positionToNotation(move.from);
    const to = this.positionToNotation(move.to);
    const pieceName = pieceNames[move.piece.type];
    const captured = move.captured ? (this.i18n.currentLang() === 'he' ? ' חיסול' : ' captures') : '';
    const promoted = move.promotion
      ? ` = ${pieceNames[move.promotion]}`
      : '';

    return `${moveNumber}. ${pieceName} ${from} → ${to}${captured}${promoted}`;
  }

  // Convert position to chess notation (e.g., {row: 0, col: 0} -> A8)
  positionToNotation(pos: { row: number; col: number }): string {
    const file = String.fromCharCode(65 + pos.col); // A-H
    const rank = 8 - pos.row; // 8-1
    return `${file}${rank}`;
  }

  toggleMoveHistory() {
    this.showMoveHistory.update(v => !v);
  }

  // --- Move review ---------------------------------------------------------

  /**
   * Symbol shown beside each move. Deliberately typographic rather than
   * emoji: `!!` and `??` are the notation players already read, and they stay
   * legible at the size the move list uses.
   */
  private static readonly QUALITY_SYMBOL: Record<MoveQuality, string> = {
    brilliant: '!!',
    great: '!',
    best: '★',      // solid star
    excellent: '✓', // check mark
    good: '✓',
    book: '▤',      // lined square, "out of the book"
    forced: '→',
    inaccuracy: '?!',
    mistake: '?',
    blunder: '??',
  };

  qualityFor(ply: number): MoveQuality | null {
    return this.analysis.byPly().get(ply)?.quality ?? null;
  }

  assessmentFor(ply: number) {
    return this.analysis.byPly().get(ply) ?? null;
  }

  qualitySymbol(q: MoveQuality): string {
    return GameScreenComponent.QUALITY_SYMBOL[q] ?? '';
  }

  qualityLabel(q: MoveQuality): string {
    const t = this.i18n.t();
    switch (q) {
      case 'brilliant': return t.qBrilliant;
      case 'great': return t.qGreat;
      case 'best': return t.qBest;
      case 'excellent': return t.qExcellent;
      case 'good': return t.qGood;
      case 'book': return t.qBook;
      case 'forced': return t.qForced;
      case 'inaccuracy': return t.qInaccuracy;
      case 'mistake': return t.qMistake;
      case 'blunder': return t.qBlunder;
    }
  }

  /** Tooltip: the label, the loss, and what the engine preferred. */
  qualityTooltip(ply: number): string {
    const a = this.assessmentFor(ply);
    if (!a) return '';
    const parts = [this.qualityLabel(a.quality)];
    if (a.centipawnLoss > 0) {
      parts.push(`-${(a.centipawnLoss / 100).toFixed(2)}`);
    }
    if (a.bestUci) {
      parts.push(`${this.i18n.t().bestMoveWas} ${a.bestUci}`);
    }
    return parts.join('  ');
  }

  /**
   * The moves to review. In replay mode the board only holds the position up
   * to the current replay index, so the review reads the full saved game
   * instead - otherwise stepping backwards would silently shorten the report.
   */
  private movesToReview(): string[] {
    if (this.history.isReplayMode()) {
      const game = this.history.currentGame();
      if (game) return this.chess.uciForMoves(game.moves);
    }
    return this.chess.getUciHistory();
  }

  canReview(): boolean {
    return this.movesToReview().length > 0 && !this.isComputerMoving();
  }

  onReviewGame() {
    if (this.analysis.isRunning()) {
      this.analysis.cancel();
      return;
    }
    this.analysis.analyze(this.movesToReview(), 'standard');
  }

  dismissGameOver() {
    this.gameOverDismissed.set(true);
  }

  // Game name management
  startEditingGameName() {
    const game = this.history.currentGame();
    this.tempGameName.set(game?.gameName || '');
    this.editingGameName.set(true);
  }

  saveGameName() {
    const name = this.tempGameName().trim();
    if (name) {
      this.history.updateGameName(name);
    }
    this.editingGameName.set(false);
  }

  cancelEditGameName() {
    this.editingGameName.set(false);
    this.tempGameName.set('');
  }

  onToggleFavorite() {
    this.history.toggleCurrentFavorite();
  }
}
