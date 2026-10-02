import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Clock, User, AlertTriangle, Share2,
  CheckCircle2, XCircle, Upload, ShieldCheck, History,
  FileCheck, ArrowRight, Loader2, Sparkles
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { IncidentMap } from '@/components/map/IncidentMap'
import {
  useIncident, useResolutionRequests, useCreateResolutionRequest,
  useReviewResolutionRequest, useUploadEvidence, useStatusHistory
} from '@/api/incidents'
import { useAuthStore } from '@/store/auth'
import { formatDate, timeAgo, toTitleCase, getImageUrl } from '@/lib/utils'
import type { ResolutionRequest } from '@/types'
import { toast } from 'sonner'

const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='40' font-size='30' text-anchor='middle' dominant-baseline='middle' fill='%23f59e0b'%3E⚠%3C/text%3E%3Ctext x='50' y='65' font-size='10' text-anchor='middle' fill='%236b7280'%3ENo Image%3C/text%3E%3C/svg%3E"

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)

  const { data: incident, isLoading, isError } = useIncident(id!)
  const { data: resolutionRequests = [], isLoading: isLoadingRequests } = useResolutionRequests(id!)
  const { data: statusHistory = [] } = useStatusHistory(id!)

  const { mutateAsync: createResolutionRequest, isPending: isSubmittingRequest } =
    useCreateResolutionRequest()
  const { mutateAsync: reviewResolutionRequest, isPending: isReviewing } =
    useReviewResolutionRequest()
  const { mutateAsync: uploadEvidenceFile, isPending: isUploadingEvidence } =
    useUploadEvidence()

  // Modals state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Rejection modal
  const [rejectingRequest, setRejectingRequest] = useState<ResolutionRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-80 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !incident) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Incident not found</h2>
        <Button onClick={() => navigate('/incidents')}>Back to Incidents</Button>
      </div>
    )
  }

  const isCreator =
    currentUser && incident.reporter_id && String(currentUser.id) === String(incident.reporter_id)

  const isEligibleForResolution =
    incident.status === 'approved' || incident.status === 'under_review'

  const hasPendingRequest = resolutionRequests.some((r) => r.status === 'pending')

  // Handle Evidence selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setEvidenceFile(file)
      setEvidencePreview(URL.createObjectURL(file))
    }
  }

  // Submit Resolution Request
  const handleSubmitResolutionRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!explanation.trim()) {
      setFormError('Please describe the resolution details.')
      return
    }

    try {
      let evidenceUrl: string | undefined = undefined
      if (evidenceFile) {
        const uploadRes = await uploadEvidenceFile(evidenceFile)
        evidenceUrl = uploadRes.url
      }

      await createResolutionRequest({
        incidentId: incident.id,
        explanation: explanation.trim(),
        evidence_url: evidenceUrl,
      })

      setIsRequestModalOpen(false)
      setExplanation('')
      setEvidenceFile(null)
      setEvidencePreview(null)
      setFormError(null)
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Failed to submit resolution request.')
    }
  }

  // Handle Creator Approval
  const handleApproveRequest = async (request: ResolutionRequest) => {
    try {
      await reviewResolutionRequest({
        incidentId: incident.id,
        requestId: request.id,
        action: 'approve',
      })
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to approve resolution request.')
    }
  }

  // Handle Creator Rejection
  const handleConfirmReject = async () => {
    if (!rejectingRequest) return
    if (!rejectionReason.trim()) {
      setRejectionError('Please provide a reason for rejecting the resolution request.')
      return
    }

    try {
      await reviewResolutionRequest({
        incidentId: incident.id,
        requestId: rejectingRequest.id,
        action: 'reject',
        rejection_reason: rejectionReason.trim(),
      })
      setRejectingRequest(null)
      setRejectionReason('')
      setRejectionError(null)
    } catch (err: any) {
      setRejectionError(err?.response?.data?.detail || 'Failed to reject request.')
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back nav */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Prominent Banner for RESOLVED (UNVERIFIED) */}
      {incident.status === 'resolved_unverified' && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800">
          <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">
              Resolved (Pending Admin Verification)
            </h3>
            <p className="text-amber-800 dark:text-amber-300 mt-0.5">
              The community submitted resolution evidence for this hazard, and the incident creator
              verified the fix. This incident is now in <strong>Resolved (Unverified)</strong>{' '}
              status awaiting final city administrator review.
            </p>
          </div>
        </div>
      )}

      {/* Prominent Banner for RESOLVED */}
      {incident.status === 'resolved' && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800">
          <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h3 className="font-semibold text-teal-900 dark:text-teal-200">
              Hazard Fully Resolved
            </h3>
            <p className="text-teal-800 dark:text-teal-300 mt-0.5">
              This incident has been officially inspected and marked as resolved by city
              administrators. Thank you for keeping our streets safe!
            </p>
          </div>
        </div>
      )}

      {/* Hero Card */}
      <div className="rounded-2xl overflow-hidden border bg-card">
        {/* Images */}
        {incident.images && incident.images.length > 0 && (
          <div
            className={`grid gap-1 ${incident.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            {incident.images.slice(0, 4).map((img, idx) => (
              <div key={img.id} className="relative aspect-video overflow-hidden bg-muted">
                <img
                  src={getImageUrl(img.url)}
                  alt={`Evidence ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src = PLACEHOLDER_IMG
                  }}
                />
                {idx === 3 && incident.images.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">
                      +{incident.images.length - 4}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="p-6">
          {/* Category + badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-2xl">{incident.category.icon}</span>
            <span className="text-sm text-muted-foreground">{incident.category.name}</span>
            <Badge variant={incident.severity as any} className="ml-2">
              {toTitleCase(incident.severity)}
            </Badge>
            <Badge variant={incident.status as any}>
              {incident.status === 'resolved_unverified'
                ? 'Resolved (Unverified)'
                : toTitleCase(incident.status)}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold mb-3">{incident.title}</h1>
          <p className="text-muted-foreground leading-relaxed">{incident.description}</p>

          {/* Admin note */}
          {incident.admin_note && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                Admin Note
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">{incident.admin_note}</p>
            </div>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
            {incident.location_address && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="text-sm font-medium">{incident.location_address}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Reported</p>
                <p className="text-sm font-medium">{formatDate(incident.created_at)}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(incident.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Reporter</p>
                <p className="text-sm font-medium">
                  {incident.is_anonymous
                    ? 'Anonymous'
                    : incident.reporter?.full_name ?? 'Unknown'}
                  {isCreator && (
                    <span className="ml-1.5 text-xs text-primary font-semibold">(You)</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center gap-3 mt-6 flex-wrap border-t pt-4">
            {/* Resolution Request Button for logged-in users when eligible */}
            {isEligibleForResolution && currentUser && (
              <Button
                variant="safe"
                size="sm"
                onClick={() => {
                  setIsRequestModalOpen(true)
                  setFormError(null)
                }}
                disabled={hasPendingRequest}
              >
                <FileCheck className="w-4 h-4 mr-1.5" />
                {hasPendingRequest ? 'Resolution Pending Review' : 'Request Resolution'}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const url = window.location.href
                if (navigator.share) {
                  try {
                    await navigator.share({ title: incident.title, url })
                  } catch {}
                } else {
                  await navigator.clipboard.writeText(url)
                  toast.success('Link copied to clipboard!')
                }
              }}
            >
              <Share2 className="w-4 h-4 mr-1.5" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Creator Review Section for Incoming Resolution Requests */}
      {isCreator && resolutionRequests.length > 0 && (
        <Card className="border-teal-300 dark:border-teal-800">
          <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 rounded-t-2xl">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-teal-600" />
                Resolution Requests for Your Report
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                You reported this incident. You can review and verify community fix requests.
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {resolutionRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border bg-card space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
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
                      Status: {toTitleCase(req.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Requested by <strong>{req.requester?.full_name || 'Citizen'}</strong> •{' '}
                      {timeAgo(req.created_at)}
                    </span>
                  </div>

                  {/* Creator Action Buttons for Pending Request */}
                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="safe"
                        onClick={() => handleApproveRequest(req)}
                        loading={isReviewing}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Approve Resolution
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setRejectingRequest(req)
                          setRejectionReason('')
                          setRejectionError(null)
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Explanation
                  </h4>
                  <p className="text-sm bg-muted/30 p-3 rounded-lg border">
                    {req.explanation}
                  </p>
                </div>

                {req.evidence_url && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                      Submitted Resolution Evidence
                    </h4>
                    <a
                      href={getImageUrl(req.evidence_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block"
                    >
                      <img
                        src={getImageUrl(req.evidence_url)}
                        alt="Resolution evidence"
                        className="h-36 rounded-lg border object-cover hover:opacity-90 transition-opacity shadow-sm"
                      />
                    </a>
                  </div>
                )}

                {req.rejection_reason && (
                  <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200">
                    <strong>Rejection Reason:</strong> {req.rejection_reason}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Status History & Audit Trail */}
      {statusHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-purple-600" />
              Status Change History & Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-2.5">
            {statusHistory.map((h) => (
              <div
                key={h.id}
                className="flex items-start justify-between p-3 rounded-xl border bg-muted/10 text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Badge variant={h.from_status as any} className="text-[10px] px-1.5 py-0">
                      {h.from_status === 'resolved_unverified'
                        ? 'Resolved (Unverified)'
                        : toTitleCase(h.from_status)}
                    </Badge>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <Badge variant={h.to_status as any} className="text-[10px] px-1.5 py-0">
                      {h.to_status === 'resolved_unverified'
                        ? 'Resolved (Unverified)'
                        : toTitleCase(h.to_status)}
                    </Badge>
                  </div>
                  {h.reason && (
                    <p className="mt-1.5 text-muted-foreground text-sm">{h.reason}</p>
                  )}
                </div>
                <div className="text-right shrink-0 text-muted-foreground ml-4">
                  <p className="font-medium text-foreground">
                    {h.changed_by?.full_name || 'System / Admin'}
                  </p>
                  <p>{formatDate(h.created_at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden rounded-b-2xl">
          <IncidentMap
            incidents={[incident]}
            center={[incident.location_lat, incident.location_lng]}
            zoom={15}
            height="300px"
          />
        </CardContent>
      </Card>

      {/* Request Resolution Modal */}
      <Dialog
        open={isRequestModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsRequestModalOpen(false)
            setFormError(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-teal-600" />
              Request Incident Resolution
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitResolutionRequest} className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Submit proof and details that <strong>"{incident.title}"</strong> has been resolved.
              The incident reporter and city administrators will review your submission.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Resolution Explanation <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Explain what action was taken or how the hazard was repaired/cleared..."
                value={explanation}
                onChange={(e) => {
                  setExplanation(e.target.value)
                  if (formError) setFormError(null)
                }}
                className="h-28"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Evidence Photo (Optional but recommended)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  {evidenceFile ? 'Change Photo' : 'Select Photo'}
                </Button>
                {evidenceFile && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {evidenceFile.name}
                  </span>
                )}
              </div>

              {evidencePreview && (
                <div className="mt-3 relative w-36 h-24 rounded-lg overflow-hidden border">
                  <img
                    src={evidencePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEvidenceFile(null)
                      setEvidencePreview(null)
                    }}
                    className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white p-1 rounded-full text-xs"
                    title="Remove"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {formError && (
              <p className="text-xs text-red-600 font-medium">{formError}</p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRequestModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="safe"
                loading={isSubmittingRequest || isUploadingEvidence}
              >
                Submit Resolution
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Request Modal for Creator */}
      <Dialog
        open={!!rejectingRequest}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingRequest(null)
            setRejectionError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Reject Resolution Request
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 space-y-4">
            <p className="text-sm text-muted-foreground">
              Please specify why this resolution request does not adequately resolve the reported
              incident. The incident will remain in its current status.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="e.g. The pothole is still uncovered, or the lighting is still defective..."
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value)
                  if (rejectionError) setRejectionError(null)
                }}
              />
              {rejectionError && (
                <p className="text-xs text-red-600 mt-1 font-medium">{rejectionError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingRequest(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmReject}
              loading={isReviewing}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
