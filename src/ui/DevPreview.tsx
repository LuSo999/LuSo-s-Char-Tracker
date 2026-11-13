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
import { Route, Routes, useNavigate } from 'react-router'
import { enableMemoryHomebrew } from '../state/homebrew'
import { HomebrewBase } from './homebrew/base'
import { HomebrewPage } from './homebrew/HomebrewPage'
import { PackPage } from './homebrew/PackPage'
import { EntityEditor } from './homebrew/EntityEditor'
import { CreatePage } from './create/CreatePage'

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
      let character = Character.parse({ id: 'dev', ...(input as object) })
      // #/dev?class=barbarian&ed=2014 previews any SRD class (with its SRD subclass) in either edition.
      const classId = /class=([a-z-]+)/.exec(location.hash)?.[1]
      const edition = location.hash.includes('ed=2014') ? '2014' : '2024'
      if (classId) {
        const pack = edition === '2014' ? other : srd
        const subclass = pack.entities.find((e) => e.type === 'subclass' && e.class === classId)
        character = Character.parse({
          id: 'dev', name: `Sample ${classId}`, edition, speciesId: 'human', backgroundId: edition === '2014' ? 'acolyte' : 'soldier',
          classes: [{ classId, level: 1, subclassId: subclass?.id }],
          baseScores: { str: 15, dex: 14, con: 14, int: 10, wis: 13, cha: 12 }, hp: { current: 60 },
          inventory: [
            { uid: 'w1', itemId: 'greataxe', quantity: 1, equipped: true },
            { uid: 'w2', itemId: 'shortsword', quantity: 1, equipped: true },
            { uid: 'w3', itemId: 'shortbow', quantity: 1, equipped: false },
            { uid: 'w4', itemId: 'javelin', quantity: 5, equipped: true },
            { uid: 'w5', itemId: 'arrows', quantity: 20, equipped: false },
          ],
        })
      }
      // #/dev?level=5 previews a higher level (e.g. Extra Attack).
      const level = Number(/level=(\d+)/.exec(location.hash)?.[1])
      if (level) character.classes[0] = { ...character.classes[0], level }
      setState({ character, packs: edition === '2014' && classId ? [other, srd, ...packs] : [srd, other, ...packs] })
    })()
  }, [])
  const content = useMemo(() => state && new ContentIndex(state.character.edition, state.packs), [state])
  // #/dev/new tries character creation; the result opens as a sheet in memory.
  const navigate = useNavigate()
  const [created, setCreated] = useState<{ character: Character; levelTo: number }>()
  const createdContent = useMemo(() => created && state && new ContentIndex(created.character.edition, created.character.edition === '2014' ? [...state.packs].reverse() : state.packs), [created, state])
  // #/dev/homebrew tries the homebrew editor with packs kept in memory.
  if (location.hash.startsWith('#/dev/homebrew')) return <DevHomebrew />
  if (location.hash.startsWith('#/dev/new') && !created) {
    return (
      <CreatePage
        uid="dev"
        onCreate={(character, levelTo) => {
          setCreated({ character: { ...character, id: 'dev' }, levelTo })
          // The sheet reads the levels still to gain from the location state, as after a real creation.
          navigate('/dev/created', { state: levelTo > 1 ? { levelTo } : undefined })
        }}
      />
    )
  }
  if (created && createdContent) return <MemorySheet initial={created.character} content={createdContent} />
  if (!state || !content) return <p className="p-4">Loading…</p>
  return <MemorySheet initial={state.character} content={content} />
}

function DevHomebrew() {
  useEffect(() => enableMemoryHomebrew(), [])
  return (
    <HomebrewBase.Provider value="/dev/homebrew">
      <Routes>
        <Route path="/dev/homebrew" element={<HomebrewPage uid="dev" />} />
        <Route path="/dev/homebrew/:packId" element={<PackPage uid="dev" />} />
        <Route path="/dev/homebrew/:packId/:entityId" element={<EntityEditor uid="dev" />} />
      </Routes>
    </HomebrewBase.Provider>
  )
}

function MemorySheet({ initial, content }: { initial: Character; content: ContentIndex }) {
  const store = useMemoryStore(initial)
  return <SheetView character={store.character} content={content} store={store} />
}
