/**
 * Offline opening book - raw data.
 *
 * Hand-authored from opening theory. There is no PGN import step and no
 * network access anywhere in this project, so the whole book lives here as
 * plain source.
 *
 * The book is keyed by the UCI MOVE SEQUENCE from the initial position rather
 * than by Zobrist hash. That makes it independent of `position.ts`'s hashing
 * scheme and readable/verifiable on its own:
 *
 *     ''                       -> white's first moves
 *     'e2e4'                   -> black's replies to 1.e4
 *     'e2e4 e7e5 g1f3'         -> black's replies to 2.Nf3
 *
 * Because it is keyed by sequence and not by position, transpositions are NOT
 * merged. That is deliberate: it keeps the data trivially checkable, and every
 * line below is written in its own natural move order.
 *
 * DATA FORMAT
 * -----------
 * The source of truth is `LINES`: a list of `[weight, 'uci uci uci ...']`
 * variations starting from the initial position. `buildBook()` expands them
 * into a prefix trie at module load (a few hundred microseconds, once).
 *
 * A move's weight at a node is the SUM of the weights of every line running
 * through it, so a heavily-branched main line is picked more often than a
 * lone sideline. `OVERRIDES` pins the distribution at the handful of nodes
 * where that heuristic should not decide (mainly the very first moves).
 *
 * Weight convention used below:
 *    10  main line
 *     6  respectable alternative
 *     3  sideline, played for variety
 *
 * INVARIANT: every move in every line must be legal in the position the
 * preceding moves produce. A wrong move here is worse than a missing one,
 * because the engine plays book moves instantly and with total confidence.
 * `bookMoveFor()` in book.ts re-validates against the real move generator, so
 * a mistake degrades to "out of book" rather than to an illegal move.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BookMove {
  /** UCI move, e.g. "e2e4", "e7e8q". */
  readonly uci: string;
  /** Relative selection weight within its node. Always > 0. */
  readonly weight: number;
}

/** `[weight, space-separated UCI moves from the initial position]`. */
type Line = readonly [weight: number, moves: string];

// ---------------------------------------------------------------------------
// The lines
// ---------------------------------------------------------------------------

const LINES: readonly Line[] = [
  // =========================================================================
  // 1.e4 e5 - OPEN GAMES
  // =========================================================================

  // --- Ruy Lopez (Spanish), 1.e4 e5 2.Nf3 Nc6 3.Bb5 ------------------------

  // Closed Ruy Lopez, Chigorin: 9...Na5 10.Bc2 c5 11.d4 Qc7
  [10, 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2 c7c5 d2d4 d8c7 b1d2 c8d7'],
  // Closed Ruy Lopez, Breyer: 9...Nb8 10.d4 Nbd7
  [10, 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8 d2d4 b8d7 b1d2 c8b7 b3c2 f8e8'],
  // Closed Ruy Lopez, Zaitsev: 9...Bb7 10.d4 Re8
  [10, 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c8b7 d2d4 f8e8 b1d2 e7f8 a2a4 h7h6 b3c2 e5d4'],
  // Marshall Attack: 8.c3 d5 9.exd5 Nxd5 10.Nxe5 Nxe5 11.Rxe5 c6 12.d4 Bd6
  [6, 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5 f6d5 f3e5 c6e5 e1e5 c7c6 d2d4 e7d6 e5e1 d8h4 g2g3 h4h3'],
  // Open Ruy Lopez: 5...Nxe4 6.d4 b5 7.Bb3 d5 8.dxe5 Be6
  [6, 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4 b7b5 a4b3 d7d5 d4e5 c8e6 c2c3 f8c5 b1d2 e8g8 b3c2 f7f5 d2b3 c5b6 f3d4'],
  // Exchange Ruy Lopez: 4.Bxc6 dxc6 5.O-O f6 6.d4
  [6, 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6 d7c6 e1g1 f7f6 d2d4 e5d4 f3d4 c6c5 d4b3 d8d1 f1d1 c8g4 f2f3 g4e6 b1c3 f8d6'],
  // Modern Steinitz Defence: 3...a6 4.Ba4 d6
  [3, 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 d7d6 c2c3 c8d7 d2d4 g8f6 e1g1 f8e7 f1e1 e8g8 b1d2 e5d4 c3d4 c6b4'],
  // Berlin Defence, Berlin Wall endgame: 4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5 8.Qxd8+ Kxd8
  [10, 'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6 d4e5 d6f5 d1d8 e8d8 b1c3 d8e8 h2h3 h7h5 c1f4 f8e7 a1d1 c8e6'],
  // Anti-Berlin, 4.d3
  [6, 'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 d2d3 f8c5 c2c3 e8g8 e1g1 d7d6 b1d2 a7a6 b5a4 b7b5 a4c2 c8e6'],
  // Schliemann (Jaenisch) Gambit: 3...f5
  [3, 'e2e4 e7e5 g1f3 b8c6 f1b5 f7f5 b1c3 f5e4 c3e4 d7d5 f3e5 d5e4 e5c6 d8g5 d1e2 g8f6'],
  // Classical (Cordel) Defence: 3...Bc5
  [3, 'e2e4 e7e5 g1f3 b8c6 f1b5 f8c5 c2c3 g8f6 e1g1 e8g8 d2d4 c5b6 f1e1 d7d6'],

  // --- Italian Game, 1.e4 e5 2.Nf3 Nc6 3.Bc4 -------------------------------

  // Giuoco Piano, Greco/Moller Attack: 7.Nc3 Nxe4 8.O-O Bxc3 9.d5
  [10, 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4 b1c3 f6e4 e1g1 b4c3 d4d5 c3f6 f1e1 c6e7 e1e4 d7d6 c1g5 f6g5 f3g5 h7h6'],
  // Giuoco Piano, 7.Bd2 quiet line
  [6, 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4 c1d2 b4d2 b1d2 d7d5 e4d5 f6d5 d1b3 c6e7 e1g1 e8g8 f1e1 c7c6'],
  // Giuoco Pianissimo, 4.d3
  [10, 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 e1g1 d7d6 c2c3 e8g8 f1e1 a7a6 c4b3 c5a7 b1d2 h7h6 h2h3 c8e6'],
  // Evans Gambit: 4.b4
  [3, 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4 e5d4 e1g1 d7d6 c3d4 a5b6 d4d5 c6a5 c1b2 g8e7'],
  // Two Knights Defence, main line 4.Ng5 d5 5.exd5 Na5 6.Bb5+ c6 7.dxc6 bxc6 8.Be2
  [10, 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 c6a5 c4b5 c7c6 d5c6 b7c6 b5e2 h7h6 g5f3 e5e4 f3e5 f8d6 d2d4 e4d3 e5d3 d8c7 b2b3 e8g8'],
  // Two Knights, 4.d4 exd4 5.O-O Nxe4 (Canal / Max Lange complex)
  [6, 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4 e5d4 e1g1 f6e4 f1e1 d7d5 c4d5 d8d5 b1c3 d5a5 c3e4 c8e6'],
  // Two Knights, quiet 4.d3 - transposes to Giuoco Pianissimo structures
  [6, 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5 c2c3 d7d6 e1g1 e8g8 f1e1 a7a6 c4b3 c5a7 b1d2 h7h6'],
  // Hungarian Defence: 3...Be7
  [3, 'e2e4 e7e5 g1f3 b8c6 f1c4 f8e7 d2d4 d7d6 d4d5 c6b8 c4d3 g8f6 c2c4 e8g8'],

  // --- Scotch Game, 1.e4 e5 2.Nf3 Nc6 3.d4 ---------------------------------

  // Scotch, Classical 4...Bc5 5.Be3 Qf6
  [10, 'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5 c1e3 d8f6 c2c3 g8e7 f1c4 c6e5 c4e2 f6g6 e1g1 d7d6'],
  // Scotch, Mieses Variation 4...Nf6 5.Nxc6 bxc6 6.e5 Qe7
  [10, 'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6 e4e5 d8e7 d1e2 f6d5 c2c4 c8a6 b2b3 g7g6 f2f4 f8g7 c1b2 e8g8'],
  // Scotch Gambit: 4.Bc4
  [3, 'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f1c4 g8f6 e4e5 d7d5 c4b5 f6e4 f3d4 f8c5 c1e3 e8g8'],

  // --- Petroff / Russian Defence, 1.e4 e5 2.Nf3 Nf6 ------------------------

  [10, 'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5 f1d3 f8e7 e1g1 b8c6 f1e1 c8g4 c2c3 f7f5 d1b3 e8g8 b1d2'],
  // Petroff, 5...Nf6 (Nimzowitsch retreat)
  [6, 'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 e4f6 f1d3 f8e7 h2h3 e8g8 e1g1 f8e8 c2c4'],
  // Petroff, Steinitz 3.d4
  [6, 'e2e4 e7e5 g1f3 g8f6 d2d4 e5d4 e4e5 f6e4 d1d4 d7d5 e5d6 e4d6 b1c3 b8c6 d4f4 g7g6 c1d2 f8g7 e1c1 e8g8'],

  // --- Philidor / Four Knights / other 1.e4 e5 -----------------------------

  // Philidor, Hanham
  [3, 'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3 b8d7 f1c4 f8e7 e1g1 e8g8 f1e1 c7c6 a2a4 d8c7'],
  // Four Knights, Spanish (Metger unpin)
  [6, 'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5 f8b4 e1g1 e8g8 d2d3 d7d6 c1g5 b4c3 b2c3 d8e7 f1e1 c6d8 d3d4 c8g4'],
  // Scotch Four Knights
  [3, 'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 d2d4 e5d4 f3d4 f8b4 d4c6 b7c6 f1d3 d7d5 e4d5 c6d5 e1g1 e8g8 c1g5 c7c6'],
  // Vienna Game, 3.f4
  [3, 'e2e4 e7e5 b1c3 g8f6 f2f4 d7d5 f4e5 f6e4 g1f3 f8e7 d2d4 e8g8 f1d3 f7f5'],
  // Bishop's Opening transposing to the Italian structures
  [3, 'e2e4 e7e5 f1c4 g8f6 d2d3 f8c5 g1f3 d7d6 c2c3 e8g8 e1g1 a7a6 c4b3 c5a7'],
  // King's Gambit Accepted, Kieseritzky
  [3, 'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 h2h4 g5g4 f3e5 g8f6 d2d4 d7d6 e5d3 f6e4 c1f4 f8g7 b1c3'],
  // King's Gambit Declined, Classical
  [3, 'e2e4 e7e5 f2f4 f8c5 g1f3 d7d6 b1c3 g8f6 f1c4 b8c6 d2d3 c8g4'],

  // =========================================================================
  // 1.e4 c5 - SICILIAN DEFENCE
  // =========================================================================

  // --- Najdorf, 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 --------------------

  // English Attack: 6.Be3 e5 7.Nb3 Be6 8.f3 Be7 9.Qd2 O-O 10.O-O-O
  [10, 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3 c8e6 f2f3 f8e7 d1d2 e8g8 e1c1 b8d7 g2g4 b7b5'],
  // 6.Bg5 e6 7.f4 Be7 (Main Line)
  [10, 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 f8e7 d1f3 d8c7 e1c1 b8d7 g2g4 b7b5'],
  // 6.Bg5 e6 7.f4 Qb6 - Poisoned Pawn
  [6, 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 d8b6 d1d2 b6b2 a1b1 b2a3 f4f5 b8c6 f5e6 f7e6 d4c6 b7c6 f1e2'],
  // 6.Be2 e5 (Opocensky)
  [10, 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2 e7e5 d4b3 f8e7 e1g1 e8g8 c1e3 c8e6 d1d2 b8d7 a2a4 a8c8'],
  // 6.Bc4 (Fischer-Sozin)
  [6, 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1c4 e7e6 c4b3 f8e7 f2f4 e8g8 d1f3 d8c7 e1g1 b8c6'],

  // --- Dragon, 5...g6 ------------------------------------------------------

  // Yugoslav Attack: 6.Be3 Bg7 7.f3 O-O 8.Qd2 Nc6 9.Bc4
  [10, 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6 f1c4 c8d7 e1c1 a8c8 c4b3 c6e5 h2h4 h7h5'],
  // Classical Dragon: 6.Be2
  [6, 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e2 f8g7 e1g1 e8g8 c1e3 b8c6 f2f4 c8d7 d4b3 a7a5'],

  // --- Classical / Richter-Rauzer, 5...Nc6 6.Bg5 ---------------------------

  [10, 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 b8c6 c1g5 e7e6 d1d2 f8e7 e1c1 e8g8 f2f4 c6d4 d2d4 d8a5 f1c4 c8d7'],
  [6, 'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 d7d6 c1g5 e7e6 d1d2 a7a6 e1c1 c8d7 f2f4 f8e7'],

  // --- Scheveningen, 5...e6 ------------------------------------------------

  [10, 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 f1e2 f8e7 e1g1 e8g8 f2f4 b8c6 c1e3 c8d7 d4b3 a7a6 a2a4 b7b6'],
  // Keres Attack: 6.g4
  [6, 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 g2g4 h7h6 h2h4 b8c6 h1g1 h6h5 g4h5 f6h5 c1g5 f8e7 d1d2'],

  // --- Sveshnikov / Taimanov / Kan / Four Knights --------------------------

  // Sveshnikov: 2...Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5 6.Ndb5 d6 7.Bg5 a6 8.Na3 b5
  [10, 'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5 g5f6 g7f6 c3d5 f6f5 f1d3 c8e6 e1g1 f8g7 c2c3'],
  // Taimanov: 2...e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nc3 Qc7
  [10, 'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 d8c7 c1e3 a7a6 d1d2 g8f6 e1c1 f8b4 f2f3 c6e5'],
  // Kan: 2...e6 3.d4 cxd4 4.Nxd4 a6
  [6, 'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 f1d3 g8f6 e1g1 d7d6 c2c4 g7g6 b1c3 f8g7 f1e1 e8g8'],
  // Four Knights Sicilian: 2...e6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6 6.Ndb5 d6 7.Bf4 e5
  [6, 'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 g8f6 b1c3 b8c6 d4b5 d7d6 c1f4 e6e5 f4g5 a7a6 b5a3 b7b5 c3d5 f8e7 g5f6 e7f6 c2c3 e8g8'],
  // Accelerated Dragon, Maroczy Bind: 2...Nc6 3.d4 cxd4 4.Nxd4 g6 5.c4
  [10, 'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g7g6 c2c4 f8g7 c1e3 g8f6 b1c3 e8g8 f1e2 d7d6 e1g1 c8d7 d1d2 c6d4 e3d4 d7c6'],

  // --- Anti-Sicilians ------------------------------------------------------

  // Rossolimo: 2...Nc6 3.Bb5 g6
  [10, 'e2e4 c7c5 g1f3 b8c6 f1b5 g7g6 b5c6 d7c6 d2d3 f8g7 h2h3 g8f6 b1c3 e8g8 c1e3 b7b6 d1d2 e7e5'],
  // Rossolimo: 3...e6
  [6, 'e2e4 c7c5 g1f3 b8c6 f1b5 e7e6 e1g1 g8e7 c2c3 a7a6 b5a4 b7b5 a4c2 c8b7'],
  // Moscow Variation: 2...d6 3.Bb5+
  [10, 'e2e4 c7c5 g1f3 d7d6 f1b5 c8d7 b5d7 d8d7 c2c4 b8c6 b1c3 g8f6 e1g1 g7g6 d2d4 c5d4 f3d4 f8g7'],
  // Alapin: 2.c3 d5
  [10, 'e2e4 c7c5 c2c3 d7d5 e4d5 d8d5 d2d4 g8f6 g1f3 c8g4 f1e2 e7e6 h2h3 g4h5 e1g1 b8c6 c1e3 c5d4 c3d4 f8e7'],
  // Alapin: 2.c3 Nf6
  [10, 'e2e4 c7c5 c2c3 g8f6 e4e5 f6d5 d2d4 c5d4 g1f3 b8c6 c3d4 d7d6 f1c4 d5b6 c4b5 d6e5 f3e5 c8d7 e5d7 d8d7'],
  // Closed Sicilian: 2.Nc3 Nc6 3.g3
  [10, 'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 d2d3 d7d6 f2f4 g8f6 g1f3 e8g8 e1g1 a8b8 h2h3 b7b5'],
  // Closed Sicilian: 2.Nc3 e6 3.g3 d5
  [6, 'e2e4 c7c5 b1c3 e7e6 g2g3 d7d5 f1g2 d5d4 c3e2 b8c6 g1f3 e6e5 d2d3 f8d6 e1g1 g8e7'],

  // =========================================================================
  // 1.e4 e6 - FRENCH DEFENCE
  // =========================================================================

  // Winawer, Poisoned Pawn: 3.Nc3 Bb4 4.e5 c5 5.a3 Bxc3+ 6.bxc3 Ne7 7.Qg4 Qc7
  [10, 'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 d1g4 d8c7 g4g7 h8g8 g7h7 c5d4 g1e2 b8c6 f2f4 c8d7'],
  // Winawer, 7.Nf3
  [6, 'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 g1f3 c8d7 a3a4 d8a5 c1d2 b8c6 f1e2 c5c4'],
  // Classical, 4.Bg5 Be7 5.e5 Nfd7 6.Bxe7 Qxe7
  [10, 'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7 g5e7 d8e7 f2f4 e8g8 g1f3 c7c5 d1d2 b8c6 e1c1 c5c4'],
  // Steinitz, 4.e5 Nfd7 5.f4 c5
  [10, 'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 e4e5 f6d7 f2f4 c7c5 g1f3 b8c6 c1e3 c5d4 f3d4 f8c5 d1d2 e8g8 e1c1 a7a6'],
  // MacCutcheon: 4.Bg5 Bb4
  [6, 'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8b4 e4e5 h7h6 g5d2 b4c3 b2c3 f6e4 d1g4 e8g8 f1d3 e4d2 e1d2'],
  // Rubinstein: 3...dxe4
  [6, 'e2e4 e7e6 d2d4 d7d5 b1c3 d5e4 c3e4 b8d7 g1f3 g8f6 e4f6 d7f6 f1d3 c7c5 d4c5 f8c5 e1g1 e8g8'],
  // Tarrasch, 3.Nd2 Nf6 4.e5 Nfd7 5.Bd3 c5 6.c3 Nc6 7.Ne2
  [10, 'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5 f6d7 f1d3 c7c5 c2c3 b8c6 g1e2 c5d4 c3d4 f7f6 e5f6 d7f6'],
  // Tarrasch, 3...c5 4.exd5 exd5 (isolani)
  [10, 'e2e4 e7e6 d2d4 d7d5 b1d2 c7c5 e4d5 e6d5 g1f3 b8c6 f1b5 f8d6 e1g1 g8e7 d4c5 d6c5 d2b3 c5d6'],
  // Advance, 5...Qb6 6.a3
  [10, 'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 a2a3 g8h6 b2b4 c5d4 c3d4 h6f5 c1b2 f8e7 f1d3'],
  // Advance, 6.Be2
  [6, 'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 f1e2 c8d7 e1g1 g8e7 b1a3 c5d4 c3d4 e7f5'],
  // Exchange French
  [6, 'e2e4 e7e6 d2d4 d7d5 e4d5 e6d5 g1f3 g8f6 f1d3 f8d6 e1g1 e8g8 c1g5 c7c6 c2c3 c8g4 b1d2 b8d7'],
  // King's Indian Attack vs the French
  [3, 'e2e4 e7e6 d2d3 d7d5 b1d2 g8f6 g1f3 c7c5 g2g3 b8c6 f1g2 f8e7 e1g1 e8g8 f1e1 b7b5 e4e5 f6d7'],

  // =========================================================================
  // 1.e4 c6 - CARO-KANN DEFENCE
  // =========================================================================

  // Classical: 4...Bf5 5.Ng3 Bg6 6.h4 h6 7.Nf3 Nd7 8.h5 Bh7 9.Bd3 Bxd3 10.Qxd3
  [10, 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3 b8d7 h4h5 g6h7 f1d3 h7d3 d1d3 e7e6 c1f4 g8f6 e1c1 f8e7'],
  // Modern / Karpov: 4...Nd7 5.Ng5 Ngf6 6.Bd3 e6
  [10, 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 b8d7 e4g5 g8f6 f1d3 e7e6 g1f3 f8d6 d1e2 h7h6 g5e4 f6e4 e2e4'],
  // Bronstein-Larsen: 4...Nf6 5.Nxf6+ gxf6
  [6, 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6 e4f6 g7f6 c2c3 c8f5 g1f3 e7e6 g2g3 f8d6 f1g2 e8g8 e1g1'],
  // Tartakower: 4...Nf6 5.Nxf6+ exf6
  [3, 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6 e4f6 e7f6 c2c3 f8d6 f1d3 e8g8 d1c2 f8e8 g1e2'],
  // Advance, Short System: 3.e5 Bf5 4.Nf3 e6 5.Be2 c5 6.Be3
  [10, 'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 c6c5 c1e3 d8b6 b1c3 b8c6 e1g1 c5d4 f3d4'],
  // Advance, Botvinnik-Carls: 4.Nc3 e6 5.g4
  [6, 'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 b1c3 e7e6 g2g4 f5g6 g1e2 c6c5 h2h4 h7h5 e2f4 g6h7'],
  // Exchange Variation: 3.exd5 cxd5 4.Bd3
  [10, 'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 f1d3 b8c6 c2c3 g8f6 c1f4 c8g4 d1b3 c6a5 b3a4 g4d7 a4c2 e7e6 g1f3 f8d6'],
  // Panov-Botvinnik Attack: 3.exd5 cxd5 4.c4 Nf6 5.Nc3 Nc6 6.Nf3 Bg4
  [10, 'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6 b1c3 b8c6 g1f3 c8g4 c4d5 f6d5 d1b3 g4f3 g2f3 e7e6'],
  // Panov with 5...e6
  [6, 'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6 b1c3 e7e6 g1f3 f8e7 c4d5 f6d5 f1d3 b8c6 e1g1 e8g8'],
  // Two Knights: 2.Nc3 d5 3.Nf3 Bg4
  [6, 'e2e4 c7c6 b1c3 d7d5 g1f3 c8g4 h2h3 g4f3 d1f3 g8f6 d2d3 e7e6 g2g3 f8b4 f1g2'],
  // Fantasy Variation: 3.f3
  [3, 'e2e4 c7c6 d2d4 d7d5 f2f3 d5e4 f3e4 e7e5 g1f3 c8g4 f1c4 g8f6'],

  // =========================================================================
  // 1.e4 d5 - SCANDINAVIAN DEFENCE
  // =========================================================================

  // 3...Qa5 main line
  [10, 'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c7c6 f1c4 c8f5 c1d2 e7e6 d1e2 f8b4 e1c1 b8d7'],
  // 3...Qa5 with 5...Bg4
  [6, 'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c8g4 h2h3 g4f3 d1f3 c7c6 c1d2 e7e6 e1c1 b8d7 g2g4'],
  // 3...Qd6 (Tiviakov)
  [6, 'e2e4 d7d5 e4d5 d8d5 b1c3 d5d6 d2d4 g8f6 g1f3 a7a6 g2g3 b7b5 f1g2 c8b7 e1g1 e7e6'],
  // 2...Nf6 (Marshall Gambit / Modern)
  [6, 'e2e4 d7d5 e4d5 g8f6 d2d4 f6d5 g1f3 g7g6 f1e2 f8g7 e1g1 e8g8 c2c4 d5b6 b1c3 b8c6'],
  // 3...Qd8
  [3, 'e2e4 d7d5 e4d5 d8d5 b1c3 d5d8 d2d4 g8f6 g1f3 c8f5 f1d3 f5d3 d1d3 e7e6'],

  // =========================================================================
  // 1.e4 Nf6 / d6 / g6 - HYPERMODERN REPLIES
  // =========================================================================

  // Alekhine's Defence, Modern Main Line
  [6, 'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 g7g6 f1c4 d5b6 c4b3 f8g7 d1e2 b8c6 e1g1 e8g8 h2h3 a7a5'],
  // Alekhine, Exchange Variation
  [3, 'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4 d5b6 e5d6 c7d6 b1c3 g7g6 c1e3 f8g7 a1c1 e8g8 b2b3 b8c6'],
  // Pirc Defence, Classical
  [6, 'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1 c7c6 a2a4 b8d7 h2h3 e7e5'],
  // Pirc, Austrian Attack
  [6, 'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 f2f4 f8g7 g1f3 e8g8 f1d3 b8a6 e1g1 c7c5 d4d5 a8b8'],
  // Modern Defence
  [3, 'e2e4 g7g6 d2d4 f8g7 b1c3 d7d6 g1f3 g8f6 f1e2 e8g8 e1g1 c7c6 a2a4'],
  // Modern, Gurgenidze System
  [3, 'e2e4 g7g6 d2d4 f8g7 b1c3 c7c6 f2f4 d7d5 e4e5 h7h5 g1f3 c8g4'],

  // =========================================================================
  // 1.d4 d5 - QUEEN'S PAWN / QUEEN'S GAMBIT
  // =========================================================================

  // QGD Tartakower: 4.Bg5 Be7 5.e3 O-O 6.Nf3 h6 7.Bh4 b6
  [10, 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6 g5h4 b7b6 c4d5 f6d5 h4e7 d8e7 c3d5 e6d5 a1c1 c8e6'],
  // QGD Lasker Defence: 7...Ne4
  [10, 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6 g5h4 f6e4 h4e7 d8e7 c4d5 e4c3 b2c3 e6d5 d1b3 f8d8 c3c4 d5c4 f1c4 b8c6'],
  // QGD Exchange, minority attack
  [10, 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c4d5 e6d5 c1g5 c7c6 e2e3 f8e7 f1d3 b8d7 d1c2 e8g8 g1f3 f8e8 e1g1 d7f8 a1b1 a7a5'],
  // QGD Cambridge Springs
  [6, 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 b8d7 e2e3 c7c6 g1f3 d8a5 f3d2 f8b4 d1c2 e8g8 f1e2 e6e5'],
  // Catalan, Open
  [10, 'd2d4 d7d5 c2c4 e7e6 g1f3 g8f6 g2g3 f8e7 f1g2 e8g8 e1g1 d5c4 d1c2 a7a6 c2c4 b7b5 c4c2 c8b7 c1d2 b8d7'],
  // Tarrasch Defence
  [6, 'd2d4 d7d5 c2c4 e7e6 b1c3 c7c5 c4d5 e6d5 g1f3 b8c6 g2g3 g8f6 f1g2 f8e7 e1g1 e8g8 c1g5 c5d4 f3d4 h7h6'],
  // Queen's Gambit Accepted, Classical
  [10, 'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5 e1g1 a7a6 a2a4 b8c6 d1e2 c5d4 f1d1 f8e7 e3d4 e8g8 b1c3'],
  // QGA, 3.e4
  [6, 'd2d4 d7d5 c2c4 d5c4 e2e4 e7e5 g1f3 e5d4 f1c4 b8c6 e1g1 c8e6 c4e6 f7e6 d1b3 d8d7 b3b7 a8b8'],
  // Slav Defence, Main Line: 4...dxc4 5.a4 Bf5
  [10, 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3 e7e6 f1c4 f8b4 e1g1 b8d7 d1e2 f5g6'],
  // Semi-Slav, Meran
  [10, 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5 c4d3 c8b7 e1g1 a7a6 e3e4 c6c5 d4d5 d8c7'],
  // Semi-Slav, Botvinnik System
  [6, 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5 d5c4 e2e4 b7b5 e4e5 h7h6 g5h4 g7g5 f3g5 h6g5 h4g5 b8d7 e5f6 c8b7 g2g3 c6c5 d4d5 d8b6'],
  // Semi-Slav, Moscow / Anti-Moscow
  [6, 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5 h7h6 g5f6 d8f6 e2e3 b8d7 f1d3 d5c4 d3c4 g7g6 e1g1 f8g7'],
  // Slav Exchange
  [6, 'd2d4 d7d5 c2c4 c7c6 c4d5 c6d5 b1c3 g8f6 g1f3 b8c6 c1f4 c8f5 e2e3 e7e6 f1b5 f6d7'],
  // Chigorin Defence
  [3, 'd2d4 d7d5 c2c4 b8c6 g1f3 c8g4 c4d5 g4f3 g2f3 d8d5 e2e3 e7e5 b1c3 f8b4 c1d2 b4c3 b2c3 d5d6'],
  // Albin Counter-Gambit
  [3, 'd2d4 d7d5 c2c4 e7e5 d4e5 d5d4 g1f3 b8c6 g2g3 c8e6 f1g2 d8d7 e1g1 e8c8'],
  // 2.Nf3 move order into the QGD
  [3, 'd2d4 d7d5 g1f3 g8f6 c2c4 e7e6 b1c3 f8e7 c1g5 e8g8 e2e3 h7h6'],

  // =========================================================================
  // 1.d4 Nf6 2.c4 - INDIAN DEFENCES
  // =========================================================================

  // Nimzo-Indian, Rubinstein 4.e3
  [10, 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5 e1g1 b8c6 a2a3 b4c3 b2c3 d5c4 d3c4 d8c7'],
  // Nimzo-Indian, Classical 4.Qc2
  [10, 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3 b4c3 c2c3 b7b6 c1g5 c8b7 g1f3 d7d6 e2e3 b8d7 f1e2 c7c5'],
  // Nimzo-Indian, Kmoch / 4.f3
  [6, 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 f2f3 d7d5 a2a3 b4c3 b2c3 c7c5 c4d5 f6d5 d4c5 d8a5 e2e4 d5e7'],
  // Queen's Indian, 4.g3 Ba6
  [10, 'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8a6 b2b3 f8b4 c1d2 b4e7 f1g2 c7c6 d2c3 d7d5 f3e5 b8d7'],
  // Queen's Indian, 4.g3 Bb7
  [10, 'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7 e1g1 e8g8 b1c3 f6e4 d1c2 e4c3 c2c3 c7c5 f1d1 d7d6'],
  // Bogo-Indian
  [6, 'd2d4 g8f6 c2c4 e7e6 g1f3 f8b4 c1d2 d8e7 g2g3 b8c6 f1g2 b4d2 b1d2 d7d6 e1g1 e8g8 e2e4 e6e5 d4d5 c6b8'],
  // Nimzo/QGD move order 3.Nf3 d5
  [3, 'd2d4 g8f6 c2c4 e7e6 g1f3 d7d5 b1c3 f8e7 c1g5 e8g8 e2e3 h7h6 g5h4 b7b6'],
  // King's Indian, Mar del Plata
  [10, 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 f3e1 f6d7 c1e3 f7f5 f2f3 f5f4 e3f2 g6g5'],
  // King's Indian, Saemisch
  [6, 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 e7e5 d4d5 f6h5 d1d2 f7f5 e1c1 b8d7 f1d3'],
  // King's Indian, Fianchetto
  [6, 'd2d4 g8f6 c2c4 g7g6 g1f3 f8g7 g2g3 e8g8 f1g2 d7d6 e1g1 b8d7 b1c3 e7e5 e2e4 c7c6 h2h3 d8b6 f1e1 e5d4 f3d4 f8e8'],
  // Gruenfeld, Exchange Variation
  [10, 'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 g1f3 c7c5 a1b1 e8g8 f1e2 c5d4 c3d4 d8a5 c1d2 a5a2 e1g1 c8g4'],
  // Gruenfeld, Russian System
  [10, 'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3 f8g7 d1b3 d5c4 b3c4 e8g8 e2e4 b8a6 f1e2 c7c5 d4d5 e7e6 e1g1 e6d5 e4d5 f8e8'],
  // Gruenfeld, 4.Bf4
  [3, 'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c1f4 f8g7 e2e3 e8g8 a1c1 c7c5 d4c5 c8e6'],
  // Modern Benoni
  [6, 'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6 g1f3 f8g7 h2h3 e8g8 f1d3 f8e8 e1g1 a7a6 a2a4 b8d7'],
  // Benko / Volga Gambit
  [6, 'd2d4 g8f6 c2c4 c7c5 d4d5 b7b5 c4b5 a7a6 b5a6 c8a6 b1c3 d7d6 e2e4 a6f1 e1f1 g7g6 g2g3 f8g7 f1g2 e8g8'],
  // Old Indian
  [3, 'd2d4 g8f6 c2c4 d7d6 b1c3 e7e5 g1f3 b8d7 e2e4 f8e7 f1e2 e8g8 e1g1 c7c6 d1c2 d8c7'],
  // 2.Nf3 move orders into the King's Indian and the QGD
  [3, 'd2d4 g8f6 g1f3 g7g6 c2c4 f8g7 b1c3 e8g8 e2e4 d7d6 f1e2 e7e5'],
  [3, 'd2d4 g8f6 g1f3 d7d5 c2c4 e7e6 b1c3 f8e7 c1f4 e8g8 e2e3 c7c5'],

  // =========================================================================
  // 1.d4 f5 - DUTCH DEFENCE
  // =========================================================================

  [3, 'd2d4 f7f5 g2g3 g8f6 f1g2 e7e6 g1f3 f8e7 e1g1 e8g8 c2c4 d7d6 b1c3 d8e8 b2b3 a7a5'],
  [3, 'd2d4 f7f5 g2g3 g8f6 f1g2 g7g6 g1f3 f8g7 e1g1 e8g8 c2c4 d7d6 b1c3 d8e8 d4d5 a7a5'],

  // =========================================================================
  // 1.c4 - ENGLISH OPENING
  // =========================================================================

  // Reversed Sicilian, 1...e5 2.Nc3 Nf6 3.Nf3 Nc6 4.g3 d5
  [10, 'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5 f1g2 d5b6 e1g1 f8e7 a2a3 e8g8 b2b4 c8e6 d2d3 f7f6'],
  // Botvinnik System
  [6, 'c2c4 e7e5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 d2d3 d7d6 e2e4 g8e7 g1e2 e8g8 e1g1 f7f5'],
  // 1...e5 2.g3
  [6, 'c2c4 e7e5 g2g3 g8f6 f1g2 d7d5 c4d5 f6d5 b1c3 d5b6 g1f3 b8c6 e1g1 f8e7 d2d3 e8g8'],
  // Symmetrical, Hedgehog
  [10, 'c2c4 c7c5 g1f3 g8f6 g2g3 b7b6 f1g2 c8b7 e1g1 e7e6 b1c3 a7a6 d2d4 c5d4 d1d4 d7d6 f1d1 b8d7 c1e3 f8e7'],
  // Symmetrical, Four Knights / double fianchetto
  [10, 'c2c4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 g1f3 g8f6 e1g1 e8g8 d2d4 c5d4 f3d4 c6d4 d1d4 d7d6 c1d2 c8d7 a1c1 a8c8'],
  // Mikenas-Carls Attack
  [3, 'c2c4 g8f6 b1c3 e7e6 e2e4 c7c5 e4e5 f6g8 g1f3 b8c6 d2d4 c5d4 f3d4 g8e7'],
  // 1...e6 into the QGD
  [6, 'c2c4 e7e6 b1c3 d7d5 d2d4 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6'],
  // 1...c6 into the Slav
  [6, 'c2c4 c7c6 d2d4 d7d5 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3 e7e6'],
  // 1...g6 King's English
  [3, 'c2c4 g7g6 b1c3 f8g7 g2g3 c7c5 f1g2 b8c6 g1f3 g8f6 e1g1 e8g8 a2a3 a7a6 a1b1 a8b8 b2b4'],

  // =========================================================================
  // 1.Nf3 - RETI / KING'S INDIAN ATTACK
  // =========================================================================

  // Reti, double fianchetto
  [10, 'g1f3 d7d5 c2c4 e7e6 g2g3 g8f6 f1g2 f8e7 e1g1 e8g8 b2b3 c7c5 c1b2 b8c6 e2e3 b7b6 b1c3 c8b7'],
  // Reti, Slav setup
  [10, 'g1f3 d7d5 c2c4 c7c6 b2b3 g8f6 c1b2 c8f5 g2g3 e7e6 f1g2 h7h6 e1g1 f8e7 d2d3 e8g8 b1d2 a7a5'],
  // Reti, 2...d4
  [6, 'g1f3 d7d5 c2c4 d5d4 e2e3 b8c6 e3d4 c6d4 f3d4 d8d4 b1c3 c7c6 d2d3 g8f6'],
  // Reti into a Neo-Gruenfeld
  [6, 'g1f3 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 g2g3 f8g7 f1g2 d5c3 b2c3 c7c5 a1b1 e8g8 e1g1 b8c6'],
  // Reti into the Catalan
  [6, 'g1f3 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 e1g1 e8g8 d2d4 d5c4 d1c2 a7a6'],
  // Reti / English symmetrical
  [6, 'g1f3 c7c5 c2c4 g8f6 b1c3 b8c6 g2g3 d7d5 c4d5 f6d5 f1g2 d5c7 e1g1 e7e5'],
  // Transposition to the Queen's Gambit
  [6, 'g1f3 d7d5 d2d4 g8f6 c2c4 e7e6 b1c3 f8e7 c1g5 e8g8'],
  // King's Indian Attack
  [3, 'g1f3 g8f6 g2g3 g7g6 f1g2 f8g7 e1g1 e8g8 d2d3 d7d5 b1d2 c7c5 e2e4 b8c6'],
];

// ---------------------------------------------------------------------------
// Weight overrides
// ---------------------------------------------------------------------------

/**
 * Nodes whose distribution is pinned by hand rather than derived from how many
 * lines happen to run through them. Only the opening moves need this: deeper
 * nodes have few enough siblings that the summed weights are already sane.
 *
 * A move named here that does not exist in the trie is ignored, and moves in
 * the trie that are not named here keep their computed weight only if the
 * override is empty - otherwise the override replaces the node wholesale.
 */
const OVERRIDES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  // White's first move.
  '': { e2e4: 40, d2d4: 34, g1f3: 14, c2c4: 12 },

  // Black's reply to 1.e4.
  e2e4: {
    e7e5: 28, c7c5: 28, e7e6: 13, c7c6: 13,
    d7d5: 7, g8f6: 4, d7d6: 4, g7g6: 3,
  },

  // Black's reply to 1.d4.
  d2d4: { g8f6: 48, d7d5: 46, f7f5: 6 },

  // Black's reply to 1.c4.
  c2c4: { e7e5: 34, c7c5: 34, g8f6: 8, e7e6: 12, c7c6: 8, g7g6: 4 },

  // Black's reply to 1.Nf3.
  g1f3: { d7d5: 55, g8f6: 33, c7c5: 12 },

  // White's second move. Left to the summed weights these would sit at 94-97%
  // for the main move, which is honest but means the engine never once plays a
  // Vienna or a King's Gambit. Nudged so the sidelines actually show up.
  'e2e4 e7e5': { g1f3: 82, b1c3: 6, f1c4: 6, f2f4: 6 },
  'e2e4 e7e6': { d2d4: 92, d2d3: 8 },
  'e2e4 c7c6': { d2d4: 90, b1c3: 10 },
  'd2d4 d7d5': { c2c4: 92, g1f3: 8 },
  'd2d4 g8f6': { c2c4: 90, g1f3: 10 },
};

// ---------------------------------------------------------------------------
// Trie construction
// ---------------------------------------------------------------------------

/** Mutable shape used only while accumulating weights. */
interface MutableBookMove {
  uci: string;
  weight: number;
}

function buildBook(): Map<string, MutableBookMove[]> {
  const book = new Map<string, MutableBookMove[]>();

  for (const [weight, moves] of LINES) {
    const seq = moves.split(' ');
    for (let i = 0; i < seq.length; i++) {
      const key = i === 0 ? '' : seq.slice(0, i).join(' ');
      const uci = seq[i];
      let entries = book.get(key);
      if (entries === undefined) {
        entries = [];
        book.set(key, entries);
      }
      const existing = entries.find((e) => e.uci === uci);
      if (existing === undefined) entries.push({ uci, weight });
      else existing.weight += weight;
    }
  }

  for (const key of Object.keys(OVERRIDES)) {
    const entries = book.get(key);
    if (entries === undefined) continue;
    const table = OVERRIDES[key];
    const replaced: MutableBookMove[] = [];
    for (const e of entries) {
      const w = table[e.uci];
      if (w !== undefined && w > 0) replaced.push({ uci: e.uci, weight: w });
    }
    // Only apply the override if it actually covers something; never let a
    // stale override empty out a node.
    if (replaced.length > 0) book.set(key, replaced);
  }

  return book;
}

/**
 * The book itself: move-sequence key -> weighted replies.
 * Key `''` is the initial position.
 */
export const BOOK: ReadonlyMap<string, readonly BookMove[]> = buildBook();

/** Number of distinct positions (sequences) that have at least one reply. */
export const BOOK_POSITIONS = BOOK.size;

/** Deepest key in the book, in plies. Useful as a default for `maxPlies`. */
export const BOOK_MAX_PLIES = LINES.reduce(
  (max, [, moves]) => Math.max(max, moves.split(' ').length),
  0,
);
