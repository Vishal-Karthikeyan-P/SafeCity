import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IncidentMap } from '@/components/map/IncidentMap'
import { useSafeRoute } from '@/api/routes'
import {
  MapPin, ShieldAlert, Navigation, Clock, Activity, X,
  Route, CheckCircle, AlertTriangle, Shield, TrendingUp, Star,
  Zap, AlertCircle,
} from 'lucide-react'
import type { RouteData, RouteIncident, RouteRiskFactor } from '@/types'
import { toast } from 'sonner'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDist(m: number) { return (m / 1000).toFixed(2) + ' km' }
function formatTime(s: number) {
  const min = Math.round(s / 60)
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`
}
function riskColor(level: string) {
  if (level === 'safe') return 'text-green-500'
  if (level === 'moderate') return 'text-amber-500'
  return 'text-red-500'
}
function riskBg(level: string) {
  if (level === 'safe') return 'bg-green-500/10 border-green-500/30 text-green-700'
  if (level === 'moderate') return 'bg-amber-500/10 border-amber-500/30 text-amber-700'
  return 'bg-red-500/10 border-red-500/30 text-red-700'
}
function riskBadgeBg(level: string) {
  if (level === 'safe') return 'bg-green-500'
  if (level === 'moderate') return 'bg-amber-500'
  return 'bg-red-500'
}
function scoreBarColor(score: number) {
  if (score >= 75) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}
function compositeBarColor(score: number) {
  if (score >= 70) return 'bg-indigo-500'
  if (score >= 45) return 'bg-sky-500'
  return 'bg-slate-400'
}

/** Route palette – keeps map and UI colors in sync */
const ROUTE_PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
function routeLineColor(idx: number) {
  return ROUTE_PALETTE[idx % ROUTE_PALETTE.length]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskFactorPill({ factor }: { factor: RouteRiskFactor }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted/60 border border-muted rounded-full text-[10px] font-medium text-foreground/80 whitespace-nowrap">
      <span>{factor.icon}</span>
      <span>{factor.name}</span>
      <span className="text-muted-foreground">×{factor.count}</span>
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RoutePlanPage() {
  const [startLocation, setStartLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [destLocation, setDestLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [selectingMode, setSelectingMode] = useState<'start' | 'dest' | null>(null)
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0)
  const [hasAutoSelected, setHasAutoSelected] = useState(false)

  const [activeRoutePoints, setActiveRoutePoints] = useState<{
    startLat: number; startLng: number; destLat: number; destLng: number
  } | null>(null)

  const { data: routeResponse, isLoading, isError, error } = useSafeRoute(
    activeRoutePoints?.startLat ?? null,
    activeRoutePoints?.startLng ?? null,
    activeRoutePoints?.destLat ?? null,
    activeRoutePoints?.destLng ?? null
  )

  const routes: RouteData[] = routeResponse?.routes ?? []

  // Auto-select the recommended route when response first arrives
  useEffect(() => {
    if (routeResponse && !hasAutoSelected) {
      const recIdx = routeResponse.recommended_route_idx ?? 0
      setSelectedRouteIdx(recIdx)
      setHasAutoSelected(true)
    }
  }, [routeResponse, hasAutoSelected])

  const handleMapClick = (lat: number, lng: number) => {
    if (selectingMode === 'start') {
      setStartLocation({ lat, lng })
      setSelectingMode(null)
      toast.success(`Start set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    } else if (selectingMode === 'dest') {
      setDestLocation({ lat, lng })
      setSelectingMode(null)
      toast.success(`Destination set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    } else {
      if (!startLocation) {
        setStartLocation({ lat, lng })
        toast.success(`Start set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      } else {
        setDestLocation({ lat, lng })
        toast.success(`Destination set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      }
    }
  }

  const handleCalculate = () => {
    if (startLocation && destLocation) {
      setHasAutoSelected(false)
      setSelectedRouteIdx(0)
      setActiveRoutePoints({
        startLat: startLocation.lat, startLng: startLocation.lng,
        destLat: destLocation.lat, destLng: destLocation.lng,
      })
    }
  }

  const handleClear = () => {
    setStartLocation(null)
    setDestLocation(null)
    setActiveRoutePoints(null)
    setSelectingMode(null)
    setSelectedRouteIdx(0)
    setHasAutoSelected(false)
  }

  const currentRoute: RouteData | null = routes[selectedRouteIdx] ?? null

  // Map incidents for the selected route only
  const mapIncidents: any[] = currentRoute?.incidents.map((inc: RouteIncident) => ({
    id: inc.id,
    title: inc.title,
    description: inc.description,
    severity: inc.severity,
    location_lat: inc.lat,
    location_lng: inc.lng,
    category: { icon: inc.category_icon, name: inc.category_name },
    status: 'approved',
  })) ?? []

  const mapCenter: [number, number] = destLocation
    ? [destLocation.lat, destLocation.lng]
    : startLocation
    ? [startLocation.lat, startLocation.lng]
    : [11.0168, 76.9558]

  const mapZoom = startLocation || destLocation ? 14 : 12

  // Badge indices
  const recommendedIdx = routeResponse?.recommended_route_idx ?? -1
  const safestIdx = routeResponse?.safest_route_idx ?? -1
  const shortestIdx = routeResponse?.shortest_route_idx ?? -1
  const cleanIdx = routeResponse?.clean_route_idx ?? -1
  const avoidanceWarning = routeResponse?.avoidance_warning ?? false
  const avoidanceZoneCount = routeResponse?.avoidance_zone_count ?? 0

  return (
    <div className="container mx-auto py-6 px-4 flex flex-col lg:flex-row gap-6 max-w-7xl">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col gap-4">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Navigation className="w-6 h-6 text-primary rotate-45" />
            Route Planning
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Compare {routes.length > 0 ? routes.length : 'multiple'} route alternatives ranked by safety + distance.
          </p>
        </div>

        {/* Input Card */}
        <Card className="shadow-md border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Route Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">

            {/* Start */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Starting Location</span>
              <div className="flex items-center gap-2">
                <Button
                  variant={selectingMode === 'start' ? 'default' : 'outline'}
                  onClick={() => setSelectingMode(selectingMode === 'start' ? null : 'start')}
                  className="flex-1 justify-start text-xs font-medium truncate h-9"
                  id="btn-select-start"
                >
                  <MapPin className="w-3.5 h-3.5 mr-2 text-green-500 shrink-0" />
                  {startLocation
                    ? `${startLocation.lat.toFixed(4)}, ${startLocation.lng.toFixed(4)}`
                    : 'Select on map…'}
                </Button>
                {startLocation && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0"
                    onClick={() => setStartLocation(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Destination */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Destination</span>
              <div className="flex items-center gap-2">
                <Button
                  variant={selectingMode === 'dest' ? 'default' : 'outline'}
                  onClick={() => setSelectingMode(selectingMode === 'dest' ? null : 'dest')}
                  className="flex-1 justify-start text-xs font-medium truncate h-9"
                  id="btn-select-dest"
                >
                  <MapPin className="w-3.5 h-3.5 mr-2 text-blue-500 shrink-0" />
                  {destLocation
                    ? `${destLocation.lat.toFixed(4)}, ${destLocation.lng.toFixed(4)}`
                    : 'Select on map…'}
                </Button>
                {destLocation && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0"
                    onClick={() => setDestLocation(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-1">
              <Button
                id="btn-find-route"
                className="flex-1 text-xs"
                onClick={handleCalculate}
                disabled={!startLocation || !destLocation || isLoading}
              >
                {isLoading ? 'Calculating…' : 'Find Safe Route Alternatives'}
              </Button>
              {(startLocation || destLocation || activeRoutePoints) && (
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg shrink-0"
                  onClick={handleClear}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {isError && (
              <p className="text-xs text-destructive mt-1">
                Failed: {(error as Error)?.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Avoidance warning banner */}
        {avoidanceWarning && avoidanceZoneCount > 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-800 text-[11px] leading-snug">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <span>
              <strong>{avoidanceZoneCount} HIGH/CRITICAL danger zone{avoidanceZoneCount !== 1 ? 's' : ''}</strong> detected near this corridor.
              All route alternatives pass through at least one — showing best available options with warning.
            </span>
          </div>
        )}

        {/* ── Route Comparison Panel ─────────────────────────────────────── */}
        {routes.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5" /> Route Alternatives
              </span>
              <span className="text-[10px] text-muted-foreground">{routes.length} distinct route{routes.length !== 1 ? 's' : ''}</span>
            </div>

            {routes.map((route, idx) => {
              const isSelected = idx === selectedRouteIdx
              const isRecommended = idx === recommendedIdx
              const isSafest = idx === safestIdx
              const isShortest = idx === shortestIdx
              const isClean = idx === cleanIdx
              const lineColor = routeLineColor(idx)

              return (
                <button
                  key={idx}
                  id={`btn-route-${idx}`}
                  onClick={() => setSelectedRouteIdx(idx)}
                  className={`w-full text-left rounded-xl border p-3 transition-all duration-150 ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30'
                      : 'border-muted bg-card hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  {/* Route header row */}
                  <div className="flex items-center gap-2 mb-2.5">
                    {/* Color swatch matching map line */}
                    <span className="w-3 h-3 rounded-full shrink-0 border-2 border-white shadow"
                      style={{ backgroundColor: lineColor }} />
                    <span className="text-xs font-bold text-foreground flex-1 truncate">
                      {route.label ?? `Route ${idx + 1}`}
                    </span>

                    {/* Badges */}
                    <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                      {isRecommended && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-600 text-white uppercase flex items-center gap-0.5">
                          <Star className="w-2 h-2" />Rec
                        </span>
                      )}
                      {isSafest && !isRecommended && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500 text-white uppercase">
                          Safest
                        </span>
                      )}
                      {isShortest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white uppercase">
                          Shortest
                        </span>
                      )}
                      {isClean && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white uppercase flex items-center gap-0.5">
                          <CheckCircle className="w-2 h-2" />Clean
                        </span>
                      )}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white uppercase ${riskBadgeBg(route.route_risk_level)}`}>
                        {route.route_risk_level}
                      </span>
                    </div>
                  </div>

                  {/* Safety score bar */}
                  <div className="mb-2">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] text-muted-foreground font-medium">Safety</span>
                      <span className={`text-[11px] font-bold ${riskColor(route.route_risk_level)}`}>
                        {route.safety_score.toFixed(0)}/100
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(route.safety_score)}`}
                        style={{ width: `${route.safety_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Composite score bar */}
                  {route.composite_score !== undefined && (
                    <div className="mb-2.5">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[10px] text-muted-foreground font-medium">Overall</span>
                        <span className="text-[11px] font-bold text-indigo-600">
                          {route.composite_score.toFixed(0)}/100
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${compositeBarColor(route.composite_score)}`}
                          style={{ width: `${route.composite_score}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
                    <div className="flex flex-col bg-muted/40 rounded-lg p-1.5">
                      <span className="text-[9px] text-muted-foreground uppercase">Distance</span>
                      <span className="text-[11px] font-bold">{formatDist(route.distance_m)}</span>
                    </div>
                    <div className="flex flex-col bg-muted/40 rounded-lg p-1.5">
                      <span className="text-[9px] text-muted-foreground uppercase">ETA</span>
                      <span className="text-[11px] font-bold">{formatTime(route.duration_s)}</span>
                    </div>
                    <div className="flex flex-col bg-muted/40 rounded-lg p-1.5">
                      <span className="text-[9px] text-muted-foreground uppercase">Hazards</span>
                      <span className={`text-[11px] font-bold ${(route.relevant_incident_count ?? 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {route.relevant_incident_count ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Risk factors pills */}
                  {route.risk_factors && route.risk_factors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {route.risk_factors.map((f, fi) => (
                        <RiskFactorPill key={fi} factor={f} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Selected Route Details ─────────────────────────────────────── */}
        {currentRoute && (
          <Card className="shadow-md border-muted border-l-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{ borderLeftColor: routeLineColor(selectedRouteIdx) }}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                {currentRoute.label ?? `Route ${selectedRouteIdx + 1}`} — Details
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">

              {/* Explanation */}
              {currentRoute.explanation && (
                <div className={`text-[11px] p-2.5 rounded-lg border mb-3 leading-relaxed ${riskBg(currentRoute.route_risk_level)}`}>
                  <div className="flex items-start gap-1.5">
                    {currentRoute.route_risk_level === 'safe'
                      ? <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      : <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />}
                    <span>{currentRoute.explanation}</span>
                  </div>
                </div>
              )}

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="flex flex-col items-center p-2.5 bg-muted/40 rounded-xl border border-muted/50">
                  <Activity className="w-4 h-4 mb-1 text-primary" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Safety Score</span>
                  <span className={`text-base font-bold ${riskColor(currentRoute.route_risk_level)}`}>
                    {currentRoute.safety_score.toFixed(0)}/100
                  </span>
                </div>
                <div className="flex flex-col items-center p-2.5 bg-muted/40 rounded-xl border border-muted/50">
                  <Zap className="w-4 h-4 mb-1 text-indigo-500" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Overall Score</span>
                  <span className="text-base font-bold text-indigo-600">
                    {currentRoute.composite_score?.toFixed(0) ?? '–'}/100
                  </span>
                </div>
                <div className="flex flex-col items-center p-2.5 bg-muted/40 rounded-xl border border-muted/50">
                  <Navigation className="w-4 h-4 mb-1 text-primary" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Distance</span>
                  <span className="text-xs font-bold">{formatDist(currentRoute.distance_m)}</span>
                </div>
                <div className="flex flex-col items-center p-2.5 bg-muted/40 rounded-xl border border-muted/50">
                  <Clock className="w-4 h-4 mb-1 text-primary" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Duration</span>
                  <span className="text-xs font-bold">{formatTime(currentRoute.duration_s)}</span>
                </div>
              </div>

              {/* Risk factors in detail view */}
              {currentRoute.risk_factors && currentRoute.risk_factors.length > 0 && (
                <div className="mb-3 border-t pt-3">
                  <h3 className="font-semibold text-xs text-muted-foreground mb-2 uppercase flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> Main Risk Factors
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {currentRoute.risk_factors.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-2 text-xs">
                        <span className="text-base shrink-0">{f.icon}</span>
                        <span className="flex-1 text-foreground/80 font-medium">{f.name}</span>
                        <span className="text-[10px] text-muted-foreground">{f.count} incident{f.count !== 1 ? 's' : ''}</span>
                        <span className="text-[10px] text-red-500 font-mono ml-1">−{f.total_penalty.toFixed(1)} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incidents along route */}
              <div className="border-t pt-3">
                <h3 className="font-semibold text-xs text-muted-foreground mb-2 uppercase flex items-center gap-1.5">
                  <Shield className="w-3 h-3" />
                  Incidents Along This Route
                </h3>

                {currentRoute.incidents.length === 0 ? (
                  <p className="text-xs text-green-600 bg-green-500/10 border border-green-500/20 p-2.5 rounded-lg flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    No active incidents on this path!
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {currentRoute.incidents.map((inc) => (
                      <div key={inc.id}
                        className={`flex items-center p-2 rounded-lg border text-xs gap-2 ${
                          inc.is_route_relevant === false ? 'opacity-40' : ''
                        }`}
                      >
                        <span className="text-lg shrink-0">{inc.category_icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{inc.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate flex gap-1">
                            <span>{inc.category_name}</span>
                            {inc.distance_meters !== undefined && (
                              <span>· {Math.round(inc.distance_meters)}m away</span>
                            )}
                            {inc.is_verified === false && (
                              <span className="text-amber-500">· unverified</span>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase border ${riskBg(inc.severity)}`}>
                            {inc.severity}
                          </span>
                          {inc.penalty_impact !== undefined && inc.penalty_impact > 0 && (
                            <span className="text-[9px] text-red-500 font-mono">
                              -{inc.penalty_impact.toFixed(1)} pts
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 h-[500px] lg:h-[calc(100vh-8rem)] rounded-2xl overflow-hidden shadow-xl border relative bg-muted">
        {selectingMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-4 py-2 rounded-full shadow text-xs font-semibold flex items-center gap-1.5 animate-pulse">
            <MapPin className="w-3.5 h-3.5" />
            Click map to set {selectingMode === 'start' ? 'Starting Point' : 'Destination'}
          </div>
        )}

        {/* Route count badge */}
        {routes.length > 1 && (
          <div className="absolute top-4 right-4 z-[1000] bg-background/90 border text-foreground px-3 py-1.5 rounded-full shadow text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            {routes.length} routes shown
          </div>
        )}

        {/* Legend for multi-route */}
        {routes.length > 1 && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 border rounded-xl px-3 py-2 shadow text-[10px] backdrop-blur flex flex-col gap-1">
            {routes.map((r, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedRouteIdx(idx)}
                className={`flex items-center gap-1.5 font-medium transition-opacity ${idx === selectedRouteIdx ? 'opacity-100' : 'opacity-60 hover:opacity-90'}`}
              >
                <span className="w-3 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: routeLineColor(idx) }} />
                <span className="truncate max-w-[120px]">{r.label ?? `Route ${idx + 1}`}</span>
                <span className={`ml-auto font-bold ${riskColor(r.route_risk_level)}`}>{r.safety_score.toFixed(0)}</span>
              </button>
            ))}
          </div>
        )}

        <IncidentMap
          incidents={mapIncidents}
          height="100%"
          onLocationSelect={handleMapClick}
          startLocation={startLocation}
          destLocation={destLocation}
          allRoutes={routes.length > 0 ? routes : undefined}
          selectedRouteIdx={selectedRouteIdx}
          center={mapCenter}
          zoom={mapZoom}
        />
      </div>
    </div>
  )
}
