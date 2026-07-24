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
