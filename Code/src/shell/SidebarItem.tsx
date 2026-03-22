export type SidebarNavItem = {
  id: string
  name: string
  icon?: string
  iconUrl?: string
}

type SidebarItemProps = {
  item: SidebarNavItem
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

export default SidebarItem
