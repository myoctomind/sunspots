import { type Puzzle, type Solution, idx } from './board';

export function solutions(pz: Puzzle, limit: number): Solution[] {
  const { size, regions } = pz;
  const out: Solution[] = [];
  const cols = new Array<number>(size).fill(-1);
  const usedCols = new Array<boolean>(size).fill(false);
  const usedRegions = new Array<boolean>(size).fill(false);
  const rec = (row: number): void => {
    if (out.length >= limit) return;
    if (row === size) { out.push({ cols: cols.slice() }); return; }
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
  return out;
}

export function countSolutions(pz: Puzzle, limit = 2): number {
  return solutions(pz, limit).length;
}

export function solve(pz: Puzzle): Solution | null {
  return solutions(pz, 1)[0] ?? null;
}
