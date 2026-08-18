import { Component, computed, inject, input } from '@angular/core';
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
      padding: clamp(6px, 1.5%, 13px);
      border-radius: clamp(12px, 2.6%, 22px);
      /* The one gradient that stays: it depicts a turned wooden tray,
         lit from the top-left. It is describing a physical object, not
         decorating a rectangle. */
      background: linear-gradient(150deg,
        var(--frame-1) 0%,
        var(--frame-2) 46%,
        var(--frame-3) 100%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.35),
        inset 0 -2px 4px rgba(0, 0, 0, 0.22),
        0 2px 6px rgba(36, 31, 26, 0.10),
        0 20px 44px -20px rgba(36, 31, 26, 0.45);
    }

    .board-grid {
      /* nested container: piece glyphs scale off the board's own width */
      container-type: inline-size;
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      grid-template-rows: repeat(8, 1fr);
      border-radius: clamp(5px, 1.2%, 10px);
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(36, 31, 26, 0.22);
    }

    .chess-square {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    /* Flat ink on paper. The checkerboard is printed, not lacquered. */
    .sq-light { background-color: var(--sq-light); }
    .sq-dark  { background-color: var(--sq-dark); }

    /* State is a wash laid OVER the square, so the checker pattern still
       shows through and the board never loses its rhythm. */
    .sq-last::after,
    .sq-selected::after,
    .sq-check::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      animation: wash-in 0.14s linear both;
    }

    .sq-last::after  { background: var(--sq-last); }
    .sq-check::after { background: var(--sq-danger); }

    /* The square you are holding gets a drawn edge as well as a wash,
       both on the overlay so the edge stays crisp on top of the tint. */
    .sq-selected::after {
      background: var(--sq-select);
      box-shadow: inset 0 0 0 max(2px, 0.5cqw) rgba(99, 69, 26, 0.9);
    }

    @keyframes wash-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* quiet move target: a small ink dot */
    .move-dot {
      position: absolute;
      width: 22%;
      height: 22%;
      z-index: 1;
      border-radius: 9999px;
      background: var(--marker-quiet);
      pointer-events: none;
      animation: marker-in 0.14s ease-out both;
      transition: transform var(--dur-base, 0.18s) ease-out;
    }

    /* capture target: a ring hugging the square */
    .move-ring {
      position: absolute;
      inset: 5%;
      z-index: 1;
      border-radius: 9999px;
      border: max(3px, 2.4cqw) solid var(--marker-capture);
      pointer-events: none;
      animation: marker-in 0.14s ease-out both;
    }

    @keyframes marker-in {
      from { transform: scale(0.6); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }

    .chess-square:hover .move-dot {
      transform: scale(1.25);
    }

    /* Pieces - one solid glyph set for both colours, tinted + outlined,
       so black and white read as the same carved shape.
       The drop keeps its character: it is the only motion on screen that
       represents something physically happening. */
    .chess-piece {
      font-size: 10.4cqw;
      line-height: 1;
      display: block;
      position: relative;
      z-index: 2;
      transition: transform 0.14s ease-out, filter 0.14s ease-out;
      will-change: transform;
      animation: piece-in 0.24s cubic-bezier(0.2, 0.9, 0.3, 1) both;
    }

    @keyframes piece-in {
      from { opacity: 0; transform: translateY(-8%) scale(1.05); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .piece-white {
      color: #fbf6ec;
      text-shadow:
        1px 0 0 #3b2a13, -1px 0 0 #3b2a13, 0 1px 0 #3b2a13, 0 -1px 0 #3b2a13,
        1px 1px 0 #3b2a13, -1px -1px 0 #3b2a13, 1px -1px 0 #3b2a13, -1px 1px 0 #3b2a13,
        0 2px 3px rgba(36, 31, 26, 0.32);
    }

    .piece-black {
      color: #241f1a;
      text-shadow:
        0 1px 0 rgba(255, 255, 255, 0.20),
        0 2px 3px rgba(36, 31, 26, 0.28);
    }

    .chess-square:hover .chess-piece {
      transform: translateY(-3%);
    }

    .piece-lifted {
      transform: translateY(-5%) scale(1.06) !important;
      filter: drop-shadow(0 5px 6px rgba(36, 31, 26, 0.38));
    }

    /* Coordinates - quiet, wide-tracked, like a printed board margin */
    .coord {
      position: absolute;
      z-index: 2;
      font-size: max(7px, 1.5cqw);
      font-weight: 700;
      opacity: 0.5;
      pointer-events: none;
      user-select: none;
      letter-spacing: 0.06em;
    }

    .coord-rank { top: 4%; inset-inline-start: 6%; }
    .coord-file { bottom: 3%; inset-inline-end: 6%; }

    .coord-on-light { color: #63451a; }
    .coord-on-dark  { color: #e9dcc0; }
  `],
  template: `
    <!-- dir=ltr keeps a1 bottom-left even when the app runs right-to-left -->
    <div class="board-stage" dir="ltr">
      <div class="board-frame">
        <div class="board-grid">
          @for (rIndex of displayRows(); track rIndex) {
            @for (cIndex of displayCols(); track cIndex) {
              @let piece = chess.board()[rIndex][cIndex];
              @let isDark = (rIndex + cIndex) % 2 === 1;
              @let isSelected = chess.selectedSquare()?.row === rIndex && chess.selectedSquare()?.col === cIndex;
              @let isValid = isValidMove(rIndex, cIndex);
              @let isLastMove = isLastMoveSquare(rIndex, cIndex);
              @let inCheck = isCheckedKing(piece);

              <div
                (click)="chess.selectSquare(rIndex, cIndex)"
                class="chess-square"
                [class.sq-light]="!isDark"
                [class.sq-dark]="isDark"
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

                @if (cIndex === firstCol()) {
                  <span class="coord coord-rank"
                        [class.coord-on-light]="!isDark"
                        [class.coord-on-dark]="isDark">{{ 8 - rIndex }}</span>
                }
                @if (rIndex === bottomRow()) {
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

  /** When true the board is drawn from black's side: a1 sits top-right. */
  flipped = input<boolean>(false);

  files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  /** Board rows/columns in drawing order. The model is always stored from
      white's point of view, so flipping is purely a matter of which index we
      visit first - every click still reports the true row/col. */
  private static readonly ASC = [0, 1, 2, 3, 4, 5, 6, 7];
  private static readonly DESC = [7, 6, 5, 4, 3, 2, 1, 0];

  displayRows = computed(() => this.flipped() ? BoardComponent.DESC : BoardComponent.ASC);
  displayCols = computed(() => this.flipped() ? BoardComponent.DESC : BoardComponent.ASC);

  /** The column drawn on the left edge and the row drawn on the bottom edge,
      which is where the rank and file labels belong. */
  firstCol = computed(() => this.flipped() ? 7 : 0);
  bottomRow = computed(() => this.flipped() ? 0 : 7);

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
