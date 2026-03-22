import { useState } from 'react'
import type { PluginEntry } from '../env'

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

export default PluginFrame
