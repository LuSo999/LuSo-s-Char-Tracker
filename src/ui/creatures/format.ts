import type { CreatureActionView } from '../../engine/creatures'
import { signed } from '../sheet/format'

/** One action line: name, attack bonus, damage, save DC. */
export function actionSummary(a: CreatureActionView, toHit: string) {
  return [a.attack && `${signed(a.attack.bonus)} ${toHit}`, a.attack?.range, a.damage, a.save && `DC ${a.save.dc} ${a.save.ability.toUpperCase()}`].filter(Boolean).join(' · ')
}
