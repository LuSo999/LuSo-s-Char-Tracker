// Shared state of the homebrew help: the content examples come from, and where "Use as template" puts a row.
import { createContext, useContext } from 'react'
import { create } from 'zustand'
import type { ContentIndex } from '../../../content'
import type { RowKind } from '../describe'

export const HelpContent = createContext<ContentIndex | undefined>(undefined)
export const useHelpContent = () => useContext(HelpContent)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TemplateRow = { kind: RowKind; row: Record<string, any> }

/** Set by the open editor: copies an example row into the entity being edited. */
export const useTemplateSink = create<{ apply?: (t: TemplateRow) => void }>(() => ({}))
