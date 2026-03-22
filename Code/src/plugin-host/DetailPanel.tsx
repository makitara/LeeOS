import type { PluginEntry } from '../env'
import PluginFrame from './PluginFrame'

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

export default DetailPanel
