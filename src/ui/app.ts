import './style.css';
import { type Difficulty } from '../engine/board';
import { type Generated } from '../engine/generate';
import { initState, nextStep, type Step } from '../engine/deduce';
import { Game, persistence, type Settings, type Stats } from '../state/store';
import { GenClient, type WorkerLike } from './genClient';
import { BoardView, regionName } from './render';
import { winCopy, winDrop, makeTapStreak } from './eggs';
import { resolveTheme, type ThemeSetting } from './theme';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const client = new GenClient(() =>
  new Worker(new URL('../worker/gen.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
);

let settings: Settings = persistence.loadSettings();
let stats: Stats = persistence.loadStats();
let game: Game | null = null;
let hint: { stage: 'nudged' | 'revealed'; step: Step | null; mistakes: number[]; revealed: boolean } | null = null;
let winRecorded = false;
let genToken = 0;

/**
 * Sun: Up and Down stamp an explicit choice on <html>; Auto stamps nothing and
 * lets the prefers-color-scheme media query decide, so it flips live with the device.
 */
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function applyTheme(): void {
  const root = document.documentElement;
  if (settings.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', resolveTheme(settings.theme, darkQuery.matches));
  const meta = document.querySelector('meta[name="theme-color"]');
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  if (meta && paper) meta.setAttribute('content', paper);
}

darkQuery.addEventListener('change', applyTheme);
applyTheme();

let lastTap = { i: -1, t: 0 };
function tapCell(i: number): void {
  if (!game || game.isWon()) return;
  const now = Date.now();
  if (lastTap.i === i && now - lastTap.t < 350) {
    game.setCat(i);
    lastTap = { i: -1, t: 0 };
  } else {
    game.tapToggle(i);
    lastTap = { i, t: now };
  }
  afterChange();
}

const board = new BoardView($('board') as unknown as SVGSVGElement, {
  onTap(i) {
    kbFocusVisible = false;
    tapCell(i);
  },
  onPaintStart(i) { kbFocusVisible = false; if (game && !game.isWon()) game.beginPaint(i); },
  onPaintCell(i) { if (game && !game.isWon()) game.paint(i); render(); },
  onPaintEnd() { if (game) { game.endPaint(); afterChange(); } },
  onPet(_i, x, y) {
    if (!game || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let k = 0; k < 3; k++) {
      const h = document.createElement('div');
      h.className = 'heart';
      h.textContent = '💗';
      h.style.left = `${x + (k - 1) * 14 + (Math.random() * 8 - 4)}px`;
      h.style.top = `${y - 12}px`;
      h.style.animationDelay = `${k * 0.09}s`;
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1500);
    }
  },
});

function toast(msg: string): void {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); t.hidden = true; }, 3000);
}

function celebrate(): void {
  const day = new Date().getDay();
  toast(winCopy(game !== null && game.hintsUsed === 0, day));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const n = 8;
  for (let k = 0; k < n; k++) {
    const y = document.createElement('div');
    y.className = 'yarn';
    y.textContent = winDrop(day);
    y.style.left = `${8 + Math.random() * 84}%`;
    y.style.animationDelay = `${Math.random() * 0.8}s`;
    y.style.fontSize = `${1 + Math.random() * 0.8}rem`;
    document.body.appendChild(y);
    setTimeout(() => y.remove(), 4000);
  }
}

/**
 * Sun nap: on a solved board, five fast taps on the title turns it into a sun
 * and curls every cat up to sleep. After two seconds, a tap anywhere wakes them.
 */
const TITLE_TEXT = $('title').textContent ?? 'Sunspots';
let napping = false;
let napTimer = 0;

function startNap(): void {
  napping = true;
  $('title').textContent = '☀︎';
  $('title').classList.add('napping');
  board.setNapping(true);
  napTimer = window.setTimeout(() => document.addEventListener('pointerdown', endNap), 2000);
}

function endNap(): void {
  if (!napping) return;
  napping = false;
  clearTimeout(napTimer);
  document.removeEventListener('pointerdown', endNap);
  $('title').textContent = TITLE_TEXT;
  $('title').classList.remove('napping');
  board.setNapping(false);
  titleTaps.reset();
}

const titleTaps = makeTapStreak(5, 600, () => {
  if (game?.isWon() && !napping) startNap();
});
$('title').addEventListener('click', () => titleTaps.tap(Date.now()));

function fiendishAllowed(size: number): boolean { return size >= 7; }

function requestedDifficulty(): Difficulty {
  return fiendishAllowed(settings.size) || settings.difficulty !== 'fiendish'
    ? settings.difficulty : 'thinky';
}

async function newGame(): Promise<void> {
  endNap();
  const token = ++genToken;
  $('new-btn').setAttribute('disabled', '');
  try {
    const g: Generated = await client.request(settings.size, requestedDifficulty());
    if (token !== genToken) return;
    game = new Game(g);
    winRecorded = false;
    hint = null;
    if (g.grade !== g.requested) toast(`Closest I could brew: ${g.grade}`);
    board.setPuzzle(g.puzzle);
    afterChange();
    client.prefetch(settings.size, requestedDifficulty());
    focusCell = 0;
    kbFocusVisible = false;
  } catch {
    if (token === genToken) toast('Couldn’t brew a puzzle — tap New to retry.');
  } finally {
    if (token === genToken) $('new-btn').removeAttribute('disabled');
  }
}

function afterChange(): void {
  hint = null;
  $('hint-text').hidden = true;
  if (game) {
    if (game.isWon()) {
      if (!winRecorded) {
        winRecorded = true;
        stats = persistence.recordWin(stats, game.puzzle.size, game.grade, game.hintsUsed === 0);
        persistence.saveStats(stats);
        persistence.clearGame();
        celebrate();
        const lastCat = [...game.undoStack].reverse()
          .flatMap((batch) => batch.filter((m) => m.to === 'cat').map((m) => m.i))[0];
        if (lastCat !== undefined) board.dance(lastCat);
      }
    } else {
      persistence.saveGame(game.toSaved());
    }
  }
  render();
}

function render(): void {
  if (!game) return;
  board.update({
    cells: game.cells,
    autoMarks: game.autoMarks(settings.autoX),
    conflicts: game.conflictCells(),
    highlight: hint ? (hint.step ? hint.step.locus.cells : (hint.revealed ? hint.mistakes : [])) : [],
    focus: kbFocusVisible ? focusCell : null,
    won: game.isWon(),
  });
  $('streak').textContent = String(stats.streak);
  ($('undo-btn') as HTMLButtonElement).disabled = game.undoStack.length === 0 || game.isWon();
  $('reset-row').classList.toggle('gone', game.isWon());
}

/**
 * The first hint of a game forfeits the clean solve, and with it the streak.
 * Warn once, and only when there's actually a streak on the line.
 */
function onHint(): void {
  if (!game || game.isWon()) return;
  if (game.hintsUsed === 0 && stats.streak > 0) {
    $('hint-confirm-text').innerHTML =
      `This solve won’t count as clean — your ☀︎ streak of ` +
      `<span class="streak-count">${stats.streak}</span> goes back to zero.`;
    ($('hint-confirm') as HTMLDialogElement).showModal();
    return;
  }
  giveHint();
}

function giveHint(): void {
  if (!game || game.isWon()) return;
  const text = $('hint-text');
  if (!hint || hint.stage === 'revealed') {
    hint = null;
    game.noteHint();
    const mistakes = game.mistakes();
    if (mistakes.length) {
      hint = { stage: 'nudged', step: null, mistakes, revealed: false };
      text.textContent = 'Something’s off — one of your marks isn’t right. Tap Hint again to see it.';
    } else {
      const st = initState(game.puzzle, game.cells, game.autoMarks(settings.autoX));
      const step = nextStep(st, 3, regionName);
      if (!step) { text.textContent = 'No forced move found — try undoing a little.'; hint = null; }
      else {
        hint = { stage: 'nudged', step, mistakes: [], revealed: false };
        const locus = step.locus;
        const where =
          locus.kind === 'region' ? `the ${regionName(locus.index)}`
          : locus.kind === 'row' ? `row ${locus.index + 1}`
          : locus.kind === 'col' ? `column ${locus.index + 1}`
          : 'the glowing cells';
        text.textContent = `Look at ${where}… tap Hint again for the why.`;
      }
    }
    text.hidden = false;
    renderHintHighlight();
  } else {
    if (hint.step) {
      const step = hint.step;
      game.applyHintStep(step);
      afterChange();
      if (!game.isWon()) {
        hint = { stage: 'revealed', step, mistakes: [], revealed: true };
        renderHintHighlight();
      }
      text.textContent = step.text;
      text.hidden = false;
    } else if (hint.mistakes.length) {
      hint = { ...hint, stage: 'revealed', revealed: true };
      text.textContent = 'These marks are wrong — undo or clear them.';
      renderHintHighlight();
    }
  }
}

function renderHintHighlight(): void {
  if (!game) return;
  board.update({
    cells: game.cells,
    autoMarks: game.autoMarks(settings.autoX),
    conflicts: game.conflictCells(),
    highlight: hint ? (hint.step ? hint.step.locus.cells : (hint.revealed ? hint.mistakes : [])) : [],
    focus: kbFocusVisible ? focusCell : null,
    won: game.isWon(),
  });
}

function refreshSettingsUI(): void {
  ($('size-select') as HTMLSelectElement).value = String(settings.size);
  const diff = $('difficulty-select') as HTMLSelectElement;
  (diff.querySelector('option[value="fiendish"]') as HTMLOptionElement).disabled =
    !fiendishAllowed(settings.size);
  diff.value = requestedDifficulty();
  ($('theme-select') as HTMLSelectElement).value = settings.theme;
  ($('autox-toggle') as HTMLInputElement).checked = settings.autoX;
  const rows = Object.entries(stats.counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `<tr><td>${k}</td><td>${v.solved} solved</td><td>${v.clean} clean</td></tr>`)
    .join('');
  $('stats-table').innerHTML = rows
    ? `<table><tr><th>board</th><th></th><th></th></tr>${rows}</table>
       <p>Clean streak: ${stats.streak} · best ${stats.bestStreak}</p>`
    : '<p>No solves yet — the cats are waiting.</p>';
  try { localStorage.setItem('sunspots.probe', '1'); localStorage.removeItem('sunspots.probe'); }
  catch { $('storage-note').hidden = false; }
}

// Wiring
$('undo-btn').addEventListener('click', () => { if (game?.undo()) afterChange(); });
$('hint-btn').addEventListener('click', onHint);
$('new-btn').addEventListener('click', () => void newGame());
$('hint-accept').addEventListener('click', () => {
  ($('hint-confirm') as HTMLDialogElement).close();
  giveHint();
});
$('hint-cancel').addEventListener('click', () => ($('hint-confirm') as HTMLDialogElement).close());
// Undoable in one step, which is why it needs no confirmation of its own.
$('reset-link').addEventListener('click', () => { if (game?.resetBoard()) afterChange(); });
$('settings-btn').addEventListener('click', () => { refreshSettingsUI(); ($('settings') as HTMLDialogElement).showModal(); });
$('stats-chip').addEventListener('click', () => { refreshSettingsUI(); ($('settings') as HTMLDialogElement).showModal(); });
$('settings-close').addEventListener('click', () => ($('settings') as HTMLDialogElement).close());
$('size-select').addEventListener('change', (e) => {
  settings = { ...settings, size: Number((e.target as HTMLSelectElement).value) };
  persistence.saveSettings(settings); refreshSettingsUI(); void newGame();
});
$('difficulty-select').addEventListener('change', (e) => {
  settings = { ...settings, difficulty: (e.target as HTMLSelectElement).value as Difficulty };
  persistence.saveSettings(settings); void newGame();
});
$('theme-select').addEventListener('change', (e) => {
  settings = { ...settings, theme: (e.target as HTMLSelectElement).value as ThemeSetting };
  persistence.saveSettings(settings); applyTheme();
});
$('autox-toggle').addEventListener('change', (e) => {
  settings = { ...settings, autoX: (e.target as HTMLInputElement).checked };
  persistence.saveSettings(settings); render();
});

// Keyboard (desktop nicety)
let focusCell = 0;
let kbFocusVisible = false;
document.addEventListener('keydown', (e) => {
  if (!game || game.isWon()) return;
  if (($('settings') as HTMLDialogElement).open || ($('hint-confirm') as HTMLDialogElement).open) return;
  if (focusCell >= game.puzzle.size * game.puzzle.size) focusCell = 0;
  const size = game.puzzle.size;
  const r = Math.floor(focusCell / size), c = focusCell % size;
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') kbFocusVisible = true;
  if (e.key === 'ArrowUp' && r > 0) focusCell -= size;
  else if (e.key === 'ArrowDown' && r < size - 1) focusCell += size;
  else if (e.key === 'ArrowLeft' && c > 0) focusCell -= 1;
  else if (e.key === 'ArrowRight' && c < size - 1) focusCell += 1;
  else if (e.key === ' ') { e.preventDefault(); tapCell(focusCell); return; }
  else if (e.key.toLowerCase() === 'x') { if (game.cells[focusCell] === 'empty') { game.beginPaint(focusCell); game.paint(focusCell); game.endPaint(); afterChange(); } return; }
  else if (e.key.toLowerCase() === 'u') { if (game.undo()) afterChange(); return; }
  else return;
  hint = null; $('hint-text').hidden = true;
  render();
});

// A napping cat occasionally slow-blinks (opacity fade only, so no reduced-motion gate)
setInterval(() => {
  if (!game || Math.random() < 0.35) return;
  const cats = game.cells.flatMap((s, i) => (s === 'cat' ? [i] : []));
  if (cats.length) board.blink(cats[Math.floor(Math.random() * cats.length)]);
}, 12000);

// Boot: resume or fresh
const saved = persistence.loadGame();
if (saved) {
  try {
    game = Game.fromSaved(saved);
    board.setPuzzle(game.puzzle);
    render();
    client.prefetch(settings.size, requestedDifficulty());
  } catch {
    persistence.clearGame();
    void newGame();
  }
} else {
  void newGame();
}
