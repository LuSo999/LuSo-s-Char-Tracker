import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adjustHp, rollDeathSave, setDeathSaves, setHp, setTempHp } from '../../engine/actions'
import { useRun, useSheet } from './context'
import { Editable } from './Editable'
import { breakdown, signed } from './format'
import { NumberAdjust } from './NumberAdjust'
import { Term } from '../rules/Term'

function Stat({ icon, label, value, title, accent, term }: { icon: string; label: string; value: React.ReactNode; title?: string; accent?: boolean; term?: string }) {
  return (
    <div className="framed-sm rounded-card border border-border bg-card px-3 py-2 text-center shadow-sm" title={title}>
      <div className="text-[11px] font-semibold uppercase text-muted">
        <span aria-hidden>{icon} </span>
        {term ? <Term id={term}>{label}</Term> : label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${accent ? 'text-accent' : ''}`}>{value}</div>
    </div>
  )
}

export function Vitals() {
  const { t } = useTranslation()
  const { character, sheet } = useSheet()
  const run = useRun()
  const { current, temp } = character.hp
  const max = sheet.hpMax.value
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const bloodied = current <= Math.floor(max / 2)

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-[2.2fr_1fr_1fr_1fr_1.4fr]">
      <div className="framed-sm col-span-3 rounded-card border border-border bg-card px-3 py-2 shadow-sm sm:col-span-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase text-muted" title={breakdown(sheet.hpMax)}>
            <span aria-hidden>❤️ </span>
            <Term id="rule-hit-points">{t('sheet.hitPoints')}</Term>
          </span>
          <span className="flex items-center gap-1 text-xs text-sky-700 dark:text-sky-300">
            <span aria-hidden>💠</span> <Term id="rule-temporary-hit-points">{t('sheet.tempHp')}</Term>
            <NumberAdjust
              label={t('sheet.tempHp')}
              value={temp}
              valueClassName="font-semibold"
              onSet={(v) => void run(setTempHp(character, v))}
              onDelta={(d) => void run(setTempHp(character, temp + d))}
            />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <NumberAdjust
            label={t('sheet.hitPoints')}
            value={current}
            valueClassName="text-2xl font-semibold"
            onSet={(v) => void run(setHp(character, sheet, v))}
            onDelta={(d) => void run(adjustHp(character, sheet, d))}
          />
          <span className="text-base text-muted">
            / <Editable value={sheet.hpMax} overrideKey="hpMax" label={t('sheet.hpMax')} />
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded bg-border">
          <div className={`h-full ${bloodied ? 'bg-danger' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Stat icon="🛡️" label="AC" term="rule-armor-class" value={<Editable value={sheet.ac} overrideKey="ac" label="AC" />} />
      <Stat icon="⚡" label={t('sheet.initiative')} term="rule-initiative" value={<Editable value={sheet.initiative} overrideKey="initiative" label={t('sheet.initiative')} format={signed} />} />
      <Stat icon="👣" label={t('sheet.speed')} term="rule-speed" value={<Editable value={sheet.speed} overrideKey="speed" label={t('sheet.speed')} format={(n) => `${n} ft`} />} />
      <DeathSaves />
    </div>
  )
}

/** Death saves: roll a d20 at 0 HP and the app applies the result; circles can also be set by hand. */
function DeathSaves() {
  const { t } = useTranslation()
  const { character } = useSheet()
  const run = useRun()
  const [roll, setRoll] = useState('')
  const { successes, failures } = character.deathSaves
  const dying = character.hp.current === 0
  const status = failures >= 3 ? 'dead' : successes >= 3 ? 'stable' : dying ? 'dying' : undefined
  const statusText = { dead: `💀 ${t('sheet.dead')}`, stable: `🛡️ ${t('sheet.stable')}`, dying: `⚠️ ${t('sheet.dying')}` }

  const submit = async () => {
    const n = Number.parseInt(roll, 10)
    if (await run(rollDeathSave(character, n))) setRoll('')
  }

  return (
    <div className={`framed-sm col-span-3 rounded-card border bg-card px-3 py-2 shadow-sm sm:col-span-1 ${dying ? 'border-danger ring-2 ring-danger/30' : 'border-border'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase text-muted">
          <span aria-hidden>💀 </span>
          <Term id="rule-death-saving-throw">{t('sheet.deathSaves')}</Term>
        </span>
        {status && <span className={`text-xs font-semibold ${status === 'stable' ? 'text-emerald-700 dark:text-emerald-300' : 'text-danger'}`}>{statusText[status]}</span>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <DeathRow label="✓" title={t('sheet.successes')} filled={successes} className="bg-emerald-600" onSet={(n) => void run(setDeathSaves(character, n, failures))} />
          <DeathRow label="✗" title={t('sheet.failures')} filled={failures} className="bg-danger" onSet={(n) => void run(setDeathSaves(character, successes, n))} />
        </div>
        {status === 'dying' && (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <input
              inputMode="numeric"
              aria-label={t('sheet.deathSaveRoll')}
              placeholder="🎲 d20"
              className="w-16 rounded border border-danger bg-card px-1 text-center text-sm"
              value={roll}
              onChange={(e) => setRoll(e.target.value.replace(/\D/g, ''))}
            />
            <button type="submit" className="rounded bg-danger px-2 py-0.5 text-sm font-semibold text-white disabled:opacity-50" disabled={!roll}>
              {t('sheet.roll')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function DeathRow({ label, title, filled, className, onSet }: { label: string; title: string; filled: number; className: string; onSet: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-sm" title={title}>
      <span className="w-3 text-muted">{label}</span>
      {[0, 1, 2].map((i) => (
        <button
          key={i}
          aria-label={`${title} ${i + 1}`}
          className={`h-5 w-5 rounded-full border-2 border-border ${i < filled ? className : 'hover:bg-bg'}`}
          // Clicking a filled circle clears it and those after it; an empty one fills up to it.
          onClick={() => onSet(i < filled ? i : i + 1)}
        />
      ))}
    </div>
  )
}
