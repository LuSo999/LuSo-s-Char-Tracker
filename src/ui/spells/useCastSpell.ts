import { useTranslation } from 'react-i18next'
import { castOptions, castSpell, defaultCast, type CastHow } from '../../engine/spellActions'
import type { SpellRow } from '../../engine/spells'
import { useSettings } from '../../state/settings'
import { fx } from '../fx/fx'
import { useRun, useSheet } from '../sheet/context'
import { rememberTurn, slotFree, snapshotTurn, useTurn, type Slot } from '../sheet/turn'
import { toast } from '../toast'

/**
 * Casting: `cast(row, how)` pays the slot, records it (undo is in history),
 * plays the effect and spends the turn slot of the casting time — or `as`
 * (a different slot) / "ignore". `quickCast` picks the default way to cast.
 */
export function useCastSpell() {
  const { t } = useTranslation()
  const { character, sheet } = useSheet()
  const run = useRun()
  const mode = useSettings((s) => s.turnMode)

  async function cast(row: SpellRow, how: CastHow, as?: Slot | 'ignore', at?: { x: number; y: number }) {
    const before = snapshotTurn()
    const group = await run(castSpell(character, sheet, row, how))
    if (group) {
      fx('magic', at)
      // Casting time spends the matching turn slot, wherever the spell was cast from (rituals take minutes, no slot).
      const type = as && as !== 'ignore' ? as : row.spell.actionType
      if (mode !== 'off' && as !== 'ignore' && how.kind !== 'ritual' && type !== 'other') {
        if (!slotFree(useTurn.getState(), type)) useTurn.getState().flashSlot(type)
        useTurn.getState().use(type)
        rememberTurn(group.id, before)
      }
    }
    return !!group
  }

  async function quickCast(row: SpellRow, as?: Slot | 'ignore', at?: { x: number; y: number }) {
    const how = defaultCast(castOptions(row, sheet))
    if (!how) {
      fx('deny', at)
      toast(t('spells.noSlotsFor', { name: row.spell.name }), { tone: 'error' })
      return false
    }
    return cast(row, how, as, at)
  }

  return { cast, quickCast }
}

