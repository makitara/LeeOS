import { useEffect, useState } from 'react'

const CLOCK_REFRESH_INTERVAL_MS = 60 * 1000

const HOME_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const getGreetingText = (now: Date) => {
  const hour = now.getHours()
  if (hour < 6) {
    return 'Late night'
  }
  if (hour < 12) {
    return 'Good morning'
  }
  if (hour < 18) {
    return 'Good afternoon'
  }
  return 'Good evening'
}

function HomePanel() {
  const [now, setNow] = useState(() => new Date())
  const greeting = getGreetingText(now)
  const timeText = HOME_TIME_FORMATTER.format(now)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, CLOCK_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="detail__panel detail__home" role="region" aria-label="Home">
      <div className="home-grid">
        <section className="home-card home-hero">
          <div className="home-hero__tag">{greeting}</div>
          <h2 className="home-hero__title">Hello Lee</h2>
          <p className="home-hero__time">{timeText}</p>
          <div className="home-hero__meta">
            <span>Home</span>
          </div>
        </section>
      </div>
    </div>
  )
}

export default HomePanel
