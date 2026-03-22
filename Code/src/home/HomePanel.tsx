import { useEffect, useState } from 'react'
import {
  formatWeatherError,
  getGeolocationPermissionState,
  getGreetingText,
  getInitialWeatherState,
  hasWeatherPermissionOnboardingBeenSeen,
  loadWeather as loadWeatherData,
  markWeatherPermissionOnboardingSeen,
  readCachedWeather,
  shouldRefreshCachedWeather,
  weatherCodeToTheme,
  type GeolocationPermissionState,
  type WeatherReadyState,
  type WeatherState,
} from './weather'

const CLOCK_REFRESH_INTERVAL_MS = 60 * 1000
const WEATHER_AUTO_REFRESH_INTERVAL_MS = 20 * 60 * 1000

const HOME_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function HomePanel() {
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState<WeatherState>(() => getInitialWeatherState())
  const [lastReadyWeather, setLastReadyWeather] = useState<WeatherReadyState | null>(() => readCachedWeather())
  const [permissionState, setPermissionState] = useState<GeolocationPermissionState>('prompt')
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
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
    let cancelled = false

    const bootstrapWeatherPermission = async () => {
      const nextPermissionState = await getGeolocationPermissionState()
      if (cancelled) {
        return
      }
      setPermissionState(nextPermissionState)
      const hasSeenOnboarding = hasWeatherPermissionOnboardingBeenSeen()
      setShowPermissionPrompt(!hasSeenOnboarding && nextPermissionState !== 'granted')
    }

    void bootstrapWeatherPermission()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, CLOCK_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (showPermissionPrompt) {
      return undefined
    }
    if (!['granted', 'unsupported'].includes(permissionState)) {
      return undefined
    }
    const timer = window.setInterval(() => {
      setWeatherReloadToken((value) => value + 1)
    }, WEATHER_AUTO_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [permissionState, showPermissionPrompt])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const refreshWeather = async () => {
      const cachedWeather = readCachedWeather()
      const isForcedReload = weatherReloadToken > 0
      if (cachedWeather) {
        setLastReadyWeather(cachedWeather)
      }
      if (!isForcedReload && !shouldRefreshCachedWeather(cachedWeather)) {
        if (cachedWeather) {
          setWeather(cachedWeather)
        }
        return
      }
      setWeather({
        status: 'loading',
        message: cachedWeather ? 'Refreshing weather...' : 'Locating and fetching weather...',
      })
      try {
        const nextWeather = await loadWeatherData(controller.signal)
        if (cancelled) {
          return
        }
        setWeather(nextWeather)
        setLastReadyWeather(nextWeather)
        const nextPermissionState = await getGeolocationPermissionState()
        if (!cancelled) {
          setPermissionState(nextPermissionState)
        }
      } catch (error) {
        if (cancelled) {
          return
        }
        setWeather({
          status: 'error',
          message: formatWeatherError(error),
        })
        const nextPermissionState = await getGeolocationPermissionState()
        if (!cancelled) {
          setPermissionState(nextPermissionState)
        }
      }
    }

    if (weatherReloadToken === 0 && (showPermissionPrompt || !['granted', 'unsupported'].includes(permissionState))) {
      return () => {
        cancelled = true
        controller.abort()
      }
    }

    void refreshWeather()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [permissionState, showPermissionPrompt, weatherReloadToken])

  const handleEnableLocation = () => {
    markWeatherPermissionOnboardingSeen()
    setShowPermissionPrompt(false)
    setWeatherReloadToken((value) => value + 1)
  }

  const handleDismissPermissionPrompt = () => {
    markWeatherPermissionOnboardingSeen()
    setShowPermissionPrompt(false)
  }

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
          {showPermissionPrompt ? (
            <div className="home-weather__overlay" role="dialog" aria-labelledby="home-weather-permission-title" aria-modal="false">
              <div className="home-weather__overlay-card">
                <h4 id="home-weather-permission-title">Enable local weather</h4>
                <p>Allow location access once so Home can show your local weather after the app is installed.</p>
                <div className="home-weather__overlay-actions">
                  <button type="button" className="home-action" onClick={handleEnableLocation}>
                    Allow location
                  </button>
                  <button type="button" className="home-action home-action--ghost" onClick={handleDismissPermissionPrompt}>
                    Not now
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

export default HomePanel
