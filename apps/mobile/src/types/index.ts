export type UserRole = 'citizen' | 'admin';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'resolved';

export interface UserProfile {
  id: string;
  user_id: string;
  avatar_url?: string | null;
  phone?: string | null;
  bio?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  city?: string | null;
  country?: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  profile?: UserProfile | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface IncidentCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon: string;
  color: string;
  is_active: boolean;
  created_at: string;
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
  category?: IncidentCategory | null;
  severity: SeverityLevel;
  status: IncidentStatus;
  is_anonymous: boolean;
  location_address?: string | null;
  location_lat: number;
  location_lng: number;
  admin_note?: string | null;
  images: IncidentImage[];
  reporter_id?: string | null;
  reporter?: User | null;
  created_at: string;
  updated_at: string;
}

export interface AreaSafetyTopCategory {
  name: string;
  icon: string;
  count: number;
}

export interface AreaSafetyScore {
  score: number;
  risk_level: 'safe' | 'moderate' | 'unsafe';
  incident_count: number;
  density_per_km2: number;
  top_categories: AreaSafetyTopCategory[];
  recent_7d: number;
  recent_30d: number;
}

export interface CommunityAlert {
  id: string;
  title: string;
  message: string;
  severity: SeverityLevel;
  category_id?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  radius_km?: number | null;
  is_active: boolean;
  expires_at?: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  incident_id?: string | null;
  created_at: string;
}

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
