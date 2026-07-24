import { useState } from 'react'
import { Search, Grid, List, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IncidentCard } from '@/components/incidents/IncidentCard'
import { IncidentFilters } from '@/components/incidents/IncidentFilters'
import { useIncidents } from '@/api/incidents'
import { useFilterStore } from '@/store/filters'
import { cn } from '@/lib/utils'

export function IncidentsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const { category_id, severity, status, date_from, date_to, search, setFilter } = useFilterStore()

  const { data, isLoading } = useIncidents({
    category_id: category_id ?? undefined,
    severity: (severity as any) ?? undefined,
    status: (status as any) ?? undefined,
    date_from: date_from ?? undefined,
    date_to: date_to ?? undefined,
    search: search || undefined,
    page,
    limit: 12,
  })

  const incidents = data?.items ?? []
  const totalPages = data?.pages ?? 1
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incidents</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {total} total incident{total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'bg-accent' : ''}
            id="view-grid-btn"
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-accent' : ''}
            id="view-list-btn"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button asChild id="new-incident-btn">
            <Link to="/incidents/new">
              <Plus className="w-4 h-4 mr-1" />
              Report
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <IncidentFilters showStatus />

      {/* Results */}
      {isLoading ? (
        <div className={cn(
          'grid gap-4',
          viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
        )}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-64 w-full" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No incidents found</h3>
          <p className="text-muted-foreground mb-6">
            Try adjusting your filters or be the first to report one.
          </p>
          <Button asChild>
            <Link to="/incidents/new">Report an Incident</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className={cn(
            'grid gap-4',
            viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
          )}>
            {incidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                compact={viewMode === 'list'}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                id="prev-page-btn"
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                id="next-page-btn"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
