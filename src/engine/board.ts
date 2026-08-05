export type CellState = 'empty' | 'mark' | 'cat';
export type Difficulty = 'relaxed' | 'thinky' | 'fiendish';

export interface Puzzle { size: number; regions: number[] }
export interface Solution { cols: number[] }

export const idx = (size: number, r: number, c: number): number => r * size + c;
export const rowOf = (size: number, i: number): number => Math.floor(i / size);
export const colOf = (size: number, i: number): number => i % size;

export function neighbors(size: number, i: number): number[] {
  const r = rowOf(size, i), c = colOf(size, i);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(idx(size, nr, nc));
  }
  return out;
}

export function regionCells(pz: Puzzle, region: number): number[] {
  const out: number[] = [];
  pz.regions.forEach((g, i) => { if (g === region) out.push(i); });
  return out;
}

export function regionsValid(pz: Puzzle): boolean {
  const { size, regions } = pz;
  if (regions.length !== size * size) return false;
  if (!regions.every((g) => Number.isInteger(g) && g >= 0 && g < size)) return false;
  for (let g = 0; g < size; g++) {
    const cells = regionCells(pz, g);
    if (cells.length === 0) return false;
    const seen = new Set<number>([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const i = stack.pop()!;
      const r = rowOf(size, i), c = colOf(size, i);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const ni = idx(size, nr, nc);
        if (regions[ni] === g && !seen.has(ni)) { seen.add(ni); stack.push(ni); }
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}

export function conflicts(pz: Puzzle, cells: CellState[]): number[] {
  const { size, regions } = pz;
  const cats: number[] = [];
  cells.forEach((s, i) => { if (s === 'cat') cats.push(i); });
  const bad = new Set<number>();
  for (let a = 0; a < cats.length; a++) for (let b = a + 1; b < cats.length; b++) {
    const i = cats[a], j = cats[b];
    const ri = rowOf(size, i), ci = colOf(size, i);
    const rj = rowOf(size, j), cj = colOf(size, j);
    const touch = Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1;
    if (ri === rj || ci === cj || regions[i] === regions[j] || touch) { bad.add(i); bad.add(j); }
  }
  return [...bad];
}

export function isSolved(pz: Puzzle, cells: CellState[], sol: Solution): boolean {
  const { size } = pz;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const want = sol.cols[r] === c;
    const have = cells[idx(size, r, c)] === 'cat';
    if (want !== have) return false;
  }
  return true;
}
