import { useMemo } from 'react'
import type { ContentIndex } from '../../content'
import type { Character } from '../../engine/character'
import { computeSheet } from '../../engine/derive'
import type { CharacterStore } from '../../state/history'
import { SheetContext } from '../sheet/context'

/**
 * A sheet for a character that isn't saved yet (character creation): the
 * choice cards and spell lists work on it, and every change goes to `onChange`.
 */
export function DraftSheet({ character, content, onChange, children }: { character: Character; content: ContentIndex; onChange: (c: Character) => void; children: React.ReactNode }) {
  const sheet = useMemo(() => computeSheet(character, content), [character, content])
  const store: CharacterStore = useMemo(
    () => ({
      history: [],
      hasMore: false,
      loadMore() {},
      async commit(result) {
        onChange(result.character)
        return { id: 'draft', at: Date.now(), kind: result.kind, groupType: result.groupType, items: result.items }
      },
      async undo() {},
      async addGroup() {},
    }),
    [onChange],
  )
  return <SheetContext.Provider value={{ character, sheet, content, baseContent: content, store, draft: true }}>{children}</SheetContext.Provider>
}
