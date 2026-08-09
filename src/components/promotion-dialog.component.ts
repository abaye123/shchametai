import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../services/i18n.service';

/** The four pieces a pawn may promote to. */
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

interface PromotionOption {
  code: PromotionPiece;
  glyph: string;
  labelKey: 'queen' | 'rook' | 'bishop' | 'knight';
}

@Component({
  selector: 'app-promotion-dialog',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: contents; }

    /* Pieces - the same solid glyph set the board uses, tinted and outlined by
       CSS so a white piece and a black piece read as the same carved shape.
       Keep in sync with .piece-white / .piece-black in board.component.ts. */
    .promo-piece {
      font-size: 2.5rem;
      line-height: 1;
      display: block;
      pointer-events: none;
      transition: transform 0.14s ease-out;
    }

    @media (min-width: 26rem) {
      .promo-piece { font-size: 2.9rem; }
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

    .promo-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem;
    }

    @media (min-width: 26rem) {
      .promo-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }

    /* A tile you press, not a floating pill: flat paper, hairline edge,
       and the only feedback is the edge going brass. */
    .promo-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      padding: 0.9rem 0.5rem 0.7rem;
      min-height: 5.75rem;
      border-radius: 0.75rem;
      border: 1px solid #e6ded1;
      background: #faf7f2;
      cursor: pointer;
      transition: background-color 0.14s ease-out, border-color 0.14s ease-out;
    }

    .promo-btn:hover {
      border-color: #c49a4f;
      background: #fff;
    }

    .promo-btn:hover .promo-piece { transform: translateY(-4%); }

    .promo-btn:active { transform: translateY(1px); }

    .promo-btn:focus-visible {
      outline: none;
      border-color: #946927;
      box-shadow: 0 0 0 3px rgba(148, 105, 39, 0.32);
    }

    .promo-label {
      font-size: 0.6875rem;
      font-weight: 700;
      color: #66594b;
      line-height: 1;
      letter-spacing: 0.04em;
    }
  `],
  template: `
    <div
      class="absolute inset-0 z-30 grid place-items-center rounded-4xl
             bg-sand-900/55 p-4 animate-pop-in"
      (click)="onBackdropClick($event)">

      <div
        class="card shadow-float px-5 py-5 sm:px-6 sm:py-6 text-center max-w-sm w-full"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="i18n.t().promotionTitle">

        <h3 id="promotion-title"
            class="text-[11px] font-bold uppercase tracking-label text-sand-500 mb-3">
          {{ i18n.t().promotionTitle }}
        </h3>

        <div class="promo-grid">
          @for (opt of options; track opt.code) {
            <button
              #optionButton
              type="button"
              class="promo-btn"
              (click)="onChoose(opt.code)"
              [attr.aria-label]="i18n.t()[opt.labelKey]">
              <span
                class="promo-piece"
                [class.piece-white]="color() === 'w'"
                [class.piece-black]="color() === 'b'"
                aria-hidden="true">{{ opt.glyph }}</span>
              <span class="promo-label">{{ i18n.t()[opt.labelKey] }}</span>
            </button>
          }
        </div>

        <button type="button" class="btn-ghost btn-sm w-full mt-3" (click)="onCancel()">
          {{ i18n.t().cancel }}
        </button>
      </div>
    </div>
  `,
})
export class PromotionDialogComponent implements AfterViewInit {
  i18n = inject(I18nService);

  /** Colour of the promoting pawn - only tints the glyphs. */
  color = input.required<'w' | 'b'>();

  choose = output<PromotionPiece>();
  cancel = output<void>();

  /** Queen first: it is the choice in the overwhelming majority of games. */
  readonly options: readonly PromotionOption[] = [
    { code: 'q', glyph: '♛', labelKey: 'queen' },
    { code: 'r', glyph: '♜', labelKey: 'rook' },
    { code: 'b', glyph: '♝', labelKey: 'bishop' },
    { code: 'n', glyph: '♞', labelKey: 'knight' },
  ];

  private firstOption = viewChild<ElementRef<HTMLButtonElement>>('optionButton');

  ngAfterViewInit() {
    // Move focus into the dialog so keyboard and screen-reader users land here.
    this.firstOption()?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.cancel.emit();
  }

  onBackdropClick(event: MouseEvent) {
    // Only the backdrop itself dismisses, never a click inside the card.
    if (event.target === event.currentTarget) {
      this.cancel.emit();
    }
  }

  onChoose(piece: PromotionPiece) {
    this.choose.emit(piece);
  }

  onCancel() {
    this.cancel.emit();
  }
}
