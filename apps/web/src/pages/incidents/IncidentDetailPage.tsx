import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, User, AlertTriangle, Share2, Flag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IncidentMap } from '@/components/map/IncidentMap'
import { useIncident } from '@/api/incidents'
import { formatDate, timeAgo, toTitleCase, getImageUrl } from '@/lib/utils'
import type { SeverityLevel, IncidentStatus } from '@/types'

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: incident, isLoading, isError } = useIncident(id!)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-80 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
      </div>
    )
  }

  if (isError || !incident) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Incident not found</h2>
        <Button onClick={() => navigate('/incidents')}>Back to Incidents</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back nav */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden border bg-card">
        {/* Images */}
        {incident.images.length > 0 && (
          <div className={`grid gap-1 ${incident.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {incident.images.slice(0, 4).map((img, idx) => (
              <div key={img.id} className="relative aspect-video overflow-hidden bg-muted">
                <img
                  src={getImageUrl(img.url)}
                  alt={`Evidence ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {idx === 3 && incident.images.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">+{incident.images.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="p-6">
          {/* Category + badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-2xl">{incident.category.icon}</span>
            <span className="text-sm text-muted-foreground">{incident.category.name}</span>
            <Badge variant={incident.severity as any} className="ml-2">
              {toTitleCase(incident.severity)}
            </Badge>
            <Badge variant={incident.status as any}>
              {toTitleCase(incident.status)}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold mb-3">{incident.title}</h1>
          <p className="text-muted-foreground leading-relaxed">{incident.description}</p>

          {/* Admin note */}
          {incident.admin_note && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Admin Note</p>
              <p className="text-sm text-blue-600 dark:text-blue-400">{incident.admin_note}</p>
            </div>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
            {incident.location_address && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="text-sm font-medium">{incident.location_address}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Reported</p>
                <p className="text-sm font-medium">{formatDate(incident.created_at)}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(incident.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Reporter</p>
                <p className="text-sm font-medium">
                  {incident.is_anonymous ? 'Anonymous' : incident.reporter?.full_name ?? 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.share?.({ title: incident.title, url: window.location.href })}
            >
              <Share2 className="w-4 h-4 mr-1" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden rounded-b-2xl">
          <IncidentMap
            incidents={[incident]}
            center={[incident.location_lat, incident.location_lng]}
            zoom={15}
            height="300px"
          />
        </CardContent>
      </Card>
    </div>
  )
}
