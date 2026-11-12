import type { ActionType } from '../../content/schema'

/** Glossary term for an action type; spells cast with an action use the Magic action (2024). */
export const actionTypeTerm = (type: ActionType, spell = false): string | undefined =>
  type === 'action' ? (spell ? 'rule-magic-action' : 'rule-action') : type === 'bonusAction' ? 'rule-bonus-action' : type === 'reaction' ? 'rule-reaction' : undefined
