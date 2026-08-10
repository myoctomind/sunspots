import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '../src/engine/generate';
import { gradePuzzle } from '../src/engine/deduce';
import { countSolutions } from '../src/engine/exact';

describe('generatePuzzle', () => {
  it('returns an exact-match relaxed 5×5 with a real deadline', () => {
    const g = generatePuzzle(5, 'relaxed', 12345);
    expect(g.requested).toBe('relaxed');
    expect(g.grade).toBe('relaxed');
    expect(countSolutions(g.puzzle, 2)).toBe(1);
    expect(gradePuzzle(g.puzzle)).toBe('relaxed');
  });

  it('past-deadline fallback provably exercises the non-matching path', () => {
    let hit: ReturnType<typeof generatePuzzle> | null = null;
    for (let seed = 1; seed <= 50 && !hit; seed++) {
      let t = 0;
      const g = generatePuzzle(7, 'fiendish', seed, 1000, () => { t += 500; return t; });
      if (g.grade !== 'fiendish') hit = g;
    }
    expect(hit).not.toBeNull();
    expect(hit!.requested).toBe('fiendish');
    expect(['relaxed', 'thinky']).toContain(hit!.grade);
    expect(countSolutions(hit!.puzzle, 2)).toBe(1);
  });

  it('is deterministic for a given seed', () => {
    const a = generatePuzzle(6, 'thinky', 7);
    const b = generatePuzzle(6, 'thinky', 7);
    expect(a.puzzle.regions).toEqual(b.puzzle.regions);
    expect(a.grade).toBe(b.grade);
  });
});
