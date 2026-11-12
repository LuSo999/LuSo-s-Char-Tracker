import { describe, expect, it } from 'vitest'
import { computeSheet } from '../engine/derive'
import { srdBoth, valdric } from '../engine/fixtures'
import { addItem } from '../engine/inventory'

const content = srdBoth('2024')

describe('items from the other edition', () => {
  it('are available under an edition-prefixed id, hidden unless asked for', () => {
    expect(content.item('2014:potion-of-healing-common')?.edition).toBe('2014')
    expect(content.isForeign('2014:potion-of-healing-common')).toBe(true)
    expect(content.all('item').some((i) => i.id.startsWith('2014:'))).toBe(false)
    expect(content.all('item', { foreign: true }).some((i) => i.id.startsWith('2014:'))).toBe(true)
  })

  it('keep their own rules: a 2014 Potion of Healing takes an action', () => {
    const c = valdric({ inventory: [{ uid: 'p', itemId: '2014:potion-of-healing-common', quantity: 1 }] })
    expect(computeSheet(c, content).activities.find((a) => a.activity.id === 'drink')!.actionType).toBe('action')
  })

  it('magic weapons link to this edition\'s base items (with Weapon Mastery)', () => {
    expect(content.item('2014:weapon-1')).toMatchObject({ baseOptions: expect.arrayContaining(['longsword', 'flail']) })
    const r = addItem(valdric(), content, '2014:weapon-1', 1, 'flail')
    if (!r.ok) throw new Error(r.error)
    const c = { ...r.character, inventory: r.character.inventory.map((e) => (e.itemId === '2014:weapon-1' ? { ...e, equipped: true } : e)) }
    const atk = computeSheet(c, content).attacks.find((a) => a.name === 'Flail +1')!
    expect([atk.attack.value, atk.mastery]).toEqual([6, 'sap'])
  })

  it('ammunition kinds are translated (2014 Arrow fits a 2024 longbow)', () => {
    expect(content.item('2014:arrow')).toMatchObject({ ammoKind: 'arrows' })
  })
})
