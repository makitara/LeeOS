import { useEffect, useRef, useState } from 'react'
import type { PluginEntry } from './env'
import HomePanel from './home/HomePanel'
import { LEEOS_METHOD, type LeeOSMethod } from './shared/capabilities'
import './App.css'

type PluginFrameInfo = {
  iframe: HTMLIFrameElement
  pluginId: string
  origin: string
}

const DEFAULT_REQUEST_TIMEOUT_MS = 3_000
const HOME_PLUGIN_ID = 'leeos:home'
const HOME_SIDEBAR_ITEM = {
  id: HOME_PLUGIN_ID,
  name: 'Home',
  icon: '◎',
} as const

const REQUEST_TIMEOUT_MS: Partial<Record<LeeOSMethod, number>> = {
  [LEEOS_METHOD.pluginsList]: DEFAULT_REQUEST_TIMEOUT_MS,
  [LEEOS_METHOD.fsReadText]: DEFAULT_REQUEST_TIMEOUT_MS,
  [LEEOS_METHOD.fsReadJson]: DEFAULT_REQUEST_TIMEOUT_MS,
  [LEEOS_METHOD.fsReadDir]: DEFAULT_REQUEST_TIMEOUT_MS,
  [LEEOS_METHOD.fsOpenDir]: 5_000,
  [LEEOS_METHOD.fsOpenFile]: 5_000,
  [LEEOS_METHOD.fsWriteText]: 8_000,
  [LEEOS_METHOD.fsWriteJson]: 8_000,
  [LEEOS_METHOD.fsDelete]: 8_000,
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

function App() {
  const [plugins, setPlugins] = useState<PluginEntry[]>([])
  const [activePluginId, setActivePluginId] = useState(HOME_PLUGIN_ID)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const frameLookupCache = useRef(new WeakMap<object, PluginFrameInfo>())
  const currentPluginId = activePluginId === HOME_PLUGIN_ID || plugins.some((plugin) => plugin.id === activePluginId)
    ? activePluginId
    : HOME_PLUGIN_ID
  const sidebarItems = [HOME_SIDEBAR_ITEM, ...plugins]

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
    const requestTimeoutMs = payload.method
      ? REQUEST_TIMEOUT_MS[payload.method as LeeOSMethod] ?? DEFAULT_REQUEST_TIMEOUT_MS
      : DEFAULT_REQUEST_TIMEOUT_MS
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
          {currentPluginId === HOME_PLUGIN_ID ? <HomePanel /> : null}
          {currentPluginId !== HOME_PLUGIN_ID ? (
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
