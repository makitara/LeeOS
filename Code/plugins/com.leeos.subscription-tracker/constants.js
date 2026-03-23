;(() => {
      const FILE_DATA = 'tracker-data.json'
      const FILE_README = 'README.md'
      const FILE_SUBS_LEGACY = 'subscriptions.json'
      const FILE_CATS_LEGACY = 'categories.json'
      const DND_CATEGORY = 'application/x-leeos-category'
      const DND_SUB = 'application/x-leeos-sub'


      const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
      const todayIso = () => new Date().toISOString().slice(0, 10)
      const normalizeIsoDate = (input, fallback = '') => {
        const raw = String(input || '').trim()
        if (!raw) return fallback

        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (iso) {
          const value = `${iso[1]}-${iso[2]}-${iso[3]}`
          const parsed = new Date(`${value}T00:00:00`)
          return Number.isNaN(parsed.getTime()) ? fallback : value
        }

        const slash = raw.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/)
        if (slash) {
          const month = String(Number(slash[2])).padStart(2, '0')
          const day = String(Number(slash[3])).padStart(2, '0')
          const value = `${slash[1]}-${month}-${day}`
          const parsed = new Date(`${value}T00:00:00`)
          return Number.isNaN(parsed.getTime()) ? fallback : value
        }

        const parsed = new Date(raw)
        if (Number.isNaN(parsed.getTime())) return fallback
        return parsed.toISOString().slice(0, 10)
      }
      const addDaysIso = (baseIso, days) => {
        const d = new Date(baseIso)
        d.setDate(d.getDate() + days)
        return d.toISOString().slice(0, 10)
      }
      const diffDays = (fromIso, toIso) => {
        const from = new Date(fromIso)
        const to = new Date(toIso)
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return Infinity
        return Math.floor((to.getTime() - from.getTime()) / 86400000)
      }
      const esc = (v) => String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;')

      const normalizeUrl = (v) => {
        const raw = String(v || '').trim()
        if (!raw) return ''
        return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      }

      const parseDomain = (urlLike) => {
        try { return new URL(normalizeUrl(urlLike)).hostname.replace(/^www\./, '') } catch { return '' }
      }

      const normalizePrice = (value) => {
        if (value === null || value === undefined) return null
        const raw = String(value).trim()
        if (!raw) return null
        const parsed = Number(raw)
        if (!Number.isFinite(parsed) || parsed < 0) return null
        return parsed
      }
      const normalizeCurrency = (value, fallback = 'CNY') => {
        const next = String(value || fallback).trim().toUpperCase().slice(0, 8)
        return next || fallback
      }

      const MAX_ICON_SIZE_BYTES = 2 * 1024 * 1024
      const FAVICON_CACHE_TTL_MS = 30 * 1000
      const DEFAULT_RENEWAL_WINDOW_DAYS = 30
      const ALLOWED_ICON_TYPES = new Set([
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'image/x-icon',
        'image/vnd.microsoft.icon',
      ])
      const faviconCache = new Map()
      const isAllowedIconFile = (file) => {
        const type = String(file?.type || '').toLowerCase()
        if (type && ALLOWED_ICON_TYPES.has(type)) return true
        return /\.(png|jpe?g|webp|gif|ico)$/i.test(String(file?.name || ''))
      }
      const sanitizeIconDataUrl = (value) => {
        const raw = String(value || '').trim()
        if (!raw) return ''
        if (!raw.startsWith('data:image/')) return ''
        if (raw.startsWith('data:image/svg+xml')) return ''
        if (raw.length > 3_500_000) return ''
        return raw
      }
      const getCachedFavicon = (domain) => {
        const key = String(domain || '').trim().toLowerCase()
        if (!key) return undefined
        const cached = faviconCache.get(key)
        if (!cached) return undefined
        if (Date.now() > cached.expiresAt) {
          faviconCache.delete(key)
          return undefined
        }
        return cached.src
      }
      const setCachedFavicon = (domain, src) => {
        const key = String(domain || '').trim().toLowerCase()
        if (!key) return
        faviconCache.set(key, {
          src: typeof src === 'string' && src ? src : null,
          expiresAt: Date.now() + FAVICON_CACHE_TTL_MS,
        })
      }
      const fileToDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Failed to read icon file.'))
        reader.readAsDataURL(file)
      })

      const DEFAULT_ICON_SVG = "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 5.2l1.9 3.9 3.9 1.9-3.9 1.9-1.9 3.9-1.9-3.9-3.9-1.9 3.9-1.9z'></path></svg>"
      const defaultIconMarkup = () => `<span class="default-icon" aria-hidden="true">${DEFAULT_ICON_SVG}</span>`

      const daysUntil = (iso) => {
        const a = new Date(todayIso())
        const b = new Date(iso)
        if (Number.isNaN(b.getTime())) return Infinity
        return Math.floor((b.getTime() - a.getTime()) / 86400000)
      }

      const legacyCycleDays = (s) => {
        if (s.billingCycle === 'yearly') return 365
        if (s.billingCycle === 'custom_days') return Math.max(1, Math.floor(Number(s.customDays) || 30))
        return 30
      }

      const resolveDateRange = (s) => {
        let startDate = normalizeIsoDate(s.startDate, '')
        let endDate = normalizeIsoDate(s.endDate || s.nextBillingDate, '')
        if (!startDate && endDate) {
          startDate = addDaysIso(endDate, -legacyCycleDays(s))
        }
        if (startDate && endDate && startDate > endDate) {
          const temp = startDate
          startDate = endDate
          endDate = temp
        }
        return { startDate, endDate }
      }

      const progress = (s) => {
        const { startDate, endDate } = resolveDateRange(s)
        if (!endDate) return { leftText: '-', pct: 100, scheduled: false, overdue: false }
        const left = daysUntil(endDate)
        if (!Number.isFinite(left)) return { leftText: '-', pct: 100, scheduled: false, overdue: false }
        if (left <= 0) return { leftText: `${left}d`, pct: 100, scheduled: true, overdue: true }
        if (!startDate) return { leftText: `${left}d`, pct: 0, scheduled: true, overdue: false }
        const totalDays = Math.max(1, diffDays(startDate, endDate))
        const elapsedDays = Math.max(0, Math.min(totalDays, diffDays(startDate, todayIso())))
        const pct = Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)))
        return { leftText: `${left}d`, pct, scheduled: true, overdue: false }
      }

      const resolveCardStatus = (s, p) => {
        if (s.status === 'cancelled') return 'cancelled'
        if (p.overdue) return 'expired'
        return 'active'
      }

      const normalizeRenewalRecord = (record) => {
        if (!record || typeof record !== 'object') return null
        const amount = normalizePrice(record.amount)
        const startDate = normalizeIsoDate(record.startDate, '')
        const endDate = normalizeIsoDate(record.endDate, '')
        if (amount === null || !startDate || !endDate || startDate > endDate) return null
        return {
          id: typeof record.id === 'string' && record.id ? record.id : uid('renew'),
          paidAt: normalizeIsoDate(record.paidAt, endDate || todayIso()),
          amount,
          currency: normalizeCurrency(record.currency),
          startDate,
          endDate,
        }
      }

      const summarizeRenewalHistory = (history) => {
        const normalized = Array.isArray(history)
          ? history
            .map((entry) => normalizeRenewalRecord(entry))
            .filter(Boolean)
            .sort((left, right) => {
              const leftKey = `${left.paidAt}|${left.endDate}|${left.id}`
              const rightKey = `${right.paidAt}|${right.endDate}|${right.id}`
              return rightKey.localeCompare(leftKey)
            })
          : []

        const totalSpent = normalized.reduce((sum, entry) => sum + entry.amount, 0)
        return {
          entries: normalized,
          lastEntry: normalized[0] || null,
          totalSpent,
          hasHistory: normalized.length > 0,
        }
      }

      const buildRenewalDraft = (subscription) => {
        const { startDate, endDate } = resolveDateRange(subscription)
        const cycleDays = startDate && endDate
          ? Math.max(1, diffDays(startDate, endDate))
          : DEFAULT_RENEWAL_WINDOW_DAYS
        const nextStartDate = endDate || todayIso()
        return {
          paidAt: todayIso(),
          amount: normalizePrice(subscription?.price),
          currency: normalizeCurrency(subscription?.currency),
          startDate: nextStartDate,
          endDate: addDaysIso(nextStartDate, cycleDays),
        }
      }

      const faviconSources = (domain, urlLike = '') => {
        const candidates = []
        const normalizedUrl = normalizeUrl(urlLike)
        let origin = ''
        try {
          origin = normalizedUrl ? new URL(normalizedUrl).origin : `https://${domain}`
        } catch {
          origin = `https://${domain}`
        }
        const pushCandidate = (value) => {
          const next = String(value || '').trim()
          if (!next || candidates.includes(next)) return
          candidates.push(next)
        }
        pushCandidate(`https://www.google.com/s2/favicons?sz=128&domain=${domain}`)
        pushCandidate(`${origin}/favicon.ico`)
        pushCandidate(`${origin}/apple-touch-icon.png`)
        pushCandidate(`${origin}/apple-touch-icon-precomposed.png`)
        pushCandidate(`https://icons.duckduckgo.com/ip3/${domain}.ico`)
        return candidates
      }

  window.LeeOSSubscriptionTrackerShared = Object.freeze({
    FILE_DATA,
    FILE_README,
    FILE_SUBS_LEGACY,
    FILE_CATS_LEGACY,
    DND_CATEGORY,
    DND_SUB,
    uid,
    todayIso,
    normalizeIsoDate,
    addDaysIso,
    esc,
    normalizeUrl,
    parseDomain,
    normalizePrice,
    normalizeCurrency,
    MAX_ICON_SIZE_BYTES,
    isAllowedIconFile,
    sanitizeIconDataUrl,
    getCachedFavicon,
    setCachedFavicon,
    fileToDataUrl,
    DEFAULT_ICON_SVG,
    defaultIconMarkup,
    daysUntil,
    resolveDateRange,
    progress,
    resolveCardStatus,
    normalizeRenewalRecord,
    summarizeRenewalHistory,
    buildRenewalDraft,
    faviconSources,
  })
})()
