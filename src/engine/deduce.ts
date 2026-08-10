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

function listOr(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} or ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, or ${parts[parts.length - 1]}`;
}

/** Why each blocked cell of a unit is out, summarized as an or-list of causes. */
function blockedReason(st: DeduceState, cells: number[]): string {
  const { size } = st;
  const cats = [...Array(size * size).keys()].filter((i) => st.cats[i]);
  let line = false, patch = false, touch = false, mark = false;
  for (const j of cells) {
    if (st.cand[j] || st.cats[j]) continue;
    const r = rowOf(size, j), c = colOf(size, j);
    const nb = neighbors(size, j);
    if (cats.some((i) => rowOf(size, i) === r || colOf(size, i) === c)) line = true;
    else if (cats.some((i) => st.regions[i] === st.regions[j])) patch = true;
    else if (nb.some((i) => st.cats[i])) touch = true;
    else mark = true;
  }
  const parts: string[] = [];
  if (line) parts.push('shares a row or column with a cat');
  if (patch) parts.push('sits in a patch whose cat is already napping');
  if (touch) parts.push('touches a cat');
  if (mark) parts.push('is paw-marked');
  return parts.length ? listOr(parts) : 'is blocked';
}

function tier1(st: DeduceState, name: NameFn): Step | null {
  const u = unitInfo(st);
  for (let g = 0; g < st.size; g++) {
    const { cat, cands } = u.regions[g];
    if (!cat && cands.length === 1) {
      const cells = regionCells({ size: st.size, regions: st.regions }, g);
      return {
        tier: 1, rule: 'lone-region', place: cands[0], eliminate: [],
        locus: { kind: 'region', index: g, cells },
        text: `Every other cell of the ${name(g)} ${blockedReason(st, cells)} — one sunny spot left, so its cat naps here.`,
      };
    }
  }
  for (let r = 0; r < st.size; r++) {
    const { cat, cands } = u.rows[r];
    if (!cat && cands.length === 1) {
      const cells = Array.from({ length: st.size }, (_, c) => idx(st.size, r, c));
      return {
        tier: 1, rule: 'lone-row', place: cands[0], eliminate: [],
        locus: { kind: 'row', index: r, cells },
        text: `Every other cell in row ${r + 1} ${blockedReason(st, cells)} — one spot left, so row ${r + 1}'s cat sits here.`,
      };
    }
  }
  for (let c = 0; c < st.size; c++) {
    const { cat, cands } = u.cols[c];
    if (!cat && cands.length === 1) {
      const cells = Array.from({ length: st.size }, (_, r) => idx(st.size, r, c));
      return {
        tier: 1, rule: 'lone-col', place: cands[0], eliminate: [],
        locus: { kind: 'col', index: c, cells },
        text: `Every other cell in column ${c + 1} ${blockedReason(st, cells)} — one spot left, so column ${c + 1}'s cat sits here.`,
      };
    }
  }
  return null;
}

export function applyStep(st: DeduceState, step: Step): void {
  if (step.place !== null) placeCat(st, step.place);
  for (const i of step.eliminate) st.cand[i] = false;
}

function tier2(st: DeduceState, name: NameFn): Step | null {
  const { size } = st;
  const u = unitInfo(st);

  // 2a: a region's candidates all in one row/col → clear the rest of that line.
  for (let g = 0; g < size; g++) {
    const { cat, cands } = u.regions[g];
    if (cat || cands.length === 0) continue;
    const rs = new Set(cands.map((i) => rowOf(size, i)));
    if (rs.size === 1) {
      const r = [...rs][0];
      const elim = u.rows[r].cands.filter((i) => st.regions[i] !== g);
      if (elim.length) return {
        tier: 2, rule: 'confine-region-row', place: null, eliminate: elim,
        locus: { kind: 'region', index: g, cells: cands.slice() },
        text: `All the ${name(g)}'s open cells sit in row ${r + 1} — its cat is sure to take that row, so nothing else in row ${r + 1} can hold a cat.`,
      };
    }
    const cs = new Set(cands.map((i) => colOf(size, i)));
    if (cs.size === 1) {
      const c = [...cs][0];
      const elim = u.cols[c].cands.filter((i) => st.regions[i] !== g);
      if (elim.length) return {
        tier: 2, rule: 'confine-region-col', place: null, eliminate: elim,
        locus: { kind: 'region', index: g, cells: cands.slice() },
        text: `All the ${name(g)}'s open cells sit in column ${c + 1} — its cat is sure to take that column, so nothing else in column ${c + 1} can hold a cat.`,
      };
    }
  }

  // 2b: a line's candidates all in one region → clear that region off the line.
  for (let r = 0; r < size; r++) {
    const { cat, cands } = u.rows[r];
    if (cat || cands.length === 0) continue;
    const gs = new Set(cands.map((i) => st.regions[i]));
    if (gs.size === 1) {
      const g = [...gs][0];
      const elim = u.regions[g].cands.filter((i) => rowOf(size, i) !== r);
      if (elim.length) return {
        tier: 2, rule: 'confine-row-region', place: null, eliminate: elim,
        locus: { kind: 'row', index: r, cells: cands.slice() },
        text: `Row ${r + 1}'s open cells all belong to the ${name(g)} — its cat must sit in row ${r + 1}, so that patch's other cells are out.`,
      };
    }
  }
  for (let c = 0; c < size; c++) {
    const { cat, cands } = u.cols[c];
    if (cat || cands.length === 0) continue;
    const gs = new Set(cands.map((i) => st.regions[i]));
    if (gs.size === 1) {
      const g = [...gs][0];
      const elim = u.regions[g].cands.filter((i) => colOf(size, i) !== c);
      if (elim.length) return {
        tier: 2, rule: 'confine-col-region', place: null, eliminate: elim,
        locus: { kind: 'col', index: c, cells: cands.slice() },
        text: `Column ${c + 1}'s open cells all belong to the ${name(g)} — its cat must sit in column ${c + 1}, so that patch's other cells are out.`,
      };
    }
  }

  // 2c: neighbor-force — a cat at x would wipe out some other unit entirely.
  const u2 = u;
  for (let x = 0; x < size * size; x++) {
    if (!st.cand[x]) continue;
    const nb = new Set(neighbors(size, x));
    for (let g = 0; g < size; g++) {
      if (g === st.regions[x]) continue;
      const { cat, cands } = u2.regions[g];
      if (cat || cands.length === 0) continue;
      if (cands.every((i) => nb.has(i))) {
        return {
          tier: 2, rule: 'neighbor-force', place: null, eliminate: [x],
          locus: { kind: 'cells', index: -1, cells: [x, ...cands] },
          text: `Every open cell of the ${name(g)} touches this one — a cat napping here would leave that patch nowhere to go, so this cell stays empty.`,
        };
      }
    }
  }
  return null;
}

function combinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < n; i++) { acc.push(i); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return out;
}

function tier3Sets(st: DeduceState, name: NameFn): Step | null {
  const { size } = st;
  const u = unitInfo(st);
  for (const k of [2, 3]) {
    const open = [...Array(size).keys()].filter((g) => !u.regions[g].cat && u.regions[g].cands.length > 0);
    for (const combo of combinations(open.length, k)) {
      const gs = combo.map((i) => open[i]);
      for (const axis of ['row', 'col'] as const) {
        const lines = new Set<number>();
        for (const g of gs) for (const i of u.regions[g].cands) {
          lines.add(axis === 'row' ? rowOf(size, i) : colOf(size, i));
        }
        if (lines.size !== k) continue;
        const inSet = new Set(gs);
        const elim: number[] = [];
        for (const ln of lines) {
          const lineCands = axis === 'row' ? u.rows[ln].cands : u.cols[ln].cands;
          for (const i of lineCands) if (!inSet.has(st.regions[i])) elim.push(i);
        }
        if (elim.length) {
          const patches = gs.map(name).join(' + ');
          return {
            tier: 3, rule: `set-${axis}s`, place: null, eliminate: elim,
            locus: { kind: 'cells', index: -1, cells: gs.flatMap((g) => u.regions[g].cands) },
            text: `Between them, ${patches} only have open cells in ${k} ${axis}s — their cats will fill those ${axis}s, so no other patch can use them.`,
          };
        }
      }
    }
  }
  return null;
}

function cloneState(st: DeduceState): DeduceState {
  return { size: st.size, regions: st.regions, cand: st.cand.slice(), cats: st.cats.slice() };
}

/** Name the unit the trial starved and light its still-open spots on the real board. */
function probeExplain(st: DeduceState, x: number, trial: DeduceState, name: NameFn): Step {
  const { size } = st;
  const u = unitInfo(trial);
  const units = [
    ...u.regions.map((e, g) => ({
      ...e, desc: `the ${name(g)}`, cells: regionCells({ size, regions: st.regions }, g),
    })),
    ...u.rows.map((e, r) => ({
      ...e, desc: `row ${r + 1}`, cells: Array.from({ length: size }, (_, c) => idx(size, r, c)),
    })),
    ...u.cols.map((e, c) => ({
      ...e, desc: `column ${c + 1}`, cells: Array.from({ length: size }, (_, r) => idx(size, r, c)),
    })),
  ];
  const dead = units.find((e) => !e.cat && e.cands.length === 0);
  const spots = dead ? dead.cells.filter((i) => st.cand[i] && i !== x) : [];
  return {
    tier: 3, rule: 'probe', place: null, eliminate: [x],
    locus: { kind: 'cells', index: -1, cells: [x, ...spots] },
    text: `Try a cat here and ${dead?.desc ?? 'part of the board'} ends up with nowhere to nap — a dead end, so this cell must stay empty.`,
  };
}

function tier3Probe(st: DeduceState, name: NameFn): Step | null {
  const { size } = st;
  for (let x = 0; x < size * size; x++) {
    if (!st.cand[x]) continue;
    const trial = cloneState(st);
    placeCat(trial, x);
    for (let guard = 0; guard < size * size * 4; guard++) {
      if (hasContradiction(trial)) return probeExplain(st, x, trial, name);
      const s = tier1(trial, name) ?? tier2(trial, name);
      if (!s) break;
      applyStep(trial, s);
    }
    if (hasContradiction(trial)) return probeExplain(st, x, trial, name);
  }
  return null;
}

export function nextStep(st: DeduceState, maxTier: Tier, name: NameFn = defaultName): Step | null {
  const t1 = tier1(st, name);
  if (t1) return t1;
  if (maxTier >= 2) {
    const t2 = tier2(st, name);
    if (t2) return t2;
  }
  if (maxTier >= 3) {
    const t3 = tier3Sets(st, name) ?? tier3Probe(st, name);
    if (t3) return t3;
  }
  return null;
}

export function solveWithTiers(
  pz: Puzzle, maxTier: Tier,
): { solved: boolean; maxTierUsed: Tier | 0; steps: Step[] } {
  const st = initState(pz);
  const steps: Step[] = [];
  let maxTierUsed: Tier | 0 = 0;
  for (let guard = 0; guard < pz.size * pz.size * 8; guard++) {
    if (st.cats.filter(Boolean).length === pz.size) {
      return { solved: true, maxTierUsed, steps };
    }
    const s = nextStep(st, maxTier);
    if (!s) break;
    steps.push(s);
    if (s.tier > maxTierUsed) maxTierUsed = s.tier;
    applyStep(st, s);
  }
  const solved = st.cats.filter(Boolean).length === pz.size;
  return { solved, maxTierUsed, steps };
}

export function gradePuzzle(pz: Puzzle): Difficulty | null {
  if (solveWithTiers(pz, 1).solved) return 'relaxed';
  if (solveWithTiers(pz, 2).solved) return 'thinky';
  if (solveWithTiers(pz, 3).solved) return 'fiendish';
  return null;
}

export function findMistakes(pz: Puzzle, sol: Solution, cells: CellState[]): number[] {
  const { size } = pz;
  const out: number[] = [];
  cells.forEach((s, i) => {
    const onSolution = sol.cols[rowOf(size, i)] === colOf(size, i);
    if (s === 'cat' && !onSolution) out.push(i);
    if (s === 'mark' && onSolution) out.push(i);
  });
  return out;
}
