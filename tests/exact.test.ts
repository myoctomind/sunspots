import { describe, it, expect } from 'vitest';
import { countSolutions, solve } from '../src/engine/exact';
import type { Puzzle } from '../src/engine/board';
import { rowRegions, HAND5, referenceCount } from './helpers';

describe('countSolutions vs brute-force reference', () => {
  it('3×3 has zero solutions regardless of regions', () => {
    const pz: Puzzle = { size: 3, regions: rowRegions(3) };
    expect(referenceCount(pz)).toBe(0);
    expect(countSolutions(pz, 10)).toBe(0);
  });

  it('rows-as-regions 5×5 matches reference (many solutions)', () => {
    const pz: Puzzle = { size: 5, regions: rowRegions(5) };
    const ref = referenceCount(pz);
    expect(ref).toBeGreaterThan(1);
    expect(countSolutions(pz, ref + 5)).toBe(ref);
  });

  it('hand partition matches reference', () => {
    expect(countSolutions(HAND5, 1000)).toBe(referenceCount(HAND5));
  });

  it('limit stops early', () => {
    const pz: Puzzle = { size: 5, regions: rowRegions(5) };
    expect(countSolutions(pz, 2)).toBe(2);
  });
});

describe('solve', () => {
  it('returns a valid solution when one exists, null when none', () => {
    const pz: Puzzle = { size: 5, regions: rowRegions(5) };
    const sol = solve(pz);
    expect(sol).not.toBeNull();
    const cols = sol!.cols;
    expect(new Set(cols).size).toBe(5);
    for (let r = 1; r < 5; r++) expect(Math.abs(cols[r] - cols[r - 1])).toBeGreaterThan(1);
    expect(solve({ size: 3, regions: rowRegions(3) })).toBeNull();
  });
});
