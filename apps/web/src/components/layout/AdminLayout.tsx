import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { BarChart3, Users, AlertTriangle, Tag, Shield, ChevronRight, LogOut, BookOpen, BellRing, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLogout } from '@/api/auth'
import { Button } from '@/components/ui/button'

const adminNav = [
  { href: '/admin', label: 'Overview', icon: BarChart3, exact: true },
  { href: '/admin/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/admin/alerts', label: 'Community Alerts', icon: BellRing },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/categories', label: 'Categories', icon: Tag },
  { href: '/admin/learning', label: 'Learning Hub', icon: BookOpen },
]

export function AdminLayout() {
  const { pathname } = useLocation()
  const logout = useLogout()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Admin Sidebar */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <aside className="w-64 bg-gray-950 flex flex-col h-full shrink-0 overflow-y-auto">
          <div className="p-5 border-b border-gray-800 flex items-center justify-between gap-2">
            <Link to="/admin" className="flex items-center gap-3" onClick={closeSidebar}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-lg font-bold text-white">SafeCity</span>
                <p className="text-xs text-gray-400 -mt-0.5">Admin Panel</p>
              </div>
            </Link>
            <button
              onClick={closeSidebar}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors shrink-0"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {adminNav.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact ? pathname === href : pathname.startsWith(href) && !(exact && pathname !== href)
              return (
                <Link
                  key={href}
                  to={href}
                  onClick={closeSidebar}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    'text-gray-400 hover:text-white hover:bg-gray-800',
                    isActive && 'text-white bg-gray-800',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t border-gray-800 space-y-2">
            <Link
              to="/dashboard"
              onClick={closeSidebar}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
            >
              Exit Admin
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-400 hover:text-white hover:bg-gray-800"
              onClick={logout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </aside>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Admin top bar for mobile */}
        <div className="lg:hidden h-14 border-b border-gray-800 bg-gray-950 px-4 flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label="Open admin menu"
            className="text-gray-400 hover:text-white"
            id="admin-menu-toggle"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-white font-semibold text-sm">Admin Panel</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <main className="p-4 sm:p-8">
            <div className="max-w-7xl mx-auto animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
