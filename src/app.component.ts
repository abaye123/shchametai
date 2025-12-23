import { Component, inject, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from './services/i18n.service';
import { ChessEngineService, Color, Piece } from './services/chess-engine.service';
import { BoardComponent } from './components/board.component';
import { GoogleGenAI } from "@google/genai";
import { ComputerOpponentService } from './services/computer-opponent.service';
import { SoundService } from './services/sound.service';

export type GameMode = 'human' | 'computer';
export type Difficulty = 'easy' | 'medium' | 'hard';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, BoardComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  i18n = inject(I18nService);
  chess = inject(ChessEngineService);
  computer = inject(ComputerOpponentService);
  sound = inject(SoundService);

  // Game Settings
  gameMode = signal<GameMode>('human');
  difficulty = signal<Difficulty>('medium');
  showSettings = signal<boolean>(false);
  
  // AI/Hint State
  aiHintText = signal<string>('');
  isThinking = signal<boolean>(false);
  isComputerMoving = signal<boolean>(false);

  constructor() {
    // Effect to trigger Computer move
    effect(() => {
      const turn = this.chess.turn();
      const mode = this.gameMode();
      const gameOver = this.chess.winner() || this.chess.isStalemate();

      // Assuming computer plays Black for now
      if (mode === 'computer' && turn === 'b' && !gameOver && !untracked(this.isComputerMoving)) {
        this.makeComputerMove();
      }
    });
  }

  toggleSettings() {
    this.showSettings.update(v => !v);
  }

  setGameMode(mode: GameMode) {
    this.gameMode.set(mode);
  }

  setDifficulty(diff: Difficulty) {
    this.difficulty.set(diff);
  }

  restartGame() {
    this.chess.resetGame();
    this.showSettings.set(false);
    this.aiHintText.set('');
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

  async getAiHint() {
    // Basic offline check
    if (!navigator.onLine) {
      this.aiHintText.set(this.i18n.t().offline);
      return;
    }

    if (!process.env['API_KEY']) {
       this.aiHintText.set("No API Key configured.");
       return;
    }

    this.isThinking.set(true);
    this.aiHintText.set('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] });
      
      // Convert board to string representation for the AI
      const boardStr = this.chess.board().map(row => 
        row.map(p => p ? `${p.color}${p.type}` : '--').join(' ')
      ).join('\n');

      const turnColor = this.chess.turn() === 'w' ? 'White' : 'Black';
      const prompt = `
        You are a chess coach. Analyze this board position.
        Board (Row 0 is rank 8, Row 7 is rank 1):
        ${boardStr}
        
        It is ${turnColor}'s turn.
        Suggest a good move and explain why briefly in ${this.i18n.currentLang() === 'he' ? 'Hebrew' : 'English'}.
        Keep it under 2 sentences.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      this.aiHintText.set(response.text.trim());

    } catch (e) {
      console.error(e);
      this.aiHintText.set('Error fetching hint.');
    } finally {
      this.isThinking.set(false);
    }
  }
}