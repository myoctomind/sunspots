import './style.css';
import { type Difficulty } from '../engine/board';
import { type Generated } from '../engine/generate';
import { initState, nextStep, type Step } from '../engine/deduce';
import { Game, persistence, type Settings, type Stats } from '../state/store';
import { GenClient, type WorkerLike } from './genClient';
import { BoardView, regionName } from './render';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const client = new GenClient(() =>
  new Worker(new URL('../worker/gen.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
);

let settings: Settings = persistence.loadSettings();
let stats: Stats = persistence.loadStats();
let game: Game | null = null;
let hint: { stage: 'nudged'; step: Step | null; mistakes: number[] } | null = null;
let winRecorded = false;

const board = new BoardView($('board') as unknown as SVGSVGElement, {
  onTap(i) {
    if (!game || game.isWon()) return;
    game.cycle(i, settings.autoX && game.autoMarks(true).has(i));
    afterChange();
  },
  onPaintStart() { if (game && !game.isWon()) game.beginPaint(); },
  onPaintCell(i) { if (game && !game.isWon()) game.paint(i); render(); },
  onPaintEnd() { if (game) { game.endPaint(); afterChange(); } },
});

function toast(msg: string): void {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); t.hidden = true; }, 3000);
}

function fiendishAllowed(size: number): boolean { return size >= 7; }

function requestedDifficulty(): Difficulty {
  return fiendishAllowed(settings.size) || settings.difficulty !== 'fiendish'
    ? settings.difficulty : 'thinky';
}

async function newGame(): Promise<void> {
  $('new-btn').setAttribute('disabled', '');
  try {
    const g: Generated = await client.request(settings.size, requestedDifficulty());
    game = new Game(g);
    winRecorded = false;
    hint = null;
    if (g.grade !== g.requested) toast(`Closest I could brew: ${g.grade}`);
    board.setPuzzle(g.puzzle);
    afterChange();
    client.prefetch(settings.size, requestedDifficulty());
  } catch {
    toast('Couldn’t brew a puzzle — tap New to retry.');
  } finally {
    $('new-btn').removeAttribute('disabled');
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
    highlight: hint ? (hint.step?.locus.cells ?? hint.mistakes) : [],
    won: game.isWon(),
  });
  $('streak').textContent = String(stats.streak);
  ($('undo-btn') as HTMLButtonElement).disabled = game.undoStack.length === 0;
}

function onHint(): void {
  if (!game || game.isWon()) return;
  const text = $('hint-text');
  if (!hint) {
    game.noteHint();
    const mistakes = game.mistakes();
    if (mistakes.length) {
      hint = { stage: 'nudged', step: null, mistakes };
      text.textContent = 'Something’s off — one of your marks isn’t right. Tap Hint again to see it.';
    } else {
      const st = initState(game.puzzle, game.cells, game.autoMarks(settings.autoX));
      const step = nextStep(st, 3, (g) => `the ${regionName(g)}`);
      if (!step) { text.textContent = 'No forced move found — try undoing a little.'; hint = null; }
      else {
        hint = { stage: 'nudged', step, mistakes: [] };
        const locus = step.locus;
        text.textContent =
          locus.kind === 'region' ? `Look at ${regionName(locus.index)}…`
          : locus.kind === 'row' ? `Look at row ${locus.index + 1}…`
          : locus.kind === 'col' ? `Look at column ${locus.index + 1}…`
          : 'Look at the glowing cells…';
      }
    }
    text.hidden = false;
    renderHintHighlight();
  } else {
    if (hint.step) {
      text.textContent = hint.step.text;
      game.applyHintStep(hint.step);
      const keep = hint.step.text;
      afterChange();
      text.textContent = keep;
      text.hidden = false;
    } else if (hint.mistakes.length) {
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
    highlight: hint ? (hint.step?.locus.cells ?? hint.mistakes) : [],
    won: game.isWon(),
  });
}

function refreshSettingsUI(): void {
  ($('size-select') as HTMLSelectElement).value = String(settings.size);
  const diff = $('difficulty-select') as HTMLSelectElement;
  (diff.querySelector('option[value="fiendish"]') as HTMLOptionElement).disabled =
    !fiendishAllowed(settings.size);
  diff.value = requestedDifficulty();
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
$('autox-toggle').addEventListener('change', (e) => {
  settings = { ...settings, autoX: (e.target as HTMLInputElement).checked };
  persistence.saveSettings(settings); render();
});

// Keyboard (desktop nicety)
let focusCell = 0;
document.addEventListener('keydown', (e) => {
  if (!game || ($('settings') as HTMLDialogElement).open) return;
  const size = game.puzzle.size;
  const r = Math.floor(focusCell / size), c = focusCell % size;
  if (e.key === 'ArrowUp' && r > 0) focusCell -= size;
  else if (e.key === 'ArrowDown' && r < size - 1) focusCell += size;
  else if (e.key === 'ArrowLeft' && c > 0) focusCell -= 1;
  else if (e.key === 'ArrowRight' && c < size - 1) focusCell += 1;
  else if (e.key === ' ') { e.preventDefault(); game.cycle(focusCell, settings.autoX && game.autoMarks(true).has(focusCell)); afterChange(); return; }
  else if (e.key.toLowerCase() === 'x') { if (game.cells[focusCell] === 'empty') { game.beginPaint(); game.paint(focusCell); game.endPaint(); afterChange(); } return; }
  else if (e.key.toLowerCase() === 'u') { if (game.undo()) afterChange(); return; }
  else return;
  hint = null; $('hint-text').hidden = true;
  render();
});

// Boot: resume or fresh
const saved = persistence.loadGame();
if (saved) {
  game = Game.fromSaved(saved);
  board.setPuzzle(game.puzzle);
  render();
  client.prefetch(settings.size, requestedDifficulty());
} else {
  void newGame();
}
