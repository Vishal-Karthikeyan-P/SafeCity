import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import type { Incident, IncidentFilters, PaginatedResponse, ResolutionRequest, IncidentStatusHistory } from '@/types'

// ── List incidents ─────────────────────────────────────────────
export function useIncidents(filters: Partial<IncidentFilters> = {}) {
  return useQuery({
    queryKey: ['incidents', filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v != null && v !== '')
      )
      const res = await api.get('/incidents', { params })
      return res.data as PaginatedResponse<Incident>
    },
  })
}

// ── My incidents ──────────────────────────────────────────────
export function useMyIncidents(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['my-incidents', page, limit],
    queryFn: async () => {
      const res = await api.get('/incidents/my', { params: { page, limit } })
      return res.data as PaginatedResponse<Incident>
    },
  })
}

// ── Single incident ────────────────────────────────────────────
export function useIncident(id: string) {
  return useQuery({
    queryKey: ['incident', id],
    queryFn: async () => {
      const res = await api.get(`/incidents/${id}`)
      return res.data as Incident
    },
    enabled: !!id,
  })
}

// ── Nearby incidents ───────────────────────────────────────────
export function useNearbyIncidents(
  lat: number | null,
  lng: number | null,
  radiusKm = 5,
  filters: { category_id?: string; severity?: string } = {}
) {
  return useQuery({
    queryKey: ['nearby-incidents', lat, lng, radiusKm, filters],
    queryFn: async () => {
      const res = await api.get('/incidents/nearby', {
        params: { lat, lng, radius_km: radiusKm, ...filters },
      })
      return res.data as Incident[]
    },
    enabled: lat != null && lng != null,
  })
}

// ── Heatmap ───────────────────────────────────────────────────
export function useHeatmap(filters: { category_id?: string; severity?: string; date_from?: string; date_to?: string } = {}) {
  return useQuery({
    queryKey: ['heatmap', filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v != null && v !== '')
      )
      const res = await api.get('/incidents/heatmap', { params })
      return res.data as { lat: number; lng: number; weight: number }[]
    },
  })
}

// ── Categories ────────────────────────────────────────────────
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/incidents/categories')
      return res.data
    },
    staleTime: 1000 * 60 * 30,
  })
}

// ── Auto-severity preview ─────────────────────────────────────
export function usePreviewSeverity(
  categoryId: string | undefined,
  title: string,
  description: string
) {
  const enabled = !!(categoryId && title.length >= 3)
  return useQuery({
    queryKey: ['preview-severity', categoryId, title, description],
    queryFn: async () => {
      const res = await api.get('/incidents/preview-severity', {
        params: { category_id: categoryId || '', title, description },
      })
      return res.data as { severity: string; score: number }
    },
    enabled,
    staleTime: 5000,        // cache 5s to avoid hammering on every keystroke
    placeholderData: (prev) => prev,
  })
}

// ── Create incident ────────────────────────────────────────────
export function useCreateIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/incidents', data)
      return res.data
    },
    onSuccess: (incident) => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['my-incidents'] })
      toast.success('Incident reported successfully!')
      return incident
    },
  })
}

// ── Upload images ─────────────────────────────────────────────
export function useUploadImages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ incidentId, files }: { incidentId: string; files: File[] }) => {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      const res = await api.post(`/incidents/${incidentId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (_, { incidentId }) => {
      qc.invalidateQueries({ queryKey: ['incident', incidentId] })
      toast.success('Images uploaded successfully!')
    },
  })
}

// ── Admin: Update status ───────────────────────────────────────
export function useUpdateIncidentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      incidentId,
      status,
      admin_note,
    }: {
      incidentId: string
      status: string
      admin_note?: string
    }) => {
      const res = await api.patch(`/admin/incidents/${incidentId}/status`, {
        status,
        admin_note,
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['admin-incidents'] })
      toast.success('Incident status updated')
    },
  })
}

// ── Admin: List all incidents ──────────────────────────────────
export function useAdminIncidents(filters: Partial<IncidentFilters> = {}) {
  return useQuery({
    queryKey: ['admin-incidents', filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v != null && v !== '')
      )
      const res = await api.get('/admin/incidents', { params })
      return res.data as PaginatedResponse<Incident>
    },
  })
}

// ── Admin: Delete incident ─────────────────────────────────────
export function useDeleteIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (incidentId: string) => {
      await api.delete(`/admin/incidents/${incidentId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-incidents'] })
      toast.success('Incident deleted')
    },
  })
}

// ── Upload Resolution Evidence ───────────────────────────────────
export function useUploadEvidence() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/incidents/upload-evidence', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data as { url: string; filename: string }
    },
  })
}

// ── Resolution Requests ──────────────────────────────────────────
export function useResolutionRequests(incidentId: string) {
  return useQuery({
    queryKey: ['resolution-requests', incidentId],
    queryFn: async () => {
      const res = await api.get(`/incidents/${incidentId}/resolution-requests`)
      return res.data as ResolutionRequest[]
    },
    enabled: !!incidentId,
  })
}

export function useCreateResolutionRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      incidentId,
      explanation,
      evidence_url,
    }: {
      incidentId: string
      explanation: string
      evidence_url?: string
    }) => {
      const res = await api.post(`/incidents/${incidentId}/resolution-requests`, {
        explanation,
        evidence_url,
      })
      return res.data as ResolutionRequest
    },
    onSuccess: (_, { incidentId }) => {
      qc.invalidateQueries({ queryKey: ['incident', incidentId] })
      qc.invalidateQueries({ queryKey: ['resolution-requests', incidentId] })
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['admin-incidents'] })
      toast.success('Resolution request submitted successfully!')
    },
  })
}

export function useReviewResolutionRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      incidentId,
      requestId,
      action,
      rejection_reason,
    }: {
      incidentId: string
      requestId: string
      action: 'approve' | 'reject'
      rejection_reason?: string
    }) => {
      const res = await api.post(
        `/incidents/${incidentId}/resolution-requests/${requestId}/review`,
        {
          action,
          rejection_reason,
        }
      )
      return res.data as ResolutionRequest
    },
    onSuccess: (data, { incidentId }) => {
      qc.invalidateQueries({ queryKey: ['incident', incidentId] })
      qc.invalidateQueries({ queryKey: ['resolution-requests', incidentId] })
      qc.invalidateQueries({ queryKey: ['status-history', incidentId] })
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['admin-incidents'] })
      toast.success(
        data.status === 'approved'
          ? 'Resolution approved! Incident is now RESOLVED (UNVERIFIED) pending admin review.'
          : 'Resolution request rejected.'
      )
    },
  })
}

// ── Status History ───────────────────────────────────────────────
export function useStatusHistory(incidentId: string) {
  return useQuery({
    queryKey: ['status-history', incidentId],
    queryFn: async () => {
      const res = await api.get(`/incidents/${incidentId}/status-history`)
      return res.data as IncidentStatusHistory[]
    },
    enabled: !!incidentId,
  })
}

