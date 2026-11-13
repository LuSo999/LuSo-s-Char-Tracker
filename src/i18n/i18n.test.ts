import { describe, expect, it } from 'vitest'
import cs from './cs.json'
import en from './en.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('translations', () => {
  it('cs has exactly the same keys as en', () => {
    expect(keys(cs).sort()).toEqual(keys(en).sort())
  })
})

describe('keys used in code', () => {
  it('every literal t("…") key and every engine error exists', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const files: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx?$/.test(f) && !/\.test\.ts$/.test(f)) files.push(p)
      }
    }
    walk('src')
    const all = new Set(keys(en))
    const has = (k: string) => all.has(k) || [...all].some((x) => x.startsWith(`${k}_`) || x.startsWith(`${k}.`))
    const missing = new Set<string>()
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z][\w]*(?:\.[\w]+)+)'/g)) if (!has(m[1])) missing.add(`${m[1]}  (${f})`)
      // Errors the engine returns are shown as errors.<code>.
      for (const m of src.matchAll(/error: '(\w+)'/g)) if (m[1] !== 'noChange' && !has(`errors.${m[1]}`)) missing.add(`errors.${m[1]}  (${f})`)
    }
    expect([...missing].sort()).toEqual([])
  })
})
