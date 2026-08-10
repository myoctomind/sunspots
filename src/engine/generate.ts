import { type Puzzle, type Solution, type Difficulty, idx, rowOf, colOf } from './board';
import { gradePuzzle } from './deduce';
import { solutions } from './exact';
import { type Rng, randInt, shuffled, mulberry32 } from './rng';

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

function regionStaysContiguous(size: number, regions: number[], cell: number): boolean {
  const g = regions[cell];
  const rest: number[] = [];
  regions.forEach((rg, i) => { if (rg === g && i !== cell) rest.push(i); });
  if (rest.length === 0) return false;
  const restSet = new Set(rest);
  const seen = new Set<number>([rest[0]]);
  const stack = [rest[0]];
  while (stack.length) {
    const i = stack.pop()!;
    const r = rowOf(size, i), c = colOf(size, i);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const ni = idx(size, nr, nc);
      if (restSet.has(ni) && !seen.has(ni)) { seen.add(ni); stack.push(ni); }
    }
  }
  return seen.size === rest.length;
}

export function repairToUnique(
  size: number, cols: number[], regions: number[], rng: Rng, maxMoves = 60,
): number[] | null {
  for (let moves = 0; moves < maxMoves; moves++) {
    const sols = solutions({ size, regions }, 2);
    if (sols.length === 1) return regions;
    const alt = sols.find((s) => s.cols.some((c, r) => c !== cols[r]))!;
    const diffRows = shuffled(
      rng,
      [...Array(size).keys()].filter((r) => alt.cols[r] !== cols[r]),
    );
    let moved = false;
    for (const r of diffRows) {
      const cell = idx(size, r, alt.cols[r]);
      if (!regionStaysContiguous(size, regions, cell)) continue;
      const a = regions[cell];
      const rr = rowOf(size, cell), cc = colOf(size, cell);
      const neighborRegions: number[] = [];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nr = rr + dr, nc = cc + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const b = regions[idx(size, nr, nc)];
        if (b !== a && !neighborRegions.includes(b)) neighborRegions.push(b);
      }
      if (neighborRegions.length === 0) continue;
      regions[cell] = neighborRegions[randInt(rng, neighborRegions.length)];
      moved = true;
      break;
    }
    if (!moved) return null;
  }
  return null;
}

export function generateCandidate(
  size: number, rng: Rng,
): { puzzle: Puzzle; solution: Solution } | null {
  const cols = sampleArrangement(size, rng);
  const regions = growRegions(size, cols, rng);
  const repaired = repairToUnique(size, cols, regions, rng);
  if (!repaired) return null;
  return { puzzle: { size, regions: repaired }, solution: { cols } };
}

export interface Generated {
  puzzle: Puzzle;
  solution: Solution;
  grade: Difficulty;
  requested: Difficulty;
}

const RANK: Record<Difficulty, number> = { relaxed: 0, thinky: 1, fiendish: 2 };

export function generatePuzzle(
  size: number,
  difficulty: Difficulty,
  seed: number,
  deadlineMs = 3000,
  now: () => number = () => performance.now(),
): Generated {
  const rng = mulberry32(seed);
  const start = now();
  let best: { puzzle: Puzzle; solution: Solution; grade: Difficulty } | null = null;
  const target = RANK[difficulty];

  // Keep looping until we have at least something graded; stop early on exact match;
  // stop trying to improve once the deadline passes.
  for (;;) {
    const cand = generateCandidate(size, rng);
    if (cand) {
      const grade = gradePuzzle(cand.puzzle);
      if (grade) {
        if (grade === difficulty) {
          return { ...cand, grade, requested: difficulty };
        }
        if (!best || Math.abs(RANK[grade] - target) < Math.abs(RANK[best.grade] - target)) {
          best = { ...cand, grade };
        }
      }
    }
    if (now() - start >= deadlineMs && best) {
      return { ...best, requested: difficulty };
    }
  }
}
