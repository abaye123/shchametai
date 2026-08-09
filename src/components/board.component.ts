import { Component, inject } from '@angular/core';
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
      height: 100%;
      min-width: 0;
      min-height: 0;
    }

    /* The stage measures the space the board may occupy.
       container-type: size lets the board below read BOTH the available
       width (cqw) and the available height (cqh), so it can pick the
       largest square that fits - filling the screen height efficiently. */
    .board-stage {
      container-type: size;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
    }

    .board-frame {
      /* largest square that fits in the stage, capped so it never gets silly
         on ultra-tall windows */
      --size: min(100cqw, 100cqh, 1100px);
      width: var(--size);
      height: var(--size);
      padding: clamp(6px, 1.6%, 14px);
      border-radius: clamp(18px, 4.5%, 40px);
      background:
        linear-gradient(145deg, #c99a6a 0%, #a9784f 38%, #7c5535 100%);
      box-shadow:
        inset 0 2px 3px rgba(255, 255, 255, 0.4),
        inset 0 -3px 6px rgba(0, 0, 0, 0.28),
        0 4px 10px rgba(67, 53, 42, 0.14),
        0 26px 50px -18px rgba(67, 53, 42, 0.5);
    }

    .board-grid {
      /* nested container: piece glyphs scale off the board's own width */
      container-type: inline-size;
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      grid-template-rows: repeat(8, 1fr);
      border-radius: clamp(10px, 3%, 26px);
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(67, 53, 42, 0.25);
    }

    .chess-square {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.16s ease-out;
    }

    .sq-light {
      background: linear-gradient(150deg, var(--sq-light) 0%, var(--sq-light-2) 100%);
    }

    .sq-dark {
      background: linear-gradient(150deg, var(--sq-dark) 0%, var(--sq-dark-2) 100%);
    }

    .sq-last {
      background: linear-gradient(150deg, #e6f2ae 0%, #cfe28f 100%);
    }

    .sq-selected {
      background: linear-gradient(150deg, #ffe08a 0%, var(--sq-select) 100%);
      box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.75);
    }

    .sq-check {
      background: radial-gradient(circle at 50% 45%, #ff9f92 0%, #ef6a5a 78%);
    }

    /* quiet move target: a soft dot */
    .move-dot {
      position: absolute;
      width: 26%;
      height: 26%;
      border-radius: 9999px;
      background: rgba(35, 90, 45, 0.42);
      box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.35);
      pointer-events: none;
      animation: dot-in 0.18s var(--ease-bounce, ease-out) both;
    }

    /* capture target: a thick ring hugging the square */
    .move-ring {
      position: absolute;
      inset: 6%;
      border-radius: 9999px;
      border: 6cqw solid rgba(190, 45, 45, 0.28);
      border-width: max(4px, 3cqw);
      pointer-events: none;
      animation: dot-in 0.18s ease-out both;
    }

    @keyframes dot-in {
      from { transform: scale(0.3); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }

    .chess-square:hover .move-dot {
      transform: scale(1.35);
      background: rgba(35, 90, 45, 0.55);
    }

    .move-dot,
    .move-ring {
      transition: transform 0.18s var(--ease-bounce, ease-out), background-color 0.18s ease-out;
    }

    /* Pieces - one solid glyph set for both colours, tinted + outlined,
       so black and white read as the same carved shape. */
    .chess-piece {
      font-size: 10.4cqw;
      line-height: 1;
      display: block;
      transition: transform 0.18s var(--ease-bounce, ease-out), filter 0.18s ease-out;
      will-change: transform;
      animation: piece-in 0.22s ease-out both;
    }

    @keyframes piece-in {
      from { opacity: 0; transform: scale(0.86); }
      to   { opacity: 1; transform: scale(1); }
    }

    .piece-white {
      color: #fdfaf4;
      text-shadow:
        0 0 1px #4a3826,
        1px 0 0 #4a3826, -1px 0 0 #4a3826, 0 1px 0 #4a3826, 0 -1px 0 #4a3826,
        1px 1px 0 #4a3826, -1px -1px 0 #4a3826, 1px -1px 0 #4a3826, -1px 1px 0 #4a3826,
        0 3px 5px rgba(50, 32, 18, 0.4);
    }

    .piece-black {
      color: #2c2018;
      text-shadow:
        0 0 1px rgba(255, 255, 255, 0.45),
        0 1px 0 rgba(255, 255, 255, 0.25),
        0 3px 5px rgba(50, 32, 18, 0.35);
    }

    .chess-square:hover .chess-piece {
      transform: translateY(-4%) scale(1.06);
    }

    .piece-lifted {
      transform: translateY(-6%) scale(1.1) !important;
      filter: drop-shadow(0 6px 8px rgba(50, 32, 18, 0.4));
    }

    /* Coordinates */
    .coord {
      position: absolute;
      font-size: max(7px, 1.6cqw);
      font-weight: 700;
      opacity: 0.55;
      pointer-events: none;
      user-select: none;
      letter-spacing: 0.02em;
    }

    .coord-rank { top: 4%; inset-inline-start: 6%; }
    .coord-file { bottom: 3%; inset-inline-end: 6%; }

    .coord-on-light { color: #7c5535; }
    .coord-on-dark  { color: #f3e2c3; }
  `],
  template: `
    <!-- dir=ltr keeps a1 bottom-left even when the app runs right-to-left -->
    <div class="board-stage" dir="ltr">
      <div class="board-frame">
        <div class="board-grid">
          @for (row of chess.board(); track $index) {
            @let rIndex = $index;
            @for (piece of row; track $index) {
              @let cIndex = $index;
              @let isDark = (rIndex + cIndex) % 2 === 1;
              @let isSelected = chess.selectedSquare()?.row === rIndex && chess.selectedSquare()?.col === cIndex;
              @let isValid = isValidMove(rIndex, cIndex);
              @let isLastMove = isLastMoveSquare(rIndex, cIndex);
              @let inCheck = isCheckedKing(piece);

              <div
                (click)="chess.selectSquare(rIndex, cIndex)"
                class="chess-square"
                [class.sq-light]="!isDark && !isSelected && !isLastMove && !inCheck"
                [class.sq-dark]="isDark && !isSelected && !isLastMove && !inCheck"
                [class.sq-last]="isLastMove && !isSelected && !inCheck"
                [class.sq-selected]="isSelected"
                [class.sq-check]="inCheck && !isSelected">

                @if (isValid && !piece) {
                  <span class="move-dot"></span>
                }
                @if (isValid && piece) {
                  <span class="move-ring"></span>
                }

                @if (piece) {
                  <span
                    class="chess-piece"
                    [class.piece-white]="piece.color === 'w'"
                    [class.piece-black]="piece.color === 'b'"
                    [class.piece-lifted]="isSelected">
                    {{ getPieceSymbol(piece) }}
                  </span>
                }

                @if (cIndex === 0) {
                  <span class="coord coord-rank"
                        [class.coord-on-light]="!isDark"
                        [class.coord-on-dark]="isDark">{{ 8 - rIndex }}</span>
                }
                @if (rIndex === 7) {
                  <span class="coord coord-file"
                        [class.coord-on-light]="!isDark"
                        [class.coord-on-dark]="isDark">{{ files[cIndex] }}</span>
                }
              </div>
            }
          }
        </div>
      </div>
    </div>
  `
})
export class BoardComponent {
  chess = inject(ChessEngineService);
  i18n = inject(I18nService);

  files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  isValidMove(r: number, c: number): boolean {
    return this.chess.validMoves().some(m => m.row === r && m.col === c);
  }

  isLastMoveSquare(r: number, c: number): boolean {
    const hist = this.chess.history();
    if (hist.length === 0) return false;
    const last = hist[hist.length - 1];
    return (last.from.row === r && last.from.col === c) || (last.to.row === r && last.to.col === c);
  }

  isCheckedKing(piece: Piece | null | undefined): boolean {
    return !!piece && piece.type === 'k' && piece.color === this.chess.turn() && this.chess.isCheck();
  }

  getPieceSymbol(piece: Piece): string {
    // One solid glyph set for both colours; colour comes from CSS so the two
    // sides look like the same carved piece rather than outline vs. filled.
    const symbols: Record<string, string> = {
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };
    return symbols[piece.type] || '';
  }
}
