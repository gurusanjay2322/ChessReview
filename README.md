# Chess Review Lab

I built this because I really liked the game analysis features on Chess.com, but paying for a premium subscription just to get told I blundered my queen gets expensive fast.

I looked around for free alternatives. Most of them were either clunky, packed with flashing ads, or just hard to use.

So, I decided to build my own. It is free, has no ads, runs fast, and has a clean dark theme. Welcome to the Chess Review Lab.

## What is this?

This is a completely free, open-source chess analysis lab that runs directly in your browser. It uses WebAssembly to run Stockfish locally without needing any backend server to crunch the numbers. Your games stay on your machine, and you get instant evaluations.

I also added a custom explanation feature. Instead of just giving you a cold "+2.5" evaluation number, the lab looks at the board and tries to tell you what happened in plain English — like if a piece was left hanging, or if a defender was moved away.

## Features

- **No Paywalls, No Ads:** Chess analysis should just be free.
- **Stockfish (in the browser):** Powered by a local Stockfish WebAssembly build for fast, private analysis.
- **Move Explanations:** Contextual text that tells you what went wrong based on the actual position.
- **Click to Preview:** Click the "Best Move" suggestion to instantly see it played out on the board without messing up your actual game state.
- **Import Games:** Fetch your recent games from both Chess.com and Lichess in one click.
- **Custom Theme:** Deep navy and teal colors instead of the usual plain designs.
- **Accuracy Scores:** Get a clean accuracy percentage out of 100 for your games right next to the usernames.

## How to run it locally

If you want to run this on your own machine, clone the repo and follow these steps. It is built with Vite and React.

1. **Clone the repo:**
   ```bash
   git clone https://github.com/yourusername/chess-review-lab.git
   cd chess-review-lab
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the dev server:**
   ```bash
   npm run dev
   ```

4. **Build it for production:**
   ```bash
   npm run build
   ```

## Tech Stack

- React (via Vite)
- chess.js (for chess logic and move validation)
- react-chessboard (for the board UI)
- Stockfish.wasm (for engine analysis)
- Vanilla CSS (for styling)

## Credits

Built by GS. You can check out my portfolio at [iamgs.vercel.app](https://iamgs.vercel.app).
If you like the project and want to support it, you can [buy me a coffee](https://buymeacoffee.com/rkgs).
