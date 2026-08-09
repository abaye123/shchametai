/**
 * Perft harness - the correctness proof for position.ts + movegen.ts.
 *
 * Usage (Node 24 strips the types natively, no build step):
 *
 *   node src/engine/perft.ts                       run the whole suite
 *   node src/engine/perft.ts suite                 same
 *   node src/engine/perft.ts fen "<fen>" <depth>   perft a single position
 *   node src/engine/perft.ts divide "<fen>" <d>    per-root-move node counts
 *   node src/engine/perft.ts roundtrip             FEN round-trip check only
 *
 * `divide` is the debugging tool: compare its output against a reference
 * engine, find the root move whose subtree count differs, play that move and
 * divide again one ply deeper until the broken move is isolated.
 */

import { Position } from './position.ts';
import { generateMoves } from './movegen.ts';
import { MAX_MOVES, MAX_PLY, moveToUci, type PackedMove } from './types.ts';

// One preallocated move buffer per ply - perft allocates nothing.
const BUFFERS: Int32Array[] = [];
for (let i = 0; i < MAX_PLY; i++) BUFFERS.push(new Int32Array(MAX_MOVES));

export function perft(pos: Position, depth: number, ply = 0): number {
  if (depth === 0) return 1;
  const buf = BUFFERS[ply];
  const end = generateMoves(pos, buf, 0);
  let nodes = 0;
  for (let i = 0; i < end; i++) {
    if (!pos.makeMove(buf[i])) continue;
    nodes += depth === 1 ? 1 : perft(pos, depth - 1, ply + 1);
    pos.unmakeMove();
  }
  return nodes;
}

export interface DivideEntry {
  move: PackedMove;
  uci: string;
  nodes: number;
}

export function divide(pos: Position, depth: number): { entries: DivideEntry[]; total: number } {
  const entries: DivideEntry[] = [];
  let total = 0;
  if (depth <= 0) return { entries, total };

  const buf = new Int32Array(MAX_MOVES);
  const end = generateMoves(pos, buf, 0);
  for (let i = 0; i < end; i++) {
    const move = buf[i];
    if (!pos.makeMove(move)) continue;
    const nodes = perft(pos, depth - 1, 1);
    pos.unmakeMove();
    entries.push({ move, uci: moveToUci(move), nodes });
    total += nodes;
  }
  entries.sort((a, b) => (a.uci < b.uci ? -1 : a.uci > b.uci ? 1 : 0));
  return { entries, total };
}

// ---------------------------------------------------------------------------
// Reference suite
// ---------------------------------------------------------------------------

interface SuiteCase {
  name: string;
  fen: string;
  expected: number[]; // expected[i] is perft(i + 1)
}

const SUITE: SuiteCase[] = [
  {
    name: 'startpos',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    expected: [20, 400, 8902, 197281, 4865609],
  },
  {
    name: 'kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    expected: [48, 2039, 97862, 4085603],
  },
  {
    name: 'position3',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    expected: [14, 191, 2812, 43238, 674624],
  },
  {
    name: 'position4',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    expected: [6, 264, 9467, 422333],
  },
  {
    name: 'position5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    expected: [44, 1486, 62379, 2103487],
  },
  {
    name: 'position6',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    expected: [46, 2079, 89890, 3894594],
  },
];

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function runRoundTrip(): boolean {
  console.log('FEN round-trip');
  let ok = true;
  for (const c of SUITE) {
    const back = Position.fromFen(c.fen).toFen();
    const good = back === c.fen;
    if (!good) ok = false;
    console.log(
      '  ' + pad(c.name, 12) + (good ? 'OK' : 'FAIL\n    expected ' + c.fen + '\n    got      ' + back),
    );
  }
  console.log('');
  return ok;
}

function runSuite(): boolean {
  let allOk = true;
  let startposD5Nodes = 0;
  let startposD5Ms = 0;

  for (const c of SUITE) {
    console.log(c.name);
    console.log('  ' + c.fen);
    for (let d = 1; d <= c.expected.length; d++) {
      const pos = Position.fromFen(c.fen);
      const t0 = Date.now();
      const nodes = perft(pos, d);
      const ms = Date.now() - t0;
      const want = c.expected[d - 1];
      const ok = nodes === want;
      if (!ok) allOk = false;
      const nps = ms > 0 ? Math.round((nodes / ms) * 1000) : nodes;
      console.log(
        '  depth ' + d +
        '  nodes ' + padLeft(String(nodes), 9) +
        '  expected ' + padLeft(String(want), 9) +
        '  ' + (ok ? 'OK  ' : 'FAIL') +
        '  ' + padLeft(String(ms), 6) + ' ms' +
        '  ' + padLeft(nps.toLocaleString('en-US'), 12) + ' nps',
      );
      if (c.name === 'startpos' && d === 5) {
        startposD5Nodes = nodes;
        startposD5Ms = ms;
      }
    }
    console.log('');
  }

  if (startposD5Ms > 0) {
    console.log(
      'startpos depth 5: ' + startposD5Nodes + ' nodes in ' + startposD5Ms + ' ms = ' +
      Math.round((startposD5Nodes / startposD5Ms) * 1000).toLocaleString('en-US') + ' nodes/sec',
    );
  }
  return allOk;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const cmd = argv[0] ?? 'suite';

  if (cmd === 'divide') {
    const fen = argv[1];
    const depth = Number(argv[2] ?? 1);
    const pos = Position.fromFen(fen);
    const { entries, total } = divide(pos, depth);
    for (const e of entries) console.log(e.uci + ': ' + e.nodes);
    console.log('');
    console.log('moves: ' + entries.length);
    console.log('nodes: ' + total);
    return;
  }

  if (cmd === 'fen' || cmd === 'perft') {
    const fen = argv[1];
    const depth = Number(argv[2] ?? 1);
    const pos = Position.fromFen(fen);
    const t0 = Date.now();
    const nodes = perft(pos, depth);
    const ms = Date.now() - t0;
    console.log('perft(' + depth + ') = ' + nodes + '  in ' + ms + ' ms');
    return;
  }

  if (cmd === 'roundtrip') {
    process.exitCode = runRoundTrip() ? 0 : 1;
    return;
  }

  const rtOk = runRoundTrip();
  const perftOk = runSuite();
  console.log('');
  console.log(
    rtOk && perftOk
      ? 'ALL PERFT AND ROUND-TRIP CHECKS PASSED'
      : 'FAILURES DETECTED',
  );
  process.exitCode = rtOk && perftOk ? 0 : 1;
}

main();
