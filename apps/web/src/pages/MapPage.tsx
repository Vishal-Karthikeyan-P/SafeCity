import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Flame, MapPin, SlidersHorizontal, X, ShieldCheck, ShieldAlert,
  Shield, AlertTriangle, BarChart3, Clock, Layers, Activity, Route, LocateFixed
} from 'lucide-react'
import { IncidentMap } from '@/components/map/IncidentMap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Eye, EyeOff } from 'lucide-react'
import { useIncidents, useCategories, useHeatmap } from '@/api/incidents'
import { SearchableCategorySelect } from '@/components/incidents/SearchableCategorySelect'
import { useAreaSafetyScore, useCitySafetyOverview, useRiskGrid } from '@/api/safety'
import { RISK_LEGEND_GRADIENT } from '@/lib/riskColor'
import type { AreaSafetyScore, CitySafetyOverview, Incident } from '@/types'

type ViewMode = 'markers' | 'heatmap' | 'both'
const AREA_RADIUS_KM = 1.0

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
  if (level === 'safe') return 'Safe Area'
  if (level === 'moderate') return 'Moderate Risk'
  return 'High Risk'
}

function ScoreRing({ score }: { score: number }) {
  const r = 36
  const circumference = 2 * Math.PI * r
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference
  const color = score >= 75 ? '#22c55e' : score >= 40 ? '#fb923c' : '#ef4444'

  return (
    <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90 absolute">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="text-xl font-bold relative z-10">{Math.round(score)}</span>
    </div>
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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Area Safety (1 km radius)</p>
            <p className="text-xs font-mono">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full shrink-0" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-2 py-2">
          <div className="h-10 bg-muted rounded-lg" />
          <div className="h-3 bg-muted rounded w-3/4" />
        </div>
      )}

      {!isLoading && data && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <ScoreRing score={data.score} />
            <div>
              <p className={`text-base font-bold ${riskColor(data.risk_level)}`}>{riskLabel(data.risk_level)}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{data.incident_count}</span> incidents nearby
              </p>
              <p className="text-xs text-muted-foreground">
                Density: <span className="font-semibold text-foreground">{data.density_per_km2}</span>/km²
              </p>
            </div>
          </div>

          {data.top_categories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Contributing factors</p>
              <div className="flex flex-col gap-1">
                {data.top_categories.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <span>{cat.icon} {cat.name}</span>
                    <span className="font-semibold bg-muted px-1.5 py-0.5 rounded-full">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.incident_count === 0 && (
            <p className="text-xs text-green-600 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> No incidents reported in this area!
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function RecentActivityList({ incidents }: { incidents: CitySafetyOverview['recent_incidents'] }) {
  if (!incidents || !incidents.length) {
    return <p className="text-xs text-muted-foreground text-center py-3">No recent incidents in last 7 days.</p>
  }

  const severityDot: Record<string, string> = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  }

  return (
    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
      {incidents.map((inc) => (
        <div key={inc.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors text-xs">
          <div className={`w-2 h-2 rounded-full shrink-0 ${severityDot[inc.severity] ?? 'bg-gray-400'}`} />
          <span className="truncate flex-1 font-medium">{inc.category_icon} {inc.title}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {new Date(inc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      ))}
    </div>
  )
}

const EMPTY_INCIDENTS: Incident[] = []

export function MapPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('both')
  const [showFilters, setShowFilters] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Filters state
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null)
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showUnverified, setShowUnverified] = useState(true)

  const incidentFilters = useMemo(() => ({
    category_id: filterCategory ?? undefined,
    severity: (filterSeverity as any) ?? undefined,
    date_from: filterDateFrom || undefined,
    date_to: filterDateTo || undefined,
    search: searchQuery || undefined,
    limit: 300,
    status: 'approved' as const,
  }), [filterCategory, filterSeverity, filterDateFrom, filterDateTo, searchQuery])

  const unverifiedFilters = useMemo(() => ({
    category_id: filterCategory ?? undefined,
    severity: (filterSeverity as any) ?? undefined,
    date_from: filterDateFrom || undefined,
    date_to: filterDateTo || undefined,
    limit: 200,
    status: 'pending' as const,
  }), [filterCategory, filterSeverity, filterDateFrom, filterDateTo])

  const { data: categories = [] } = useCategories()
  const { data: incidentsData, isLoading: incidentsLoading } = useIncidents(incidentFilters)
  const incidents = incidentsData?.items ?? EMPTY_INCIDENTS

  const { data: unverifiedData } = useIncidents(unverifiedFilters)
  const unverifiedIncidents = showUnverified ? (unverifiedData?.items ?? EMPTY_INCIDENTS) : EMPTY_INCIDENTS
  const { data: riskGrid, isLoading: riskLoading } = useRiskGrid(viewMode !== 'markers')
  const { data: cityOverview } = useCitySafetyOverview()   // still used by Recent Activity
  const { data: areaScore, isLoading: areaLoading } = useAreaSafetyScore(
    clickedLocation?.lat ?? null,
    clickedLocation?.lng ?? null,
    AREA_RADIUS_KM
  )
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
    return () => clearTimeout(t)
  }, [showSidebar, showFilters])

  const locateMe = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(coords)
        setClickedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => { },
    )
  }

  const showMarkers = viewMode === 'markers' || viewMode === 'both'
  const showHeatmap = viewMode === 'heatmap' || viewMode === 'both'
  const isFiltered = filterCategory || filterSeverity || filterDateFrom || filterDateTo || searchQuery

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] gap-0 -m-4 md:-m-6">
      {/* Top Controls Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b bg-card shrink-0 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Safety & Live Map
          </h1>
          <p className="text-xs text-muted-foreground">
            {incidentsLoading ? 'Loading…' : `${incidents.length} incident${incidents.length !== 1 ? 's' : ''} shown`}
            {isFiltered && <span className="text-primary font-semibold ml-1">• Filtered</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle (Markers / Heatmap / Both) */}
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            {(['markers', 'heatmap', 'both'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-all ${viewMode === mode
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {mode === 'markers' && <><MapPin className="w-3.5 h-3.5 inline mr-1" />Markers</>}
                {mode === 'heatmap' && <><Flame className="w-3.5 h-3.5 inline mr-1" />Heatmap</>}
                {mode === 'both' && <><Layers className="w-3.5 h-3.5 inline mr-1" />Both</>}
              </button>
            ))}
          </div>



          <Button variant="outline" size="sm" onClick={locateMe} className="gap-1">
            <LocateFixed className="w-4 h-4" />
            My Location
          </Button>

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

          <button
            onClick={() => setShowUnverified((v) => !v)}
            title={showUnverified ? 'Hide unverified incidents' : 'Show unverified incidents'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${showUnverified
              ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400'
              : 'border-input text-muted-foreground hover:text-foreground'
              }`}
          >
            {showUnverified ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Unverified
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSidebar((s) => !s)}
            className="text-xs text-muted-foreground"
          >
            {showSidebar ? 'Hide Panel' : 'Show Panel'}
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 px-4 md:px-6 py-3 border-b bg-card/80 backdrop-blur shrink-0 animate-in slide-in-from-top-2 duration-200 items-center">
          <Input
            placeholder="Search incidents…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 h-8 text-sm"
          />

          <div className="w-48">
            <SearchableCategorySelect
              value={filterCategory}
              onChange={(v) => setFilterCategory(v)}
              allowAll={true}
              allLabel="All Categories"
              clearable={true}
              placeholder="All Categories"
              className="h-8"
            />
          </div>

          <Select value={filterSeverity ?? 'all'} onValueChange={(v) => setFilterSeverity(v === 'all' ? null : v)}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              {['low', 'medium', 'high', 'critical'].map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground shrink-0">From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-8 px-2 text-sm border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground shrink-0">To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-8 px-2 text-sm border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-1 focus:ring-ring"
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
                setSearchQuery('')
              }}
            >
              <X className="w-3 h-3 mr-1" />Clear
            </Button>
          )}
        </div>
      )}



      {/* Main content: Side Panel + Map */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side Panel */}
        {showSidebar && (
          <div className="w-72 xl:w-80 shrink-0 flex flex-col gap-3 p-4 overflow-y-auto border-r bg-card/50 backdrop-blur">

            {/* Area Safety Score (on map click) */}
            {clickedLocation && (
              <AreaScorePanel
                data={areaScore}
                isLoading={areaLoading}
                lat={clickedLocation.lat}
                lng={clickedLocation.lng}
                onClose={() => setClickedLocation(null)}
              />
            )}

            {!clickedLocation && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground text-xs">
                <MapPin className="w-4 h-4 shrink-0 text-primary" />
                <span>Click anywhere on the map to inspect area safety & options.</span>
              </div>
            )}

            {/* Legend */}
            <div className="border rounded-xl p-3.5 bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2.5">Map Legend</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-muted-foreground">Severity</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Low', color: 'bg-green-500' },
                    { label: 'Medium', color: 'bg-yellow-500' },
                    { label: 'High', color: 'bg-orange-500' },
                    { label: 'Critical', color: 'bg-red-500' },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color} shrink-0`} />
                      <span className="text-xs">{label}</span>
                    </div>
                  ))}
                </div>

                {showHeatmap && (
                  <>
                    <div className="border-t my-2" />
                    <span className="font-semibold text-xs text-muted-foreground">Area risk (safety score)</span>
                    <div className="h-2.5 rounded-full w-full" style={{ background: RISK_LEGEND_GRADIENT }} />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Safe</span>
                      <span>High risk</span>
                    </div>
                    <details className="text-[11px] text-muted-foreground leading-relaxed">
                      <summary className="cursor-pointer font-medium text-foreground">How is this coloured?</summary>
                      <p className="mt-1">
                        Each colour is the Area Safety Score (0–100) of a 1 km circle around that spot, the same
                        number you get when you click the map. Incidents count by severity, category, recency and
                        verification; repeated reports at one spot count less. Blue is safe, red is high risk.
                        Faint blue means no reports nearby, which is unknown rather than guaranteed safe.
                      </p>
                    </details>
                  </>
                )}
              </div>
            </div>

            {/* Recent Activity (7 days) */}
            {cityOverview && (
              <div className="border rounded-xl p-3.5 bg-card flex-1 min-h-[140px]">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Recent Activity (7d)
                </p>
                <RecentActivityList incidents={cityOverview.recent_incidents} />
              </div>
            )}
          </div>
        )}

        {/* Map Area */}
        <div className="flex-1 relative">
          {(riskLoading || incidentsLoading) && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-card/95 backdrop-blur border px-4 py-1.5 rounded-full shadow text-xs flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading map data…
            </div>
          )}

          {/* Clicked location quick action card */}
          {clickedLocation && (
            <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 z-[1000] bg-card/95 backdrop-blur border p-4 rounded-2xl shadow-2xl max-w-sm animate-fade-in space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    📍
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Selected Location</p>
                    <p className="text-sm font-bold">{clickedLocation.lat.toFixed(4)}, {clickedLocation.lng.toFixed(4)}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setClickedLocation(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  size="sm"
                  className="w-full justify-start text-xs font-medium"
                  onClick={() => navigate(`/incidents/new?lat=${clickedLocation.lat}&lng=${clickedLocation.lng}`)}
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                  Report Incident at this Location
                </Button>

              </div>
            </div>
          )}

          <IncidentMap
            incidents={showMarkers ? incidents : EMPTY_INCIDENTS}
            unverifiedIncidents={showMarkers ? unverifiedIncidents : EMPTY_INCIDENTS}
            riskGrid={showHeatmap ? riskGrid : undefined}
            areaRadiusKm={AREA_RADIUS_KM}
            center={clickedLocation ? [clickedLocation.lat, clickedLocation.lng] : (userLocation ?? [11.0168, 76.9558])}
            zoom={clickedLocation ? 14 : (userLocation ? 14 : 12)}
            height="100%"
            onLocationSelect={(lat, lng) => setClickedLocation({ lat, lng })}
            selectedLocation={clickedLocation}
          />
        </div>
      </div>
    </div>
  )
}
