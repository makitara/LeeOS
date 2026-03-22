import { useEffect, useRef, useState } from 'react'
import type { PluginEntry } from './env'
import { LEEOS_METHOD } from './shared/capabilities'
import './App.css'

type PluginFrameInfo = {
  iframe: HTMLIFrameElement
  pluginId: string
  origin: string
}

const resolvePluginFrameOrigin = (entryUrl?: string) => {
  if (!entryUrl) return ''
  try {
    const parsed = new URL(entryUrl)
    // Chromium may expose custom protocol origins as "null" in URL.origin.
    // For postMessage targeting and verification we derive a stable origin from protocol+host.
    if (parsed.protocol === 'leeos-plugin:') {
      return `${parsed.protocol}//${parsed.host}`
    }
    return parsed.origin
  } catch {
    return ''
  }
}

type WeatherReadyState = {
  status: 'ready'
  location: string
  temperature: number
  high: number | null
  low: number | null
  condition: string
  icon: string
  weatherCode: number
  updatedAt: string
}

type WeatherState =
  | { status: 'loading'; message: string }
  | WeatherReadyState
  | { status: 'error'; message: string }

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

type OpenMeteoReverseResponse = {
  results?: Array<{
    name?: string
    admin1?: string
    country?: string
  }>
}

type NominatimReverseResponse = {
  display_name?: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    city_district?: string
    suburb?: string
    borough?: string
    county?: string
    state_district?: string
    state?: string
    region?: string
  }
}

type BigDataCloudReverseResponse = {
  city?: string
  locality?: string
  principalSubdivision?: string
}

const getCurrentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this environment.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 10 * 60 * 1000,
    })
  })

const formatWeatherError = (error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error) {
    const geoError = error as GeolocationPositionError
    if (geoError.code === geoError.PERMISSION_DENIED) {
      return 'Location permission was denied. Please allow LeeOS in system settings.'
    }
    if (geoError.code === geoError.POSITION_UNAVAILABLE) {
      return 'Current location is unavailable. Please try again.'
    }
    if (geoError.code === geoError.TIMEOUT) {
      return 'Location request timed out. Please try again.'
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Failed to load weather. Please try again.'
}

const weatherCodeToView = (code: number) => {
  if (code === 0) {
    return { condition: 'Clear', icon: '☀️' }
  }
  if (code === 1 || code === 2) {
    return { condition: 'Mostly Clear', icon: '🌤️' }
  }
  if (code === 3) {
    return { condition: 'Cloudy', icon: '☁️' }
  }
  if (code === 45 || code === 48) {
    return { condition: 'Foggy', icon: '🌫️' }
  }
  if (code >= 51 && code <= 57) {
    return { condition: 'Drizzle', icon: '🌦️' }
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { condition: 'Rain', icon: '🌧️' }
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { condition: 'Snow', icon: '🌨️' }
  }
  if (code >= 95 && code <= 99) {
    return { condition: 'Thunderstorm', icon: '⛈️' }
  }
  return { condition: 'Unknown', icon: '🌡️' }
}

const weatherCodeToTheme = (code: number) => {
  if (code === 0 || code === 1 || code === 2) {
    return 'clear'
  }
  if (code === 3) {
    return 'cloudy'
  }
  if (code === 45 || code === 48) {
    return 'fog'
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return 'rain'
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return 'snow'
  }
  if (code >= 95 && code <= 99) {
    return 'storm'
  }
  return 'neutral'
}

const fallbackCoordinateLabel = (latitude: number, longitude: number) => {
  return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
}

const joinLocationParts = (...parts: Array<string | undefined>) => {
  const unique = new Set<string>()
  for (const part of parts) {
    const value = part?.trim()
    if (!value) {
      continue
    }
    unique.add(value)
  }
  return Array.from(unique).join(' · ')
}

const isDistrictLike = (value: string) => {
  return /(district|county|borough|suburb|ward|township)/i.test(value)
}

const getCityFromDisplayName = (displayName: string, district?: string) => {
  const tokens = displayName
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  if (tokens.length === 0) {
    return ''
  }
  if (district && tokens.length > 1) {
    const first = tokens[0].toLowerCase()
    const needle = district.toLowerCase()
    if (first.includes(needle)) {
      return tokens[1]
    }
  }
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (index === 0 && isDistrictLike(token)) {
      continue
    }
    if (isDistrictLike(token)) {
      continue
    }
    return token
  }
  return tokens[0]
}

const resolveCityName = async (latitude: number, longitude: number, signal: AbortSignal) => {
  let openMeteoCity = ''
  let openMeteoRegion = ''
  let districtOnly = ''

  try {
    const reverseResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&count=1&format=json`,
      { signal },
    )
    if (reverseResponse.ok) {
      const reverseData = (await reverseResponse.json()) as OpenMeteoReverseResponse
      const firstResult = reverseData.results?.[0]
      openMeteoCity = firstResult?.name?.trim() || ''
      openMeteoRegion = firstResult?.admin1?.trim() || ''
    }
  } catch {
    // Fall through to the next provider.
  }

  try {
    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
      { signal },
    )
    if (nominatimResponse.ok) {
      const data = (await nominatimResponse.json()) as NominatimReverseResponse
      const city = data.address?.city
        || data.address?.town
        || data.address?.village
        || data.address?.municipality
      const district = data.address?.city_district
        || data.address?.suburb
        || data.address?.borough
        || data.address?.county
      const fallbackRegion = data.address?.state_district || data.address?.state || data.address?.region
      if (city) {
        return joinLocationParts(city, district)
      }
      if (fallbackRegion) {
        return joinLocationParts(fallbackRegion, district)
      }
      if (data.display_name) {
        const cityFromDisplay = getCityFromDisplayName(data.display_name, district)
        if (cityFromDisplay) {
          return joinLocationParts(cityFromDisplay, district)
        }
      }
      if (district) {
        districtOnly = district
      }
    }
  } catch {
    // Ignore and fallback to coordinates.
  }

  try {
    const bdcResponse = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      { signal },
    )
    if (bdcResponse.ok) {
      const data = (await bdcResponse.json()) as BigDataCloudReverseResponse
      const city = data.city || data.locality
      if (city && districtOnly) {
        return joinLocationParts(city, districtOnly)
      }
      if (city) {
        return city
      }
      if (data.principalSubdivision && districtOnly) {
        return joinLocationParts(data.principalSubdivision, districtOnly)
      }
      if (data.principalSubdivision) {
        return data.principalSubdivision
      }
    }
  } catch {
    // Ignore and fallback to next candidate.
  }

  if (openMeteoCity && districtOnly) {
    return joinLocationParts(openMeteoCity, districtOnly)
  }
  if (openMeteoCity || openMeteoRegion) {
    return joinLocationParts(openMeteoCity, openMeteoRegion)
  }
  if (districtOnly) {
    return districtOnly
  }

  return fallbackCoordinateLabel(latitude, longitude)
}

const getGreetingText = (now: Date) => {
  const hour = now.getHours()
  if (hour < 6) {
    return '夜深了'
  }
  if (hour < 12) {
    return '早上好'
  }
  if (hour < 18) {
    return '下午好'
  }
  return '晚上好'
}

function App() {
  const [plugins, setPlugins] = useState<PluginEntry[]>([])
  const [activePluginId, setActivePluginId] = useState('leeos:home')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const frameLookupCache = useRef(new WeakMap<object, PluginFrameInfo>())
  const currentPluginId = activePluginId === 'leeos:home' || plugins.some((plugin) => plugin.id === activePluginId)
    ? activePluginId
    : 'leeos:home'
  const sidebarItems = [
    { id: 'leeos:home', name: 'Home', icon: '◎' },
    ...plugins,
  ]

  useEffect(() => {
    let isMounted = true
    window.LeeOS.plugins
      .list()
      .then((list) => {
        if (isMounted) {
          setPlugins(list)
        }
      })
      .catch(() => {
        if (isMounted) {
          setPlugins([])
        }
      })
    return () => {
      isMounted = false
    }
  }, [])

  const findPluginFrameBySource = (source: MessageEventSource | null): PluginFrameInfo | null => {
    if (!source || typeof source !== 'object') {
      return null
    }
    const cached = frameLookupCache.current.get(source)
    if (cached) {
      if (cached.iframe.isConnected && cached.iframe.contentWindow === source) {
        const pluginId = cached.iframe.dataset.pluginId ?? ''
        const origin = cached.iframe.dataset.pluginOrigin ?? ''
        if (pluginId && origin && pluginId === cached.pluginId && origin === cached.origin) {
          return cached
        }
      }
      frameLookupCache.current.delete(source)
    }
    const frames = Array.from(
      document.querySelectorAll<HTMLIFrameElement>('iframe[data-plugin-id][data-plugin-origin]'),
    )
    for (const iframe of frames) {
      if (iframe.contentWindow === source) {
        const pluginId = iframe.dataset.pluginId ?? ''
        const origin = iframe.dataset.pluginOrigin ?? ''
        if (pluginId && origin) {
          const frameInfo = { iframe, pluginId, origin }
          frameLookupCache.current.set(source, frameInfo)
          return frameInfo
        }
        return null
      }
    }
    return null
  }

  const postPluginMessage = (frame: PluginFrameInfo, message: Record<string, unknown>) => {
    frame.iframe.contentWindow?.postMessage(message, frame.origin)
  }

  const isAllowedPluginOrigin = (origin: string) => origin.startsWith('leeos-plugin://')

  const handlePluginRequest = async (payload: {
    pluginId: string
    requestId: string
    method?: string
    params?: unknown
  }) => {
    const getRequestTimeoutMs = (method?: string) => {
      switch (method) {
        case LEEOS_METHOD.pluginsList:
        case LEEOS_METHOD.fsReadText:
        case LEEOS_METHOD.fsReadJson:
        case LEEOS_METHOD.fsReadDir:
          return 3000
        case LEEOS_METHOD.fsOpenDir:
        case LEEOS_METHOD.fsOpenFile:
          return 5000
        case LEEOS_METHOD.fsWriteText:
        case LEEOS_METHOD.fsWriteJson:
        case LEEOS_METHOD.fsDelete:
          return 8000
        default:
          return 3000
      }
    }
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
      })
      try {
        return await Promise.race([
          promise.finally(() => {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
          }),
          timeout,
        ])
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }
    const paramsRecord = (value: unknown): Record<string, unknown> | null => {
      if (!value || typeof value !== 'object') {
        return null
      }
      return value as Record<string, unknown>
    }
    const params = paramsRecord(payload.params) ?? {}
    const requestTimeoutMs = getRequestTimeoutMs(payload.method)
    switch (payload.method) {
      case LEEOS_METHOD.pluginsList:
        return withTimeout(window.LeeOS.plugins.list().then((data) => ({ ok: true, data })), requestTimeoutMs)
      case LEEOS_METHOD.fsReadText: {
        const filePath = typeof params.path === 'string' ? params.path : ''
        if (!filePath) {
          return { ok: false, error: 'Invalid params', code: 'ERR_REQUEST_FAILED' }
        }
        return withTimeout(
          window.LeeOS.fs.readText(payload.pluginId, filePath).then((data) => ({ ok: true, data })),
          requestTimeoutMs,
        )
      }
      case LEEOS_METHOD.fsWriteText: {
        const filePath = typeof params.path === 'string' ? params.path : ''
        const content = typeof params.content === 'string' ? params.content : ''
        if (!filePath) {
          return { ok: false, error: 'Invalid params', code: 'ERR_REQUEST_FAILED' }
        }
        return withTimeout(
          window.LeeOS.fs
            .writeText(payload.pluginId, filePath, content)
            .then(() => ({ ok: true, data: null })),
          requestTimeoutMs,
        )
      }
      case LEEOS_METHOD.fsReadJson: {
        const filePath = typeof params.path === 'string' ? params.path : ''
        if (!filePath) {
          return { ok: false, error: 'Invalid params', code: 'ERR_REQUEST_FAILED' }
        }
        return withTimeout(
          window.LeeOS.fs.readJson(payload.pluginId, filePath).then((data) => ({ ok: true, data })),
          requestTimeoutMs,
        )
      }
      case LEEOS_METHOD.fsWriteJson: {
        const filePath = typeof params.path === 'string' ? params.path : ''
        if (!filePath) {
          return { ok: false, error: 'Invalid params', code: 'ERR_REQUEST_FAILED' }
        }
        return withTimeout(
          window.LeeOS.fs
            .writeJson(payload.pluginId, filePath, params.value)
            .then(() => ({ ok: true, data: null })),
          requestTimeoutMs,
        )
      }
      case LEEOS_METHOD.fsReadDir: {
        const directoryPath = typeof params.path === 'string' ? params.path : '.'
        return withTimeout(
          window.LeeOS.fs.readDir(payload.pluginId, directoryPath).then((data) => ({ ok: true, data })),
          requestTimeoutMs,
        )
      }
      case LEEOS_METHOD.fsDelete: {
        const targetPath = typeof params.path === 'string' ? params.path : ''
        if (!targetPath) {
          return { ok: false, error: 'Invalid params', code: 'ERR_REQUEST_FAILED' }
        }
        return withTimeout(
          window.LeeOS.fs.delete(payload.pluginId, targetPath).then(() => ({ ok: true, data: null })),
          requestTimeoutMs,
        )
      }
      case LEEOS_METHOD.fsOpenDir: {
        const directoryPath = typeof params.path === 'string' ? params.path : '.'
        return withTimeout(
          window.LeeOS.fs.openDir(payload.pluginId, directoryPath).then((data) => ({ ok: true, data })),
          requestTimeoutMs,
        )
      }
      case LEEOS_METHOD.fsOpenFile: {
        const filePath = typeof params.path === 'string' ? params.path : ''
        if (!filePath) {
          return { ok: false, error: 'Invalid params', code: 'ERR_REQUEST_FAILED' }
        }
        return withTimeout(
          window.LeeOS.fs.openFile(payload.pluginId, filePath).then((data) => ({ ok: true, data })),
          requestTimeoutMs,
        )
      }
      default:
        return {
          ok: false,
          error: 'Unsupported method',
          code: 'ERR_UNSUPPORTED_METHOD',
        }
    }
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') {
        return
      }
      const payload = event.data as {
        type?: string
        pluginId?: string
        requestId?: string
        method?: string
        params?: unknown
      }
      const frame = findPluginFrameBySource(event.source)
      if (!frame) {
        return
      }
      // 只要消息来源是当前 iframe，且 origin 属于 leeos-plugin://，允许 origin 为空/null 的浏览器实现
      const isSameSource = event.source === frame.iframe.contentWindow
      const isExpectedOrigin = event.origin === frame.origin || event.origin === 'null'
      if (!frame.origin || !isAllowedPluginOrigin(frame.origin) || !isSameSource || !isExpectedOrigin) {
        return
      }
      if (payload.type === 'LeeOS:ping') {
        if (payload.pluginId && payload.pluginId !== frame.pluginId) {
          return
        }
        postPluginMessage(frame, {
          type: 'LeeOS:pong',
          version: window.LeeOS?.version ?? '0.0.0',
        })
        return
      }
      if (payload.type === 'LeeOS:request' && typeof payload.requestId === 'string') {
        if (payload.pluginId && payload.pluginId !== frame.pluginId) {
          return
        }
        const requestId = payload.requestId.trim()
        if (!requestId) {
          return
        }
        void handlePluginRequest({
          pluginId: frame.pluginId,
          requestId,
          method: payload.method,
          params: payload.params,
        })
          .then((result) => {
            postPluginMessage(frame, {
              type: 'LeeOS:response',
              requestId,
              ...result,
            })
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : 'Request failed'
            const code = message === 'Request timed out' ? 'ERR_REQUEST_TIMEOUT' : 'ERR_REQUEST_FAILED'
            postPluginMessage(frame, {
              type: 'LeeOS:response',
              requestId,
              ok: false,
              error: message,
              code,
            })
          })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <main className="app-shell">
      <div className={`shell-layout ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
        <aside className={`sidebar ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
          <div className="sidebar__header">
            <span className="sidebar__brand">LeeOS</span>
            <button
              type="button"
              className="sidebar__toggle"
              onClick={() => setIsSidebarCollapsed((value) => !value)}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="sidebar__toggle-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </div>
          <nav className="sidebar__nav">
            {sidebarItems.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                isActive={currentPluginId === item.id}
                onSelect={() => setActivePluginId(item.id)}
              />
            ))}
          </nav>
        </aside>
        <section className="detail">
          {currentPluginId === 'leeos:home' ? <HomePanel /> : null}
          {currentPluginId !== 'leeos:home' ? (
            <DetailPanel key={currentPluginId} plugin={plugins.find((plugin) => plugin.id === currentPluginId)} />
          ) : null}
        </section>
      </div>
    </main>
  )
}

type DetailPanelProps = {
  plugin?: PluginEntry
}

function DetailPanel({ plugin }: DetailPanelProps) {
  if (!plugin) {
    return (
      <div className="detail__empty">
        <div className="detail__title">Plugin not found</div>
        <div className="detail__subtitle">Select a different plugin.</div>
      </div>
    )
  }

  if (plugin.entryUrl) {
    return (
      <div className="detail__plugin-host" role="region" aria-label={plugin.name}>
        <PluginFrame plugin={plugin} />
      </div>
    )
  }

  return (
    <div className="detail__panel" role="region" aria-label={plugin.name}>
      <div className="detail__header">
        <div className="detail__heading">
          {plugin.iconUrl ? (
            <img className="detail__icon" src={plugin.iconUrl} alt="" />
          ) : null}
          <span>{plugin.name}</span>
        </div>
        {plugin.description ? (
          <div className="detail__description">{plugin.description}</div>
        ) : null}
      </div>
      <div className="plugin-frame plugin-frame--missing">
        <div className="plugin-frame__placeholder">Missing plugin entry</div>
      </div>
    </div>
  )
}

type SidebarItemProps = {
  item: { id: string; name: string; icon?: string; iconUrl?: string }
  isActive: boolean
  onSelect: () => void
}

function SidebarItem({ item, isActive, onSelect }: SidebarItemProps) {
  return (
    <button type="button" className={`sidebar__item ${isActive ? 'is-active' : ''}`} onClick={onSelect}>
      <span className="sidebar__icon" aria-hidden="true">
        {item.iconUrl ? <img src={item.iconUrl} alt="" /> : item.icon ?? '⬡'}
      </span>
      <span className="sidebar__label">{item.name}</span>
    </button>
  )
}

function HomePanel() {
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState<WeatherState>({
    status: 'loading',
    message: 'Loading weather...',
  })
  const [lastReadyWeather, setLastReadyWeather] = useState<WeatherReadyState | null>(null)
  const [weatherReloadToken, setWeatherReloadToken] = useState(0)
  const greeting = getGreetingText(now)
  const timeText = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
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
    }, 60 * 1000)
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
          updatedAt: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
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


type PluginFrameProps = {
  plugin: PluginEntry
}

function PluginFrame({ plugin }: PluginFrameProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const origin = resolvePluginFrameOrigin(plugin.entryUrl)

  return (
    <div className="plugin-frame" role="presentation">
      {status === 'loading' ? (
        <div className="plugin-frame__placeholder">Loading…</div>
      ) : null}
      {status === 'error' ? (
        <div className="plugin-frame__placeholder">Plugin failed to load</div>
      ) : null}
      <iframe
        className="plugin-frame__inner"
        src={plugin.entryUrl}
        sandbox="allow-scripts allow-same-origin"
        title={plugin.name}
        data-plugin-id={plugin.id}
        data-plugin-origin={origin}
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
      />
    </div>
  )
}

export default App
