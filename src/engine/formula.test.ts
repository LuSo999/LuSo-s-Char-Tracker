import { describe, expect, it } from 'vitest'
import { evalFormula, FormulaError, resolveScaled } from './formula'

describe('evalFormula', () => {
  const vars = { pb: 3, level: 7, str: 4, con: -1 }

  it('handles arithmetic, precedence and functions', () => {
    expect(evalFormula('1 + 2 * 3', vars)).toBe(7)
    expect(evalFormula('(1 + 2) * 3', vars)).toBe(9)
    expect(evalFormula('8 + pb + str', vars)).toBe(15)
    expect(evalFormula('ceil(pb / 2)', vars)).toBe(2)
    expect(evalFormula('floor(level / 2)', vars)).toBe(3)
    expect(evalFormula('max(1, con)', vars)).toBe(1)
    expect(evalFormula('-con', vars)).toBe(1)
  })

  it('rejects unknown names and bad input instead of guessing', () => {
    expect(() => evalFormula('wis', vars)).toThrow(FormulaError)
    expect(() => evalFormula('alert(1)', vars)).toThrow(FormulaError)
    expect(() => evalFormula('1 +', vars)).toThrow(FormulaError)
    expect(() => evalFormula('1; 2', vars)).toThrow(FormulaError)
  })
})

describe('resolveScaled', () => {
  const vars = { classLevel: 10, characterLevel: 4, pb: 4 }

  it('reads step tables by class level, or character level when asked', () => {
    const table = { byLevel: { 1: 2, 4: 3, 10: 4 } }
    expect(resolveScaled(table, vars)).toBe(4)
    expect(resolveScaled({ ...table, per: 'characterLevel' as const }, vars)).toBe(3)
    expect(resolveScaled({ byLevel: { 5: 1 } }, { ...vars, classLevel: 4 })).toBe(0)
  })

  it('evaluates formula entries inside tables', () => {
    expect(resolveScaled({ byLevel: { 1: 'pb' } }, vars)).toBe(4)
  })
})
