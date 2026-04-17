'use client'

import { useEffect, useState } from 'react'
import { HOME_CLOCK_FONT_CLASSNAME } from '@/lib/training-fonts'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function padNumber(value: number, size: number) {
  return String(value).padStart(size, '0')
}

function getDayOfYear(date: Date) {
  const year = date.getFullYear()
  const today = Date.UTC(year, date.getMonth(), date.getDate())
  const yearStart = Date.UTC(year, 0, 1)

  return Math.floor((today - yearStart) / MS_PER_DAY) + 1
}

function formatCockpitTime(date: Date) {
  const year = padNumber(date.getFullYear(), 4)
  const day = padNumber(getDayOfYear(date), 3)
  const hours = padNumber(date.getHours(), 2)
  const minutes = padNumber(date.getMinutes(), 2)
  const seconds = padNumber(date.getSeconds(), 2)

  return {
    year,
    day,
    hours,
    minutes,
    seconds,
    display: `${year} / day ${day} / ${hours}:${minutes}:${seconds}`,
    dateTime: date.toISOString(),
    label: `Epoch year ${year}, accumulated day ${day}, time ${hours}:${minutes}:${seconds}`,
  }
}

export default function HomeCockpitChronometer() {
  const [time, setTime] = useState(() => ({
    year: '----',
    day: '---',
    hours: '--',
    minutes: '--',
    seconds: '--',
    display: '---- / day --- / --:--:--',
    dateTime: '',
    label: 'Syncing cockpit time',
  }))

  useEffect(() => {
    const updateClock = () => {
      setTime(formatCockpitTime(new Date()))
    }

    updateClock()
    const timer = window.setInterval(updateClock, 1000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <time
      className={`${HOME_CLOCK_FONT_CLASSNAME} home-cockpit-frame__chronometer`}
      dateTime={time.dateTime}
      aria-label={time.label}
      title={time.display}
    >
      <span className="home-cockpit-frame__chronometer-date">
        {time.year}
        <span className="home-cockpit-frame__chronometer-dot" aria-hidden="true" />
        DAY {time.day}
      </span>
      <span className="home-cockpit-frame__chronometer-time" aria-hidden="true">
        {time.hours}
        <span className="home-cockpit-frame__chronometer-separator">:</span>
        {time.minutes}
        <span className="home-cockpit-frame__chronometer-separator">:</span>
        <span className="home-cockpit-frame__chronometer-seconds">{time.seconds}</span>
      </span>
    </time>
  )
}
