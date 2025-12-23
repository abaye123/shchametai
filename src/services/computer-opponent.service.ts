import { Injectable, inject } from '@angular/core';
import { ChessEngineService, Color, Piece, Position, Move } from './chess-engine.service';

@Injectable({
  providedIn: 'root'
})
export class ComputerOpponentService {
  private chess = inject(ChessEngineService);

  // Piece values for evaluation
  private readonly PIECE_VALUES: Record<string, number> = {
    'p': 10,
    'n': 30,
    'b': 30,
    'r': 50,
    'q': 90,
    'k': 900
  };

  /**
   * Calculates the best move for the given color and difficulty.
   * Returns a promise to allow the UI to update before processing (avoid freeze).
   */
  async getBestMove(color: Color, difficulty: 'easy' | 'medium' | 'hard'): Promise<{from: Position, to: Position} | null> {
    return new Promise(resolve => {
      setTimeout(() => {
        const board = this.chess.board();
        
        // Easy: Random move
        if (difficulty === 'easy') {
          resolve(this.getRandomMove(board, color));
          return;
        }

        // Medium/Hard: Minimax
        // Medium = depth 2, Hard = depth 3 (depth 4 is significantly slower in JS without heavy optimization)
        const depth = difficulty === 'medium' ? 2 : 3;
        const bestMove = this.minimaxRoot(board, depth, true, color);
        resolve(bestMove);
      }, 100);
    });
  }

  private getRandomMove(board: (Piece | null)[][], color: Color): {from: Position, to: Position} | null {
    const allMoves = this.getAllValidMoves(board, color);
    if (allMoves.length === 0) return null;
    const randomIdx = Math.floor(Math.random() * allMoves.length);
    return allMoves[randomIdx];
  }

  private minimaxRoot(
    board: (Piece | null)[][], 
    depth: number, 
    isMaximizing: boolean,
    playerColor: Color
  ): {from: Position, to: Position} | null {
    
    const allMoves = this.getAllValidMoves(board, playerColor);
    if (allMoves.length === 0) return null;

    let bestMove = null;
    let bestValue = -Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    // Randomize order slightly to vary play
    allMoves.sort(() => Math.random() - 0.5);

    for (const move of allMoves) {
      const newBoard = this.simulateMove(board, move);
      const value = this.minimax(newBoard, depth - 1, alpha, beta, false, playerColor);
      
      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }
      alpha = Math.max(alpha, bestValue);
    }

    return bestMove;
  }

  private minimax(
    board: (Piece | null)[][], 
    depth: number, 
    alpha: number, 
    beta: number, 
    isMaximizing: boolean,
    playerColor: Color
  ): number {
    
    if (depth === 0) {
      return this.evaluateBoard(board, playerColor);
    }

    const currentColor = isMaximizing ? playerColor : (playerColor === 'w' ? 'b' : 'w');
    const allMoves = this.getAllValidMoves(board, currentColor);

    if (allMoves.length === 0) {
      // Checkmate or Stalemate check could go here, for now return eval
      return this.evaluateBoard(board, playerColor);
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of allMoves) {
        const newBoard = this.simulateMove(board, move);
        const evalVal = this.minimax(newBoard, depth - 1, alpha, beta, false, playerColor);
        maxEval = Math.max(maxEval, evalVal);
        alpha = Math.max(alpha, evalVal);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of allMoves) {
        const newBoard = this.simulateMove(board, move);
        const evalVal = this.minimax(newBoard, depth - 1, alpha, beta, true, playerColor);
        minEval = Math.min(minEval, evalVal);
        beta = Math.min(beta, evalVal);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  private evaluateBoard(board: (Piece | null)[][], playerColor: Color): number {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const value = this.PIECE_VALUES[piece.type] || 0;
          // Position bonus logic could be added here
          const pieceValue = piece.color === playerColor ? value : -value;
          score += pieceValue;
        }
      }
    }
    return score;
  }

  // --- Helpers to avoid modifying the main game service state directly during simulation ---

  private getAllValidMoves(board: (Piece | null)[][], color: Color): {from: Position, to: Position}[] {
    const moves: {from: Position, to: Position}[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.color === color) {
          // Using the existing engine helper but we need to be careful not to rely on its internal state
          // The engine's getValidMoves expects the board it is passed.
          const pieceMoves = this.chess.getValidMoves({row: r, col: c}, board, true);
          pieceMoves.forEach(to => moves.push({ from: {row: r, col: c}, to }));
        }
      }
    }
    return moves;
  }

  private simulateMove(board: (Piece | null)[][], move: {from: Position, to: Position}): (Piece | null)[][] {
    const newBoard = board.map(row => row.slice());
    const piece = newBoard[move.from.row][move.from.col]!;
    newBoard[move.to.row][move.to.col] = piece;
    newBoard[move.from.row][move.from.col] = null;
    
    // Simple promotion for AI simulation
    if (piece.type === 'p' && (move.to.row === 0 || move.to.row === 7)) {
       newBoard[move.to.row][move.to.col] = { type: 'q', color: piece.color };
    }
    return newBoard;
  }
}