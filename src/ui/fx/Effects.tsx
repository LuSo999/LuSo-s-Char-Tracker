import { useSettings } from '../../state/settings'
import { fxScale, useFx, type FxItem } from './fx'

/** Edge glow with soft "god rays" from the top, used for healing and temporary HP. */
function EdgeLight({ color }: { color: string }) {
  return (
    <div className="fx-edge fx-light" style={{ '--fx-color': color } as React.CSSProperties}>
      <div className="fx-rays" />
    </div>
  )
}

function Item({ item }: { item: FxItem }) {
  const at = { left: item.x, top: item.y }
  switch (item.kind) {
    case 'physical':
      return <div className="fx-slash" style={at} />
    case 'magic':
      return (
        <div className="fx-magic" style={at}>
          <div className="fx-magic-ring" />
        </div>
      )
    case 'power':
      return <div className="fx-power" style={at} />
    case 'damage':
      return (
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
      )
    case 'heal':
      return <EdgeLight color="255 196 70" />
    case 'temp':
      return <EdgeLight color="120 200 255" />
    case 'stable':
      return <div className="fx-edge fx-glow" style={{ '--fx-color': '70 190 120' } as React.CSSProperties} />
    case 'shortRest':
      return <div className="fx-edge fx-glow fx-slow" style={{ '--fx-color': '230 150 60' } as React.CSSProperties} />
    case 'longRest':
      return <div className="fx-night" />
    case 'death':
      return <div className="fx-death" />
    case 'deny':
      return <div className="fx-edge fx-glow fx-fast" style={{ '--fx-color': '220 40 40' } as React.CSSProperties} />
  }
}

export function Effects() {
  const items = useFx((s) => s.items)
  const level = useSettings((s) => s.effects)
  if (level === 'off' || !items.length) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" style={{ '--fx': fxScale[level] } as React.CSSProperties} aria-hidden>
      {items.map((i) => (
        <Item key={i.id} item={i} />
      ))}
    </div>
  )
}
