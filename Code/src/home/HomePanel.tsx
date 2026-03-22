import { useEffect, useState } from 'react'
import {
  formatWeatherError,
  getCurrentPosition,
  getGreetingText,
  resolveCityName,
  weatherCodeToTheme,
  weatherCodeToView,
  type WeatherReadyState,
  type WeatherState,
} from './weather'

type OpenMeteoForecastResponse = {
  current?: {
    temperature_2m?: number
    weather_code?: number
  }
  daily?: {
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
  }
}

const CLOCK_REFRESH_INTERVAL_MS = 60 * 1000

const HOME_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const WEATHER_UPDATED_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function HomePanel() {
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState<WeatherState>({
    status: 'loading',
    message: 'Loading weather...',
  })
  const [lastReadyWeather, setLastReadyWeather] = useState<WeatherReadyState | null>(null)
  const [weatherReloadToken, setWeatherReloadToken] = useState(0)
  const greeting = getGreetingText(now)
  const timeText = HOME_TIME_FORMATTER.format(now)
  const visibleWeather = weather.status === 'ready' ? weather : lastReadyWeather
  const weatherThemeClass =
    weather.status === 'ready'
      ? `is-${weatherCodeToTheme(weather.weatherCode)}`
      : visibleWeather
        ? `is-${weatherCodeToTheme(visibleWeather.weatherCode)}`
        : 'is-neutral'
  const tempLabel = visibleWeather ? `${visibleWeather.temperature}°C` : '--°C'
  const conditionLabel = visibleWeather?.condition ?? '--'
  const iconLabel = visibleWeather?.icon ?? '--'
  const cardLocationLabel = visibleWeather?.location ?? '--'
  const highLowLabel = `H ${visibleWeather?.high ?? '--'}° / L ${visibleWeather?.low ?? '--'}°`
  const updatedLabel = visibleWeather ? `Updated ${visibleWeather.updatedAt}` : 'Updated --'
  const hasPlaceholder = !visibleWeather
  const weatherStatusMessage = weather.status === 'error' ? weather.message : ''
  const locationLabel =
    weather.status === 'ready'
      ? weather.location
      : visibleWeather
        ? visibleWeather.location
        : weather.status === 'error'
          ? 'Location unavailable'
          : 'Locating...'

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, CLOCK_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadWeather = async () => {
      setWeather({
        status: 'loading',
        message: 'Locating and fetching weather...',
      })
      try {
        const position = await getCurrentPosition()
        if (cancelled) {
          return
        }
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude

        const forecastResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
          { signal: controller.signal },
        )
        if (!forecastResponse.ok) {
          throw new Error('Weather service is unavailable.')
        }
        const forecastData = (await forecastResponse.json()) as OpenMeteoForecastResponse
        const currentTemp = forecastData.current?.temperature_2m
        if (typeof currentTemp !== 'number') {
          throw new Error('Incomplete weather data.')
        }
        const weatherCode = forecastData.current?.weather_code ?? -1
        const weatherView = weatherCodeToView(weatherCode)
        const high = forecastData.daily?.temperature_2m_max?.[0]
        const low = forecastData.daily?.temperature_2m_min?.[0]

        const locationText = await resolveCityName(latitude, longitude, controller.signal)
        if (cancelled) {
          return
        }
        const nextWeather: WeatherReadyState = {
          status: 'ready',
          location: locationText,
          temperature: Math.round(currentTemp),
          high: typeof high === 'number' ? Math.round(high) : null,
          low: typeof low === 'number' ? Math.round(low) : null,
          condition: weatherView.condition,
          icon: weatherView.icon,
          weatherCode,
          updatedAt: WEATHER_UPDATED_FORMATTER.format(new Date()),
        }
        setWeather(nextWeather)
        setLastReadyWeather(nextWeather)
      } catch (error) {
        if (cancelled) {
          return
        }
        setWeather({
          status: 'error',
          message: formatWeatherError(error),
        })
      }
    }

    void loadWeather()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [weatherReloadToken])

  return (
    <div className="detail__panel detail__home" role="region" aria-label="Home">
      <div className="home-grid">
        <section className="home-card home-hero">
          <div className="home-hero__tag">{greeting}</div>
          <h2 className="home-hero__title">Hello Lee</h2>
          <p className="home-hero__time">{timeText}</p>
          <div className="home-hero__meta">
            <span>{locationLabel}</span>
          </div>
        </section>

        <section
          className={`home-card home-weather ${weatherThemeClass}`}
          aria-live="polite"
        >
          <div className="home-card__top">
            <h3 className="home-card__title">Weather</h3>
            <button
              type="button"
              className="home-action"
              onClick={() => setWeatherReloadToken((value) => value + 1)}
              disabled={weather.status === 'loading'}
              aria-label="Refresh weather"
              title="Refresh weather"
            >
              {weather.status === 'loading' ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
          <div className={`home-weather__main ${hasPlaceholder ? 'is-placeholder' : ''}`}>
            <span className="home-weather__icon" aria-hidden="true">{iconLabel}</span>
            <div>
              <div className="home-weather__temp">{tempLabel}</div>
              <div className="home-weather__condition">{conditionLabel}</div>
            </div>
          </div>
          <div className="home-weather__meta">
            <span>{cardLocationLabel}</span>
            <span>{highLowLabel}</span>
            <span>{updatedLabel}</span>
          </div>
          {weatherStatusMessage ? (
            <p className={`home-weather__status ${weather.status === 'error' ? 'is-error' : ''}`}>
              {weatherStatusMessage}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}

export default HomePanel
