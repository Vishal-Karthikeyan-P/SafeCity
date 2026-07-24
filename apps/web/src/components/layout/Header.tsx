import { Sun, Moon, LogOut, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogout } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { useFilterStore } from '@/store/filters'
import { useNavigate } from 'react-router-dom'

export function Header() {
  const logout = useLogout()
  const user = useAuthStore((s) => s.user)
  const setFilter = useFilterStore((s) => s.setFilter)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [searchVal, setSearchVal] = useState('')
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
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="header-search"
            placeholder="Search incidents..."
            className="pl-9 h-9"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
          />
        </div>
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
