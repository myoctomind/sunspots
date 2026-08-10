import { describe, it, expect } from 'vitest';
import {
  initState, placeCat, hasContradiction, nextStep, applyStep,
} from '../src/engine/deduce';
import { idx, type CellState } from '../src/engine/board';
import { HAND5 } from './helpers';

describe('initState + placeCat propagation', () => {
  it('starts with all cells candidates on an empty board', () => {
    const st = initState(HAND5);
    expect(st.cand.every(Boolean)).toBe(true);
    expect(st.cats.every((x) => !x)).toBe(true);
  });

  it('placing a cat eliminates its row, column, region, and neighbors', () => {
    const st = initState(HAND5);
    const i = idx(5, 2, 2); // region 1 in HAND5
    placeCat(st, i);
    expect(st.cats[i]).toBe(true);
    expect(st.cand[i]).toBe(false);
    expect(st.cand[idx(5, 2, 0)]).toBe(false); // same row
    expect(st.cand[idx(5, 0, 2)]).toBe(false); // same column
    expect(st.cand[idx(5, 1, 1)]).toBe(false); // neighbor
    expect(st.cand[idx(5, 0, 3)]).toBe(false); // same region (region 1)
    expect(st.cand[idx(5, 4, 0)]).toBe(true);  // unrelated cell untouched
  });

  it('marks in cells[] and extraMarks become non-candidates', () => {
    const cells: CellState[] = new Array(25).fill('empty');
    cells[3] = 'mark';
    const st = initState(HAND5, cells, [7]);
    expect(st.cand[3]).toBe(false);
    expect(st.cand[7]).toBe(false);
  });
});

describe('hasContradiction', () => {
  it('detects an emptied catless region', () => {
    const st = initState(HAND5);
    for (const i of [0, 1, 5, 10]) st.cand[i] = false; // region 0 wiped, no cat
    expect(hasContradiction(st)).toBe(true);
  });
  it('no contradiction on a fresh board', () => {
    expect(hasContradiction(initState(HAND5))).toBe(false);
  });
});

describe('Tier 1 techniques', () => {
  it('finds a lone remaining cell in a region and places there', () => {
    const st = initState(HAND5);
    for (const i of [0, 1, 5]) st.cand[i] = false; // region 0 → only idx 10 left
    const step = nextStep(st, 1);
    expect(step).not.toBeNull();
    expect(step!.tier).toBe(1);
    expect(step!.rule).toBe('lone-region');
    expect(step!.place).toBe(10);
    expect(step!.locus.kind).toBe('region');
    expect(step!.text).toContain('patch');
    applyStep(st, step!);
    expect(st.cats[10]).toBe(true);
    expect(st.cand[idx(5, 2, 1)]).toBe(false); // row-2 neighbor eliminated by placement
  });

  it('finds a lone remaining cell in a row', () => {
    const st = initState(HAND5);
    for (let c = 1; c < 5; c++) st.cand[idx(5, 0, c)] = false; // row 0 → only col 0
    const step = nextStep(st, 1);
    expect(step).not.toBeNull();
    expect(['lone-region', 'lone-row', 'lone-col']).toContain(step!.rule);
    expect(step!.place).toBe(0);
  });

  it('returns null when no tier-1 step exists', () => {
    expect(nextStep(initState(HAND5), 1)).toBeNull();
  });
});
