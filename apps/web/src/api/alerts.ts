import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'

export interface CommunityAlert {
  id: string
  title: string
  message: string
  alert_type: string
  target_scope: 'all_users' | 'location_based'
  location_lat?: number | null
  location_lng?: number | null
  radius_km?: number | null
  is_active: boolean
  expires_at?: string | null
  created_at: string
  recipients_count?: number | null
}

export interface CreateAlertPayload {
  title: string
  message: string
  alert_type: string
  target_scope: 'all_users' | 'location_based'
  location_lat?: number | null
  location_lng?: number | null
  radius_km?: number | null
  expires_in_hours?: number
}

export function useActiveAlerts(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['active-alerts', page, limit],
    queryFn: async () => {
      const res = await api.get('/alerts', { params: { page, limit } })
      return res.data
    },
  })
}

export function useAdminAlerts() {
  return useQuery<CommunityAlert[]>({
    queryKey: ['admin-alerts'],
    queryFn: async () => {
      const res = await api.get('/admin/alerts')
      return res.data
    },
  })
}

export function useCreateAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAlertPayload) => {
      const res = await api.post('/admin/alerts', payload)
      return res.data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-alerts'] })
      qc.invalidateQueries({ queryKey: ['active-alerts'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      const count = data.recipients_count ?? 0
      toast.success(
        data.target_scope === 'location_based'
          ? `Location alert dispatched to ${count} nearby citizens!`
          : `Broadcast alert dispatched to ${count} citizens!`
      )
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to publish alert')
    },
  })
}

export function useDeleteAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (alertId: string) => {
      await api.delete(`/admin/alerts/${alertId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-alerts'] })
      qc.invalidateQueries({ queryKey: ['active-alerts'] })
      toast.success('Alert deactivated')
    },
    onError: () => {
      toast.error('Failed to deactivate alert')
    },
  })
}
