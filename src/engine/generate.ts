import { type Puzzle, type Solution, idx, rowOf, colOf } from './board';
import { countSolutions } from './exact';
import { type Rng, randInt, shuffled } from './rng';

export function sampleArrangement(size: number, rng: Rng): number[] {
  const cols = new Array<number>(size).fill(-1);
  const used = new Array<boolean>(size).fill(false);
  const rec = (row: number): boolean => {
    if (row === size) return true;
    for (const c of shuffled(rng, [...Array(size).keys()])) {
      if (used[c]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
      cols[row] = c; used[c] = true;
      if (rec(row + 1)) return true;
      cols[row] = -1; used[c] = false;
    }
    return false;
  };
  if (!rec(0)) throw new Error(`no arrangement exists for size ${size}`);
  return cols;
}

export function growRegions(size: number, cols: number[], rng: Rng): number[] {
  const regions = new Array<number>(size * size).fill(-1);
  for (let r = 0; r < size; r++) regions[idx(size, r, cols[r])] = r;
  const frontier: Array<[number, number]> = []; // [cell, region]
  const pushNbrs = (i: number, g: number) => {
    const r = rowOf(size, i), c = colOf(size, i);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const ni = idx(size, nr, nc);
      if (regions[ni] === -1) frontier.push([ni, g]);
    }
  };
  for (let r = 0; r < size; r++) pushNbrs(idx(size, r, cols[r]), r);
  let remaining = size * size - size;
  while (remaining > 0) {
    const k = randInt(rng, frontier.length);
    const [cell, g] = frontier[k];
    frontier[k] = frontier[frontier.length - 1];
    frontier.pop();
    if (regions[cell] !== -1) continue; // stale entry
    regions[cell] = g;
    remaining--;
    pushNbrs(cell, g);
  }
  return regions;
}

export function generateCandidate(
  size: number, rng: Rng,
): { puzzle: Puzzle; solution: Solution } | null {
  const cols = sampleArrangement(size, rng);
  const regions = growRegions(size, cols, rng);
  const puzzle: Puzzle = { size, regions };
  if (countSolutions(puzzle, 2) !== 1) return null;
  return { puzzle, solution: { cols } };
}
