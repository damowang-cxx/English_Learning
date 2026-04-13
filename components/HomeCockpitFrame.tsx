const SIDE_TICKS = Array.from({ length: 7 }, (_, index) => index)
const SPEED_LINES = Array.from({ length: 5 }, (_, index) => index)

export default function HomeCockpitFrame() {
  return (
    <div className="home-cockpit-frame fixed inset-0 z-[4] pointer-events-none" aria-hidden="true">
      <span className="home-cockpit-frame__backwash" />
      <span className="home-cockpit-frame__top-glow" />

      <div className="home-cockpit-frame__top-beam">
        <span className="home-cockpit-frame__top-core" />
        <span className="home-cockpit-frame__top-runway home-cockpit-frame__top-runway--left" />
        <span className="home-cockpit-frame__top-runway home-cockpit-frame__top-runway--right" />
      </div>

      <span className="home-cockpit-frame__corner home-cockpit-frame__corner--tl" />
      <span className="home-cockpit-frame__corner home-cockpit-frame__corner--tr" />
      <span className="home-cockpit-frame__corner home-cockpit-frame__corner--bl" />
      <span className="home-cockpit-frame__corner home-cockpit-frame__corner--br" />

      {(['left', 'right'] as const).map((side) => (
        <div key={side} className={`home-cockpit-frame__side home-cockpit-frame__side--${side}`}>
          <span className="home-cockpit-frame__side-shell" />
          <span className="home-cockpit-frame__side-inner" />
          <span className="home-cockpit-frame__side-valve" />
          <span className="home-cockpit-frame__side-anchor home-cockpit-frame__side-anchor--top" />
          <span className="home-cockpit-frame__side-anchor home-cockpit-frame__side-anchor--bottom" />
          <span className="home-cockpit-frame__tick-bank">
            {SIDE_TICKS.map((tick) => (
              <span key={tick} className="home-cockpit-frame__tick" />
            ))}
          </span>
          <span className="home-cockpit-frame__speed-field">
            {SPEED_LINES.map((line) => (
              <span key={line} className="home-cockpit-frame__speed-line" />
            ))}
          </span>
        </div>
      ))}

      <div className="home-cockpit-frame__bottom-rail">
        <span className="home-cockpit-frame__bottom-core" />
        <span className="home-cockpit-frame__bottom-ridge home-cockpit-frame__bottom-ridge--left" />
        <span className="home-cockpit-frame__bottom-ridge home-cockpit-frame__bottom-ridge--right" />
        <span className="home-cockpit-frame__bottom-keel" />
        <span className="home-cockpit-frame__bottom-socket" />
        <span className="home-cockpit-frame__bottom-orbit home-cockpit-frame__bottom-orbit--left" />
        <span className="home-cockpit-frame__bottom-orbit home-cockpit-frame__bottom-orbit--right" />
        <span className="home-cockpit-frame__bottom-scan" />
      </div>
    </div>
  )
}
