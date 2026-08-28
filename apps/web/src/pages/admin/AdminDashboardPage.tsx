import { useState } from 'react'
import { useAdminStats } from '@/api/user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { AlertTriangle, Users, CheckCircle, Clock, XCircle, CheckSquare, Eye, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { formatDate, toTitleCase } from '@/lib/utils'

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color} bg-opacity-20`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </CardContent>
    </Card>
  )
}

const SEVERITY_COLORS: Record<string, string> = {
  Low: '#0b00acff',
  Medium: '#008300ff',
  High: '#dad601ff',
  Critical: '#ff0000ff',
  Unknown: '#6b7280',
}

export function AdminDashboardPage() {
  const { data: stats, isLoading } = useAdminStats()
  const [categorySort, setCategorySort] = useState<'severity' | 'count_asc' | 'name_asc' | 'name_desc' | 'date_desc' | 'date_asc'>('severity')

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-32 w-full" />)}
      </div>
    )
  }

  // Format and sort data for category chart (Top 10)
  const rawCategoryData = Object.entries(stats.by_category || {}).map(([name, value]) => ({
    name: toTitleCase(name.replace(/_/g, ' ')),
    value: Number(value) || 0,
  }))

  const categoryData = [...rawCategoryData]
    .sort((a, b) => {
      if (categorySort === 'severity' || categorySort === 'date_desc') return b.value - a.value
      if (categorySort === 'count_asc' || categorySort === 'date_asc') return a.value - b.value
      if (categorySort === 'name_asc') return a.name.localeCompare(b.name)
      if (categorySort === 'name_desc') return b.name.localeCompare(a.name)
      return b.value - a.value
    })
    .slice(0, 10)
  
  // Exact severity order MUST be: Low -> Medium -> High -> Critical
  const severityOrder = ['Low', 'Medium', 'High', 'Critical']
  const rawSeverityMap: Record<string, number> = {}
  Object.entries(stats.by_severity || {}).forEach(([k, v]) => {
    rawSeverityMap[toTitleCase(k)] = Number(v) || 0
  })
  const severityData = severityOrder.map((name) => ({
    name,
    value: rawSeverityMap[name] || 0,
  }))

  // Incident trend data (Last 7 Days)
  const trendData = (stats.daily_trend || []).map((t: any) => ({
    date: t.date ? t.date.slice(5) : '',
    count: t.count || 0,
  }))

  const recentIncidents = stats.recent_incidents || []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Real-time platform overview and system analytics.</p>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Users" value={stats.total_users ?? 0} icon={Users} color="bg-purple-500" />
        <StatCard title="Total Incidents" value={stats.total_incidents ?? 0} icon={AlertTriangle} color="bg-blue-500" />
        <StatCard title="Pending" value={stats.pending ?? 0} icon={Clock} color="bg-amber-500" />
        <StatCard title="Approved" value={stats.approved ?? 0} icon={CheckCircle} color="bg-green-500" />
        <StatCard title="Rejected" value={stats.rejected ?? 0} icon={XCircle} color="bg-red-500" />
        <StatCard title="Resolved" value={stats.resolved ?? 0} icon={CheckSquare} color="bg-teal-500" />
      </div>

      {/* Trends & Severity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incident Trends Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Incident Trends (Last 7 Days)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Daily volume of reported incidents</p>
            </div>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} contentStyle={{ borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Incidents" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Severity Distribution Chart (Low -> Medium -> High -> Critical) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Severity Distribution</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Order: Low → Medium → High → Critical</p>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {severityData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={SEVERITY_COLORS[entry.name] || SEVERITY_COLORS.Unknown}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Distribution & Recent Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incidents by Category */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Category Distribution</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Top 10 Incident Categories</p>
            </div>
            <Select value={categorySort} onValueChange={(v: any) => setCategorySort(v)}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">By Severity (Default)</SelectItem>
                <SelectItem value="date_desc">Date — Highest Count</SelectItem>
                <SelectItem value="date_asc">Date — Lowest Count</SelectItem>
                <SelectItem value="name_asc">Name (A–Z)</SelectItem>
                <SelectItem value="name_desc">Name (Z–A)</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={110} fontSize={11} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                <Bar dataKey="value" fill="#1d7eeb" radius={[0, 4, 4, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Incidents Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Recent Incidents</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Latest 5 reported incidents</p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <Link to="/admin/incidents">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-sm">
              {recentIncidents.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">No recent incidents found.</p>
              ) : (
                recentIncidents.map((inc: any) => (
                  <div key={inc.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="text-2xl shrink-0">{inc.category_icon}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{inc.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{inc.category_name}</span>
                          <span className="text-xs text-muted-foreground">• {formatDate(inc.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={inc.severity as any} className="text-[10px] px-1.5 py-0">
                        {toTitleCase(inc.severity)}
                      </Badge>
                      <Badge variant={inc.status as any} className="text-[10px] px-1.5 py-0">
                        {toTitleCase(inc.status)}
                      </Badge>
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                        <Link to={`/incidents/${inc.id}`} target="_blank">
                          <Eye className="w-3.5 h-3.5 text-blue-500" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resolution Funnel summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Incident Resolution Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x">
            {[
              { label: 'Pending', val: stats.pending, color: 'text-amber-500' },
              { label: 'Under Review', val: stats.under_review, color: 'text-blue-500' },
              { label: 'Approved', val: stats.approved, color: 'text-green-500' },
              { label: 'Rejected', val: stats.rejected, color: 'text-red-500' },
              { label: 'Resolved', val: stats.resolved, color: 'text-teal-500' },
            ].map((s) => (
              <div key={s.label} className="flex-1 p-4 text-center">
                <p className={`text-3xl font-bold ${s.color}`}>{s.val ?? 0}</p>
                <p className="text-sm text-muted-foreground font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
