import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMusic, DEFAULT_VOLUME } from './music.js'

function fakeAudio() {
  const listeners = {}
  return {
    // src is stored resolved, the way a real element does it: assigning a
    // relative path and reading back an absolute URL. A fake that returned
    // the assigned string verbatim would let a read-back comparison pass
    // here and be dead in the browser.
    _src: '',
    get src() {
      return this._src
    },
    set src(value) {
      this._src = new URL(value, 'http://game.test/').href
    },
    volume: 1,
    paused: true,
    plays: 0,
    addEventListener(type, fn) {
      listeners[type] = fn
    },
    emit(type) {
      listeners[type]?.()
    },
    play() {
      this.plays += 1
      this.paused = false
      this.emit('playing')
      return Promise.resolve()
    },
    pause() {
      this.paused = true
    },
  }
}

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value
    },
    data,
  }
}

const TRACKS = ['a.mp3', 'b.mp3', 'c.mp3']
const tracksFn = () => Promise.resolve(TRACKS)
const noShuffle = () => 0

test('plays a track from the assets folder once started', async () => {
  const audio = fakeAudio()
  const music = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage: fakeStorage() })
  assert.equal(await music.load(), 3)
  music.start()
  assert.ok(audio.src.includes('/assets/'), `did not load from assets: ${audio.src}`)
  assert.equal(audio.paused, false)
})

test('filenames with spaces and symbols survive as URLs', async () => {
  const audio = fakeAudio()
  const music = createMusic({
    audio,
    fetchTracks: () => Promise.resolve(['Down The Rabbit Hole - Density & Time.mp3']),
    randomFn: noShuffle,
    storage: fakeStorage(),
  })
  await music.load()
  music.start()
  assert.ok(!audio.src.includes(' '), `unencoded space in ${audio.src}`)
  assert.ok(!audio.src.includes('&'), `unencoded ampersand in ${audio.src}`)
  assert.equal(
    decodeURIComponent(new URL(audio.src).pathname),
    '/assets/Down The Rabbit Hole - Density & Time.mp3'
  )
})

test('the default volume is quiet, as background music should be', () => {
  const music = createMusic({ audio: fakeAudio(), fetchTracks: tracksFn, storage: fakeStorage() })
  assert.equal(music.getVolume(), DEFAULT_VOLUME)
  assert.ok(DEFAULT_VOLUME <= 0.25, 'the user asked for quiet background music')
})

test('the player can turn the volume all the way down', async () => {
  const audio = fakeAudio()
  const music = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage: fakeStorage() })
  await music.load()
  music.start()
  assert.equal(music.setVolume(0), 0)
  assert.equal(audio.volume, 0, 'volume 0 must actually silence the element')
  assert.equal(music.setVolume(5), 1, 'volume is clamped to a valid range')
})

test('ducking restores the volume the player chose, not the default', async () => {
  const audio = fakeAudio()
  const music = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage: fakeStorage() })
  await music.load()
  music.start()
  music.setVolume(0.4)

  music.setDucked(true)
  assert.ok(audio.volume < 0.4, 'ducking did not lower the volume')

  music.setDucked(false)
  assert.equal(audio.volume, 0.4, 'a meeting silently reset the volume slider')
})

test('the chosen volume is remembered between sessions', async () => {
  const storage = fakeStorage()
  createMusic({ audio: fakeAudio(), fetchTracks: tracksFn, storage }).setVolume(0.42)

  const audio = fakeAudio()
  const reopened = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage })
  assert.equal(reopened.getVolume(), 0.42)
  await reopened.load()
  reopened.start()
  assert.equal(audio.volume, 0.42)
})

test('a finished track advances to the next one', async () => {
  const audio = fakeAudio()
  const music = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage: fakeStorage() })
  await music.load()
  music.start()
  const first = audio.src
  audio.emit('ended')
  assert.notEqual(audio.src, first, 'the same track played twice in a row')
})

test('the playlist wraps around instead of falling silent at the end', async () => {
  const audio = fakeAudio()
  const music = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage: fakeStorage() })
  await music.load()
  music.start()
  for (let i = 0; i < TRACKS.length * 2; i += 1) audio.emit('ended')
  assert.ok(audio.src.includes('/assets/'))
  assert.equal(audio.paused, false)
})

test('a broken file skips to the next track rather than ending the music', async () => {
  const audio = fakeAudio()
  const music = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage: fakeStorage() })
  await music.load()
  music.start()
  const broken = audio.src
  audio.emit('error')
  assert.notEqual(audio.src, broken)
  assert.equal(audio.paused, false)
})

test('stop pauses, and a stopped track does not resume itself on ended', async () => {
  const audio = fakeAudio()
  const music = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage: fakeStorage() })
  await music.load()
  music.start()
  music.stop()
  assert.equal(audio.paused, true)
  audio.emit('ended')
  assert.equal(audio.paused, true, 'the music restarted after the match ended')
})

test('an empty or missing assets folder is silent, not broken', async () => {
  const audio = fakeAudio()
  const music = createMusic({ audio, fetchTracks: () => Promise.resolve([]), storage: fakeStorage() })
  assert.equal(await music.load(), 0)
  music.start()
  assert.equal(audio.plays, 0)
  assert.equal(audio.paused, true)
})

test('a failed track listing degrades to silence instead of throwing', async () => {
  const audio = fakeAudio()
  const music = createMusic({
    audio,
    fetchTracks: () => Promise.reject(new Error('offline')),
    storage: fakeStorage(),
  })
  const warn = console.warn
  console.warn = () => {}
  try {
    assert.equal(await music.load(), 0)
  } finally {
    console.warn = warn
  }
  music.start()
  assert.equal(audio.plays, 0)
})

test('a rejected play() is retried, so autoplay blocking is not permanent silence', async () => {
  const audio = fakeAudio()
  let blocked = true
  audio.play = function () {
    this.plays += 1
    if (blocked) return Promise.reject(new Error('NotAllowedError'))
    this.paused = false
    return Promise.resolve()
  }

  const gestureListeners = []
  global.document = {
    addEventListener: (type, fn) => gestureListeners.push(fn),
    removeEventListener: () => {},
  }
  try {
    const music = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage: fakeStorage() })
    await music.load()
    music.start()
    await Promise.resolve()
    assert.ok(gestureListeners.length > 0, 'blocked playback armed no retry: the music would never start')

    blocked = false
    gestureListeners[0]()
    assert.equal(audio.paused, false, 'the retry did not actually start the music')
  } finally {
    delete global.document
  }
})

test('the playlist is shuffled, so a match does not always open on the same track', async () => {
  const firsts = new Set()
  for (let seed = 1; seed <= 30; seed += 1) {
    let state = seed
    const randomFn = () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff
      return state / 0x7fffffff
    }
    const audio = fakeAudio()
    const music = createMusic({ audio, fetchTracks: tracksFn, randomFn, storage: fakeStorage() })
    await music.load()
    music.start()
    firsts.add(audio.src)
  }
  assert.ok(firsts.size > 1, 'every match starts with the same track')
})

test('a match that starts before the track list arrives still gets music', async () => {
  const audio = fakeAudio()
  let release
  const music = createMusic({
    audio,
    fetchTracks: () => new Promise((resolve) => (release = resolve)),
    randomFn: noShuffle,
    storage: fakeStorage(),
  })

  const loading = music.load()
  // ROLE arrives on a server message, not on our timeline: it can land while
  // the fetch is still in flight.
  music.start()
  assert.equal(audio.plays, 0, 'nothing to play yet')

  release(TRACKS)
  await loading
  assert.ok(audio.plays > 0, 'the music never started: the match beat the track list')
  assert.equal(audio.paused, false)
})

test('a folder where nothing is playable gives up instead of looping forever', async () => {
  const audio = fakeAudio()
  audio.play = function () {
    this.plays += 1
    return Promise.resolve()
  }
  const music = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage: fakeStorage() })
  await music.load()
  music.start()

  const warn = console.warn
  console.warn = () => {}
  try {
    for (let i = 0; i < 200; i += 1) audio.emit('error')
  } finally {
    console.warn = warn
  }
  assert.ok(audio.plays <= TRACKS.length + 1, `hammered the network ${audio.plays} times over ${TRACKS.length} tracks`)
})

test('one bad file among good ones does not end the soundtrack', async () => {
  const audio = fakeAudio()
  const music = createMusic({ audio, fetchTracks: tracksFn, randomFn: noShuffle, storage: fakeStorage() })
  await music.load()
  music.start()
  for (let round = 0; round < 10; round += 1) {
    audio.emit('error') // one failure...
    audio.emit('ended') // ...then a track that plays through
  }
  assert.equal(audio.paused, false, 'gave up despite tracks still playing fine')
})
