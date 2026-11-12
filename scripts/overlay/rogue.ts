// Rogue and Thief. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
import { shortAndLong, type ClassOverlay } from './common.ts'

const sneakDice = { count: 'ceil(level / 2)', die: 6 }
const expertise = (id: string) => ({ choices: [{ id, label: 'Expertise', kind: 'skill', expertise: true, count: 2 }] })
const cunningAction = (edition: '2014' | '2024') => ({
  activities: [
    { id: 'dash', name: 'Cunning Action: Dash', actionType: 'bonusAction', summary: 'Take the Dash action.' },
    { id: 'disengage', name: 'Cunning Action: Disengage', actionType: 'bonusAction', summary: 'Take the Disengage action.' },
    { id: 'hide', name: 'Cunning Action: Hide', actionType: 'bonusAction', summary: edition === '2024' ? 'Take the Hide action (DC 15 Stealth, out of sight).' : 'Take the Hide action.' },
  ],
})

export const rogue: ClassOverlay = {
  '2014': {
    'rogue-expertise-1': { name: 'Expertise', ...expertise('skills') },
    'rogue-expertise-2': { name: 'Expertise (6th level)', ...expertise('skills') },
    'sneak-attack': {
      activities: [
        {
          id: 'use', name: 'Sneak Attack', attack: true, actionType: 'other', perTurn: 1, fx: 'physical', roll: { dice: sneakDice, kind: 'damage' },
          summary: 'Once per turn, finesse or ranged weapon hit with advantage — or an ally within 5 ft of the target and no disadvantage.',
        },
      ],
    },
    'cunning-action': cunningAction('2014'),
    'uncanny-dodge': {
      activities: [{ id: 'use', name: 'Uncanny Dodge', actionType: 'reaction', summary: 'Halve the damage of an attack that hits you from an attacker you can see.' }],
    },
    'stroke-of-luck': {
      resources: [{ id: 'stroke-of-luck', name: 'Stroke of Luck', max: 1, recharge: shortAndLong() }],
      activities: [{ id: 'use', name: 'Stroke of Luck', actionType: 'other', cost: [{ resource: 'stroke-of-luck' }], fx: 'power', summary: 'Turn a missed attack into a hit, or treat a failed ability check’s d20 as a 20.' }],
    },
    'slippery-mind': { effects: [{ target: 'proficiency:save:wis', value: 1 }] },
    'roguish-archetype-improvement-1': { upgradeOf: 'roguish-archetype' },
    'roguish-archetype-improvement-2': { upgradeOf: 'roguish-archetype' },
    'roguish-archetype-improvement-3': { upgradeOf: 'roguish-archetype' },
    // Thief
    'fast-hands': {
      activities: [{ id: 'use', name: 'Fast Hands', actionType: 'bonusAction', summary: 'Cunning Action: Sleight of Hand check, use thieves’ tools, or Use an Object.' }],
    },
  },

  '2024': {
    'rogue-expertise': { ...expertise('skills'), effects: [] },
    'rogue-sneak-attack': {
      activities: [
        {
          id: 'use', name: 'Sneak Attack', attack: true, actionType: 'other', perTurn: 1, fx: 'physical', roll: { dice: sneakDice, kind: 'damage' },
          summary: 'Once per turn, Finesse or Ranged weapon hit with Advantage — or an ally within 5 ft of the target and no Disadvantage.',
        },
      ],
    },
    'rogue-weapon-mastery': {
      choices: [{ id: 'weapons', label: 'Weapon Mastery', kind: 'weaponMastery', count: 2, changeable: 'longRest' }],
    },
    'rogue-cunning-action': cunningAction('2024'),
    'rogue-steady-aim': {
      activities: [{ id: 'use', name: 'Steady Aim', actionType: 'bonusAction', summary: 'If you haven’t moved this turn: Advantage on your next attack roll this turn; your Speed is 0 until the end of the turn.' }],
    },
    'rogue-cunning-strike': {
      activities: [
        {
          id: 'use', name: 'Cunning Strike', attack: true, actionType: 'other', saveDc: '8 + dex + pb', fx: 'physical',
          summary: 'Forgo Sneak Attack dice: Poison 1d6 (Con save or Poisoned 1 min), Trip 1d6 (Large or smaller, Dex save or Prone), Withdraw 1d6 (move half Speed, no Opportunity Attacks). Level 11: two effects; 14: Daze 2d6, Knock Out 6d6, Obscure 3d6.',
        },
      ],
    },
    'rogue-uncanny-dodge': {
      activities: [{ id: 'use', name: 'Uncanny Dodge', actionType: 'reaction', summary: 'Halve the damage of an attack roll that hits you from an attacker you can see.' }],
    },
    'rogue-slippery-mind': {
      effects: [
        { target: 'proficiency:save:wis', value: 1 },
        { target: 'proficiency:save:cha', value: 1 },
      ],
    },
    'rogue-stroke-of-luck': {
      resources: [{ id: 'stroke-of-luck', name: 'Stroke of Luck', max: 1, recharge: shortAndLong() }],
      activities: [{ id: 'use', name: 'Stroke of Luck', actionType: 'other', cost: [{ resource: 'stroke-of-luck' }], fx: 'power', summary: 'Turn a failed D20 Test into a 20.' }],
    },
    // Thief
    'thief-fast-hands': {
      activities: [{ id: 'use', name: 'Fast Hands', actionType: 'bonusAction', summary: 'Sleight of Hand (pick a lock, disarm a trap, pick a pocket), Utilize, or the Magic action to use a magic item.' }],
    },
    'thief-use-magic-device': { effects: [{ target: 'attunementSlots', op: 'max', value: 4 }] },
  },
}
