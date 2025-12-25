import { Injectable, signal, inject } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { ChessEngineService, Color, Piece } from './chess-engine.service';
import { I18nService } from './i18n.service';

@Injectable({
  providedIn: 'root'
})
export class AiHintsService {
  private chess = inject(ChessEngineService);
  private i18n = inject(I18nService);

  isThinking = signal<boolean>(false);
  lastHint = signal<string>('');

  /**
   * Get an AI-powered hint for the current position
   * @param apiKey The Gemini API key
   * @returns The hint text or error message
   */
  async getHint(apiKey: string): Promise<string> {
    // Check if API key is provided
    if (!apiKey || apiKey.trim() === '') {
      return this.i18n.currentLang() === 'he' 
        ? 'לא מוגדר מפתח API של ג׳מיני'
        : 'Gemini API key not configured';
    }

    this.isThinking.set(true);

    try {
      // Initialize Gemini AI
      const genAI = new GoogleGenAI({ apiKey });

      // Build the prompt
      const prompt = this.buildPrompt();

      // Get response from AI
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const hint = result.text || '';

      if (!hint) {
        const errorMsg = this.i18n.currentLang() === 'he'
          ? 'לא התקבלה תשובה מ-AI'
          : 'No response received from AI';
        this.lastHint.set(errorMsg);
        return errorMsg;
      }

      this.lastHint.set(hint);
      return hint;

    } catch (error: any) {
      console.error('AI Hint Error:', error);
      
      // Handle specific error cases
      if (error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('API key')) {
        const errorMsg = this.i18n.currentLang() === 'he'
          ? 'מפתח API לא תקין. אנא בדוק את ההגדרות.'
          : 'Invalid API key. Please check your settings.';
        this.lastHint.set(errorMsg);
        return errorMsg;
      }

      const errorMsg = this.i18n.currentLang() === 'he'
        ? 'שגיאה בקבלת עצה מ-AI. אנא נסה שוב.'
        : 'Error getting AI hint. Please try again.';
      this.lastHint.set(errorMsg);
      return errorMsg;

    } finally {
      this.isThinking.set(false);
    }
  }

  /**
   * Build the prompt for the AI based on current game state
   */
  private buildPrompt(): string {
    const board = this.chess.board();
    const turn = this.chess.turn();
    const isCheck = this.chess.isCheck();
    const history = this.chess.history();
    const lang = this.i18n.currentLang();

    // Convert board to FEN-like representation
    const boardState = this.boardToText(board);
    
    // Get last few moves for context
    const recentMoves = history.slice(-3).map((move, idx) => {
      const from = this.posToNotation(move.from);
      const to = this.posToNotation(move.to);
      return `${history.length - 3 + idx + 1}. ${this.pieceTypeToName(move.piece.type)} ${from}-${to}`;
    }).join('\n');

    const prompt = lang === 'he' ? `
אתה מאמן שחמט מומחה. אנא ספק עצה קצרה ומועילה (2-3 משפטים) לשחקן הנוכחי.

מצב הלוח:
${boardState}

תור נוכחי: ${turn === 'w' ? 'לבן' : 'שחור'}
${isCheck ? 'המלך בשח!' : ''}

מהלכים אחרונים:
${recentMoves || 'אין מהלכים קודמים'}

אנא ספק עצה טקטית או אסטרטגית קצרה בעברית. התמקד במהלך הטוב הבא או באיום חשוב.
עצתך צריכה להיות מעשית ולעזור לשחקן לשפר את מצבו.
` : `
You are an expert chess coach. Please provide a brief, helpful hint (2-3 sentences) for the current player.

Board State:
${boardState}

Current Turn: ${turn === 'w' ? 'White' : 'Black'}
${isCheck ? 'King is in check!' : ''}

Recent Moves:
${recentMoves || 'No previous moves'}

Please provide a brief tactical or strategic hint in English. Focus on the next good move or important threat.
Your hint should be practical and help the player improve their position.
`;

    return prompt;
  }

  /**
   * Convert board to text representation
   */
  private boardToText(board: (Piece | null)[][]): string {
    const lines: string[] = [];
    
    for (let row = 0; row < 8; row++) {
      const rank = 8 - row;
      const pieces = board[row].map(piece => {
        if (!piece) return '.';
        const symbol = this.pieceToSymbol(piece);
        return symbol;
      }).join(' ');
      lines.push(`${rank} ${pieces}`);
    }
    lines.push('  a b c d e f g h');
    
    return lines.join('\n');
  }

  /**
   * Convert piece to symbol
   */
  private pieceToSymbol(piece: Piece): string {
    const symbols: Record<string, string> = {
      'w-k': '♔', 'w-q': '♕', 'w-r': '♖', 'w-b': '♗', 'w-n': '♘', 'w-p': '♙',
      'b-k': '♚', 'b-q': '♛', 'b-r': '♜', 'b-b': '♝', 'b-n': '♞', 'b-p': '♟'
    };
    return symbols[`${piece.color}-${piece.type}`] || '?';
  }

  /**
   * Convert position to chess notation
   */
  private posToNotation(pos: { row: number; col: number }): string {
    const file = String.fromCharCode(97 + pos.col); // a-h
    const rank = 8 - pos.row; // 8-1
    return `${file}${rank}`;
  }

  /**
   * Convert piece type to name
   */
  private pieceTypeToName(type: string): string {
    const names: Record<string, string> = {
      'p': 'P', 'r': 'R', 'n': 'N', 'b': 'B', 'q': 'Q', 'k': 'K'
    };
    return names[type] || type;
  }
}
