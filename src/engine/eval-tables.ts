/**
 * Piece-square tables.
 *
 * ORIENTATION - read this before touching a number.
 *
 * The engine numbers squares `row * 8 + col` with row 0 = rank 8, so square 0
 * is a8 and square 63 is h1. Every table below is written in that same order:
 * the FIRST row of literals is rank 8 and the LAST row is rank 1, which means
 * the arrays read visually like a printed board seen from white's side.
 *
 * That layout is also the one the classic published tables use, so the values
 * can be indexed directly by square for WHITE with no transformation at all.
 * For BLACK, mirror the rank with `sq ^ 56` (row r becomes 7 - r, file kept).
 *
 * Worked example, to make the convention checkable:
 *   a white pawn on e4 -> file e = col 4, rank 4 -> row 8 - 4 = 4
 *                      -> sq = 4 * 8 + 4 = 36
 *   PAWN_MG[36] is the 5th row, 5th column = 20, a centre-pawn bonus.
 *   The same pawn on a3 -> sq 40 -> PAWN_MG[40] = 5.
 *   So e4 outscores a3, which is the behaviour we want.
 *
 * All values are centipawns.
 */

export const PAWN_MG = new Int16Array([
    0,   0,   0,   0,   0,   0,   0,   0,
   50,  50,  50,  50,  50,  50,  50,  50,
   10,  10,  20,  30,  30,  20,  10,  10,
    5,   5,  10,  25,  25,  10,   5,   5,
    0,   0,   0,  20,  20,   0,   0,   0,
    5,  -5, -10,   0,   0, -10,  -5,   5,
    5,  10,  10, -20, -20,  10,  10,   5,
    0,   0,   0,   0,   0,   0,   0,   0,
]);

/** In the endgame only advancement matters; the shelter bias disappears. */
export const PAWN_EG = new Int16Array([
    0,   0,   0,   0,   0,   0,   0,   0,
   90,  90,  90,  90,  90,  90,  90,  90,
   55,  55,  55,  55,  55,  55,  55,  55,
   32,  32,  32,  32,  32,  32,  32,  32,
   18,  18,  18,  18,  18,  18,  18,  18,
    8,   8,   8,   8,   8,   8,   8,   8,
    4,   4,   4,   4,   4,   4,   4,   4,
    0,   0,   0,   0,   0,   0,   0,   0,
]);

export const KNIGHT_MG = new Int16Array([
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20,   0,   0,   0,   0, -20, -40,
  -30,   0,  10,  15,  15,  10,   0, -30,
  -30,   5,  15,  20,  20,  15,   5, -30,
  -30,   0,  15,  20,  20,  15,   0, -30,
  -30,   5,  10,  15,  15,  10,   5, -30,
  -40, -20,   0,   5,   5,   0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
]);

export const KNIGHT_EG = new Int16Array([
  -40, -30, -20, -20, -20, -20, -30, -40,
  -30, -15,  -5,  -5,  -5,  -5, -15, -30,
  -20,  -5,   5,  10,  10,   5,  -5, -20,
  -20,   0,  10,  15,  15,  10,   0, -20,
  -20,   0,  10,  15,  15,  10,   0, -20,
  -20,  -5,   5,  10,  10,   5,  -5, -20,
  -30, -15,  -5,  -5,  -5,  -5, -15, -30,
  -40, -30, -20, -20, -20, -20, -30, -40,
]);

export const BISHOP_MG = new Int16Array([
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,  10,  10,   5,   0, -10,
  -10,   5,   5,  10,  10,   5,   5, -10,
  -10,   0,  10,  10,  10,  10,   0, -10,
  -10,  10,  10,  10,  10,  10,  10, -10,
  -10,   5,   0,   0,   0,   0,   5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
]);

export const BISHOP_EG = new Int16Array([
  -15, -10,  -8,  -8,  -8,  -8, -10, -15,
  -10,   0,   0,   0,   0,   0,   0, -10,
   -8,   0,   5,   8,   8,   5,   0,  -8,
   -8,   3,   8,  12,  12,   8,   3,  -8,
   -8,   0,   8,  12,  12,   8,   0,  -8,
   -8,   5,   5,   8,   8,   5,   5,  -8,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -15, -10,  -8,  -8,  -8,  -8, -10, -15,
]);

/** Row 1 is rank 7 - the rook-on-the-seventh bonus lives there. */
export const ROOK_MG = new Int16Array([
    0,   0,   0,   0,   0,   0,   0,   0,
    5,  10,  10,  10,  10,  10,  10,   5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
    0,   0,   0,   5,   5,   0,   0,   0,
]);

export const ROOK_EG = new Int16Array([
    5,   5,   5,   5,   5,   5,   5,   5,
   10,  10,  10,  10,  10,  10,  10,  10,
    0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,
]);

export const QUEEN_MG = new Int16Array([
  -20, -10, -10,  -5,  -5, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,   5,   5,   5,   0, -10,
   -5,   0,   5,   5,   5,   5,   0,  -5,
    0,   0,   5,   5,   5,   5,   0,  -5,
  -10,   5,   5,   5,   5,   5,   0, -10,
  -10,   0,   5,   0,   0,   0,   0, -10,
  -20, -10, -10,  -5,  -5, -10, -10, -20,
]);

export const QUEEN_EG = new Int16Array([
  -10,  -6,  -6,  -3,  -3,  -6,  -6, -10,
   -6,   0,   3,   3,   3,   3,   0,  -6,
   -6,   3,   6,   6,   6,   6,   3,  -6,
   -3,   3,   6,   9,   9,   6,   3,  -3,
   -3,   3,   6,   9,   9,   6,   3,  -3,
   -6,   3,   6,   6,   6,   6,   3,  -6,
   -6,   0,   3,   3,   3,   3,   0,  -6,
  -10,  -6,  -6,  -3,  -3,  -6,  -6, -10,
]);

/** Midgame: hide in a corner. The last row is rank 1, so g1 scoring 30 is
 *  exactly the reward for having castled king-side. */
export const KING_MG = new Int16Array([
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
   20,  20,   0,   0,   0,   0,  20,  20,
   20,  30,  10,   0,   0,  10,  30,  20,
]);

/** Endgame: the king is a fighting piece and belongs in the centre. */
export const KING_EG = new Int16Array([
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10,   0,   0, -10, -20, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -30,   0,   0,   0,   0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
]);

/** Indexed by piece code (1 = pawn .. 6 = king); slot 0 is unused. */
export const PST_MG: (Int16Array | null)[] =
  [null, PAWN_MG, KNIGHT_MG, BISHOP_MG, ROOK_MG, QUEEN_MG, KING_MG];

export const PST_EG: (Int16Array | null)[] =
  [null, PAWN_EG, KNIGHT_EG, BISHOP_EG, ROOK_EG, QUEEN_EG, KING_EG];

/**
 * Non-linear king-safety curve. Indexed by an accumulated attack weight; the
 * penalty grows far faster than the number of attackers, which is what makes
 * a third attacker on the king so much more dangerous than a second.
 */
export const KING_SAFETY_TABLE = new Int16Array([
    0,   0,   1,   2,   3,   5,   7,   9,  12,  15,
   18,  22,  26,  30,  35,  39,  44,  50,  56,  62,
   68,  75,  82,  85,  89,  97, 105, 113, 122, 131,
  140, 150, 169, 180, 191, 202, 213, 225, 237, 248,
  260, 272, 283, 295, 307, 319, 330, 342, 354, 366,
  377, 389, 401, 412, 424, 436, 448, 459, 471, 483,
  494, 500, 500, 500, 500, 500, 500, 500, 500, 500,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
]);

/**
 * Passed-pawn bonus by how far the pawn has advanced, from its own side's
 * point of view (0 = home rank, 6 = one square from promoting).
 */
export const PASSED_PAWN_MG = new Int16Array([0, 5, 10, 20, 35, 60, 100, 0]);
export const PASSED_PAWN_EG = new Int16Array([0, 15, 25, 45, 75, 120, 180, 0]);

/** Distance between two squares, measured in king moves. Precomputed 64x64. */
export const KING_DISTANCE = new Int8Array(64 * 64);
for (let a = 0; a < 64; a++) {
  for (let b = 0; b < 64; b++) {
    const dr = Math.abs((a >> 3) - (b >> 3));
    const dc = Math.abs((a & 7) - (b & 7));
    KING_DISTANCE[a * 64 + b] = Math.max(dr, dc);
  }
}

/**
 * How far a square is from the nearest corner. Driving the defending king to a
 * corner is the whole technique for mating with K+Q or K+R, so the winning side
 * gets a bonus for shrinking this.
 */
export const CORNER_DISTANCE = new Int8Array(64);
for (let sq = 0; sq < 64; sq++) {
  const r = sq >> 3;
  const c = sq & 7;
  // Distance from the centre, which peaks at the corners.
  CORNER_DISTANCE[sq] = Math.max(Math.abs(r * 2 - 7), Math.abs(c * 2 - 7));
}
