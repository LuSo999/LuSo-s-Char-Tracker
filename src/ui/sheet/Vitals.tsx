import { useTranslation } from 'react-i18next'
import type { Character } from '../../engine/character'
import type { Sheet } from '../../engine/derive'
import { breakdown, signed } from './format'

function Stat({ label, value, title, accent }: { label: string; value: React.ReactNode; title?: string; accent?: boolean }) {
  return (
    <div className="rounded-card border border-border bg-card px-3 py-2 text-center shadow-sm" title={title}>
      <div className="text-[11px] font-semibold uppercase text-muted">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${accent ? 'text-accent' : ''}`}>{value}</div>
    </div>
  )
}

export function Vitals({ character, sheet }: { character: Character; sheet: Sheet }) {
  const { t } = useTranslation()
  const { current, temp } = character.hp
  const max = sheet.hpMax.value
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const bloodied = current <= Math.floor(max / 2)

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_1.4fr]">
      <div className="col-span-3 rounded-card border border-border bg-card px-3 py-2 shadow-sm sm:col-span-1" title={breakdown(sheet.hpMax)}>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase text-muted">{t('sheet.hitPoints')}</span>
          {temp > 0 && <span className="text-xs font-semibold text-sky-600 dark:text-sky-300">+{temp} temp</span>}
        </div>
        <div className="text-2xl font-semibold tabular-nums">
          {current} <span className="text-base text-muted">/ {max}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded bg-border">
          <div className={`h-full ${bloodied ? 'bg-danger' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Stat label="AC" value={sheet.ac.value} title={breakdown(sheet.ac)} accent={sheet.ac.overridden} />
      <Stat label={t('sheet.initiative')} value={signed(sheet.initiative.value)} title={breakdown(sheet.initiative)} />
      <Stat label={t('sheet.speed')} value={`${sheet.speed.value} ft`} title={breakdown(sheet.speed)} />
      <div className="col-span-3 rounded-card border border-border bg-card px-3 py-2 shadow-sm sm:col-span-1">
        <div className="text-[11px] font-semibold uppercase text-muted">{t('sheet.deathSaves')}</div>
        <DeathRow label="✓" filled={character.deathSaves.successes} className="bg-emerald-600" />
        <DeathRow label="✗" filled={character.deathSaves.failures} className="bg-danger" />
      </div>
    </div>
  )
}

function DeathRow({ label, filled, className }: { label: string; filled: number; className: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="w-3 text-muted">{label}</span>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-3 w-3 rounded-full border border-border ${i < filled ? className : ''}`} />
      ))}
    </div>
  )
}
