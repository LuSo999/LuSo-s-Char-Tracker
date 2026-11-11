// Safe evaluator for Scaled values from content data. Formulas are tiny
// arithmetic expressions; no JavaScript is ever evaluated.
//
// Grammar:  expr := term (('+' | '-') term)*
//           term := unary (('*' | '/') unary)*
//           unary := '-' unary | atom
//           atom := number | name | name '(' expr (',' expr)* ')' | '(' expr ')'
// Functions: floor, ceil, round, min, max. Division is exact; wrap in floor()
// where the rules round down.
import type { Scaled } from '../content/schema'

export type FormulaVars = Readonly<Record<string, number>>

type Token = { kind: 'num'; value: number } | { kind: 'name'; value: string } | { kind: 'op'; value: string }

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t') {
      i++
    } else if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      tokens.push({ kind: 'num', value: Number(src.slice(i, j)) })
      i = j
    } else if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_.]/.test(src[j])) j++
      tokens.push({ kind: 'name', value: src.slice(i, j) })
      i = j
    } else if ('+-*/(),'.includes(c)) {
      tokens.push({ kind: 'op', value: c })
      i++
    } else {
      throw new FormulaError(`Unexpected character "${c}"`, src)
    }
  }
  return tokens
}

export class FormulaError extends Error {
  constructor(message: string, formula: string) {
    super(`${message} in formula "${formula}"`)
  }
}

const functions: Record<string, (...args: number[]) => number> = {
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: Math.min,
  max: Math.max,
}

export function evalFormula(src: string, vars: FormulaVars): number {
  const tokens = tokenize(src)
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (v: string) => peek()?.kind === 'op' && peek()!.value === v

  function expect(v: string) {
    if (!isOp(v)) throw new FormulaError(`Expected "${v}"`, src)
    pos++
  }

  function expr(): number {
    let left = term()
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++].value
      const right = term()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function term(): number {
    let left = unary()
    while (isOp('*') || isOp('/')) {
      const op = tokens[pos++].value
      const right = unary()
      left = op === '*' ? left * right : left / right
    }
    return left
  }

  function unary(): number {
    if (isOp('-')) {
      pos++
      return -unary()
    }
    return atom()
  }

  function atom(): number {
    const t = peek()
    if (!t) throw new FormulaError('Unexpected end', src)
    if (t.kind === 'num') {
      pos++
      return t.value
    }
    if (t.kind === 'op' && t.value === '(') {
      pos++
      const v = expr()
      expect(')')
      return v
    }
    if (t.kind === 'name') {
      pos++
      if (isOp('(')) {
        const fn = functions[t.value]
        if (!fn) throw new FormulaError(`Unknown function "${t.value}"`, src)
        pos++
        const args = [expr()]
        while (isOp(',')) {
          pos++
          args.push(expr())
        }
        expect(')')
        return fn(...args)
      }
      const v = vars[t.value]
      if (v === undefined) throw new FormulaError(`Unknown variable "${t.value}"`, src)
      return v
    }
    throw new FormulaError(`Unexpected "${t.value}"`, src)
  }

  const result = expr()
  if (pos !== tokens.length) throw new FormulaError('Unexpected trailing input', src)
  return result
}

/**
 * Resolve a Scaled value. `classLevel` is the level in the class that owns the
 * entity (equal to character level for species, backgrounds and feats).
 * Step tables return 0 below their first level.
 */
export function resolveScaled(value: Scaled, vars: FormulaVars): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return evalFormula(value, vars)
  const level = value.per === 'characterLevel' ? vars.characterLevel : vars.classLevel
  let current: number | string = 0
  for (const [lvl, v] of Object.entries(value.byLevel).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    if (Number(lvl) <= level) current = v
  }
  return typeof current === 'number' ? current : evalFormula(current, vars)
}
