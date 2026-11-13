// Every theme folder is valid and readable: contrast checked against WCAG (cards over their texture).
import { describe, expect, it } from 'vitest'
import { themes } from '.'

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('Themes', () => {
  it('Light, Dark and the eleven illustrated themes exist', () => {
    expect(themes.map((t) => t.id)).toEqual(expect.arrayContaining(['light', 'dark', 'scroll', 'holy', 'ancient-temple', 'battlefield', 'forest', 'kraken', 'magic', 'music', 'ship', 'smithy', 'dark-fey-forest']))
    for (const t of themes.filter((x) => !['light', 'dark'].includes(x.id))) {
      expect(t.background, t.id).toBeTruthy()
      expect(t.texture, t.id).toBeTruthy()
    }
  })

  for (const t of themes) {
    it(`${t.id}: text is readable`, () => {
      const c = t.colors
      expect(ratio(c.text, c.card)).toBeGreaterThanOrEqual(7)
      expect(ratio(c.text, c.bg)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(c.muted, c.card)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(c.accent, c.card)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(c.accentText, c.accent)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(c.danger, c.card)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
