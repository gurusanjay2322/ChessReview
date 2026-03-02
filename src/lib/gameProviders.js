const CHESS_COM_BASE = 'https://api.chess.com/pub'
const LICHESS_BASE = 'https://lichess.org/api'

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return response.json()
}

async function fetchText(url, init = {}) {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return response.text()
}

function formatDate(value) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toISOString().slice(0, 10)
}

function playerLabel(player, fallback) {
  return player?.username ?? player?.name ?? fallback
}

function chessComResult(game) {
  const whiteResult = game?.white?.result ?? '-'
  const blackResult = game?.black?.result ?? '-'
  return `${whiteResult}/${blackResult}`
}

function parseNdjson(raw) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

export async function fetchChessComRecentGames(username, max = 10) {
  const normalized = username.trim().toLowerCase()
  if (!normalized) {
    throw new Error('Chess.com username is required')
  }

  const archivePayload = await fetchJson(
    `${CHESS_COM_BASE}/player/${encodeURIComponent(normalized)}/games/archives`
  )
  const archives = archivePayload?.archives ?? []
  if (!archives.length) {
    throw new Error('No Chess.com archives found for that user')
  }

  const latestArchiveUrl = archives[archives.length - 1]
  const latestArchive = await fetchJson(latestArchiveUrl)
  const games = Array.isArray(latestArchive?.games) ? latestArchive.games : []

  return games
    .filter((game) => typeof game?.pgn === 'string' && game.pgn.trim())
    .sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0))
    .slice(0, max)
    .map((game, index) => {
      const white = playerLabel(game.white, 'White')
      const black = playerLabel(game.black, 'Black')
      return {
        id: game.url ?? `chesscom-${normalized}-${game.end_time ?? index}`,
        source: 'Chess.com',
        white,
        black,
        result: chessComResult(game),
        date: formatDate((game.end_time ?? 0) * 1000),
        pgn: game.pgn,
        url: game.url ?? '',
      }
    })
}

export async function fetchLichessRecentGames(username, max = 10) {
  const normalized = username.trim()
  if (!normalized) {
    throw new Error('Lichess username is required')
  }

  const query = new URLSearchParams({
    max: String(max),
    pgnInJson: 'true',
    moves: 'true',
    tags: 'true',
    clocks: 'false',
    evals: 'false',
    opening: 'true',
  })

  const endpoint = `${LICHESS_BASE}/games/user/${encodeURIComponent(normalized)}?${query.toString()}`
  const raw = await fetchText(endpoint, {
    headers: {
      Accept: 'application/x-ndjson',
    },
  })

  const games = parseNdjson(raw)
  return games
    .filter((game) => typeof game?.pgn === 'string' && game.pgn.trim())
    .slice(0, max)
    .map((game, index) => {
      const white =
        game?.players?.white?.user?.name ??
        game?.players?.white?.name ??
        'White'
      const black =
        game?.players?.black?.user?.name ??
        game?.players?.black?.name ??
        'Black'
      const result = game?.winner ? `${game.winner} won` : game?.status ?? '-'

      return {
        id: game.id ?? `lichess-${normalized}-${index}`,
        source: 'Lichess',
        white,
        black,
        result,
        date: formatDate(game.createdAt),
        pgn: game.pgn,
        url: game.id ? `https://lichess.org/${game.id}` : '',
      }
    })
}
