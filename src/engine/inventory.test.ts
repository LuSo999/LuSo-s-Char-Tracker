import { describe, expect, it } from 'vitest'
import { makeAttack, type ActionResult } from './actions'
import type { Character, CharacterInput } from './character'
import { computeSheet } from './derive'
import { makeCharacter, srd, valdric } from './fixtures'
import { addItem, adjustCoin, pickUpThrown, recoverAmmo, toggleAttune, toggleEquip } from './inventory'
import { longRest } from './rest'

const c24 = srd('2024')
const c14 = srd('2014')
const sheet = (c: Character, content = c24) => computeSheet(c, content)
function okR(r: ActionResult) {
  if (!r.ok) throw new Error(r.error)
  return r.character
}
const withItems = (inventory: CharacterInput['inventory'], extra: Partial<CharacterInput> = {}) => valdric({ inventory, ...extra })

describe('magic weapons and armor on a base item', () => {
  const c = withItems([
    { uid: 'ls', itemId: 'weapon-1', baseItemId: 'longsword', equipped: true },
    { uid: 'flail', itemId: 'flail', equipped: true },
    { uid: 'armor', itemId: 'armor-1', baseItemId: 'chain-mail', equipped: true },
  ])
  const s = sheet(c)

  it('the +1 applies only to that weapon', () => {
    const ls = s.attacks.find((a) => a.key === 'ls')!
    expect(ls.name).toBe('Longsword +1')
    expect([ls.attack.value, ls.damageDice, ls.damageBonus]).toEqual([6, '1d8', 4])
    expect(s.attacks.find((a) => a.key === 'flail')!.attack.value).toBe(5)
  })

  it('magic armor protects like its base plus its bonus', () => {
    expect(s.ac.value).toBe(16 + 1 + 1) // chain mail +1, Defense, no shield
  })

  it('a magic weapon needs its base item chosen', () => {
    expect(addItem(valdric(), c24, 'weapon-1').ok).toBe(false)
    expect(addItem(valdric(), c24, 'weapon-1', 1, 'longsword').ok).toBe(true)
  })
})

describe('attunement', () => {
  it('effects of attunement items apply only while attuned; at most three', () => {
    const base = withItems([{ uid: 'cloak', itemId: 'cloak-of-protection', equipped: true }])
    expect(sheet(base).ac.value).toBe(12) // no armor in this inventory: 10 + Dex 2, not attuned yet
    const attuned = okR(toggleAttune(base, c24, 'cloak'))
    expect(sheet(attuned).ac.value).toBe(sheet(base).ac.value + 1)
    expect(sheet(attuned).saves.wis.value).toBe(sheet(base).saves.wis.value + 1)
    const full = withItems(['a', 'b', 'c', 'd'].map((uid, i) => ({ uid, itemId: 'cloak-of-protection', attuned: i < 3 })))
    expect(toggleAttune(full, c24, 'd')).toMatchObject({ ok: false, error: 'attunementFull' })
  })

  it('setting items raise a score but never lower it', () => {
    const g = withItems([{ uid: 'g', itemId: 'gauntlets-of-ogre-power', equipped: true, attuned: true }])
    expect(sheet(g).scores.str.value).toBe(19)
    const strong = withItems([{ uid: 'g', itemId: 'gauntlets-of-ogre-power', equipped: true, attuned: true }], { baseScores: { str: 20, dex: 14, con: 16, int: 13, wis: 16, cha: 9 } })
    expect(sheet(strong).scores.str.value).toBe(20)
  })

  it('Bracers of Defense only without armor and shield; Luckstone adds to checks and saves', () => {
    const bracers = withItems([{ uid: 'b', itemId: 'bracers-of-defense', equipped: true, attuned: true }])
    expect(sheet(bracers).ac.value).toBe(10 + 2 + 2)
    const withShield = withItems([
      { uid: 'b', itemId: 'bracers-of-defense', equipped: true, attuned: true },
      { uid: 's', itemId: 'shield', equipped: true },
    ])
    expect(sheet(withShield).ac.value).toBe(10 + 2 + 2)
    const luck = withItems([{ uid: 'l', itemId: 'stone-of-good-luck-(luckstone)', equipped: true, attuned: true }])
    expect(sheet(luck).skills.stealth.value).toBe(sheet(valdric()).skills.stealth.value + 1)
    expect(sheet(luck).initiative.value).toBe(3)
  })
})

describe('equipping', () => {
  it('putting on armor takes off the other armor; the shield stays', () => {
    const c = withItems([
      { uid: 'chain', itemId: 'chain-mail', equipped: true },
      { uid: 'plate', itemId: 'plate-armor' },
      { uid: 'shield', itemId: 'shield', equipped: true },
    ])
    const next = okR(toggleEquip(c, c24, 'plate'))
    expect(next.inventory.map((e) => [e.uid, e.equipped])).toEqual([['chain', false], ['plate', true], ['shield', true]])
  })

  it('stackable items merge into one stack', () => {
    const c = okR(addItem(withItems([{ uid: 'p', itemId: 'potion-of-healing', quantity: 1 }]), c24, 'potion-of-healing', 2))
    expect(c.inventory).toHaveLength(1)
    expect(c.inventory[0].quantity).toBe(3)
  })
})

describe('ammunition', () => {
  const bow = (extra: CharacterInput['inventory'] = []) =>
    withItems([{ uid: 'bow', itemId: 'longbow', equipped: true }, { uid: 'arrows', itemId: 'arrows', quantity: 20 }, ...extra])

  it('magic ammunition adds its bonus to the weapon that fires it', () => {
    const c = bow([{ uid: 'magic', itemId: 'ammunition-1', baseItemId: 'arrows', quantity: 5 }])
    c.inventory = c.inventory.map((e) => (e.uid === 'bow' ? { ...e, ammoUid: 'magic' } : e))
    const a = sheet(c).attacks.find((x) => x.key === 'bow')!
    expect(a.ammo).toMatchObject({ uid: 'magic', remaining: 5 })
    expect(a.attack.value).toBe(sheet(bow()).attacks.find((x) => x.key === 'bow')!.attack.value + 1)
  })

  it('half of the fired ammunition (rounded down) comes back after the fight', () => {
    let c = bow()
    for (let i = 0; i < 5; i++) c = okR(makeAttack(c, sheet(c).attacks.find((x) => x.key === 'bow')!))
    expect(c.inventory.find((e) => e.uid === 'arrows')!.quantity).toBe(15)
    const after = okR(recoverAmmo(c, c24))
    expect(after.inventory.find((e) => e.uid === 'arrows')!.quantity).toBe(17)
    expect(after.ammoSpent).toEqual({})
  })

  it('thrown weapons are picked up again', () => {
    let c = valdric()
    for (let i = 0; i < 3; i++) c = okR(makeAttack(c, sheet(c).attacks.find((x) => x.key === 'javelins')!, undefined, { thrown: true }))
    expect(c.inventory.find((e) => e.uid === 'javelins')!.quantity).toBe(5)
    expect(okR(pickUpThrown(c, c24)).inventory.find((e) => e.uid === 'javelins')!.quantity).toBe(8)
  })
})

describe('off-hand attacks (Light)', () => {
  const dual = (extra: Partial<CharacterInput> = {}) =>
    makeCharacter({
      edition: '2024',
      speciesId: 'human',
      backgroundId: 'soldier',
      baseScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      inventory: [
        { uid: 'a', itemId: 'shortsword', equipped: true },
        { uid: 'b', itemId: 'handaxe', equipped: true },
      ],
      ...extra,
    })

  it('no ability modifier on the extra attack, unless Two-Weapon Fighting', () => {
    expect(sheet(dual()).attacks.find((x) => x.key === 'b')!.offhand).toEqual({ damageBonus: 0 })
    const twf = dual({ choices: { 'fighter-fighting-style/feat': ['two-weapon-fighting'] } })
    expect(sheet(twf).attacks.find((x) => x.key === 'b')!.offhand).toEqual({ damageBonus: 3 })
  })

  it('2014: only light melee weapons qualify', () => {
    const c = makeCharacter({ edition: '2014', inventory: [{ uid: 'x', itemId: 'crossbow-hand', equipped: true }, { uid: 'd', itemId: 'dagger', equipped: true }] })
    const s = sheet(c, c14)
    expect(s.attacks.find((x) => x.key === 'x')!.offhand).toBeUndefined()
    expect(s.attacks.find((x) => x.key === 'd')!.offhand).toBeDefined()
  })
})

describe('weight, money and charges', () => {
  it('Powerful Build doubles the carrying capacity', () => {
    expect(sheet(valdric()).weight.capacity).toBe(16 * 15 * 2)
  })

  it('money never goes below zero', () => {
    expect(adjustCoin(valdric(), 'gp', -3)).toMatchObject({ ok: false, error: 'notEnoughMoney' })
    expect(okR(adjustCoin(valdric(), 'gp', -2)).currency.gp).toBe(0)
  })

  it('a wand regains its rolled charges at dawn during a long rest', () => {
    const c = withItems([{ uid: 'w', itemId: 'wand-of-binding', equipped: true, attuned: true, chargesUsed: 6 }])
    const key = 'item:w:charges'
    expect(sheet(c).resources.find((r) => r.key === key)).toMatchObject({ max: 7, remaining: 1 })
    expect(longRest(c, c24, { dawn: true, dawnRolls: { [key]: 4 } }).character.inventory[0].chargesUsed).toBe(2)
    expect(longRest(c, c24).character.inventory[0].chargesUsed).toBe(6)
  })
})
