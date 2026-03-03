import { Chess } from 'chess.js'

/**
 * Returns a score roughly representing remaining non-pawn material.
 * Queen = 9, Rook = 5, Bishop = 3, Knight = 3
 */
function getMaterialScore(board) {
    let score = 0
    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            const piece = board[rank][file]
            if (!piece) continue
            if (piece.type === 'q') score += 9
            else if (piece.type === 'r') score += 5
            else if (piece.type === 'b') score += 3
            else if (piece.type === 'n') score += 3
        }
    }
    return score
}

/**
 * Classifies the phase of the game for each ply (1-indexed).
 * 
 * Rules of thumb:
 * - Opening: Up to ply 20 (move 10), or until 10 minor pieces/rooks are developed/missing.
 * - Endgame: When material score drops below 26 (e.g., both sides missing queens, or queen vs minor pieces).
 * - Middlegame: Everything in between.
 * 
 * @param {string[]} fens - Array of FEN strings for each position in the game (0 is starting position).
 * @returns {string[]} Array of phases ('Opening', 'Middlegame', 'Endgame') for each move index.
 */
export function classifyPhases(fens) {
    if (!fens || fens.length === 0) return []

    const phases = []
    let currentPhase = 'Opening'

    for (let i = 1; i < fens.length; i++) {
        const fen = fens[i]

        // If we've already reached endgame, stay in endgame
        if (currentPhase === 'Endgame') {
            phases.push('Endgame')
            continue
        }

        try {
            const chess = new Chess(fen)
            const board = chess.board()

            const materialScore = getMaterialScore(board)

            // Endgame threshold: <= 26 non-pawn material points
            // (Starting is 2*9 + 4*5 + 4*3 + 4*3 = 18 + 20 + 12 + 12 = 62)
            if (materialScore <= 28) {
                currentPhase = 'Endgame'
            } else if (currentPhase === 'Opening' && i > 24) {
                // Force middlegame by move 12 (ply 24) if not already
                currentPhase = 'Middlegame'
            } else if (currentPhase === 'Opening') {
                // Check for development: if many pieces have moved from their starting squares
                // Simple heuristic for development: count pieces on max rank 1 for white and 8 for black
                let undevelopedCount = 0
                for (let file = 0; file < 8; file++) {
                    const wPiece = board[7][file] // White back rank
                    const bPiece = board[0][file] // Black back rank
                    if (wPiece && wPiece.color === 'w' && wPiece.type !== 'k') undevelopedCount++
                    if (bPiece && bPiece.color === 'b' && bPiece.type !== 'k') undevelopedCount++
                }

                // Starting undeveloped pieces is 14 (excluding kings).
                // If 6 or more non-king pieces have developed, transition to middlegame.
                if (undevelopedCount <= 8) {
                    currentPhase = 'Middlegame'
                }
            }

            phases.push(currentPhase)
        } catch {
            // Fallback
            phases.push(currentPhase)
        }
    }

    return phases
}
