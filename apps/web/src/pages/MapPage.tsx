import { useState } from 'react'
import { Layers, Filter, LocateFixed } from 'lucide-react'
import { IncidentMap } from '@/components/map/IncidentMap'
import { Button } from '@/components/ui/button'
import { useIncidents, useCategories } from '@/api/incidents'
import { useFilterStore } from '@/store/filters'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { IncidentCard } from '@/components/incidents/IncidentCard'
import type { Incident } from '@/types'

export function MapPage() {
  const { category_id, severity } = useFilterStore()
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [localCategory, setLocalCategory] = useState<string | null>(null)
  const [localSeverity, setLocalSeverity] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const { data: categories = [] } = useCategories()
  const { data, isLoading } = useIncidents({
    category_id: localCategory ?? undefined,
    severity: (localSeverity as any) ?? undefined,
    limit: 200,
    status: 'approved',
  })

  const incidents = data?.items ?? []

  const locateMe = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {},
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Safety Map</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {incidents.length} incident{incidents.length !== 1 ? 's' : ''} in this area
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={locateMe} id="locate-me-btn">
            <LocateFixed className="w-4 h-4 mr-1" />
            My Location
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((f) => !f)}
            id="map-filter-toggle"
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-card border rounded-2xl animate-fade-in">
          <Select
            value={localCategory ?? 'all'}
            onValueChange={(v) => setLocalCategory(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-48" id="map-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={localSeverity ?? 'all'}
            onValueChange={(v) => setLocalSeverity(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-40" id="map-severity-filter">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {['low', 'medium', 'high', 'critical'].map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Map */}
      <div className="rounded-2xl overflow-hidden shadow-xl">
        <IncidentMap
          incidents={incidents}
          center={userLocation ?? [40.7128, -74.006]}
          zoom={userLocation ? 14 : 12}
          height="600px"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {[
          { label: 'Low', color: 'bg-green-500' },
          { label: 'Medium', color: 'bg-yellow-500' },
          { label: 'High', color: 'bg-orange-500' },
          { label: 'Critical', color: 'bg-red-500' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
