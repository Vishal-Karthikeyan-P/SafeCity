import { useState } from 'react'
import { Search, Eye, Filter, CheckCircle, XCircle, Trash2, MapPin, Calendar, User as UserIcon, ShieldAlert } from 'lucide-react'
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
import { useAdminIncidents, useUpdateIncidentStatus, useDeleteIncident, useCategories } from '@/api/incidents'
import { formatDate, toTitleCase, getImageUrl } from '@/lib/utils'
import type { Incident, IncidentStatus } from '@/types'

export function AdminIncidentsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<string>('severity')

  const { data: categories = [] } = useCategories()
  const { data, isLoading } = useAdminIncidents({
    page,
    limit: 15,
    search: search || undefined,
    status: (statusFilter as IncidentStatus) || undefined,
    category_id: categoryFilter || undefined,
    severity: severityFilter || undefined,
    sort_by: sortBy,
  })

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateIncidentStatus()
  const { mutate: deleteIncident, isPending: isDeleting } = useDeleteIncident()

  const [actionModal, setActionModal] = useState<{ incident: Incident, action: IncidentStatus } | null>(null)
  const [deleteModal, setDeleteModal] = useState<Incident | null>(null)
  const [detailModal, setDetailModal] = useState<Incident | null>(null)
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

  const handleDelete = () => {
    if (!deleteModal) return
    deleteIncident(deleteModal.id, {
      onSuccess: () => setDeleteModal(null)
    })
  }

  const incidents = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Incidents</h1>
          <p className="text-muted-foreground text-sm">Review, approve, filter, and moderate city safety reports.</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1) }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="severity">Severity (Default)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="date_desc">Date (Newest)</SelectItem>
              <SelectItem value="category">Category</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter ?? 'all'} onValueChange={(v) => { setCategoryFilter(v === 'all' ? null : v); setPage(1) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter ?? 'all'} onValueChange={(v) => { setSeverityFilter(v === 'all' ? null : v); setPage(1) }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter ?? 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? null : v); setPage(1) }}>
            <SelectTrigger className="w-36">
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
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">Loading incidents...</td>
                  </tr>
                ) : incidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <Filter className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No incidents found matching your filter criteria.</p>
                    </td>
                  </tr>
                ) : (
                  incidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setDetailModal(incident)}>
                          <span className="text-2xl">{incident.category?.icon || '📋'}</span>
                          <div>
                            <p className="font-semibold text-foreground line-clamp-1 hover:underline">{incident.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{incident.category?.name}</span>
                              <Badge variant={incident.severity as any} className="text-[10px] px-1.5 py-0 h-4">
                                {toTitleCase(incident.severity)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {incident.is_anonymous ? (
                          <span className="text-muted-foreground italic text-xs">Anonymous</span>
                        ) : (
                          <div>
                            <p className="font-medium">{incident.reporter?.full_name || 'Citizen'}</p>
                            <p className="text-xs text-muted-foreground">{incident.reporter?.email}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="line-clamp-2 max-w-[200px]" title={incident.location_address || 'GPS Only'}>
                          {incident.location_address || <span className="text-muted-foreground italic text-xs">GPS ({incident.location_lat.toFixed(4)}, {incident.location_lng.toFixed(4)})</span>}
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
                      <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                        {/* View Details Modal */}
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => setDetailModal(incident)}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {/* Approve */}
                        {incident.status !== 'approved' && incident.status !== 'resolved' && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50"
                            onClick={() => setActionModal({ incident, action: 'approved' })}
                            title="Approve Incident"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}

                        {/* Reject */}
                        {incident.status !== 'rejected' && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                            onClick={() => setActionModal({ incident, action: 'rejected' })}
                            title="Reject Incident"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}

                        {/* Delete */}
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteModal(incident)}
                          title="Delete Incident"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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

      {/* Incident Detail Modal */}
      <Dialog open={!!detailModal} onOpenChange={(open) => !open && setDetailModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span>{detailModal?.category?.icon}</span>
              {detailModal?.title}
            </DialogTitle>
          </DialogHeader>
          {detailModal && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={detailModal.severity as any}>Severity: {toTitleCase(detailModal.severity)}</Badge>
                <Badge variant={detailModal.status as any}>Status: {toTitleCase(detailModal.status)}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(detailModal.created_at)}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Description</h4>
                <p className="text-sm leading-relaxed bg-muted/30 p-3 rounded-lg border">{detailModal.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" /> Location
                  </h4>
                  <p className="text-sm">{detailModal.location_address || 'Coordinates Only'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Lat: {detailModal.location_lat}, Lng: {detailModal.location_lng}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-purple-500" /> Reporter
                  </h4>
                  {detailModal.is_anonymous ? (
                    <p className="text-sm italic text-muted-foreground">Anonymous Report</p>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">{detailModal.reporter?.full_name || 'Citizen'}</p>
                      <p className="text-xs text-muted-foreground">{detailModal.reporter?.email}</p>
                    </div>
                  )}
                </div>
              </div>

              {detailModal.admin_note && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                  <h4 className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300 mb-0.5">Admin Note</h4>
                  <p className="text-sm text-amber-900 dark:text-amber-200">{detailModal.admin_note}</p>
                </div>
              )}

              {detailModal.images && detailModal.images.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Attached Images ({detailModal.images.length})</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {detailModal.images.map((img) => (
                      <a key={img.id} href={getImageUrl(img.url)} target="_blank" rel="noreferrer">
                        <img
                          src={getImageUrl(img.url)}
                          alt="Incident proof"
                          className="w-full h-24 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailModal(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Modal (Approve / Reject) */}
      <Dialog open={!!actionModal} onOpenChange={(open) => !open && setActionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionModal?.action === 'approved' ? 'Approve' : 'Reject'} Incident Report
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              You are updating the status of <strong>"{actionModal?.incident.title}"</strong> to <Badge variant={actionModal?.action as any}>{actionModal?.action}</Badge>.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1.5">Admin Note / Reason</label>
              <Textarea
                placeholder="Internal note or message visible to reporter..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
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

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteModal} onOpenChange={(open) => !open && setDeleteModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="w-5 h-5" />
              Delete Incident Report
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete incident report <strong>"{deleteModal?.title}"</strong>?
            </p>
            <p className="text-xs text-red-500 mt-2 font-medium">This will soft-delete the record from active view.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={isDeleting}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
