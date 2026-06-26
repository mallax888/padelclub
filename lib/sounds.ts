let audioCtx: AudioContext | null = null
function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return audioCtx
}
export function playSelectionSound() {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.07)
    g.gain.setValueAtTime(0.12, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    osc.connect(g); g.connect(ctx.destination)
    osc.start(); osc.stop(now + 0.12)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.006))
    const src = ctx.createBufferSource()
    src.buffer = buf
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.08, now)
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
    src.connect(ng); ng.connect(ctx.destination)
    src.start(); src.stop(now + 0.04)
  } catch (e) {}
}