import { createContext, useContext } from 'react'
import type { SignupInput } from '../api'
import type { User } from '../types'

export interface AuthState {
  /** The logged-in shopper, or null. Undefined while the session is still being checked. */
  user: User | null | undefined
  login: (email: string, password: string) => Promise<User>
  signup: (input: SignupInput) => Promise<User>
  logout: () => Promise<void>
  /** Update the shopper's usual size after Dan learns it from a chat. */
  setPreferredSize: (size: string | null) => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
