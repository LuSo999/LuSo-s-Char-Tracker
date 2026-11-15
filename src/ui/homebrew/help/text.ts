import { cs } from './text.cs'
import { en, type HelpId } from './text.en'

/** The help text of a topic in the UI language. */
export function helpText(id: HelpId, lang: string): string {
  return (lang.startsWith('cs') ? cs[id] : undefined) ?? en[id] ?? ''
}
