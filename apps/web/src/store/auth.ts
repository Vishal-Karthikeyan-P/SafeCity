import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  full_name: string
  role: 'citizen' | 'admin'
  is_active: boolean
  is_verified: boolean
  profile?: {
    avatar_url?: string | null
    phone?: string | null
    bio?: string | null
    city?: string | null
    country?: string | null
    emergency_contact_name?: string | null
    emergency_contact_phone?: string | null
  } | null
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  // Actions
  setTokens: (access: string, refresh: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'safecity-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
)
