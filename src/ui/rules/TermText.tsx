import { useMemo } from 'react'
import type { ContentIndex } from '../../content'
import { glossaryOf, splitTerms } from './glossary'
import { RuleRef } from './RuleRef'

/**
 * Free text (a spell's description, a feature's summary) with its rules terms linked:
 * Ctrl+hover a condition like Paralyzed to see what it does, Ctrl+click to open it.
 * `skip` leaves the entity being described unlinked.
 */
export function TermText({ text, content, skip }: { text: string; content: ContentIndex; skip?: string }) {
  const segments = useMemo(() => splitTerms(text, glossaryOf(content), skip), [text, content, skip])
  return (
    <>
      {segments.map((s, i) =>
        typeof s === 'string' ? (
          s
        ) : (
          <RuleRef key={i} entity={content.get(s.id)} content={content}>
            {s.text}
          </RuleRef>
        ),
      )}
    </>
  )
}
