import { describe, it, expect } from 'vitest';
import { winCopy, winDrop, makeRubTracker } from '../src/ui/eggs';

describe('caturday', () => {
  it('saturday swaps the toast copy and the drop emoji', () => {
    expect(winCopy(false, 6)).toContain('Caturday');
    expect(winCopy(true, 6)).toContain('Caturday');
    expect(winDrop(6)).toBe('🐟');
  });
  it('weekdays keep the yarn and sunspot copy', () => {
    expect(winCopy(false, 1)).toBe('Every cat in its sunspot ☀︎');
    expect(winCopy(true, 1)).toContain('Clean solve');
    expect(winDrop(1)).toBe('🧶');
  });
});

describe('rub tracker', () => {
  it('fires after three direction reversals', () => {
    let fires = 0;
    const t = makeRubTracker(() => fires++);
    t.start(0);
    for (const x of [10, 2, 12, 3, 14]) t.move(x);
    expect(fires).toBe(1);
  });
  it('ignores one-way drags and sub-threshold jitter', () => {
    let fires = 0;
    const t = makeRubTracker(() => fires++);
    t.start(0);
    for (const x of [8, 16, 24, 32, 33, 32, 33, 32]) t.move(x);
    expect(fires).toBe(0);
  });
  it('does nothing after stop', () => {
    let fires = 0;
    const t = makeRubTracker(() => fires++);
    t.start(0);
    t.stop();
    for (const x of [10, 2, 12, 3]) t.move(x);
    expect(fires).toBe(0);
  });
});
