import { createContext, useContext } from 'react'

/** Route prefix of the homebrew pages ("/homebrew"; the dev preview uses "/dev/homebrew"). */
export const HomebrewBase = createContext('/homebrew')
export const useHomebrewBase = () => useContext(HomebrewBase)
