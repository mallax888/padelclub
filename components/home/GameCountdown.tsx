'use client'

import { useEffect, useState } from 'react'

// The scoreboard flip clock on desktop Home: how long until the next game starts. Hours, minutes and seconds when it is under two
// days away; days, hours and minutes when it is further off. It starts from the server's clock so the first paint matches, then ticks.
const pad = (n: number): string => String(Math.max(0, n)).padStart(2, '0')

function Digits({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center" aria-hidden>
      <div className="flex gap-1.5 xl:gap-2">
        {value.split('').map((ch, i) => (
          <div key={i} className="relative flex items-center justify-center font-black text-[#f4f7ff] w-[54px] h-[78px] text-[58px] xl:w-[78px] xl:h-[108px] xl:text-[84px]"
            style={{ borderRadius: 14, background: 'linear-gradient(#1c2128 0 49%, #0f1318 50% 100%)', letterSpacing: '-0.02em', boxShadow: 'inset 0 0 0 1px #ffffff14, 0 14px 24px -12px #000' }}>
            <span className="absolute left-0 right-0" style={{ top: '50%', height: 3, marginTop: -1.5, background: '#05070a' }} />
            {ch}
          </div>
        ))}
      </div>
      <div className="mt-2.5 text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', color: '#9fb0c0' }}>{label}</div>
    </div>
  )
}
const Colon = () => <div aria-hidden className="font-black mt-2 xl:mt-3 text-[48px] xl:text-[70px]" style={{ color: '#d4f53c', lineHeight: 1 }}>:</div>

export default function GameCountdown({ startMs, nowMs }: { startMs: number; nowMs: number }) {
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const secs = Math.max(0, Math.floor((startMs - now) / 1000))
  const far = secs >= 48 * 3600
  const d = Math.floor(secs / 86400), h = Math.floor(secs / 3600) % 24, hAll = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, s = secs % 60
  const parts = far
    ? [{ v: pad(d), l: 'Days' }, { v: pad(h), l: 'Hours' }, { v: pad(m), l: 'Minutes' }]
    : [{ v: pad(hAll), l: 'Hours' }, { v: pad(m), l: 'Minutes' }, { v: pad(s), l: 'Seconds' }]
  const words = far ? `${d} days, ${h} hours and ${m} minutes` : `${hAll} hours, ${m} minutes and ${s} seconds`
  return (
    <div role="timer" aria-live="off" aria-label={`${words} until the game`} data-testid="game-countdown" className="flex items-start gap-3 xl:gap-4">
      <Digits value={parts[0].v} label={parts[0].l} /><Colon /><Digits value={parts[1].v} label={parts[1].l} /><Colon /><Digits value={parts[2].v} label={parts[2].l} />
    </div>
  )
}
