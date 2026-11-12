// Sheet keyboard shortcuts: N = new turn, S = Spellcasting panel, I = inventory,
// C = end concentration, Shift+R = reset every filter, Ctrl+Z (⌘Z) = undo.
// Ignored while typing in a field (there Ctrl+Z undoes text).
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { endConcentration } from '../../engine/spellActions'
import { undoable } from '../../state/history'
import { useSettings } from '../../state/settings'
import { groupSummary } from '../history/text'
import { toast } from '../toast'
import { undoGroup, useRun, useSheet } from './context'
import { useTurn } from './turn'

const RESET = 'luso:reset-filters'

/** Ask every filter on the page to go back to its defaults. */
export const resetFilters = () => window.dispatchEvent(new Event(RESET))

/** Run `reset` when filters are reset (Shift+R). */
export function useOnResetFilters(reset: () => void) {
  useEffect(() => {
    window.addEventListener(RESET, reset)
    return () => window.removeEventListener(RESET, reset)
  }, [reset])
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

export function SheetShortcuts({ onSpells, onInventory }: { onSpells?: () => void; onInventory: () => void }) {
  const { t } = useTranslation()
  const { store, character } = useSheet()
  const run = useRun()
  const mode = useSettings((s) => s.turnMode)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || typing(e.target)) return
      const key = e.key.toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && !e.shiftKey && !e.altKey && key === 'z') {
        e.preventDefault()
        const last = undoable(store.history)
        if (!last) return void toast(t('shortcuts.nothingToUndo'))
        undoGroup(store, last)
        toast(t('sheet.undone', { what: groupSummary(t, last) }))
      } else if (ctrl || e.altKey) {
        return
      } else if (e.shiftKey && key === 'r') {
        e.preventDefault()
        resetFilters()
        toast(t('shortcuts.filtersReset'))
      } else if (e.shiftKey) {
        return
      } else if (key === 'n' && mode !== 'off') {
        e.preventDefault()
        useTurn.getState().newTurn()
        toast(`🔄 ${t('turn.newTurn')}`)
      } else if (key === 's' && onSpells) {
        e.preventDefault()
        onSpells()
      } else if (key === 'i') {
        e.preventDefault()
        onInventory()
      } else if (key === 'c') {
        e.preventDefault()
        if (!character.concentration) return void toast(t('shortcuts.notConcentrating'))
        void run(endConcentration(character))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store, mode, t, character, run, onSpells, onInventory])
  return null
}
