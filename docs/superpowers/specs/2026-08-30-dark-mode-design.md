# Sunspots — dark mode

*2026-08-30. Approved in brainstorming session, from a visual mockup.*

A second theme, chosen from a new **Sun** row in Settings. No engine changes.

## Decisions (from brainstorming Q&A)

| Question | Decision |
|---|---|
| Where does the control live? | ⚙︎ Settings, labelled **Sun**, under Mood |
| How is the theme chosen? | `Auto` follows the device; `Up` forces light; `Down` forces dark |
| What happens to the nine patches? | Same nine hues, deepened and desaturated — dusk, not grey |
| Cats and borders at night | Light ink, deliberately grey rather than white |
| Border weight at night | Thinner (5px vs 7px) — light-on-dark strokes bloom |
| Cat faces | Sleepy eyes + nose, **dark mode only** |

## The control

`Settings.theme: 'auto' | 'up' | 'down'`, default `auto`. Settings saved before this
existed load with `theme: 'auto'` — the persistence layer merges defaults into whatever
it reads, so nobody loses their board size or mood. Covered by a test.

`resolveTheme(setting, prefersDark)` in `src/ui/theme.ts` is the whole decision, kept
pure so it is unit-tested rather than clicked at. Anything unrecognised in storage falls
back to the device preference.

## How the theme is applied

`Up` and `Down` stamp `data-theme` on `<html>`; `Auto` stamps nothing and lets
`prefers-color-scheme` decide, so it flips live when the device does. The stylesheet
defines the light palette on bare `:root`, then redefines **only the tokens** twice:
under `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`,
and again under `:root[data-theme="dark"]`. No component rule lives inside a media or
`[data-theme]` block — a color defined only there would never apply in the un-stamped
state, which is the classic half-themed-page bug.

The `theme-color` meta is rewritten from the resolved `--paper` so the phone status bar
matches instead of staying cream.

## Patch colors move from TypeScript into CSS

The nine fills were hex literals in `render.ts`, painted onto each square as it was drawn
— which would have meant re-rendering the whole board to change theme. They are now
`--p0`…`--p8` tokens, and each square carries a `patch pN` class. A theme change is a
repaint; the board is never rebuilt and game state is not involved.

`PALETTE` is deleted from `render.ts` rather than left as a duplicate list that could
drift from the CSS. A test reads `style.css` and asserts every `--pN` is defined in all
three theme blocks; it was verified to fail when one is removed. Vitest stubs CSS imports
to an empty string by default, so `test: { css: true }` is set in `vite.config.ts`.

## Cat faces

Two closed eye-curves and a small nose, drawn in `--cat-detail`, inside the cat group.

- **Dark mode only**, via a `--face-vis` token rather than duplicated selectors. At dusk
  a bare silhouette loses definition; in daylight the plain silhouette is the look.
- **Sleepy, not open-eyed.** The peek egg already fades *wide-open* eyes in on a blink;
  always-on open eyes would make that egg meaningless. The face hides during a blink, so
  the egg still reads as a cat opening its eyes.
- Hidden during the sun-nap egg, which swaps in its own curled cat.

**Trap worth recording:** `visibility: visible` on a child overrides a hidden parent, so
the face rule must be scoped to `.has-cat`. Scoped only to `.cell`, every paw-mark grew a
face — caught in the browser, not by any test.

## Testing

- `tests/theme.test.ts` — `resolveTheme` across all three settings and both device
  preferences, plus the corrupt-storage fallback.
- `tests/store.test.ts` — `theme` round-trips through storage; pre-dark-mode settings load
  as `auto`.
- `tests/render.test.ts` — every patch fill defined in all three theme blocks.
- **Manual, in Chrome:** both themes end to end — token resolution, patch fills, faces on
  cats and nowhere else, light mode unchanged, `Auto` tracking the device, the settings
  row, the reset link, and the sun-nap egg at night.

## Out of scope

- `manifest.webmanifest` splash colors — static per install, can't follow a runtime toggle.
- Changing the light theme's border weight.
- A face in light mode.
