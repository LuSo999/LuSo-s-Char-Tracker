import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../state/settings'
import { themeById, themes } from '../themes'
import { applyTheme, useThemeOverride } from './theme'

/** Keeps the page in the account's theme, or the open character's own. */
export function ThemeApplier() {
  const account = useSettings((s) => s.theme)
  const override = useThemeOverride((s) => s.id)
  useEffect(() => applyTheme(override ?? account), [account, override])
  return null
}

/**
 * Theme tiles: System, Light, Dark and the illustrated themes. With `inherit`
 * (a character) the first tile means "use the account's theme".
 */
export function ThemePicker({ value, onChange, inherit }: { value: string | undefined; onChange: (id: string | undefined) => void; inherit?: string }) {
  const { t } = useTranslation()
  const tile = (selected: boolean) =>
    `relative flex h-20 flex-col justify-end overflow-hidden rounded-card border-2 p-1.5 text-left text-xs font-semibold ${selected ? 'border-accent ring-2 ring-accent/40' : 'border-border hover:border-accent/60'}`
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {inherit !== undefined && (
        <button className={`${tile(value === undefined)} bg-bg`} onClick={() => onChange(undefined)}>
          <span>{t('theme.account', { name: themeById(inherit)?.name ?? t('theme.system') })}</span>
        </button>
      )}
      <button className={`${tile(value === 'system')} bg-[linear-gradient(135deg,#f4f1ea_50%,#15130f_50%)]`} onClick={() => onChange('system')}>
        <span className="rounded bg-card/90 px-1">{t('theme.system')}</span>
      </button>
      {themes.map((th) => (
        <button
          key={th.id}
          className={tile(value === th.id)}
          style={{ backgroundColor: th.colors.bg, backgroundImage: th.background ? `url("${th.background}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
          onClick={() => onChange(th.id)}
        >
          <span className="flex items-center gap-1 rounded px-1" style={{ background: th.colors.card, color: th.colors.text }}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: th.colors.accent }} />
            {th.name}
          </span>
        </button>
      ))}
    </div>
  )
}
