// Development only: renders a sheet without signing in, so layout can be
// checked in a headless browser. Uses private files when they exist locally.
import { useEffect, useMemo, useState } from 'react'
import { ContentIndex } from '../content'
import { OfficialContent, Pack } from '../content/schema'
import { sampleChampion } from '../data/samples'
import { loadSrd } from '../data/srd'
import { Character } from '../engine/character'
import { SheetView } from './sheet/SheetPage'

const privateFiles: Partial<Record<string, () => Promise<{ default: unknown }>>> = import.meta.glob<{ default: unknown }>('../../private/{official-content,valdric}.json')

export default function DevPreview() {
  const [state, setState] = useState<{ character: Character; packs: Pack[] }>()
  useEffect(() => {
    void (async () => {
      const srd = await loadSrd('2024')
      const official = privateFiles['../../private/official-content.json']
      const valdric = privateFiles['../../private/valdric.json']
      const usePrivate = official !== undefined && valdric !== undefined && !location.hash.includes('sample')
      const packs = usePrivate ? OfficialContent.parse((await official!()).default).packs : []
      const input = usePrivate ? (await valdric!()).default : sampleChampion
      setState({ character: Character.parse({ id: 'dev', ...(input as object) }), packs: [srd, ...packs] })
    })()
  }, [])
  const content = useMemo(() => state && new ContentIndex('2024', state.packs), [state])
  if (!state || !content) return <p className="p-4">Loading…</p>
  return <SheetView character={state.character} content={content} />
}
