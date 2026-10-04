export type UserRole = 'citizen' | 'admin';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'resolved_unverified'
  | 'resolved';
export type ResolutionStatus = 'pending' | 'approved' | 'rejected';

export interface ResolutionRequest {
  id: string;
  incident_id: string;
  requester_id?: string | null;
  requester?: User | null;
  explanation: string;
  evidence_url?: string | null;
  status: ResolutionStatus;
  reviewed_by_id?: string | null;
  reviewed_by?: User | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export interface IncidentStatusHistory {
  id: string;
  incident_id: string;
  from_status: string;
  to_status: string;
  changed_by_id?: string | null;
  changed_by?: User | null;
  reason?: string | null;
  created_at: string;
}

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
  sos_id?: string | null;
  metadata_json?: string | null;
  created_at: string;
}

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type SOSStatus = 'active' | 'resolved' | 'false_alarm';

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  contact_relation?: string | null;
  created_at: string;
  is_selected_for_sos?: boolean;
}

export interface EmergencyContactCreate {
  name: string;
  phone: string;
  contact_relation?: string | null;
}

export interface EmergencyContactUpdate {
  name?: string;
  phone?: string;
  contact_relation?: string | null;
}

export interface SOSRequest {
  id: string;
  user_id: string;
  location_lat: number;
  location_lng: number;
  status: SOSStatus;
  created_at: string;
  resolved_at?: string | null;
  audio_recording_url?: string | null;
  video_recording_url?: string | null;
}


export interface RouteIncident {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  lat: number;
  lng: number;
  category_icon: string;
  category_name: string;
  distance_meters?: number;
  is_verified?: boolean;
  is_route_relevant?: boolean;
  penalty_impact?: number;
}

export interface RouteRiskFactor {
  icon: string;
  name: string;
  count: number;
  total_penalty: number;
}

export interface RouteData {
  label?: string;
  geometry: string;
  distance_m: number;
  duration_s: number;
  safety_score: number;
  composite_score?: number;
  route_risk_level: 'safe' | 'moderate' | 'unsafe';
  relevant_incident_count?: number;
  incident_free?: boolean;
  explanation?: string;
  incidents: RouteIncident[];
  risk_factors?: RouteRiskFactor[];
}

export interface RoutePlanResponse {
  routes: RouteData[];
  recommended_route_idx: number;
  shortest_route_idx: number;
  safest_route_idx: number;
  clean_route_idx: number | null;
  avoidance_zone_count: number;
  avoidance_filtered_count: number;
  avoidance_warning: boolean;
}

