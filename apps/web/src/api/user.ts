import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications')
      return res.data
    },
    refetchInterval: 30_000, // poll every 30s
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/notifications/${id}/read`)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read')
    },
  })
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/stats')
      return res.data
    },
  })
}

export function useAdminUsers(page = 1, limit = 10, search = '') {
  return useQuery({
    queryKey: ['admin-users', page, limit, search],
    queryFn: async () => {
      const res = await api.get('/admin/users', { params: { page, limit, search: search || undefined } })
      return res.data
    },
  })
}

export function useChangeUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'citizen' }) => {
      const res = await api.patch(`/admin/users/${userId}/role`, { role })
      return res.data
    },
    onSuccess: (_, { role }) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(`User role changed to ${role}`)
    },
  })
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await api.get('/admin/categories')
      return res.data
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/users/me', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Profile updated successfully')
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { current_password: string; new_password: string }) => {
      const res = await api.post('/users/me/change-password', data)
      return res.data
    },
    onSuccess: () => toast.success('Password changed successfully'),
  })
}

export function useUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Avatar updated')
      return data
    },
  })
}

// ── Emergency Contacts ────────────────────────────────────────

export function useEmergencyContacts() {
  return useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: async () => {
      const res = await api.get('/users/me/contacts')
      return res.data as any[]
    },
  })
}

export function useAddEmergencyContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/users/me/contacts', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency-contacts'] })
      toast.success('Emergency contact added')
    },
  })
}

export function useUpdateEmergencyContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await api.patch(`/users/me/contacts/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency-contacts'] })
      toast.success('Emergency contact updated')
    },
  })
}

export function useDeleteEmergencyContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/me/contacts/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency-contacts'] })
      toast.success('Emergency contact removed')
    },
  })
}

// ── Account Management ────────────────────────────────────────

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await api.delete('/users/me')
    },
    onSuccess: () => {
      toast.success('Account deleted')
      // Let the UI handle redirect/logout
    },
  })
}
