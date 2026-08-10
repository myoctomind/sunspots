import {
  type Puzzle, type Solution, type CellState, type Difficulty,
  idx, rowOf, colOf, neighbors, regionCells,
} from './board';

export type Tier = 1 | 2 | 3;
export type NameFn = (g: number) => string;

export interface Locus { kind: 'region' | 'row' | 'col' | 'cells'; index: number; cells: number[] }
export interface Step {
  tier: Tier;
  rule: string;
  place: number | null;
  eliminate: number[];
  locus: Locus;
  text: string;
}

export interface DeduceState { size: number; regions: number[]; cand: boolean[]; cats: boolean[] }

const defaultName: NameFn = (g) => `patch ${g + 1}`;

export function initState(pz: Puzzle, cells?: CellState[], extraMarks?: Iterable<number>): DeduceState {
  const n = pz.size * pz.size;
  const st: DeduceState = {
    size: pz.size,
    regions: pz.regions.slice(),
    cand: new Array<boolean>(n).fill(true),
    cats: new Array<boolean>(n).fill(false),
  };
  if (cells) {
    cells.forEach((s, i) => { if (s === 'mark') st.cand[i] = false; });
    cells.forEach((s, i) => { if (s === 'cat') placeCat(st, i); });
  }
  if (extraMarks) for (const i of extraMarks) st.cand[i] = false;
  return st;
}

export function placeCat(st: DeduceState, i: number): void {
  const { size } = st;
  st.cats[i] = true;
  st.cand[i] = false;
  const r = rowOf(size, i), c = colOf(size, i), g = st.regions[i];
  for (let k = 0; k < size; k++) {
    st.cand[idx(size, r, k)] = false;
    st.cand[idx(size, k, c)] = false;
  }
  st.regions.forEach((rg, j) => { if (rg === g) st.cand[j] = false; });
  for (const j of neighbors(size, i)) st.cand[j] = false;
}

/** Cells of a unit (region/row/col) that could still take a cat. */
function unitInfo(st: DeduceState) {
  const { size } = st;
  const regions: { cat: boolean; cands: number[] }[] =
    Array.from({ length: size }, () => ({ cat: false, cands: [] }));
  const rows: { cat: boolean; cands: number[] }[] =
    Array.from({ length: size }, () => ({ cat: false, cands: [] }));
  const cols: { cat: boolean; cands: number[] }[] =
    Array.from({ length: size }, () => ({ cat: false, cands: [] }));
  for (let i = 0; i < size * size; i++) {
    const r = rowOf(size, i), c = colOf(size, i), g = st.regions[i];
    if (st.cats[i]) { regions[g].cat = true; rows[r].cat = true; cols[c].cat = true; }
    if (st.cand[i]) { regions[g].cands.push(i); rows[r].cands.push(i); cols[c].cands.push(i); }
  }
  return { regions, rows, cols };
}

export function hasContradiction(st: DeduceState): boolean {
  const u = unitInfo(st);
  const bad = (xs: { cat: boolean; cands: number[] }[]) =>
    xs.some((x) => !x.cat && x.cands.length === 0);
  return bad(u.regions) || bad(u.rows) || bad(u.cols);
}

function tier1(st: DeduceState, name: NameFn): Step | null {
  const u = unitInfo(st);
  for (let g = 0; g < st.size; g++) {
    const { cat, cands } = u.regions[g];
    if (!cat && cands.length === 1) {
      return {
        tier: 1, rule: 'lone-region', place: cands[0], eliminate: [],
        locus: { kind: 'region', index: g, cells: regionCells({ size: st.size, regions: st.regions }, g) },
        text: `The ${name(g)} has a single sunny cell left — the cat must nap there.`,
      };
    }
  }
  for (let r = 0; r < st.size; r++) {
    const { cat, cands } = u.rows[r];
    if (!cat && cands.length === 1) {
      return {
        tier: 1, rule: 'lone-row', place: cands[0], eliminate: [],
        locus: { kind: 'row', index: r, cells: Array.from({ length: st.size }, (_, c) => idx(st.size, r, c)) },
        text: `Row ${r + 1} has only one spot left for its cat.`,
      };
    }
  }
  for (let c = 0; c < st.size; c++) {
    const { cat, cands } = u.cols[c];
    if (!cat && cands.length === 1) {
      return {
        tier: 1, rule: 'lone-col', place: cands[0], eliminate: [],
        locus: { kind: 'col', index: c, cells: Array.from({ length: st.size }, (_, r) => idx(st.size, r, c)) },
        text: `Column ${c + 1} has only one spot left for its cat.`,
      };
    }
  }
  return null;
}

export function nextStep(st: DeduceState, maxTier: Tier, name: NameFn = defaultName): Step | null {
  const t1 = tier1(st, name);
  if (t1) return t1;
  // Tiers 2 and 3 are added in the next task.
  void maxTier;
  return null;
}

export function applyStep(st: DeduceState, step: Step): void {
  if (step.place !== null) placeCat(st, step.place);
  for (const i of step.eliminate) st.cand[i] = false;
}
