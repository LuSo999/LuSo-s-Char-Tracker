// The character sheet opened last, so other pages can link back to it.
import { create } from 'zustand'

const KEY = 'lastCharacter'

function load(): { id: string; name: string } | undefined {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

export const useLastCharacter = create<{ last?: { id: string; name: string } }>(() => ({ last: load() }))

export function rememberCharacter(id: string, name: string) {
  if (useLastCharacter.getState().last?.id === id && useLastCharacter.getState().last?.name === name) return
  useLastCharacter.setState({ last: { id, name } })
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ id, name }))
  } catch {
    // only a convenience
  }
}
