// Applies the chosen theme: the account's default, or a character's own while its sheet is open.
import { create } from 'zustand'
import { themeById, type Theme } from '../themes'

/** A character's theme, set while its sheet is shown (undefined: the account's). */
export const useThemeOverride = create<{ id?: string }>(() => ({}))

const vars: Record<keyof Theme['colors'], string> = {
  bg: '--color-bg',
  card: '--color-card',
  text: '--color-text',
  muted: '--color-muted',
  accent: '--color-accent',
  accentText: '--color-accent-text',
  border: '--color-border',
  danger: '--color-danger',
}

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
let current: string | undefined
// "System" follows the OS when it switches between light and dark.
if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(current))

/** "system" (or an unknown id) follows the OS light / dark setting through the CSS defaults. */
export function applyTheme(id: string | undefined) {
  current = id
  const root = document.documentElement
  const theme = themeById(id)
  root.dataset.mode = theme ? theme.mode : systemDark() ? 'dark' : 'light'
  for (const v of Object.values(vars)) root.style.removeProperty(v)
  for (const v of ['--app-bg', '--card-texture', '--card-opacity', 'color-scheme']) root.style.removeProperty(v)
  delete root.dataset.appTheme
  delete root.dataset.textured
  if (!theme) return
  root.dataset.appTheme = theme.id
  for (const [k, v] of Object.entries(theme.colors)) root.style.setProperty(vars[k as keyof Theme['colors']], v)
  root.style.setProperty('color-scheme', theme.mode)
  if (theme.radius) root.style.setProperty('--radius-card', theme.radius)
  if (theme.background) root.style.setProperty('--app-bg', `url("${theme.background}")`)
  if (theme.texture) {
    root.style.setProperty('--card-texture', `url("${theme.texture}")`)
    root.style.setProperty('--card-opacity', `${Math.round(theme.cardOpacity * 100)}%`)
    root.dataset.textured = ''
  }
}
