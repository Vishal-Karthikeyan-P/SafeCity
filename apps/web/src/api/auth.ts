import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

// ── Login ─────────────────────────────────────────────────────
export function useLogin() {
  const { setTokens } = useAuthStore()
  const { data: me, refetch } = useCurrentUser()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await api.post('/auth/login', data)
      return res.data
    },
    onSuccess: async (data) => {
      setTokens(data.access_token, data.refresh_token)
      const userRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      useAuthStore.getState().setUser(userRes.data)
      toast.success('Welcome back!')
      navigate(userRes.data.role === 'admin' ? '/admin' : '/dashboard')
    },
  })
}

// ── Register ──────────────────────────────────────────────────
export function useRegister() {
  const { setTokens } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (data: { email: string; password: string; full_name: string }) => {
      const res = await api.post('/auth/register', data)
      return res.data
    },
    onSuccess: async (data) => {
      setTokens(data.access_token, data.refresh_token)
      const userRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      useAuthStore.getState().setUser(userRes.data)
      toast.success('Account created successfully!')
      navigate('/dashboard')
    },
  })
}

// ── Current User ──────────────────────────────────────────────
export function useCurrentUser() {
  const token = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me')
      useAuthStore.getState().setUser(res.data)
      return res.data
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 10,
  })
}

// ── Logout ─────────────────────────────────────────────────────
export function useLogout() {
  const { logout } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()

  return () => {
    logout()
    qc.clear()
    navigate('/login')
    toast.success('Logged out successfully')
  }
}
