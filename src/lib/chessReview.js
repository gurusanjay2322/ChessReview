import { Chess } from 'chess.js'

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

function evaluateMaterialFromWhitePerspective(chess) {
  return chess
    .board()
    .flat()
    .filter(Boolean)
    .reduce((score, piece) => {
      const value = PIECE_VALUES[piece.type] ?? 0
      return score + (piece.color === 'w' ? value : -value)
    }, 0)
}

function evaluateForSideToMove(chess) {
  const whiteScore = evaluateMaterialFromWhitePerspective(chess)
  return chess.turn() === 'w' ? whiteScore : -whiteScore
}

function evaluateMove(fen, move) {
  const chess = new Chess(fen)
  chess.move(move)
  return -evaluateForSideToMove(chess)
}

function pickBestMoveByMaterial(fen) {
  const chess = new Chess(fen)
  const legalMoves = chess.moves({ verbose: true })
  let bestScore = Number.NEGATIVE_INFINITY
  let bestMove = null

  legalMoves.forEach((move) => {
    const score = evaluateMove(fen, move)
    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  })

  return { bestMove, bestScoreCp: bestScore }
}

export function toUciMove(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

export function winProbability(cp) {
  // Prevent overflow math explosions for Mates or huge CP
  if (cp > 4000) return 100;
  if (cp < -4000) return 0;

  // Standard Sigmoid WP curve (closer to chess.com / lichess)
  const wp = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  return wp;
}

export function classifyMoveByAccuracy(bestScoreCp, playedScoreCp, isMatePlayed, isEngineBest, maxDepthReached) {
  if (isMatePlayed) return 'Best';
  if (isEngineBest && maxDepthReached) return 'Best';

  // If both scores are mate scores, we can treat the WP as basically unchanged, unless it blundered mate
  let bestWp = 0;
  let playedWp = 0;

  if (Math.abs(bestScoreCp) >= 9000) {
    bestWp = bestScoreCp > 0 ? 100 : 0;
  } else {
    bestWp = winProbability(bestScoreCp);
  }

  if (Math.abs(playedScoreCp) >= 9000) {
    playedWp = playedScoreCp > 0 ? 100 : 0;
  } else {
    playedWp = winProbability(playedScoreCp);
  }

  // WpLoss is measured as how much expectation the player threw away.
  const wpLoss = Math.max(0, bestWp - playedWp);

  // Fallback to centipawn loss primarily for Brilliant/Great tagging
  const cpLoss = Math.max(0, bestScoreCp - playedScoreCp);

  // Very strict classifications for brilliant / great based on WP + CP
  if (cpLoss <= 5 && isEngineBest) { // Only candidate for Brilliant/Great is the engine best move or top 2
    // For a real chess engine we'd check if the move was a sacrifice, etc. 
    // For now, if they find a hard best move in a complex position: -> 'Best'
    // We will let 'Best' stand in for Brilliant unless we add real sacrifice detection
  }

  if (wpLoss <= 2.0) return 'Best';
  if (wpLoss <= 5.0) return 'Good';
  if (wpLoss <= 10.0) return 'Inaccuracy';
  if (wpLoss <= 20.0) return 'Mistake';

  // If we dropped huge WP but it wasn't quite a full blunder
  if (wpLoss <= 30.0) return 'Miss';

  return 'Blunder';
}

export function formatScore(scoreCp) {
  if (Math.abs(scoreCp) >= 9000) {
    return scoreCp > 0 ? '+M' : '-M'
  }
  const pawnUnits = scoreCp / 100
  return `${pawnUnits > 0 ? '+' : ''}${pawnUnits.toFixed(2)}`
}

export function analyzeMoveHeuristic(positionFen, playedMove) {
  const { bestMove, bestScoreCp } = pickBestMoveByMaterial(positionFen)
  const playedScoreCp = evaluateMove(positionFen, playedMove)
  const cpLoss = Math.max(0, bestScoreCp - playedScoreCp)

  const isMatePlayed = Math.abs(playedScoreCp) >= 9000 && playedScoreCp > 0;
  const isEngineBest = bestMove === playedMove || bestMove?.to === playedMove?.to; // rough heuristic fallback match

  return {
    cpLoss,
    bestMove: bestMove ? toUciMove(bestMove) : '-',
    bestScoreCp,
    playedScoreCp,
    classification: classifyMoveByAccuracy(bestScoreCp, playedScoreCp, isMatePlayed, isEngineBest, false),
    mode: 'Heuristic fallback',
  }
}

