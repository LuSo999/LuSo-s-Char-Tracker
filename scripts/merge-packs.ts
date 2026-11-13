// Validates the private official-content packs and merges them into one file
// the admin uploads on the Content admin page.
//
//   node scripts/merge-packs.ts
//
// Input:  private/packs/*.json (never committed)
// Output: private/official-content.json
// Prints a review list: every entity, with unverified ones marked.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OfficialContent, Pack, type Entity } from '../src/content/schema.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packDir = join(root, 'private', 'packs')

const packs = readdirSync(packDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => {
    const result = Pack.safeParse(JSON.parse(readFileSync(join(packDir, f), 'utf8')))
    if (!result.success) {
      console.error(`${f}:`)
      for (const issue of result.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`)
      process.exit(1)
    }
    return result.data
  })

// References may point into the SRD of the same edition or into any pack.
const known = new Map<string, Set<string>>()
for (const edition of ['2014', '2024'] as const) {
  const srd = JSON.parse(readFileSync(join(root, 'src', 'data', 'srd', `${edition}.json`), 'utf8')) as Pack
  known.set(edition, new Set(srd.entities.map((e) => e.id)))
}
for (const p of packs) for (const e of p.entities) known.get(p.edition)!.add(e.id)

const problems: string[] = []
const check = (edition: string, id: string | undefined, from: string) => {
  if (id && !known.get(edition)!.has(id)) problems.push(`${from} → missing "${id}"`)
}
for (const p of packs) {
  for (const e of p.entities) {
    const at = `${p.id}/${e.id}`
    if (e.edition !== p.edition) problems.push(`${at}: edition ${e.edition} in a ${p.edition} pack`)
    if (e.type === 'subclass') {
      check(p.edition, e.class, at)
      e.levels.forEach((l) => l.features.forEach((f) => check(p.edition, f, at)))
    }
    if (e.type === 'feature') {
      check(p.edition, e.upgradeOf, at)
      check(p.edition, e.optionOf, at)
    }
    for (const c of e.choices) c.from?.ids?.forEach((id) => check(p.edition, id, `${at}/${c.id}`))
    // Spell references: granted spells, expanded lists, spell choice options, class extra spells.
    for (const g of e.spells) check(p.edition, g.id, `${at} spell`)
    for (const id of e.expandedSpells ?? []) check(p.edition, id, `${at} expandedSpells`)
    for (const c of e.choices) if (c.kind === 'spell') c.options?.forEach((id) => check(p.edition, id, `${at}/${c.id} option`))
    if (e.type === 'class' || e.type === 'subclass') for (const id of e.caster?.extraSpells ?? []) check(p.edition, id, `${at} extraSpells`)
  }
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const content = OfficialContent.parse({ version: new Date().toISOString(), packs })
writeFileSync(join(root, 'private', 'official-content.json'), JSON.stringify(content))

const label = (e: Entity) => `${e.verified ? '  ' : '? '}${e.name} (${e.type}${e.type === 'item' ? `/${e.kind}` : ''})`
for (const p of packs) {
  console.log(`\n${p.name} [${p.id}, ${p.edition}] — ${p.entities.length} entities`)
  for (const e of p.entities) console.log(label(e))
}
const unverified = packs.flatMap((p) => p.entities.filter((e) => !e.verified))
console.log(`\n${unverified.length} unverified (marked "?") — please check them against the book.`)
console.log(`Wrote private/official-content.json (${content.version})`)
