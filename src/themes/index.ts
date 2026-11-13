// Themes: each folder here is one theme (theme.json + optional background.webp
// and texture.webp). Adding a theme = adding a folder; nothing else changes.
import { z } from 'zod'

export const ThemeDef = z.object({
  name: z.string(),
  mode: z.enum(['light', 'dark']),
  colors: z.object({
    bg: z.string(),
    card: z.string(),
    text: z.string(),
    muted: z.string(),
    accent: z.string(),
    accentText: z.string(),
    border: z.string(),
    danger: z.string(),
  }),
  /** How much of the card color covers the texture (0–1). */
  cardOpacity: z.number().default(0.88),
  radius: z.string().optional(),
  /** Heading font stack (CSS font-family); the default is Roboto Condensed. */
  fontHeading: z.string().optional(),
})
export type Theme = z.infer<typeof ThemeDef> & { id: string; background?: string; texture?: string; frame?: string; corners?: string }

const defs = import.meta.glob('./*/theme.json', { eager: true, import: 'default' })
// URLs only: the images themselves load when a theme using them is applied.
const backgrounds = import.meta.glob('./*/background.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const textures = import.meta.glob('./*/texture.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>

// Ornate frames: frame.svg holds the edges, corners.svg the (larger) corner ornaments.
const frames = import.meta.glob('./*/frame.svg', { eager: true, import: 'default', query: '?url' }) as Record<string, string>
const corners = import.meta.glob('./*/corners.svg', { eager: true, import: 'default', query: '?url' }) as Record<string, string>

const folder = (path: string) => path.split('/')[1]

export const themes: Theme[] = Object.entries(defs)
  .map(([path, raw]) => {
    const id = folder(path)
    return { ...ThemeDef.parse(raw), id, background: backgrounds[`./${id}/background.webp`], texture: textures[`./${id}/texture.webp`], frame: frames[`./${id}/frame.svg`], corners: corners[`./${id}/corners.svg`] }
  })
  // Light and Dark first, then the illustrated themes by name.
  .sort((a, b) => Number(!!a.background) - Number(!!b.background) || a.name.localeCompare(b.name))

export const themeById = (id: string | undefined) => themes.find((t) => t.id === id)
