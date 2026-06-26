let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return audioCtx
}

export function playSelectionSound() {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime

    // Main tone — deep bass pop
    const o1 = ctx.createOscillator()
    const g1 = ctx.createGain()
    o1.type = 'sine'
    o1.frequency.setValueAtTime(120, now)
    o1.frequency.exponentialRampToValueAtTime(28, now + 0.35)
    g1.gain.setValueAtTime(0.22, now)
    g1.gain.setValueAtTime(0.24, now + 0.005)
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    o1.connect(g1); g1.connect(ctx.destination)
    o1.start(); o1.stop(now + 0.35)

    // Sub harmonic
    const o2 = ctx.createOscillator()
    const g2 = ctx.createGain()
    o2.type = 'sine'
    o2.frequency.setValueAtTime(60, now)
    o2.frequency.exponentialRampToValueAtTime(14, now + 0.35)
    g2.gain.setValueAtTime(0.13, now)
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    o2.connect(g2); g2.connect(ctx.destination)
    o2.start(); o2.stop(now + 0.28)

    // Noise transient
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.025, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005))
    const src = ctx.createBufferSource()
    src.buffer = buf
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = 300
    nf.Q.value = 1.2
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.25, now)
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.025)
    src.connect(nf); nf.connect(ng); ng.connect(ctx.destination)
    src.start(); src.stop(now + 0.025)
  } catch (e) {
    // Silently fail if audio not supported
  }
}
