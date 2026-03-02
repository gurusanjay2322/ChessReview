import { useMemo } from 'react'
import { Chessboard } from 'react-chessboard'

const CLASSIFICATION_COLORS = {
  best: 'rgba(0, 212, 170, 0.5)',
  good: 'rgba(76, 175, 130, 0.35)',
  inaccuracy: 'rgba(255, 200, 87, 0.45)',
  mistake: 'rgba(255, 140, 66, 0.5)',
  blunder: 'rgba(230, 57, 70, 0.5)',
}

const BADGE_CONFIGS = {
  best:       { bg: '#00d4aa', icon: '★', textColor: '#000' },
  good:       { bg: '#4caf82', icon: '!',  textColor: '#fff' },
  inaccuracy: { bg: '#ffc857', icon: '?!', textColor: '#000' },
  mistake:    { bg: '#ff8c42', icon: '?',  textColor: '#fff' },
  blunder:    { bg: '#e63946', icon: '??', textColor: '#fff' },
}

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

const BADGE_SVGS = {}
Object.keys(BADGE_CONFIGS).forEach(key => {
  BADGE_SVGS[key] = makeBadgeSvg(key)
})

const LAST_MOVE_COLOR = 'rgba(0, 212, 170, 0.28)'
const SELECTED_COLOR = 'rgba(0, 212, 170, 0.4)'

const LEGAL_MOVE_DOT = {
  background: 'radial-gradient(circle, rgba(0,0,0,0.28) 24%, transparent 25%)',
  borderRadius: '50%',
}

const LEGAL_CAPTURE_RING = {
  background: 'radial-gradient(circle, transparent 55%, rgba(0,0,0,0.28) 56%, rgba(0,0,0,0.28) 70%, transparent 71%)',
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

        if (badgeSvg) {
          styles[lastMove.to].backgroundImage = `url("${badgeSvg}")`
          styles[lastMove.to].backgroundRepeat = 'no-repeat'
          styles[lastMove.to].backgroundPosition = 'top 2px right 2px'
          styles[lastMove.to].backgroundSize = '26px 26px'
        }
      }
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        ...(styles[selectedSquare] || {}),
        backgroundColor: SELECTED_COLOR,
      }
    }

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

  const handlePieceDrop = ({ sourceSquare, targetSquare }) => {
    if (onPieceDrop) return onPieceDrop(sourceSquare, targetSquare)
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
    },
    /* Unique board colors — dark slate blue + warm cream */
    darkSquareStyle: { backgroundColor: '#4a7c72' },
    lightSquareStyle: { backgroundColor: '#e8dcc8' },
    squareStyles,
    dropSquareStyle: { boxShadow: 'inset 0 0 1px 6px rgba(0,212,170,0.5)' },
  }

  return (
    <div className="chessboard-wrapper">
      <Chessboard options={options} />
    </div>
  )
}
