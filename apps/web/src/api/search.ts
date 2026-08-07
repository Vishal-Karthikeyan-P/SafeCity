import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: ['global-search', q],
    queryFn: async () => {
      const res = await api.get('/search', { params: { q } })
      return res.data
    },
    enabled: q.length >= 2,
  })
}
