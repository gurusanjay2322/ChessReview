const DEFAULT_WORKER_URL = '/stockfish/stockfish.js'
const MATE_SCORE_CP = 10000

function parseScore(line) {
  const mateMatch = line.match(/score mate (-?\d+)/)
  if (mateMatch) {
    const mateIn = Number(mateMatch[1])
    return mateIn > 0 ? MATE_SCORE_CP - mateIn : -MATE_SCORE_CP - mateIn
  }

  const cpMatch = line.match(/score cp (-?\d+)/)
  if (cpMatch) {
    return Number(cpMatch[1])
  }

  return null
}

function normalizeBestMove(bestMove) {
  if (!bestMove || bestMove === '(none)') {
    return '-'
  }
  return bestMove
}

export class StockfishClient {
  constructor(workerUrl = DEFAULT_WORKER_URL) {
    this.workerUrl = workerUrl
    this.worker = null
    this.pending = null
  }

  async init() {
    if (this.worker) {
      return
    }

    this.worker = new Worker(this.workerUrl)
    this.worker.onmessage = (event) => {
      const line = String(event.data ?? '').trim()
      if (this.pending) {
        this.pending(line)
      }
    }
    this.post('uci')
    await this.waitForLine((line) => line === 'uciok', 3000)
    this.post('isready')
    await this.waitForLine((line) => line === 'readyok', 3000)
  }

  post(command) {
    if (!this.worker) {
      throw new Error('Engine is not initialized')
    }
    this.worker.postMessage(command)
  }

  waitForLine(predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending = null
        reject(new Error('Stockfish response timeout'))
      }, timeoutMs)

      this.pending = (line) => {
        if (predicate(line)) {
          clearTimeout(timeout)
          this.pending = null
          resolve(line)
        }
      }
    })
  }

  async evaluatePosition(fen, depth = 13, moves = []) {
    await this.init()
    const positionMoves = moves.length ? ` moves ${moves.join(' ')}` : ''
    this.post(`position fen ${fen}${positionMoves}`)
    this.post(`go depth ${depth}`)

    return new Promise((resolve, reject) => {
      let latestScore = 0
      const timeout = setTimeout(() => {
        this.pending = null
        reject(new Error('Stockfish evaluation timeout'))
      }, 12000)

      this.pending = (line) => {
        if (line.startsWith('info')) {
          const score = parseScore(line)
          if (score !== null) {
            latestScore = score
          }
          return
        }

        if (line.startsWith('bestmove')) {
          clearTimeout(timeout)
          this.pending = null
          const [, bestMove] = line.split(' ')
          resolve({
            bestMove: normalizeBestMove(bestMove),
            scoreCp: latestScore,
          })
        }
      }
    })
  }

  async getBestMoveAndScore(fen, depth = 13) {
    return this.evaluatePosition(fen, depth)
  }

  async getScoreAfterMove(fen, uciMove, depth = 13) {
    const result = await this.evaluatePosition(fen, depth, [uciMove])
    return {
      bestMove: result.bestMove,
      scoreCp: -result.scoreCp,
    }
  }

  quit() {
    if (!this.worker) {
      return
    }
    this.worker.terminate()
    this.worker = null
    this.pending = null
  }
}
