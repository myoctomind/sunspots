# Sunspots — swipe-erase, hint warning, reset link, sun-nap egg

*2026-08-12. Approved in brainstorming session.*

Four small, independent changes to the shipped v1 app. Three are quality-of-life
fixes to existing interactions; the fourth is a new easter egg. Nothing here
touches the engine (`src/engine/`) — all work lands in `src/state/store.ts`,
`src/ui/render.ts`, `src/ui/eggs.ts`, `src/ui/app.ts`, `src/ui/style.css`, and
`index.html`.

## Decisions (from brainstorming Q&A)

| Question | Decision |
|---|---|
| What does the reset link do? | Clears marks and cats, keeps the same puzzle |
| Does reset also clear `hintsUsed`? | No — resetting is not a way to launder a clean solve |
| When does the hint warning appear? | First hint of a game, and only when `stats.streak > 0` |
| Can an erase-swipe remove a cat? | No — cats are only removed by tapping |
| When can the easter egg fire? | Only once the current board is solved |
| Shipping shape | Two PRs: the three QOL fixes, then the egg |

## 1. Swipe to erase paw-marks

**Behavior.** The first cell touched sets the mode for the entire swipe:

| First cell's state | Mode | Effect along the swipe |
|---|---|---|
| `mark` (a real paw-mark) | erase | every `mark` passed over becomes `empty` |
| `empty` | add | every `empty` passed over becomes `mark` (today's behavior) |
| `cat` | add | today's behavior — the pet/rub gesture takes priority until the finger leaves the cell |

Cats are never changed by a swipe in either mode. The whole swipe remains a
single undo step.

**Mechanism.** `Game.beginPaint(i: number)` gains the starting cell index and
stores a private `paintMode: 'add' | 'erase'` derived from `this.cells[i]`.
`Game.paint(i)` branches on that mode: `add` skips any non-`empty` cell (as
today); `erase` skips any cell that is not `mark`. `endPaint()` is unchanged.
`BoardView` passes `this.downCell` into `onPaintStart`, so the callback
signature becomes `onPaintStart(i: number)`.

**Known nuance, accepted as-is.** With auto paw-marks on, ruled-out cells render
a ghost paw while their state is still `empty`. Starting a swipe on a ghost
therefore selects *add* mode, not erase — it writes a real mark under the ghost
with no visible change. Making ghosts erasable would mean materializing derived
state, which v1 deliberately avoided; the ghosts clear themselves when the cat
that caused them moves.

## 2. First-hint warning

**Behavior.** Pressing ☀ Hint shows a confirmation dialog when **both**
conditions hold: this is the first hint of the current game
(`game.hintsUsed === 0`) **and** `stats.streak > 0`.

> **Use a hint?**
> This solve won't count as clean — your ☀ streak of **N** goes back to zero.
> *[ Never mind ]  [ Use hint ]*

"Never mind" closes the dialog and spends nothing: no `noteHint()`, no hint
state, no change to the board. "Use hint" proceeds into the existing `onHint()`
path unchanged. Later hints in the same game never prompt — the streak is
already forfeit. At `streak === 0` the dialog never appears, because there is
nothing left to lose.

**Accuracy of the copy.** The streak does not reset at hint time; it resets in
`persistence.recordWin` when the game is won with `clean === false`. The wording
is therefore future-tense ("goes back to zero"), and is truthful even if the
player abandons the board.

**Mechanism.** A new `<dialog id="hint-confirm">` in `index.html`, styled like
the existing settings dialog. `onHint()` gains an early guard that opens the
dialog and returns; the dialog's confirm button re-enters `onHint()` with a
module-level `hintConfirmed` flag set, which the guard clears on each new game.
Native `window.confirm()` is not used — it is visually foreign to the app and
suppressible by some browsers.

## 3. Reset link

**Behavior.** Underlined text reading `reset`, centered below the bottom bar,
styled as a link rather than a fourth button. Activating it returns every cell
to `empty`, keeping the same puzzle, regions, and solution.

- **Undoable in one step.** The clear is pushed to the undo stack as a single
  batch, so one press of ↩︎ Undo restores the board exactly. This is why the
  link needs no confirmation dialog — a misfire costs one tap.
- **`hintsUsed` is preserved.** A reset board that was solved with hints still
  counts as unclean.
- **Hidden once the board is solved.** There is nothing to reset on a finished
  board; 🐈 New is the control for that.
- **Does nothing on an already-empty board** — no empty batch is pushed, so
  Undo is not polluted.

**Mechanism.** `Game.resetBoard(): boolean` builds one `Move[]` covering every
non-`empty` cell and passes it through the existing private `apply()`, returning
`false` if there was nothing to clear. In `index.html` the control is a
`<button id="reset-link">` — a real button for keyboard and screen-reader
correctness — carrying a `.linkish` class that strips the button chrome and adds
the underline. `app.ts` wires it to `resetBoard()` + `afterChange()`, and
`render()` toggles its `hidden` attribute on `game.isWon()`.

## 4. Easter egg — "sun nap"

**Behavior.** Once the current board is solved, tapping the `<h1>Sunspots</h1>`
five times in quick succession (each tap within 600 ms of the previous one)
starts the nap:

1. The title cross-fades from the word "Sunspots" to a large ☀.
2. Every cat on the board becomes a curled-up sleeping cat — body curled into a
   ball, tail wrapped around, eyes a closed curve.
3. For 2 seconds nothing dismisses it.
4. After that, a tap anywhere on the page wakes everything back up: the title
   and the normal cats return.

The egg is only armed on a solved board. The tap streak resets if any gap
exceeds 600 ms, and the counter is cleared when a new game starts.

**Reduced motion.** With `prefers-reduced-motion: reduce`, the cross-fade and
any curl transition are skipped — the swap still happens, instantly. This
matches the existing treatment of the blink, dance, and heart effects.

**Mechanism.**

- `eggs.ts` gains `makeTapStreak(count, windowMs, onFire)`, a pure counter in
  the same shape as the existing `makeRubTracker`: a `tap(now: number)` method,
  time passed in rather than read from the clock so it is unit-testable.
- `render.ts` builds a second, hidden `<g class="cat-curled">` inside every cell
  group at `setPuzzle()` time, alongside the existing upright cat. `BoardView`
  gains `setNapping(on: boolean)`, which toggles a `napping` class on the root
  `<svg>`; CSS swaps which cat shape is visible. No re-render, no DOM churn, and
  the board's state model is untouched — a nap is purely presentational.
- `app.ts` owns the wiring: the title's click handler, the arming check
  (`game?.isWon()`), the 2-second dismissal delay, and the one-shot
  document-level tap listener that ends the nap.

## Testing

The suite is pure-logic only — there is no DOM environment configured in
Vitest, and `tests/render.test.ts` covers only render's pure exports. The design
above pushes each change's real logic into a testable unit accordingly.

**Unit tests:**

- `tests/store.test.ts` — erase mode clears only `mark` cells and leaves `cat`
  and `empty` alone; add mode is unchanged; a mixed swipe is one undo batch;
  `resetBoard()` clears everything, is undoable in one step, preserves
  `hintsUsed`, and returns `false` on an empty board.
- `tests/eggs.test.ts` — `makeTapStreak` fires on the fifth tap inside the
  window, does not fire on four, resets after an over-long gap, and re-arms
  cleanly for a second run.

**Manual verification.** The dialog, the link, the gestures, and the nap
animation are DOM-level and cannot be unit-tested here. All four features are
verified by hand in a real browser against `npm run dev` before either PR is
opened for review.

## Out of scope

- Making auto paw-mark ghosts erasable.
- Any change to puzzle generation, grading, or hint logic.
- A "don't warn me again" preference for the hint dialog — the warning already
  fires at most once per game, and only when a streak is at stake.
- Sound for the nap.
