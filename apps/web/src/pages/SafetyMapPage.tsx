import { useState, useMemo } from 'react'
import {
  Flame, MapPin, SlidersHorizontal, X, ShieldCheck, ShieldAlert,
  Shield, AlertTriangle, BarChart3, Clock, Layers, Activity,
} from 'lucide-react'
import { IncidentMap } from '@/components/map/IncidentMap'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useIncidents, useCategories, useHeatmap } from '@/api/incidents'
import { useAreaSafetyScore, useCitySafetyOverview } from '@/api/safety'
import type { AreaSafetyScore, CitySafetyOverview } from '@/types'

// ── Helpers ────────────────────────────────────────────────────────────────

type ViewMode = 'markers' | 'heatmap' | 'both'

function riskColor(level?: string) {
  if (level === 'safe') return 'text-green-500'
  if (level === 'moderate') return 'text-orange-400'
  return 'text-red-500'
}

function riskBg(level?: string) {
  if (level === 'safe') return 'bg-green-500/10 border-green-500/30'
  if (level === 'moderate') return 'bg-orange-400/10 border-orange-400/30'
  return 'bg-red-500/10 border-red-500/30'
}

function riskLabel(level?: string) {
  if (level === 'safe') return 'Safe'
  if (level === 'moderate') return 'Moderate Risk'
  return 'High Risk'
}

function RiskIcon({ level, className = 'w-5 h-5' }: { level?: string; className?: string }) {
  if (level === 'safe') return <ShieldCheck className={`${className} text-green-500`} />
  if (level === 'moderate') return <ShieldAlert className={`${className} text-orange-400`} />
  return <Shield className={`${className} text-red-500`} />
}

function ScoreRing({ score }: { score: number }) {
  const r = 38
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? '#22c55e' : score >= 40 ? '#fb923c' : '#ef4444'

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90 absolute">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="text-2xl font-bold relative z-10">{Math.round(score)}</span>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CityOverviewCard({ data, isLoading }: { data?: CitySafetyOverview; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="border-muted">
        <CardContent className="p-5 flex items-center gap-4 animate-pulse">
          <div className="w-24 h-24 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-3 bg-muted rounded w-3/4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  return (
    <Card className={`border ${riskBg(data.risk_level)}`}>
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          City Safety Score — Coimbatore
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex items-center gap-5">
          <ScoreRing score={data.score} />
          <div className="flex-1 min-w-0">
            <p className={`text-lg font-bold ${riskColor(data.risk_level)}`}>{riskLabel(data.risk_level)}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground">{data.total_incident_count}</span> total incidents
            </p>
            {data.top_category && (
              <p className="text-sm text-muted-foreground mt-1">
                Highest risk: <span className="font-semibold text-foreground">{data.top_category.icon} {data.top_category.name}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{data.recent_7d_count}</span> new incidents in last 7 days
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AreaScorePanel({
  data,
  isLoading,
  lat,
  lng,
  onClose,
}: {
  data?: AreaSafetyScore
  isLoading: boolean
  lat: number
  lng: number
  onClose: () => void
}) {
  return (
    <div className={`border rounded-2xl p-4 animate-in fade-in duration-200 ${data ? riskBg(data.risk_level) : 'bg-card border-muted'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Selected Area</p>
            <p className="text-sm font-mono">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-2">
          <div className="h-12 bg-muted rounded-lg" />
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      )}

      {!isLoading && data && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <ScoreRing score={data.score} />
            <div>
              <p className={`text-lg font-bold ${riskColor(data.risk_level)}`}>{riskLabel(data.risk_level)}</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{data.incident_count}</span> incidents within 1 km
              </p>
              <p className="text-xs text-muted-foreground">
                Density: <span className="font-semibold text-foreground">{data.density_per_km2}</span>/km²
              </p>
              <p className="text-xs text-muted-foreground">
                Last 7d: <span className="font-semibold text-foreground">{data.recent_7d}</span>
              </p>
            </div>
          </div>

          {data.top_categories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Contributing factors</p>
              <div className="flex flex-col gap-1">
                {data.top_categories.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <span className="text-sm">{cat.icon} {cat.name}</span>
                    <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded-full">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.incident_count === 0 && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> No incidents reported in this area!
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function RecentActivityList({ incidents }: { incidents: CitySafetyOverview['recent_incidents'] }) {
  if (!incidents.length) {
    return <p className="text-sm text-muted-foreground text-center py-4">No recent incidents in the last 7 days.</p>
  }

  const severityDot: Record<string, string> = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  }

  return (
    <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
      {incidents.map((inc) => (
        <div key={inc.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
          <div className={`w-2 h-2 rounded-full shrink-0 ${severityDot[inc.severity] ?? 'bg-gray-400'}`} />
          <span className="text-sm truncate flex-1">{inc.category_icon} {inc.title}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {new Date(inc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function SafetyMapPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('both')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Filters state
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null)
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')

  const heatmapFilters = useMemo(() => ({
    category_id: filterCategory ?? undefined,
    severity: filterSeverity ?? undefined,
    date_from: filterDateFrom || undefined,
    date_to: filterDateTo || undefined,
  }), [filterCategory, filterSeverity, filterDateFrom, filterDateTo])

  const incidentFilters = useMemo(() => ({
    category_id: filterCategory ?? undefined,
    severity: (filterSeverity as any) ?? undefined,
    date_from: filterDateFrom || undefined,
    date_to: filterDateTo || undefined,
    limit: 300,
    status: 'approved' as const,
  }), [filterCategory, filterSeverity, filterDateFrom, filterDateTo])

  const { data: categories = [] } = useCategories()
  const { data: incidentsData, isLoading: incidentsLoading } = useIncidents(incidentFilters)
  const incidents = incidentsData?.items ?? []

  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmap(heatmapFilters)

  const { data: cityOverview, isLoading: cityLoading } = useCitySafetyOverview()

  const { data: areaScore, isLoading: areaLoading } = useAreaSafetyScore(
    selectedLocation?.lat ?? null,
    selectedLocation?.lng ?? null,
    1.0
  )

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng })
  }

  const showMarkers = viewMode === 'markers' || viewMode === 'both'
  const showHeatmap = viewMode === 'heatmap' || viewMode === 'both'

  const isFiltered = filterCategory || filterSeverity || filterDateFrom || filterDateTo

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] gap-0 -m-4 md:-m-6">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b bg-card shrink-0 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Safety Heatmap
          </h1>
          <p className="text-xs text-muted-foreground">
            {incidentsLoading ? 'Loading…' : `${incidents.length} incidents shown`}
            {isFiltered && <span className="text-primary font-semibold ml-1">• Filtered</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            {(['markers', 'heatmap', 'both'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-all ${
                  viewMode === mode
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'markers' && <><MapPin className="w-3 h-3 inline mr-1" />Markers</>}
                {mode === 'heatmap' && <><Flame className="w-3 h-3 inline mr-1" />Heatmap</>}
                {mode === 'both' && <><Layers className="w-3 h-3 inline mr-1" />Both</>}
              </button>
            ))}
          </div>

          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters((f) => !f)}
            className="gap-1"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {isFiltered && <span className="w-2 h-2 rounded-full bg-primary-foreground ml-0.5" />}
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 px-4 md:px-6 py-3 border-b bg-card/80 backdrop-blur shrink-0 animate-in slide-in-from-top-2 duration-200">
          {/* Category */}
          <Select value={filterCategory ?? 'all'} onValueChange={(v) => setFilterCategory(v === 'all' ? null : v)}>
            <SelectTrigger className="w-44 h-8 text-sm" id="safety-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(categories as any[]).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Severity */}
          <Select value={filterSeverity ?? 'all'} onValueChange={(v) => setFilterSeverity(v === 'all' ? null : v)}>
            <SelectTrigger className="w-36 h-8 text-sm" id="safety-severity-filter">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              {['low', 'medium', 'high', 'critical'].map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date From */}
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground shrink-0">From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-8 px-2 text-sm border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-1 focus:ring-ring"
              id="safety-date-from"
            />
          </div>

          {/* Date To */}
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground shrink-0">To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-8 px-2 text-sm border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-1 focus:ring-ring"
              id="safety-date-to"
            />
          </div>

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                setFilterCategory(null)
                setFilterSeverity(null)
                setFilterDateFrom('')
                setFilterDateTo('')
              }}
            >
              <X className="w-3 h-3 mr-1" />Clear
            </Button>
          )}
        </div>
      )}

      {/* Main content: sidebar + map */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-72 xl:w-80 shrink-0 flex flex-col gap-3 p-4 overflow-y-auto border-r bg-card/50 backdrop-blur">

          {/* City Overview */}
          <CityOverviewCard data={cityOverview} isLoading={cityLoading} />

          {/* Area Safety Score (shows on click) */}
          {selectedLocation && (
            <AreaScorePanel
              data={areaScore}
              isLoading={areaLoading}
              lat={selectedLocation.lat}
              lng={selectedLocation.lng}
              onClose={() => setSelectedLocation(null)}
            />
          )}

          {!selectedLocation && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground text-sm">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>Click anywhere on the map to get the area safety score.</span>
            </div>
          )}

          {/* Legend */}
          <div className="border rounded-xl p-4 bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Map Legend</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-muted-foreground w-16">Severity</span>
              </div>
              {[
                { label: 'Low', color: 'bg-green-500' },
                { label: 'Medium', color: 'bg-yellow-500' },
                { label: 'High', color: 'bg-orange-500' },
                { label: 'Critical', color: 'bg-red-500' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${color} shrink-0`} />
                  <span className="text-sm">{label}</span>
                </div>
              ))}
              {(showHeatmap) && (
                <>
                  <div className="border-t my-2" />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-muted-foreground w-16">Heatmap</span>
                  </div>
                  <div className="h-3 rounded-full w-full" style={{
                    background: 'linear-gradient(to right, #3b82f6, #22c55e, #f59e0b, #ef4444)'
                  }} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Low risk</span>
                    <span>High risk</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          {cityOverview && (
            <div className="border rounded-xl p-4 bg-card flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Recent Activity (7 days)
              </p>
              <RecentActivityList incidents={cityOverview.recent_incidents} />
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {(heatmapLoading || incidentsLoading) && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-card/95 backdrop-blur border px-4 py-2 rounded-full shadow text-sm flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading map data…
            </div>
          )}

          <IncidentMap
            incidents={showMarkers ? incidents : []}
            heatmapData={showHeatmap ? (heatmapData ?? []) : undefined}
            height="100%"
            onLocationSelect={handleMapClick}
            selectedLocation={selectedLocation}
          />
        </div>
      </div>
    </div>
  )
}
