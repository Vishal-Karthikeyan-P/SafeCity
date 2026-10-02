import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X, Check } from 'lucide-react'
import { useCategories } from '@/api/incidents'
import type { IncidentCategory } from '@/types'
import { cn } from '@/lib/utils'

export interface SearchableCategorySelectProps {
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  allowAll?: boolean
  allLabel?: string
  clearable?: boolean
  error?: string
  className?: string
  id?: string
  disabled?: boolean
}

export function SearchableCategorySelect({
  value,
  onChange,
  placeholder = 'Select a category',
  allowAll = false,
  allLabel = 'All Categories',
  clearable = true,
  error,
  className,
  id,
  disabled = false,
}: SearchableCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { data: categories = [], isLoading } = useCategories()

  // Selected category object
  const selectedCategory = (categories as IncidentCategory[]).find(
    (c) => c.id === value
  )

  // Filtered categories based on search input
  const filteredCategories = (categories as IncidentCategory[]).filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  )

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  const handleSelect = (catId: string | null) => {
    onChange(catId)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 text-left',
          error && 'border-destructive focus:ring-destructive',
          isOpen && 'ring-2 ring-ring'
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedCategory ? (
            <>
              <span className="text-base leading-none">{selectedCategory.icon || '📍'}</span>
              <span className="font-medium text-foreground">{selectedCategory.name}</span>
            </>
          ) : allowAll && (value === null || value === undefined || value === 'all' || value === '') ? (
            <span className="text-foreground">{allLabel}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>

        <span className="flex items-center gap-1 ml-2 shrink-0">
          {clearable && selectedCategory && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[220px] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 overflow-hidden">
          {/* Search Input Box */}
          <div className="p-2 border-b border-border bg-muted/40 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              className="w-full bg-transparent text-sm placeholder:text-muted-foreground outline-none py-1 text-foreground"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false)
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Loading categories...
              </div>
            ) : (
              <>
                {allowAll && !searchQuery && (
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-left',
                      (!value || value === 'all') && 'bg-accent/80 font-semibold text-primary'
                    )}
                  >
                    <span>{allLabel}</span>
                    {(!value || value === 'all') && <Check className="w-4 h-4 text-primary" />}
                  </button>
                )}

                {filteredCategories.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No matching categories
                  </div>
                ) : (
                  filteredCategories.map((cat) => {
                    const isSelected = value === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelect(cat.id)}
                        className={cn(
                          'flex w-full items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-left group',
                          isSelected && 'bg-primary/10 font-semibold text-primary'
                        )}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-base shrink-0">{cat.icon || '📍'}</span>
                          <span className="truncate">{cat.name}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                      </button>
                    )
                  })
                )}
              </>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}
