// Small visual flavor effects. Anything can request one with `fx(kind)`;
// <Effects /> draws them on top of the app and removes them when done.
import { create } from 'zustand'
import { useSettings, type EffectLevel } from '../../state/settings'

export type FxKind =
  | 'physical' // silver slash at the click point
  | 'magic' // blue arcane burst at the click point
  | 'power' // golden pulse (Action Surge)
  | 'damage' // red veins at the screen edges
  | 'heal' // golden light with rays at the edges
  | 'temp' // light blue light with rays at the edges
  | 'shortRest' // warm candle-light fade
  | 'longRest' // deep night-blue fade
  | 'stable' // soft green edge glow
  | 'death' // the screen briefly drains of color
  | 'deny' // red flash + tiny shake (something you can't use)

export type FxItem = { id: number; kind: FxKind; x: number; y: number }

const DURATION: Record<FxKind, number> = {
  physical: 450,
  magic: 750,
  power: 700,
  damage: 900,
  heal: 1200,
  temp: 1100,
  shortRest: 1400,
  longRest: 1800,
  stable: 1100,
  death: 1800,
  deny: 350,
}

export const fxScale: Record<EffectLevel, number> = { off: 0, subtle: 0.55, standard: 1, strong: 1.6 }

export const useFx = create<{ items: FxItem[] }>(() => ({ items: [] }))

let next = 1
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const motionAllowed = () => !reducedMotion()

/** Play an effect; `at` is a screen point for effects that appear where you clicked. */
export function fx(kind: FxKind, at?: { x: number; y: number }) {
  if (useSettings.getState().effects === 'off') return
  const id = next++
  const x = at?.x ?? window.innerWidth / 2
  const y = at?.y ?? window.innerHeight / 2
  useFx.setState((s) => ({ items: [...s.items.slice(-5), { id, kind, x, y }] }))
  if (kind === 'deny' && motionAllowed()) shake()
  window.setTimeout(() => useFx.setState((s) => ({ items: s.items.filter((i) => i.id !== id) })), DURATION[kind])
}

/** A very small shake of the whole page. */
function shake() {
  const root = document.getElementById('root')
  if (!root) return
  root.classList.remove('fx-shake')
  // Restart the animation if it is already running.
  void root.offsetWidth
  root.classList.add('fx-shake')
  window.setTimeout(() => root.classList.remove('fx-shake'), 320)
}

/** Point in the middle of an element, for effects tied to a clicked row. */
export function centerOf(el: Element | null | undefined) {
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
