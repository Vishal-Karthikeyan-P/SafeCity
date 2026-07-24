'use client'
import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet'
import { useNavigate } from 'react-router-dom'
import type { Incident } from '@/types'
import { getImageUrl, toTitleCase } from '@/lib/utils'

// Fix Leaflet default marker icon in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

/** Create a colored SVG icon for a severity level */
function createSeverityIcon(severity: string, categoryIcon: string = '📍') {
  const colorMap: Record<string, string> = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
  }
  const color = colorMap[severity] || '#6b7280'
  const svgIcon = `
    <div style="
      width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg); background: ${color};
      border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
    ">
      <span style="transform: rotate(45deg); font-size: 14px;">${categoryIcon}</span>
    </div>
  `
  return L.divIcon({
    html: svgIcon,
    className: '',
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -42],
  })
}

interface IncidentMapProps {
  incidents: Incident[]
  center?: [number, number]
  zoom?: number
  height?: string
  onLocationSelect?: (lat: number, lng: number) => void
  selectedLocation?: { lat: number; lng: number } | null
}

export function IncidentMap({
  incidents,
  center = [40.7128, -74.006],
  zoom = 12,
  height = '500px',
  onLocationSelect,
  selectedLocation,
}: IncidentMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const clusterGroupRef = useRef<any>(null)
  const navigate = useNavigate()

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: true,
    })

    // Tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Custom zoom control
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // Click to select location
    if (onLocationSelect) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onLocationSelect(e.latlng.lat, e.latlng.lng)
      })
    }

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update markers when incidents change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove old cluster group
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current)
    }

    // Create MarkerClusterGroup (loaded via CDN)
    const L_any = L as any
    const cluster = L_any.markerClusterGroup
      ? L_any.markerClusterGroup({
          maxClusterRadius: 60,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
        })
      : L.layerGroup()

    incidents.forEach((incident) => {
      const marker = L.marker(
        [incident.location_lat, incident.location_lng],
        { icon: createSeverityIcon(incident.severity, incident.category.icon) }
      )

      const popupContent = `
        <div style="font-family:Inter,sans-serif; min-width:200px; max-width:260px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:20px;">${incident.category.icon}</span>
            <div>
              <p style="font-weight:600;font-size:13px;margin:0;line-height:1.3;">${incident.title}</p>
              <p style="color:#6b7280;font-size:11px;margin:2px 0 0;">${incident.category.name}</p>
            </div>
          </div>
          <p style="font-size:11px;color:#374151;margin:0 0 8px;line-height:1.5;">${incident.description.slice(0, 100)}${incident.description.length > 100 ? '…' : ''}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="background:#f3f4f6;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;">${toTitleCase(incident.severity)}</span>
            <span style="background:#f3f4f6;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;">${toTitleCase(incident.status)}</span>
          </div>
          <a href="/incidents/${incident.id}" style="display:block;text-align:center;background:#1d7eeb;color:white;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;margin-top:4px;">
            View Details →
          </a>
        </div>
      `

      marker.bindPopup(popupContent, { maxWidth: 280 })
      cluster.addLayer(marker)
    })

    map.addLayer(cluster)
    clusterGroupRef.current = cluster
  }, [incidents])

  // Selected location marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedLocation) return

    const marker = L.marker([selectedLocation.lat, selectedLocation.lng], {
      icon: L.divIcon({
        html: `<div style="width:16px;height:16px;background:#1d7eeb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(29,126,235,0.3);animation:pulse 1.5s infinite;"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    })
    marker.addTo(map)

    return () => {
      marker.remove()
    }
  }, [selectedLocation])

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full rounded-2xl overflow-hidden shadow-xl z-0 relative bg-muted"
    />
  )
}
