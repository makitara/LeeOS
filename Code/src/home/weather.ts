export type WeatherReadyState = {
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

export type CachedWeatherReadyState = WeatherReadyState & {
  fetchedAt: number
}

export type WeatherState =
  | { status: 'loading'; message: string }
  | WeatherReadyState
  | { status: 'error'; message: string }

export type GeolocationPermissionState = PermissionState | 'unsupported'

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

type WeatherRule = {
  matches: (code: number) => boolean
  condition: string
  icon: string
  theme: string
}

const GEOLOCATION_TIMEOUT_MS = 8_000
const GEOLOCATION_MAX_AGE_MS = 10 * 60 * 1000
const WEATHER_REFRESH_INTERVAL_MS = 20 * 60 * 1000
const WEATHER_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000
const WEATHER_CACHE_KEY = 'leeos:home-weather-cache:v1'
export const MISSING_GEOLOCATION_API_KEY_MESSAGE =
  'Home weather is not configured for this build. Add VITE_GOOGLE_API_KEY and rebuild.'
const WEATHER_UPDATED_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const WEATHER_RULES: WeatherRule[] = [
  { matches: (code) => code === 0, condition: 'Clear', icon: '☀️', theme: 'clear' },
  { matches: (code) => code === 1 || code === 2, condition: 'Mostly Clear', icon: '🌤️', theme: 'clear' },
  { matches: (code) => code === 3, condition: 'Cloudy', icon: '☁️', theme: 'cloudy' },
  { matches: (code) => code === 45 || code === 48, condition: 'Foggy', icon: '🌫️', theme: 'fog' },
  { matches: (code) => code >= 51 && code <= 57, condition: 'Drizzle', icon: '🌦️', theme: 'rain' },
  {
    matches: (code) => (code >= 61 && code <= 67) || (code >= 80 && code <= 82),
    condition: 'Rain',
    icon: '🌧️',
    theme: 'rain',
  },
  {
    matches: (code) => (code >= 71 && code <= 77) || code === 85 || code === 86,
    condition: 'Snow',
    icon: '🌨️',
    theme: 'snow',
  },
  {
    matches: (code) => code >= 95 && code <= 99,
    condition: 'Thunderstorm',
    icon: '⛈️',
    theme: 'storm',
  },
]

const FALLBACK_WEATHER_RULE = {
  condition: 'Unknown',
  icon: '🌡️',
  theme: 'neutral',
} as const

let weatherCache: CachedWeatherReadyState | null = null

const getCurrentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this environment.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: GEOLOCATION_TIMEOUT_MS,
      maximumAge: GEOLOCATION_MAX_AGE_MS,
    })
  })

const getWeatherRule = (code: number) => {
  return WEATHER_RULES.find((rule) => rule.matches(code)) ?? FALLBACK_WEATHER_RULE
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

export const formatWeatherError = (error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error) {
    const geoError = error as GeolocationPositionError
    if (geoError.code === geoError.PERMISSION_DENIED) {
      return 'Location permission was denied. Please allow LeeOS in system settings.'
    }
    if (geoError.code === geoError.POSITION_UNAVAILABLE) {
      return 'Current location is unavailable. Check your network or geolocation API key, then try again.'
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

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const isValidCachedWeather = (value: unknown): value is CachedWeatherReadyState => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<CachedWeatherReadyState>
  return (
    candidate.status === 'ready'
    && typeof candidate.location === 'string'
    && typeof candidate.temperature === 'number'
    && (typeof candidate.high === 'number' || candidate.high === null)
    && (typeof candidate.low === 'number' || candidate.low === null)
    && typeof candidate.condition === 'string'
    && typeof candidate.icon === 'string'
    && typeof candidate.weatherCode === 'number'
    && typeof candidate.updatedAt === 'string'
    && typeof candidate.fetchedAt === 'number'
  )
}

const persistWeatherCache = (value: CachedWeatherReadyState) => {
  weatherCache = value
  if (!canUseStorage()) {
    return
  }
  try {
    window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(value))
  } catch {
    // Ignore storage write failures.
  }
}

export const readCachedWeather = () => {
  if (weatherCache) {
    return weatherCache
  }
  if (!canUseStorage()) {
    return null
  }
  try {
    const raw = window.localStorage.getItem(WEATHER_CACHE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as unknown
    if (!isValidCachedWeather(parsed)) {
      return null
    }
    weatherCache = parsed
    return parsed
  } catch {
    return null
  }
}

export const shouldRefreshCachedWeather = (cached: CachedWeatherReadyState | null, now = Date.now()) => {
  if (!cached) {
    return true
  }
  return now - cached.fetchedAt >= WEATHER_REFRESH_INTERVAL_MS
}

export const getGeolocationPermissionState = async (): Promise<GeolocationPermissionState> => {
  const permissionsApi = navigator.permissions
  if (!permissionsApi?.query) {
    return 'unsupported'
  }
  try {
    const status = await permissionsApi.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'unsupported'
  }
}

export const weatherCodeToView = (code: number) => {
  const { condition, icon } = getWeatherRule(code)
  return { condition, icon }
}

export const weatherCodeToTheme = (code: number) => {
  return getWeatherRule(code).theme
}

export const resolveCityName = async (latitude: number, longitude: number, signal: AbortSignal) => {
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

export const getGreetingText = (now: Date) => {
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

export const loadWeather = async (signal: AbortSignal): Promise<WeatherReadyState> => {
  const position = await getCurrentPosition()
  const latitude = position.coords.latitude
  const longitude = position.coords.longitude

  const forecastResponse = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
    { signal },
  )
  if (!forecastResponse.ok) {
    throw new Error('Weather service is unavailable.')
  }
  const forecastData = (await forecastResponse.json()) as {
    current?: {
      temperature_2m?: number
      weather_code?: number
    }
    daily?: {
      temperature_2m_max?: number[]
      temperature_2m_min?: number[]
    }
  }
  const currentTemp = forecastData.current?.temperature_2m
  if (typeof currentTemp !== 'number') {
    throw new Error('Incomplete weather data.')
  }

  const weatherCode = forecastData.current?.weather_code ?? -1
  const weatherView = weatherCodeToView(weatherCode)
  const high = forecastData.daily?.temperature_2m_max?.[0]
  const low = forecastData.daily?.temperature_2m_min?.[0]
  const location = await resolveCityName(latitude, longitude, signal)

  const nextWeather: WeatherReadyState = {
    status: 'ready',
    location,
    temperature: Math.round(currentTemp),
    high: typeof high === 'number' ? Math.round(high) : null,
    low: typeof low === 'number' ? Math.round(low) : null,
    condition: weatherView.condition,
    icon: weatherView.icon,
    weatherCode,
    updatedAt: WEATHER_UPDATED_FORMATTER.format(new Date()),
  }

  persistWeatherCache({
    ...nextWeather,
    fetchedAt: Date.now(),
  })

  return nextWeather
}

export const getInitialWeatherState = (): WeatherState => {
  const cached = readCachedWeather()
  if (!cached) {
    return {
      status: 'loading',
      message: 'Loading weather...',
    }
  }
  if (Date.now() - cached.fetchedAt > WEATHER_CACHE_MAX_AGE_MS) {
    return {
      status: 'loading',
      message: 'Refreshing weather...',
    }
  }
  return cached
}

export { getCurrentPosition }
