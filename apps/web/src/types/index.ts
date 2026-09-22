// Re-export all types from shared package (inline for simplicity in web app)

export type UserRole = 'citizen' | 'admin'
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'resolved'
export type NotificationType = 'incident_update' | 'system' | 'alert' | 'admin_message'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  is_verified: boolean
  created_at: string
  updated_at: string
  profile?: UserProfile | null
}

export interface UserProfile {
  id: string
  user_id: string
  avatar_url?: string | null
  phone?: string | null
  bio?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  city?: string | null
  country?: string | null
  created_at: string
  updated_at: string
}

export interface IncidentCategory {
  id: string
  name: string
  slug: string
  description?: string | null
  icon: string
  color: string
  is_active: boolean
  created_at: string
}

export interface IncidentImage {
  id: string
  incident_id: string
  url: string
  filename: string
  created_at: string
}

export interface Incident {
  id: string
  title: string
  description: string
  category_id: string
  category: IncidentCategory
  severity: SeverityLevel
  status: IncidentStatus
  is_anonymous: boolean
  location_address?: string | null
  location_lat: number
  location_lng: number
  admin_note?: string | null
  images: IncidentImage[]
  reporter_id?: string | null
  reporter?: User | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  incident_id?: string | null
  created_at: string
}

export interface IncidentFilters {
  category_id?: string
  severity?: SeverityLevel
  status?: IncidentStatus
  date_from?: string
  date_to?: string
  search?: string
  sort_by?: string
  lat?: number
  lng?: number
  radius_km?: number
  page?: number
  limit?: number
}

export interface AdminStats {
  total_incidents: number
  pending: number
  under_review: number
  approved: number
  rejected: number
  resolved: number
  by_category: Record<string, number>
  by_severity: Record<string, number>
  last_30_days: number
  total_users: number
  active_users: number
  new_users_this_month: number
}

export interface RouteIncident {
  id: string
  title: string
  description: string
  severity: SeverityLevel
  lat: number
  lng: number
  category_icon: string
  category_name: string
  distance_meters?: number
  is_verified?: boolean
  is_route_relevant?: boolean
  penalty_impact?: number
}

/** Top incident category contributing to route risk */
export interface RouteRiskFactor {
  icon: string
  name: string
  count: number
  total_penalty: number
}

export interface RouteData {
  /** Human-readable label e.g. "Shortest", "Alternative 1", "Northern Detour" */
  label?: string
  geometry: string
  distance_m: number
  duration_s: number
  safety_score: number
  /** Balanced composite score (safety 65% + distance 20% + duration 15%) */
  composite_score?: number
  route_risk_level: 'safe' | 'moderate' | 'unsafe'
  relevant_incident_count?: number
  /** True when zero route-relevant incidents lie within the scoring buffer */
  incident_free?: boolean
  explanation?: string
  incidents: RouteIncident[]
  /** Top incident categories driving route risk */
  risk_factors?: RouteRiskFactor[]
}

export interface RoutePlanResponse {
  routes: RouteData[]
  recommended_route_idx: number
  shortest_route_idx: number
  safest_route_idx: number
  /** Index (in routes[]) of the first incident-free route by composite rank, or null */
  clean_route_idx: number | null
  /** Number of HIGH/CRITICAL incidents that created avoidance zones */
  avoidance_zone_count: number
  /** Number of candidate routes rejected by the avoidance filter */
  avoidance_filtered_count: number
  /** true when every candidate was filtered and a fallback pool was used */
  avoidance_warning: boolean
}

export interface HeatmapFilters {
  category_id?: string
  severity?: string
  date_from?: string
  date_to?: string
}

export interface AreaSafetyTopCategory {
  name: string
  icon: string
  count: number
}

export interface AreaSafetyScore {
  score: number
  risk_level: 'safe' | 'moderate' | 'unsafe'
  incident_count: number
  density_per_km2: number
  top_categories: AreaSafetyTopCategory[]
  recent_7d: number
  recent_30d: number
}

export interface CityRecentIncident {
  id: string
  title: string
  severity: SeverityLevel
  category_name: string
  category_icon: string
  created_at: string
  lat: number
  lng: number
}

export interface CitySafetyOverview {
  score: number
  risk_level: 'safe' | 'moderate' | 'unsafe'
  total_incident_count: number
  top_category: AreaSafetyTopCategory | null
  all_categories: AreaSafetyTopCategory[]
  recent_incidents: CityRecentIncident[]
  recent_7d_count: number
}
