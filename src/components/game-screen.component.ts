import { Component, inject, signal, effect, untracked, input, output } from '@angular/core';
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

  constructor() {
    // Effect to trigger Computer move
    effect(() => {
      const turn = this.chess.turn();
      const mode = this.gameMode();
      const gameOver = this.chess.winner() || this.chess.isStalemate();

      // Assuming computer plays Black
      if (mode === 'computer' && turn === 'b' && !gameOver && !untracked(this.isComputerMoving)) {
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
      const move = await this.computer.getBestMove('b', this.difficulty());
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
    const symbols: Record<string, string> = {
      'w-k': '♔', 'w-q': '♕', 'w-r': '♖', 'w-b': '♗', 'w-n': '♘', 'w-p': '♙',
      'b-k': '♚', 'b-q': '♛', 'b-r': '♜', 'b-b': '♝', 'b-n': '♞', 'b-p': '♟︎'
    };
    return symbols[`${piece.color}-${piece.type}`] || '';
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
