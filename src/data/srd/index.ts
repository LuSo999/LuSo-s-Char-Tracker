import type { Edition, Pack } from '../../content/schema'

/** Built-in SRD content, loaded on demand so each edition is its own chunk. */
export async function loadSrd(edition: Edition): Promise<Pack> {
  const mod = edition === '2014' ? await import('./2014.json') : await import('./2024.json')
  return mod.default as Pack
}
