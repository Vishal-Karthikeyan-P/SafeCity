import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { RoutePlanResponse } from '@/types'

export function useSafeRoute(startLat: number | null, startLng: number | null, destLat: number | null, destLng: number | null) {
  return useQuery({
    queryKey: ['safe-route', startLat, startLng, destLat, destLng],
    queryFn: async (): Promise<RoutePlanResponse> => {
      if (!startLat || !startLng || !destLat || !destLng) {
        throw new Error("Missing coordinates")
      }
      const res = await api.get('/routes/plan', {
        params: { start_lat: startLat, start_lng: startLng, dest_lat: destLat, dest_lng: destLng },
      })
      return res.data
    },
    enabled: !!startLat && !!startLng && !!destLat && !!destLng,
  })
}
