// The one place every change to a character goes through. A change is a
// history group: what happened (items with before/after values) plus the
// previous values of the changed fields, which is what "undo" restores.
// Groups are never deleted; undoing adds a new group.
//
// Stored in users/{uid}/characters/{id}/history/{groupId}, loaded in pages.
import { collection, deleteField, doc, limit, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ActionResult } from '../engine/actions'
import type { Character } from '../engine/character'
import { clean, diff, makeUndoGroup, type HistoryGroup } from '../engine/history'
import { db } from '../firebase'

export type CharacterStore = {
  history: HistoryGroup[]
  hasMore: boolean
  loadMore(): void
  /** Apply an action result: save the character and its history group. */
  commit(result: Extract<ActionResult, { ok: true }>): Promise<HistoryGroup>
  undo(group: HistoryGroup): Promise<void>
  addGroup(group: Omit<HistoryGroup, 'id' | 'at'>): Promise<void>
}

export type { HistoryGroup }
export { undoable } from '../engine/history'

const PAGE = 50
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Fields to write back: null marks a field that didn't exist before. */
function toUpdate(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === null ? deleteField() : v]))
}

export function useFirestoreStore(uid: string, character: Character): CharacterStore {
  const [pages, setPages] = useState(1)
  const [history, setHistory] = useState<HistoryGroup[]>([])
  const [hasMore, setHasMore] = useState(false)
  const charRef = useMemo(() => doc(db!, 'users', uid, 'characters', character.id), [uid, character.id])
  const historyCol = useMemo(() => collection(charRef, 'history'), [charRef])

  useEffect(() => {
    const q = query(historyCol, orderBy('at', 'desc'), limit(PAGE * pages))
    return onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ ...(d.data() as Omit<HistoryGroup, 'id'>), id: d.id })))
      setHasMore(snap.size >= PAGE * pages)
    })
  }, [historyCol, pages])

  const write = useCallback(
    async (fields: Record<string, unknown>, group: Omit<HistoryGroup, 'id' | 'at'>) => {
      const full: HistoryGroup = { ...group, id: newId(), at: Date.now() }
      const batch = writeBatch(db!)
      if (Object.keys(fields).length) batch.update(charRef, toUpdate(fields))
      batch.set(doc(historyCol, full.id), clean({ ...full, id: undefined }))
      // Don't wait for the server: offline writes are queued and the UI updates at once.
      void batch.commit()
      return full
    },
    [charRef, historyCol],
  )

  return {
    history,
    hasMore,
    loadMore: () => setPages((p) => p + 1),
    async commit(result) {
      const { patch, revert } = diff(character, result.character)
      return write(patch, { kind: result.kind, groupType: result.groupType, items: result.items, revert })
    },
    async undo(group) {
      if (!group.revert) return
      await write(group.revert, makeUndoGroup(group))
    },
    async addGroup(group) {
      await write({}, group)
    },
  }
}

/** In-memory store for the development preview (no sign-in). */
export function useMemoryStore(initial: Character): CharacterStore & { character: Character } {
  const [character, setCharacter] = useState(initial)
  const [history, setHistory] = useState<HistoryGroup[]>([])
  const push = (group: Omit<HistoryGroup, 'id' | 'at'>) => {
    const full = { ...group, id: newId(), at: Date.now() }
    setHistory((h) => [full, ...h])
    return full
  }
  return {
    character,
    history,
    hasMore: false,
    loadMore: () => {},
    async commit(result) {
      const { revert } = diff(character, result.character)
      setCharacter(result.character)
      return push({ kind: result.kind, groupType: result.groupType, items: result.items, revert })
    },
    async undo(group) {
      if (!group.revert) return
      setCharacter((c) => {
        const next = { ...c } as Record<string, unknown>
        for (const [k, v] of Object.entries(group.revert!)) {
          if (v === null) delete next[k]
          else next[k] = v
        }
        return next as Character
      })
      push(makeUndoGroup(group))
    },
    async addGroup(group) {
      push(group)
    },
  }
}
