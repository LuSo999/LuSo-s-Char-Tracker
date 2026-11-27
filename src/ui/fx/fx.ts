// Visual flavor effects. Anything can request one with `fx(kind)`;
// <Effects /> draws them on top of the app and removes them when done.
import { create } from 'zustand'
import { useSettings, type EffectLevel } from '../../state/settings'

export type FxKind =
  | 'physical' // a weapon hit at the click point: slash, thrust or smash by damage type
  | 'magic' // a spell at the click point: rune circle, bloom and particles in the spell's colors
  | 'power' // golden pulse (Action Surge)
  | 'damage' // red pulse and veins at the screen edges, a shake
  | 'heal' // golden light, rays and rising motes
  | 'temp' // light blue light, rays and rising motes
  | 'shortRest' // warm candle-light fade
  | 'longRest' // deep night-blue fade
  | 'stable' // soft green edge glow
  | 'death' // the screen briefly drains of color
  | 'deny' // red flash + tiny shake (something you can't use)

/**
 * variant: a damage type (slashing, fire…) or a spell school (evocation…) that picks the look;
 * power: spell slot level (0–9), bigger and longer for higher levels;
 * magic: a magic weapon, the hit gets an arcane glow.
 */
export type FxOptions = { variant?: string; power?: number; magic?: boolean }

export type FxItem = { id: number; kind: FxKind; x: number; y: number; duration: number } & FxOptions

/** Base length of each effect in ms, before the level's time scale. */
const DURATION: Record<FxKind, number> = {
  physical: 950,
  magic: 1400,
  power: 1100,
  damage: 1800,
  heal: 2200,
  temp: 1900,
  shortRest: 1800,
  longRest: 2200,
  stable: 1500,
  death: 2200,
  deny: 400,
}

/** Size and strength of the effects per setting. */
export const fxScale: Record<EffectLevel, number> = { off: 0, subtle: 0.6, standard: 1.15, strong: 1.8 }
/** How long they last per setting: strong effects also linger. */
export const fxTime: Record<EffectLevel, number> = { off: 0, subtle: 0.8, standard: 1, strong: 1.3 }

export const useFx = create<{ items: FxItem[] }>(() => ({ items: [] }))

let next = 1
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const motionAllowed = () => !reducedMotion()

/** Play an effect; `at` is a screen point for effects that appear where you clicked. */
export function fx(kind: FxKind, at?: { x: number; y: number }, opts: FxOptions = {}) {
  const level = useSettings.getState().effects
  if (level === 'off') return
  const id = next++
  const x = at?.x ?? window.innerWidth / 2
  const y = at?.y ?? window.innerHeight / 2
  const extra = kind === 'magic' ? (opts.power ?? 0) * 70 : 0
  const duration = Math.round((DURATION[kind] + extra) * fxTime[level])
  useFx.setState((s) => ({ items: [...s.items.slice(-7), { id, kind, x, y, duration, ...opts }] }))
  if (motionAllowed()) {
    const strength = fxScale[level]
    if (kind === 'deny') shake(2, 300)
    if (kind === 'damage') shake(5 * strength, 450)
    if (kind === 'physical' && opts.variant === 'bludgeoning') shake(6 * strength, 380)
    if (kind === 'magic' && ['thunder', 'force', 'lightning'].includes(opts.variant ?? '')) shake(3 * strength, 350)
  }
  // A little longer than the animation, so nothing is cut off at its very end.
  window.setTimeout(() => useFx.setState((s) => ({ items: s.items.filter((i) => i.id !== id) })), duration + 150)
}

/** Shake the whole page: `px` is how far, `ms` how long. */
function shake(px: number, ms: number) {
  const root = document.getElementById('root')
  if (!root) return
  root.classList.remove('fx-shake')
  root.style.setProperty('--shake', `${px.toFixed(1)}px`)
  root.style.setProperty('--shake-time', `${ms}ms`)
  // Restart the animation if it is already running.
  void root.offsetWidth
  root.classList.add('fx-shake')
  window.setTimeout(() => root.classList.remove('fx-shake'), ms + 20)
}

/** Point in the middle of an element, for effects tied to a clicked row. */
export function centerOf(el: Element | null | undefined) {
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
