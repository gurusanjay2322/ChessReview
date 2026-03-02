// Chess move sounds using Lichess open-source audio (CC-licensed)
const LICHESS_SOUND_BASE = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard'

const SOUND_URLS = {
    move: `${LICHESS_SOUND_BASE}/Move.mp3`,
    capture: `${LICHESS_SOUND_BASE}/Capture.mp3`,
    check: `${LICHESS_SOUND_BASE}/Move.mp3`,
    castle: `${LICHESS_SOUND_BASE}/Move.mp3`,
    promote: `${LICHESS_SOUND_BASE}/Move.mp3`,
    end: `${LICHESS_SOUND_BASE}/GenericNotify.mp3`,
}

const audioCache = {}
let soundEnabled = true

function getAudio(type) {
    if (!audioCache[type]) {
        audioCache[type] = new Audio(SOUND_URLS[type] || SOUND_URLS.move)
        audioCache[type].volume = 0.6
    }
    return audioCache[type]
}

export function setSoundEnabled(enabled) {
    soundEnabled = enabled
}

export function isSoundEnabled() {
    return soundEnabled
}

export function playSound(type = 'move') {
    if (!soundEnabled) return
    try {
        const audio = getAudio(type)
        audio.currentTime = 0
        audio.play().catch(() => { })
    } catch {
        // Silently fail
    }
}

export function playSoundForSan(san) {
    if (!san) return
    if (san.includes('#')) {
        playSound('end')
    } else if (san.includes('+')) {
        playSound('check')
    } else if (san.includes('x')) {
        playSound('capture')
    } else if (san.startsWith('O-O')) {
        playSound('castle')
    } else if (san.includes('=')) {
        playSound('promote')
    } else {
        playSound('move')
    }
}
