// Turn economy for the current turn. Not saved with the character: it only
// helps at the table. Undo restores it through snapshots kept per history group.
import { create } from 'zustand'

export type Slot = 'action' | 'bonusAction' | 'reaction'
type Counts = { action: number; bonusAction: number; reaction: number; attacksLeft: number; extraActions: number }
const fresh: Counts = { action: 0, bonusAction: 0, reaction: 0, attacksLeft: 0, extraActions: 0 }

type TurnState = Counts & {
  /** Last slot that was refused or over-used, to flash its chip. */
  flash?: { slot: Slot; at: number }
  newTurn(): void
  /** Spend a slot. Weapon attacks pass attacksPerAction: the first attack spends the Action, Extra Attack covers the rest. */
  use(slot: Slot | 'none', attack?: { perAction: number }): void
  surge(): void
  flashSlot(slot: Slot): void
}

export const useTurn = create<TurnState>((set) => ({
  ...fresh,
  newTurn: () => set({ ...fresh, flash: undefined }),
  surge: () => set((s) => ({ extraActions: s.extraActions + 1 })),
  flashSlot: (slot) => set({ flash: { slot, at: Date.now() } }),
  use: (slot, attack) =>
    set((s) => {
      if (slot === 'none') return s
      if (attack && slot === 'action') {
        if (s.attacksLeft > 0) return { attacksLeft: s.attacksLeft - 1 }
        return { action: s.action + 1, attacksLeft: attack.perAction - 1 }
      }
      if (slot === 'action') return { action: s.action + 1, attacksLeft: 0 }
      return { [slot]: s[slot] + 1 } as Partial<Counts>
    }),
}))

export const slotMax = (s: Counts, slot: Slot) => (slot === 'action' ? 1 + s.extraActions : 1)
export const slotFree = (s: Counts, slot: Slot) => s[slot] < slotMax(s, slot)

const snapshots = new Map<string, Counts>()

export function snapshotTurn(): Counts {
  const { action, bonusAction, reaction, attacksLeft, extraActions } = useTurn.getState()
  return { action, bonusAction, reaction, attacksLeft, extraActions }
}

export function rememberTurn(groupId: string, before: Counts) {
  snapshots.set(groupId, before)
}

/** Called on undo: put the turn back as it was before the undone action. */
export function restoreTurnFor(groupId: string) {
  const before = snapshots.get(groupId)
  if (before) useTurn.setState(before)
}
