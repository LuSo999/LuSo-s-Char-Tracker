// The content a character sees: SRD for its edition plus shared official packs.
import { useEffect, useMemo, useState } from 'react'
import { ContentIndex } from '../content'
import type { Edition, Pack } from '../content/schema'
import { loadSrd } from '../data/srd'
import { loadOfficial, useOfficial } from './official'

const srdCache = new Map<Edition, Promise<Pack>>()

function srd(edition: Edition) {
  if (!srdCache.has(edition)) srdCache.set(edition, loadSrd(edition))
  return srdCache.get(edition)!
}

export function useContent(edition: Edition | undefined): ContentIndex | undefined {
  const [srdPack, setSrdPack] = useState<Pack>()
  const official = useOfficial()

  useEffect(() => {
    void loadOfficial()
  }, [])

  useEffect(() => {
    if (!edition) return
    let cancelled = false
    void srd(edition).then((p) => !cancelled && setSrdPack(p))
    return () => {
      cancelled = true
    }
  }, [edition])

  return useMemo(() => {
    if (!edition || !srdPack || srdPack.edition !== edition) return undefined
    // Wait for the shared content once, so a character using it doesn't flash an error.
    if (official.status === 'idle' || official.status === 'loading') return undefined
    return new ContentIndex(edition, [srdPack, ...official.packs])
  }, [edition, srdPack, official.status, official.packs])
}
