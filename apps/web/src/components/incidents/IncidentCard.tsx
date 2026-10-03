import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Clock, Eye } from 'lucide-react'
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
  rejected: 'rejected', resolved_unverified: 'resolved_unverified', resolved: 'resolved',
}

// Tinted placeholder per severity (used when there is no image or it fails to load)
const placeholderTint: Record<SeverityLevel, string> = {
  low: 'from-green-500/15 to-green-500/5',
  medium: 'from-amber-500/15 to-amber-500/5',
  high: 'from-orange-500/15 to-orange-500/5',
  critical: 'from-red-500/15 to-red-500/5',
}

export function IncidentCard({ incident, compact = false }: IncidentCardProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const firstImage = incident.images?.[0]?.url
  const showImage = !!firstImage && !imgFailed

  return (
    <Card className={cn('overflow-hidden group h-full flex flex-col', compact && 'hover:shadow-lg transition-all duration-300')}>
      {/* Media: always rendered in grid mode so every card has the same height */}
      {!compact && (
        <div className="h-44 shrink-0 overflow-hidden bg-muted relative">
          {showImage ? (
            <>
              <img
                src={getImageUrl(firstImage!)}
                alt={incident.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => setImgFailed(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </>
          ) : (
            <div className={cn(
              'w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br',
              placeholderTint[incident.severity] ?? 'from-muted to-muted/50'
            )}>
              <span className="text-5xl">{incident.category?.icon || '📋'}</span>
              <span className="text-[10px] font-medium text-muted-foreground">No image available</span>
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex gap-2">
            <Badge variant={severityVariant[incident.severity]}>
              {toTitleCase(incident.severity)}
            </Badge>
          </div>
        </div>
      )}

      <CardContent className={cn('p-4 flex flex-col flex-1', !compact && 'pt-4')}>
        {/* Category + severity (compact) */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-lg" title={incident.category?.name}>{incident.category?.icon}</span>
          <span className="text-xs font-medium text-muted-foreground">{incident.category?.name}</span>
          {compact && (
            <Badge variant={severityVariant[incident.severity]} className="ml-auto">
              {toTitleCase(incident.severity)}
            </Badge>
          )}
          <Badge variant={statusVariant[incident.status]} className={compact ? '' : 'ml-auto'}>
            {incident.status === 'resolved_unverified'
              ? 'Resolved (Unverified)'
              : toTitleCase(incident.status)}
          </Badge>
        </div>

        {/* Title: reserve 2 lines so 1-line and 2-line titles align */}
        <h3 className={cn(
          'font-semibold text-sm leading-snug mb-1 line-clamp-2 group-hover:text-primary transition-colors',
          !compact && 'min-h-[2.5rem]'
        )}>
          {incident.title}
        </h3>

        {/* Description: reserve 2 lines */}
        {!compact && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-[2rem]">
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

        {/* CTA: mt-auto pins the button to the card bottom */}
        <div className="mt-auto pt-3">
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