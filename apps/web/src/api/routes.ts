import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function useSafeRoute(startLat: number, startLng: number, destLat: number, destLng: number) {
  return useQuery({
    queryKey: ['safe-route', startLat, startLng, destLat, destLng],
    queryFn: async () => {
      const res = await api.get('/routes/plan', {
        params: { start_lat: startLat, start_lng: startLng, dest_lat: destLat, dest_lng: destLng },
      })
      return res.data
    },
    enabled: !!startLat && !!startLng && !!destLat && !!destLng,
  })
}
