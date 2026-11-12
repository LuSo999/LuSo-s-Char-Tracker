import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { castOptions, castSpell, type CastHow } from '../../engine/spellActions'
import type { SpellRow } from '../../engine/spells'
import { fx } from '../fx/fx'
import { useSettings } from '../../state/settings'
import { useRun, useSheet } from '../sheet/context'
import { rememberTurn, slotFree, snapshotTurn, useTurn } from '../sheet/turn'

type TFn = TFunction

const howLabel = (how: CastHow, t: TFn, pactLevel?: number) =>
  how.kind === 'slot'
    ? t('spells.castAt', { level: how.level })
    : how.kind === 'pact'
      ? t('spells.castPact', { level: pactLevel })
      : how.kind === 'free'
        ? `🎁 ${t('spells.castFree')}`
        : how.kind === 'ritual'
          ? `📿 ${t('spells.castRitual')}`
          : t('spells.cast')

/** Slot choice for casting: every slot level the spell can use, Pact slots, a free cast, or a ritual. */
export function CastPrompt({ row, onDone }: { row: SpellRow; onDone: (cast: boolean) => void }) {
  const { t } = useTranslation()
  const { character, sheet } = useSheet()
  const run = useRun()
  const options = castOptions(row, sheet)
  const left = (key: string) => sheet.resources.find((r) => r.key === key)?.remaining ?? 0

  const mode = useSettings((s) => s.turnMode)

  async function cast(how: CastHow) {
    const before = snapshotTurn()
    const group = await run(castSpell(character, sheet, row, how))
    if (group) {
      fx('magic')
      // Casting time spends the matching turn slot, wherever the spell was cast from (rituals take minutes, no slot).
      const type = row.spell.actionType
      if (mode !== 'off' && how.kind !== 'ritual' && type !== 'other') {
        if (!slotFree(useTurn.getState(), type)) useTurn.getState().flashSlot(type)
        useTurn.getState().use(type)
        rememberTurn(group.id, before)
      }
    }
    onDone(!!group)
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded border border-violet-500/60 bg-violet-500/5 p-2 text-sm">
      <span className="font-semibold">✨ {row.spell.name}:</span>
      {options.length === 0 && <span className="text-danger">{t('spells.noSlots')}</span>}
      {options.map((how, i) => (
        <button
          key={i}
          className="rounded border border-violet-500/60 px-2 py-0.5 hover:bg-violet-500/10"
          onClick={() => void cast(how)}
          title={how.kind === 'ritual' ? t('spells.ritualHint') : undefined}
        >
          {howLabel(how, t, sheet.spellcasting.pact?.level)}
          {how.kind === 'slot' && <span className="ml-1 text-xs text-muted">({left(`slot:${how.level}`)})</span>}
          {how.kind === 'pact' && <span className="ml-1 text-xs text-muted">({left('pact')})</span>}
        </button>
      ))}
      <button className="text-muted underline" onClick={() => onDone(false)}>
        {t('cancel')}
      </button>
    </div>
  )
}
