import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChessEngineService, Piece } from '../services/chess-engine.service';
import { I18nService } from '../services/i18n.service';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .chess-square {
      aspect-ratio: 1 / 1;
    }
    /* Dynamic font size based on container width for pieces */
    .chess-piece {
      font-size: clamp(24px, 10cqw, 64px); 
    }
    .board-container {
      container-type: inline-size;
    }
  `],
  template: `
    <div class="board-container grid grid-cols-8 border-4 border-amber-900 rounded-lg overflow-hidden shadow-2xl select-none w-full max-w-[600px] aspect-square mx-auto bg-amber-900">
      @for (row of chess.board(); track $index) {
        @let rIndex = $index;
        @for (piece of row; track $index) {
          @let cIndex = $index;
          @let isDark = (rIndex + cIndex) % 2 === 1;
          @let isSelected = chess.selectedSquare()?.row === rIndex && chess.selectedSquare()?.col === cIndex;
          @let isValid = isValidMove(rIndex, cIndex);
          @let isLastMove = isLastMoveSquare(rIndex, cIndex);

          <div 
            (click)="chess.selectSquare(rIndex, cIndex)"
            class="chess-square relative flex items-center justify-center w-full h-full transition-colors duration-75 cursor-pointer"
            [class.bg-amber-200]="!isDark && !isSelected && !isLastMove"
            [class.bg-amber-800]="isDark && !isSelected && !isLastMove"
            [class.bg-yellow-400]="isSelected"
            [class.bg-lime-200]="isLastMove && !isSelected"
            [class.ring-inset]="isValid"
            [class.ring-4]="isValid"
            [class.ring-black]="isValid && !!piece"
            [class.ring-green-500]="isValid && !piece"
            [class.opacity-90]="isValid && !!piece"
            >
            
            @if (isValid && !piece) {
              <div class="absolute w-[20%] h-[20%] rounded-full bg-green-600/50 pointer-events-none"></div>
            }

            @if (piece) {
              <span 
                class="chess-piece leading-none drop-shadow-sm transform hover:scale-105 transition-transform"
                [class.text-white]="piece.color === 'w'"
                [class.text-black]="piece.color === 'b'"
                style="text-shadow: 0 1px 2px rgba(0,0,0,0.4);"
              >
                {{ getPieceSymbol(piece) }}
              </span>
            }
            
            <!-- Coordinates -->
            @if (cIndex === 0) {
               <span class="absolute top-[2%] left-[4%] text-[10px] sm:text-xs font-bold opacity-50 select-none" [class.text-amber-900]="!isDark" [class.text-amber-200]="isDark">{{8 - rIndex}}</span>
            }
            @if (rIndex === 7) {
               <span class="absolute bottom-[2%] right-[4%] text-[10px] sm:text-xs font-bold opacity-50 select-none" [class.text-amber-900]="!isDark" [class.text-amber-200]="isDark">{{files[cIndex]}}</span>
            }

          </div>
        }
      }
    </div>
  `
})
export class BoardComponent {
  chess = inject(ChessEngineService);
  i18n = inject(I18nService);

  files = ['a','b','c','d','e','f','g','h'];

  isValidMove(r: number, c: number): boolean {
    return this.chess.validMoves().some(m => m.row === r && m.col === c);
  }

  isLastMoveSquare(r: number, c: number): boolean {
    const hist = this.chess.history();
    if (hist.length === 0) return false;
    const last = hist[hist.length - 1];
    return (last.from.row === r && last.from.col === c) || (last.to.row === r && last.to.col === c);
  }

  getPieceSymbol(piece: Piece): string {
    const symbols: Record<string, string> = {
      'w-k': '♔', 'w-q': '♕', 'w-r': '♖', 'w-b': '♗', 'w-n': '♘', 'w-p': '♙',
      'b-k': '♚', 'b-q': '♛', 'b-r': '♜', 'b-b': '♝', 'b-n': '♞', 'b-p': '♟︎'
    };
    return symbols[`${piece.color}-${piece.type}`] || '';
  }
}
