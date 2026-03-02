import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import './App.css'
import {
  analyzeMoveHeuristic,
  classifyMoveByCentipawnLoss,
  formatScore,
  toUciMove,
} from './lib/chessReview'
import { StockfishClient } from './lib/stockfishClient'

const SAMPLE_PGN = `[Event "Casual Game"]
[Site "Berlin GER"]
[Date "1852.??.??"]
[Round "?"]
[White "Adolf Anderssen"]
[Black "Jean Dufresne"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4
7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5
12. Qxb5 Rb8 13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5
16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3
20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8
24. Bxe7# 1-0`

const DEFAULT_HEADERS = ['Event', 'Site', 'Date', 'White', 'Black', 'Result']

function App() {
  const [pgnText, setPgnText] = useState(SAMPLE_PGN)
  const [error, setError] = useState('')
  const [game, setGame] = useState(null)
  const [currentPly, setCurrentPly] = useState(0)
  const [analysisByPly, setAnalysisByPly] = useState({})
  const [analysisStatus, setAnalysisStatus] = useState('Not analyzed')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const currentFen = game?.fens[currentPly] ?? new Chess().fen()
  const activeAnalysis = analysisByPly[currentPly - 1]
  const progress = game
    ? `${Math.max(0, Math.min(currentPly, game.moves.length))}/${game.moves.length} plies`
    : '0/0 plies'

  const moveRows = useMemo(() => {
    if (!game) {
      return []
    }
    const rows = []
    for (let index = 0; index < game.moves.length; index += 2) {
      rows.push({
        number: Math.floor(index / 2) + 1,
        white: { ply: index + 1, move: game.moves[index] },
        black: game.moves[index + 1]
          ? { ply: index + 2, move: game.moves[index + 1] }
          : null,
      })
    }
    return rows
  }, [game])

  const parsePgn = (rawPgn) => {
    setError('')
    const parser = new Chess()
    const ok = parser.loadPgn(rawPgn, { strict: false })
    if (!ok) {
      throw new Error('Invalid PGN format. Check move text and headers.')
    }

    const moves = parser.history({ verbose: true })
    const replay = new Chess()
    const fens = [replay.fen()]
    moves.forEach((move) => {
      replay.move(move)
      fens.push(replay.fen())
    })

    setGame({
      headers: parser.getHeaders(),
      moves,
      fens,
    })
    setCurrentPly(0)
    setAnalysisByPly({})
    setAnalysisStatus('Loaded. Ready for analysis.')
  }

  const onImportPgn = () => {
    try {
      parsePgn(pgnText)
    } catch (parseError) {
      setError(parseError.message)
    }
  }

  const onFileUpload = async (event) => {
    const [file] = event.target.files ?? []
    if (!file) {
      return
    }
    const text = await file.text()
    setPgnText(text)
    try {
      parsePgn(text)
    } catch (parseError) {
      setError(parseError.message)
    } finally {
      event.target.value = ''
    }
  }

  const jumpTo = (ply) => {
    if (!game) {
      return
    }
    const clamped = Math.max(0, Math.min(ply, game.moves.length))
    setCurrentPly(clamped)
  }

  const runAnalysis = async () => {
    if (!game || !game.moves.length || isAnalyzing) {
      return
    }

    setIsAnalyzing(true)
    setAnalysisStatus('Initializing engine...')
    const next = {}
    let evaluator = null
    let engineMode = 'Heuristic fallback'

    try {
      evaluator = new StockfishClient()
      await evaluator.init()
      engineMode = 'Stockfish'
    } catch {
      evaluator = null
    }

    try {
      for (let i = 0; i < game.moves.length; i += 1) {
        const positionFen = game.fens[i]
        const playedMove = game.moves[i]
        let result
        if (evaluator) {
          const best = await evaluator.getBestMoveAndScore(positionFen, 13)
          const played = await evaluator.getScoreAfterMove(positionFen, toUciMove(playedMove), 13)
          const cpLoss = Math.max(0, best.scoreCp - played.scoreCp)
          result = {
            cpLoss,
            bestMove: best.bestMove,
            bestScoreCp: best.scoreCp,
            playedScoreCp: played.scoreCp,
            classification: classifyMoveByCentipawnLoss(cpLoss),
            mode: engineMode,
          }
        } else {
          result = analyzeMoveHeuristic(positionFen, playedMove)
        }
        next[i] = result
        setAnalysisByPly({ ...next })
        setAnalysisStatus(
          `${result.mode}: analyzed ${i + 1}/${game.moves.length} moves`
        )
      }
      setAnalysisStatus(`${engineMode}: completed ${game.moves.length} moves`)
    } catch (runError) {
      setAnalysisStatus(`Stopped: ${runError.message}`)
    } finally {
      evaluator?.quit()
      setIsAnalyzing(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="left-pane">
        <header className="panel-header">
          <h1>Chess Review Lab</h1>
          <p>Free analysis workflow for PGN imports and blunder tracking.</p>
        </header>

        <div className="board-wrap">
          <Chessboard
            id="review-board"
            position={currentFen}
            arePiecesDraggable={false}
            boardWidth={560}
            customDarkSquareStyle={{ backgroundColor: '#355070' }}
            customLightSquareStyle={{ backgroundColor: '#f2e9e4' }}
          />
        </div>

        <div className="board-controls">
          <button onClick={() => jumpTo(0)}>Start</button>
          <button onClick={() => jumpTo(currentPly - 1)}>Prev</button>
          <span>{progress}</span>
          <button onClick={() => jumpTo(currentPly + 1)}>Next</button>
          <button onClick={() => jumpTo(game?.moves.length ?? 0)}>End</button>
        </div>

        <div className="analysis-card">
          <h2>Position Insight</h2>
          {activeAnalysis ? (
            <div className="insight-grid">
              <p>
                <strong>Class:</strong> {activeAnalysis.classification}
              </p>
              <p>
                <strong>Centipawn Loss:</strong> {Math.round(activeAnalysis.cpLoss)}
              </p>
              <p>
                <strong>Best Move:</strong> {activeAnalysis.bestMove}
              </p>
              <p>
                <strong>Played Eval:</strong> {formatScore(activeAnalysis.playedScoreCp)}
              </p>
              <p>
                <strong>Best Eval:</strong> {formatScore(activeAnalysis.bestScoreCp)}
              </p>
            </div>
          ) : (
            <p>Run analysis, then click a move to view diagnostics.</p>
          )}
        </div>
      </section>

      <section className="right-pane">
        <div className="panel import-card">
          <h2>Import PGN</h2>
          <textarea
            value={pgnText}
            onChange={(event) => setPgnText(event.target.value)}
            rows={10}
            placeholder="Paste your PGN here"
          />
          <div className="import-actions">
            <button onClick={onImportPgn}>Load PGN</button>
            <label className="file-picker">
              Upload .pgn
              <input type="file" accept=".pgn,text/plain" onChange={onFileUpload} />
            </label>
            <button onClick={runAnalysis} disabled={!game || isAnalyzing}>
              {isAnalyzing ? 'Analyzing...' : 'Analyze Game'}
            </button>
          </div>
          <p className="status-line">{analysisStatus}</p>
          {error ? <p className="error-line">{error}</p> : null}
        </div>

        <div className="panel metadata-card">
          <h2>Game Metadata</h2>
          {game ? (
            <ul>
              {DEFAULT_HEADERS.map((header) => (
                <li key={header}>
                  <strong>{header}:</strong> {game.headers[header] ?? '-'}
                </li>
              ))}
            </ul>
          ) : (
            <p>Load a PGN to see headers and moves.</p>
          )}
        </div>

        <div className="panel move-card">
          <h2>Move List</h2>
          {moveRows.length ? (
            <div className="move-table">
              {moveRows.map((row) => (
                <div className="move-row" key={row.number}>
                  <span className="move-number">{row.number}.</span>
                  <button
                    className={`move-btn ${analysisByPly[row.white.ply - 1]?.classification?.toLowerCase() ?? ''} ${
                      currentPly === row.white.ply ? 'active' : ''
                    }`}
                    onClick={() => jumpTo(row.white.ply)}
                  >
                    {row.white.move.san}
                  </button>
                  {row.black ? (
                    <button
                      className={`move-btn ${analysisByPly[row.black.ply - 1]?.classification?.toLowerCase() ?? ''} ${
                        currentPly === row.black.ply ? 'active' : ''
                      }`}
                      onClick={() => jumpTo(row.black.ply)}
                    >
                      {row.black.move.san}
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>No moves yet.</p>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
