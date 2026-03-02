import { useCallback, useMemo, useRef } from 'react'

const MATE_SCORE = 10000

// Clamp and normalize score to 0–1 range (0 = black winning, 1 = white winning)
function normalizeScore(scoreCp) {
  if (scoreCp == null) return 0.5
  if (Math.abs(scoreCp) >= MATE_SCORE - 50) {
    return scoreCp > 0 ? 0.97 : 0.03
  }
  const clamped = Math.max(-600, Math.min(600, scoreCp))
  return 0.5 + (clamped / 1200)
}

export function EvalGraph({ analysisByPly, totalMoves, currentPly, onClickPly }) {
  const svgRef = useRef(null)

  const width = 520
  const height = 64

  // Build data points: one per ply
  const points = useMemo(() => {
    if (!totalMoves || totalMoves === 0) return []
    const pts = []
    for (let i = 0; i < totalMoves; i++) {
      const analysis = analysisByPly[i]
      const scoreCp = analysis?.playedScoreCp ?? 0
      // Flip sign for black moves (odd ply index) to keep perspective consistent
      const adjustedScore = i % 2 === 0 ? scoreCp : -scoreCp
      const normalized = normalizeScore(adjustedScore)
      pts.push({
        ply: i + 1,
        x: (i / Math.max(1, totalMoves - 1)) * width,
        // y=0 is top (white winning), y=height is bottom (black winning)
        yWhite: (1 - normalized) * height,
      })
    }
    return pts
  }, [analysisByPly, totalMoves, width, height])

  // Build the SVG path for the white area (from midline UP)
  const whitePath = useMemo(() => {
    if (points.length === 0) return ''
    const mid = height / 2
    let d = `M 0 ${mid}`
    points.forEach(p => {
      d += ` L ${p.x} ${p.yWhite}`
    })
    d += ` L ${points[points.length - 1].x} ${mid}`
    d += ' Z'
    return d
  }, [points, height])

  // Build the SVG path for the black area (from midline DOWN)
  const blackPath = useMemo(() => {
    if (points.length === 0) return ''
    const mid = height / 2
    let d = `M 0 ${mid}`
    points.forEach(p => {
      d += ` L ${p.x} ${p.yWhite}`
    })
    d += ` L ${points[points.length - 1].x} ${mid}`
    d += ' Z'
    return d
  }, [points, height])

  // Current ply marker position
  const currentX = useMemo(() => {
    if (!totalMoves || currentPly <= 0) return 0
    return ((currentPly - 1) / Math.max(1, totalMoves - 1)) * width
  }, [currentPly, totalMoves, width])

  const handleClick = useCallback((e) => {
    if (!svgRef.current || !totalMoves || !onClickPly) return
    const rect = svgRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const ratio = clickX / rect.width
    const ply = Math.round(ratio * (totalMoves - 1)) + 1
    const clamped = Math.max(1, Math.min(totalMoves, ply))
    onClickPly(clamped)
  }, [totalMoves, onClickPly])

  if (!totalMoves || Object.keys(analysisByPly).length === 0) {
    return (
      <div className="eval-graph-container empty-graph">
        <div className="eval-graph-placeholder">
          Analysis graph will appear here after analysis
        </div>
      </div>
    )
  }

  return (
    <div className="eval-graph-container" onClick={handleClick}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="eval-graph-svg"
      >
        {/* Black half background */}
        <rect x="0" y="0" width={width} height={height / 2} fill="#1a1a1a" />
        {/* White half background */}
        <rect x="0" y={height / 2} width={width} height={height / 2} fill="#e8e8e8" />

        {/* White advantage area — above midline, filled white */}
        <clipPath id="whiteClip">
          <rect x="0" y="0" width={width} height={height / 2} />
        </clipPath>
        <path d={whitePath} fill="#e8e8e8" clipPath="url(#whiteClip)" />

        {/* Black advantage area — below midline, filled black */}
        <clipPath id="blackClip">
          <rect x="0" y={height / 2} width={width} height={height / 2} />
        </clipPath>
        <path d={blackPath} fill="#1a1a1a" clipPath="url(#blackClip)" />

        {/* Eval line */}
        {points.length > 1 && (
          <polyline
            points={points.map(p => `${p.x},${p.yWhite}`).join(' ')}
            fill="none"
            stroke="rgba(128,128,128,0.4)"
            strokeWidth="1"
          />
        )}

        {/* Current position marker */}
        {currentPly > 0 && (
          <line
            x1={currentX}
            y1={0}
            x2={currentX}
            y2={height}
            stroke="rgba(129, 182, 76, 0.9)"
            strokeWidth="2"
          />
        )}
      </svg>
    </div>
  )
}
