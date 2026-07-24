import { Filter, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useCategories } from '@/api/incidents'
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
  { value: 'rejected', label: 'Rejected' },
  { value: 'resolved', label: 'Resolved' },
]

interface IncidentFiltersProps {
  showStatus?: boolean
}

export function IncidentFilters({ showStatus = false }: IncidentFiltersProps) {
  const { data: categories = [] } = useCategories()
  const { category_id, severity, status, date_from, date_to, setFilter, resetFilters } = useFilterStore()

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-card border rounded-2xl">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mr-1">
        <Filter className="w-4 h-4" />
        Filters
      </div>

      {/* Category */}
      <div className="min-w-[160px]">
        <Select
          value={category_id ?? 'all'}
          onValueChange={(v) => setFilter('category_id', v === 'all' ? null : v)}
        >
          <SelectTrigger id="filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
