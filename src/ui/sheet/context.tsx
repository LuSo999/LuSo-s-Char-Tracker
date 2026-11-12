import { createContext, useContext, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import type { ActionResult, HistoryItem } from '../../engine/actions'
import type { Character } from '../../engine/character'
import type { Sheet } from '../../engine/derive'
import type { HistoryGroup } from '../../engine/history'
import { undoable, type CharacterStore } from '../../state/history'
import { fx } from '../fx/fx'
import { groupSummary } from '../history/text'
import { toast } from '../toast'
import { restoreTurnFor } from './turn'

export type SheetCtx = {
  character: Character
  sheet: Sheet
  /** Content with the character's own names / summaries / links applied. */
  content: ContentIndex
  /** Content as the rules have it (for "reset to original"). */
  baseContent: ContentIndex
  store: CharacterStore
  /** A copy being edited (Level up): actions apply to it without toasts or effects. */
  draft?: boolean
}

export const SheetContext = createContext<SheetCtx | null>(null)

export function useSheet(): SheetCtx {
  const ctx = useContext(SheetContext)
  if (!ctx) throw new Error('useSheet outside SheetContext')
  return ctx
}

const num = (v: HistoryItem['before']) => (typeof v === 'number' ? v : 0)

/** The screen-edge effect that matches what a change did to the character. */
function effectFor(groupType: string, items: HistoryItem[]) {
  if (groupType === 'shortRest') return fx('shortRest')
  if (groupType === 'longRest') return fx('longRest')
  if (items.some((i) => i.type === 'dead')) return fx('death')
  if (items.some((i) => i.type === 'stable')) return fx('stable')
  const hp = items.find((i) => i.type === 'damage' || i.type === 'heal' || i.type === 'setHp')
  if (hp && num(hp.after) < num(hp.before)) return fx('damage')
  if (items.some((i) => i.type === 'deathSaveFailure' || (i.type === 'deathSaveFailures' && num(i.after) > num(i.before)))) return fx('damage')
  if (hp && num(hp.after) > num(hp.before)) return fx('heal')
  const temp = items.find((i) => i.type === 'tempHp')
  if (temp && num(temp.after) > num(temp.before)) return fx('temp')
  if (temp && num(temp.after) < num(temp.before)) return fx('damage')
}

/** Undo the newest change, including the turn tracker. Undo plays no effects. */
export function undoGroup(store: CharacterStore, group: HistoryGroup) {
  void store.undo(group)
  restoreTurnFor(group.id)
}

/** Run an action: save it with its history group, play its effect and offer a quick undo. */
export function useRun() {
  const { t } = useTranslation()
  const { store, draft } = useSheet()
  // Toasts outlive renders; they must check the current history, not the one they were created with.
  const latest = useRef(store)
  useEffect(() => {
    latest.current = store
  })
  return async (result: ActionResult, opts: { quiet?: boolean; actionId?: string } = {}): Promise<HistoryGroup | undefined> => {
    if (!result.ok) {
      if (result.error !== 'noChange') {
        toast(t(`errors.${result.error}`, result.params ?? {}), { tone: 'error' })
        fx('deny')
      }
      return undefined
    }
    const group = await store.commit(result, { actionId: opts.actionId })
    if (draft) return group
    effectFor(result.groupType, result.items)
    const check = result.items.find((i) => i.type === 'concentrationCheck')
    if (check) toast(`🔮 ${t('spells.concentrationSave', { dc: check.params?.dc, name: check.params?.name })}`, { tone: 'error', key: 'concentration' })
    if (!opts.quiet) {
      toast(groupSummary(t, group), {
        key: 'undo',
        action: {
          label: t('undo'),
          run: () => {
            // Undo is a stack: only the newest change can be undone without overwriting later ones.
            if (undoable(latest.current.history)?.id !== group.id) return toast(t('errors.notLatest'), { tone: 'error' })
            undoGroup(latest.current, group)
          },
        },
      })
    }
    return group
  }
}
