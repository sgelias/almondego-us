// All sound is synthesised with the Web Audio API rather than loaded from
// files - same reasoning as the procedural textures: no build step, no asset
// pipeline, nothing to fetch.
//
// Browsers refuse to start an AudioContext without a user gesture. If one is
// created at module load it stays suspended and every later sound silently
// does nothing, which is indistinguishable from "audio is broken". So the
// context is created lazily by resume(), which main.js calls from the
// pointer-lock overlay click - a real gesture that already exists.

const canPlay = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)

export function createSfx() {
  let ctx = null
  let master = null
  let ambientGain = null

  function resume() {
    if (!canPlay) return
    if (!ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext
      ctx = new AudioCtor()
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') ctx.resume()
  }

  function envelope(node, peak, attack, decay) {
    const now = ctx.currentTime
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(0.0001, now)
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack)
    node.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay)
  }

  function tone({ type = 'sine', from, to = from, peak = 0.25, attack = 0.01, decay = 0.2, delay = 0 }) {
    if (!ctx) return
    const start = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, start)
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + attack + decay)

    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay)

    osc.connect(gain)
    gain.connect(master)
    osc.start(start)
    osc.stop(start + attack + decay + 0.05)
  }

  // Short burst of filtered noise - the basis for footsteps and whooshes.
  function noiseBurst({ duration = 0.2, peak = 0.2, filterFrom = 900, filterTo = 900, q = 1, delay = 0 }) {
    if (!ctx) return
    const start = ctx.currentTime + delay
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration))
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = q
    filter.frequency.setValueAtTime(filterFrom, start)
    if (filterTo !== filterFrom) filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterTo), start + duration)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + duration * 0.15)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start(start)
    source.stop(start + duration + 0.05)
  }

  let stepToggle = false

  return {
    resume,

    // Alternating pitch so consecutive steps read as left/right rather than
    // one sound on repeat.
    footstep() {
      if (!ctx) return
      stepToggle = !stepToggle
      noiseBurst({ duration: 0.11, peak: 0.06, filterFrom: stepToggle ? 380 : 300, filterTo: 150, q: 1.4 })
    },

    taskProgress() {
      tone({ type: 'square', from: 620, peak: 0.05, attack: 0.005, decay: 0.06 })
    },

    taskDone() {
      tone({ type: 'square', from: 700, peak: 0.12, attack: 0.01, decay: 0.1 })
      tone({ type: 'square', from: 1050, peak: 0.12, attack: 0.01, decay: 0.16, delay: 0.1 })
    },

    kill() {
      tone({ type: 'sawtooth', from: 220, to: 40, peak: 0.3, attack: 0.005, decay: 0.55 })
      noiseBurst({ duration: 0.4, peak: 0.22, filterFrom: 1800, filterTo: 120, q: 0.8 })
    },

    death() {
      tone({ type: 'sine', from: 160, to: 55, peak: 0.3, attack: 0.02, decay: 1.4 })
    },

    vent() {
      noiseBurst({ duration: 0.5, peak: 0.2, filterFrom: 300, filterTo: 2600, q: 2 })
      noiseBurst({ duration: 0.45, peak: 0.14, filterFrom: 2400, filterTo: 260, q: 2, delay: 0.16 })
    },

    // Two-tone alarm, repeated - the "everyone to the cafeteria" cue.
    meeting() {
      for (let i = 0; i < 3; i += 1) {
        tone({ type: 'square', from: 740, peak: 0.16, attack: 0.01, decay: 0.22, delay: i * 0.44 })
        tone({ type: 'square', from: 560, peak: 0.16, attack: 0.01, decay: 0.22, delay: i * 0.44 + 0.22 })
      }
    },

    vote() {
      tone({ type: 'triangle', from: 480, peak: 0.14, attack: 0.005, decay: 0.12 })
    },

    eject() {
      noiseBurst({ duration: 0.9, peak: 0.2, filterFrom: 1400, filterTo: 90, q: 0.7 })
      tone({ type: 'sine', from: 300, to: 60, peak: 0.2, attack: 0.03, decay: 0.9 })
    },

    win() {
      const notes = [523, 659, 784, 1047]
      notes.forEach((f, i) => tone({ type: 'triangle', from: f, peak: 0.18, attack: 0.02, decay: 0.45, delay: i * 0.13 }))
    },

    lose() {
      const notes = [392, 330, 262, 196]
      notes.forEach((f, i) => tone({ type: 'sawtooth', from: f, peak: 0.16, attack: 0.03, decay: 0.5, delay: i * 0.16 }))
    },

    // A continuous low hum so the ship never feels dead silent.
    startAmbient() {
      if (!ctx || ambientGain) return
      ambientGain = ctx.createGain()
      ambientGain.gain.value = 0.035
      ambientGain.connect(master)

      for (const freq of [55, 82.5]) {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.value = freq
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 180
        osc.connect(filter)
        filter.connect(ambientGain)
        osc.start()
      }

      // Slow wobble so the drone doesn't sit perfectly static.
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfo.frequency.value = 0.13
      lfoGain.gain.value = 0.012
      lfo.connect(lfoGain)
      lfoGain.connect(ambientGain.gain)
      lfo.start()
    },
  }
}
