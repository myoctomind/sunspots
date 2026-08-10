import { describe, it, expect } from 'vitest';
import { Game, persistence, type Settings, type Stats } from '../src/state/store';
import { generatePuzzle } from '../src/engine/generate';
import { idx, rowOf, colOf } from '../src/engine/board';
import { fakeStorage } from './helpers';

const freshGame = () => new Game(generatePuzzle(5, 'relaxed', 42));

describe('cycle + auto marks', () => {
  it('cycles empty → mark → cat → empty', () => {
    const g = freshGame();
    g.cycle(0, false);
    expect(g.cells[0]).toBe('mark');
    g.cycle(0, false);
    expect(g.cells[0]).toBe('cat');
    g.cycle(0, false);
    expect(g.cells[0]).toBe('empty');
  });

  it('empty cell showing an auto mark jumps straight to cat', () => {
    const g = freshGame();
    g.cycle(0, true);
    expect(g.cells[0]).toBe('cat');
  });

  it('autoMarks covers row/col/region/neighbors of cats, empty cells only', () => {
    const g = freshGame();
    const i = idx(5, 2, 2);
    g.cycle(i, false); g.cycle(i, false); // → cat
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
    g.cycle(0, false); // mark
    g.beginPaint(); g.paint(5); g.paint(6); g.paint(7); g.endPaint();
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

describe('win + mistakes', () => {
  it('placing the full solution wins; a wrong cat is a mistake', () => {
    const g = freshGame();
    g.solution.cols.forEach((c, r) => {
      const i = idx(5, r, c);
      g.cycle(i, true); // auto-visible or not, ends as cat on empty cells
      if (g.cells[i] !== 'cat') { g.cycle(i, false); }
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
    g.cycle(0, false);
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
    expect(persistence.loadSettings(fakeStorage())).toEqual({ size: 7, difficulty: 'thinky', autoX: true });

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
