import { describe, expect, it } from 'vitest'
import type { ActionResult } from './actions'
import { performActivity } from './actions'
import { computeSheet } from './derive'
import { addCustomFeature, addExtra, removeExtra } from './extras'
import { srd, valdric } from './fixtures'
import { longRest } from './rest'

const content = srd('2024')
function okR(r: ActionResult) {
  if (!r.ok) throw new Error(r.error)
  return r.character
}

describe('extras', () => {
  it('a feat from the rules, granted by the DM, applies like any other', () => {
    const c = okR(addExtra(valdric(), content, 'alert', 'From the DM'))
    expect(computeSheet(c, content).initiative.value).toBe(2 + 2)
    expect(c.extras[0]).toMatchObject({ entityId: 'alert', note: 'From the DM' })
    expect(addExtra(c, content, 'alert').ok).toBe(false)
  })

  it('an own feature with uses, recharge and a bonus', () => {
    const c = okR(
      addCustomFeature(valdric(), {
        name: 'Blessing of the Owl',
        description: 'Once per day, see in the dark for an hour.',
        note: 'Backstory',
        actionType: 'bonusAction',
        uses: 1,
        recharge: 'longRest',
        effects: [{ target: 'ac', value: 1 }],
      }),
    )
    const s = computeSheet(c, content)
    expect(s.ac.value).toBe(20)
    const row = s.activities.find((a) => a.activity.name === 'Blessing of the Owl')!
    expect(row).toMatchObject({ actionType: 'bonusAction', uses: { remaining: 1, max: 1 } })
    const used = okR(performActivity(c, s, row))
    expect(computeSheet(used, content).resources.find((r) => r.resource.name === 'Blessing of the Owl')!.remaining).toBe(0)
    expect(computeSheet(longRest(used, content).character, content).resources.find((r) => r.resource.name === 'Blessing of the Owl')!.remaining).toBe(1)
  })

  it('removing an extra removes its effects', () => {
    const c = okR(addExtra(valdric(), content, 'alert'))
    const back = okR(removeExtra(c, content, c.extras[0].uid))
    expect(computeSheet(back, content).initiative.value).toBe(2)
  })

  it('needs a name', () => {
    expect(addCustomFeature(valdric(), { name: '  ' }).ok).toBe(false)
  })
})
