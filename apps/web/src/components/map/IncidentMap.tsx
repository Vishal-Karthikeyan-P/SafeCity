'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet'
import * as polyline from '@mapbox/polyline'
import type { Incident } from '@/types'
import { toTitleCase } from '@/lib/utils'

// Helper to get global L or fallback (dynamic evaluation to ensure CDN extensions are ready)
const getL = () => (typeof window !== 'undefined' ? (window as any).L : null) || L

// Fix Leaflet default marker icon in Vite dynamically
const initMarkerIcon = () => {
  const Leaflet = getL()
  if (Leaflet.Icon?.Default?.prototype) {
    delete (Leaflet.Icon.Default.prototype as any)._getIconUrl
    Leaflet.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }
}

/** Create a colored SVG icon for a severity level */
function createSeverityIcon(severity: string, categoryIcon: string = '📍') {
  const Leaflet = getL()
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
  return Leaflet.divIcon({
    html: svgIcon,
    className: '',
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -42],
  })
}

/** Create a greyed-out icon for unverified/pending incidents */
function createUnverifiedIcon(categoryIcon: string = '📍') {
  const Leaflet = getL()

  const svgIcon = `
    <div style="
      position: relative;
      width: 36px;
      height: 42px;
    ">
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: #6b7280;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          font-size: 14px;
          filter: grayscale(100%);
          opacity: 0.9;
        ">
          ${categoryIcon}
        </span>
      </div>

      <div style="
        position: absolute;
        right: -3px;
        top: -3px;
        width: 15px;
        height: 15px;
        background: #374151;
        border: 2px solid white;
        border-radius: 50%;
        color: white;
        font-size: 9px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      ">?</div>
    </div>
  `

  return Leaflet.divIcon({
    html: svgIcon,
    className: '',
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -42],
  })
}


interface IncidentMapProps {
  incidents: Incident[]
  unverifiedIncidents?: Incident[]
  center?: [number, number]
  zoom?: number
  height?: string
  onLocationSelect?: (lat: number, lng: number) => void
  selectedLocation?: { lat: number; lng: number } | null
  startLocation?: { lat: number; lng: number } | null
  destLocation?: { lat: number; lng: number } | null
  heatmapData?: { lat: number; lng: number; weight: number }[]
  routeData?: any // RouteData from our API
}

export function IncidentMap({
  incidents,
  unverifiedIncidents = [],
  center = [11.0168, 76.9558],
  zoom = 12,
  height = '500px',
  onLocationSelect,
  selectedLocation,
  startLocation,
  destLocation,
  heatmapData,
  routeData,
}: IncidentMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const clusterGroupRef = useRef<any>(null)
  const heatLayerRef = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)
  const onLocationSelectRef = useRef(onLocationSelect)

  // Always keep location select ref updated to avoid stale closures
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect
  }, [onLocationSelect])

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    initMarkerIcon()
    const Leaflet = getL()

    const map = Leaflet.map(containerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: true,
    })

    // Tile layer
    Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Custom zoom control
    Leaflet.control.zoom({ position: 'bottomright' }).addTo(map)

    // Click to select location
    map.on('click', (e: any) => {
      if (onLocationSelectRef.current) {
        onLocationSelectRef.current(e.latlng.lat, e.latlng.lng)
      }
    })

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

    const Leaflet = getL()

    // Remove old cluster group
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current)
      clusterGroupRef.current = null
    }

    // Create MarkerClusterGroup (loaded via CDN or fallback)
    const cluster = Leaflet.markerClusterGroup
      ? Leaflet.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
      })
      : Leaflet.layerGroup()

    incidents.forEach((incident) => {
      if (!incident || incident.location_lat == null || incident.location_lng == null) return

      const categoryIcon = incident.category?.icon || '📍'
      const categoryName = incident.category?.name || 'General'
      const desc = incident.description || ''

      const marker = Leaflet.marker(
        [incident.location_lat, incident.location_lng],
        { icon: createSeverityIcon(incident.severity || 'low', categoryIcon) }
      )

      const popupContent = `
        <div style="font-family:Inter,sans-serif; min-width:200px; max-width:260px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:20px;">${categoryIcon}</span>
            <div>
              <p style="font-weight:600;font-size:13px;margin:0;line-height:1.3;">${incident.title || 'Incident'}</p>
              <p style="color:#6b7280;font-size:11px;margin:2px 0 0;">${categoryName}</p>
            </div>
          </div>
          <p style="font-size:11px;color:#374151;margin:0 0 8px;line-height:1.5;">${desc.slice(0, 100)}${desc.length > 100 ? '…' : ''}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="background:#f3f4f6;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;">${toTitleCase(incident.severity || 'low')}</span>
            <span style="background:#f3f4f6;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;">${toTitleCase(incident.status || 'pending')}</span>
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

    // Render unverified incidents as greyed-out markers (not clustered, separate layer)
    const unverifiedLayer = Leaflet.layerGroup()
      ; (unverifiedIncidents || []).forEach((incident: any) => {
        if (!incident || incident.location_lat == null || incident.location_lng == null) return
        const categoryIcon = incident.category?.icon || '📍'
        const categoryName = incident.category?.name || 'General'
        const marker = Leaflet.marker(
          [incident.location_lat, incident.location_lng],
          { icon: createUnverifiedIcon(categoryIcon), zIndexOffset: -100 }
        )
        marker.bindPopup(`
        <div style="font-family:Inter,sans-serif; min-width:180px; opacity:0.85;">
          <p style="font-size:11px; color:#9ca3af; font-weight:600; margin:0 0 4px;">⚠️ Unverified Report</p>
          <p style="font-weight:600;font-size:13px;margin:0;">${categoryIcon} ${incident.title || 'Incident'}</p>
          <p style="color:#9ca3af;font-size:11px;margin:4px 0;">${categoryName}</p>
          <p style="font-size:11px;color:#6b7280;">Status: Pending verification</p>
        </div>
      `, { maxWidth: 240 })
        unverifiedLayer.addLayer(marker)
      })
    map.addLayer(unverifiedLayer)
    return () => { map.removeLayer(unverifiedLayer) }
  }, [incidents, unverifiedIncidents])

  // Start and Dest markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const Leaflet = getL()
    const markers: any[] = []

    if (startLocation) {
      const marker = Leaflet.marker([startLocation.lat, startLocation.lng], {
        icon: Leaflet.divIcon({
          html: `<div style="width:20px;height:20px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(34,197,94,0.3);animation:pulse 1.5s infinite;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">S</div>`,
          className: '',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      })
      marker.addTo(map)
      markers.push(marker)
    }

    if (destLocation) {
      const marker = Leaflet.marker([destLocation.lat, destLocation.lng], {
        icon: Leaflet.divIcon({
          html: `<div style="width:20px;height:20px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.3);animation:pulse 1.5s infinite;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">D</div>`,
          className: '',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      })
      marker.addTo(map)
      markers.push(marker)
    }

    return () => {
      markers.forEach(m => m.remove())
    }
  }, [startLocation, destLocation])

  // Selected Location marker pin
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedLocation) return

    const Leaflet = getL()

    const marker = Leaflet.marker([selectedLocation.lat, selectedLocation.lng], {
      icon: Leaflet.divIcon({
        html: `
          <div style="position:relative; width:32px; height:32px;">
            <div style="position:absolute; width:100%; height:100%; border-radius:50%; background:#ef4444; opacity:0.4; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:relative; width:32px; height:32px; border-radius:50%; background:#ef4444; border:3px solid white; box-shadow:0 4px 12px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; color:white; font-size:16px;">
              📍
            </div>
          </div>
        `,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      }),
    }).addTo(map)

    return () => {
      marker.remove()
    }
  }, [selectedLocation])

  // Heatmap Layer
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }

    const Leaflet = getL()
    const heatFactory = Leaflet.heatLayer

    if (heatmapData && heatmapData.length > 0 && typeof heatFactory === 'function') {
      const heatPoints = heatmapData.map((p) => [p.lat, p.lng, Math.max(0.5, p.weight || 1)])
      heatLayerRef.current = heatFactory(heatPoints, {
        radius: 35,
        blur: 20,
        minOpacity: 0.4,
        maxZoom: 18,
        gradient: {
          0.2: '#3b82f6', // blue
          0.4: '#22c55e', // green
          0.6: '#eab308', // yellow
          0.8: '#f97316', // orange
          1.0: '#ef4444', // red
        },
      }).addTo(map)
    }

    return () => {
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current)
        heatLayerRef.current = null
      }
    }
  }, [heatmapData])

  // Route Layer
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const Leaflet = getL()

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current)
      routeLayerRef.current = null
    }

    if (routeData && routeData.geometry) {
      const decoded = polyline.decode(routeData.geometry)

      const layerGroup = Leaflet.layerGroup()

      const routeLine = Leaflet.polyline(decoded, { color: routeData.route_risk_level === 'safe' ? '#22c55e' : routeData.route_risk_level === 'moderate' ? '#f59e0b' : '#ef4444', weight: 6, opacity: 0.8 })
      layerGroup.addLayer(routeLine)

      routeLayerRef.current = layerGroup
      map.addLayer(layerGroup)
      map.fitBounds(routeLine.getBounds(), { padding: [50, 50] })
    }

    return () => {
      if (routeLayerRef.current && map) {
        map.removeLayer(routeLayerRef.current)
        routeLayerRef.current = null
      }
    }
  }, [routeData])

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full rounded-2xl overflow-hidden shadow-xl z-0 relative bg-muted"
    />
  )
}
