import { useState } from 'react'
import { Search, Eye, Filter, CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useAdminIncidents, useUpdateIncidentStatus } from '@/api/incidents'
import { formatDate, toTitleCase, truncate } from '@/lib/utils'
import type { Incident, IncidentStatus } from '@/types'

export function AdminIncidentsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  
  const { data, isLoading } = useAdminIncidents({
    page, limit: 15, search: search || undefined, status: (statusFilter as IncidentStatus) || undefined
  })
  
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateIncidentStatus()
  const [actionModal, setActionModal] = useState<{incident: Incident, action: IncidentStatus} | null>(null)
  const [adminNote, setAdminNote] = useState('')

  const handleAction = () => {
    if (!actionModal) return
    updateStatus({
      incidentId: actionModal.incident.id,
      status: actionModal.action,
      admin_note: adminNote || undefined
    }, {
      onSuccess: () => {
        setActionModal(null)
        setAdminNote('')
      }
    })
  }

  const incidents = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Incidents</h1>
          <p className="text-muted-foreground text-sm">Review, approve, and update incident reports.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search reports..." 
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Select value={statusFilter ?? 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? null : v); setPage(1) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-6 py-4">Incident</th>
                  <th className="px-6 py-4">Reporter</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">Loading...</td>
                  </tr>
                ) : incidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <Filter className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No incidents found matching your criteria.</p>
                    </td>
                  </tr>
                ) : (
                  incidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{incident.category.icon}</span>
                          <div>
                            <p className="font-semibold text-foreground line-clamp-1">{incident.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{incident.category.name}</span>
                              <Badge variant={incident.severity as any} className="text-[10px] px-1.5 py-0 h-4">
                                {toTitleCase(incident.severity)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {incident.is_anonymous ? (
                          <span className="text-muted-foreground italic">Anonymous</span>
                        ) : (
                          <div>
                            <p className="font-medium">{incident.reporter?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{incident.reporter?.email}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="line-clamp-2 max-w-[200px]" title={incident.location_address || 'GPS Only'}>
                          {incident.location_address || <span className="text-muted-foreground italic">GPS Coordinates</span>}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatDate(incident.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={incident.status as any}>
                          {toTitleCase(incident.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                          <Link to={`/incidents/${incident.id}`} target="_blank">
                            <Eye className="w-4 h-4 text-blue-500" />
                          </Link>
                        </Button>
                        {incident.status !== 'approved' && incident.status !== 'resolved' && (
                          <Button 
                            variant="ghost" size="icon" className="h-8 w-8 hover:bg-green-100 hover:text-green-600"
                            onClick={() => setActionModal({incident, action: 'approved'})}
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                        {incident.status !== 'rejected' && (
                          <Button 
                            variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-100 hover:text-red-600"
                            onClick={() => setActionModal({incident, action: 'rejected'})}
                          >
                            <XCircle className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <span className="text-sm text-muted-foreground">
                Showing page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Modal */}
      <Dialog open={!!actionModal} onOpenChange={(open) => !open && setActionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionModal?.action === 'approved' ? 'Approve' : 'Reject'} Incident
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              You are about to <strong>{actionModal?.action}</strong> the incident "{actionModal?.incident.title}".
            </p>
            <div>
              <label className="block text-sm font-medium mb-1.5">Admin Note (Optional)</label>
              <Textarea 
                placeholder="Reason for decision, instructions, or internal note..." 
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">This will be visible to the reporter.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button 
              variant={actionModal?.action === 'approved' ? 'safe' : 'danger'} 
              onClick={handleAction} 
              loading={isUpdating}
            >
              Confirm {actionModal?.action === 'approved' ? 'Approval' : 'Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
