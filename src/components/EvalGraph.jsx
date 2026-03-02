import { useCallback, useMemo, useRef, useState } from 'react'

const MATE_SCORE = 10000

const PIECE_SYMBOLS = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
}

function normalizeScore(scoreCp) {
  if (scoreCp == null) return 0.5
  if (Math.abs(scoreCp) >= MATE_SCORE - 50) {
    return scoreCp > 0 ? 0.97 : 0.03
  }
  const clamped = Math.max(-600, Math.min(600, scoreCp))
  return 0.5 + (clamped / 1200)
}

function formatEvalShort(scoreCp) {
  if (scoreCp == null) return '0.0'
  if (Math.abs(scoreCp) >= MATE_SCORE - 50) {
    const m = MATE_SCORE - Math.abs(scoreCp)
    return scoreCp > 0 ? `M${Math.max(1, m)}` : `-M${Math.max(1, m)}`
  }
  const p = scoreCp / 100
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}`
}

const CLASSIFICATION_COLORS = {
  Best: '#00d4aa',
  Good: '#4caf82',
  Inaccuracy: '#ffc857',
  Mistake: '#ff8c42',
  Blunder: '#e63946',
}

export function EvalGraph({ analysisByPly, totalMoves, currentPly, onClickPly, moves }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [hoverInfo, setHoverInfo] = useState(null)

  const width = 660
  const height = 90

  const points = useMemo(() => {
    if (!totalMoves || totalMoves === 0) return []
    const pts = []
    for (let i = 0; i < totalMoves; i++) {
      const analysis = analysisByPly[i]
      const scoreCp = analysis?.playedScoreCp ?? 0
      const adjustedScore = i % 2 === 0 ? scoreCp : -scoreCp
      const normalized = normalizeScore(adjustedScore)
      pts.push({
        ply: i + 1,
        x: (i / Math.max(1, totalMoves - 1)) * width,
        yWhite: (1 - normalized) * height,
        scoreCp: adjustedScore,
        classification: analysis?.classification || '',
      })
    }
    return pts
  }, [analysisByPly, totalMoves, width, height])

  const whitePath = useMemo(() => {
    if (points.length === 0) return ''
    const mid = height / 2
    let d = `M 0 ${mid}`
    points.forEach(p => { d += ` L ${p.x} ${p.yWhite}` })
    d += ` L ${points[points.length - 1].x} ${mid} Z`
    return d
  }, [points, height])

  const blackPath = useMemo(() => whitePath, [whitePath])

  const currentX = useMemo(() => {
    if (!totalMoves || currentPly <= 0) return 0
    return ((currentPly - 1) / Math.max(1, totalMoves - 1)) * width
  }, [currentPly, totalMoves, width])

  const getPlyFromMouseX = useCallback((clientX) => {
    if (!containerRef.current || !totalMoves) return null
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = clientX - rect.left
    const ratio = mouseX / rect.width
    const ply = Math.round(ratio * (totalMoves - 1)) + 1
    return Math.max(1, Math.min(totalMoves, ply))
  }, [totalMoves])

  const handleClick = useCallback((e) => {
    const ply = getPlyFromMouseX(e.clientX)
    if (ply && onClickPly) onClickPly(ply)
  }, [getPlyFromMouseX, onClickPly])

  const handleMouseMove = useCallback((e) => {
    const ply = getPlyFromMouseX(e.clientX)
    if (!ply || !moves) { setHoverInfo(null); return }

    const moveIdx = ply - 1
    const move = moves[moveIdx]
    const analysis = analysisByPly[moveIdx]
    if (!move) { setHoverInfo(null); return }

    const rect = containerRef.current.getBoundingClientRect()
    const xPos = e.clientX - rect.left
    const isWhiteMove = moveIdx % 2 === 0
    const moveNum = Math.floor(moveIdx / 2) + 1
    const san = move.san || move
    const piece = move.piece ? PIECE_SYMBOLS[move.piece] || '' : ''
    const scoreCp = analysis?.playedScoreCp ?? 0
    const adjustedScore = moveIdx % 2 === 0 ? scoreCp : -scoreCp

    setHoverInfo({
      xPos,
      ply,
      moveNum,
      isWhiteMove,
      san,
      piece,
      eval: formatEvalShort(adjustedScore),
      classification: analysis?.classification || '',
      svgX: (moveIdx / Math.max(1, totalMoves - 1)) * width,
    })
  }, [getPlyFromMouseX, moves, analysisByPly, totalMoves, width])

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null)
  }, [])

  if (!totalMoves || Object.keys(analysisByPly).length === 0) {
    return (
      <div className="eval-graph-container empty-graph">
        <div className="eval-graph-placeholder">
          Analysis graph will appear here after analysis
        </div>
      </div>
    )
  }

  const classColor = hoverInfo?.classification
    ? CLASSIFICATION_COLORS[hoverInfo.classification] || '#888'
    : '#888'

  return (
    <div
      className="eval-graph-container"
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="eval-graph-svg"
      >
        {}
        <rect x="0" y="0" width={width} height={height / 2} fill="#111119" />
        <rect x="0" y={height / 2} width={width} height={height / 2} fill="#d8d8d0" />

        {}
        <clipPath id="whiteClip">
          <rect x="0" y="0" width={width} height={height / 2} />
        </clipPath>
        <path d={whitePath} fill="#d8d8d0" clipPath="url(#whiteClip)" />

        {}
        <clipPath id="blackClip">
          <rect x="0" y={height / 2} width={width} height={height / 2} />
        </clipPath>
        <path d={blackPath} fill="#111119" clipPath="url(#blackClip)" />

        {}
        {points.length > 1 && (
          <polyline
            points={points.map(p => `${p.x},${p.yWhite}`).join(' ')}
            fill="none"
            stroke="rgba(0,212,170,0.25)"
            strokeWidth="1.2"
          />
        )}

        {}
        {currentPly > 0 && (
          <line
            x1={currentX} y1={0} x2={currentX} y2={height}
            stroke="rgba(0, 212, 170, 0.85)"
            strokeWidth="2"
          />
        )}

        {}
        {hoverInfo && (
          <line
            x1={hoverInfo.svgX} y1={0} x2={hoverInfo.svgX} y2={height}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1"
            strokeDasharray="3,2"
          />
        )}
      </svg>

      {}
      {hoverInfo && (
        <div
          className="eval-graph-tooltip"
          style={{
            left: Math.min(hoverInfo.xPos, containerRef.current?.clientWidth - 140 || 999),
          }}
        >
          <span className="tooltip-move-num">{hoverInfo.moveNum}{hoverInfo.isWhiteMove ? '.' : '...'}</span>
          <span className="tooltip-piece">{hoverInfo.piece}</span>
          <span className="tooltip-san">{hoverInfo.san}</span>
          <span className="tooltip-eval">{hoverInfo.eval}</span>
          {hoverInfo.classification && (
            <span className="tooltip-class" style={{ color: classColor }}>
              {hoverInfo.classification}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
