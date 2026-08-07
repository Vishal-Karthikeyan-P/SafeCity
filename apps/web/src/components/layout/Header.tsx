import { Sun, Moon, LogOut, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogout } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { useFilterStore } from '@/store/filters'
import { useNavigate, Link } from 'react-router-dom'
import { useGlobalSearch } from '@/api/search'
import { useDebounce } from '@/hooks/useDebounce'

export function Header() {
  const logout = useLogout()
  const user = useAuthStore((s) => s.user)
  const setFilter = useFilterStore((s) => s.setFilter)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [searchVal, setSearchVal] = useState('')
  const debouncedSearch = useDebounce(searchVal, 300)
  const { data: searchResults, isLoading: isSearching } = useGlobalSearch(debouncedSearch)
  const [showResults, setShowResults] = useState(false)
  
  const navigate = useNavigate()

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark')
    setDark((d) => !d)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilter('search', searchVal || null)
    navigate('/incidents')
  }

  return (
    <header className="h-16 border-b bg-card/80 backdrop-blur-sm px-6 flex items-center gap-4 shrink-0 sticky top-0 z-10">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md relative z-50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="header-search"
            placeholder="Search globally (incidents, articles)..."
            className="pl-9 h-9"
            value={searchVal}
            onChange={(e) => {
              setSearchVal(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            autoComplete="off"
          />
        </div>
        
        {showResults && searchVal.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg overflow-hidden max-h-96 overflow-y-auto">
            {isSearching ? (
              <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
            ) : searchResults?.results?.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">No results found.</div>
            ) : (
              <div className="flex flex-col">
                {searchResults?.results?.map((result: any) => (
                  <Link 
                    key={result.id} 
                    to={result.url}
                    className="p-3 border-b last:border-0 hover:bg-accent flex flex-col gap-1 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-sm line-clamp-1">{result.title}</span>
                      <span className="text-[10px] uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">{result.type}</span>
                    </div>
                    <span className="text-xs text-gray-500 line-clamp-1">{result.description}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      <div className="flex items-center gap-2 ml-auto">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          id="dark-mode-toggle"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          aria-label="Logout"
          id="logout-btn"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
