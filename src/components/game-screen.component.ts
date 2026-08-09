import { Component, inject, signal, computed, effect, untracked, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../services/i18n.service';
import { ChessEngineService, Color, Piece, Move } from '../services/chess-engine.service';
import { BoardComponent } from './board.component';
import { ComputerOpponentService } from '../services/computer-opponent.service';
import { GameHistoryService } from '../services/game-history.service';
import { AiHintsService } from '../services/ai-hints.service';
import { GameMode, Difficulty } from '../models/app.types';

@Component({
  selector: 'app-game-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, BoardComponent],
  templateUrl: './game-screen.component.html'
})
export class GameScreenComponent {
  i18n = inject(I18nService);
  chess = inject(ChessEngineService);
  computer = inject(ComputerOpponentService);
  history = inject(GameHistoryService);
  aiHints = inject(AiHintsService);

  // Inputs
  gameMode = input.required<GameMode>();
  difficulty = input.required<Difficulty>();
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

  constructor() {
    // A fresh position means the previous result banner is no longer relevant
    effect(() => {
      this.chess.history().length;
      untracked(() => this.gameOverDismissed.set(false));
    });

    // Effect to trigger Computer move
    effect(() => {
      const turn = this.chess.turn();
      const mode = this.gameMode();
      const playerColor = this.playerColor();
      const gameOver = this.chess.winner() || this.chess.isStalemate();

      // Computer plays the opposite color of the player
      const computerColor = playerColor === 'w' ? 'b' : 'w';
      
      if (mode === 'computer' && turn === computerColor && !gameOver && !untracked(this.isComputerMoving)) {
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
    // Small delay for realism/UI update
    await new Promise(r => setTimeout(r, 500));

    try {
      const computerColor = this.playerColor() === 'w' ? 'b' : 'w';
      const move = await this.computer.getBestMove(computerColor, this.difficulty());
      if (move) {
        this.chess.makeMove(move.from, move.to);
      }
    } finally {
      this.isComputerMoving.set(false);
    }
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
    if (this.isThinking() || this.chess.isCheckmate() || this.chess.isStalemate()) {
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

    // Reset board to initial state
    this.chess.resetGame();

    // Apply moves up to replay index (skip history recording to avoid duplication)
    const replayIndex = this.history.replayIndex();
    for (let i = 0; i < replayIndex && i < game.moves.length; i++) {
      const move = game.moves[i];
      
      // Just verify a piece exists at source (don't check type/color as it may have changed due to promotion)
      const board = this.chess.board();
      const piece = board[move.from.row]?.[move.from.col];
      
      if (piece) {
        this.chess.makeMove(move.from, move.to, true); // true = skip history recording
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

    return `${moveNumber}. ${pieceName} ${from} → ${to}${captured}`;
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
