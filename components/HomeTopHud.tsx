'use client'

import { useEffect, useState } from 'react'
import { FUTURE_TECH_FONT_CLASSNAME } from '@/lib/training-fonts'

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
      <span className="home-top-hud__backwash" aria-hidden="true" />
      <span className="home-top-hud__ambient home-top-hud__ambient--left" aria-hidden="true" />
      <span className="home-top-hud__ambient home-top-hud__ambient--right" aria-hidden="true" />

      <div className="home-top-hud__plaque">
        <span className="home-top-hud__viewport" aria-hidden="true" />
        <span className="home-top-hud__glass" aria-hidden="true" />
        <span className="home-top-hud__frame home-top-hud__frame--top" aria-hidden="true" />
        <span className="home-top-hud__frame home-top-hud__frame--bottom" aria-hidden="true" />
        <span className="home-top-hud__side-panel home-top-hud__side-panel--left" aria-hidden="true" />
        <span className="home-top-hud__side-panel home-top-hud__side-panel--right" aria-hidden="true" />
        <span className="home-top-hud__corner home-top-hud__corner--tl" aria-hidden="true" />
        <span className="home-top-hud__corner home-top-hud__corner--tr" aria-hidden="true" />
        <span className="home-top-hud__corner home-top-hud__corner--bl" aria-hidden="true" />
        <span className="home-top-hud__corner home-top-hud__corner--br" aria-hidden="true" />
        <span className="home-top-hud__horizon" aria-hidden="true" />
        <time
          className={`${FUTURE_TECH_FONT_CLASSNAME} home-top-hud__clock`}
          dateTime={clockTime}
          aria-label={`Current time ${clockTime}`}
        >
          {clockTime}
        </time>
        <span className="home-top-hud__scan" aria-hidden="true" />
      </div>
    </div>
  )
}
