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
