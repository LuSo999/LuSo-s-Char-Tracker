// The desktop app: three tabs (character → sheet, sheet → character, settings).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { luso } from './bridge'
import { ExportFlow } from './ExportFlow'
import { ImportFlow } from './ImportFlow'
import { Settings, type KeyStatus } from './Settings'

type Tab = 'export' | 'import' | 'settings'

export function App() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('export')
  const [status, setStatus] = useState<KeyStatus>()
  const refresh = () => void luso().keyStatus().then(setStatus)
  useEffect(refresh, [])
  const hasKey = !!status?.has
  const tabButton = (id: Tab, label: string) => (
    <button className={`rounded px-3 py-1.5 text-sm ${tab === id ? 'bg-accent font-semibold text-accent-text' : 'hover:bg-bg'}`} onClick={() => setTab(id)}>
      {label}
    </button>
  )
  return (
    <div className="mx-auto max-w-4xl p-4">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold">🎲 {t('desk.title')}</h1>
          <p className="text-xs text-muted">{t('desk.subtitle')}</p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {tabButton('export', `📄 ${t('desk.tabExport')}`)}
          {tabButton('import', `📥 ${t('desk.tabImport')}`)}
          {tabButton('settings', `⚙️ ${t('desk.tabSettings')}`)}
        </nav>
      </header>
      {/* Both flows stay mounted so switching tabs keeps their state. */}
      <div hidden={tab !== 'export'}>
        <ExportFlow hasKey={hasKey} />
      </div>
      <div hidden={tab !== 'import'}>
        <ImportFlow hasKey={hasKey} />
      </div>
      {tab === 'settings' && <Settings status={status} onChange={refresh} />}
    </div>
  )
}
