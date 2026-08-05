import { describe, it, expect } from 'vitest';
import {
  idx, rowOf, colOf, neighbors, regionCells, regionsValid, conflicts, isSolved,
  type Puzzle, type CellState, type Solution,
} from '../src/engine/board';
import { rowRegions, HAND5 } from './helpers';

describe('board basics', () => {
  it('indexes round-trip', () => {
    expect(idx(5, 2, 3)).toBe(13);
    expect(rowOf(5, 13)).toBe(2);
    expect(colOf(5, 13)).toBe(3);
  });

  it('neighbors: corner has 3, center has 8', () => {
    expect(neighbors(5, 0).sort((a, b) => a - b)).toEqual([1, 5, 6]);
    expect(neighbors(5, 12)).toHaveLength(8);
  });

  it('regionCells finds all cells of a region', () => {
    expect(regionCells(HAND5, 0).sort((a, b) => a - b)).toEqual([0, 1, 5, 10]);
  });

  it('validates contiguous partitions and rejects broken ones', () => {
    expect(regionsValid(HAND5)).toBe(true);
    expect(regionsValid({ size: 5, regions: rowRegions(5) })).toBe(true);
    const broken = HAND5.regions.slice();
    broken[0] = 4; // detaches a lone corner cell into region 4 (non-contiguous)
    expect(regionsValid({ size: 5, regions: broken })).toBe(false);
  });
});

describe('conflicts', () => {
  const pz: Puzzle = { size: 5, regions: rowRegions(5) };
  const empty = (): CellState[] => new Array(25).fill('empty');

  it('flags same column and diagonal touch, not legal pairs', () => {
    const cells = empty();
    cells[idx(5, 0, 0)] = 'cat';
    cells[idx(5, 1, 1)] = 'cat'; // diagonal touch
    cells[idx(5, 3, 0)] = 'cat'; // same column as first
    const bad = conflicts(pz, cells).sort((a, b) => a - b);
    expect(bad).toEqual([idx(5, 0, 0), idx(5, 1, 1), idx(5, 3, 0)]);
  });

  it('empty board has no conflicts', () => {
    expect(conflicts(pz, empty())).toEqual([]);
  });
});

describe('isSolved', () => {
  it('true only when cats exactly match the solution', () => {
    const pz: Puzzle = { size: 5, regions: rowRegions(5) };
    const sol: Solution = { cols: [0, 2, 4, 1, 3] };
    const cells: CellState[] = new Array(25).fill('empty');
    sol.cols.forEach((c, r) => (cells[idx(5, r, c)] = 'cat'));
    expect(isSolved(pz, cells, sol)).toBe(true);
    cells[idx(5, 0, 0)] = 'empty';
    expect(isSolved(pz, cells, sol)).toBe(false);
  });
});
