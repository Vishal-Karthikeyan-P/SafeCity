// ============================================================
// SafeCity — Shared Constants
// ============================================================

export const INCIDENT_CATEGORIES = [
  { id: 'crime', name: 'Crime', slug: 'crime', icon: '🚨', color: '#EF4444' },
  { id: 'harassment', name: 'Harassment', slug: 'harassment', icon: '⚠️', color: '#F97316' },
  { id: 'poor_lighting', name: 'Poor Lighting', slug: 'poor_lighting', icon: '💡', color: '#EAB308' },
  { id: 'road_hazard', name: 'Road Hazard', slug: 'road_hazard', icon: '🚧', color: '#F59E0B' },
  { id: 'accident', name: 'Accident', slug: 'accident', icon: '🚗', color: '#EC4899' },
  { id: 'public_infrastructure', name: 'Public Infrastructure', slug: 'public_infrastructure', icon: '🏗️', color: '#8B5CF6' },
  { id: 'emergency', name: 'Emergency', slug: 'emergency', icon: '🆘', color: '#DC2626' },
  { id: 'other', name: 'Other', slug: 'other', icon: '📋', color: '#6B7280' },
] as const;

export const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: '#22C55E', bg: '#DCFCE7' },
  { value: 'medium', label: 'Medium', color: '#F59E0B', bg: '#FEF3C7' },
  { value: 'high', label: 'High', color: '#F97316', bg: '#FFEDD5' },
  { value: 'critical', label: 'Critical', color: '#EF4444', bg: '#FEE2E2' },
] as const;

export const INCIDENT_STATUSES = [
  { value: 'pending', label: 'Pending', color: '#6B7280' },
  { value: 'under_review', label: 'Under Review', color: '#3B82F6' },
  { value: 'approved', label: 'Approved', color: '#22C55E' },
  { value: 'rejected', label: 'Rejected', color: '#EF4444' },
  { value: 'resolved', label: 'Resolved', color: '#10B981' },
] as const;

export const DEFAULT_LOCATION = {
  lat: 40.7128,
  lng: -74.006,
  zoom: 12,
};

export const NEARBY_RADIUS_OPTIONS = [
  { value: 1, label: '1 km' },
  { value: 2, label: '2 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 20, label: '20 km' },
];

export const PAGE_SIZE = 10;

export const MAX_IMAGES_PER_INCIDENT = 5;
export const MAX_IMAGE_SIZE_MB = 10;
