import { describe, expect, it } from 'vitest'
import { heal, rollDeathSave, setDeathSaves, setResourceRemaining, setTempHp, makeAttack, takeDamage, performActivity, type ActionResult } from './actions'
import type { Character } from './character'
import { computeSheet } from './derive'
import { srd, valdric } from './fixtures'

const content = srd('2024')
const sheetOf = (c: Character) => computeSheet(c, content)
function okResult(r: ActionResult) {
  if (!r.ok) throw new Error(r.error)
  return r
}

describe('hit points', () => {
  it('damage takes temporary HP first', () => {
    const c = valdric({ hp: { current: 30, temp: 5 } })
    const r = okResult(takeDamage(c, sheetOf(c), 8))
    expect(r.character.hp).toEqual({ current: 27, temp: 0 })
    expect(r.items.map((i) => i.type)).toEqual(['tempHp', 'damage'])
  })

  it('never goes below 0 and flags massive damage', () => {
    const c = valdric({ hp: { current: 6 } })
    const r = okResult(takeDamage(c, sheetOf(c), 6 + 44))
    expect(r.character.hp.current).toBe(0)
    expect(r.items.some((i) => i.type === 'massiveDamage')).toBe(true)
    const r2 = okResult(takeDamage(c, sheetOf(c), 10))
    expect(r2.items.some((i) => i.type === 'massiveDamage')).toBe(false)
    expect(r2.items.some((i) => i.type === 'unconscious')).toBe(true)
  })

  it('damage at 0 HP is a death save failure (two on a critical hit)', () => {
    const c = valdric({ hp: { current: 0 } })
    expect(okResult(takeDamage(c, sheetOf(c), 3)).character.deathSaves.failures).toBe(1)
    expect(okResult(takeDamage(c, sheetOf(c), 3, true)).character.deathSaves.failures).toBe(2)
  })

  it('healing is capped at the maximum and resets death saves', () => {
    const c = valdric({ hp: { current: 0 }, deathSaves: { successes: 1, failures: 2 } })
    const r = okResult(heal(c, sheetOf(c), 100))
    expect(r.character.hp.current).toBe(44)
    expect(r.character.deathSaves).toEqual({ successes: 0, failures: 0 })
  })

  it('temporary HP replace each other instead of stacking', () => {
    const c = valdric({ hp: { current: 44, temp: 10 } })
    expect(okResult(setTempHp(c, 12)).character.hp.temp).toBe(12)
  })

  it('rejects zero or negative amounts', () => {
    const c = valdric()
    expect(takeDamage(c, sheetOf(c), 0).ok).toBe(false)
    expect(heal(c, sheetOf(c), -2).ok).toBe(false)
  })

  it('three failures means dead, three successes stable', () => {
    const c = valdric({ hp: { current: 0 } })
    expect(okResult(setDeathSaves(c, 0, 3)).items.some((i) => i.type === 'dead')).toBe(true)
    expect(okResult(setDeathSaves(c, 3, 0)).items.some((i) => i.type === 'stable')).toBe(true)
  })
})

describe('death saving throws', () => {
  const dying = (s = 0, f = 0) => valdric({ hp: { current: 0 }, deathSaves: { successes: s, failures: f } })

  it('10 or higher succeeds, lower fails, a 1 is two failures', () => {
    expect(okResult(rollDeathSave(dying(), 10)).character.deathSaves).toEqual({ successes: 1, failures: 0 })
    expect(okResult(rollDeathSave(dying(), 9)).character.deathSaves).toEqual({ successes: 0, failures: 1 })
    expect(okResult(rollDeathSave(dying(), 1)).character.deathSaves).toEqual({ successes: 0, failures: 2 })
  })

  it('a 20 brings the character back with 1 HP', () => {
    const r = okResult(rollDeathSave(dying(1, 2), 20))
    expect(r.character.hp.current).toBe(1)
    expect(r.character.deathSaves).toEqual({ successes: 0, failures: 0 })
  })

  it('third success is Stable, third failure is death; then no more rolls', () => {
    expect(okResult(rollDeathSave(dying(2, 0), 15)).items.some((i) => i.type === 'stable')).toBe(true)
    expect(okResult(rollDeathSave(dying(0, 2), 3)).items.some((i) => i.type === 'dead')).toBe(true)
    expect(rollDeathSave(dying(3, 0), 15).ok).toBe(false)
    expect(rollDeathSave(valdric(), 15).ok).toBe(false)
  })
})

describe('using actions', () => {
  it('Second Wind spends a use and heals the roll + Fighter level', () => {
    const c = valdric({ hp: { current: 20 } })
    const sheet = sheetOf(c)
    const sw = sheet.activities.find((a) => a.activity.name === 'Second Wind')!
    const r = okResult(performActivity(c, sheet, sw, 7))
    expect(r.character.resourcesUsed['second-wind']).toBe(1)
    expect(r.character.hp.current).toBe(20 + 7 + 4)
  })

  it('cannot spend what is not there', () => {
    const c = valdric({ resourcesUsed: { 'second-wind': 3 } })
    const sheet = sheetOf(c)
    const tm = sheet.activities.find((a) => a.activity.name === 'Tactical Mind')!
    expect(performActivity(c, sheet, tm).ok).toBe(false)
  })

  it('a potion uses up one from the stack and heals', () => {
    const c = valdric({ hp: { current: 10 } })
    const sheet = sheetOf(c)
    const drink = sheet.activities.find((a) => a.activity.id === 'drink')!
    const r = okResult(performActivity(c, sheet, drink, 5))
    expect(r.character.inventory.find((e) => e.uid === 'potion')!.quantity).toBe(1)
    expect(r.character.hp.current).toBe(10 + 5 + 2)
  })

  it('throwing a javelin takes one from the stack', () => {
    const c = valdric()
    const jav = sheetOf(c).attacks.find((a) => a.key === 'javelins')!
    const r = okResult(makeAttack(c, jav, undefined, { thrown: true }))
    expect(r.character.inventory.find((e) => e.uid === 'javelins')!.quantity).toBe(7)
  })

  it('a javelin used in melee is not used up', () => {
    const c = valdric()
    const jav = sheetOf(c).attacks.find((a) => a.key === 'javelins')!
    expect(okResult(makeAttack(c, jav)).character.inventory.find((e) => e.uid === 'javelins')!.quantity).toBe(8)
  })

  it('an attack without ammunition is still recorded', () => {
    const c = valdric()
    const flail = sheetOf(c).attacks.find((a) => a.key === 'flail')!
    const r = okResult(makeAttack(c, flail))
    expect(r.character).toBe(c)
    expect(r.items[0]).toMatchObject({ type: 'attack', params: { name: 'Flail' } })
  })

  it('clicking resource dots sets the remaining uses within 0…max', () => {
    const c = valdric()
    const sheet = sheetOf(c)
    expect(okResult(setResourceRemaining(c, sheet, 'giant-ancestry', 0)).character.resourcesUsed['giant-ancestry']).toBe(2)
    expect(setResourceRemaining(c, sheet, 'giant-ancestry', 2).ok).toBe(false)
  })
})
