import { useSheet } from '../sheet/context'
import { RuleRef } from './RuleRef'

/**
 * A rules term on the sheet (Concentration, Bonus Action, AC, a skill, a
 * weapon property): Ctrl+hover explains it, Ctrl+click opens the rules page.
 * `id` is a rule entity id: "rule-…", "property-…" or "skill-…".
 */
export function Term({ id, children, className = '' }: { id: string; children: React.ReactNode; className?: string }) {
  const { content } = useSheet()
  return (
    <RuleRef entity={content.get(id)} content={content} className={className}>
      {children}
    </RuleRef>
  )
}

/** Weapon properties as terms, separated by commas ("versatile" → property-versatile). */
export function PropertyList({ properties }: { properties: string[] }) {
  return (
    <>
      {properties.map((p, i) => (
        <span key={p}>
          {i > 0 && ', '}
          <Term id={`property-${p}`}>{p}</Term>
        </span>
      ))}
    </>
  )
}
