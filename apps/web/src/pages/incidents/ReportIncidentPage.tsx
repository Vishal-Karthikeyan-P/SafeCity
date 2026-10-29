import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Image as ImageIcon, X, ArrowRight, Loader2, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { IncidentMap } from '@/components/map/IncidentMap'
import { useCreateIncident, useUploadImages } from '@/api/incidents'
import type { Incident } from '@/types'
import { SearchableCategorySelect } from '@/components/incidents/SearchableCategorySelect'
import { reportIncidentSchema, type ReportIncidentValues } from '@/lib/schemas'
import { toast } from 'sonner'

// Severity appearance helpers for post-submission display
const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string; border: string; label: string }> = {
  low: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    border: 'border-emerald-500/30',
    label: 'Low',
  },
  medium: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    border: 'border-amber-500/30',
    label: 'Medium',
  },
  high: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
    border: 'border-orange-500/30',
    label: 'High',
  },
  critical: {
    bg: 'bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    border: 'border-red-500/30',
    label: 'Critical',
  },
}

export function ReportIncidentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { mutateAsync: createIncident, isPending: isCreating } = useCreateIncident()
  const { mutateAsync: uploadImages, isPending: isUploading } = useUploadImages()

  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>([11.0168, 76.9558])
  const [images, setImages] = useState<File[]>([])
  const [isLocating, setIsLocating] = useState(false)

  // Post-submission state
  const [submittedIncident, setSubmittedIncident] = useState<Incident | null>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReportIncidentValues>({
    resolver: zodResolver(reportIncidentSchema),
    defaultValues: {
      is_anonymous: false,
    },
  })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      if (images.length + newFiles.length > 5) {
        toast.error('Maximum 5 images allowed')
        return
      }
      setImages([...images, ...newFiles])
    }
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleLocationSelect = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng })
    setMapCenter([lat, lng])
    setValue('location_lat', lat, { shouldValidate: true })
    setValue('location_lng', lng, { shouldValidate: true })
    toast.success(`Location set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }

  // Pre-fill location from query params if passed
  useEffect(() => {
    const latStr = searchParams.get('lat')
    const lngStr = searchParams.get('lng')
    if (latStr && lngStr) {
      const lat = parseFloat(latStr)
      const lng = parseFloat(lngStr)
      if (!isNaN(lat) && !isNaN(lng)) {
        handleLocationSelect(lat, lng)
      }
    }
  }, [searchParams])

  const locateMe = () => {
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleLocationSelect(pos.coords.latitude, pos.coords.longitude)
        setIsLocating(false)
        toast.success('Location set to your current position')
      },
      () => {
        setIsLocating(false)
        toast.error('Could not get your location. Please select on the map.')
      }
    )
  }

  const onSubmit = async (data: ReportIncidentValues) => {
    try {
      // Backend automatically computes severity with Gemini LLM on create
      const incident = await createIncident(data)
      if (images.length > 0) {
        await uploadImages({ incidentId: incident.id, files: images })
      }

      setSubmittedIncident(incident)
      setShowSuccessDialog(true)

      const sev = (incident.severity || 'medium').toLowerCase()
      const formattedSev = sev.charAt(0).toUpperCase() + sev.slice(1)
      toast.success(`Incident reported! Assigned severity: ${formattedSev}`)
    } catch {
      // Error handled by api interceptor
    }
  }

  const isSubmitting = isCreating || isUploading
  const severityStyle = submittedIncident?.severity
    ? SEVERITY_STYLES[submittedIncident.severity.toLowerCase()] ?? SEVERITY_STYLES.medium
    : SEVERITY_STYLES.medium

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Report an Incident</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Provide details about the safety concern to alert the community.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardContent className="p-6 space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">1. Incident Details</h2>

            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="title">Title</label>
              <Input
                id="title"
                placeholder="Brief, descriptive title"
                error={errors.title?.message}
                {...register('title')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="category_id">Category</label>
              <SearchableCategorySelect
                id="category_id"
                value={watch('category_id')}
                onChange={(val) => setValue('category_id', val || '', { shouldValidate: true })}
                placeholder="Search and select category..."
                error={errors.category_id?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="description">Description</label>
              <Textarea
                id="description"
                placeholder="Provide as much detail as possible..."
                className="h-32"
                {...register('description')}
              />
              {errors.description && <p className="text-xs text-destructive mt-1">{errors.description.message}</p>}
            </div>

            {/* Severity notice (assessed upon submission) */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-muted-foreground/15 text-xs text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span>
                Incident severity is analyzed and determined by SafeCity AI after submission based on the complete incident context.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-lg font-semibold">2. Location</h2>
              <Button type="button" variant="outline" size="sm" onClick={locateMe} disabled={isLocating}>
                {isLocating
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Locating...</>
                  : <><MapPin className="w-4 h-4 mr-1" /> Use My Location</>}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">Click on the map to set the exact location.</p>

            <div className={`rounded-xl overflow-hidden border ${errors.location_lat ? 'border-destructive' : ''}`}>
              <IncidentMap
                incidents={[]}
                center={mapCenter}
                zoom={selectedLocation ? 14 : 5}
                height="300px"
                onLocationSelect={handleLocationSelect}
                selectedLocation={selectedLocation}
              />
            </div>
            {errors.location_lat && <p className="text-xs text-destructive text-center">Please select a location on the map.</p>}

            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="location_address">Address (Optional)</label>
              <Input
                id="location_address"
                placeholder="E.g., 123 Main St, Near Central Park"
                {...register('location_address')}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">3. Evidence &amp; Options</h2>

            <div>
              <label className="block text-sm font-medium mb-1.5">Images (Up to 5)</label>
              <div className="flex flex-wrap gap-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border group">
                    <img src={URL.createObjectURL(img)} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {images.length < 5 && (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:bg-accent transition-colors">
                    <ImageIcon className="w-6 h-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground font-medium">Add Image</span>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
              <input
                type="checkbox"
                id="is_anonymous"
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...register('is_anonymous')}
              />
              <div className="flex-1">
                <label htmlFor="is_anonymous" className="text-sm font-medium block">Report Anonymously</label>
                <p className="text-xs text-muted-foreground">
                  Your name will not be visible to the public or administrators. You will still receive status updates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
            {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </form>

      {/* Post-Submission Severity Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl">Incident Submitted Successfully</DialogTitle>
            <DialogDescription className="text-center">
              Your report has been recorded and broadcast to community safety feeds.
            </DialogDescription>
          </DialogHeader>

          {submittedIncident && (
            <div className="space-y-4 my-2">
              {/* Severity Card with AI Evaluation */}
              <div className={`p-4 rounded-xl border ${severityStyle.bg} ${severityStyle.border}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Determined Severity
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${severityStyle.bg} ${severityStyle.text}`}>
                    <span className={`w-2 h-2 rounded-full ${severityStyle.dot}`} />
                    {severityStyle.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Evaluated by SafeCity AI engine from the full situational context of your report.
                </p>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1 text-muted-foreground border">
                <p><strong className="text-foreground">Title:</strong> {submittedIncident.title}</p>
                {submittedIncident.location_address && (
                  <p><strong className="text-foreground">Location:</strong> {submittedIncident.location_address}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowSuccessDialog(false)
                setSubmittedIncident(null)
                reset()
                setImages([])
                setSelectedLocation(null)
              }}
            >
              Report Another
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (submittedIncident) {
                  navigate(`/incidents/${submittedIncident.id}`)
                }
              }}
            >
              View Incident Details
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
