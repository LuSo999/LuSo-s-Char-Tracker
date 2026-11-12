// Development only: renders a sheet without signing in, so layout can be
// checked in a headless browser. Uses private files when they exist locally.
import { useEffect, useMemo, useState } from 'react'
import { ContentIndex } from '../content'
import { OfficialContent, Pack } from '../content/schema'
import { sampleChampion, sampleWizard } from '../data/samples'
import { loadSrd } from '../data/srd'
import { Character } from '../engine/character'
import { useMemoryStore } from '../state/history'
import { useSettings } from '../state/settings'
import { SheetView } from './sheet/SheetPage'

const privateFiles: Partial<Record<string, () => Promise<{ default: unknown }>>> = import.meta.glob<{ default: unknown }>('../../private/{official-content,valdric}.json')

export default function DevPreview() {
  // #/dev?strict tries the strict turn mode without signing in.
  useEffect(() => {
    if (location.hash.includes('strict')) useSettings.setState({ turnMode: 'strict' })
  }, [])
  const [state, setState] = useState<{ character: Character; packs: Pack[] }>()
  useEffect(() => {
    void (async () => {
      const [srd, other] = await Promise.all([loadSrd('2024'), loadSrd('2014')])
      const official = privateFiles['../../private/official-content.json']
      const valdric = privateFiles['../../private/valdric.json']
      const usePrivate = official !== undefined && valdric !== undefined && !location.hash.includes('sample') && !location.hash.includes('wizard')
      const packs = usePrivate ? OfficialContent.parse((await official!()).default).packs : []
      const input = location.hash.includes('wizard') ? sampleWizard : usePrivate ? (await valdric!()).default : sampleChampion
      const character = Character.parse({ id: 'dev', ...(input as object) })
      // #/dev?level=5 previews a higher level (e.g. Extra Attack).
      const level = Number(/level=(\d+)/.exec(location.hash)?.[1])
      if (level) character.classes[0] = { ...character.classes[0], level }
      setState({ character, packs: [srd, other, ...packs] })
    })()
  }, [])
  const content = useMemo(() => state && new ContentIndex('2024', state.packs), [state])
  if (!state || !content) return <p className="p-4">Loading…</p>
  return <MemorySheet initial={state.character} content={content} />
}

function MemorySheet({ initial, content }: { initial: Character; content: ContentIndex }) {
  const store = useMemoryStore(initial)
  return <SheetView character={store.character} content={content} store={store} />
}
