import { Chess } from 'chess.js'

const PIECE_NAMES = {
    p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
}

const PIECE_VALUES = {
    p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
}
function getAttackedSquares(chess, color) {
    const attacked = new Set()
    const board = chess.board()
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c]
            if (piece && piece.color === color) {
                const sq = String.fromCharCode(97 + c) + (8 - r)
                try {
                    const moves = chess.moves({ square: sq, verbose: true })
                    moves.forEach(m => attacked.add(m.to))
                } catch {  }
            }
        }
    }
    return attacked
}
function getPieces(chess, color) {
    const pieces = []
    const board = chess.board()
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c]
            if (piece && piece.color === color) {
                const sq = String.fromCharCode(97 + c) + (8 - r)
                pieces.push({ type: piece.type, color: piece.color, square: sq })
            }
        }
    }
    return pieces
}
function isSquareDefended(chess, square, byColor) {
    const board = chess.board()
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c]
            if (piece && piece.color === byColor && !(piece.type === 'k')) {
                const sq = String.fromCharCode(97 + c) + (8 - r)
                try {
                    const moves = chess.moves({ square: sq, verbose: true })
                    if (moves.some(m => m.to === square)) return true
                } catch {  }
            }
        }
    }
    return false
}
function findHangingPieces(chess, color) {
    const enemy = color === 'w' ? 'b' : 'w'
    const myPieces = getPieces(chess, color)
    const hanging = []

    for (const piece of myPieces) {
        if (piece.type === 'k') continue
        const enemyMoves = chess.moves({ verbose: true })
        const isAttacked = enemyMoves.some(m => m.to === piece.square && m.captured)
        if (isAttacked) {
            const defended = isSquareDefended(chess, piece.square, color)
            if (!defended) {
                hanging.push(piece)
            }
        }
    }
    return hanging
}
function findLostDefense(beforeFen, playedMove) {
    const before = new Chess(beforeFen)
    const movedPieceSquare = playedMove.from
    const movedPieceType = playedMove.piece
    const movedColor = playedMove.color
    const friendlyPieces = getPieces(before, movedColor)
        .filter(p => p.square !== movedPieceSquare && p.type !== 'k')
    const after = new Chess(beforeFen)
    try {
        after.move(playedMove)
    } catch {
        return []
    }

    const lostDefense = []
    const enemyColor = movedColor === 'w' ? 'b' : 'w'

    for (const piece of friendlyPieces) {
        const wasMoveDefender = isSquareDefended(before, piece.square, movedColor)
        const stillDefended = isSquareDefended(after, piece.square, movedColor)

        if (wasMoveDefender && !stillDefended) {
            try {
                const enemyMoves = after.moves({ verbose: true })
                const isNowAttacked = enemyMoves.some(m => m.to === piece.square)
                if (isNowAttacked) {
                    lostDefense.push(piece)
                }
            } catch {  }
        }
    }
    return lostDefense
}
function analyzeOpponentThreats(afterFen) {
    const after = new Chess(afterFen)
    const threats = {
        checkmate: false,
        mateInN: 0,
        checks: [],
        captures: [],
        bigCaptures: [],
        forks: [],
    }

    if (after.isCheckmate()) {
        threats.checkmate = true
        return threats
    }

    const opponentMoves = after.moves({ verbose: true })
    for (const m of opponentMoves) {
        if (m.captured) {
            const value = PIECE_VALUES[m.captured] || 0
            threats.captures.push({
                piece: m.piece,
                captured: m.captured,
                from: m.from,
                to: m.to,
                value,
                san: m.san,
            })
            if (value >= 3) {
                threats.bigCaptures.push({
                    piece: m.piece,
                    captured: m.captured,
                    value,
                    san: m.san,
                })
            }
        }
        if (m.san.includes('+')) {
            threats.checks.push(m)
        }
    }
    const attacksBy = {}
    for (const m of opponentMoves) {
        if (m.captured && PIECE_VALUES[m.captured] >= 3) {
            const key = `${m.piece}${m.from}`
            if (!attacksBy[key]) attacksBy[key] = []
            attacksBy[key].push(m)
        }
    }
    for (const [key, attacks] of Object.entries(attacksBy)) {
        if (attacks.length >= 2) {
            threats.forks.push({
                piece: attacks[0].piece,
                from: attacks[0].from,
                targets: attacks.map(a => ({ type: a.captured, square: a.to })),
            })
        }
    }
    for (const m of opponentMoves) {
        const testChess = new Chess(afterFen)
        try {
            testChess.move(m)
            if (testChess.isCheckmate()) {
                threats.mateInN = 1
                break
            }
        } catch {  }
    }

    return threats
}
function analyzeBestMoveTactic(beforeFen, bestMoveUci) {
    if (!bestMoveUci || bestMoveUci === '-') return null
    const chess = new Chess(beforeFen)
    const from = bestMoveUci.substring(0, 2)
    const to = bestMoveUci.substring(2, 4)
    const promotion = bestMoveUci.length > 4 ? bestMoveUci[4] : undefined

    try {
        let move = chess.move({ from, to, promotion })
        if (!move) {
            const fenParts = beforeFen.split(' ')
            fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w'
            const flipped = new Chess(fenParts.join(' '))
            move = flipped.move({ from, to, promotion })
            if (!move) return null
        }
        const result = { san: move.san, isCapture: !!move.captured, isCheck: move.san.includes('+') }
        if (move.captured) {
            result.capturedPiece = PIECE_NAMES[move.captured]
            result.capturedValue = PIECE_VALUES[move.captured]
        }
        return result
    } catch {
        return null
    }
}



export function generateChessExplanation(positionFen, playedMove, analysis) {
    if (!analysis || !playedMove) return ''

    const { classification, cpLoss, bestMove, bestMoveSan, bestScoreCp, playedScoreCp } = analysis

    if (classification === 'Best' || classification === 'Good') {
        return ''
    }

    const san = playedMove.san || ''
    const pieceName = PIECE_NAMES[playedMove.piece] || 'piece'
    const parts = []
    let afterFen = null
    try {
        const chess = new Chess(positionFen)
        const m = chess.move(playedMove)
        if (m) afterFen = chess.fen()
    } catch {
        try {
            const fp = positionFen.split(' ')
            fp[1] = fp[1] === 'w' ? 'b' : 'w'
            const chess = new Chess(fp.join(' '))
            const m = chess.move(playedMove)
            if (m) afterFen = chess.fen()
        } catch {  }
    }

    if (!afterFen) {
        parts.push(`${san} weakens the position.`)
        return parts.join(' ')
    }

    const color = playedMove.color
    const enemyColor = color === 'w' ? 'b' : 'w'
    const threats = analyzeOpponentThreats(afterFen)
    if (threats.checkmate) {
        parts.push(`${san} walks into checkmate.`)
        return parts.join(' ')
    }

    if (threats.mateInN === 1) {
        parts.push(`${san} allows the opponent to deliver checkmate on the next move.`)
    }
    const lostDefense = findLostDefense(positionFen, playedMove)
    if (lostDefense.length > 0) {
        const abandoned = lostDefense.map(p => `the ${PIECE_NAMES[p.type]} on ${p.square}`)
        if (lostDefense.length === 1) {
            parts.push(`Moving the ${pieceName} leaves ${abandoned[0]} undefended.`)
        } else {
            parts.push(`Moving the ${pieceName} leaves ${abandoned.join(' and ')} undefended.`)
        }
    }
    if (threats.forks.length > 0) {
        const fork = threats.forks[0]
        const forkPiece = PIECE_NAMES[fork.piece]
        const targets = fork.targets.map(t => `the ${PIECE_NAMES[t.type]}`).join(' and ')
        parts.push(`This allows a ${forkPiece} fork on ${targets}.`)
    }
    if (threats.bigCaptures.length > 0 && lostDefense.length === 0) {
        const biggest = threats.bigCaptures.sort((a, b) => b.value - a.value)[0]
        parts.push(`The opponent can now capture the ${PIECE_NAMES[biggest.captured]} with ${threats.bigCaptures[0].san}.`)
    }
    if (threats.checks.length > 0 && parts.length === 0) {
        parts.push(`This allows a check that gains tempo.`)
    }
    if (parts.length === 0) {
        const swing = Math.abs(cpLoss)
        if (playedMove.captured) {
            if (swing > 200) {
                parts.push(`Capturing with ${san} looks tempting, but it loses more material in the resulting exchanges.`)
            } else {
                parts.push(`${san} wins material but gives up a better opportunity.`)
            }
        } else if (swing >= 500) {
            parts.push(`${san} is a serious positional error that gives the opponent a decisive advantage.`)
        } else if (swing >= 200) {
            parts.push(`${san} misplaces the ${pieceName} and significantly weakens the position.`)
        } else {
            parts.push(`${san} is slightly imprecise — there was a more active move available.`)
        }
    }
    const bestTactic = analyzeBestMoveTactic(positionFen, bestMove)
    if (bestTactic && bestMoveSan) {
        if (bestTactic.isCapture && bestTactic.isCheck) {
            parts.push(`${bestMoveSan} captures the ${bestTactic.capturedPiece} with check, winning material.`)
        } else if (bestTactic.isCapture) {
            parts.push(`${bestMoveSan} wins the ${bestTactic.capturedPiece} instead.`)
        } else if (bestTactic.isCheck) {
            parts.push(`${bestMoveSan} delivers check and seizes the initiative.`)
        } else if (bestMoveSan !== san) {
            if (bestScoreCp > 300) {
                parts.push(`${bestMoveSan} maintains a winning advantage.`)
            } else if (bestScoreCp > 100) {
                parts.push(`${bestMoveSan} keeps a clear edge.`)
            } else {
                parts.push(`${bestMoveSan} was the strongest continuation.`)
            }
        }
    }
    if (bestScoreCp > 100 && playedScoreCp < -100) {
        parts.push('This turns a winning position into a losing one.')
    } else if (bestScoreCp > 0 && playedScoreCp < -150) {
        parts.push('The advantage has completely shifted to the opponent.')
    }

    return parts.join(' ')
}
