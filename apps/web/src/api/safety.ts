import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AreaSafetyScore, CitySafetyOverview } from '@/types'

// ── Area Safety Score ─────────────────────────────────────────
export function useAreaSafetyScore(
  lat: number | null,
  lng: number | null,
  radiusKm: number = 1.0
) {
  return useQuery({
    queryKey: ['area-safety', lat, lng, radiusKm],
    queryFn: async (): Promise<AreaSafetyScore> => {
      const res = await api.get('/safety/area', {
        params: { lat, lng, radius_km: radiusKm },
      })
      return res.data
    },
    enabled: lat != null && lng != null,
    staleTime: 30_000,
  })
}

// ── City Safety Overview ──────────────────────────────────────
export function useCitySafetyOverview(
  cityLat: number = 11.0168,
  cityLng: number = 76.9558,
  radiusKm: number = 20.0
) {
  return useQuery({
    queryKey: ['city-overview', cityLat, cityLng, radiusKm],
    queryFn: async (): Promise<CitySafetyOverview> => {
      const res = await api.get('/safety/city', {
        params: { city_lat: cityLat, city_lng: cityLng, radius_km: radiusKm },
      })
      return res.data
    },
    staleTime: 60_000,
  })
}

export interface RiskGrid {
  bounds: [[number, number], [number, number]] | null
  rows: number
  cols: number
  cell_m: number
  radius_km: number
  scores: number[]
  counts: number[]
}

export function useRiskGrid(enabled = true) {
  return useQuery({
    queryKey: ['risk-grid'],
    queryFn: async () => (await api.get('/safety/risk-grid')).data as RiskGrid,
    enabled,
    staleTime: 1000 * 60 * 2,
  })
}
