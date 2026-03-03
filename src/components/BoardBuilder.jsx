import React, { useState, useEffect } from 'react'
import { FenBoard } from './FenBoard'
import { Chess } from 'chess.js'
import { useNavigate } from 'react-router-dom'

export function BoardBuilder({ currentFen }) {
  const navigate = useNavigate()
  
  const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1'

  const [fen, setFen] = useState(EMPTY_FEN)
  const [selectedPiece, setSelectedPiece] = useState(null)
  const [turn, setTurn] = useState('w')
  const [validationErrors, setValidationErrors] = useState([])

  // Parse FEN to update turn state when input changes
  useEffect(() => {
    try {
      const parts = fen.split(' ')
      if (parts.length > 1 && ['w', 'b'].includes(parts[1])) {
        setTurn(parts[1])
      }
    } catch { }
    validateFen(fen)
  }, [fen])

  const validateFen = (currentFen) => {
    const errors = []
    try {
      const parts = currentFen.split(' ')
      const ranks = parts[0].split('/')
      if (ranks.length !== 8) {
        setValidationErrors(['Invalid board dimensions.'])
        return
      }

      let wKing = 0, bKing = 0
      let wPieces = 0, bPieces = 0
      let wPawns = 0, bPawns = 0

      // Map out board for adjacency checks
      const board = []
      
      for (let r = 0; r < 8; r++) {
        const row = []
        let fileIdx = 0
        for (let i = 0; i < ranks[r].length; i++) {
          const char = ranks[r][i]
          if (!isNaN(char)) {
            const spaces = parseInt(char, 10)
            for (let j = 0; j < spaces; j++) row.push(null)
            fileIdx += spaces
          } else {
            row.push(char)
            if (char === 'K') wKing++
            if (char === 'k') bKing++
            if (char === 'P') wPawns++
            if (char === 'p') bPawns++
            
            if (char.toUpperCase() === char && char !== 'P' && char !== 'K') wPieces++
            if (char.toLowerCase() === char && char !== 'p' && char !== 'k') bPieces++

            // Pawn rank restrictions (r=0 is 8th rank, r=7 is 1st rank)
            if ((char === 'P' || char === 'p') && (r === 0 || r === 7)) {
              errors.push('Pawns cannot be placed on the 1st or 8th rank.')
            }
            fileIdx++
          }
        }
        board.push(row)
      }

      const totalWPieces = wKing + wPawns + wPieces
      const totalBPieces = bKing + bPawns + bPieces

      if (wKing !== 1) errors.push(`White has ${wKing} kings (must have exactly 1).`)
      if (bKing !== 1) errors.push(`Black has ${bKing} kings (must have exactly 1).`)
      if (totalWPieces > 16) errors.push(`White has ${totalWPieces} pieces (maximum 16).`)
      if (totalBPieces > 16) errors.push(`Black has ${totalBPieces} pieces (maximum 16).`)
      if (wPawns > 8) errors.push(`White has ${wPawns} pawns (maximum 8).`)
      if (bPawns > 8) errors.push(`Black has ${bPawns} pawns (maximum 8).`)

      // Check king adjacency
      if (wKing === 1 && bKing === 1) {
        let wkPos = null, bkPos = null
        for (let r = 0; r < 8; r++) {
          for (let f = 0; f < 8; f++) {
            if (board[r][f] === 'K') wkPos = { r, f }
            if (board[r][f] === 'k') bkPos = { r, f }
          }
        }
        if (wkPos && bkPos) {
          const rowDiff = Math.abs(wkPos.r - bkPos.r)
          const colDiff = Math.abs(wkPos.f - bkPos.f)
          if (rowDiff <= 1 && colDiff <= 1) {
            errors.push('Kings cannot be placed on adjacent squares.')
          }
        }
      }

      // Final chess.js legal validation
      if (errors.length === 0) {
        try {
          new Chess(currentFen)
        } catch (e) {
          errors.push('Invalid position: ' + e.message)
        }
      }

    } catch (e) {
      errors.push('Failed to parse FEN string.')
    }

    // Deduplicate errors just in case
    setValidationErrors([...new Set(errors)])
  }

  const pieces = [
    { type: 'K', label: 'White King' },
    { type: 'Q', label: 'White Queen' },
    { type: 'R', label: 'White Rook' },
    { type: 'B', label: 'White Bishop' },
    { type: 'N', label: 'White Knight' },
    { type: 'P', label: 'White Pawn' },
    { type: 'k', label: 'Black King' },
    { type: 'q', label: 'Black Queen' },
    { type: 'r', label: 'Black Rook' },
    { type: 'b', label: 'Black Bishop' },
    { type: 'n', label: 'Black Knight' },
    { type: 'p', label: 'Black Pawn' },
    { type: 'erase', label: 'Eraser' },
  ]

  const handleSquareClick = (square) => {
    if (!selectedPiece) return
    
    // Convert FEN to a 2D array representation
    let parts = fen.split(' ')
    let ranks = parts[0].split('/')
    let board = []
    
    // Parse into 8x8 grid of characters or null
    for (let r = 0; r < 8; r++) {
      let row = []
      let rankStr = ranks[r] || '8'
      for (let i = 0; i < rankStr.length; i++) {
        let char = rankStr[i]
        if (!isNaN(char)) {
          for (let j = 0; j < parseInt(char, 10); j++) {
            row.push(null)
          }
        } else {
          row.push(char)
        }
      }
      // PAD to 8 just in case
      while (row.length < 8) row.push(null)
      board.push(row)
    }

    const files = 'abcdefgh'
    const colName = square.charAt(0)
    const rowName = square.charAt(1)
    
    const fileIdx = files.indexOf(colName)
    const rankIdx = 8 - parseInt(rowName, 10)
    
    if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return

    // Apply the selection
    if (selectedPiece === 'erase') {
      board[rankIdx][fileIdx] = null
    } else {
      board[rankIdx][fileIdx] = selectedPiece
    }

    // Reconstruct FEN
    let newFenRows = []
    for (let r = 0; r < 8; r++) {
      let fenRow = ''
      let emptyCount = 0
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c]
        if (piece === null) {
          emptyCount++
        } else {
          if (emptyCount > 0) {
            fenRow += emptyCount
            emptyCount = 0
          }
          fenRow += piece
        }
      }
      if (emptyCount > 0) fenRow += emptyCount
      newFenRows.push(fenRow)
    }

    const newFenPosition = newFenRows.join('/')
    // Keep turn, remove castling/en-passant/halfmove rights for custom positions to avoid illegal state
    const newFen = `${newFenPosition} ${turn} - - 0 1`
    setFen(newFen)

    if (selectedPiece !== 'erase') {
      setSelectedPiece(null)
    }
  }

  const handlePieceDrop = (sourceSquare, targetSquare) => {
    if (sourceSquare === targetSquare) return
    
    // Parse the Fen into a 2D array
    let parts = fen.split(' ')
    let ranks = parts[0].split('/')
    let board = []
    
    for (let r = 0; r < 8; r++) {
      let row = []
      let rankStr = ranks[r] || '8'
      for (let i = 0; i < rankStr.length; i++) {
        let char = rankStr[i]
        if (!isNaN(char)) {
          for (let j = 0; j < parseInt(char, 10); j++) {
            row.push(null)
          }
        } else {
          row.push(char)
        }
      }
      while (row.length < 8) row.push(null)
      board.push(row)
    }

    const files = 'abcdefgh'
    const fromCol = sourceSquare.charAt(0)
    const fromRow = sourceSquare.charAt(1)
    const toCol = targetSquare.charAt(0)
    const toRow = targetSquare.charAt(1)
    
    const fromFileIdx = files.indexOf(fromCol)
    const fromRankIdx = 8 - parseInt(fromRow, 10)
    const toFileIdx = files.indexOf(toCol)
    const toRankIdx = 8 - parseInt(toRow, 10)
    
    if (fromFileIdx < 0 || fromFileIdx > 7 || fromRankIdx < 0 || fromRankIdx > 7) return
    if (toFileIdx < 0 || toFileIdx > 7 || toRankIdx < 0 || toRankIdx > 7) return

    const pieceMoved = board[fromRankIdx][fromFileIdx]
    if (!pieceMoved) return

    board[fromRankIdx][fromFileIdx] = null
    board[toRankIdx][toFileIdx] = pieceMoved

    // Reconstruct FEN
    let newFenRows = []
    for (let r = 0; r < 8; r++) {
      let fenRow = ''
      let emptyCount = 0
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c]
        if (piece === null) {
          emptyCount++
        } else {
          if (emptyCount > 0) {
            fenRow += emptyCount
            emptyCount = 0
          }
          fenRow += piece
        }
      }
      if (emptyCount > 0) fenRow += emptyCount
      newFenRows.push(fenRow)
    }

    const newFenPosition = newFenRows.join('/')
    const newFen = `${newFenPosition} ${turn} - - 0 1`
    setFen(newFen)
  }

  const handleFenChange = (e) => {
    setFen(e.target.value)
  }

  const handleTurnToggle = () => {
    const nextTurn = turn === 'w' ? 'b' : 'w'
    setTurn(nextTurn)
    let parts = fen.split(' ')
    if (parts.length > 0) {
      parts[1] = nextTurn
      setFen(parts.join(' '))
    }
  }

  const handleLoadCurrent = () => {
    if (currentFen) setFen(currentFen)
  }

  return (
    <div className="board-builder">
      <div className="builder-layout">
        
        <div className="piece-palette">
          <div className="palette-section">
            <span className="palette-title">White</span>
            <div className="palette-grid">
              {pieces.slice(0, 6).map(p => (
                <button 
                  key={p.type} 
                  className={`palette-btn ${selectedPiece === p.type ? 'active' : ''}`}
                  onClick={() => setSelectedPiece(p.type)}
                  title={p.label}
                >
                  <img src={`https://images.chesscomfiles.com/chess-themes/pieces/neo/150/w${p.type.toLowerCase()}.png`} alt={p.type} />
                </button>
              ))}
            </div>
          </div>
          
          <div className="palette-section">
            <span className="palette-title">Black</span>
            <div className="palette-grid">
              {pieces.slice(6, 12).map(p => (
                <button 
                  key={p.type} 
                  className={`palette-btn ${selectedPiece === p.type ? 'active' : ''}`}
                  onClick={() => setSelectedPiece(p.type)}
                  title={p.label}
                >
                  <img src={`https://images.chesscomfiles.com/chess-themes/pieces/neo/150/b${p.type.toLowerCase()}.png`} alt={p.type} />
                </button>
              ))}
            </div>
          </div>
          
          <div className="palette-section">
            <button 
              className={`palette-btn tool-btn ${selectedPiece === 'erase' ? 'active alert' : ''}`}
              onClick={() => setSelectedPiece('erase')}
              title="Eraser"
            >
              ⌫ Erase
            </button>
          </div>
        </div>

        <div className="builder-board-area">
          <FenBoard 
            fen={fen} 
            onSquareClick={handleSquareClick}
            onPieceDrop={handlePieceDrop}
            selectedSquare={selectedPiece ? 'BUILD_MODE' : ''} 
          />
          
          <div className="builder-controls">
            <button className="secondary-btn" onClick={() => setFen(EMPTY_FEN)}>Clear Board</button>
            <button className="secondary-btn" onClick={() => setFen(STARTING_FEN)}>Starting Pos</button>
            <button className="secondary-btn" onClick={handleLoadCurrent} disabled={!currentFen}>Current Pos</button>
          </div>
        </div>

      </div>

      <div className="builder-data">
        <div className="fen-input-group">
          <label>Side to move</label>
          <div className="turn-toggle">
            <button className={`turn-btn ${turn === 'w' ? 'active-w' : ''}`} onClick={() => turn !== 'w' && handleTurnToggle()}>White</button>
            <button className={`turn-btn ${turn === 'b' ? 'active-b' : ''}`} onClick={() => turn !== 'b' && handleTurnToggle()}>Black</button>
          </div>
        </div>
        
        <div className="fen-input-group full-width">
          <label>FEN String</label>
          <div className="fen-copy-row">
             <input type="text" value={fen} onChange={handleFenChange} />
             <button 
               className="secondary-btn icon-only" 
               onClick={() => navigator.clipboard.writeText(fen)}
               title="Copy FEN"
             >
               📋
             </button>
          </div>
        </div>

        {validationErrors.length > 0 && (
          <div className="validation-errors-box">
            <span className="error-title">Invalid Position:</span>
            <ul className="error-list">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <button 
          className="primary-btn analyze-from-here"
          disabled={validationErrors.length > 0}
          onClick={() => {
            if (validationErrors.length === 0) {
              navigate('/', { state: { fromBuilderFen: fen } })
            }
          }}
        >
          <span className="icon-search" /> Analyze from Position
        </button>
      </div>

    </div>
  )
}
