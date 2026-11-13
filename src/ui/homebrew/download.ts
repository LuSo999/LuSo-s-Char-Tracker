import type { Pack } from '../../content/schema'

/** Download a pack as JSON (to share with the group or keep a backup). */
export function exportPack(pack: Pack) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${pack.name.replace(/[^\w-]+/g, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
}
