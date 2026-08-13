import { describe, it, expect } from 'vitest';
import { Game, persistence, type Settings, type Stats } from '../src/state/store';
import { generatePuzzle } from '../src/engine/generate';
import { idx, rowOf, colOf } from '../src/engine/board';
import { fakeStorage } from './helpers';

const freshGame = () => new Game(generatePuzzle(5, 'relaxed', 42));

describe('tap toggle + setCat + auto marks', () => {
  it('tap toggles paw on/off; a tap on a cat clears it', () => {
    const g = freshGame();
    g.tapToggle(0);
    expect(g.cells[0]).toBe('mark');
    g.tapToggle(0);
    expect(g.cells[0]).toBe('empty');
    g.setCat(0);
    expect(g.cells[0]).toBe('cat');
    g.tapToggle(0);
    expect(g.cells[0]).toBe('empty');
  });

  it('setCat converts any state to cat and is a single undo step', () => {
    const g = freshGame();
    g.tapToggle(0);
    g.setCat(0);
    expect(g.cells[0]).toBe('cat');
    expect(g.undo()).toBe(true);
    expect(g.cells[0]).toBe('mark');
  });

  it('autoMarks covers row/col/region/neighbors of cats, empty cells only', () => {
    const g = freshGame();
    const i = idx(5, 2, 2);
    g.setCat(i);
    const marks = g.autoMarks(true);
    expect(marks.has(idx(5, 2, 0))).toBe(true);
    expect(marks.has(idx(5, 0, 2))).toBe(true);
    expect(marks.has(idx(5, 1, 1))).toBe(true);
    expect(marks.has(i)).toBe(false);
    expect(g.autoMarks(false).size).toBe(0);
  });
});

describe('undo', () => {
  it('undoes one action at a time, drags as one batch', () => {
    const g = freshGame();
    g.tapToggle(0); // mark
    g.beginPaint(5); g.paint(5); g.paint(6); g.paint(7); g.endPaint();
    expect(g.cells[5]).toBe('mark');
    expect(g.undo()).toBe(true);
    expect(g.cells[5]).toBe('empty');
    expect(g.cells[6]).toBe('empty');
    expect(g.cells[7]).toBe('empty');
    expect(g.cells[0]).toBe('mark');
    expect(g.undo()).toBe(true);
    expect(g.cells[0]).toBe('empty');
    expect(g.undo()).toBe(false);
  });
});

describe('swipe mode', () => {
  it('a swipe starting on a paw-mark erases marks along the way', () => {
    const g = freshGame();
    g.tapToggle(5); g.tapToggle(6); g.tapToggle(7);
    g.beginPaint(5); g.paint(5); g.paint(6); g.paint(7); g.endPaint();
    expect(g.cells.slice(5, 8)).toEqual(['empty', 'empty', 'empty']);
  });

  it('an erase swipe leaves cats and empty cells untouched', () => {
    const g = freshGame();
    g.tapToggle(5);
    g.setCat(6);
    // 7 stays empty
    g.beginPaint(5); g.paint(5); g.paint(6); g.paint(7); g.endPaint();
    expect(g.cells[5]).toBe('empty');
    expect(g.cells[6]).toBe('cat');
    expect(g.cells[7]).toBe('empty');
  });

  it('an erase swipe is a single undo step', () => {
    const g = freshGame();
    g.tapToggle(5); g.tapToggle(6);
    g.beginPaint(5); g.paint(5); g.paint(6); g.endPaint();
    expect(g.undo()).toBe(true);
    expect(g.cells[5]).toBe('mark');
    expect(g.cells[6]).toBe('mark');
  });

  it('a swipe starting on an empty cell still adds marks', () => {
    const g = freshGame();
    g.tapToggle(6);
    g.beginPaint(5); g.paint(5); g.paint(6); g.paint(7); g.endPaint();
    expect(g.cells.slice(5, 8)).toEqual(['mark', 'mark', 'mark']);
  });

  it('a swipe starting on a cat adds marks and does not clear the cat', () => {
    const g = freshGame();
    g.setCat(5);
    g.beginPaint(5); g.paint(5); g.paint(6); g.endPaint();
    expect(g.cells[5]).toBe('cat');
    expect(g.cells[6]).toBe('mark');
  });
});

describe('reset board', () => {
  it('clears every mark and cat but keeps the puzzle', () => {
    const g = freshGame();
    const regions = g.puzzle.regions.slice();
    g.tapToggle(0); g.setCat(7); g.tapToggle(12);
    expect(g.resetBoard()).toBe(true);
    expect(g.cells.every((c) => c === 'empty')).toBe(true);
    expect(g.puzzle.regions).toEqual(regions);
  });

  it('is undoable in a single step', () => {
    const g = freshGame();
    g.tapToggle(0); g.setCat(7);
    g.resetBoard();
    expect(g.undo()).toBe(true);
    expect(g.cells[0]).toBe('mark');
    expect(g.cells[7]).toBe('cat');
  });

  it('preserves hintsUsed, so a reset cannot launder a clean solve', () => {
    const g = freshGame();
    g.noteHint();
    g.tapToggle(0);
    g.resetBoard();
    expect(g.hintsUsed).toBe(1);
  });

  it('does nothing on an already-empty board', () => {
    const g = freshGame();
    expect(g.resetBoard()).toBe(false);
    expect(g.undo()).toBe(false);
  });
});

describe('win + mistakes', () => {
  it('placing the full solution wins; a wrong cat is a mistake', () => {
    const g = freshGame();
    g.solution.cols.forEach((c, r) => {
      g.setCat(idx(5, r, c));
    });
    expect(g.isWon()).toBe(true);
    expect(g.mistakes()).toEqual([]);
  });

  it('hint accounting: clean means zero hints', () => {
    const g = freshGame();
    expect(g.hintsUsed).toBe(0);
    g.noteHint();
    expect(g.hintsUsed).toBe(1);
  });
});

describe('save/resume round-trip', () => {
  it('restores cells, undo stack, and hint count', () => {
    const g = freshGame();
    g.tapToggle(0);
    g.noteHint();
    const restored = Game.fromSaved(JSON.parse(JSON.stringify(g.toSaved())));
    expect(restored.cells[0]).toBe('mark');
    expect(restored.hintsUsed).toBe(1);
    expect(restored.undo()).toBe(true);
    expect(restored.cells[0]).toBe('empty');
  });
});

describe('persistence', () => {
  it('settings/stats/game round-trip through storage, tolerate absence', () => {
    const s = fakeStorage();
    const settings: Settings = { size: 8, difficulty: 'fiendish', autoX: false };
    persistence.saveSettings(settings, s);
    expect(persistence.loadSettings(s)).toEqual(settings);
    expect(persistence.loadSettings(fakeStorage())).toEqual({ size: 9, difficulty: 'thinky', autoX: true });

    let stats: Stats = persistence.loadStats(s);
    stats = persistence.recordWin(stats, 5, 'relaxed', true);
    stats = persistence.recordWin(stats, 5, 'relaxed', false);
    stats = persistence.recordWin(stats, 7, 'thinky', true);
    expect(stats.counts['5:relaxed']).toEqual({ solved: 2, clean: 1 });
    expect(stats.streak).toBe(1);       // broken by the unclean solve, rebuilt by the clean one
    expect(stats.bestStreak).toBe(1);
    persistence.saveStats(stats, s);
    expect(persistence.loadStats(s)).toEqual(stats);

    const g = freshGame();
    persistence.saveGame(g.toSaved(), s);
    expect(persistence.loadGame(s)?.puzzle.size).toBe(5);
    persistence.clearGame(s);
    expect(persistence.loadGame(s)).toBeNull();
  });
});
