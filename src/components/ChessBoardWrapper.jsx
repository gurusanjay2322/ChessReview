import { useMemo } from 'react'
import { Chessboard } from 'react-chessboard'

const CLASSIFICATION_COLORS = {
  best: 'rgba(150, 188, 75, 0.55)',
  good: 'rgba(150, 188, 75, 0.35)',
  inaccuracy: 'rgba(247, 198, 49, 0.5)',
  mistake: 'rgba(230, 138, 42, 0.55)',
  blunder: 'rgba(202, 52, 49, 0.55)',
}

const BADGE_CONFIGS = {
  best:       { bg: '#96bc4b', icon: '★', textColor: '#fff' },
  good:       { bg: '#96bc4b', icon: '!',  textColor: '#fff' },
  inaccuracy: { bg: '#f7c631', icon: '?!', textColor: '#000' },
  mistake:    { bg: '#e68a2a', icon: '?',  textColor: '#fff' },
  blunder:    { bg: '#ca3431', icon: '??', textColor: '#fff' },
}

// Generate an SVG data URL for a classification badge
function makeBadgeSvg(classKey) {
  const config = BADGE_CONFIGS[classKey]
  if (!config) return null
  const size = 26
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${config.bg}"/>
    <text x="${size/2}" y="${size/2 + 1}" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-size="${config.icon.length > 1 ? 10 : 14}" font-weight="bold" fill="${config.textColor}">${config.icon}</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Pre-generate all badge SVGs
const BADGE_SVGS = {}
Object.keys(BADGE_CONFIGS).forEach(key => {
  BADGE_SVGS[key] = makeBadgeSvg(key)
})

const LAST_MOVE_COLOR = 'rgba(255, 255, 50, 0.42)'
const SELECTED_COLOR = 'rgba(255, 255, 50, 0.55)'

// Legal move dot for empty squares
const LEGAL_MOVE_DOT = {
  background: 'radial-gradient(circle, rgba(0,0,0,0.25) 24%, transparent 25%)',
  borderRadius: '50%',
}

// Capture ring for occupied squares
const LEGAL_CAPTURE_RING = {
  background: 'radial-gradient(circle, transparent 55%, rgba(0,0,0,0.25) 56%, rgba(0,0,0,0.25) 70%, transparent 71%)',
}

export function ChessBoardWrapper({
  position,
  onPieceDrop,
  onSquareClick,
  onPieceClick,
  onPieceDrag,
  boardOrientation = 'white',
  lastMove = null,
  classification = '',
  selectedSquare = '',
  legalMoves = [],
}) {
  const squareStyles = useMemo(() => {
    const styles = {}

    // Last move highlights
    if (lastMove) {
      if (lastMove.from) {
        styles[lastMove.from] = { backgroundColor: LAST_MOVE_COLOR }
      }
      if (lastMove.to) {
        const classKey = classification?.toLowerCase() || ''
        const classColor = CLASSIFICATION_COLORS[classKey]
        const badgeSvg = BADGE_SVGS[classKey]

        styles[lastMove.to] = {
          backgroundColor: classColor || LAST_MOVE_COLOR,
          position: 'relative',
        }

        // Add classification badge as background image positioned at top-right
        if (badgeSvg) {
          styles[lastMove.to].backgroundImage = `url("${badgeSvg}")`
          styles[lastMove.to].backgroundRepeat = 'no-repeat'
          styles[lastMove.to].backgroundPosition = 'top 2px right 2px'
          styles[lastMove.to].backgroundSize = '26px 26px'
        }
      }
    }

    // Selected square highlight
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...(styles[selectedSquare] || {}),
        backgroundColor: SELECTED_COLOR,
      }
    }

    // Legal move indicators
    legalMoves.forEach((move) => {
      const sq = move.to
      if (move.captured) {
        styles[sq] = { ...(styles[sq] || {}), ...LEGAL_CAPTURE_RING }
      } else {
        styles[sq] = { ...(styles[sq] || {}), ...LEGAL_MOVE_DOT }
      }
    })

    return styles
  }, [lastMove, classification, selectedSquare, legalMoves])

  // react-chessboard v5 onPieceDrop receives { piece, sourceSquare, targetSquare }
  const handlePieceDrop = ({ sourceSquare, targetSquare }) => {
    if (onPieceDrop) {
      return onPieceDrop(sourceSquare, targetSquare)
    }
    return false
  }

  const handleSquareClick = ({ square }) => {
    if (onSquareClick) onSquareClick(square)
  }

  const handlePieceClick = ({ square }) => {
    if (onPieceClick) onPieceClick(square)
  }

  const handlePieceDrag = ({ square }) => {
    if (onPieceDrag) onPieceDrag(square)
  }

  const options = {
    id: 'analysis-board',
    position,
    onPieceDrop: handlePieceDrop,
    onSquareClick: handleSquareClick,
    onPieceClick: handlePieceClick,
    onPieceDrag: handlePieceDrag,
    boardOrientation,
    animationDurationInMs: 200,
    boardStyle: {
      borderRadius: '4px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    },
    darkSquareStyle: { backgroundColor: '#779952' },
    lightSquareStyle: { backgroundColor: '#ebecd0' },
    squareStyles,
    dropSquareStyle: { boxShadow: 'inset 0 0 1px 6px rgba(255,255,255,0.5)' },
  }

  return (
    <div className="chessboard-wrapper">
      <Chessboard options={options} />
    </div>
  )
}
