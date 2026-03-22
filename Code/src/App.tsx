import { useEffect, useState } from 'react'
import type { PluginEntry } from './env'
import HomePanel from './home/HomePanel'
import DetailPanel from './plugin-host/DetailPanel'
import usePluginBridge from './plugin-host/usePluginBridge'
import SidebarItem, { type SidebarNavItem } from './shell/SidebarItem'
import './App.css'

const HOME_PLUGIN_ID = 'leeos:home'
const HOME_SIDEBAR_ITEM = {
  id: HOME_PLUGIN_ID,
  name: 'Home',
  icon: '◎',
} as const

function App() {
  const [plugins, setPlugins] = useState<PluginEntry[]>([])
  const [activePluginId, setActivePluginId] = useState(HOME_PLUGIN_ID)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  usePluginBridge()
  const currentPluginId = activePluginId === HOME_PLUGIN_ID || plugins.some((plugin) => plugin.id === activePluginId)
    ? activePluginId
    : HOME_PLUGIN_ID
  const sidebarItems: SidebarNavItem[] = [HOME_SIDEBAR_ITEM, ...plugins]

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

  return (
    <main className="app-shell">
      <div className="shell-titlebar" aria-hidden="true" />
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

export default App
