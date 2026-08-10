import { describe, it, expect } from 'vitest';
import { borderSegments, PALETTE, REGION_NAMES, regionName } from '../src/ui/render';
import { HAND5, rowRegions } from './helpers';
import { idx } from '../src/engine/board';

describe('borderSegments', () => {
  it('segment count = differing-neighbor pairs + perimeter', () => {
    for (const pz of [HAND5, { size: 5, regions: rowRegions(5) }]) {
      let differing = 0;
      for (let r = 0; r < pz.size; r++) for (let c = 0; c < pz.size; c++) {
        if (c + 1 < pz.size && pz.regions[idx(pz.size, r, c)] !== pz.regions[idx(pz.size, r, c + 1)]) differing++;
        if (r + 1 < pz.size && pz.regions[idx(pz.size, r, c)] !== pz.regions[idx(pz.size, r + 1, c)]) differing++;
      }
      expect(borderSegments(pz)).toHaveLength(differing + 4 * pz.size);
    }
  });

  it('every segment is axis-aligned with unit length', () => {
    for (const s of borderSegments(HAND5)) {
      const len = Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1);
      expect(len).toBe(1);
      expect(s.x1 === s.x2 || s.y1 === s.y2).toBe(true);
    }
  });
});

describe('palette', () => {
  it('has 9 fills and 9 names', () => {
    expect(PALETTE).toHaveLength(9);
    expect(REGION_NAMES).toHaveLength(9);
    expect(regionName(0)).toBe('peach patch');
    expect(regionName(9)).toBe('peach patch'); // wraps
  });
});
