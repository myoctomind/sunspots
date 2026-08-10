import {
  type CellState, type Difficulty, type Puzzle, type Solution,
  conflicts, isSolved, neighbors, rowOf, colOf, idx,
} from '../engine/board';
import { type Generated } from '../engine/generate';
import { type Step, findMistakes } from '../engine/deduce';

export interface Settings { size: number; difficulty: Difficulty; autoX: boolean }
export interface Stats {
  counts: Record<string, { solved: number; clean: number }>;
  streak: number;
  bestStreak: number;
}
export type Move = { i: number; from: CellState; to: CellState };
export interface SavedGame {
  puzzle: Puzzle; solution: Solution; grade: Difficulty; requested: Difficulty;
  cells: CellState[]; undoStack: Move[][]; hintsUsed: number;
}

export class Game {
  puzzle: Puzzle;
  solution: Solution;
  grade: Difficulty;
  requested: Difficulty;
  cells: CellState[];
  undoStack: Move[][] = [];
  hintsUsed = 0;
  private paintBatch: Move[] | null = null;

  constructor(g: Generated) {
    this.puzzle = g.puzzle;
    this.solution = g.solution;
    this.grade = g.grade;
    this.requested = g.requested;
    this.cells = new Array<CellState>(g.puzzle.size * g.puzzle.size).fill('empty');
  }

  static fromSaved(s: SavedGame): Game {
    const g = new Game({ puzzle: s.puzzle, solution: s.solution, grade: s.grade, requested: s.requested });
    g.cells = s.cells.slice();
    g.undoStack = s.undoStack.map((b) => b.map((m) => ({ ...m })));
    g.hintsUsed = s.hintsUsed;
    return g;
  }

  toSaved(): SavedGame {
    return {
      puzzle: this.puzzle, solution: this.solution, grade: this.grade, requested: this.requested,
      cells: this.cells.slice(),
      undoStack: this.undoStack.map((b) => b.map((m) => ({ ...m }))),
      hintsUsed: this.hintsUsed,
    };
  }

  private apply(moves: Move[]): void {
    for (const m of moves) this.cells[m.i] = m.to;
    this.undoStack.push(moves);
  }

  autoMarks(autoX: boolean): Set<number> {
    const out = new Set<number>();
    if (!autoX) return out;
    const { size, regions } = this.puzzle;
    this.cells.forEach((s, i) => {
      if (s !== 'cat') return;
      const r = rowOf(size, i), c = colOf(size, i), g = regions[i];
      for (let k = 0; k < size; k++) { out.add(idx(size, r, k)); out.add(idx(size, k, c)); }
      regions.forEach((rg, j) => { if (rg === g) out.add(j); });
      for (const j of neighbors(size, i)) out.add(j);
    });
    for (const i of [...out]) if (this.cells[i] !== 'empty') out.delete(i);
    return out;
  }

  cycle(i: number, autoVisible: boolean): void {
    const from = this.cells[i];
    const to: CellState =
      from === 'empty' ? (autoVisible ? 'cat' : 'mark')
      : from === 'mark' ? 'cat'
      : 'empty';
    this.apply([{ i, from, to }]);
  }

  beginPaint(): void { this.paintBatch = []; }

  paint(i: number): void {
    if (this.cells[i] !== 'empty') return;
    const move: Move = { i, from: 'empty', to: 'mark' };
    if (this.paintBatch) {
      this.cells[i] = 'mark';
      this.paintBatch.push(move);
    } else {
      this.apply([move]);
    }
  }

  endPaint(): void {
    if (this.paintBatch && this.paintBatch.length) this.undoStack.push(this.paintBatch);
    this.paintBatch = null;
  }

  undo(): boolean {
    const batch = this.undoStack.pop();
    if (!batch) return false;
    for (let k = batch.length - 1; k >= 0; k--) this.cells[batch[k].i] = batch[k].from;
    return true;
  }

  conflictCells(): number[] { return conflicts(this.puzzle, this.cells); }
  isWon(): boolean { return isSolved(this.puzzle, this.cells, this.solution); }
  mistakes(): number[] { return findMistakes(this.puzzle, this.solution, this.cells); }
  noteHint(): void { this.hintsUsed++; }

  applyHintStep(step: Step): void {
    const moves: Move[] = [];
    if (step.place !== null && this.cells[step.place] !== 'cat') {
      moves.push({ i: step.place, from: this.cells[step.place], to: 'cat' });
    }
    for (const e of step.eliminate) {
      if (this.cells[e] === 'empty') moves.push({ i: e, from: 'empty', to: 'mark' });
    }
    if (moves.length) this.apply(moves);
  }
}

const KEYS = { settings: 'sunspots.settings', stats: 'sunspots.stats', game: 'sunspots.game' } as const;
const DEFAULT_SETTINGS: Settings = { size: 9, difficulty: 'thinky', autoX: true };
const DEFAULT_STATS: Stats = { counts: {}, streak: 0, bestStreak: 0 };

function storageOr(s?: Storage): Storage | null {
  if (s) return s;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
function read<T>(key: string, fallback: T, s?: Storage): T {
  const st = storageOr(s);
  if (!st) return fallback;
  try {
    const raw = st.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
}
function write(key: string, value: unknown, s?: Storage): void {
  const st = storageOr(s);
  if (!st) return;
  try { st.setItem(key, JSON.stringify(value)); } catch { /* quota/blocked: quietly session-only */ }
}

export const persistence = {
  loadSettings: (s?: Storage): Settings => read(KEYS.settings, DEFAULT_SETTINGS, s),
  saveSettings: (v: Settings, s?: Storage): void => write(KEYS.settings, v, s),
  loadStats: (s?: Storage): Stats => read(KEYS.stats, DEFAULT_STATS, s),
  saveStats: (v: Stats, s?: Storage): void => write(KEYS.stats, v, s),
  recordWin(stats: Stats, size: number, grade: Difficulty, clean: boolean): Stats {
    const key = `${size}:${grade}`;
    const prev = stats.counts[key] ?? { solved: 0, clean: 0 };
    const streak = clean ? stats.streak + 1 : 0;
    return {
      counts: { ...stats.counts, [key]: { solved: prev.solved + 1, clean: prev.clean + (clean ? 1 : 0) } },
      streak,
      bestStreak: Math.max(stats.bestStreak, streak),
    };
  },
  loadGame(s?: Storage): SavedGame | null {
    const st = storageOr(s);
    if (!st) return null;
    try {
      const raw = st.getItem(KEYS.game);
      return raw ? (JSON.parse(raw) as SavedGame) : null;
    } catch { return null; }
  },
  saveGame: (v: SavedGame, s?: Storage): void => write(KEYS.game, v, s),
  clearGame(s?: Storage): void {
    const st = storageOr(s);
    try { st?.removeItem(KEYS.game); } catch { /* fine */ }
  },
};
