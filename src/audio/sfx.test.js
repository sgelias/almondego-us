import { test } from 'node:test'
import assert from 'node:assert/strict'

// A fake AudioContext. The point is to verify the call graph actually
// reaches a sound source: the user reported total silence, and the module
// looked correct by inspection - only driving it end to end distinguishes
// "the synth is broken" from "the synth never got switched on".
function installFakeAudio() {
  const started = []
  const makeParam = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
  })

  class FakeAudioContext {
    constructor() {
      this.state = 'suspended'
      this.sampleRate = 48000
      this.currentTime = 0
      this.destination = {}
    }
    resume() {
      this.state = 'running'
    }
    createGain() {
      return { gain: makeParam(), connect() {} }
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: makeParam(),
        connect() {},
        start: () => started.push('osc'),
        stop() {},
      }
    }
    createBiquadFilter() {
      return { type: '', Q: { value: 0 }, frequency: makeParam(), connect() {} }
    }
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) }
    }
    createBufferSource() {
      return { buffer: null, connect() {}, start: () => started.push('noise'), stop() {} }
    }
  }

  globalThis.window = { AudioContext: FakeAudioContext }
  return started
}

async function freshSfx() {
  const started = installFakeAudio()
  // Cache-bust so `canPlay` is re-evaluated against the fake window in each
  // test rather than frozen from a previous import.
  const module = await import(`./sfx.js?t=${started.length}-${Math.random()}`)
  return { sfx: module.createSfx(), started }
}

test('no sound is produced before resume() - the gesture gate holds', async () => {
  const { sfx, started } = await freshSfx()
  sfx.footstep()
  sfx.kill()
  sfx.meeting()
  sfx.startAmbient()
  assert.equal(started.length, 0)
  assert.equal(sfx.isRunning(), false)
})

test('resume() brings the context up and reports it', async () => {
  const { sfx } = await freshSfx()
  sfx.resume()
  assert.equal(sfx.isRunning(), true)
})

test('every effect actually creates a sound source once resumed', async () => {
  const effects = ['footstep', 'taskProgress', 'taskDone', 'kill', 'death', 'vent', 'meeting', 'vote', 'eject', 'win', 'lose']
  for (const effect of effects) {
    const { sfx, started } = await freshSfx()
    sfx.resume()
    started.length = 0
    sfx[effect]()
    assert.ok(started.length > 0, `${effect}() produced no sound source`)
  }
})

test('the ambient bed starts once and is not stacked on repeat calls', async () => {
  const { sfx, started } = await freshSfx()
  sfx.resume()
  started.length = 0
  sfx.startAmbient()
  const first = started.length
  assert.ok(first > 0, 'ambient produced no sources')
  sfx.startAmbient()
  assert.equal(started.length, first, 'ambient was started twice')
})

test('confirmUnlock plays once and only after the context exists', async () => {
  const { sfx, started } = await freshSfx()
  sfx.confirmUnlock()
  assert.equal(started.length, 0, 'confirmUnlock played before resume')

  sfx.resume()
  started.length = 0
  sfx.confirmUnlock()
  assert.ok(started.length > 0, 'confirmUnlock produced no sound')

  const after = started.length
  sfx.confirmUnlock()
  assert.equal(started.length, after, 'confirmUnlock repeated')
})
