# Sunspots — design spec

*2026-08-03. Approved in brainstorming session.*

## Vision

A cozy, browser-based, ad-free logic puzzle where every sun patch needs exactly one napping cat. No timers, no accounts, no cruft. Deduction over guessing — every correct placement is explainable. Plays beautifully on a phone from the home screen, works just as well at a desk.

## Rules of the game

- N×N board divided into N contiguous colored regions ("sun patches").
- Place exactly one cat per region.
- No two cats in the same row, no two in the same column, and no two touching — including diagonally.
- Every puzzle has exactly one solution and is solvable by pure deduction at its advertised difficulty.

## Decisions (from brainstorming Q&A)

| Question | Decision |
|---|---|
| Core concept | Star Battle (1★) mechanic, cozy cat theme |
| Play model | Endless on demand; no daily mode in v1 |
| Platform | Phone + desktop, touch-first responsive |
| Hosting | GitHub Pages, public repo under `myoctomind`, fully static |
| Features | Undo, manual paw-marks, size/difficulty picker, auto-X assist (toggle, default on), conflict highlighting, two-stage deduction hints, quiet stats |
| Aesthetic | Cozy pastel |
| Engine approach | One live in-browser engine (Web Worker) generates, grades, and hints |
| Name | **Sunspots** |

## Scope

**v1:** everything in this spec.
**Out of scope for v1:** accounts, sharing, daily puzzle, sound, service worker/offline, browser-automation UI tests. (Offline support is a natural later add.)

## Sizes & difficulties

- Sizes: 5×5 through 9×9.
- Difficulties: **Relaxed / Thinky / Fiendish.**
- Availability: 5×5 and 6×6 offer Relaxed + Thinky only; 7×7 and up offer all three.

## Architecture

Pure-TypeScript engine, thin vanilla-TS UI, one worker boundary. No framework, no runtime dependencies, zero external requests at runtime.

```
src/
  engine/
    board.ts     — grid + region model, candidate/mark state, move application, serialization
    exact.ts     — bitmask row-by-row backtracking solver; counts solutions up to 2 (uniqueness)
    deduce.ts    — human-style solver: tiered technique catalog, emits explained steps
    generate.ts  — arrangement-first generator + difficulty grading
  worker/
    gen.worker.ts — generation off the main thread; pre-generates the next puzzle during play
  state/
    store.ts     — game state, undo stack, localStorage persistence
  ui/
    board SVG renderer, controls, settings, stats, toasts — vanilla TS
```

Engine modules never import UI or state. `deduce.ts` is the heart: generation grading and hints are both "run it and read the steps."

## Generation & grading

1. **Arrangement first:** sample a valid cat arrangement directly (row-by-row backtracking with column/adjacency pruning — milliseconds at 9×9).
2. **Grow regions** around those cats by weighted random flood-fill until the board is partitioned into N contiguous regions, one cat each → at least one solution by construction.
3. **Uniqueness:** `exact.ts` counts solutions; discard if more than one.
4. **Grade** with `deduce.ts` (tiers below). Grade = highest tier required on the forced solving path.
5. **Accept** if grade matches the request; otherwise re-roll. After **3 s** without a hit, return the nearest achievable grade and surface a quiet toast ("closest I could brew: Thinky").

Worker API: `{size, difficulty, seed?} → {puzzle, solution, grade}`. The next puzzle is pre-generated in idle time so "new puzzle" feels instant.

### Technique tiers

- **Tier 1 (Relaxed):** a region or a row/column has exactly one remaining legal cell → place the cat; a placed cat eliminates its row, column, region, and all 8 neighbors.
- **Tier 2 (Thinky):** confinement — all of a region's candidates lie in one row/column → eliminate that line's other cells; all of a line's candidates lie in one region → eliminate that region's cells off the line; neighbor-forcing — a cell adjacent to *every* remaining candidate of some other region can't hold a cat.
- **Tier 3 (Fiendish):** counting/set arguments — k regions confined to k rows/columns claim those lines exclusively; shallow contradiction probes — hypothetically place a candidate, apply tiers 1–2, and eliminate it if that dead-ends (depth 1 only; hints narrate it honestly as "test this cell — it leads to a dead end").

## Mistakes: two distinct systems

- **Conflict highlighting** (rule violations visible on the board — two cats in a row/column/region or touching): immediate soft rose tint + small ear-flick wiggle on the offending cats. Automatic; does not affect "clean" status.
- **Wrong-but-consistent placements** (a cat on a non-solution cell, or a paw-mark covering the solution cell) are *not* flagged automatically — they surface through hints.

## Hints (two-stage)

Powered by `deduce.ts` from the current position.

- **Nudge** (first tap): spotlight the locus of the next forced step — "look at the peach patch" — nothing placed.
- **Reveal** (second tap): apply the step and explain it in plain words ("Every other cell in the peach patch touches the cat in row 2 — the cat goes here").
- **Mistake flow:** if the position contains a wrong cat or a paw-mark on the solution cell, the nudge says "something's off" and the reveal highlights the wrong mark instead. A hint never strands you mid-mistake.
- A solve with **zero hints** (nudge or reveal) counts as **clean**.

## Interaction

- **Tap cycles** a cell: empty → paw-mark → cat → empty. **Drag paints paw-marks.** Unlimited undo; each user action (including an auto-X cascade) is one undo entry.
- **Auto-X assist** (default on, toggle in settings): placing a cat softly fades paw-marks into its row/column/region/neighbors; undo removes exactly that cascade.
- **Keyboard** (desktop): arrows move focus, Space cycles, X marks.
- **Win:** cats stretch and purr, a few yarn balls drift down, stats tick up. Quiet — no fanfare screen.

## Layout & visual design

- Phone-first: board centered and large (fits `min(100vw, ~60vh)`); bottom bar in thumb reach holds undo / hint / new puzzle; top bar holds title, quiet stats, settings (size, difficulty, auto-X).
- **Cozy pastel:** warm cream paper background; regions in muted pastels separated by **bold rounded ink borders — color is never the only signal** (colorblind-safe by construction). Cats: hand-drawn-feel charcoal SVG silhouettes. Paw-marks: small pad prints. System rounded font stack.
- Tap targets ≥ 44 px at all sizes. `prefers-reduced-motion` disables wiggle, purr-stretch, and yarn balls.
- Add-to-home-screen: viewport meta, `manifest.json`, icons — opens full-screen like an app (no service worker in v1).

## Persistence (localStorage, best-effort)

- `sunspots.settings` — size, difficulty, autoX
- `sunspots.stats` — per `size:difficulty`: solved and clean counts; global current + best clean-solve streaks
- `sunspots.game` — current puzzle, board state, undo stack → closing the tab mid-solve resumes exactly
- Storage unavailable → game plays normally, stats/resume silently session-only (one quiet note in settings).

## Error handling (complete surface — static client-side app)

- Generation timeout → nearest grade + quiet toast (per above).
- Worker crash → respawn and retry once → then a "couldn't brew a puzzle, tap to retry" state.
- localStorage blocked → session-only, as above.

## Testing (Vitest, engine-focused)

- `exact.ts` against hand-built boards with known unique / zero / multiple solutions.
- **Property tests over the generator** (the load-bearing ones): across sampled sizes × difficulties, every generated puzzle has exactly one solution; `deduce.ts` completes it using only techniques of the advertised tier; every emitted step is legal (never contradicts the true solution).
- Undo round-trips; save/resume serialization round-trips.
- UI: manual phone + desktop pass for v1.

## Repo, build, deploy

- Local: `~/src/claude_workspace/sunspots/`, its own git repo.
- Remote: public `github.com/myoctomind/sunspots`.
- Stack: TypeScript + Vite (base path `/sunspots/`), Vitest. Node 20+ (verify locally before implementation).
- CI: GitHub Actions on push to `main` — install, test, build, deploy to Pages → `https://myoctomind.github.io/sunspots/`.

## Success criteria (v1 done means)

1. Open the Pages URL on the phone, add to home screen, launches full-screen.
2. Generate and solve puzzles at every allowed size × difficulty; all listed features behave as specced.
3. Engine property tests green in CI; a fresh Fiendish 9×9 arrives in under ~3 s (or gracefully degrades per the timeout rule).

## Effort estimate

Two focused sessions: (1) engine + board UI to playable; (2) hints, stats, pastel polish, CI + Pages deploy.
