// Turn economy for the current turn. Not saved: it only helps at the table.
import { create } from 'zustand'
import type { ActionType } from '../../content/schema'

type Turn = { action: number; bonusAction: number; reaction: number; attacksLeft: number; extraActions: number }
const fresh: Turn = { action: 0, bonusAction: 0, reaction: 0, attacksLeft: 0, extraActions: 0 }

export const useTurn = create<Turn & { newTurn(): void; use(type: ActionType, attack?: { perAction: number }): void; surge(): void }>((set) => ({
  ...fresh,
  newTurn: () => set(fresh),
  surge: () => set((s) => ({ extraActions: s.extraActions + 1 })),
  use: (type, attack) =>
    set((s) => {
      if (type === 'other') return s
      // Attacks: the first one uses the Action, the rest come from Extra Attack.
      if (attack) {
        if (s.attacksLeft > 0) return { attacksLeft: s.attacksLeft - 1 }
        return { action: s.action + 1, attacksLeft: attack.perAction - 1 }
      }
      if (type === 'action') return { action: s.action + 1, attacksLeft: 0 }
      return { [type]: s[type] + 1 } as Partial<Turn>
    }),
}))
