import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IncidentMap } from '@/components/map/IncidentMap'
import { useSafeRoute } from '@/api/routes'
import { MapPin, ShieldAlert, Navigation, Clock, Activity } from 'lucide-react'
import type { RouteData, RouteIncident } from '@/types'

import { toast } from 'sonner'

export function RoutePlanPage() {
  const [startLocation, setStartLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [destLocation, setDestLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [selectingMode, setSelectingMode] = useState<'start' | 'dest' | null>(null)
  const [preferredRoute, setPreferredRoute] = useState<'safest' | 'shortest'>('safest')
  const [queryTrigger, setQueryTrigger] = useState(false)

  // Only run query when explicitly triggered with both locations
  const { data: routeResponse, isLoading, isError, error } = useSafeRoute(
    queryTrigger && startLocation ? startLocation.lat : null,
    queryTrigger && startLocation ? startLocation.lng : null,
    queryTrigger && destLocation ? destLocation.lat : null,
    queryTrigger && destLocation ? destLocation.lng : null
  )

  const handleMapClick = (lat: number, lng: number) => {
    if (selectingMode === 'start') {
      setStartLocation({ lat, lng })
      setSelectingMode(null)
      setQueryTrigger(false)
      toast.success(`Start location set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    } else if (selectingMode === 'dest') {
      setDestLocation({ lat, lng })
      setSelectingMode(null)
      setQueryTrigger(false)
      toast.success(`Destination set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    } else {
      if (!startLocation) {
        setStartLocation({ lat, lng })
        toast.success(`Start location set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      } else {
        setDestLocation({ lat, lng })
        toast.success(`Destination set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      }
      setQueryTrigger(false)
    }
  }

  const handleCalculate = () => {
    if (startLocation && destLocation) {
      setQueryTrigger(true)
    }
  }

  // Determine which route to display based on preference
  let currentRoute: RouteData | null = null
  if (routeResponse && routeResponse.routes.length > 0) {
    if (preferredRoute === 'safest') {
      currentRoute = routeResponse.routes[routeResponse.safest_route_idx]
    } else {
      currentRoute = routeResponse.routes[routeResponse.shortest_route_idx]
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

  // Transform route incidents to full Incident objects for map rendering
  // (We mock missing fields since we only need map display)
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

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col md:flex-row gap-6 max-w-7xl">
      {/* Sidebar Controls */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Safe Route Plan</h1>
        
        <Card className="shadow-lg border-muted">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Route Selector
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-muted-foreground uppercase">Starting Point</label>
              <div className="flex gap-2">
                <Button 
                  variant={selectingMode === 'start' ? 'default' : 'outline'}
                  onClick={() => setSelectingMode(selectingMode === 'start' ? null : 'start')}
                  className="w-full justify-start overflow-hidden text-ellipsis"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  {startLocation ? `${startLocation.lat.toFixed(4)}, ${startLocation.lng.toFixed(4)}` : 'Select on map'}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-muted-foreground uppercase">Destination</label>
              <div className="flex gap-2">
                <Button 
                  variant={selectingMode === 'dest' ? 'default' : 'outline'}
                  onClick={() => setSelectingMode(selectingMode === 'dest' ? null : 'dest')}
                  className="w-full justify-start overflow-hidden text-ellipsis"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  {destLocation ? `${destLocation.lat.toFixed(4)}, ${destLocation.lng.toFixed(4)}` : 'Select on map'}
                </Button>
              </div>
            </div>

            <Button 
              className="mt-4 w-full"
              size="lg"
              onClick={handleCalculate}
              disabled={!startLocation || !destLocation || isLoading}
            >
              {isLoading ? 'Calculating...' : 'Calculate Route'}
            </Button>
            
            {isError && (
              <p className="text-sm text-red-500 mt-2">Error calculating route. {(error as Error)?.message}</p>
            )}

          </CardContent>
        </Card>

        {routeResponse && currentRoute && (
          <Card className="shadow-lg border-muted border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center justify-between">
                Route Details
                <div className="flex bg-muted p-1 rounded-lg">
                  <button 
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${preferredRoute === 'safest' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-muted/80'}`}
                    onClick={() => setPreferredRoute('safest')}
                  >
                    Safest
                  </button>
                  <button 
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${preferredRoute === 'shortest' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-muted/80'}`}
                    onClick={() => setPreferredRoute('shortest')}
                  >
                    Shortest
                  </button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex flex-col items-center p-4 bg-muted/50 rounded-xl">
                  <Activity className="w-6 h-6 mb-2 text-primary" />
                  <span className="text-sm text-muted-foreground">Safety Score</span>
                  <span className="text-2xl font-bold">{currentRoute.safety_score.toFixed(0)}</span>
                </div>
                <div className="flex flex-col items-center p-4 bg-muted/50 rounded-xl">
                  <ShieldAlert className={`w-6 h-6 mb-2 ${riskColor(currentRoute.route_risk_level)}`} />
                  <span className="text-sm text-muted-foreground">Risk Level</span>
                  <span className={`text-xl font-bold uppercase ${riskColor(currentRoute.route_risk_level)}`}>
                    {currentRoute.route_risk_level}
                  </span>
                </div>
                <div className="flex flex-col items-center p-4 bg-muted/50 rounded-xl">
                  <Navigation className="w-6 h-6 mb-2 text-primary" />
                  <span className="text-sm text-muted-foreground">Distance</span>
                  <span className="text-xl font-bold">{formatDistance(currentRoute.distance_m)}</span>
                </div>
                <div className="flex flex-col items-center p-4 bg-muted/50 rounded-xl">
                  <Clock className="w-6 h-6 mb-2 text-primary" />
                  <span className="text-sm text-muted-foreground">ETA</span>
                  <span className="text-xl font-bold">{formatTime(currentRoute.duration_s)}</span>
                </div>
              </div>
              
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase">Incidents Along Route</h3>
                {currentRoute.incidents.length === 0 ? (
                  <p className="text-sm text-green-600 bg-green-500/10 p-3 rounded-lg flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-2" /> No reported incidents on this route!
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {currentRoute.incidents.map(inc => (
                      <div key={inc.id} className="flex items-center p-2 rounded-lg bg-background border">
                        <span className="text-2xl mr-3">{inc.category_icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{inc.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{inc.category_name}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full uppercase font-bold
                          ${inc.severity === 'critical' ? 'bg-red-500/10 text-red-500' : ''}
                          ${inc.severity === 'high' ? 'bg-orange-500/10 text-orange-500' : ''}
                          ${inc.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-600' : ''}
                          ${inc.severity === 'low' ? 'bg-green-500/10 text-green-500' : ''}
                        `}>
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
      <div className="w-full md:w-2/3 h-[600px] md:h-[calc(100vh-8rem)] rounded-2xl overflow-hidden shadow-2xl border-4 border-background relative">
        {selectingMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg font-semibold animate-bounce">
            Click on the map to set {selectingMode === 'start' ? 'Starting Point' : 'Destination'}
          </div>
        )}
        <IncidentMap 
          incidents={mapIncidents} 
          height="100%" 
          onLocationSelect={handleMapClick}
          startLocation={startLocation}
          destLocation={destLocation}
          routeData={currentRoute}
        />
      </div>
    </div>
  )
}
