// Small motion helpers for the Alt Look. The animations themselves live in index.css (.anim-*).
import type { CSSProperties } from 'react'

/**
 * Stagger list rows: the inline style for the row at `index` (0-based) in a list using
 * `.anim-row`. It sets --stagger-delay, which .anim-row reads as its animation-delay.
 */
export function staggerStyle(index: number): CSSProperties {
  // 30 ms between rows, capped at the 8th row (~240 ms): long lists still finish well
  // under the 400 ms Doherty threshold instead of trickling in for a second.
  const delay = Math.min(index, 8) * 30
  return { '--stagger-delay': `${delay}ms` } as CSSProperties
}
