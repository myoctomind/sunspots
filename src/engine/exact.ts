import { type Puzzle, type Solution, idx } from './board';

export function countSolutions(pz: Puzzle, limit = 2): number {
  const { size, regions } = pz;
  let count = 0;
  const cols = new Array<number>(size).fill(-1);
  const usedCols = new Array<boolean>(size).fill(false);
  const usedRegions = new Array<boolean>(size).fill(false);
  const rec = (row: number): void => {
    if (count >= limit) return;
    if (row === size) { count++; return; }
    for (let c = 0; c < size; c++) {
      if (usedCols[c]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
      const g = regions[idx(size, row, c)];
      if (usedRegions[g]) continue;
      usedCols[c] = true; usedRegions[g] = true; cols[row] = c;
      rec(row + 1);
      usedCols[c] = false; usedRegions[g] = false; cols[row] = -1;
    }
  };
  rec(0);
  return count;
}

export function solve(pz: Puzzle): Solution | null {
  const { size, regions } = pz;
  const cols = new Array<number>(size).fill(-1);
  const usedCols = new Array<boolean>(size).fill(false);
  const usedRegions = new Array<boolean>(size).fill(false);
  const rec = (row: number): boolean => {
    if (row === size) return true;
    for (let c = 0; c < size; c++) {
      if (usedCols[c]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
      const g = regions[idx(size, row, c)];
      if (usedRegions[g]) continue;
      usedCols[c] = true; usedRegions[g] = true; cols[row] = c;
      if (rec(row + 1)) return true;
      usedCols[c] = false; usedRegions[g] = false; cols[row] = -1;
    }
    return false;
  };
  return rec(0) ? { cols: cols.slice() } : null;
}
