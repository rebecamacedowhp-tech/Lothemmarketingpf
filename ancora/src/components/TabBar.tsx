export type TabId = 'inicio' | 'gatilhos' | 'diario' | 'terapia'

type TabBarProps = {
  active: TabId
  onChange: (tab: TabId) => void
}

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Início', icon: '⚓' },
  { id: 'gatilhos', label: 'Gatilhos', icon: '⚡' },
  { id: 'diario', label: 'Diário', icon: '✎' },
  { id: 'terapia', label: 'Terapia', icon: '↗' },
]

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label="Navegação principal">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tabbar__item${active === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          <span className="tabbar__icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span className="tabbar__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
