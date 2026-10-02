import { Filter, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { SearchableCategorySelect } from '@/components/incidents/SearchableCategorySelect'
import { useFilterStore } from '@/store/filters'
import { Input } from '@/components/ui/input'

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'resolved_unverified', label: 'Resolved (Unverified)' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
]

interface IncidentFiltersProps {
  showStatus?: boolean
}

export function IncidentFilters({ showStatus = false }: IncidentFiltersProps) {
  const { category_id, severity, status, date_from, date_to, sort_by, setFilter, resetFilters } = useFilterStore()

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-card border rounded-2xl">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mr-1">
        <Filter className="w-4 h-4" />
        Filters
      </div>

      {/* Category */}
      <div className="min-w-[190px]">
        <SearchableCategorySelect
          id="filter-category"
          value={category_id}
          onChange={(v) => setFilter('category_id', v)}
          allowAll={true}
          allLabel="All Categories"
          clearable={true}
          placeholder="All Categories"
        />
      </div>

      {/* Severity */}
      <div className="min-w-[140px]">
        <Select
          value={severity ?? 'all'}
          onValueChange={(v) => setFilter('severity', v === 'all' ? null : v)}
        >
          <SelectTrigger id="filter-severity">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            {SEVERITY_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      {showStatus && (
        <div className="min-w-[160px]">
          <Select
            value={status ?? 'all'}
            onValueChange={(v) => setFilter('status', v === 'all' ? null : v)}
          >
            <SelectTrigger id="filter-status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Sort By */}
      <div className="min-w-[150px]">
        <Select
          value={sort_by ?? 'severity'}
          onValueChange={(v) => setFilter('sort_by', v)}
        >
          <SelectTrigger id="filter-sort-by">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="severity">Sort by Severity (Default)</SelectItem>
            <SelectItem value="date_desc">Sort by Date (Newest)</SelectItem>
            <SelectItem value="date_asc">Sort by Date (Oldest)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date from */}
      <Input
        id="filter-date-from"
        type="date"
        className="w-auto"
        value={date_from ?? ''}
        onChange={(e) => setFilter('date_from', e.target.value || null)}
      />

      {/* Date to */}
      <Input
        id="filter-date-to"
        type="date"
        className="w-auto"
        value={date_to ?? ''}
        onChange={(e) => setFilter('date_to', e.target.value || null)}
      />

      {/* Reset */}
      <Button variant="outline" size="sm" onClick={resetFilters} id="filter-reset">
        <RotateCcw className="w-3 h-3 mr-1" />
        Reset
      </Button>
    </div>
  )
}
