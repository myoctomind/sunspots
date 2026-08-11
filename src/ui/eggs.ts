/** Quiet easter eggs: pure helpers kept out of app.ts so they can be unit-tested. */

export function winCopy(clean: boolean, day: number): string {
  if (day === 6) return clean ? 'Happy Caturday — a clean solve ☀︎' : 'Happy Caturday! Every cat in its sunspot ☀︎';
  return clean ? 'Clean solve — every cat in its sunspot ☀︎' : 'Every cat in its sunspot ☀︎';
}

export function winDrop(day: number): string {
  return day === 6 ? '🐟' : '🧶';
}

/** Detects a back-and-forth rub: fires on every third horizontal direction reversal. */
export function makeRubTracker(onRub: () => void): { start(x: number): void; move(x: number): void; stop(): void } {
  let lastX = 0, dir = 0, flips = 0, active = false;
  return {
    start(x) { active = true; lastX = x; dir = 0; flips = 0; },
    move(x) {
      if (!active) return;
      const dx = x - lastX;
      if (Math.abs(dx) < 3) return;
      const d = dx > 0 ? 1 : -1;
      if (dir !== 0 && d !== dir) {
        flips++;
        if (flips >= 3) { flips = 0; onRub(); }
      }
      dir = d;
      lastX = x;
    },
    stop() { active = false; },
  };
}
