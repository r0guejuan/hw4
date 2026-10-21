import { useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from '../api'
import type { User } from '../types'
import { AuthContext, type AuthState } from './AuthContext'

/**
 * Keeps track of who is logged in. The session itself lives in an HttpOnly cookie set by
 * the backend, so this only ever holds public profile fields, never a token or password.
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    api
      .fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      login: async (email, password) => {
        const u = await api.login(email, password)
        setUser(u)
        return u
      },
      signup: async (input) => {
        const u = await api.signup(input)
        setUser(u)
        return u
      },
      logout: async () => {
        await api.logout()
        setUser(null)
      },
      setPreferredSize: (size) =>
        setUser((u) => (u && u.preferred_size !== size ? { ...u, preferred_size: size } : u)),
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
