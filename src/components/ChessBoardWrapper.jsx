import { useMemo } from 'react'
import { Chessboard } from 'react-chessboard'

const CLASSIFICATION_COLORS = {
  best: 'rgba(150, 188, 75, 0.55)',
  good: 'rgba(150, 188, 75, 0.35)',
  inaccuracy: 'rgba(247, 198, 49, 0.5)',
  mistake: 'rgba(230, 138, 42, 0.55)',
  blunder: 'rgba(202, 52, 49, 0.55)',
}

const LAST_MOVE_COLOR = 'rgba(255, 255, 50, 0.42)'
const SELECTED_COLOR = 'rgba(255, 255, 50, 0.55)'

// Creates a radial dot style for empty squares (legal move indicator)
const LEGAL_MOVE_DOT = {
  background: 'radial-gradient(circle, rgba(0,0,0,0.25) 24%, transparent 25%)',
  borderRadius: '50%',
}

// Creates a ring style for occupied squares (capturable piece indicator)
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
  legalMoves = [],       // array of { to, captured } objects
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
        styles[lastMove.to] = {
          backgroundColor: classColor || LAST_MOVE_COLOR,
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
        // Capture ring for squares with opponent pieces
        styles[sq] = { ...(styles[sq] || {}), ...LEGAL_CAPTURE_RING }
      } else {
        // Dot for empty squares
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

  // react-chessboard v5 uses a SINGLE `options` prop
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
