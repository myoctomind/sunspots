import { describe, it, expect } from 'vitest';
import { winCopy, winDrop, makeRubTracker, makeTapStreak } from '../src/ui/eggs';

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

describe('tap streak', () => {
  const streakOf = () => {
    let fired = 0;
    return { s: makeTapStreak(5, 600, () => fired++), fired: () => fired };
  };

  it('fires on the fifth tap inside the window', () => {
    const { s, fired } = streakOf();
    [0, 100, 200, 300, 400].forEach((t) => s.tap(t));
    expect(fired()).toBe(1);
  });

  it('does not fire on four taps', () => {
    const { s, fired } = streakOf();
    [0, 100, 200, 300].forEach((t) => s.tap(t));
    expect(fired()).toBe(0);
  });

  it('a gap longer than the window restarts the count', () => {
    const { s, fired } = streakOf();
    [0, 100, 200, 300].forEach((t) => s.tap(t));
    s.tap(1500);                       // too slow — this is tap 1 of a new run
    expect(fired()).toBe(0);
    [1600, 1700, 1800, 1900].forEach((t) => s.tap(t));
    expect(fired()).toBe(1);
  });

  it('re-arms cleanly for a second run', () => {
    const { s, fired } = streakOf();
    [0, 100, 200, 300, 400].forEach((t) => s.tap(t));
    [500, 600, 700, 800, 900].forEach((t) => s.tap(t));
    expect(fired()).toBe(2);
  });

  it('reset() abandons a run in progress', () => {
    const { s, fired } = streakOf();
    [0, 100, 200, 300].forEach((t) => s.tap(t));
    s.reset();
    s.tap(400);
    expect(fired()).toBe(0);
  });
});
