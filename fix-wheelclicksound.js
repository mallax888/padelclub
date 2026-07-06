const fs = require('fs');
const path = 'lib/sounds.ts';
let c = fs.readFileSync(path, 'utf8');

const newFunction = `
export function playWheelClick() {
  try {
    const c = getCtx()
    const now = c.currentTime
    const bufLen = Math.floor(c.sampleRate * 0.015)
    const buf = c.createBuffer(1, bufLen, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.06))
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2500
    filter.Q.value = 2.5
    const g = c.createGain()
    g.gain.setValueAtTime(0.3, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.02)
    src.connect(filter); filter.connect(g); g.connect(c.destination)
    src.start()

    const o = c.createOscillator()
    const og = c.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(700, now)
    og.gain.setValueAtTime(0.06, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.015)
    o.connect(og); og.connect(c.destination)
    o.start(); o.stop(now + 0.015)
  } catch (e) {}
}
`;

c = c + newFunction;
fs.writeFileSync(path, c, 'utf8');
console.log('playWheelClick added:', c.includes('export function playWheelClick'));
