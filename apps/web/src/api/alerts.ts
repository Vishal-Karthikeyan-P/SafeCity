import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useActiveAlerts(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['active-alerts', page, limit],
    queryFn: async () => {
      const res = await api.get('/alerts', { params: { page, limit } })
      return res.data
    },
  })
}
