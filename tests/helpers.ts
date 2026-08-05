import type { Puzzle } from '../src/engine/board';

/** Rows-as-regions board: region id = row index. Always valid. */
export function rowRegions(size: number): number[] {
  return Array.from({ length: size * size }, (_, i) => Math.floor(i / size));
}

/** Hand-drawn 5×5 partition, verified contiguous. */
export const HAND5: Puzzle = {
  size: 5,
  regions: [
    0, 0, 1, 1, 2,
    0, 3, 3, 1, 2,
    0, 3, 1, 1, 2,
    3, 3, 4, 4, 2,
    4, 4, 4, 2, 2,
  ],
};

/** Brute-force reference: count valid cat arrangements by enumerating permutations. */
export function referenceCount(pz: Puzzle): number {
  const { size, regions } = pz;
  let count = 0;
  const rec = (acc: number[], rest: number[]) => {
    if (rest.length === 0) {
      for (let r = 1; r < size; r++) if (Math.abs(acc[r] - acc[r - 1]) <= 1) return;
      const gs = acc.map((c, r) => regions[r * size + c]);
      if (new Set(gs).size === size) count++;
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      rec([...acc, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]);
    }
  };
  rec([], [...Array(size).keys()]);
  return count;
}

/** Minimal localStorage stand-in for store tests. */
export function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => void m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}
