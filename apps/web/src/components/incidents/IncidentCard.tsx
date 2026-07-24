import { Link } from 'react-router-dom'
import { MapPin, Clock, AlertTriangle, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, timeAgo, truncate, toTitleCase, getImageUrl } from '@/lib/utils'
import type { Incident, SeverityLevel, IncidentStatus } from '@/types'

interface IncidentCardProps {
  incident: Incident
  compact?: boolean
}

const severityVariant: Record<SeverityLevel, 'low' | 'medium' | 'high' | 'critical'> = {
  low: 'low', medium: 'medium', high: 'high', critical: 'critical',
}

const statusVariant: Record<IncidentStatus, any> = {
  pending: 'pending', under_review: 'under_review', approved: 'approved',
  rejected: 'rejected', resolved: 'resolved',
}

export function IncidentCard({ incident, compact = false }: IncidentCardProps) {
  const hasImage = incident.images.length > 0

  return (
    <Card className={cn('overflow-hidden group', compact && 'hover:shadow-lg transition-all duration-300')}>
      {/* Image */}
      {hasImage && !compact && (
        <div className="h-44 overflow-hidden bg-muted relative">
          <img
            src={getImageUrl(incident.images[0].url)}
            alt={incident.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-3 left-3 flex gap-2">
            <Badge variant={severityVariant[incident.severity]}>
              {toTitleCase(incident.severity)}
            </Badge>
          </div>
        </div>
      )}

      <CardContent className={cn('p-4', !compact && 'pt-4')}>
        {/* Category + severity (compact) */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-lg" title={incident.category.name}>{incident.category.icon}</span>
          <span className="text-xs font-medium text-muted-foreground">{incident.category.name}</span>
          {compact && (
            <Badge variant={severityVariant[incident.severity]} className="ml-auto">
              {toTitleCase(incident.severity)}
            </Badge>
          )}
          <Badge variant={statusVariant[incident.status]} className={compact ? '' : 'ml-auto'}>
            {toTitleCase(incident.status)}
          </Badge>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2 group-hover:text-primary transition-colors">
          {incident.title}
        </h3>

        {/* Description */}
        {!compact && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {incident.description}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
          {incident.location_address && (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{truncate(incident.location_address, 30)}</span>
            </span>
          )}
          <span className="flex items-center gap-1 shrink-0 ml-auto">
            <Clock className="w-3 h-3" />
            {timeAgo(incident.created_at)}
          </span>
        </div>

        {/* CTA */}
        <div className="mt-3">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to={`/incidents/${incident.id}`}>
              <Eye className="w-3 h-3 mr-1" />
              View Details
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
