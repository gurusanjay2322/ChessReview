import { useMemo } from 'react'

const MATE_SCORE = 10000

function formatEval(scoreCp) {
  if (scoreCp == null) return '0.0'
  if (Math.abs(scoreCp) >= MATE_SCORE - 50) {
    const mateIn = MATE_SCORE - Math.abs(scoreCp)
    return scoreCp > 0 ? `M${Math.max(1, mateIn)}` : `-M${Math.max(1, mateIn)}`
  }
  const pawns = scoreCp / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`
}

export function EvalBar({ scoreCp = 0, flipped = false }) {
  const whitePercent = useMemo(() => {
    if (scoreCp == null) return 50
    if (Math.abs(scoreCp) >= MATE_SCORE - 50) {
      return scoreCp > 0 ? 98 : 2
    }
    const clamped = Math.max(-800, Math.min(800, scoreCp))
    return 50 + (clamped / 800) * 45
  }, [scoreCp])

  const displayPercent = flipped ? 100 - whitePercent : whitePercent
  const evalText = formatEval(scoreCp)
  const isWhiteAdvantage = scoreCp >= 0

  return (
    <div className="eval-bar-container">
      <div className="eval-bar">
        <div
          className="eval-bar-white"
          style={{ height: `${displayPercent}%` }}
        />
        <div
          className="eval-bar-black"
          style={{ height: `${100 - displayPercent}%` }}
        />
      </div>
      <div className={`eval-score ${isWhiteAdvantage ? 'white-advantage' : 'black-advantage'}`}>
        {evalText}
      </div>
    </div>
  )
}
