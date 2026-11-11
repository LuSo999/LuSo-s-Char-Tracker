import { describe, expect, it } from 'vitest'
import { computeSheet } from './derive'
import { makeCharacter, srd, valdric } from './fixtures'

const content2024 = srd('2024')
const content2014 = srd('2014')

describe('Valdric (2024 Goliath Fighter 4, SRD stand-ins)', () => {
  const sheet = computeSheet(valdric(), content2024)

  it('applies background increases and the ASI feat to ability scores', () => {
    expect(Object.fromEntries(Object.entries(sheet.scores).map(([a, v]) => [a, v.value]))).toEqual({
      str: 16, dex: 15, con: 18, int: 13, wis: 17, cha: 9,
    })
  })

  it('matches the paper sheet numbers', () => {
    expect(sheet.pb.value).toBe(2)
    expect(sheet.ac.value).toBe(19) // chain mail 16 + shield 2 + Defense 1
    expect(sheet.hpMax.value).toBe(44) // 10+4, then 3 × (6+4)
    expect(sheet.speed.value).toBe(35)
    expect(sheet.initiative.value).toBe(2)
    expect(sheet.passivePerception.value).toBe(15)
    expect(sheet.saves.str.value).toBe(5)
    expect(sheet.saves.con.value).toBe(6)
    expect(sheet.saves.dex.value).toBe(2)
    expect(sheet.skills.athletics.value).toBe(5)
    expect(sheet.skills.arcana.value).toBe(3) // Sage
  })

  it('computes weapon attacks with mastery and the Champion crit range', () => {
    const flail = sheet.attacks.find((a) => a.key === 'flail')!
    expect(flail.attack.value).toBe(5)
    expect(flail.damageDice).toBe('1d8')
    expect(flail.damageBonus).toBe(3)
    expect(flail.mastery).toBe('sap')
    expect(flail.critRange).toBe(19)
    const javelin = sheet.attacks.find((a) => a.key === 'javelins')!
    expect(javelin.ability).toBe('str')
    expect(javelin.thrown).toEqual({ normal: 30, long: 120 })
    expect(javelin.mastery).toBe('slow')
    expect(javelin.ammo?.remaining).toBe(8)
    const unarmed = sheet.attacks.find((a) => a.key === 'unarmed')!
    expect(unarmed.attack.value).toBe(5)
    expect(unarmed.damageDice).toBe('1')
    expect(unarmed.damageBonus).toBe(3)
    expect(sheet.attacks.every((a) => a.attacksPerAction === 1)).toBe(true)
    expect(sheet.attacks.map((a) => a.key)).toEqual(['flail', 'greatsword', 'javelins', 'quarterstaff', 'unarmed'])
  })

  it('has the right resources at level 4', () => {
    const max = Object.fromEntries(sheet.resources.map((r) => [r.key, r.max]))
    expect(max).toEqual({ 'second-wind': 3, 'action-surge': 1, 'giant-ancestry': 2 })
  })

  it('lists actions with action types from the edition', () => {
    const byKey = Object.fromEntries(sheet.activities.map((a) => [a.activity.name, a]))
    expect(byKey['Second Wind'].actionType).toBe('bonusAction')
    expect(byKey['Second Wind'].rollBonus).toBe(4)
    expect(byKey['Tactical Mind'].uses?.resourceKey).toBe('second-wind')
    expect(byKey["Stone's Endurance"].actionType).toBe('reaction')
    expect(byKey["Stone's Endurance"].rollBonus).toBe(4)
    expect(byKey.Drink.actionType).toBe('bonusAction')
    expect(byKey.Drink.uses?.remaining).toBe(2)
    expect(byKey['Large Form']).toBeUndefined() // character level 5+
  })
})

describe('edition differences', () => {
  it('Second Wind: 2014 has one use; 2024 scales 2 → 3 → 4', () => {
    const sw = (edition: '2014' | '2024', level: number) =>
      computeSheet(makeCharacter({ edition, classes: [{ classId: 'fighter', level }] }), edition === '2014' ? content2014 : content2024).resources.find(
        (r) => r.key === 'second-wind',
      )!.max
    expect([1, 4, 10, 20].map((l) => sw('2014', l))).toEqual([1, 1, 1, 1])
    expect([1, 4, 10, 20].map((l) => sw('2024', l))).toEqual([2, 3, 4, 4])
  })

  it('Weapon Mastery exists only in 2024', () => {
    const c14 = computeSheet(makeCharacter({ edition: '2014' }), content2014)
    expect(c14.active.some((a) => a.entity.id.includes('weapon-mastery'))).toBe(false)
    const c24 = computeSheet(makeCharacter({ edition: '2024', backgroundId: 'soldier', speciesId: 'human' }), content2024)
    expect(c24.active.some((a) => a.entity.id === 'fighter-weapon-mastery')).toBe(true)
    expect(c24.active.some((a) => a.entity.id === 'fighter-tactical-mind')).toBe(false) // level 2
  })

  it('Potion of Healing: action in 2014, Bonus Action in 2024', () => {
    const drink14 = computeSheet(
      makeCharacter({ edition: '2014', inventory: [{ uid: 'p', itemId: 'potion-of-healing-common', quantity: 1 }] }),
      content2014,
    ).activities.find((a) => a.activity.id === 'drink')!
    expect(drink14.actionType).toBe('action')
    const drink24 = computeSheet(valdric(), content2024).activities.find((a) => a.activity.id === 'drink')!
    expect(drink24.actionType).toBe('bonusAction')
  })

  it('Exhaustion: 2014 halves speed at 2 and HP max at 4; 2024 is −2 per level on d20 tests and −5 ft', () => {
    const base14 = makeCharacter({ edition: '2014', classes: [{ classId: 'fighter', level: 4 }] })
    const e2 = computeSheet({ ...base14, exhaustion: 2 }, content2014)
    expect(e2.speed.value).toBe(15) // human 30 halved
    const e4 = computeSheet({ ...base14, exhaustion: 4 }, content2014)
    expect(e4.hpMax.value).toBe(Math.floor(computeSheet(base14, content2014).hpMax.value / 2))
    expect(e4.notes).toContain('Disadvantage on attack rolls and saving throws')

    const v = computeSheet(valdric({ exhaustion: 2 }), content2024)
    expect(v.speed.value).toBe(25)
    expect(v.attacks.find((a) => a.key === 'flail')!.attack.value).toBe(1)
    expect(v.saves.con.value).toBe(2)
    expect(v.initiative.value).toBe(-2)
    expect(v.hpMax.value).toBe(44)
  })
})

describe('Fighter progression', () => {
  it('Extra Attack: 2 at 5, 3 at 11, 4 at 20 in both editions', () => {
    for (const [edition, content] of [['2014', content2014], ['2024', content2024]] as const) {
      const apa = (level: number) => computeSheet(makeCharacter({ edition, classes: [{ classId: 'fighter', level }] }), content).attacks[0].attacksPerAction
      expect([4, 5, 11, 20].map(apa)).toEqual([1, 2, 3, 4])
    }
  })

  it('folds 2014 "(2 uses)" upgrades into one Action Surge pool', () => {
    const sheet = computeSheet(makeCharacter({ edition: '2014', classes: [{ classId: 'fighter', level: 17 }] }), content2014)
    expect(sheet.resources.filter((r) => r.resource.name === 'Action Surge')).toHaveLength(1)
    expect(sheet.resources.find((r) => r.key === 'action-surge')!.max).toBe(2)
    expect(sheet.resources.find((r) => r.key === 'indomitable')!.max).toBe(3)
  })

  it('2014 Champion: Superior Critical at 15, Remarkable Athlete only on non-proficient Str/Dex/Con checks', () => {
    const sheet = computeSheet(
      makeCharacter({
        edition: '2014',
        classes: [{ classId: 'fighter', level: 15, subclassId: 'champion' }],
        choices: { 'fighter/skills': ['athletics', 'perception'] },
      }),
      content2014,
    )
    expect(sheet.attacks[0].critRange).toBe(18)
    // PB 5 → half rounded up is 3. Human 2014 gets +1 to every score (11 → +0).
    expect(sheet.skills.athletics.value).toBe(5)
    expect(sheet.skills.acrobatics.value).toBe(3)
    expect(sheet.skills.history.value).toBe(0)
    expect(sheet.initiative.value).toBe(3)
  })
})

describe('armor and attacks', () => {
  it('Defense applies only while wearing armor', () => {
    const noArmor = valdric()
    noArmor.inventory = noArmor.inventory.filter((e) => e.uid !== 'armor')
    expect(computeSheet(noArmor, content2024).ac.value).toBe(10 + 2 + 2) // Dex 15 → +2, shield
  })

  it('heavy armor below its Strength requirement costs 10 ft', () => {
    const weak = valdric({ baseScores: { str: 11, dex: 14, con: 16, int: 13, wis: 16, cha: 9 } })
    expect(computeSheet(weak, content2024).speed.value).toBe(25)
  })

  it('ranged weapons use Dex, finesse uses the better of Str and Dex', () => {
    const c = makeCharacter({
      edition: '2024',
      speciesId: 'human',
      backgroundId: 'soldier',
      baseScores: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
      inventory: [
        { uid: 'bow', itemId: 'longbow', equipped: true },
        { uid: 'arrows', itemId: 'arrows', quantity: 20 },
        { uid: 'rapier', itemId: 'rapier', equipped: true },
      ],
    })
    const sheet = computeSheet(c, content2024)
    const bow = sheet.attacks.find((a) => a.key === 'bow')!
    expect(bow.ability).toBe('dex')
    expect(bow.attack.value).toBe(5)
    expect(bow.range).toEqual({ normal: 150, long: 600 })
    expect(bow.ammo).toEqual({ uid: 'arrows', remaining: 20, name: 'Arrows' })
    expect(sheet.attacks.find((a) => a.key === 'rapier')!.ability).toBe('dex')
  })
})

describe('core combat options', () => {
  it('2024 Grapple and Shove: DC 8 + Str + PB, replacing one attack', () => {
    const grapple = computeSheet(valdric(), content2024).activities.find((a) => a.activity.id === 'grapple')!
    expect(grapple.saveDc).toBe(13)
    expect(grapple.activity.costsAttack).toBe(true)
  })

  it('2014 Grapple is an Athletics check', () => {
    const c = makeCharacter({ edition: '2014', baseScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, choices: { 'fighter/skills': ['athletics', 'perception'] } })
    const grapple = computeSheet(c, content2014).activities.find((a) => a.activity.id === 'grapple')!
    expect(grapple.rollBonus).toBe(3 + 2) // human 2014: Str 17 (+3), proficient
    expect(grapple.saveDc).toBeUndefined()
  })
})

describe('manual overrides', () => {
  it('replace the computed value but keep it for "reset"', () => {
    const sheet = computeSheet(valdric({ overrides: { ac: 21 } }), content2024)
    expect(sheet.ac).toMatchObject({ value: 21, computed: 19, overridden: true })
  })
})
