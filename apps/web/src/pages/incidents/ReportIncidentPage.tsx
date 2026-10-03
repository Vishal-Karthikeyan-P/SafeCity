import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Image as ImageIcon, X, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { IncidentMap } from '@/components/map/IncidentMap'
import { useCreateIncident, useUploadImages, usePreviewSeverity, previewSeverity } from '@/api/incidents'
import { SearchableCategorySelect } from '@/components/incidents/SearchableCategorySelect'
import { reportIncidentSchema, type ReportIncidentValues } from '@/lib/schemas'
import { toast } from 'sonner'

// Severity appearance helpers
const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  low: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Low' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Medium' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'High' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Critical' },
}

function useDebouncedValue<T>(value: T, delay = 600): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function SeverityPreviewBadge({ severity, score, loading }: { severity?: string; score?: number; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm text-muted-foreground animate-pulse">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Calculating severity...
      </div>
    )
  }
  if (!severity) return null
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${style.bg} ${style.text}`}>
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      <Sparkles className="w-3.5 h-3.5 opacity-60" />
      Auto-detected severity: <strong>{style.label}</strong>
      {score != null && <span className="opacity-60 text-xs ml-1">(score {score})</span>}
    </div>
  )
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReportIncidentValues>({
    resolver: zodResolver(reportIncidentSchema),
    defaultValues: {
      is_anonymous: false,
    },
  })

  // Watch fields for live severity preview
  const watchedCategoryId = watch('category_id')
  const watchedTitle = watch('title') ?? ''
  const watchedDescription = watch('description') ?? ''

  // Category changes fire immediately; title/description wait until typing pauses.
  const debouncedTitle = useDebouncedValue(watchedTitle.trim())
  const debouncedDescription = useDebouncedValue(watchedDescription.trim())
  const isTyping =
    watchedTitle.trim() !== debouncedTitle || watchedDescription.trim() !== debouncedDescription

  const { data: severityPreview, isFetching: isSeverityLoading } = usePreviewSeverity(
    watchedCategoryId,
    debouncedTitle,
    debouncedDescription,
  )

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
      // Final classification with the exact submitted values (the live preview may lag by the debounce)
      try {
        const final = await previewSeverity(data.category_id, data.title, data.description)
        if (final?.severity) toast.info(`Final severity: ${final.severity.charAt(0).toUpperCase()}${final.severity.slice(1)}`)
      } catch {
        // Preview failure must not block submission; the backend still classifies on create.
      }

      // severity is NOT sent — backend auto-computes it
      const incident = await createIncident(data)
      if (images.length > 0) {
        await uploadImages({ incidentId: incident.id, files: images })
      }
      navigate(`/incidents/${incident.id}`)
    } catch (err) {
      // Error handled by api interceptor
    }
  }

  const isSubmitting = isCreating || isUploading

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

            {/* Auto-Severity Preview */}
            {(watchedCategoryId && watchedTitle.length >= 3) && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  System-Determined Severity
                </p>
                <div className={isSeverityLoading || isTyping ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                  <SeverityPreviewBadge
                    severity={severityPreview?.severity}
                    score={severityPreview?.score}
                    loading={(isSeverityLoading || isTyping) && !severityPreview}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Severity is automatically calculated based on category, title, and description.
                </p>
              </div>
            )}
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
    </div>
  )
}
