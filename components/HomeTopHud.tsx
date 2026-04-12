'use client'

import { useEffect, useState } from 'react'

function formatClockTime(date: Date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

export default function HomeTopHud() {
  const [clockTime, setClockTime] = useState('00:00:00')

  useEffect(() => {
    const updateClock = () => {
      setClockTime(formatClockTime(new Date()))
    }

    updateClock()
    const timer = window.setInterval(updateClock, 1000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="home-top-hud pointer-events-none fixed inset-x-0 top-0 z-[5] overflow-hidden">
      <span className="home-top-hud__nebula home-top-hud__nebula--left" />
      <span className="home-top-hud__nebula home-top-hud__nebula--right" />

      <div className="home-top-hud__plaque">
        <span className="home-top-hud__plaque-arc home-top-hud__plaque-arc--top" />
        <span className="home-top-hud__plaque-arc home-top-hud__plaque-arc--bottom" />
        <span className="home-top-hud__plaque-wing home-top-hud__plaque-wing--left" />
        <span className="home-top-hud__plaque-wing home-top-hud__plaque-wing--right" />
        <span className="home-top-hud__plaque-shell" />
        <span className="home-top-hud__plaque-bloom" />
        <span className="home-top-hud__plaque-core" />
        <time className="home-top-hud__clock" dateTime={clockTime} aria-label={`Current time ${clockTime}`}>
          {clockTime}
        </time>
        <span className="home-top-hud__plaque-sheen" />
        <span className="home-top-hud__plaque-notch home-top-hud__plaque-notch--left" />
        <span className="home-top-hud__plaque-notch home-top-hud__plaque-notch--right" />
      </div>
    </div>
  )
}
