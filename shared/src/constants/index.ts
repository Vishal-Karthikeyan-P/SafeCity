// ============================================================
// SafeCity — Shared Constants
// ============================================================

export const INCIDENT_CATEGORIES = [
  // --- Core Safety & Crime ---
  { id: 'crime', name: 'Crime', slug: 'crime', icon: '🚨', color: '#EF4444' },
  { id: 'theft_robbery', name: 'Theft & Robbery', slug: 'theft_robbery', icon: '👜', color: '#DC2626' },
  { id: 'assault_violence', name: 'Violence & Assault', slug: 'assault_violence', icon: '👊', color: '#B91C1C' },
  { id: 'harassment', name: 'Harassment & Stalking', slug: 'harassment', icon: '⚠️', color: '#F97316' },
  { id: 'suspicious_activity', name: 'Suspicious Activity', slug: 'suspicious_activity', icon: '👁️', color: '#EA580C' },
  { id: 'lost_and_found', name: 'Lost & Found', slug: 'lost_and_found', icon: '🔍', color: '#3B82F6' },
  { id: 'missing_person', name: 'Missing Person', slug: 'missing_person', icon: '👤', color: '#EF4444' },
  { id: 'missing_device', name: 'Missing Device / Phone', slug: 'missing_device', icon: '📱', color: '#6366F1' },
  { id: 'property_damage', name: 'Property Damage', slug: 'property_damage', icon: '🏚️', color: '#D97706' },
  { id: 'vandalism', name: 'Vandalism', slug: 'vandalism', icon: '🎨', color: '#B91C1C' },
  
  // --- Traffic & Vehicles ---
  { id: 'accident', name: 'Traffic Accident', slug: 'accident', icon: '🚗', color: '#EC4899' },
  { id: 'illegal_parking', name: 'Illegal Parking', slug: 'illegal_parking', icon: '🚫', color: '#DB2777' },
  { id: 'abandoned_vehicle', name: 'Abandoned Vehicle', slug: 'abandoned_vehicle', icon: '🚗', color: '#6B7280' },
  { id: 'vehicle_breakdown', name: 'Vehicle Breakdown', slug: 'vehicle_breakdown', icon: '🛠️', color: '#F59E0B' },
  { id: 'public_transport_issue', name: 'Public Transport Issue', slug: 'public_transport_issue', icon: '🚌', color: '#8B5CF6' },
  { id: 'road_signage_issue', name: 'Road Signage Issue', slug: 'road_signage_issue', icon: '🪧', color: '#D97706' },
  { id: 'traffic_signal_malfunction', name: 'Traffic Signal Malfunction', slug: 'traffic_signal_malfunction', icon: '🚦', color: '#EF4444' },
  { id: 'pedestrian_safety', name: 'Pedestrian Safety', slug: 'pedestrian_safety', icon: '🚸', color: '#10B981' },
  { id: 'blocked_footpath', name: 'Blocked Footpath / Sidewalk', slug: 'blocked_footpath', icon: '🚶', color: '#F59E0B' },
  { id: 'traffic_violation', name: 'Traffic Violation', slug: 'traffic_violation', icon: '🚫', color: '#DB2777' },
  { id: 'parking_obstruction', name: 'Parking Obstruction', slug: 'parking_obstruction', icon: '🚗', color: '#DB2777' },

  // --- Roads & Utilities ---
  { id: 'road_hazard', name: 'Road Hazard', slug: 'road_hazard', icon: '🚧', color: '#F59E0B' },
  { id: 'poor_lighting', name: 'Streetlight / Lighting Malfunction', slug: 'poor_lighting', icon: '💡', color: '#EAB308' },
  { id: 'drainage_flooding', name: 'Drainage & Flooding', slug: 'drainage_flooding', icon: '🌊', color: '#0284C7' },
  { id: 'water_leakage', name: 'Water Leakage', slug: 'water_leakage', icon: '💧', color: '#06B6D4' },
  { id: 'water_supply_issue', name: 'Water Supply Issue', slug: 'water_supply_issue', icon: '🚰', color: '#0284C7' },
  { id: 'sewage_issue', name: 'Sewage Issue', slug: 'sewage_issue', icon: '🚽', color: '#059669' },
  { id: 'gas_leak', name: 'Gas Leak', slug: 'gas_leak', icon: '⚠️', color: '#EA580C' },
  { id: 'electrical_outage', name: 'Electrical Outage', slug: 'electrical_outage', icon: '⚡', color: '#EAB308' },
  { id: 'utility_service_issue', name: 'Utility Service Issue', slug: 'utility_service_issue', icon: '🔧', color: '#64748B' },
  { id: 'missing_damaged_public_sign', name: 'Missing or Damaged Public Sign', slug: 'missing_damaged_public_sign', icon: '🪧', color: '#D97706' },

  // --- Infrastructure & Facilities ---
  { id: 'public_infrastructure', name: 'Public Infrastructure', slug: 'public_infrastructure', icon: '🏗️', color: '#8B5CF6' },
  { id: 'building_safety', name: 'Building Safety', slug: 'building_safety', icon: '🏢', color: '#8B5CF6' },
  { id: 'structural_damage', name: 'Structural Damage', slug: 'structural_damage', icon: '🏚️', color: '#D97706' },
  { id: 'construction_hazard', name: 'Construction Hazard', slug: 'construction_hazard', icon: '🏗️', color: '#F59E0B' },
  { id: 'unsafe_construction_site', name: 'Unsafe Construction Site', slug: 'unsafe_construction_site', icon: '⚠️', color: '#EF4444' },
  { id: 'elevator_failure', name: 'Elevator / Escalator Failure', slug: 'elevator_failure', icon: '🛗', color: '#64748B' },
  { id: 'broken_street_furniture', name: 'Broken Street Furniture', slug: 'broken_street_furniture', icon: '🪑', color: '#64748B' },
  { id: 'damaged_public_property', name: 'Damaged Public Property', slug: 'damaged_public_property', icon: '🏛️', color: '#8B5CF6' },
  { id: 'park_recreation_issue', name: 'Park & Recreation Issue', slug: 'park_recreation_issue', icon: '🏞️', color: '#10B981' },
  { id: 'playground_safety', name: 'Playground Safety', slug: 'playground_safety', icon: '🛝', color: '#10B981' },
  { id: 'public_toilet_issue', name: 'Public Toilet Issue', slug: 'public_toilet_issue', icon: '🚻', color: '#059669' },
  { id: 'government_facility_issue', name: 'Government Facility Issue', slug: 'government_facility_issue', icon: '🏛️', color: '#8B5CF6' },

  // --- Health, Sanitation & Environment ---
  { id: 'food_safety_concern', name: 'Food Safety Concern', slug: 'food_safety_concern', icon: '🍲', color: '#F97316' },
  { id: 'water_quality_concern', name: 'Water Quality Concern', slug: 'water_quality_concern', icon: '🧪', color: '#06B6D4' },
  { id: 'public_health_concern', name: 'Public Health Concern', slug: 'public_health_concern', icon: '🩺', color: '#0284C7' },
  { id: 'mental_health_welfare_concern', name: 'Mental Health / Welfare Concern', slug: 'mental_health_welfare_concern', icon: '🧠', color: '#8B5CF6' },
  { id: 'environmental_pollution', name: 'Environmental Pollution', slug: 'environmental_pollution', icon: '🏭', color: '#059669' },
  { id: 'air_pollution', name: 'Air Pollution', slug: 'air_pollution', icon: '🌫️', color: '#64748B' },
  { id: 'water_pollution', name: 'Water Pollution', slug: 'water_pollution', icon: '🧪', color: '#0284C7' },
  { id: 'chemical_spill', name: 'Chemical Spill', slug: 'chemical_spill', icon: '☣️', color: '#DC2626' },
  { id: 'hazardous_material', name: 'Hazardous Material', slug: 'hazardous_material', icon: '⚠️', color: '#EA580C' },
  { id: 'illegal_dumping', name: 'Illegal Dumping', slug: 'illegal_dumping', icon: '🗑️', color: '#059669' },
  { id: 'odor_foul_smell', name: 'Odor / Foul Smell', slug: 'odor_foul_smell', icon: '🦨', color: '#059669' },
  { id: 'smoke_air_quality', name: 'Smoke / Air Quality', slug: 'smoke_air_quality', icon: '💨', color: '#64748B' },
  { id: 'public_cleanliness_issue', name: 'Public Cleanliness Issue', slug: 'public_cleanliness_issue', icon: '🧹', color: '#059669' },

  // --- Animals & Hazards ---
  { id: 'animal_bite', name: 'Animal Bite', slug: 'animal_bite', icon: '🐕', color: '#EF4444' },
  { id: 'animal_welfare_concern', name: 'Animal Welfare Concern', slug: 'animal_welfare_concern', icon: '🐾', color: '#10B981' },
  { id: 'animal_noise', name: 'Animal Noise', slug: 'animal_noise', icon: '🐕', color: '#6366F1' },
  { id: 'insect_infestation', name: 'Insect / Mosquito Infestation', slug: 'insect_infestation', icon: '🦟', color: '#84CC16' },
  { id: 'animal_hazard', name: 'Stray Animals & Pest Hazard', slug: 'animal_hazard', icon: '🐕', color: '#10B981' },
  { id: 'tree_vegetation_hazard', name: 'Tree / Vegetation Hazard', slug: 'tree_vegetation_hazard', icon: '🌳', color: '#10B981' },
  { id: 'fallen_tree_branch', name: 'Fallen Tree / Branch', slug: 'fallen_tree_branch', icon: '🪵', color: '#D97706' },
  { id: 'wildlife_incident', name: 'Wildlife Incident', slug: 'wildlife_incident', icon: '🐍', color: '#10B981' },

  // --- Public Disturbance, Crowd & Events ---
  { id: 'public_disturbance', name: 'Public Disturbance & Noise', slug: 'public_disturbance', icon: '🔊', color: '#6366F1' },
  { id: 'noise_equipment_issue', name: 'Noise Equipment / Public Address Issue', slug: 'noise_equipment_issue', icon: '📢', color: '#6366F1' },
  { id: 'public_event_issue', name: 'Public Event Issue', slug: 'public_event_issue', icon: '🎪', color: '#8B5CF6' },
  { id: 'crowd_management', name: 'Crowd Management', slug: 'crowd_management', icon: '👥', color: '#EF4444' },
  { id: 'neighborhood_dispute', name: 'Neighborhood Dispute', slug: 'neighborhood_dispute', icon: '🏡', color: '#F59E0B' },
  { id: 'community_safety_concern', name: 'Community Safety Concern', slug: 'community_safety_concern', icon: '🛡️', color: '#10B981' },

  // --- Accessibility & Demographics ---
  { id: 'accessibility_issue', name: 'Accessibility Issue', slug: 'accessibility_issue', icon: '♿', color: '#3B82F6' },
  { id: 'disability_access_obstruction', name: 'Disability Access Obstruction', slug: 'disability_access_obstruction', icon: '♿', color: '#F97316' },
  { id: 'accessibility_mobility_issue', name: 'Accessibility / Mobility Issue', slug: 'accessibility_mobility_issue', icon: '🦯', color: '#3B82F6' },
  { id: 'child_safety_concern', name: 'Child Safety Concern', slug: 'child_safety_concern', icon: '👶', color: '#EF4444' },
  { id: 'elderly_safety_concern', name: 'Elderly Safety Concern', slug: 'elderly_safety_concern', icon: '👵', color: '#F59E0B' },

  // --- Digital & Cybersecurity ---
  { id: 'cybersecurity_incident', name: 'Cybersecurity Incident', slug: 'cybersecurity_incident', icon: '💻', color: '#6366F1' },
  { id: 'online_fraud_scam', name: 'Online Fraud / Scam', slug: 'online_fraud_scam', icon: '💳', color: '#DC2626' },
  { id: 'identity_theft', name: 'Identity Theft', slug: 'identity_theft', icon: '🪪', color: '#B91C1C' },
  { id: 'account_digital_abuse', name: 'Account / Digital Service Abuse', slug: 'account_digital_abuse', icon: '🔒', color: '#EF4444' },
  { id: 'privacy_concern', name: 'Privacy Concern', slug: 'privacy_concern', icon: '👁️', color: '#8B5CF6' },
  { id: 'data_security_incident', name: 'Data Security Incident', slug: 'data_security_incident', icon: '🛡️', color: '#3B82F6' },

  // --- Emergencies & Disasters ---
  { id: 'emergency', name: 'Emergency & Distress', slug: 'emergency', icon: '🆘', color: '#991B1B' },
  { id: 'medical_emergency', name: 'Medical Emergency', slug: 'medical_emergency', icon: '🚑', color: '#0284C7' },
  { id: 'fire_hazard', name: 'Fire & Electrical Hazard', slug: 'fire_hazard', icon: '🔥', color: '#D97706' },
  { id: 'beach_coastal_hazard', name: 'Beach / Coastal Hazard', slug: 'beach_coastal_hazard', icon: '🏖️', color: '#0284C7' },
  { id: 'flooding_waterlogging', name: 'Flooding / Waterlogging', slug: 'flooding_waterlogging', icon: '🌊', color: '#0284C7' },
  { id: 'extreme_weather_incident', name: 'Extreme Weather Incident', slug: 'extreme_weather_incident', icon: '🌩️', color: '#DC2626' },
  { id: 'disaster_natural_hazard', name: 'Disaster / Natural Hazard', slug: 'disaster_natural_hazard', icon: '🌋', color: '#B91C1C' },
  { id: 'evacuation_assistance', name: 'Evacuation Assistance', slug: 'evacuation_assistance', icon: '🏃', color: '#EF4444' },

  // --- Regulations & Other Services ---
  { id: 'service_disruption', name: 'Service Disruption', slug: 'service_disruption', icon: '⚠️', color: '#EA580C' },
  { id: 'public_service_complaint', name: 'Public Service Complaint', slug: 'public_service_complaint', icon: '📝', color: '#6B7280' },
  { id: 'unauthorized_construction', name: 'Unauthorized Construction', slug: 'unauthorized_construction', icon: '🏗️', color: '#D97706' },
  { id: 'illegal_advertising_posters', name: 'Illegal Advertising / Posters', slug: 'illegal_advertising_posters', icon: '📜', color: '#6B7280' },
  { id: 'encroachment_obstruction', name: 'Encroachment / Public Space Obstruction', slug: 'encroachment_obstruction', icon: '🚧', color: '#F97316' },
  { id: 'market_vendor_issue', name: 'Market / Vendor Regulation Issue', slug: 'market_vendor_issue', icon: '🏪', color: '#8B5CF6' },
  { id: 'other_service_related_issue', name: 'Other Service-Related Issue', slug: 'other_service_related_issue', icon: '📋', color: '#6B7280' },
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
