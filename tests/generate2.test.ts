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

  it('past-deadline fallback still returns a graded, unique puzzle', () => {
    let t = 0;
    const fakeNow = () => { t += 500; return t; }; // deadline blows almost immediately
    const g = generatePuzzle(7, 'fiendish', 99, 1000, fakeNow);
    expect(g.requested).toBe('fiendish');
    expect(['relaxed', 'thinky', 'fiendish']).toContain(g.grade);
    expect(countSolutions(g.puzzle, 2)).toBe(1);
  });

  it('is deterministic for a given seed', () => {
    const a = generatePuzzle(6, 'thinky', 7);
    const b = generatePuzzle(6, 'thinky', 7);
    expect(a.puzzle.regions).toEqual(b.puzzle.regions);
    expect(a.grade).toBe(b.grade);
  });
});
