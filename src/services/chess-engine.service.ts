import { Injectable, signal, inject } from '@angular/core';
import { SoundService } from './sound.service';
import { GameHistoryService } from './game-history.service';
import { Position as EnginePosition } from '../engine/position.ts';
import {
  generateLegalMoves,
  getStatus,
  legalMovesFrom,
} from '../engine/movegen.ts';
import {
  BLACK,
  KNIGHT,
  MAX_MOVES,
  PIECE_TO_CHAR,
  QUEEN,
  STARTING_FEN,
  WHITE,
  colOf,
  moveFrom,
  moveIsCastle,
  moveIsEnPassant,
  moveIsPromotion,
  movePromotion,
  moveTo,
  moveToUci,
  pieceColor,
  pieceType,
  rowOf,
  squareOf,
  type ColorCode,
  type GameResult,
  type PackedMove,
  type PieceCode,
} from '../engine/types.ts';

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: Color;
  hasMoved?: boolean;
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece;
  isCastle?: boolean;
  castleRookFrom?: Position;
  castleRookTo?: Position;
  /** Piece a pawn promoted to. Absent on non-promotion moves. */
  promotion?: PieceType;
  isEnPassant?: boolean;
}

/** A move the player has committed to but must still pick a promotion piece for. */
export interface PendingPromotion {
  from: Position;
  to: Position;
  color: Color;
}

const TYPE_CHARS: PieceType[] = ['p', 'p', 'n', 'b', 'r', 'q', 'k'];

/**
 * Angular-facing wrapper around the engine core.
 *
 * All the chess rules and all the performance work live in `src/engine`, which
 * is deliberately framework-free so it can also run inside the Web Worker. This
 * service owns only the signal state the UI binds to, and the translation
 * between the core's integer squares and the `{row, col}` objects the templates
 * already speak.
 *
 * Square numbering matches the UI exactly - `row * 8 + col`, row 0 = rank 8 -
 * so the conversion is arithmetic, not a lookup.
 */
@Injectable({
  providedIn: 'root',
})
export class ChessEngineService {
  private soundService = inject(SoundService);
  private historyService = inject(GameHistoryService);

  /** The authoritative game state. Signals below are projections of it. */
  private pos = EnginePosition.initial();

  /** Scratch buffer for legal move generation. Never resized. */
  private readonly moveBuf = new Int32Array(MAX_MOVES);

  /** UCI move list from the starting position - what the worker replays. */
  private uciHistory: string[] = [];

  // --- State the templates bind to -----------------------------------------
  board = signal<(Piece | null)[][]>([]);
  turn = signal<Color>('w');
  history = signal<Move[]>([]);
  selectedSquare = signal<Position | null>(null);
  validMoves = signal<Position[]>([]);

  isCheck = signal<boolean>(false);
  isCheckmate = signal<boolean>(false);
  isStalemate = signal<boolean>(false);
  winner = signal<Color | null>(null);

  /** Drawn by fifty-move, threefold repetition or insufficient material. */
  isDraw = signal<boolean>(false);
  drawReason = signal<GameResult | null>(null);

  /** Set when a pawn reaches the last rank and the UI must ask which piece. */
  pendingPromotion = signal<PendingPromotion | null>(null);

  constructor() {
    this.resetGame();
  }

  // -------------------------------------------------------------------------
  // Game lifecycle
  // -------------------------------------------------------------------------

  resetGame() {
    this.pos = EnginePosition.initial();
    this.uciHistory = [];
    this.history.set([]);
    this.selectedSquare.set(null);
    this.validMoves.set([]);
    this.pendingPromotion.set(null);
    this.syncFromPosition();
  }

  /** UCI move list, for handing the position to the search worker. */
  getUciHistory(): string[] {
    return this.uciHistory.slice();
  }

  getStartFen(): string {
    return STARTING_FEN;
  }

  getFen(): string {
    return this.pos.toFen();
  }

  /** A snapshot the computer opponent can search without racing the UI. */
  clonePosition(): EnginePosition {
    return this.pos.clone();
  }

  undo() {
    if (this.history().length === 0) return;

    this.pos.unmakeMove();
    this.uciHistory.pop();
    this.history.update(h => h.slice(0, -1));
    this.historyService.removeLastMove();
    this.selectedSquare.set(null);
    this.validMoves.set([]);
    this.pendingPromotion.set(null);
    this.syncFromPosition();
  }

  // -------------------------------------------------------------------------
  // Input handling
  // -------------------------------------------------------------------------

  selectSquare(row: number, col: number) {
    if (this.isGameOver() || this.pendingPromotion()) return;

    const sq = squareOf(row, col);
    const selected = this.selectedSquare();

    if (selected) {
      const isTarget = this.validMoves().some(m => m.row === row && m.col === col);
      if (isTarget) {
        this.commitMove(squareOf(selected.row, selected.col), sq);
        return;
      }
    }

    const piece = this.pos.squares[sq];
    if (piece !== 0 && this.colorChar(pieceColor(piece)) === this.turn()) {
      this.selectedSquare.set({ row, col });
      this.validMoves.set(
        legalMovesFrom(this.pos, sq).map(m => this.toPosition(moveTo(m))),
      );
    } else {
      this.selectedSquare.set(null);
      this.validMoves.set([]);
    }
  }

  /**
   * Resolves a from/to pair against the real legal move list and plays it.
   * When the move is a promotion and no piece was chosen, the move is parked in
   * `pendingPromotion` and the UI is expected to ask. Everything goes through
   * here, so an illegal move can never reach the board - the previous engine
   * let the AI write moves straight onto the board without revalidating them.
   */
  private commitMove(fromSq: number, toSq: number, promotion?: PieceCode): boolean {
    const candidates = legalMovesFrom(this.pos, fromSq).filter(m => moveTo(m) === toSq);
    if (candidates.length === 0) return false;

    if (candidates.length > 1 && moveIsPromotion(candidates[0]) && promotion === undefined) {
      this.pendingPromotion.set({
        from: this.toPosition(fromSq),
        to: this.toPosition(toSq),
        color: this.turn(),
      });
      return false;
    }

    const chosen = promotion !== undefined
      ? candidates.find(m => movePromotion(m) === promotion) ?? candidates[0]
      : candidates[0];

    this.playMove(chosen, false);
    return true;
  }

  /** Called by the promotion dialog. */
  choosePromotion(type: 'q' | 'r' | 'b' | 'n') {
    const pending = this.pendingPromotion();
    if (!pending) return;

    this.pendingPromotion.set(null);
    const codes: Record<string, PieceCode> = { q: QUEEN, r: 4, b: 3, n: KNIGHT };
    this.commitMove(
      squareOf(pending.from.row, pending.from.col),
      squareOf(pending.to.row, pending.to.col),
      codes[type],
    );
  }

  cancelPromotion() {
    this.pendingPromotion.set(null);
    this.selectedSquare.set(null);
    this.validMoves.set([]);
  }

  /**
   * Plays a move given as coordinates. Used by the computer opponent and by
   * replay. `skipSideEffects` suppresses sound and history recording, which is
   * what replay needs so it does not re-record the moves it is replaying.
   */
  makeMove(from: Position, to: Position, skipSideEffects = false): boolean {
    const fromSq = squareOf(from.row, from.col);
    const toSq = squareOf(to.row, to.col);
    const candidates = legalMovesFrom(this.pos, fromSq).filter(m => moveTo(m) === toSq);
    if (candidates.length === 0) return false;

    // Old saved games predate promotion choice, so default to a queen.
    const chosen = candidates.find(m => movePromotion(m) === QUEEN) ?? candidates[0];
    this.playMove(chosen, skipSideEffects);
    return true;
  }

  /** Plays a move already in the engine's packed form. */
  playPackedMove(move: PackedMove, skipSideEffects = false): boolean {
    if (move === 0) return false;
    this.playMove(move, skipSideEffects);
    return true;
  }

  /**
   * Converts a saved game's move list into UCI, by replaying it on a scratch
   * position. Needed because saved games store `{from, to}` coordinates, while
   * the analyser speaks UCI. Replaying is also what resolves the promotion
   * piece for games recorded before promotion choice existed.
   *
   * Stops at the first move that will not replay, returning what it had.
   */
  uciForMoves(moves: { from: Position; to: Position; promotion?: PieceType }[]): string[] {
    const scratch = EnginePosition.initial();
    const buf = new Int32Array(MAX_MOVES);
    const out: string[] = [];

    for (const move of moves) {
      const fromSq = squareOf(move.from.row, move.from.col);
      const toSq = squareOf(move.to.row, move.to.col);
      const n = generateLegalMoves(scratch, buf, 0);

      let chosen = 0;
      let fallback = 0;
      for (let i = 0; i < n; i++) {
        const m = buf[i];
        if (moveFrom(m) !== fromSq || moveTo(m) !== toSq) continue;
        if (!fallback) fallback = m;
        const promoChar = movePromotion(m) ? PIECE_TO_CHAR[movePromotion(m)] : undefined;
        if (promoChar === move.promotion) { chosen = m; break; }
        if (!move.promotion && movePromotion(m) === QUEEN) chosen = m;
      }

      const played = chosen || fallback;
      if (!played) break;

      out.push(moveToUci(played));
      scratch.makeMove(played);
    }

    return out;
  }

  /** Resolves a UCI string ("e2e4", "e7e8q") against the legal moves. */
  findUciMove(uci: string): PackedMove {
    const n = generateLegalMoves(this.pos, this.moveBuf, 0);
    for (let i = 0; i < n; i++) {
      if (moveToUci(this.moveBuf[i]) === uci) return this.moveBuf[i];
    }
    if (uci.length === 4) {
      for (let i = 0; i < n; i++) {
        if (moveToUci(this.moveBuf[i]) === uci + 'q') return this.moveBuf[i];
      }
    }
    return 0;
  }

  // -------------------------------------------------------------------------
  // Applying a move
  // -------------------------------------------------------------------------

  private playMove(move: PackedMove, skipSideEffects: boolean) {
    const record = this.describeMove(move);

    if (!this.pos.makeMove(move)) return;
    this.uciHistory.push(moveToUci(move));

    this.history.update(h => [...h, record]);
    this.selectedSquare.set(null);
    this.validMoves.set([]);

    if (!skipSideEffects) {
      this.historyService.recordMove(record);
    }

    this.syncFromPosition();

    if (!skipSideEffects) {
      this.triggerMoveSound(!!record.captured);
    }
  }

  /**
   * Builds the UI-facing move record. Must run BEFORE the move is applied,
   * while the moving piece and the victim are still on their squares.
   */
  private describeMove(move: PackedMove): Move {
    const fromSq = moveFrom(move);
    const toSq = moveTo(move);
    const movingCode = this.pos.squares[fromSq];
    const color = pieceColor(movingCode);

    const record: Move = {
      from: this.toPosition(fromSq),
      to: this.toPosition(toSq),
      piece: { type: TYPE_CHARS[pieceType(movingCode)], color: this.colorChar(color) },
    };

    if (moveIsEnPassant(move)) {
      // The victim sits beside the destination square, not on it.
      record.captured = { type: 'p', color: this.colorChar(color === WHITE ? BLACK : WHITE) };
      record.isEnPassant = true;
    } else {
      const victim = this.pos.squares[toSq];
      if (victim !== 0) {
        record.captured = {
          type: TYPE_CHARS[pieceType(victim)],
          color: this.colorChar(pieceColor(victim)),
        };
      }
    }

    if (moveIsPromotion(move)) {
      record.promotion = PIECE_TO_CHAR[movePromotion(move)] as PieceType;
    }

    if (moveIsCastle(move)) {
      const row = rowOf(fromSq);
      const kingSide = colOf(toSq) > colOf(fromSq);
      record.isCastle = true;
      record.castleRookFrom = { row, col: kingSide ? 7 : 0 };
      record.castleRookTo = { row, col: kingSide ? 5 : 3 };
    }

    return record;
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  isGameOver(): boolean {
    return this.isCheckmate() || this.isStalemate() || this.isDraw();
  }

  /**
   * Recomputes every projected signal from the core position. One place to
   * change when the core grows a new terminal condition.
   */
  private syncFromPosition() {
    this.board.set(this.buildBoardArray());
    this.turn.set(this.colorChar(this.pos.turn));

    const status = getStatus(this.pos);
    this.isCheck.set(status.inCheck);

    const checkmate = status.result === 'checkmate';
    const stalemate = status.result === 'stalemate';
    const drawn = status.result === 'fifty-move'
      || status.result === 'threefold'
      || status.result === 'insufficient-material';

    this.isCheckmate.set(checkmate);
    this.isStalemate.set(stalemate);
    this.isDraw.set(drawn);
    this.drawReason.set(drawn ? status.result : null);

    if (checkmate && status.winner !== null) {
      const winnerColor = this.colorChar(status.winner);
      this.winner.set(winnerColor);
      this.historyService.updateGameResult(winnerColor === 'w' ? 'white' : 'black');
    } else {
      // Clearing this matters: the previous engine left `winner` set after an
      // undo from mate, which soft-locked the board because every click was
      // rejected as "game already over".
      this.winner.set(null);
      if (stalemate || drawn) {
        this.historyService.updateGameResult('draw');
      }
    }
  }

  private buildBoardArray(): (Piece | null)[][] {
    const rows: (Piece | null)[][] = new Array(8);
    for (let r = 0; r < 8; r++) {
      const row: (Piece | null)[] = new Array(8);
      for (let c = 0; c < 8; c++) {
        const code = this.pos.squares[(r << 3) | c];
        row[c] = code === 0
          ? null
          : { type: TYPE_CHARS[pieceType(code)], color: this.colorChar(pieceColor(code)) };
      }
      rows[r] = row;
    }
    return rows;
  }

  private triggerMoveSound(wasCapture: boolean) {
    if (this.isCheckmate()) {
      this.soundService.play('checkmate');
    } else if (this.isStalemate() || this.isDraw()) {
      this.soundService.play('game-over');
    } else if (this.isCheck()) {
      this.soundService.play('check');
    } else if (wasCapture) {
      this.soundService.play('capture');
    } else {
      this.soundService.play('move');
    }
  }

  // -------------------------------------------------------------------------
  // Conversions
  // -------------------------------------------------------------------------

  private toPosition(sq: number): Position {
    return { row: rowOf(sq), col: colOf(sq) };
  }

  private colorChar(c: ColorCode): Color {
    return c === WHITE ? 'w' : 'b';
  }
}
