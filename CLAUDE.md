# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step — open `index.html` directly or serve it with any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Architecture

Three files, no dependencies, no bundler:

- **`index.html`** — two `<canvas>` elements (`#board` 300×600 px, `#next-canvas` 120×120 px), a side panel for score/lines/level/next-piece preview, and a single overlay div reused for both PAUSE and GAME OVER states.
- **`style.css`** — dark/retro theme; overlay uses `backdrop-filter`.
- **`game.js`** — all game logic (~305 lines, `'use strict'`, no modules).

### Key data structures in `game.js`

- **`board`**: `ROWS × COLS` matrix of integers; `0` = empty, `1–7` = color index matching `COLORS[]`.
- **`current` / `next`**: objects `{ type, shape, x, y }` where `shape` is a 2D matrix of color indices.
- **`PIECES[]`**: piece shapes defined with their color index baked in (e.g. all cells of piece I contain `1`), making `drawBlock` color-lookup trivial.

### Game loop

`requestAnimationFrame`-based loop accumulates elapsed time in `dropAccum`; when it exceeds `dropInterval` the piece falls one row. `animId` holds the RAF handle so it can be cancelled on pause/game-over/restart.

### Coordinate conventions

Canvas pixel coordinates = logical cell coordinates × `BLOCK` (30 px). Ghost piece is drawn at `ghostY()` with `globalAlpha = 0.2` before drawing the real piece on top.

### Tunable constants

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES` are all at the top of `game.js`. If `COLS`, `ROWS`, or `BLOCK` change, the `width`/`height` attributes on `<canvas id="board">` in `index.html` must be updated to match (`COLS × BLOCK` and `ROWS × BLOCK`).
