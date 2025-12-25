import { Injectable, signal, computed, inject } from '@angular/core';
import { SoundService } from './sound.service';
import { GameHistoryService } from './game-history.service';

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: Color;
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
}

@Injectable({
  providedIn: 'root'
})
export class ChessEngineService {
  private soundService = inject(SoundService);
  private historyService = inject(GameHistoryService);

  // State
  board = signal<(Piece | null)[][]>([]);
  turn = signal<Color>('w');
  history = signal<Move[]>([]);
  selectedSquare = signal<Position | null>(null);
  validMoves = signal<Position[]>([]);
  
  // Game Status
  isCheck = signal<boolean>(false);
  isCheckmate = signal<boolean>(false);
  isStalemate = signal<boolean>(false);
  winner = signal<Color | null>(null);

  constructor() {
    this.resetGame();
  }

  resetGame() {
    this.board.set(this.createInitialBoard());
    this.turn.set('w');
    this.history.set([]);
    this.selectedSquare.set(null);
    this.validMoves.set([]);
    this.isCheck.set(false);
    this.isCheckmate.set(false);
    this.isStalemate.set(false);
    this.winner.set(null);
  }

  undo() {
    const hist = this.history();
    if (hist.length === 0) return;

    const lastMove = hist[hist.length - 1];
    
    // Revert board
    const newBoard = this.copyBoard(this.board());
    newBoard[lastMove.from.row][lastMove.from.col] = lastMove.piece;
    newBoard[lastMove.to.row][lastMove.to.col] = lastMove.captured || null;

    // Handle castling revert (simplified: ignoring complex castling rights restore for now)
    
    this.board.set(newBoard);
    this.history.update(h => h.slice(0, -1));
    this.turn.set(this.turn() === 'w' ? 'b' : 'w');
    this.selectedSquare.set(null);
    this.validMoves.set([]);
    
    this.updateGameStatus();
  }

  selectSquare(row: number, col: number) {
    if (this.winner() || this.isCheckmate() || this.isStalemate()) return;

    const piece = this.board()[row][col];
    const selected = this.selectedSquare();

    // If we have a selected piece and click on a valid move
    if (selected) {
      const isMove = this.validMoves().some(m => m.row === row && m.col === col);
      if (isMove) {
        this.makeMove(selected, { row, col });
        return;
      }
    }

    // If clicked on own piece, select it
    if (piece && piece.color === this.turn()) {
      this.selectedSquare.set({ row, col });
      this.validMoves.set(this.getValidMoves({ row, col }, this.board()));
    } else {
      this.selectedSquare.set(null);
      this.validMoves.set([]);
    }
  }

  makeMove(from: Position, to: Position, skipHistoryRecord = false) {
    const board = this.board();
    const piece = board[from.row][from.col];
    
    if (!piece) {
      console.warn('Attempted to move non-existent piece');
      return;
    }
    
    const captured = board[to.row][to.col];

    const newBoard = this.copyBoard(board);
    newBoard[to.row][to.col] = piece;
    newBoard[from.row][from.col] = null;

    // Pawn promotion (auto Queen for simplicity)
    if (piece.type === 'p' && (to.row === 0 || to.row === 7)) {
      newBoard[to.row][to.col] = { type: 'q', color: piece.color };
    }

    const move: Move = { from, to, piece, captured: captured || undefined };

    this.board.set(newBoard);
    this.history.update(h => [...h, move]);
    this.turn.set(this.turn() === 'w' ? 'b' : 'w');
    this.selectedSquare.set(null);
    this.validMoves.set([]);

    // Record move in history service only if not skipping
    if (!skipHistoryRecord) {
      this.historyService.recordMove(move);
    }

    this.updateGameStatus();
    
    if (!skipHistoryRecord) {
      this.triggerMoveSound(!!captured);
    }
  }

  private triggerMoveSound(wasCapture: boolean) {
    if (this.isCheckmate()) {
      this.soundService.play('checkmate');
    } else if (this.isStalemate()) {
      this.soundService.play('game-over');
    } else if (this.isCheck()) {
      this.soundService.play('check');
    } else if (wasCapture) {
      this.soundService.play('capture');
    } else {
      this.soundService.play('move');
    }
  }

  private updateGameStatus() {
    const currentTurn = this.turn();
    const board = this.board();
    const inCheck = this.isKingInCheck(currentTurn, board);
    this.isCheck.set(inCheck);

    const hasMoves = this.hasAnyValidMoves(currentTurn, board);

    if (!hasMoves) {
      if (inCheck) {
        this.isCheckmate.set(true);
        const winnerColor = currentTurn === 'w' ? 'b' : 'w';
        this.winner.set(winnerColor);
        // Update game result in history
        this.historyService.updateGameResult(winnerColor === 'w' ? 'white' : 'black');
      } else {
        this.isStalemate.set(true);
        // Update game result as draw
        this.historyService.updateGameResult('draw');
      }
    } else {
        this.isCheckmate.set(false);
        this.isStalemate.set(false);
    }
  }

  // --- Logic Helpers ---

  getValidMoves(pos: Position, board: (Piece | null)[][], checkSafety = true): Position[] {
    const piece = board[pos.row][pos.col];
    if (!piece) return [];

    let moves: Position[] = [];

    switch (piece.type) {
      case 'p': moves = this.getPawnMoves(pos, piece.color, board); break;
      case 'r': moves = this.getSlidingMoves(pos, [[0,1], [0,-1], [1,0], [-1,0]], board); break;
      case 'b': moves = this.getSlidingMoves(pos, [[1,1], [1,-1], [-1,1], [-1,-1]], board); break;
      case 'q': moves = this.getSlidingMoves(pos, [[0,1], [0,-1], [1,0], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1]], board); break;
      case 'n': moves = this.getSteppingMoves(pos, [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]], board); break;
      case 'k': moves = this.getSteppingMoves(pos, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], board); break;
    }

    if (checkSafety) {
      moves = moves.filter(move => {
        const newBoard = this.copyBoard(board);
        newBoard[move.row][move.col] = newBoard[pos.row][pos.col];
        newBoard[pos.row][pos.col] = null;
        return !this.isKingInCheck(piece.color, newBoard);
      });
    }

    return moves;
  }

  private getPawnMoves(pos: Position, color: Color, board: (Piece | null)[][]): Position[] {
    const moves: Position[] = [];
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;

    // Forward 1
    if (this.isValidPos(pos.row + dir, pos.col) && !board[pos.row + dir][pos.col]) {
      moves.push({ row: pos.row + dir, col: pos.col });
      // Forward 2
      if (pos.row === startRow && this.isValidPos(pos.row + dir * 2, pos.col) && !board[pos.row + dir * 2][pos.col]) {
        moves.push({ row: pos.row + dir * 2, col: pos.col });
      }
    }

    // Captures
    const captureOffsets = [[dir, -1], [dir, 1]];
    for (const [dr, dc] of captureOffsets) {
      const r = pos.row + dr, c = pos.col + dc;
      if (this.isValidPos(r, c)) {
        const target = board[r][c];
        if (target && target.color !== color) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  }

  private getSlidingMoves(pos: Position, dirs: number[][], board: (Piece | null)[][]): Position[] {
    const moves: Position[] = [];
    const piece = board[pos.row][pos.col]!;

    for (const [dr, dc] of dirs) {
      let r = pos.row + dr;
      let c = pos.col + dc;
      while (this.isValidPos(r, c)) {
        const target = board[r][c];
        if (!target) {
          moves.push({ row: r, col: c });
        } else {
          if (target.color !== piece.color) moves.push({ row: r, col: c });
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  private getSteppingMoves(pos: Position, offsets: number[][], board: (Piece | null)[][]): Position[] {
    const moves: Position[] = [];
    const piece = board[pos.row][pos.col]!;
    
    for (const [dr, dc] of offsets) {
      const r = pos.row + dr, c = pos.col + dc;
      if (this.isValidPos(r, c)) {
        const target = board[r][c];
        if (!target || target.color !== piece.color) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  }

  private isKingInCheck(color: Color, board: (Piece | null)[][]): boolean {
    let kingPos: Position | null = null;
    
    // Find King
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === color) {
          kingPos = { row: r, col: c };
          break;
        }
      }
      if (kingPos) break;
    }

    if (!kingPos) return false; // Should not happen

    // Check if any opponent piece attacks the king
    const opponent = color === 'w' ? 'b' : 'w';
    
    // Very simplified: Iterate all opponent pieces and see if they can move to kingPos
    // Note: getValidMoves with checkSafety=false avoids infinite recursion
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === opponent) {
          const moves = this.getValidMoves({ row: r, col: c }, board, false);
          if (moves.some(m => m.row === kingPos!.row && m.col === kingPos!.col)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private hasAnyValidMoves(color: Color, board: (Piece | null)[][]): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color) {
          const moves = this.getValidMoves({ row: r, col: c }, board, true);
          if (moves.length > 0) return true;
        }
      }
    }
    return false;
  }

  private isValidPos(r: number, c: number) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  private copyBoard(board: (Piece | null)[][]): (Piece | null)[][] {
    return board.map(row => row.slice());
  }

  private createInitialBoard(): (Piece | null)[][] {
    const board: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    const setupRow = (row: number, color: Color, pieces: PieceType[]) => {
      pieces.forEach((type, col) => board[row][col] = { type, color });
    };

    const backRow: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    setupRow(0, 'b', backRow);
    setupRow(1, 'b', Array(8).fill('p'));
    setupRow(6, 'w', Array(8).fill('p'));
    setupRow(7, 'w', backRow);

    return board;
  }
}
