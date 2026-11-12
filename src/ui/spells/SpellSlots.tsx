import { useTranslation } from 'react-i18next'
import { setResourceRemaining } from '../../engine/actions'
import { useRun, useSheet } from '../sheet/context'
import { Dots } from '../sheet/common'

/**
 * Spell slots and Pact slots as squares (light blue = available, dark blue =
 * spent). Shown in the Resources panel and the Spellcasting panel. With
 * `interactive` a click spends or restores a slot.
 */
export function SpellSlots({ interactive, className = '' }: { interactive?: boolean; className?: string }) {
  const { t } = useTranslation()
  const { character, sheet } = useSheet()
  const run = useRun()
  const sc = sheet.spellcasting
  const state = (key: string) => sheet.resources.find((r) => r.key === key)
  const set = (key: string) => (interactive ? (n: number) => void run(setResourceRemaining(character, sheet, key, n)) : undefined)
  if (sc.slots.length === 0 && !sc.pact) return null
  const pact = sc.pact ? state('pact') : undefined
  return (
    <span className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      {sc.slots.map((s) => {
        const st = state(s.key)
        if (!st) return null
        return (
          <span key={s.key} className="flex items-center gap-1">
            <span className="text-xs text-muted">{s.level}.</span>
            <Dots slot remaining={st.remaining} max={st.max} label={`${t('spells.castAt', { level: s.level })}: ${st.remaining} / ${st.max}`} onSet={set(s.key)} />
          </span>
        )
      })}
      {sc.pact && pact && (
        <span className="flex items-center gap-1">
          <span className="text-xs text-muted">{t('spells.pactShort', { level: sc.pact.level })}</span>
          <Dots slot remaining={pact.remaining} max={pact.max} label={`${t('slots.pact', { level: sc.pact.level })}: ${pact.remaining} / ${pact.max}`} onSet={set('pact')} />
        </span>
      )}
    </span>
  )
}
