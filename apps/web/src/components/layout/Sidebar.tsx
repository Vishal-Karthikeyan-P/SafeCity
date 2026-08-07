import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Map, AlertTriangle, Plus, User, Bell, Shield, Settings, BookOpen, BellRing, FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useNotifications } from '@/api/user'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/map', label: 'Live Map', icon: Map },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/incidents/my', label: 'My Reports', icon: FileText },
  { href: '/incidents/new', label: 'Report', icon: Plus },
  { href: '/learning', label: 'Learning Hub', icon: BookOpen },
  { href: '/alerts', label: 'Alerts', icon: BellRing },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: User },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const { data: notifData } = useNotifications()
  const unread = notifData?.unread_count ?? 0

  return (
    <aside className="w-64 bg-card border-r flex flex-col h-full shrink-0">
      {/* Brand */}
      <div className="p-6 border-b">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-safe-500 flex items-center justify-center shadow-lg shadow-primary/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold gradient-text">SafeCity</span>
            <p className="text-xs text-muted-foreground -mt-0.5">Safety Platform</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href) && href !== '/incidents')
          const isNotif = href === '/notifications'
          return (
            <Link
              key={href}
              to={href}
              className={cn('nav-item', isActive && 'nav-item-active')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
              {href === '/incidents/new' && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  +
                </span>
              )}
              {isNotif && unread > 0 && (
                <span className="ml-auto bg-danger text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )
        })}

        {/* Admin */}
        {user?.role === 'admin' && (
          <>
            <div className="pt-4 pb-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Admin
            </div>
            <Link
              to="/admin"
              className={cn('nav-item', pathname.startsWith('/admin') && 'nav-item-active')}
            >
              <Settings className="w-4 h-4" />
              <span>Admin Panel</span>
            </Link>
          </>
        )}
      </nav>

      {/* User footer */}
      {user && (
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-safe-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
