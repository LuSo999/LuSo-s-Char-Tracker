// Shared class names and lists of the homebrew editor.
/** An input with its own width (add a w-… class). */
export const inputBase = 'rounded border border-border bg-card px-2 py-1 text-sm'
export const input = `w-full ${inputBase}`
export const grid = 'grid gap-2 sm:grid-cols-2 lg:grid-cols-4'
export const ACTION_TYPES = ['action', 'bonusAction', 'reaction', 'other'] as const
