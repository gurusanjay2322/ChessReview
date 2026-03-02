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

export function classifyMoveByCentipawnLoss(cpLoss) {
  if (cpLoss <= 20) {
    return 'Best'
  }
  if (cpLoss <= 50) {
    return 'Good'
  }
  if (cpLoss <= 100) {
    return 'Inaccuracy'
  }
  if (cpLoss <= 200) {
    return 'Mistake'
  }
  return 'Blunder'
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

  return {
    cpLoss,
    bestMove: bestMove ? toUciMove(bestMove) : '-',
    bestScoreCp,
    playedScoreCp,
    classification: classifyMoveByCentipawnLoss(cpLoss),
    mode: 'Heuristic fallback',
  }
}
