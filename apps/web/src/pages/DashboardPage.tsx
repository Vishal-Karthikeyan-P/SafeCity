import { Link } from 'react-router-dom'
import {
  AlertTriangle, Plus, TrendingUp, Clock, CheckCircle, XCircle,
  Bell, MapPin, Eye, FileText, ShieldCheck, RefreshCw, AlertCircle, CalendarDays
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { IncidentCard } from '@/components/incidents/IncidentCard'
import { useMyIncidents, useMyIncidentStats } from '@/api/incidents'
import { useNotifications, useMarkAllRead } from '@/api/user'
import { useAuthStore } from '@/store/auth'
import { timeAgo, toTitleCase } from '@/lib/utils'

// Status display config — covers every IncidentStatus value
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:              { label: 'Pending Review',      color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',   icon: Clock },
  under_review:         { label: 'Under Review',        color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',         icon: Eye },
  approved:             { label: 'Approved',            color: 'text-green-600 bg-green-50 dark:bg-green-900/20',      icon: CheckCircle },
  rejected:             { label: 'Rejected',            color: 'text-red-600 bg-red-50 dark:bg-red-900/20',            icon: XCircle },
  resolved_unverified:  { label: 'Resolved (Unverified)', color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20',      icon: RefreshCw },
  resolved:             { label: 'Resolved',            color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', icon: ShieldCheck },
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-20 ${color}`} />
        <div className={`inline-flex p-3 rounded-xl mb-3 ${color} bg-opacity-15`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data: myIncidentsData, isLoading: loadingIncidents } = useMyIncidents(1, 5)
  const { data: stats, isLoading: statsLoading } = useMyIncidentStats()
  const { data: notifData, isLoading: loadingNotifs } = useNotifications()
  const { mutate: markAllRead } = useMarkAllRead()

  const incidents = myIncidentsData?.items ?? []
  const rawNotifs = notifData?.items ?? notifData?.notifications ?? []
  const notifications = Array.from(
    new Map(rawNotifs.map((n: any) => [n.id || `${n.title}-${n.created_at}`, n])).values()
  ).slice(0, 3)
  const unread = notifData?.unread_count ?? 0

  // Accurate counts from the dedicated stats endpoint (GROUP BY, not paginated slice)
  const total = stats?.total ?? 0
  const thisMonth = stats?.this_month ?? 0
  const byStatus = stats?.by_status ?? {}

  // Only show statuses that have at least 1 incident OR always show known statuses (ordered)
  const STATUS_ORDER = ['pending', 'under_review', 'approved', 'rejected', 'resolved_unverified', 'resolved']
  const statusRows = STATUS_ORDER
    .map((key) => ({ key, count: byStatus[key] ?? 0, ...STATUS_CONFIG[key] }))
    .filter((r) => r.count > 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Good day, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening in your area
          </p>
        </div>
        <Button asChild id="report-incident-btn">
          <Link to="/incidents/new">
            <Plus className="w-4 h-4 mr-2" />
            Report Incident
          </Link>
        </Button>
      </div>

      {/* Stats row: Total + Status Breakdown + This Month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Reports */}
        <StatCard
          icon={FileText}
          label="Total Reports"
          value={statsLoading ? '—' : total}
          color="bg-blue-500"
        />

        {/* Status Breakdown — replaces old Pending + Approved */}
        <Card className="sm:col-span-1 relative overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-1.5">
            {statsLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-5 bg-muted rounded w-full" />
                ))}
              </div>
            ) : statusRows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No incidents yet.</p>
            ) : (
              statusRows.map(({ key, label, count, color, icon: Icon }) => (
                <div
                  key={key}
                  className={`flex items-center justify-between px-2.5 py-1 rounded-lg text-xs font-medium ${color}`}
                >
                  <span className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </span>
                  <span className="font-bold">{count}</span>
                </div>
              ))
            )}
            {/* Sanity check: ensure breakdown sums to total */}
            {!statsLoading && total > 0 && (
              <div className="flex items-center justify-between px-2.5 pt-1 border-t border-border/50 text-xs text-muted-foreground font-semibold mt-1">
                <span>Total</span>
                <span>{total}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* This Month */}
        <StatCard
          icon={CalendarDays}
          label="Reported This Month"
          value={statsLoading ? '—' : thisMonth}
          color="bg-purple-500"
        />
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent reports */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">My Recent Reports</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/incidents/my">View all</Link>
            </Button>
          </div>

          {loadingIncidents ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-24 w-full" />
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No reports yet.</p>
                <Button asChild className="mt-4" size="sm">
                  <Link to="/incidents/new">File your first report</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <IncidentCard key={incident.id} incident={incident} compact />
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
              {unread > 0 && (
                <Badge variant="destructive" className="text-xs">{unread}</Badge>
              )}
            </h2>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAllRead()}>
                Mark all read
              </Button>
            )}
          </div>

          {loadingNotifs ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-16 w-full" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border text-sm transition-all ${
                    !n.is_read
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-card border-border'
                  }`}
                >
                  <p className="font-medium text-xs">{n.title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-muted-foreground text-xs mt-1">{timeAgo(n.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { href: '/map', icon: MapPin, label: 'View Map', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
            { href: '/incidents/new', icon: Plus, label: 'Report Incident', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
            { href: '/alerts', icon: AlertTriangle, label: 'View Alerts', color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' },
            { href: '/learning', icon: Eye, label: 'Learning Hub', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
          ].map(({ href, icon: Icon, label, color }) => (
            <Link key={href} to={href}>
              <Card className="hover:shadow-lg transition-all cursor-pointer group">
                <CardContent className="p-6 text-center">
                  <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium">{label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
