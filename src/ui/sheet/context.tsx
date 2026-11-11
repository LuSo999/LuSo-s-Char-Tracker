import { createContext, useContext, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import type { ActionResult } from '../../engine/actions'
import type { Character } from '../../engine/character'
import type { Sheet } from '../../engine/derive'
import { undoable, type CharacterStore } from '../../state/history'
import { groupSummary } from '../history/text'
import { toast } from '../toast'

export type SheetCtx = {
  character: Character
  sheet: Sheet
  content: ContentIndex
  store: CharacterStore
}

export const SheetContext = createContext<SheetCtx | null>(null)

export function useSheet(): SheetCtx {
  const ctx = useContext(SheetContext)
  if (!ctx) throw new Error('useSheet outside SheetContext')
  return ctx
}

/** Run an action: save it with its history group and offer a quick undo. */
export function useRun() {
  const { t } = useTranslation()
  const { store } = useSheet()
  // Toasts outlive renders; they must check the current history, not the one they were created with.
  const latest = useRef(store)
  useEffect(() => {
    latest.current = store
  })
  return async (result: ActionResult, opts: { quiet?: boolean } = {}) => {
    if (!result.ok) {
      if (result.error !== 'noChange') toast(t(`errors.${result.error}`, result.params ?? {}), { tone: 'error' })
      return false
    }
    const group = await store.commit(result)
    if (!opts.quiet) {
      toast(groupSummary(t, group), {
        key: 'undo',
        action: {
          label: t('undo'),
          run: () => {
            // Undo is a stack: only the newest change can be undone without overwriting later ones.
            if (undoable(latest.current.history)?.id !== group.id) return toast(t('errors.notLatest'), { tone: 'error' })
            void latest.current.undo(group)
          },
        },
      })
    }
    return true
  }
}
