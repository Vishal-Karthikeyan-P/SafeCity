import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { AlertTriangle, Info, Bell, ShieldAlert } from 'lucide-react'
import { useActiveAlerts } from '@/api/alerts'

export function AlertsPage() {
  const { data, isLoading } = useActiveAlerts()

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'nearby_incident':
        return <AlertTriangle className="w-6 h-6 text-orange-500" />
      case 'high_risk_area':
        return <ShieldAlert className="w-6 h-6 text-red-500" />
      case 'emergency_notice':
        return <Bell className="w-6 h-6 text-red-600 animate-pulse" />
      default:
        return <Info className="w-6 h-6 text-blue-500" />
    }
  }

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'nearby_incident': return 'border-orange-200 bg-orange-50 dark:bg-orange-950/20'
      case 'high_risk_area': return 'border-red-200 bg-red-50 dark:bg-red-950/20'
      case 'emergency_notice': return 'border-red-500 bg-red-50 dark:bg-red-950/20'
      default: return 'border-blue-200 bg-blue-50 dark:bg-blue-950/20'
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Community Alerts</h1>
        <p className="text-gray-500 dark:text-gray-400">Important notices, nearby incidents, and high-risk area warnings.</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <p>Loading alerts...</p>
        ) : data?.items?.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No active alerts at the moment.</p>
            <p className="text-sm mt-1">You're in a safe zone.</p>
          </div>
        ) : (
          data?.items?.map((alert: any) => (
            <Card key={alert.id} className={`border-l-4 ${getAlertColor(alert.alert_type)}`}>
              <CardContent className="p-4 sm:p-6 flex gap-4">
                <div className="mt-1 shrink-0">
                  {getAlertIcon(alert.alert_type)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {alert.title}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {alert.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
