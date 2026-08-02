// Background music, played from the files in assets/.
//
// This is the one part of the audio that is not synthesised. It uses a plain
// <audio> element rather than the Web Audio graph in sfx.js, for two reasons:
// an element streams, where decoding a 6 MB track into an AudioBuffer would
// hold it all in memory; and element.volume works whether or not the
// AudioContext happens to be running, so the music cannot end up "playing"
// inaudibly into a suspended context.
//
// One element, src swapped per track. Thirteen preloading elements would be
// tens of megabytes of buffers for twelve tracks nobody is listening to yet.

export const DEFAULT_VOLUME = 0.15
const STORAGE_KEY = 'almondegous.musicVolume'
// Meetings, quizzes and the map are moments that need reading or listening;
// the music drops rather than stops, so it does not restart mid-phrase.
const DUCK_FACTOR = 0.3

function shuffled(list, randomFn) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function createMusic({
  audio,
  fetchTracks,
  randomFn = Math.random,
  storage = typeof localStorage === 'undefined' ? null : localStorage,
} = {}) {
  let playlist = []
  let index = 0
  // Which track is actually loaded into the element. Tracked here rather
  // than compared against audio.src, because reading .src back gives the
  // resolved absolute URL, never the relative string that was assigned - so
  // that comparison would be true every time and the guard would be dead.
  let loadedIndex = -1
  let wanted = false
  let ducked = false
  let waitingForGesture = false
  let consecutiveErrors = 0

  // Note the null check: Number(null) is 0, which is a perfectly valid
  // volume, so reading it loosely would start every new player on mute.
  const saved = storage?.getItem(STORAGE_KEY)
  const stored = saved === null || saved === undefined ? NaN : Number(saved)
  let volume = Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : DEFAULT_VOLUME

  function applyVolume() {
    // Always derived from the player's setting, never from a constant -
    // otherwise every meeting would quietly reset the slider.
    audio.volume = ducked ? volume * DUCK_FACTOR : volume
  }

  // A gesture unlocked the AudioContext, but that does not license media
  // playback: play() can still reject with NotAllowedError, and a match
  // starts on a server message, which is not a gesture. Retrying on the next
  // real interaction turns a permanently silent failure into a brief one.
  function retryOnNextGesture() {
    if (waitingForGesture || typeof document === 'undefined') return
    waitingForGesture = true
    const retry = () => {
      document.removeEventListener('pointerdown', retry, true)
      document.removeEventListener('keydown', retry, true)
      waitingForGesture = false
      if (wanted) play()
    }
    document.addEventListener('pointerdown', retry, true)
    document.addEventListener('keydown', retry, true)
  }

  function play() {
    if (!wanted || playlist.length === 0) return
    if (loadedIndex !== index) {
      audio.src = playlist[index]
      loadedIndex = index
    }
    applyVolume()
    audio.play?.()?.catch?.(retryOnNextGesture)
  }

  function next() {
    if (playlist.length === 0) return
    index += 1
    if (index >= playlist.length) {
      playlist = shuffled(playlist, randomFn)
      index = 0
      loadedIndex = -1
    }
    play()
  }

  audio.addEventListener('ended', next)
  audio.addEventListener('playing', () => {
    consecutiveErrors = 0
  })
  // A corrupt or half-uploaded file should cost one track, not the
  // soundtrack - but a folder where nothing is playable (an unsupported
  // codec, say) must not spin through the playlist forever hitting the
  // network. One full pass with nothing playable is enough to give up.
  audio.addEventListener('error', () => {
    if (!wanted) return
    consecutiveErrors += 1
    if (consecutiveErrors > playlist.length) {
      wanted = false
      console.warn('Nenhuma faixa de assets/ pôde ser tocada; seguindo sem música.')
      return
    }
    next()
  })

  return {
    // Network boundary: an empty folder and a failed request both end up as
    // silence, and only the warning tells them apart when debugging later.
    async load() {
      try {
        const names = await fetchTracks()
        playlist = shuffled(
          names.map((name) => `assets/${encodeURIComponent(name)}`),
          randomFn
        )
        index = 0
        loadedIndex = -1
      } catch (error) {
        console.warn('Não consegui listar as músicas de fundo:', error)
        playlist = []
      }
      // A match can begin before this resolves: ROLE arrives on a server
      // message, not on our timeline. Without this the player would have
      // asked for music, found an empty playlist, and stayed silent forever.
      if (wanted) play()
      return playlist.length
    },

    start() {
      wanted = true
      play()
    },

    stop() {
      wanted = false
      audio.pause?.()
    },

    setDucked(value) {
      ducked = value
      applyVolume()
    },

    setVolume(value) {
      volume = Math.min(1, Math.max(0, value))
      storage?.setItem(STORAGE_KEY, String(volume))
      applyVolume()
      return volume
    },

    getVolume() {
      return volume
    },

    trackCount() {
      return playlist.length
    },
  }
}
