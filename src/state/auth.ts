import { onAuthStateChanged, type User } from 'firebase/auth'
import { create } from 'zustand'
import { auth } from '../firebase'

type AuthState = {
  user: User | null
  // true until Firebase reports the initial sign-in state
  loading: boolean
}

export const useAuth = create<AuthState>(() => ({ user: null, loading: auth !== null }))

if (auth) {
  onAuthStateChanged(auth, (user) => useAuth.setState({ user, loading: false }))
}
