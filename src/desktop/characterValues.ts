import type { ContentIndex } from '../content'
import type { Character } from '../engine/character'
import { computeSheet } from '../engine/derive'
import { exportValues } from '../engine/export/values'

/** Export values of a character, computed with its own books and settings (as its sheet does). */
export function characterValues(character: Character, content: ContentIndex): Record<string, string | boolean> {
  const view = content.withLegacySubclasses(character.settings.legacySubclasses, character.settings.legacyOrigins).withBooks(character.books).withCustomizations(character.customizations)
  return exportValues(character, computeSheet(character, view), view)
}
