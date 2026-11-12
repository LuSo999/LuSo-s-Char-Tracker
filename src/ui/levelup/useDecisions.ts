import { useState } from 'react'
import { allDecisions, isOpen, pendingId, type Pending } from '../../engine/levelup'
import { useSheet } from '../sheet/context'

/**
 * Decisions to show: the open ones, plus any that were open while this list
 * was on screen (so a finished one doesn't jump away), plus `also` (made
 * choices that may be changed now) or everything with `all`.
 */
export function useDecisions(opts: { also?: (p: Pending) => boolean; all?: boolean } = {}): { list: Pending[]; open: number } {
  const { character, sheet, content } = useSheet()
  const decisions = allDecisions(character, content, sheet)
  const openIds = decisions.filter((p) => isOpen(p, character)).map(pendingId)
  const [seen, setSeen] = useState(() => new Set(openIds))
  // New decisions can appear while choosing (a picked option with choices of its own).
  const added = openIds.filter((id) => !seen.has(id))
  if (added.length) setSeen(new Set([...seen, ...added]))
  const list = decisions.filter((p) => opts.all || seen.has(pendingId(p)) || added.includes(pendingId(p)) || opts.also?.(p))
  return { list, open: openIds.length }
}
