import { useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Search, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IncidentCard } from "@/components/incidents/IncidentCard"
import { useMyIncidents } from "@/api/incidents"

export function MyIncidentsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useMyIncidents(page, 12)

  const incidents = data?.items ?? []
  const totalPages = data?.pages ?? 1
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {total} report{total !== 1 ? "s" : ""} submitted by you
          </p>
        </div>
        <Button asChild id="new-incident-btn">
          <Link to="/incidents/new">
            <Plus className="w-4 h-4 mr-1" />
            New Report
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-64 w-full" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
          <p className="text-muted-foreground mb-6">You have not submitted any incident reports yet.</p>
          <Button asChild>
            <Link to="/incidents/new">Report Your First Incident</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {incidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)} id="prev-page-btn">Previous</Button>
              <span className="text-sm text-muted-foreground px-4">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} id="next-page-btn">Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
