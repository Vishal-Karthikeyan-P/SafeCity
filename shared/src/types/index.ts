// ============================================================
// SafeCity — Shared TypeScript Types
// Used by both web (apps/web) and mobile (apps/mobile)
// ============================================================

// ---------- Auth ----------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

// ---------- Users ----------

export type UserRole = 'citizen' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithProfile extends User {
  profile: UserProfile | null;
}

export interface UpdateProfileRequest {
  full_name?: string;
  phone?: string;
  bio?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  city?: string;
  country?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// ---------- Categories ----------

export interface IncidentCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

// ---------- Incidents ----------

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'resolved';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface IncidentImage {
  id: string;
  incident_id: string;
  url: string;
  filename: string;
  created_at: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  category_id: string;
  category: IncidentCategory;
  severity: SeverityLevel;
  status: IncidentStatus;
  is_anonymous: boolean;
  location_address: string | null;
  location_lat: number;
  location_lng: number;
  images: IncidentImage[];
  reporter_id: string | null;
  reporter: User | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateIncidentRequest {
  title: string;
  description: string;
  category_id: string;
  severity: SeverityLevel;
  is_anonymous: boolean;
  location_address?: string;
  location_lat: number;
  location_lng: number;
}

export interface UpdateIncidentStatusRequest {
  status: IncidentStatus;
  admin_note?: string;
}

// ---------- Filters ----------

export interface IncidentFilters {
  category_id?: string;
  severity?: SeverityLevel;
  status?: IncidentStatus;
  date_from?: string;
  date_to?: string;
  search?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
  page?: number;
  limit?: number;
}

// ---------- Pagination ----------

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ---------- Notifications ----------

export type NotificationType = 'incident_update' | 'system' | 'alert' | 'admin_message';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  incident_id: string | null;
  created_at: string;
}

// ---------- Statistics ----------

export interface IncidentStats {
  total: number;
  pending: number;
  under_review: number;
  approved: number;
  rejected: number;
  resolved: number;
  by_category: Record<string, number>;
  by_severity: Record<SeverityLevel, number>;
  last_30_days: number;
}

export interface AdminStats extends IncidentStats {
  total_users: number;
  active_users: number;
  new_users_this_month: number;
}

// ---------- API Response ----------

export interface ApiError {
  detail: string;
  status_code?: number;
}
