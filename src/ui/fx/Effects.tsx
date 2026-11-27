import { useSettings } from '../../state/settings'
import { fxScale, useFx, type FxItem } from './fx'

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

/** Deterministic random numbers per effect (the same effect renders the same on every render). */
function prng(seed: number) {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Colors (as "r g b") and the particle style for each damage type and spell school. */
type Palette = { main: string; glow: string; style: 'burst' | 'fire' | 'ice' | 'bolt' | 'smoke' | 'ring' | 'holy' }
const palettes: Record<string, Palette> = {
  // Damage types
  fire: { main: '255 140 40', glow: '255 60 20', style: 'fire' },
  cold: { main: '170 230 255', glow: '80 170 255', style: 'ice' },
  lightning: { main: '255 250 200', glow: '120 170 255', style: 'bolt' },
  thunder: { main: '200 215 255', glow: '90 110 220', style: 'ring' },
  acid: { main: '170 255 90', glow: '60 200 40', style: 'burst' },
  poison: { main: '170 255 120', glow: '120 40 180', style: 'smoke' },
  necrotic: { main: '150 255 170', glow: '60 10 70', style: 'smoke' },
  radiant: { main: '255 240 170', glow: '255 200 60', style: 'holy' },
  force: { main: '210 180 255', glow: '130 70 255', style: 'ring' },
  psychic: { main: '255 160 230', glow: '210 60 200', style: 'burst' },
  // Spells that heal
  heal: { main: '255 235 150', glow: '255 190 60', style: 'holy' },
  // Schools, for spells without damage
  abjuration: { main: '170 210 255', glow: '60 130 255', style: 'ring' },
  conjuration: { main: '255 225 140', glow: '230 160 40', style: 'burst' },
  divination: { main: '220 245 255', glow: '120 200 230', style: 'holy' },
  enchantment: { main: '255 180 230', glow: '230 80 180', style: 'burst' },
  illusion: { main: '215 180 255', glow: '150 80 240', style: 'smoke' },
  necromancy: { main: '150 255 170', glow: '60 10 70', style: 'smoke' },
  transmutation: { main: '255 210 120', glow: '220 140 30', style: 'burst' },
  evocation: { main: '255 170 90', glow: '255 90 40', style: 'fire' },
}
const arcane: Palette = { main: '170 200 255', glow: '80 110 255', style: 'burst' }
const paletteOf = (variant?: string) => palettes[(variant ?? '').toLowerCase()] ?? arcane

/** Sparks, embers, shards or dust flying out of a point. */
function Particles({ item, count, color, distance, gravity = 0, shard = false, size = 6, spread = 360, angle = 0 }: {
  item: FxItem
  count: number
  color: string
  distance: number
  gravity?: number
  shard?: boolean
  size?: number
  spread?: number
  angle?: number
}) {
  const rnd = prng(item.id * 31 + count)
  return (
    <div className="absolute" style={{ left: item.x, top: item.y }}>
      {Array.from({ length: count }, (_, i) => {
        const style: CSSVars = {
          '--c': color,
          '--a': `${angle - spread / 2 + rnd() * spread}deg`,
          '--r': `calc(${Math.round(distance * (0.45 + rnd() * 0.75))}px * var(--fx))`,
          '--s': `calc(${(size * (0.5 + rnd())).toFixed(1)}px * var(--fx))`,
          '--dy': `calc(${Math.round(gravity * (0.6 + rnd() * 0.8))}px * var(--fx))`,
          '--dl': `${Math.round(rnd() * 120)}ms`,
        }
        return <div key={i} className={shard ? 'fx-spark fx-shard' : 'fx-spark'} style={style} />
      })}
    </div>
  )
}

/** A jagged lightning bolt from the top of the screen down to the point. */
function Bolt({ item }: { item: FxItem }) {
  const rnd = prng(item.id * 7)
  const steps = 9
  const startX = item.x + (rnd() - 0.5) * 160
  const points: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = startX + (item.x - startX) * t + (i === 0 || i === steps ? 0 : (rnd() - 0.5) * 70)
    points.push(`${x.toFixed(0)},${(item.y * t).toFixed(0)}`)
  }
  return (
    <svg className="fx-bolt absolute inset-0 h-full w-full" aria-hidden>
      <polyline points={points.join(' ')} fill="none" stroke="rgb(140 180 255 / 0.55)" strokeWidth="14" strokeLinejoin="round" style={{ filter: 'blur(6px)' }} />
      <polyline points={points.join(' ')} fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  )
}

/** The rotating circle of runes under a spell. */
function RuneCircle() {
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg viewBox="-100 -100 200 200" className="fx-rune" aria-hidden>
      <circle r="92" fill="none" stroke="rgb(var(--fx-main))" strokeWidth="2.5" />
      <circle r="78" fill="none" stroke="rgb(var(--fx-main) / 0.8)" strokeWidth="1.5" strokeDasharray="4 7" />
      <circle r="46" fill="none" stroke="rgb(var(--fx-main) / 0.9)" strokeWidth="2" />
      <polygon points="0,-78 67.5,39 -67.5,39" fill="none" stroke="rgb(var(--fx-main) / 0.75)" strokeWidth="1.5" />
      <polygon points="0,78 67.5,-39 -67.5,-39" fill="none" stroke="rgb(var(--fx-main) / 0.75)" strokeWidth="1.5" />
      {ticks.map((a) => (
        <rect key={a} x="-3" y="-90" width="6" height="10" rx="1" fill="rgb(var(--fx-main))" transform={`rotate(${a})`} />
      ))}
    </svg>
  )
}

function Spell({ item }: { item: FxItem }) {
  const p = paletteOf(item.variant)
  const power = 1 + Math.min(9, Math.max(0, item.power ?? 0)) * 0.13
  const style: CSSVars = { '--fx-main': p.main, '--fx-color': p.glow, '--pw': power }
  const far = 170 * power
  return (
    <div className="absolute inset-0" style={style}>
      <div className="fx-edge fx-glow" />
      {p.style === 'bolt' && <Bolt item={item} />}
      <div className="fx-at" style={{ left: item.x, top: item.y }}>
        <RuneCircle />
        <div className="fx-bloom" />
        {(p.style === 'ring' || p.style === 'holy') && <div className="fx-ring" />}
        {p.style === 'ring' && <div className="fx-ring fx-ring-late" />}
        {p.style === 'holy' && <div className="fx-rays-point" />}
      </div>
      {p.style === 'fire' && <Particles item={item} count={34} color={p.main} distance={far * 0.8} gravity={-170} size={8} />}
      {p.style === 'ice' && <Particles item={item} count={26} color={p.main} distance={far} shard size={7} />}
      {p.style === 'bolt' && <Particles item={item} count={22} color={p.main} distance={far} shard size={5} />}
      {p.style === 'smoke' && <Particles item={item} count={28} color={p.main} distance={far * 0.7} gravity={-90} size={12} />}
      {p.style === 'burst' && <Particles item={item} count={30} color={p.main} distance={far} size={7} />}
      {(p.style === 'ring' || p.style === 'holy') && <Particles item={item} count={22} color={p.main} distance={far * 1.1} size={6} />}
    </div>
  )
}

function Weapon({ item }: { item: FxItem }) {
  const at = { left: item.x, top: item.y }
  const glow = item.magic ? '170 140 255' : '230 236 245'
  const style: CSSVars = { '--fx-color': glow, '--fx-main': item.magic ? '200 180 255' : '255 230 170' }
  const kind = (item.variant ?? 'slashing').toLowerCase()
  return (
    <div className="absolute inset-0" style={style}>
      {item.magic && <div className="fx-edge fx-glow fx-glow-soft" />}
      <div className="fx-at" style={at}>
        <div className="fx-impact" />
        {kind === 'piercing' ? (
          <>
            <div className="fx-thrust" />
            <div className="fx-ring fx-ring-small" />
          </>
        ) : kind === 'bludgeoning' ? (
          <>
            <div className="fx-ring fx-ring-heavy" />
            <div className="fx-ring fx-ring-heavy fx-ring-late" />
          </>
        ) : (
          <>
            <div className="fx-slash" />
            <div className="fx-slash fx-slash-2" />
          </>
        )}
        {item.magic && <div className="fx-bloom fx-bloom-small" />}
      </div>
      {kind === 'bludgeoning' ? (
        <Particles item={item} count={22} color="180 160 135" distance={150} gravity={60} size={10} />
      ) : kind === 'piercing' ? (
        <Particles item={item} count={16} color={item.magic ? '200 180 255' : '255 225 150'} distance={150} shard size={5} spread={140} />
      ) : (
        <Particles item={item} count={20} color={item.magic ? '200 180 255' : '255 225 150'} distance={170} gravity={40} shard size={5} />
      )}
    </div>
  )
}

/** Edge glow with "god rays" from the top and motes rising from the bottom: healing and temporary HP. */
function EdgeLight({ item, color }: { item: FxItem; color: string }) {
  const rnd = prng(item.id * 13)
  return (
    <div className="absolute inset-0" style={{ '--fx-color': color } as CSSVars}>
      <div className="fx-edge fx-light">
        <div className="fx-rays" />
      </div>
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={i}
          className="fx-mote"
          style={{ left: `${(rnd() * 100).toFixed(1)}%`, '--s': `calc(${(4 + rnd() * 6).toFixed(1)}px * var(--fx))`, '--rise': `${Math.round(30 + rnd() * 50)}vh`, '--dl': `${Math.round(rnd() * 500)}ms` } as CSSVars}
        />
      ))}
    </div>
  )
}

function Item({ item }: { item: FxItem }) {
  switch (item.kind) {
    case 'physical':
      return <Weapon item={item} />
    case 'magic':
      return <Spell item={item} />
    case 'power':
      return (
        <div className="absolute inset-0" style={{ '--fx-color': '255 190 60', '--fx-main': '255 215 110' } as CSSVars}>
          <div className="fx-edge fx-glow fx-glow-soft" />
          <div className="fx-at" style={{ left: item.x, top: item.y }}>
            <div className="fx-ring fx-ring-heavy" />
            <div className="fx-ring fx-ring-heavy fx-ring-late" />
            <div className="fx-bloom" />
          </div>
          <Particles item={item} count={24} color="255 215 110" distance={190} size={7} />
        </div>
      )
    case 'damage':
      return (
        <>
          <div className="fx-vignette" style={{ '--fx-color': '200 0 0' } as CSSVars} />
          <div className="fx-edge fx-damage">
            {/* Ridged turbulence: its near-zero creases become thin dark-red "veins", masked to the edges. */}
            <svg className="h-full w-full" preserveAspectRatio="none" aria-hidden>
              <filter id={`veins-${item.id}`}>
                <feTurbulence type="turbulence" baseFrequency="0.009 0.018" numOctaves="2" seed={item.id % 50} />
                <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0  0 0 0 0 0.02  -34 0 0 0 2.5" />
              </filter>
              <rect width="100%" height="100%" filter={`url(#veins-${item.id})`} />
            </svg>
          </div>
        </>
      )
    case 'heal':
      return <EdgeLight item={item} color="255 196 70" />
    case 'temp':
      return <EdgeLight item={item} color="120 200 255" />
    case 'stable':
      return <div className="fx-edge fx-glow" style={{ '--fx-color': '70 190 120' } as CSSVars} />
    case 'shortRest':
      return <div className="fx-edge fx-glow" style={{ '--fx-color': '230 150 60' } as CSSVars} />
    case 'longRest':
      return <div className="fx-night" />
    case 'death':
      return <div className="fx-death" />
    case 'deny':
      return <div className="fx-edge fx-glow" style={{ '--fx-color': '220 40 40' } as CSSVars} />
  }
}

export function Effects() {
  const items = useFx((s) => s.items)
  const level = useSettings((s) => s.effects)
  if (level === 'off' || !items.length) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" style={{ '--fx': fxScale[level] } as CSSVars} aria-hidden>
      {items.map((i) => (
        // --d: this effect's length, so every animation inside ends when the effect is removed.
        <div key={i.id} className="absolute inset-0" style={{ '--d': `${i.duration}ms` } as CSSVars}>
          <Item item={i} />
        </div>
      ))}
    </div>
  )
}
