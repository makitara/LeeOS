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

export type WeatherState =
  | { status: 'loading'; message: string }
  | WeatherReadyState
  | { status: 'error'; message: string }

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

export { getCurrentPosition }
