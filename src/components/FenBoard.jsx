const FILE_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const PIECE_IMG = {
  K: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wk.png',
  Q: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wq.png',
  R: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wr.png',
  B: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wb.png',
  N: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wn.png',
  P: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wp.png',
  k: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bk.png',
  q: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bq.png',
  r: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/br.png',
  b: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bb.png',
  n: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bn.png',
  p: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bp.png',
}

function localFallbackSvg(piece) {
  const isWhite = piece === piece.toUpperCase()
  const label = piece.toUpperCase()
  const bg = isWhite ? '#f8fafc' : '#1f2937'
  const fg = isWhite ? '#0f172a' : '#e2e8f0'
  const stroke = isWhite ? '#cbd5e1' : '#334155'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
      <defs>
        <radialGradient id="g" cx="35%" cy="30%">
          <stop offset="0%" stop-color="${isWhite ? '#ffffff' : '#334155'}"/>
          <stop offset="100%" stop-color="${bg}"/>
        </radialGradient>
      </defs>
      <circle cx="75" cy="75" r="62" fill="url(#g)" stroke="${stroke}" stroke-width="8"/>
      <text x="75" y="95" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="70" font-weight="800" fill="${fg}">${label}</text>
    </svg>
  `
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function fenToBoardMatrix(fen) {
  const placement = (fen ?? '').split(' ')[0] ?? ''
  const ranks = placement.split('/')
  if (ranks.length !== 8) {
    return Array.from({ length: 8 }, () => Array(8).fill(null))
  }

  return ranks.map((rank) => {
    const row = []
    for (const token of rank) {
      if (/\d/.test(token)) {
        const emptyCount = Number(token)
        for (let i = 0; i < emptyCount; i += 1) {
          row.push(null)
        }
      } else {
        row.push(token)
      }
    }
    return row.length === 8 ? row : [...row, ...Array(8 - row.length).fill(null)]
  })
}

export function FenBoard({
  fen,
  lastMove = null,
  annotation = '',
  classification = '',
  selectedSquare = '',
  onSquareClick = () => {},
  onPieceDrop = () => {},
}) {
  const matrix = fenToBoardMatrix(fen)
  const cells = []
  const fromSquare = lastMove ? `${lastMove.from}` : ''
  const toSquare = lastMove ? `${lastMove.to}` : ''

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = matrix[rank][file]
      const isDark = (rank + file) % 2 === 1
      const coord = `${FILE_LABELS[file]}${8 - rank}`
      const isFrom = coord === fromSquare
      const isTo = coord === toSquare
      const isSelected = coord === selectedSquare
      cells.push(
        <button
          key={coord}
          type="button"
          className={`fen-square ${isDark ? 'dark' : 'light'} ${isFrom ? 'move-from' : ''} ${isTo ? 'move-to' : ''} ${isSelected ? 'selected' : ''}`}
          aria-label={coord}
          onClick={() => onSquareClick(coord)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const from = event.dataTransfer.getData('text/plain')
            if (from) {
              onPieceDrop(from, coord)
            }
          }}
        >
          {piece ? (
            <img
              className="fen-piece-img"
              src={PIECE_IMG[piece]}
              alt={piece}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', coord)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onError={(event) => {
                event.currentTarget.onerror = null
                event.currentTarget.src = localFallbackSvg(piece)
              }}
            />
          ) : null}
          {isTo && annotation ? (
            <span className={`move-badge ${classification.toLowerCase()}`}>{annotation}</span>
          ) : null}
        </button>
      )
    }
  }

  return (
    <div className="fen-board-shell">
      <div className="fen-board">{cells}</div>
    </div>
  )
}
