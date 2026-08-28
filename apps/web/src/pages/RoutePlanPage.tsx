import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IncidentMap } from '@/components/map/IncidentMap'
import { useSafeRoute } from '@/api/routes'
import { MapPin, ShieldAlert, Navigation, Clock, Activity, X } from 'lucide-react'
import type { RouteData, RouteIncident } from '@/types'
import { toast } from 'sonner'

export function RoutePlanPage() {
  const [startLocation, setStartLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [destLocation, setDestLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [selectingMode, setSelectingMode] = useState<'start' | 'dest' | null>(null)
  const [preferredRoute, setPreferredRoute] = useState<'safest' | 'shortest'>('safest')
  
  // Coordinates actually submitted for the API query
  const [activeRoutePoints, setActiveRoutePoints] = useState<{
    startLat: number
    startLng: number
    destLat: number
    destLng: number
  } | null>(null)

  const { data: routeResponse, isLoading, isError, error } = useSafeRoute(
    activeRoutePoints ? activeRoutePoints.startLat : null,
    activeRoutePoints ? activeRoutePoints.startLng : null,
    activeRoutePoints ? activeRoutePoints.destLat : null,
    activeRoutePoints ? activeRoutePoints.destLng : null
  )

  const handleMapClick = (lat: number, lng: number) => {
    if (selectingMode === 'start') {
      setStartLocation({ lat, lng })
      setSelectingMode(null)
      toast.success(`Start location set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    } else if (selectingMode === 'dest') {
      setDestLocation({ lat, lng })
      setSelectingMode(null)
      toast.success(`Destination set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    } else {
      if (!startLocation) {
        setStartLocation({ lat, lng })
        toast.success(`Start location set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      } else {
        setDestLocation({ lat, lng })
        toast.success(`Destination set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      }
    }
  };

  const handleCalculate = () => {
    if (startLocation && destLocation) {
      setActiveRoutePoints({
        startLat: startLocation.lat,
        startLng: startLocation.lng,
        destLat: destLocation.lat,
        destLng: destLocation.lng
      })
    }
  }

  const handleClear = () => {
    setStartLocation(null)
    setDestLocation(null)
    setActiveRoutePoints(null)
    setSelectingMode(null)
  }

  // Determine which route to display based on preference
  let currentRoute: RouteData | null = null
  if (routeResponse && routeResponse.routes && routeResponse.routes.length > 0) {
    if (preferredRoute === 'safest') {
      currentRoute = routeResponse.routes[routeResponse.safest_route_idx ?? 0]
    } else {
      currentRoute = routeResponse.routes[routeResponse.shortest_route_idx ?? 0]
    }
  }

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(2) + ' km'
  }
  
  const formatTime = (seconds: number) => {
    const min = Math.round(seconds / 60)
    if (min >= 60) {
      return `${Math.floor(min / 60)}h ${min % 60}m`
    }
    return `${min} min`
  }

  const riskColor = (level: string) => {
    if (level === 'safe') return 'text-green-500'
    if (level === 'moderate') return 'text-orange-500'
    return 'text-red-500'
  }

  const riskBg = (level: string) => {
    if (level === 'safe') return 'bg-green-500/10 border-green-500/20'
    if (level === 'moderate') return 'bg-orange-500/10 border-orange-500/20'
    return 'bg-red-500/10 border-red-500/20'
  }

  // Transform route incidents to full Incident objects for map rendering
  const mapIncidents: any[] = currentRoute?.incidents.map((inc: RouteIncident) => ({
    id: inc.id,
    title: inc.title,
    description: inc.description,
    severity: inc.severity,
    location_lat: inc.lat,
    location_lng: inc.lng,
    category: {
      icon: inc.category_icon,
      name: inc.category_name,
    },
    status: 'approved',
  })) || []

  // Center the map dynamically
  const mapCenter: [number, number] = destLocation 
    ? [destLocation.lat, destLocation.lng]
    : startLocation
    ? [startLocation.lat, startLocation.lng]
    : [11.0168, 76.9558]

  const mapZoom = startLocation || destLocation ? 14 : 12

  return (
    <div className="container mx-auto py-6 px-4 flex flex-col lg:flex-row gap-6 max-w-7xl">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Navigation className="w-6 h-6 text-primary rotate-45" />
            Route Planning
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Plan safety-optimized routes avoiding reported threat areas.
          </p>
        </div>
        
        <Card className="shadow-md border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Route Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            
            {/* Start Location Input */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Starting Location</span>
              <div className="flex items-center gap-2">
                <Button 
                  variant={selectingMode === 'start' ? 'default' : 'outline'}
                  onClick={() => setSelectingMode(selectingMode === 'start' ? null : 'start')}
                  className="flex-1 justify-start text-xs font-medium truncate h-9"
                >
                  <MapPin className="w-3.5 h-3.5 mr-2 text-green-500 shrink-0" />
                  {startLocation 
                    ? `${startLocation.lat.toFixed(4)}, ${startLocation.lng.toFixed(4)}` 
                    : 'Select on map...'}
                </Button>
                {startLocation && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => setStartLocation(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Destination Location Input */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Destination</span>
              <div className="flex items-center gap-2">
                <Button 
                  variant={selectingMode === 'dest' ? 'default' : 'outline'}
                  onClick={() => setSelectingMode(selectingMode === 'dest' ? null : 'dest')}
                  className="flex-1 justify-start text-xs font-medium truncate h-9"
                >
                  <MapPin className="w-3.5 h-3.5 mr-2 text-blue-500 shrink-0" />
                  {destLocation 
                    ? `${destLocation.lat.toFixed(4)}, ${destLocation.lng.toFixed(4)}` 
                    : 'Select on map...'}
                </Button>
                {destLocation && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => setDestLocation(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <Button 
                className="flex-1 text-xs"
                onClick={handleCalculate}
                disabled={!startLocation || !destLocation || isLoading}
              >
                {isLoading ? 'Calculating...' : 'Find Safest Route'}
              </Button>
              {(startLocation || destLocation || activeRoutePoints) && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 rounded-lg shrink-0"
                  onClick={handleClear}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {isError && (
              <p className="text-xs text-destructive mt-1">
                Failed to plan route: {(error as Error)?.message}
              </p>
            )}

          </CardContent>
        </Card>

        {/* Route Details Panel */}
        {routeResponse && currentRoute && (
          <Card className="shadow-md border-muted border-l-4 border-l-primary animate-in fade-in slide-in-from-bottom-2 duration-200">
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Route Metrics
              </CardTitle>
              <div className="flex bg-muted p-0.5 rounded-lg border">
                {(['safest', 'shortest'] as const).map((pref) => (
                  <button 
                    key={pref}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md capitalize transition-colors ${
                      preferredRoute === pref 
                        ? 'bg-background text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setPreferredRoute(pref)}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex flex-col items-center p-2.5 bg-muted/40 rounded-xl border border-muted/50">
                  <Activity className="w-4 h-4 mb-1 text-primary" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Safety Score</span>
                  <span className="text-base font-bold">{currentRoute.safety_score.toFixed(0)}/100</span>
                </div>
                <div className="flex flex-col items-center p-2.5 bg-muted/40 rounded-xl border border-muted/50">
                  <ShieldAlert className={`w-4 h-4 mb-1 ${riskColor(currentRoute.route_risk_level)}`} />
                  <span className="text-[10px] text-muted-foreground font-semibold">Risk Level</span>
                  <span className={`text-xs font-bold uppercase ${riskColor(currentRoute.route_risk_level)}`}>
                    {currentRoute.route_risk_level}
                  </span>
                </div>
                <div className="flex flex-col items-center p-2.5 bg-muted/40 rounded-xl border border-muted/50">
                  <Navigation className="w-4 h-4 mb-1 text-primary" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Distance</span>
                  <span className="text-xs font-bold">{formatDistance(currentRoute.distance_m)}</span>
                </div>
                <div className="flex flex-col items-center p-2.5 bg-muted/40 rounded-xl border border-muted/50">
                  <Clock className="w-4 h-4 mb-1 text-primary" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Duration</span>
                  <span className="text-xs font-bold">{formatTime(currentRoute.duration_s)}</span>
                </div>
              </div>
              
              {/* Incidents Section */}
              <div className="mt-4 border-t pt-3">
                <h3 className="font-semibold text-xs text-muted-foreground mb-2 uppercase">Incidents Along Route</h3>
                {currentRoute.incidents.length === 0 ? (
                  <p className="text-xs text-green-600 bg-green-500/10 border border-green-500/20 p-2.5 rounded-lg flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" /> No active incidents on this path!
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {currentRoute.incidents.map((inc) => (
                      <div key={inc.id} className="flex items-center p-2 rounded-lg bg-card border text-xs gap-2">
                        <span className="text-lg shrink-0">{inc.category_icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{inc.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{inc.category_name}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold shrink-0 ${riskBg(inc.severity)} ${riskColor(inc.severity)}`}>
                          {inc.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Map Area */}
      <div className="flex-1 h-[500px] lg:h-[calc(100vh-8rem)] rounded-2xl overflow-hidden shadow-xl border relative bg-muted">
        {selectingMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-4 py-2 rounded-full shadow text-xs font-semibold flex items-center gap-1.5 animate-pulse">
            <MapPin className="w-3.5 h-3.5" />
            Click on map to select {selectingMode === 'start' ? 'Starting Point' : 'Destination'}
          </div>
        )}
        <IncidentMap 
          incidents={mapIncidents} 
          height="100%" 
          onLocationSelect={handleMapClick}
          startLocation={startLocation}
          destLocation={destLocation}
          routeData={currentRoute}
          center={mapCenter}
          zoom={mapZoom}
        />
      </div>
    </div>
  )
}
