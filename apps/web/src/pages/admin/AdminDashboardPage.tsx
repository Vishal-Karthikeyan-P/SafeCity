import { useAdminStats } from '@/api/user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Users, CheckCircle, Clock, XCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { toTitleCase } from '@/lib/utils'

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

const COLORS = ['#1d7eeb', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280']

export function AdminDashboardPage() {
  const { data: stats, isLoading } = useAdminStats()

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 w-full" />)}
      </div>
    )
  }

  // Format data for charts
  const categoryData = Object.entries(stats.by_category).map(([name, value]) => ({ name, value }))
  const severityData = Object.entries(stats.by_severity).map(([name, value]) => ({
    name: toTitleCase(name), value
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform overview and statistics.</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Incidents" value={stats.total_incidents} icon={AlertTriangle} color="bg-blue-500" />
        <StatCard title="Pending Review" value={stats.pending} icon={Clock} color="bg-yellow-500" />
        <StatCard title="Total Users" value={stats.total_users} icon={Users} color="bg-purple-500" />
        <StatCard title="Resolved" value={stats.resolved} icon={CheckCircle} color="bg-green-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Incidents by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                <Bar dataKey="value" fill="#1d7eeb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-80 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Status summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resolution Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x">
            {[
              { label: 'Pending', val: stats.pending, color: 'text-gray-500' },
              { label: 'Under Review', val: stats.under_review, color: 'text-blue-500' },
              { label: 'Approved', val: stats.approved, color: 'text-green-500' },
              { label: 'Rejected', val: stats.rejected, color: 'text-red-500' },
              { label: 'Resolved', val: stats.resolved, color: 'text-teal-500' },
            ].map((s) => (
              <div key={s.label} className="flex-1 p-4 text-center">
                <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-sm text-muted-foreground font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
