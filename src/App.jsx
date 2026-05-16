import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { Chess } from 'chess.js'
import './App.css'
import {
  analyzeMoveHeuristic,
  classifyMoveByAccuracy,
  formatScore,
  toUciMove,
} from './lib/chessReview'
import { StockfishClient } from './lib/stockfishClient'
import { generateChessExplanation } from './lib/moveExplanation'
import {
  fetchChessComRecentGames,
  fetchLichessRecentGames,
} from './lib/gameProviders'
import { ChessBoardWrapper } from './components/ChessBoardWrapper'
import { EvalBar } from './components/EvalBar'
import { EvalGraph } from './components/EvalGraph'
import { GamePhaseAnalysis } from './components/GamePhaseAnalysis'
import { BoardBuilder } from './components/BoardBuilder'
import { playSoundForSan, setSoundEnabled, isSoundEnabled } from './lib/sounds'

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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function annotationForClassification(classification) {
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

function uciToSan(fen, uciMove) {
  if (!uciMove || uciMove === '-' || uciMove === '(none)') return ''
  try {
    const chess = new Chess(fen)
    const from = uciMove.substring(0, 2)
    const to = uciMove.substring(2, 4)
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined
    const move = chess.move({ from, to, promotion })
    return move ? move.san : uciMove
  } catch {

    try {
      const fenParts = fen.split(' ')
      fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w'
      const chess = new Chess(fenParts.join(' '))
      const from = uciMove.substring(0, 2)
      const to = uciMove.substring(2, 4)
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined
      const move = chess.move({ from, to, promotion })
      return move ? move.san : uciMove
    } catch {
      return uciMove
    }
  }
}

function commentForMove(san, classification, ply) {
  if ((classification === 'Best' || classification === 'Good') && ply <= 12) {
    return `${san} is theory.`
  }
  const comments = {
    Brilliant: `${san} is brilliant!`,
    Great: `${san} is a great move!`,
    Best: `${san} is best.`,
    Good: `${san} is good.`,
    Inaccuracy: `${san} is an inaccuracy.`,
    Mistake: `${san} is a mistake.`,
    Miss: `${san} is a miss.`,
    Blunder: `${san} is a blunder!`,
  }
  return comments[classification] || `${san} played.`
}

function Analyzer() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const initialFen = useMemo(() => new Chess().fen(), [])
  
  // Try to grab FEN from state if we came from the builder
  const startingFen = location.state?.fromBuilderFen || initialFen
  
  const [pgnText, setPgnText] = useState(SAMPLE_PGN)
  const [error, setError] = useState('')
  const [game, setGame] = useState(null)
  const [currentPly, setCurrentPly] = useState(0)
  const [boardPosition, setBoardPosition] = useState(startingFen)
  const [analysisByPly, setAnalysisByPly] = useState({})
  const [commentsByPly, setCommentsByPly] = useState({})
  const [analysisStatus, setAnalysisStatus] = useState('Not analyzed')
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [chessComUser, setChessComUser] = useState('')
  const [lichessUser, setLichessUser] = useState('')
  const [remoteGames, setRemoteGames] = useState([])
  const [remoteStatus, setRemoteStatus] = useState('')
  const [isFetchingRemote, setIsFetchingRemote] = useState(false)
  const [isPlaybackRunning, setIsPlaybackRunning] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [boardOrientation, setBoardOrientation] = useState('white')
  const [activeTab, setActiveTab] = useState('moves')
  const [currentEvalCp, setCurrentEvalCp] = useState(0)
  const [selectedSquare, setSelectedSquare] = useState('')
  const [legalMoves, setLegalMoves] = useState([])
  const [previewMove, setPreviewMove] = useState(null)  // { from, to } for best-move preview
  const playbackRef = useRef(null)
  const currentPlyRef = useRef(0)
  const moveListRef = useRef(null)

  const activeAnalysis = analysisByPly[currentPly - 1]
  const currentMove = currentPly > 0 ? game?.moves?.[currentPly - 1] ?? null : null
  const currentClassification = activeAnalysis?.classification ?? ''
  const currentComment = commentsByPly[currentPly - 1] ?? ''

  const displayMove = previewMove || currentMove
  const displayClassification = previewMove ? 'Best' : currentClassification

  // If we arrived from the builder with a FEN, load it automatically as a game
  useEffect(() => {
    if (location.state?.fromBuilderFen && !game) {
      try {
        const chess = new Chess(location.state.fromBuilderFen)
        // Note: For a custom FEN without moves, we just set the initial position
        // We'll construct a mock 'game' so analysis can run from this position
        const targetGame = {
          headers: { White: 'White', Black: 'Black', Result: '*' },
          moves: [],
          fens: [location.state.fromBuilderFen]
        }
        setGame(targetGame)
        setBoardPosition(location.state.fromBuilderFen)
        setPlyPosition(0, targetGame)
        setActiveTab('moves')
      } catch (e) {
        console.error("Invalid FEN from builder", e)
      }
      
      // Clear state so we don't reload it on every re-render
      navigate(location.pathname, { replace: true })
    }
  }, [location.state, game, navigate])

  const moveRows = useMemo(() => {
    if (!game) return []
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

  useEffect(() => {
    currentPlyRef.current = currentPly
  }, [currentPly])

  useEffect(() => {
    return () => {
      if (playbackRef.current) clearInterval(playbackRef.current)
    }
  }, [])

  useEffect(() => {
    if (moveListRef.current) {
      const activeEl = moveListRef.current.querySelector('.move-btn.active')
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [currentPly])

  useEffect(() => {
    if (activeAnalysis) {
      setCurrentEvalCp(activeAnalysis.playedScoreCp ?? 0)
    } else if (currentPly === 0) {
      setCurrentEvalCp(0)
    }
  }, [activeAnalysis, currentPly])

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      clearInterval(playbackRef.current)
      playbackRef.current = null
    }
    setIsPlaybackRunning(false)
  }, [])

  const setPlyPosition = useCallback((ply, targetGame = null) => {
    const g = targetGame
    if (!g || !Array.isArray(g.fens) || !Array.isArray(g.moves)) {
      setCurrentPly(0)
      setBoardPosition(initialFen)
      return
    }
    const clamped = Math.max(0, Math.min(ply, g.moves.length))
    const previousPly = currentPlyRef.current
    const nextFen = g.fens[clamped] ?? g.fens[0] ?? initialFen

    setCurrentPly(clamped)
    setBoardPosition(nextFen)
    currentPlyRef.current = clamped
    setPreviewMove(null)

    if (clamped > previousPly && clamped > 0) {
      const san = g.moves[clamped - 1]?.san ?? ''
      playSoundForSan(san)
    }
  }, [initialFen])

  const startPlayback = useCallback((targetGame) => {
    stopPlayback()
    if (!targetGame?.moves?.length) return

    let ply = 0
    setPlyPosition(0, targetGame)
    setIsPlaybackRunning(true)
    playbackRef.current = setInterval(() => {
      ply += 1
      setPlyPosition(ply, targetGame)
      if (ply >= targetGame.moves.length) {
        stopPlayback()
      }
    }, 400)
  }, [stopPlayback, setPlyPosition])

  const parsePgn = useCallback((rawPgn, options = {}) => {
    const { autoplay = true } = options
    setError('')
    const parser = new Chess()
    parser.loadPgn(rawPgn, { strict: false })

    const moves = parser.history({ verbose: true })
    if (!moves.length) {
      throw new Error('Invalid PGN format.')
    }

    const replay = new Chess()
    const fens = [replay.fen()]
    moves.forEach((move) => {
      replay.move(move)
      fens.push(replay.fen())
    })

    const parsedGame = { headers: parser.getHeaders(), moves, fens }
    setGame(parsedGame)
    setBoardPosition(parsedGame.fens[0] ?? initialFen)
    setPlyPosition(0, parsedGame)
    setAnalysisByPly({})
    setCommentsByPly({})
    setAnalysisProgress(0)
    setAnalysisStatus('Loaded. Ready for analysis.')
    setActiveTab('moves')

    if (autoplay) {
      startPlayback(parsedGame)
    } else {
      stopPlayback()
    }
    return parsedGame
  }, [initialFen, setPlyPosition, startPlayback, stopPlayback])

  const onImportPgn = () => {
    try {
      parsePgn(pgnText)
    } catch (e) {
      setError(e.message)
    }
  }

  const onFileUpload = async (event) => {
    const [file] = event.target.files ?? []
    if (!file) return
    const text = await file.text()
    setPgnText(text)
    try {
      parsePgn(text)
    } catch (e) {
      setError(e.message)
    } finally {
      event.target.value = ''
    }
  }

  const jumpTo = (ply) => {
    if (!game) return
    stopPlayback()
    setPlyPosition(ply, game)
  }

  const executeMove = useCallback((sourceSquare, targetSquare) => {
    stopPlayback()
    let chess = new Chess(boardPosition)
    let move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })

    if (!move) {
      const fromPiece = chess.get(sourceSquare)
      if (fromPiece) {
        const fenFields = boardPosition.split(' ')
        if (fenFields.length >= 2) {
          fenFields[1] = fromPiece.color
          try {
            const forced = new Chess(fenFields.join(' '))
            const forcedMove = forced.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
            if (forcedMove) { chess = forced; move = forcedMove }
          } catch {  }
        }
      }
    }

    if (!move) return false

    const newMoves = game ? [...game.moves.slice(0, currentPly), move] : [move]
    const newFens = game ? [...game.fens.slice(0, currentPly + 1), chess.fen()] : [initialFen, chess.fen()]
    const updatedGame = { headers: game?.headers ?? {}, moves: newMoves, fens: newFens }
    const manualResult = analyzeMoveHeuristic(boardPosition, move)
    const idx = newMoves.length - 1

    setGame(updatedGame)
    setAnalysisByPly(prev => ({ ...prev, [idx]: manualResult }))
    setCommentsByPly(prev => ({ ...prev, [idx]: commentForMove(move.san, manualResult.classification, newMoves.length) }))
    playSoundForSan(move.san)
    setSelectedSquare('')
    setLegalMoves([])
    setPlyPosition(newMoves.length, updatedGame)
    return true
  }, [boardPosition, game, currentPly, initialFen, stopPlayback, setPlyPosition])

  const getLegalMovesForSquare = useCallback((square) => {
    try {
      const chess = new Chess(boardPosition)
      let moves = chess.moves({ square, verbose: true })
      if (moves.length === 0) {
        const piece = chess.get(square)
        if (piece) {
          const fenFields = boardPosition.split(' ')
          if (fenFields.length >= 2) {
            fenFields[1] = piece.color
            try {
              const forcedChess = new Chess(fenFields.join(' '))
              moves = forcedChess.moves({ square, verbose: true })
            } catch {  }
          }
        }
      }
      return moves
    } catch {
      return []
    }
  }, [boardPosition])

  const selectSquare = useCallback((square) => {
    const moves = getLegalMovesForSquare(square)
    if (moves.length > 0) {
      setSelectedSquare(square)
      setLegalMoves(moves)
    } else {
      setSelectedSquare('')
      setLegalMoves([])
    }
  }, [getLegalMovesForSquare])

  const handlePieceClick = useCallback((square) => {
    if (selectedSquare === square) {
      setSelectedSquare('')
      setLegalMoves([])
      return
    }
    if (selectedSquare) {
      const isLegalTarget = legalMoves.some(m => m.to === square)
      if (isLegalTarget) {
        executeMove(selectedSquare, square)
        return
      }
    }
    selectSquare(square)
  }, [selectedSquare, legalMoves, executeMove, selectSquare])

  const handleSquareClick = useCallback((square) => {
    if (!selectedSquare) return
    const isLegalTarget = legalMoves.some(m => m.to === square)
    if (isLegalTarget) {
      executeMove(selectedSquare, square)
    } else {
      setSelectedSquare('')
      setLegalMoves([])
    }
  }, [selectedSquare, legalMoves, executeMove])

  const handlePieceDrag = useCallback((square) => {
    selectSquare(square)
  }, [selectSquare])

  const onPieceDrop = useCallback((sourceSquare, targetSquare) => {
    return executeMove(sourceSquare, targetSquare)
  }, [executeMove])

  const runAnalysis = async (gameOverride = null) => {
    const targetGame = gameOverride ?? game
    if (!targetGame?.moves?.length || isAnalyzing) return

    setIsAnalyzing(true)
    setAnalysisStatus('Initializing engine...')
    setAnalysisProgress(0)
    stopPlayback()
    setPlyPosition(0, targetGame)
    const next = {}
    const nextComments = {}
    let evaluator = null
    let engineMode = 'Heuristic'

    try {
      evaluator = new StockfishClient()
      await evaluator.init()
      engineMode = 'Stockfish'
    } catch {
      evaluator = null
    }

    try {
      for (let i = 0; i < targetGame.moves.length; i += 1) {
        const positionFen = targetGame.fens[i]
        const playedMove = targetGame.moves[i]
        let result
        if (evaluator) {
          const depthTarget = 14;
          const best = await evaluator.getBestMoveAndScore(positionFen, depthTarget)
          
          let playedScoreCp;
          let isEngineBest = false;
          let isMatePlayed = false;

          // Check if the move is a literal match for best move (fixes horizon evaluation dropoff)
          const playedUci = toUciMove(playedMove);
          if (best.bestMove === playedUci) {
            isEngineBest = true;
            playedScoreCp = best.scoreCp;
          } else {
            const played = await evaluator.getScoreAfterMove(positionFen, playedUci, depthTarget)
            playedScoreCp = played.scoreCp;
          }

          // Check if the move just played delivers checkmate on the board
          try {
             let chessToTestMate = new Chess(positionFen);
             chessToTestMate.move(playedMove);
             if (chessToTestMate.isCheckmate()) {
                 isMatePlayed = true;
                 playedScoreCp = 10000; // Force positive mate win explicitly
             }
          } catch(e) {}

          const cpLoss = Math.max(0, best.scoreCp - playedScoreCp)
          const bestMoveSan = uciToSan(positionFen, best.bestMove)
          result = {
            cpLoss,
            bestMove: best.bestMove,
            bestMoveSan,
            bestScoreCp: best.scoreCp,
            playedScoreCp,
            classification: classifyMoveByAccuracy(best.scoreCp, playedScoreCp, isMatePlayed, isEngineBest, true),
            mode: engineMode,
          }
        } else {
          result = analyzeMoveHeuristic(positionFen, playedMove)
          result.bestMoveSan = uciToSan(positionFen, result.bestMove)
        }

        result.explanation = generateChessExplanation(positionFen, playedMove, result)
        next[i] = result
        nextComments[i] = commentForMove(playedMove.san, result.classification, i + 1)
        setAnalysisByPly({ ...next })
        setCommentsByPly({ ...nextComments })
        setPlyPosition(i + 1, targetGame)
        setAnalysisProgress(((i + 1) / targetGame.moves.length) * 100)
        setAnalysisStatus(`${engineMode}: ${i + 1}/${targetGame.moves.length}`)
        await sleep(60)
      }
      setAnalysisStatus(`${engineMode}: complete ✓`)
    } catch (e) {
      setAnalysisStatus(`Error: ${e.message}`)
    } finally {
      evaluator?.quit()
      setIsAnalyzing(false)
    }
  }

  const loadFromChessCom = async () => {
    setError('')
    setIsFetchingRemote(true)
    setRemoteStatus('Fetching...')
    try {
      const games = await fetchChessComRecentGames(chessComUser, 12)
      setRemoteGames(games)
      setRemoteStatus(`${games.length} games loaded`)
    } catch (e) {
      setRemoteGames([])
      setRemoteStatus('Failed')
      setError(e.message)
    } finally {
      setIsFetchingRemote(false)
    }
  }

  const loadFromLichess = async () => {
    setError('')
    setIsFetchingRemote(true)
    setRemoteStatus('Fetching...')
    try {
      const games = await fetchLichessRecentGames(lichessUser, 12)
      setRemoteGames(games)
      setRemoteStatus(`${games.length} games loaded`)
    } catch (e) {
      setRemoteGames([])
      setRemoteStatus('Failed')
      setError(e.message)
    } finally {
      setIsFetchingRemote(false)
    }
  }

  const loadRemoteGame = async (remoteGame) => {
    setError('')
    setPgnText(remoteGame.pgn)
    try {
      const pg = parsePgn(remoteGame.pgn, { autoplay: true })
      setRemoteStatus(`Loaded: ${remoteGame.white} vs ${remoteGame.black}`)
      await runAnalysis(pg)
    } catch (e) {
      setError(e.message)
    }
  }

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
  }

  const flipBoard = () => {
    setBoardOrientation(prev => prev === 'white' ? 'black' : 'white')
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); jumpTo(currentPly - 1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); jumpTo(currentPly + 1) }
      else if (e.key === 'Home') { e.preventDefault(); jumpTo(0) }
      else if (e.key === 'End') { e.preventDefault(); jumpTo(game?.moves?.length ?? 0) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const whitePlayer = game?.headers?.White ?? 'White'
  const blackPlayer = game?.headers?.Black ?? 'Black'
  const result = game?.headers?.Result ?? ''

  const stats = useMemo(() => {
    if (!game || Object.keys(analysisByPly).length === 0) return null
    let wBril = 0, wGreat = 0, wBest = 0, wGood = 0, wInac = 0, wMis = 0, wMiss = 0, wBlun = 0, wTotal = 0
    let bBril = 0, bGreat = 0, bBest = 0, bGood = 0, bInac = 0, bMis = 0, bMiss = 0, bBlun = 0, bTotal = 0
    Object.entries(analysisByPly).forEach(([plyStr, a]) => {
      const ply = Number(plyStr)
      const isWhite = ply % 2 === 0
      const c = a.classification
      if (isWhite) {
        wTotal++
        if (c === 'Brilliant') wBril++
        else if (c === 'Great') wGreat++
        else if (c === 'Best') wBest++
        else if (c === 'Good') wGood++
        else if (c === 'Inaccuracy') wInac++
        else if (c === 'Mistake') wMis++
        else if (c === 'Miss') wMiss++
        else if (c === 'Blunder') wBlun++
      } else {
        bTotal++
        if (c === 'Brilliant') bBril++
        else if (c === 'Great') bGreat++
        else if (c === 'Best') bBest++
        else if (c === 'Good') bGood++
        else if (c === 'Inaccuracy') bInac++
        else if (c === 'Mistake') bMis++
        else if (c === 'Miss') bMiss++
        else if (c === 'Blunder') bBlun++
      }
    })
    
    // Smooth WP scaling instead of naive straight CP weight
    const wScore = (wBril + wGreat + wBest)*1 + wGood*0.95 + wInac*0.75 + wMis*0.40 + wMiss*0.10 + wBlun*0
    const bScore = (bBril + bGreat + bBest)*1 + bGood*0.95 + bInac*0.75 + bMis*0.40 + bMiss*0.10 + bBlun*0
    
    // Give minimum 10% accuracy floor (0 is practically impossible in chess if you play legal moves)
    let wAccRaw = wTotal > 0 ? (wScore / wTotal) * 100 : null
    let bAccRaw = bTotal > 0 ? (bScore / bTotal) * 100 : null
    
    const wAccuracy = wAccRaw !== null ? Math.max(10, Math.round(wAccRaw)) : null;
    const bAccuracy = bAccRaw !== null ? Math.max(10, Math.round(bAccRaw)) : null;

    return { 
      wBril, wGreat, wBest, wGood, wInac, wMis, wMiss, wBlun, wTotal, wAccuracy, 
      bBril, bGreat, bBest, bGood, bInac, bMis, bMiss, bBlun, bTotal, bAccuracy 
    }
  }, [game, analysisByPly])

  return (
    <>
    <main className="app-shell">
      {/* New Comment Here  */}
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">♔</span>
          <span className="logo-text">Chess Review Lab</span>
        </div>
        
        <div className="nav-links">
          <Link to="/" className="nav-link active">Analyzer</Link>
          <Link to="/builder" className="nav-link">Board Builder</Link>
        </div>

        <div className="header-actions">
          <button className="icon-btn" onClick={toggleSound} title={soundOn ? 'Mute' : 'Unmute'}>
            {soundOn ? '♫' : '♪'}
          </button>
        </div>
      </header>

      <div className="main-content">

        <div className="board-area">

          <div className="player-bar top">
            <div className="player-avatar black-avatar">♚</div>
            <div className="player-info">
              <span className="player-name">{boardOrientation === 'white' ? blackPlayer : whitePlayer}</span>
              {(boardOrientation === 'white' ? stats?.bAccuracy : stats?.wAccuracy) != null && (
                <span className="player-accuracy">
                  {boardOrientation === 'white' ? stats.bAccuracy : stats.wAccuracy}% Accuracy
                </span>
              )}
              {result && <span className="player-result">{result}</span>}
            </div>
          </div>

          <div className="board-with-eval">
            <EvalBar scoreCp={currentEvalCp} flipped={boardOrientation === 'black'} />
            <ChessBoardWrapper
              position={boardPosition}
              onPieceDrop={onPieceDrop}
              onSquareClick={handleSquareClick}
              onPieceClick={handlePieceClick}
              onPieceDrag={handlePieceDrag}
              boardOrientation={boardOrientation}
              lastMove={displayMove}
              classification={displayClassification}
              selectedSquare={selectedSquare}
              legalMoves={legalMoves}
            />
          </div>

          <div className="player-bar bottom">
            <div className="player-avatar white-avatar">♔</div>
            <div className="player-info">
              <span className="player-name">{boardOrientation === 'white' ? whitePlayer : blackPlayer}</span>
              {(boardOrientation === 'white' ? stats?.wAccuracy : stats?.bAccuracy) != null && (
                <span className="player-accuracy">
                  {boardOrientation === 'white' ? stats.wAccuracy : stats.bAccuracy}% Accuracy
                </span>
              )}
            </div>
          </div>

          <EvalGraph
            analysisByPly={analysisByPly}
            totalMoves={game?.moves?.length ?? 0}
            currentPly={currentPly}
            onClickPly={jumpTo}
            moves={game?.moves ?? []}
          />

          <div className="board-controls">
            <button className="ctrl-btn" onClick={flipBoard} title="Flip board">↕</button>
            <div className="nav-controls">
              <button className="ctrl-btn" onClick={() => jumpTo(0)} title="Start">⏮</button>
              <button className="ctrl-btn" onClick={() => jumpTo(currentPly - 1)} title="Previous">◀</button>
              {isPlaybackRunning ? (
                <button className="ctrl-btn active-ctrl" onClick={stopPlayback} title="Stop">⏹</button>
              ) : (
                <button className="ctrl-btn play-btn" onClick={() => startPlayback(game)} title="Auto-play" disabled={!game}>▶</button>
              )}
              <button className="ctrl-btn" onClick={() => jumpTo(currentPly + 1)} title="Next">▶</button>
              <button className="ctrl-btn" onClick={() => jumpTo(game?.moves?.length ?? 0)} title="End">⏭</button>
            </div>
            <span className="ply-counter">{currentPly}/{game?.moves?.length ?? 0}</span>
          </div>
        </div>

        <div className="right-panel">

          <div className="tab-bar">
            <button className={`tab ${activeTab === 'moves' ? 'active' : ''}`} onClick={() => setActiveTab('moves')}>
              Moves
            </button>
            <button className={`tab ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>
              Import
            </button>
            <button className={`tab ${activeTab === 'api' ? 'active' : ''}`} onClick={() => setActiveTab('api')}>
              Online
            </button>
            <button className={`tab ${activeTab === 'phases' ? 'active' : ''}`} onClick={() => setActiveTab('phases')}>
              Phases
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'moves' && (
              <div className="moves-tab">

                <div className="analysis-section">
                  <button
                    className="analyze-btn"
                    onClick={() => runAnalysis()}
                    disabled={!game || isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <span className="spinner" />
                        Analyzing...
                      </>
                    ) : (
                      <><span className="icon-search" /> Analyze Game</>
                    )}
                  </button>
                  {isAnalyzing && (
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${analysisProgress}%` }} />
                    </div>
                  )}
                  {analysisStatus !== 'Not analyzed' && (
                    <span className="analysis-status">{analysisStatus}</span>
                  )}
                </div>

                {currentComment && (
                  <div className={`coach-card ${currentClassification.toLowerCase()}`}>
                    <span className="coach-icon">
                      <span className={`class-icon ${currentClassification.toLowerCase()}`}>
                        {currentClassification === 'Brilliant' ? '!!' :
                         currentClassification === 'Great' ? '!' :
                         currentClassification === 'Best' ? '★' :
                         currentClassification === 'Good' ? '✓' :
                         currentClassification === 'Inaccuracy' ? '?!' :
                         currentClassification === 'Mistake' ? '?' :
                         currentClassification === 'Miss' ? 'x' :
                         currentClassification === 'Blunder' ? '??' : '•'}
                      </span>
                    </span>
                    <div className="coach-content">
                      <span className={`coach-classification ${currentClassification.toLowerCase()}`}>
                        {currentClassification} {annotationForClassification(currentClassification)}
                      </span>
                      <span className="coach-text">{currentComment}</span>
                    </div>
                  </div>
                )}

                {activeAnalysis && activeAnalysis.classification !== 'Best' && activeAnalysis.classification !== 'Good' && (
                  <div className="explanation-card">

                    {activeAnalysis.explanation && (
                      <div className="explanation-text">
                        {activeAnalysis.explanation}
                      </div>
                    )}

                    {activeAnalysis.bestMoveSan && activeAnalysis.bestMove !== '-' && (
                      <div className="best-move-section">
                        <span className="best-move-label">Best was</span>
                        <button
                          className="best-move-btn"
                          onClick={() => {
                            if (!game || currentPly <= 0) return
                            const plyIdx = currentPly - 1
                            const positionFen = game.fens[plyIdx]
                            const uci = activeAnalysis.bestMove
                            if (!uci || uci === '-') return
                            const from = uci.substring(0, 2)
                            const to = uci.substring(2, 4)
                            const promotion = uci.length > 4 ? uci[4] : undefined
                            try {
                              let chess = new Chess(positionFen)
                              let move = chess.move({ from, to, promotion: promotion || 'q' })
                              if (!move) {
                                const fenParts = positionFen.split(' ')
                                fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w'
                                chess = new Chess(fenParts.join(' '))
                                move = chess.move({ from, to, promotion: promotion || 'q' })
                              }
                              if (move) {
                                setBoardPosition(chess.fen())
                                setPreviewMove({ from, to })
                                playSoundForSan(move.san)
                              }
                            } catch {  }
                          }}
                          title="Click to play the best move"
                        >
                          {activeAnalysis.bestMoveSan}
                        </button>
                        <span className="best-move-eval">
                          {formatScore(activeAnalysis.bestScoreCp)}
                        </span>
                      </div>
                    )}

                    <div className="eval-comparison">
                      <div className="eval-compare-item played">
                        <span className="ec-label">Played</span>
                        <span className="ec-value">{formatScore(activeAnalysis.playedScoreCp)}</span>
                        <span className="ec-loss">−{Math.round(activeAnalysis.cpLoss)} cp</span>
                      </div>
                      <div className="eval-compare-item best">
                        <span className="ec-label">Best</span>
                        <span className="ec-value">{formatScore(activeAnalysis.bestScoreCp)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {stats && (
                  <div className="stats-card">
                    <h3>Accuracy Summary</h3>
                    <div className="stats-grid">
                      <div className="stats-col">
                        <span className="stats-player">⬜ {whitePlayer}</span>
                        <div className="stat-row brilliant">
                          <span>Brilliant</span><span>{stats.wBril}</span>
                        </div>
                        <div className="stat-row great">
                          <span>Great</span><span>{stats.wGreat}</span>
                        </div>
                        <div className="stat-row best">
                          <span>Best</span><span>{stats.wBest}</span>
                        </div>
                        <div className="stat-row good">
                          <span>Good</span><span>{stats.wGood}</span>
                        </div>
                        <div className="stat-row inaccuracy">
                          <span>Inaccuracy</span><span>{stats.wInac}</span>
                        </div>
                        <div className="stat-row mistake">
                          <span>Mistake</span><span>{stats.wMis}</span>
                        </div>
                        <div className="stat-row miss">
                          <span>Miss</span><span>{stats.wMiss}</span>
                        </div>
                        <div className="stat-row blunder">
                          <span>Blunder</span><span>{stats.wBlun}</span>
                        </div>
                      </div>
                      <div className="stats-col">
                        <span className="stats-player">⬛ {blackPlayer}</span>
                        <div className="stat-row brilliant">
                          <span>Brilliant</span><span>{stats.bBril}</span>
                        </div>
                        <div className="stat-row great">
                          <span>Great</span><span>{stats.bGreat}</span>
                        </div>
                        <div className="stat-row best">
                          <span>Best</span><span>{stats.bBest}</span>
                        </div>
                        <div className="stat-row good">
                          <span>Good</span><span>{stats.bGood}</span>
                        </div>
                        <div className="stat-row inaccuracy">
                          <span>Inaccuracy</span><span>{stats.bInac}</span>
                        </div>
                        <div className="stat-row mistake">
                          <span>Mistake</span><span>{stats.bMis}</span>
                        </div>
                        <div className="stat-row miss">
                          <span>Miss</span><span>{stats.bMiss}</span>
                        </div>
                        <div className="stat-row blunder">
                          <span>Blunder</span><span>{stats.bBlun}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="move-list-container" ref={moveListRef}>
                  {moveRows.length ? (
                    <div className="move-list">
                      {moveRows.map((row) => (
                        <div className="move-row" key={row.number}>
                          <span className="move-number">{row.number}.</span>
                          <button
                            className={`move-btn ${analysisByPly[row.white.ply - 1]?.classification?.toLowerCase() ?? ''} ${currentPly === row.white.ply ? 'active' : ''}`}
                            onClick={() => jumpTo(row.white.ply)}
                          >
                            <span className="move-san">{row.white.move.san}</span>
                            <span className="move-annotation">
                              {annotationForClassification(analysisByPly[row.white.ply - 1]?.classification)}
                            </span>
                          </button>
                          {row.black ? (
                            <button
                              className={`move-btn ${analysisByPly[row.black.ply - 1]?.classification?.toLowerCase() ?? ''} ${currentPly === row.black.ply ? 'active' : ''}`}
                              onClick={() => jumpTo(row.black.ply)}
                            >
                              <span className="move-san">{row.black.move.san}</span>
                              <span className="move-annotation">
                                {annotationForClassification(analysisByPly[row.black.ply - 1]?.classification)}
                              </span>
                            </button>
                          ) : <span />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>Import a PGN to see moves here.</p>
                    </div>
                  )}
                </div>

                {game && (
                  <div className="metadata-section">
                    {DEFAULT_HEADERS.map(h => (
                      game.headers[h] ? (
                        <span key={h} className="meta-tag">{h}: {game.headers[h]}</span>
                      ) : null
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'import' && (
              <div className="import-tab">
                <h3>Import PGN</h3>
                <textarea
                  value={pgnText}
                  onChange={(e) => setPgnText(e.target.value)}
                  rows={12}
                  placeholder="Paste your PGN here..."
                  spellCheck={false}
                />
                <div className="import-actions">
                  <button className="primary-btn" onClick={onImportPgn}>
                    Load PGN
                  </button>
                  <label className="secondary-btn">
                    📁 Upload .pgn
                    <input type="file" accept=".pgn,text/plain" onChange={onFileUpload} />
                  </label>
                </div>
                {error && <p className="error-msg">{error}</p>}
              </div>
            )}

            {activeTab === 'api' && (
              <div className="api-tab">
                <h3>Chess.com</h3>
                <div className="api-row">
                  <input
                    value={chessComUser}
                    onChange={(e) => setChessComUser(e.target.value)}
                    placeholder="Username"
                    onKeyDown={(e) => e.key === 'Enter' && loadFromChessCom()}
                  />
                  <button className="primary-btn" onClick={loadFromChessCom} disabled={isFetchingRemote}>
                    Fetch
                  </button>
                </div>

                <h3>Lichess</h3>
                <div className="api-row">
                  <input
                    value={lichessUser}
                    onChange={(e) => setLichessUser(e.target.value)}
                    placeholder="Username"
                    onKeyDown={(e) => e.key === 'Enter' && loadFromLichess()}
                  />
                  <button className="primary-btn" onClick={loadFromLichess} disabled={isFetchingRemote}>
                    Fetch
                  </button>
                </div>

                {remoteStatus && <p className="api-status">{remoteStatus}</p>}

                {remoteGames.length > 0 && (
                  <div className="remote-games">
                    {remoteGames.map((g) => (
                      <button
                        className="remote-game-btn"
                        key={g.id}
                        onClick={() => loadRemoteGame(g)}
                      >
                        <span className="rg-players">{g.white} vs {g.black}</span>
                        <span className="rg-meta">{g.source} · {g.date} · {g.result}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!remoteGames.length && !remoteStatus && (
                  <p className="empty-state-text">Enter a username and click Fetch to load games.</p>
                )}
              </div>
            )}

            {activeTab === 'phases' && (
              <div className="phases-tab">
                {analysisStatus === 'Not analyzed' || analysisProgress < 100 || Object.keys(analysisByPly).length === 0 ? (
                  <div className="empty-state">
                    <p>Run analysis on a game first to see phase performance.</p>
                  </div>
                ) : (
                  <GamePhaseAnalysis 
                    game={game} 
                    analysisByPly={analysisByPly} 
                    onClickPly={jumpTo} 
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
    </>
  )
}

// Wrapper for the Board Builder to include the shared header
function BuilderPage() {
  return (
    <>
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">♔</span>
          <span className="logo-text">Chess Review Lab</span>
        </div>
        
        <div className="nav-links">
          <Link to="/" className="nav-link">Analyzer</Link>
          <Link to="/builder" className="nav-link active">Board Builder</Link>
        </div>

        <div className="header-actions">
          {/* Header actions on builder page could be empty or have other toggles */}
        </div>
      </header>
      
      <div className="main-content builder-page-content">
        <BoardBuilder />
      </div>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<Analyzer />} />
          <Route path="/builder" element={<BuilderPage />} />
        </Routes>
        
        <footer className="app-footer">
          <span className="footer-text">Built with ♟ by</span>
          <a href="https://iamgs.vercel.app" target="_blank" rel="noopener noreferrer" className="footer-link">RKGS</a>
          <span className="footer-sep">·</span>
          <a href="https://buymeacoffee.com/rkgs" target="_blank" rel="noopener noreferrer" className="footer-link coffee-link">
            <span className="coffee-icon">☕</span> Buy me a coffee
          </a>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
