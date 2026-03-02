# Chess Review Lab

Free PGN review MVP inspired by Chess.com game review.

## Implemented

- PGN import by paste or `.pgn` upload
- Interactive board with move navigation
- Parsed game metadata (Event, players, result, date, site)
- Move-by-move classification (`Best`, `Good`, `Inaccuracy`, `Mistake`, `Blunder`)
- Engine pipeline with:
  - Stockfish worker support (if available)
  - Heuristic fallback analysis when Stockfish is not configured

## Run

```bash
npm install
npm run dev
```

## Optional Stockfish Setup

The app tries to load a web worker at:

`public/stockfish/stockfish.js`

If that file is missing, it automatically falls back to heuristic analysis so the app still works.

To use real engine analysis:

1. Add a browser-compatible Stockfish worker script at `public/stockfish/stockfish.js`.
2. Reload and run `Analyze Game`.

## Next Iterations

- Eval graph per ply
- Accuracy score
- Critical position detection
- Lichess/Chess.com fetch integration
- Backend analysis queue for deeper/multi-game review
