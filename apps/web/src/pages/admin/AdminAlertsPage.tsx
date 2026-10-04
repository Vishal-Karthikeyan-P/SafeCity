import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  BellRing,
  MapPin,
  Users,
  AlertTriangle,
  ShieldAlert,
  Info,
  Radio,
  Send,
  Trash2,
  CheckCircle,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAdminAlerts, useCreateAlert, useDeleteAlert } from '@/api/alerts'
import { formatDate } from '@/lib/utils'

// Default center: Coimbatore, Tamil Nadu
const DEFAULT_CENTER: [number, number] = [11.0168, 76.9558]

// Fix Leaflet marker icons in Vite
const initMarker = () => {
  if (L.Icon.Default.prototype) {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }
}

export function AdminAlertsPage() {
  const { data: alerts = [], isLoading } = useAdminAlerts()
  const { mutate: createAlert, isPending: isCreating } = useCreateAlert()
  const { mutate: deleteAlert, isPending: isDeleting } = useDeleteAlert()

  // Form State
  const [targetScope, setTargetScope] = useState<'all_users' | 'location_based'>('all_users')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [alertType, setAlertType] = useState('emergency_notice')
  const [expiresInHours, setExpiresInHours] = useState('24')

  // Location-based fields
  const [lat, setLat] = useState<number>(DEFAULT_CENTER[0])
  const [lng, setLng] = useState<number>(DEFAULT_CENTER[1])
  const [radiusKm, setRadiusKm] = useState<number>(5.0)

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)

  // Initialize and update Leaflet map for location preview
  useEffect(() => {
    if (targetScope !== 'location_based') {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
        circleRef.current = null
      }
      return
    }

    initMarker()

    // Wait a tick for container to mount
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current).setView([lat, lng], 12)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        // Add clickable listener to select coordinates directly from map
        map.on('click', (e: L.LeafletMouseEvent) => {
          const newLat = parseFloat(e.latlng.lat.toFixed(6))
          const newLng = parseFloat(e.latlng.lng.toFixed(6))
          setLat(newLat)
          setLng(newLng)
        })

        const marker = L.marker([lat, lng], { draggable: true }).addTo(map)
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          setLat(parseFloat(pos.lat.toFixed(6)))
          setLng(parseFloat(pos.lng.toFixed(6)))
        })

        const circle = L.circle([lat, lng], {
          radius: radiusKm * 1000,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.18,
          weight: 2,
        }).addTo(map)

        mapInstanceRef.current = map
        markerRef.current = marker
        circleRef.current = circle
      } else {
        const map = mapInstanceRef.current
        map.setView([lat, lng])
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        }
        if (circleRef.current) {
          circleRef.current.setLatLng([lat, lng])
          circleRef.current.setRadius(radiusKm * 1000)
        }
        map.invalidateSize()
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [targetScope, lat, lng, radiusKm])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return

    createAlert(
      {
        title: title.trim(),
        message: message.trim(),
        alert_type: alertType,
        target_scope: targetScope,
        location_lat: targetScope === 'location_based' ? lat : null,
        location_lng: targetScope === 'location_based' ? lng : null,
        radius_km: targetScope === 'location_based' ? radiusKm : null,
        expires_in_hours: expiresInHours === 'none' ? 0 : parseInt(expiresInHours, 10),
      },
      {
        onSuccess: () => {
          setTitle('')
          setMessage('')
        },
      }
    )
  }

  // Quick stats
  const totalAlerts = alerts.length
  const activeAlerts = alerts.filter((a) => a.is_active).length
  const broadcastAlerts = alerts.filter((a) => a.target_scope === 'all_users').length
  const locationAlerts = alerts.filter((a) => a.target_scope === 'location_based').length

  const getAlertBadge = (type: string) => {
    switch (type) {
      case 'emergency_notice':
        return <Badge variant="destructive">Emergency Notice</Badge>
      case 'high_risk_area':
        return <Badge className="bg-red-600 text-white">High-Risk Area</Badge>
      case 'nearby_incident':
        return <Badge className="bg-amber-500 text-white">Incident Advisory</Badge>
      default:
        return <Badge variant="outline">System Announcement</Badge>
    }
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white shadow-md">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Community Alerts Management</h1>
            <p className="text-muted-foreground mt-0.5">
              Broadcast city-wide alerts or target specific geographic hazard zones with PostGIS proximity.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Alerts</p>
            <p className="text-2xl font-bold mt-1">{totalAlerts}</p>
          </div>
          <Layers className="w-8 h-8 text-primary/40" />
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active Alerts</p>
            <p className="text-2xl font-bold text-safe-600 mt-1">{activeAlerts}</p>
          </div>
          <CheckCircle className="w-8 h-8 text-safe-500/40" />
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Broadcast (All Users)</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{broadcastAlerts}</p>
          </div>
          <Users className="w-8 h-8 text-blue-500/40" />
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Location-Targeted</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{locationAlerts}</p>
          </div>
          <MapPin className="w-8 h-8 text-amber-500/40" />
        </Card>
      </div>

      {/* Create Alert Section */}
      <Card className="border-primary/20 shadow-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            Dispatch New Community Alert
          </CardTitle>
          <CardDescription>
            Select between an all-user broadcast or pinpoint a geographic hazard radius. Reuses existing Web & Push notification delivery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Alert Mode Selector (TWO MODES) */}
            <div>
              <label className="text-sm font-semibold mb-2 block text-foreground">
                Alert Delivery Scope <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTargetScope('all_users')}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${
                    targetScope === 'all_users'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-border/80 bg-card'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      targetScope === 'all_users' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">All Users (General / Broadcast)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      No coordinates required. Delivers in-app & push notification to all citizens city-wide.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetScope('location_based')}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${
                    targetScope === 'location_based'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-border/80 bg-card'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      targetScope === 'location_based' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Location Based (Geographic Zone)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select coordinates and radius on map. Delivers only to citizens within the danger radius.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Title & Category Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Alert Title</label>
                <Input
                  placeholder="e.g., Flash Flood Warning at Gandhipuram Subway"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category / Severity</label>
                <Select value={alertType} onValueChange={setAlertType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency_notice">🚨 Emergency Notice (Critical)</SelectItem>
                    <SelectItem value="high_risk_area">⚠️ High-Risk Area</SelectItem>
                    <SelectItem value="nearby_incident">📍 Nearby Hazard Advisory</SelectItem>
                    <SelectItem value="system_announcement">📢 System Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Alert Message & Public Advice</label>
              <textarea
                className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Describe the hazard clearly with actionable instructions (e.g. road closed, take alternate route via 100ft road)..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            {/* Expiry selector */}
            <div className="w-full sm:w-64 space-y-1.5">
              <label className="text-sm font-medium">Active Duration</label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger>
                  <SelectValue placeholder="Expiry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 Hours</SelectItem>
                  <SelectItem value="12">12 Hours</SelectItem>
                  <SelectItem value="24">24 Hours (Default)</SelectItem>
                  <SelectItem value="48">48 Hours</SelectItem>
                  <SelectItem value="72">72 Hours</SelectItem>
                  <SelectItem value="none">No Expiry (Until manual deactivation)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* CONDITIONAL LOCATION FIELDS (Only shown when Location-Based is selected) */}
            {targetScope === 'location_based' && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
                    <MapPin className="w-4 h-4" />
                    <span>Geographic Targeting Parameters (No Address Required)</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Click anywhere on the map or drag the pin to set the center.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Latitude</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={lat}
                      onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Longitude</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={lng}
                      onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Coverage Radius (km): <strong className="text-foreground">{radiusKm} km</strong>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="30"
                      step="0.5"
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                      className="w-full accent-primary mt-2 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Leaflet Radius Preview Map */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Live Radius Preview (Red circle indicates notification delivery boundary)</span>
                    <span>Target Zone: {(Math.PI * radiusKm * radiusKm).toFixed(1)} km²</span>
                  </div>
                  <div
                    ref={mapContainerRef}
                    className="w-full h-72 rounded-lg border border-border shadow-inner overflow-hidden z-0"
                  />
                </div>
              </div>
            )}

            {/* Submit Action */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="submit" disabled={isCreating} className="gap-2 px-6">
                <Send className="w-4 h-4" />
                {isCreating ? 'Publishing & Notifying...' : 'Publish & Dispatch Alert'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing Alerts Table / List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Active & Historic Community Alerts</span>
            <span className="text-xs font-normal text-muted-foreground">
              {alerts.length} total alerts recorded
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading alerts...</div>
            ) : alerts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No alerts published yet.</div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors ${
                    !alert.is_active ? 'opacity-60 bg-muted/10' : ''
                  }`}
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-base">{alert.title}</span>
                      {getAlertBadge(alert.alert_type)}
                      {alert.target_scope === 'location_based' ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1">
                          <MapPin className="w-3 h-3" />
                          Radius {alert.radius_km ?? 0} km
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-600 border-blue-500/30 gap-1">
                          <Users className="w-3 h-3" />
                          All Users (Broadcast)
                        </Badge>
                      )}
                      {!alert.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{alert.message}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                      <span>Created: {formatDate(alert.created_at)}</span>
                      {alert.expires_at && <span>Expires: {formatDate(alert.expires_at)}</span>}
                    </div>
                  </div>

                  {alert.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAlert(alert.id)}
                      disabled={isDeleting}
                      className="text-destructive hover:bg-destructive/10 gap-1.5 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                      Deactivate
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
