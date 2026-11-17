# Four in a Row

A browser-based Connect Four game with a responsive interface, three AI difficulty levels, and local two-player mode. The game is built with plain HTML, CSS, and JavaScript; it has no build step or external runtime dependencies.

## Run locally

Open `index.html` in a modern browser. Alternatively, serve the project directory over HTTP:

```powershell
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## How to play

- Choose a column using the arrow above it to drop a disc.
- Connect four discs horizontally, vertically, or diagonally to win.
- Use **New game** to restart or **Undo move** to take back a move. In AI mode, undo removes the last AI move and your preceding move when available.
- Choose **You first vs AI**, **AI first vs AI** (the AI takes the first turn and you play second), or **2 players local** from the game mode menu.
- Choose Easy, Medium, or Hard to set the AI search depth to 2, 4, or 6, respectively.

The selected game mode and difficulty are saved in browser local storage.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Game page, board layout, styles, and help content |
| `game.js` | Board state, rules, move handling, win/draw detection, and AI |
| `presentation.js` | Presentation-only status updates, player indicators, board hover feedback, and win confetti |
| `gamekit.js` | Shared helpers, including difficulty controls and local-storage utilities |
| `manpage.js` | How-to-play dialog behavior |
| `shared.css` | Shared base styles and UI components |
| `manpage.css` | How-to-play dialog styles |

## Compatibility

Use a modern browser with support for JavaScript, CSS Grid, and standard DOM APIs. No package installation or compilation is required.
