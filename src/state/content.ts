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

const otherEdition = (e: Edition): Edition => (e === '2014' ? '2024' : '2014')

export function useContent(edition: Edition | undefined): ContentIndex | undefined {
  // This edition's SRD plus the other one, whose items can be used too.
  const [srdPacks, setSrdPacks] = useState<Pack[]>()
  const official = useOfficial()

  useEffect(() => {
    void loadOfficial()
  }, [])

  useEffect(() => {
    if (!edition) return
    let cancelled = false
    void Promise.all([srd(edition), srd(otherEdition(edition))]).then((p) => !cancelled && setSrdPacks(p))
    return () => {
      cancelled = true
    }
  }, [edition])

  return useMemo(() => {
    if (!edition || !srdPacks || srdPacks[0].edition !== edition) return undefined
    // Wait for the shared content once, so a character using it doesn't flash an error.
    if (official.status === 'idle' || official.status === 'loading') return undefined
    return new ContentIndex(edition, [...srdPacks, ...official.packs])
  }, [edition, srdPacks, official.status, official.packs])
}
