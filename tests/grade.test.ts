import { describe, it, expect } from 'vitest';
import { solveWithTiers, gradePuzzle, findMistakes, nextStep, initState } from '../src/engine/deduce';
import { generateCandidate } from '../src/engine/generate';
import { mulberry32 } from '../src/engine/rng';
import { idx, rowOf, colOf, type CellState } from '../src/engine/board';
import { HAND5 } from './helpers';

describe('solveWithTiers legality (property test)', () => {
  it('every emitted step is consistent with the true solution', () => {
    let checked = 0;
    for (const size of [5, 7, 9]) {
      for (let seed = 1; seed <= 10; seed++) {
        const cand = generateCandidate(size, mulberry32(seed * 31 + size));
        if (!cand) continue;
        checked++;
        const { solved, steps } = solveWithTiers(cand.puzzle, 3);
        const solCells = new Set(cand.solution.cols.map((c, r) => idx(size, r, c)));
        for (const s of steps) {
          if (s.place !== null) expect(solCells.has(s.place)).toBe(true);
          for (const e of s.eliminate) expect(solCells.has(e)).toBe(false);
        }
        if (solved) {
          const placed = steps.filter((s) => s.place !== null).map((s) => s.place!);
          expect(new Set(placed)).toEqual(solCells);
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('at least half of unique candidates are solvable within tier 3', () => {
    let total = 0, solved = 0;
    for (const size of [5, 6, 7]) {
      for (let seed = 1; seed <= 15; seed++) {
        const cand = generateCandidate(size, mulberry32(seed * 97 + size));
        if (!cand) continue;
        total++;
        if (solveWithTiers(cand.puzzle, 3).solved) solved++;
      }
    }
    expect(total).toBeGreaterThan(10);
    expect(solved / total).toBeGreaterThanOrEqual(0.5);
  });
});

describe('gradePuzzle staging', () => {
  it('produces at least two distinct grades across a seed scan (deterministic)', () => {
    const grades = new Set<string>();
    for (let seed = 1; seed <= 120; seed++) {
      const cand = generateCandidate(6, mulberry32(seed));
      if (!cand) continue;
      const g = gradePuzzle(cand.puzzle);
      if (g) grades.add(g);
    }
    // If this ever fails, widen the seed range — it is deterministic, not flaky.
    expect(grades.size).toBeGreaterThanOrEqual(2);
  });
});

describe('findMistakes', () => {
  it('flags wrong cats and manual marks on solution cells, nothing else', () => {
    const cand = generateCandidate(5, (() => { // first seed that yields a candidate
      for (let s = 1; s < 50; s++) { const c = generateCandidate(5, mulberry32(s)); if (c) return mulberry32(s); }
      throw new Error('no candidate found');
    })())!;
    const { puzzle, solution } = cand;
    const cells: CellState[] = new Array(25).fill('empty');
    const solCell0 = idx(5, 0, solution.cols[0]);
    const wrongCell = solCell0 === 24 ? 23 : 24;
    cells[wrongCell] = 'cat';   // a cat not on the solution
    cells[solCell0] = 'mark';   // a mark covering a solution cell
    const m = findMistakes(puzzle, solution, cells).sort((a, b) => a - b);
    expect(m).toEqual([...new Set([solCell0, wrongCell])].sort((a, b) => a - b));
    // correct cat is not a mistake
    const good: CellState[] = new Array(25).fill('empty');
    good[solCell0] = 'cat';
    expect(findMistakes(puzzle, solution, good)).toEqual([]);
  });
});

describe('tier gating', () => {
  it('nextStep with maxTier 1 never returns tier 2/3 steps', () => {
    const st = initState(HAND5);
    const s = nextStep(st, 1);
    if (s) expect(s.tier).toBe(1);
  });
});
