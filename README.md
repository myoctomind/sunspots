# Sunspots ☀️🐈

A cozy, ad-free logic puzzle in the Star Battle family: the board is divided
into colored sun patches, and every patch needs exactly one napping cat — but
no two cats may share a row, share a column, or touch, even diagonally.

**Play:** https://myoctomind.github.io/sunspots/

- Endless puzzles, generated in your browser (5×5 – 9×9, three moods:
  Relaxed / Thinky / Fiendish)
- Every puzzle has a unique solution and is solvable by pure deduction —
  the difficulty rating reflects which reasoning it demands
- Two-stage hints that explain the logic, not just the answer
- No timer, no ads, no account, no network calls; stats stay in your browser

## Development

Requires Node 20+.

    npm install
    npm run dev      # local dev server
    npm test         # engine test suite
    npm run build    # typecheck + production build

The whole game is client-side TypeScript; puzzle generation runs in a Web
Worker. See `docs/superpowers/specs/` for the design spec.
