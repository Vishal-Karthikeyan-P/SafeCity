import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'

export interface UserSearchResult {
  id: string
  full_name: string
  email: string
}

export interface ContactRequest {
  id: string
  requester_id: string
  contact_id: string
  status: 'pending' | 'accepted' | 'rejected'
  message?: string | null
  requester?: UserSearchResult | null
  contact?: UserSearchResult | null
  created_at: string
  updated_at: string
}

export function useSearchUsers(query: string) {
  return useQuery<UserSearchResult[]>({
    queryKey: ['users-search', query],
    queryFn: async () => {
      if (!query || query.trim().length < 2) return []
      const res = await api.get('/contacts/search', { params: { q: query.trim() } })
      return res.data
    },
    enabled: query.trim().length >= 2,
    staleTime: 10000,
  })
}

export function useAcceptedContacts() {
  return useQuery<ContactRequest[]>({
    queryKey: ['contacts', 'accepted'],
    queryFn: async () => {
      const res = await api.get('/contacts')
      return res.data
    },
  })
}

export function useIncomingContactRequests() {
  return useQuery<ContactRequest[]>({
    queryKey: ['contacts', 'incoming'],
    queryFn: async () => {
      const res = await api.get('/contacts/requests/incoming')
      return res.data
    },
  })
}

export function useOutgoingContactRequests() {
  return useQuery<ContactRequest[]>({
    queryKey: ['contacts', 'outgoing'],
    queryFn: async () => {
      const res = await api.get('/contacts/requests/outgoing')
      return res.data
    },
  })
}

export function useSendContactRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ contact_id, message }: { contact_id: string; message?: string }) => {
      const res = await api.post('/contacts/requests', { contact_id, message })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Emergency contact request sent!')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to send contact request')
    },
  })
}

export function useAcceptContactRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const res = await api.patch(`/contacts/requests/${requestId}/accept`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Emergency contact accepted!')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to accept request')
    },
  })
}

export function useRejectContactRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const res = await api.patch(`/contacts/requests/${requestId}/reject`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.info('Emergency contact request declined')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to decline request')
    },
  })
}

export function useDeleteContactRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      await api.delete(`/contacts/requests/${requestId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact removed')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to remove contact')
    },
  })
}
