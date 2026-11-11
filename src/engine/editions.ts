// The few rules that differ between editions in ways data cannot express.
// Everything else (uses, recharge, action types) lives in the content data.
// Each rule cites the SRD section it was checked against.
import type { Edition } from '../content/schema'

export type EditionRules = {
  /** Hit dice regained on a long rest, given the character's total hit dice. */
  longRestHitDice(total: number): number
  /** Speed after exhaustion. */
  exhaustedSpeed(speed: number, level: number): number
  /** Penalty applied to every d20 test (attack rolls, saves, ability checks). */
  exhaustionD20Penalty(level: number): number
  /** Hit point maximum after exhaustion. */
  exhaustedHpMax(hpMax: number, level: number): number
  /** Notes for exhaustion effects the engine cannot apply as numbers. */
  exhaustionNotes(level: number): string[]
}

// SRD 5.1, "Resting → Long Rest": regain spent Hit Dice up to half the total
// (minimum one). "Conditions → Exhaustion": six cumulative levels.
const rules2014: EditionRules = {
  longRestHitDice: (total) => Math.max(1, Math.floor(total / 2)),
  exhaustedSpeed: (speed, level) => (level >= 5 ? 0 : level >= 2 ? Math.floor(speed / 2) : speed),
  exhaustionD20Penalty: () => 0,
  exhaustedHpMax: (hpMax, level) => (level >= 4 ? Math.floor(hpMax / 2) : hpMax),
  exhaustionNotes: (level) =>
    [
      level >= 1 && 'Disadvantage on ability checks',
      level >= 3 && 'Disadvantage on attack rolls and saving throws',
      level >= 6 && 'Death',
    ].filter((n): n is string => typeof n === 'string'),
}

// SRD 5.2.1, "Rules Glossary → Long Rest": regain all lost HP and all spent
// Hit Point Dice. "Exhaustion [Condition]": d20 tests −2 × level, Speed
// −5 ft × level, death at level 6.
const rules2024: EditionRules = {
  longRestHitDice: (total) => total,
  exhaustedSpeed: (speed, level) => Math.max(0, speed - 5 * level),
  exhaustionD20Penalty: (level) => 2 * level,
  exhaustedHpMax: (hpMax) => hpMax,
  exhaustionNotes: (level) => (level >= 6 ? ['Death'] : []),
}

export function editionRules(edition: Edition): EditionRules {
  return edition === '2014' ? rules2014 : rules2024
}
