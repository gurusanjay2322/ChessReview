import React, { useMemo } from 'react'
import { classifyPhases } from '../lib/phaseDetection'
import { formatScore } from '../lib/chessReview'

function getAnnotationForClassification(classification) {
  const map = {
    Brilliant: '!!',
    Great: '!',
    Best: '★',
    Good: '✓',
    Inaccuracy: '?!',
    Mistake: '?',
    Miss: 'x',
    Blunder: '??',
  }
  return map[classification] || ''
}

export function GamePhaseAnalysis({ game, analysisByPly, onClickPly }) {
  const phases = useMemo(() => {
    if (!game || !game.fens) return []
    return classifyPhases(game.fens)
  }, [game])

  const phaseStats = useMemo(() => {
    if (!game || !analysisByPly || phases.length === 0) return null

    const stats = {
      Opening: { 
        startPly: null, endPly: null, 
        wTotal: 0, bTotal: 0, wScore: 0, bScore: 0,
        moves: [], wAcc: null, bAcc: null,
        counts: { Brilliant: 0, Great: 0, Best: 0, Good: 0, Inaccuracy: 0, Mistake: 0, Miss: 0, Blunder: 0 }
      },
      Middlegame: { 
        startPly: null, endPly: null, 
        wTotal: 0, bTotal: 0, wScore: 0, bScore: 0,
        moves: [], wAcc: null, bAcc: null,
        counts: { Brilliant: 0, Great: 0, Best: 0, Good: 0, Inaccuracy: 0, Mistake: 0, Miss: 0, Blunder: 0 }
      },
      Endgame: { 
        startPly: null, endPly: null, 
        wTotal: 0, bTotal: 0, wScore: 0, bScore: 0,
        moves: [], wAcc: null, bAcc: null,
        counts: { Brilliant: 0, Great: 0, Best: 0, Good: 0, Inaccuracy: 0, Mistake: 0, Miss: 0, Blunder: 0 }
      }
    }

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i]
      const ply = i + 1
      const isWhite = i % 2 === 0
      const analysis = analysisByPly[i]
      
      if (!analysis) continue

      const s = stats[phase]
      if (s.startPly === null) s.startPly = ply
      s.endPly = ply
      
      const c = analysis.classification
      s.counts[c] = (s.counts[c] || 0) + 1
      
      const score = 
        c === 'Brilliant' || c === 'Great' || c === 'Best' ? 1 :
        c === 'Good' ? 0.95 :
        c === 'Inaccuracy' ? 0.75 :
        c === 'Mistake' ? 0.40 :
        c === 'Miss' ? 0.10 : 0

      if (isWhite) {
        s.wTotal++
        s.wScore += score
      } else {
        s.bTotal++
        s.bScore += score
      }
      
      s.moves.push({
        ply,
        san: game.moves[i].san,
        classification: c,
        isWhite,
        scoreCp: analysis.playedScoreCp
      })
    }

    // Calculate accuracies
    for (const p of ['Opening', 'Middlegame', 'Endgame']) {
      const s = stats[p]
      if (s.wTotal > 0) s.wAcc = Math.max(10, Math.round((s.wScore / s.wTotal) * 100))
      if (s.bTotal > 0) s.bAcc = Math.max(10, Math.round((s.bScore / s.bTotal) * 100))
    }

    return stats
  }, [game, analysisByPly, phases])

  if (!phaseStats) return <div className="empty-state">No phase data available</div>

  const timelineSegments = []
  const totalMoves = phases.length
  if (totalMoves > 0) {
    if (phaseStats.Opening.endPly) {
      const pct = (phaseStats.Opening.endPly / totalMoves) * 100
      timelineSegments.push({ phase: 'Opening', width: pct, class: 'seg-opening', start: phaseStats.Opening.startPly })
    }
    if (phaseStats.Middlegame.endPly) {
      const len = phaseStats.Middlegame.endPly - (phaseStats.Middlegame.startPly || phaseStats.Opening.endPly || 0)
      const pct = (len / totalMoves) * 100
      timelineSegments.push({ phase: 'Middlegame', width: pct, class: 'seg-middle', start: phaseStats.Middlegame.startPly })
    }
    if (phaseStats.Endgame.endPly) {
      const len = phaseStats.Endgame.endPly - (phaseStats.Endgame.startPly || phaseStats.Middlegame.endPly || 0)
      const pct = (len / totalMoves) * 100
      timelineSegments.push({ phase: 'Endgame', width: pct, class: 'seg-end', start: phaseStats.Endgame.startPly })
    }
  }

  const renderPhaseCard = (phaseName, data) => {
    if (!data.startPly) return null
    
    // Find key moments (mistakes/blunders or brilliant/great moves)
    const highlights = data.moves.filter(m => 
      ['Brilliant', 'Great', 'Mistake', 'Blunder', 'Miss'].includes(m.classification)
    ).slice(0, 3)

    return (
      <div className="phase-card" key={phaseName}>
        <div className="phase-card-header">
          <h4 className={`phase-title ${phaseName.toLowerCase()}`}>{phaseName}</h4>
          <span className="phase-range">Moves {Math.ceil(data.startPly/2)} - {Math.ceil(data.endPly/2)}</span>
        </div>
        
        <div className="phase-acc-grid">
          <div className="phase-acc-box">
            <span className="pab-label">White Acc</span>
            <span className="pab-value">{data.wAcc !== null ? `${data.wAcc}%` : '-'}</span>
          </div>
          <div className="phase-acc-box">
            <span className="pab-label">Black Acc</span>
            <span className="pab-value">{data.bAcc !== null ? `${data.bAcc}%` : '-'}</span>
          </div>
        </div>
        
        <div className="phase-classifications">
          {Object.entries(data.counts).map(([c, count]) => {
            if (count === 0) return null
            return (
              <span key={c} className={`phase-badge ${c.toLowerCase()}`} title={`${count} ${c}`}>
                {getAnnotationForClassification(c)} {count}
              </span>
            )
          })}
        </div>

        {highlights.length > 0 && (
          <div className="phase-highlights">
            <span className="ph-label">Key Moments:</span>
            <div className="ph-list">
              {highlights.map(h => (
                <button 
                  key={h.ply} 
                  className={`ph-btn ${h.classification.toLowerCase()}`}
                  onClick={() => onClickPly(h.ply)}
                >
                  <span className="ph-san">{h.isWhite ? `${Math.ceil(h.ply/2)}.` : `${Math.ceil(h.ply/2)}...`} {h.san}</span>
                  <span className="ph-icon">{getAnnotationForClassification(h.classification)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="game-phase-analysis">
      {timelineSegments.length > 0 && (
        <div className="phase-timeline-container">
          <div className="phase-timeline">
            {timelineSegments.map(seg => (
              <div 
                key={seg.phase}
                className={`pt-segment ${seg.class}`} 
                style={{ width: `${seg.width}%` }}
                onClick={() => onClickPly(seg.start)}
                title={`Jump to ${seg.phase}`}
              >
                {seg.width > 15 && <span className="pt-label">{seg.phase}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="phase-cards-container">
        {renderPhaseCard('Opening', phaseStats.Opening)}
        {renderPhaseCard('Middlegame', phaseStats.Middlegame)}
        {renderPhaseCard('Endgame', phaseStats.Endgame)}
      </div>
    </div>
  )
}
