import { describe, it, expect } from 'vitest';
import { mulberry32, shuffled } from '../src/engine/rng';
import { sampleArrangement, growRegions, generateCandidate } from '../src/engine/generate';
import { regionsValid, idx } from '../src/engine/board';
import { countSolutions } from '../src/engine/exact';

describe('rng', () => {
  it('is deterministic per seed and covers [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = Array.from({ length: 100 }, () => a());
    const ys = Array.from({ length: 100 }, () => b());
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('shuffled permutes without losing elements', () => {
    const rng = mulberry32(7);
    expect(shuffled(rng, [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('sampleArrangement', () => {
  it('produces valid arrangements for sizes 5–9', () => {
    for (const size of [5, 6, 7, 8, 9]) {
      for (let seed = 1; seed <= 5; seed++) {
        const cols = sampleArrangement(size, mulberry32(seed));
        expect(new Set(cols).size).toBe(size);
        for (let r = 1; r < size; r++) expect(Math.abs(cols[r] - cols[r - 1])).toBeGreaterThan(1);
      }
    }
  });
});

describe('growRegions', () => {
  it('grows contiguous full partitions with cat r in region r', () => {
    for (const size of [5, 7, 9]) {
      for (let seed = 1; seed <= 5; seed++) {
        const rng = mulberry32(seed * 100 + size);
        const cols = sampleArrangement(size, rng);
        const regions = growRegions(size, cols, rng);
        expect(regionsValid({ size, regions })).toBe(true);
        cols.forEach((c, r) => expect(regions[idx(size, r, c)]).toBe(r));
      }
    }
  });
});

describe('generateCandidate with repair', () => {
  it('returned candidates are unique, valid, and solved by their arrangement', () => {
    for (const size of [5, 6, 7, 8, 9]) {
      let collected = 0;
      for (let seed = 1; seed <= 200 && collected < 5; seed++) {
        const out = generateCandidate(size, mulberry32(seed * 131 + size));
        if (!out) continue;
        collected++;
        expect(countSolutions(out.puzzle, 2)).toBe(1);
        expect(regionsValid(out.puzzle)).toBe(true);
        out.solution.cols.forEach((c, r) => expect(out.puzzle.regions[idx(size, r, c)]).toBe(r));
      }
      expect(collected).toBe(5);
    }
  });

  it('throughput: size 9 yields at least 20 uniques in 1.5s', () => {
    const t0 = performance.now();
    let uniques = 0;
    let attempt = 0;
    while (performance.now() - t0 < 1500) {
      attempt++;
      if (generateCandidate(9, mulberry32(attempt * 7 + 9000))) uniques++;
    }
    expect(uniques).toBeGreaterThanOrEqual(20);
  });
});
