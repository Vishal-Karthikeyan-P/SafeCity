import { useState } from 'react'
import {
  Search, Eye, Filter, CheckCircle, XCircle, Trash2, MapPin, Calendar,
  User as UserIcon, ShieldAlert, History, AlertCircle, FileText, ArrowRight,
  ShieldCheck, RotateCcw, Clock,
} from 'lucide-react'
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
import {
  useAdminIncidents, useUpdateIncidentStatus, useDeleteIncident,
  useStatusHistory, useResolutionRequests
} from '@/api/incidents'
import { SearchableCategorySelect } from '@/components/incidents/SearchableCategorySelect'
import { formatDate, timeAgo, toTitleCase, getImageUrl } from '@/lib/utils'
import type { Incident, IncidentStatus, SeverityLevel } from '@/types'
import type { LucideIcon } from 'lucide-react'

// Valid Admin next status transitions per specification
const VALID_NEXT_STATUSES: Record<
  IncidentStatus,
  { status: IncidentStatus; label: string; variant: 'safe' | 'danger' | 'warning' | 'default' }[]
> = {
  pending: [
    { status: 'approved', label: 'Approve', variant: 'safe' },
    { status: 'rejected', label: 'Reject', variant: 'danger' },
  ],
  approved: [
    { status: 'under_review', label: 'Under Review', variant: 'warning' },
    { status: 'resolved', label: 'Resolve', variant: 'safe' },
    { status: 'rejected', label: 'Reject', variant: 'danger' },
  ],
  under_review: [
    { status: 'approved', label: 'Approve', variant: 'safe' },
    { status: 'resolved', label: 'Resolve', variant: 'safe' },
    { status: 'rejected', label: 'Reject', variant: 'danger' },
  ],
  resolved_unverified: [
    { status: 'resolved', label: 'Verify & Resolve', variant: 'safe' },
    { status: 'under_review', label: 'Under Review', variant: 'warning' },
    { status: 'approved', label: 'Return to Active', variant: 'default' },
    { status: 'rejected', label: 'Reject', variant: 'danger' },
  ],
  resolved: [
    { status: 'under_review', label: 'Reopen (Review)', variant: 'warning' },
    { status: 'approved', label: 'Reopen (Active)', variant: 'default' },
  ],
  rejected: [
    { status: 'pending', label: 'Reset to Pending', variant: 'default' },
    { status: 'approved', label: 'Approve', variant: 'safe' },
  ],
}

function getActionIcon(opt: { status: IncidentStatus; label: string }): LucideIcon {
  if (/^(Reopen|Reset|Return)/.test(opt.label)) return RotateCcw
  switch (opt.status) {
    case 'approved': return CheckCircle
    case 'rejected': return XCircle
    case 'resolved': return ShieldCheck
    case 'under_review': return Clock
    default: return CheckCircle
  }
}

export function AdminIncidentsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<string>('severity')

  const { data, isLoading } = useAdminIncidents({
    page,
    limit: 15,
    search: search || undefined,
    status: (statusFilter as IncidentStatus) || undefined,
    category_id: categoryFilter || undefined,
    severity: (severityFilter as SeverityLevel) || undefined,
    sort_by: sortBy,
  })

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateIncidentStatus()
  const { mutate: deleteIncident, isPending: isDeleting } = useDeleteIncident()

  const [actionModal, setActionModal] = useState<{
    incident: Incident
    action: IncidentStatus
    label: string
  } | null>(null)
  const [deleteModal, setDeleteModal] = useState<Incident | null>(null)
  const [detailModal, setDetailModal] = useState<Incident | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)

  const handleOpenAction = (incident: Incident, nextStatus: IncidentStatus, label: string) => {
    setActionModal({ incident, action: nextStatus, label })
    setAdminNote('')
    setNoteError(null)
  }

  const handleConfirmAction = () => {
    if (!actionModal) return

    // Require reason when moving to rejected or resolved
    if (
      (actionModal.action === 'rejected' || actionModal.action === 'resolved') &&
      !adminNote.trim()
    ) {
      setNoteError(`A reason/note is required when changing status to ${toTitleCase(actionModal.action)}.`)
      return
    }

    updateStatus(
      {
        incidentId: actionModal.incident.id,
        status: actionModal.action,
        admin_note: adminNote.trim() || undefined,
      },
      {
        onSuccess: (updated) => {
          setActionModal(null)
          setAdminNote('')
          setNoteError(null)
          // Also update detail modal if open
          if (detailModal && detailModal.id === updated.id) {
            setDetailModal(updated)
          }
        },
      }
    )
  }

  const handleDelete = () => {
    if (!deleteModal) return
    deleteIncident(deleteModal.id, {
      onSuccess: () => setDeleteModal(null),
    })
  }

  const incidents = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Incidents</h1>
          <p className="text-muted-foreground text-sm">
            Review, approve, filter, moderate and verify city safety reports.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {/* Sort By */}
          <Select
            value={sortBy}
            onValueChange={(v) => {
              setSortBy(v)
              setPage(1)
            }}
          >
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

          {/* Searchable Category Filter */}
          <div className="w-48">
            <SearchableCategorySelect
              value={categoryFilter}
              onChange={(v) => {
                setCategoryFilter(v)
                setPage(1)
              }}
              allowAll={true}
              allLabel="All Categories"
              clearable={true}
              placeholder="All Categories"
            />
          </div>

          {/* Severity */}
          <Select
            value={severityFilter ?? 'all'}
            onValueChange={(v) => {
              setSeverityFilter(v === 'all' ? null : v)
              setPage(1)
            }}
          >
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

          {/* Status */}
          <Select
            value={statusFilter ?? 'all'}
            onValueChange={(v) => {
              setStatusFilter(v === 'all' ? null : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="resolved_unverified">Resolved (Unverified)</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-6 py-4 min-w-[260px]">Incident</th>
                  <th className="px-6 py-4">Reporter</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Valid Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Loading incidents...
                    </td>
                  </tr>
                ) : incidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <Filter className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        No incidents found matching your filter criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  incidents.map((incident) => {
                    const nextOptions = VALID_NEXT_STATUSES[incident.status] || []
                    return (
                      <tr
                        key={incident.id}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => setDetailModal(incident)}
                          >
                            <span className="text-2xl">
                              {incident.category?.icon || '📋'}
                            </span>
                            <div>
                              <p className="font-semibold text-foreground line-clamp-1 hover:underline">
                                {incident.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {incident.category?.name}
                                </span>
                                <Badge
                                  variant={incident.severity as any}
                                  className="text-[10px] px-1.5 py-0 h-4"
                                >
                                  {toTitleCase(incident.severity)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {incident.is_anonymous ? (
                            <span className="text-muted-foreground italic text-xs">
                              Anonymous
                            </span>
                          ) : (
                            <div>
                              <p className="font-medium">
                                {incident.reporter?.full_name || 'Citizen'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {incident.reporter?.email}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p
                            className="line-clamp-2 max-w-[200px]"
                            title={incident.location_address || 'GPS Only'}
                          >
                            {incident.location_address || (
                              <span className="text-muted-foreground italic text-xs">
                                GPS ({incident.location_lat.toFixed(4)},{' '}
                                {incident.location_lng.toFixed(4)})
                              </span>
                            )}
                          </p>
                        </td>
                        {/* Date */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatDate(incident.created_at)}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <Badge variant={incident.status as any} className="whitespace-nowrap">
                            {incident.status === 'resolved_unverified'
                              ? 'Resolved (Unverified)'
                              : toTitleCase(incident.status)}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center justify-end gap-2">
                            {nextOptions.length > 0 && (
                              <div className="grid grid-cols-2 gap-1.5 w-[256px]">
                                {nextOptions.map((opt) => {
                                  const Icon = getActionIcon(opt)
                                  return (
                                    <Button
                                      key={opt.status}
                                      variant={
                                        opt.variant === 'safe'
                                          ? 'safe'
                                          : opt.variant === 'danger'
                                            ? 'danger'
                                            : 'outline'
                                      }
                                      size="sm"
                                      className="h-8 w-full justify-center gap-1.5 px-2 text-xs font-medium whitespace-nowrap [&:last-child:nth-child(odd)]:col-span-2"
                                      onClick={() => handleOpenAction(incident, opt.status, opt.label)}
                                      title={`Change status to ${toTitleCase(opt.status)}`}
                                    >
                                      <Icon className="w-3.5 h-3.5 shrink-0" />
                                      {opt.label}
                                    </Button>
                                  )
                                })}
                              </div>
                            )}

                            <div className="flex items-center gap-0.5 border-l pl-2 ml-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => setDetailModal(incident)}
                                title="View details & history"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteModal(incident)}
                                title="Delete incident"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
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
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident Detail Modal with Status History & Resolution Evidence */}
      {detailModal && (
        <AdminIncidentDetailDialog
          incident={detailModal}
          onClose={() => setDetailModal(null)}
          onAction={(nextStatus, label) =>
            handleOpenAction(detailModal, nextStatus, label)
          }
        />
      )}

      {/* Action Modal (Valid Status Transition Confirmation) */}
      <Dialog
        open={!!actionModal}
        onOpenChange={(open) => {
          if (!open) {
            setActionModal(null)
            setNoteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Update Incident Status</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <Badge variant={actionModal?.action as any}>
                {actionModal?.action === 'resolved_unverified'
                  ? 'Resolved (Unverified)'
                  : toTitleCase(actionModal?.action || '')}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Transitioning <strong>"{actionModal?.incident.title}"</strong> from{' '}
              <Badge variant={actionModal?.incident.status as any}>
                {toTitleCase(actionModal?.incident.status || '')}
              </Badge>{' '}
              to{' '}
              <Badge variant={actionModal?.action as any}>
                {toTitleCase(actionModal?.action || '')}
              </Badge>
              .
            </p>

            {(actionModal?.action === 'rejected' ||
              actionModal?.action === 'resolved') && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    A reason/note is <strong>required</strong> when setting status to{' '}
                    {toTitleCase(actionModal.action)}.
                  </span>
                </div>
              )}

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Admin Note / Reason{' '}
                {actionModal?.action === 'rejected' ||
                  actionModal?.action === 'resolved' ? (
                  <span className="text-red-500">*</span>
                ) : (
                  <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                )}
              </label>
              <Textarea
                placeholder={
                  actionModal?.action === 'resolved'
                    ? 'State how the hazard was resolved / verified...'
                    : actionModal?.action === 'rejected'
                      ? 'State why this report was rejected...'
                      : 'Internal notes or message for records...'
                }
                value={adminNote}
                onChange={(e) => {
                  setAdminNote(e.target.value)
                  if (noteError) setNoteError(null)
                }}
              />
              {noteError && (
                <p className="text-xs text-red-600 mt-1 font-medium">{noteError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionModal(null)
                setNoteError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant={
                actionModal?.action === 'approved' || actionModal?.action === 'resolved'
                  ? 'safe'
                  : actionModal?.action === 'rejected'
                    ? 'danger'
                    : 'default'
              }
              onClick={handleConfirmAction}
              loading={isUpdating}
            >
              Confirm {actionModal?.label || 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={!!deleteModal}
        onOpenChange={(open) => !open && setDeleteModal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="w-5 h-5" />
              Delete Incident Report
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete incident report{' '}
              <strong>"{deleteModal?.title}"</strong>?
            </p>
            <p className="text-xs text-red-500 mt-2 font-medium">
              This will soft-delete the record from active view.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModal(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={isDeleting}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Detail & Audit Dialog Subcomponent ────────────────────────────
function AdminIncidentDetailDialog({
  incident,
  onClose,
  onAction,
}: {
  incident: Incident
  onClose: () => void
  onAction: (nextStatus: IncidentStatus, label: string) => void
}) {
  const { data: statusHistory = [], isLoading: isLoadingHistory } = useStatusHistory(incident.id)
  const { data: resolutionRequests = [], isLoading: isLoadingReqs } = useResolutionRequests(incident.id)

  const nextOptions = VALID_NEXT_STATUSES[incident.status] || []

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span>{incident.category?.icon || '📋'}</span>
            <span>{incident.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Header Badges */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={incident.severity as any}>
                Severity: {toTitleCase(incident.severity)}
              </Badge>
              <Badge variant={incident.status as any}>
                Status:{' '}
                {incident.status === 'resolved_unverified'
                  ? 'Resolved (Unverified)'
                  : toTitleCase(incident.status)}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(incident.created_at)}
              </span>
            </div>

            {/* Valid action buttons in modal header */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {nextOptions.map((opt) => (
                <Button
                  key={opt.status}
                  size="sm"
                  variant={
                    opt.variant === 'safe'
                      ? 'safe'
                      : opt.variant === 'danger'
                        ? 'danger'
                        : 'outline'
                  }
                  className="h-8 text-xs font-medium"
                  onClick={() => onAction(opt.status, opt.label)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
              Description
            </h4>
            <p className="text-sm leading-relaxed bg-muted/30 p-3 rounded-lg border">
              {incident.description}
            </p>
          </div>

          {/* Location & Reporter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-500" /> Location
              </h4>
              <p className="text-sm">{incident.location_address || 'Coordinates Only'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lat: {incident.location_lat}, Lng: {incident.location_lng}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5 text-purple-500" /> Reporter
              </h4>
              {incident.is_anonymous ? (
                <p className="text-sm italic text-muted-foreground">Anonymous Report</p>
              ) : (
                <div>
                  <p className="text-sm font-medium">
                    {incident.reporter?.full_name || 'Citizen'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {incident.reporter?.email}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Admin Note if present */}
          {incident.admin_note && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
              <h4 className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300 mb-0.5">
                Current Admin Note
              </h4>
              <p className="text-sm text-amber-900 dark:text-amber-200">
                {incident.admin_note}
              </p>
            </div>
          )}

          {/* Attached Incident Images */}
          {incident.images && incident.images.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Attached Incident Images ({incident.images.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {incident.images.map((img) => (
                  <a
                    key={img.id}
                    href={getImageUrl(img.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
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

          {/* Resolution Requests & Evidence */}
          <div className="border-t pt-4">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-teal-600" />
              Resolution Requests & Evidence ({resolutionRequests.length})
            </h4>

            {isLoadingReqs ? (
              <p className="text-xs text-muted-foreground">Loading resolution requests...</p>
            ) : resolutionRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/20 p-2.5 rounded-lg border">
                No resolution requests submitted yet.
              </p>
            ) : (
              <div className="space-y-3">
                {resolutionRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl border bg-muted/20 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            req.status === 'approved'
                              ? 'approved'
                              : req.status === 'rejected'
                                ? 'rejected'
                                : 'pending'
                          }
                        >
                          Request: {toTitleCase(req.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          by {req.requester?.full_name || 'Citizen'} •{' '}
                          {timeAgo(req.created_at)}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm bg-card p-2.5 rounded-lg border">
                      {req.explanation}
                    </p>

                    {req.evidence_url && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-muted-foreground block mb-1">
                          Attached Resolution Evidence:
                        </span>
                        <a
                          href={getImageUrl(req.evidence_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block"
                        >
                          <img
                            src={getImageUrl(req.evidence_url)}
                            alt="Resolution evidence"
                            className="h-28 rounded-lg border object-cover hover:opacity-90 shadow-sm"
                          />
                        </a>
                      </div>
                    )}

                    {req.rejection_reason && (
                      <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200">
                        <strong>Creator Rejection Reason:</strong> {req.rejection_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Change History / Audit Trail */}
          <div className="border-t pt-4">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2.5 flex items-center gap-1.5">
              <History className="w-4 h-4 text-purple-600" />
              Status History & Audit Trail ({statusHistory.length})
            </h4>

            {isLoadingHistory ? (
              <p className="text-xs text-muted-foreground">Loading audit trail...</p>
            ) : statusHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/20 p-2.5 rounded-lg border">
                No status change history recorded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {statusHistory.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between p-2.5 rounded-lg border bg-muted/10 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-medium">
                        <Badge variant={h.from_status as any} className="text-[10px] px-1 py-0">
                          {toTitleCase(h.from_status)}
                        </Badge>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <Badge variant={h.to_status as any} className="text-[10px] px-1 py-0">
                          {toTitleCase(h.to_status)}
                        </Badge>
                      </div>
                      {h.reason && (
                        <p className="mt-1 text-muted-foreground">{h.reason}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 text-muted-foreground ml-3">
                      <p className="font-medium text-foreground">
                        {h.changed_by?.full_name || 'Admin'}
                      </p>
                      <p>{formatDate(h.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
