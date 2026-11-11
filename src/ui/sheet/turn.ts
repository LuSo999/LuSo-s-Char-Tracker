// Turn economy for the current turn. Not saved with the character: it only
// helps at the table. Undo restores it through snapshots kept per history group.
import { create } from 'zustand'

export type Slot = 'action' | 'bonusAction' | 'reaction'

/** The Attack action in progress: how many attacks it allows and how many were made. */
export type AttackAction = { id: string; total: number; used: number; names: string[] }

export type Counts = {
  action: number
  bonusAction: number
  reaction: number
  extraActions: number
  attackAction?: AttackAction
  /** Uses this turn of things limited per turn, by key. */
  perTurn: Record<string, number>
  /** Groups already used on the current attack (one maneuver per attack). */
  perAttack: string[]
}

const fresh = (): Counts => ({ action: 0, bonusAction: 0, reaction: 0, extraActions: 0, attackAction: undefined, perTurn: {}, perAttack: [] })

type TurnState = Counts & {
  /** Last slot that was refused or over-used, to flash its chip. */
  flash?: { slot: Slot | 'attack'; at: number }
  newTurn(): void
  /** Spend a slot for a non-attack thing; a new Action ends the Attack action. */
  use(slot: Slot | 'none'): void
  /** One attack (or something replacing an attack): continues the Attack action or starts one with the Action. Returns its id. */
  attack(name: string, perAction: number, spendAction: boolean): string
  endAttack(): void
  surge(): void
  countPerTurn(key: string): void
  markPerAttack(group: string): void
  flashSlot(slot: Slot | 'attack'): void
}

let nextAttackId = 1

export const useTurn = create<TurnState>((set, get) => ({
  ...fresh(),
  newTurn: () => set({ ...fresh(), flash: undefined }),
  surge: () => set((s) => ({ extraActions: s.extraActions + 1 })),
  flashSlot: (slot) => set({ flash: { slot, at: Date.now() } }),
  use: (slot) =>
    set((s) => {
      if (slot === 'none') return s
      if (slot === 'action') return { action: s.action + 1, attackAction: undefined }
      return { [slot]: s[slot] + 1 } as Partial<Counts>
    }),
  attack: (name, perAction, spendAction) => {
    const s = get()
    if (s.attackAction && s.attackAction.used < s.attackAction.total) {
      const attackAction = { ...s.attackAction, used: s.attackAction.used + 1, names: [...s.attackAction.names, name] }
      set({ attackAction, perAttack: [] })
      return attackAction.id
    }
    const attackAction = { id: `attack-${nextAttackId++}`, total: Math.max(1, perAction), used: 1, names: [name] }
    set({ action: spendAction ? s.action + 1 : s.action, attackAction, perAttack: [] })
    return attackAction.id
  },
  endAttack: () => set({ attackAction: undefined }),
  countPerTurn: (key) => set((s) => ({ perTurn: { ...s.perTurn, [key]: (s.perTurn[key] ?? 0) + 1 } })),
  markPerAttack: (group) => set((s) => ({ perAttack: [...s.perAttack, group] })),
}))

export const slotMax = (s: Counts, slot: Slot) => (slot === 'action' ? 1 + s.extraActions : 1)
export const slotFree = (s: Counts, slot: Slot) => s[slot] < slotMax(s, slot)
export const attacksLeft = (s: Counts) => (s.attackAction ? s.attackAction.total - s.attackAction.used : 0)

const snapshots = new Map<string, Counts>()

export function snapshotTurn(): Counts {
  const { action, bonusAction, reaction, extraActions, attackAction, perTurn, perAttack } = useTurn.getState()
  return {
    action,
    bonusAction,
    reaction,
    extraActions,
    attackAction: attackAction && { ...attackAction, names: [...attackAction.names] },
    perTurn: { ...perTurn },
    perAttack: [...perAttack],
  }
}

export function rememberTurn(groupId: string, before: Counts) {
  snapshots.set(groupId, before)
}

/** Called on undo: put the turn back as it was before the undone action. */
export function restoreTurnFor(groupId: string) {
  const before = snapshots.get(groupId)
  if (before) useTurn.setState(before)
}
