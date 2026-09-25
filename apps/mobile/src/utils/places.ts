import * as Location from 'expo-location';

export interface PlacePreset {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  icon: string;
}

/**
 * Curated key hubs and popular destinations in Coimbatore for instant selection.
 */
export const COIMBATORE_PRESETS: PlacePreset[] = [
  {
    id: 'gandhipuram',
    name: 'Gandhipuram Central Bus Stand',
    category: 'Transit',
    subtitle: 'Cross Cut Road, Gandhipuram',
    latitude: 11.0168,
    longitude: 76.9674,
    icon: 'bus',
  },
  {
    id: 'railway_junction',
    name: 'Coimbatore Railway Junction',
    category: 'Transit',
    subtitle: 'State Bank Road, Gopalapuram',
    latitude: 10.9984,
    longitude: 76.9634,
    icon: 'train',
  },
  {
    id: 'brookefields',
    name: 'Brookefields Mall',
    category: 'Shopping',
    subtitle: 'Dr Krishnasamy Mudaliar Rd, Sukrawar Pettai',
    latitude: 11.0094,
    longitude: 76.9558,
    icon: 'cart',
  },
  {
    id: 'fun_republic',
    name: 'Fun Republic Mall',
    category: 'Shopping',
    subtitle: 'Avinashi Road, Peelamedu',
    latitude: 11.0261,
    longitude: 77.0028,
    icon: 'cart',
  },
  {
    id: 'psg_tech',
    name: 'PSG College of Technology',
    category: 'Education',
    subtitle: 'Avinashi Road, Peelamedu',
    latitude: 11.0247,
    longitude: 77.0033,
    icon: 'school',
  },
  {
    id: 'rs_puram',
    name: 'RS Puram (DB Road)',
    category: 'Commercial',
    subtitle: 'Diwan Bahadur Road, RS Puram',
    latitude: 11.0086,
    longitude: 76.9452,
    icon: 'business',
  },
  {
    id: 'race_course',
    name: 'Race Course Promenade',
    category: 'Recreation',
    subtitle: 'Race Course Road, Gopalapuram',
    latitude: 11.0022,
    longitude: 76.9744,
    icon: 'walk',
  },
  {
    id: 'airport',
    name: 'Coimbatore International Airport',
    category: 'Transit',
    subtitle: 'Civil Aerodrome Post, Peelamedu',
    latitude: 11.0298,
    longitude: 77.0434,
    icon: 'airplane',
  },
  {
    id: 'singanallur',
    name: 'Singanallur Bus Terminal',
    category: 'Transit',
    subtitle: 'Trichy Road, Singanallur',
    latitude: 10.9991,
    longitude: 77.0262,
    icon: 'bus',
  },
  {
    id: 'ukkadam',
    name: 'Ukkadam Bus Stand',
    category: 'Transit',
    subtitle: 'Palakkad Main Road, Ukkadam',
    latitude: 10.9892,
    longitude: 76.9592,
    icon: 'bus',
  },
  {
    id: 'saravanampatti',
    name: 'Saravanampatti Tech Zone',
    category: 'Commercial',
    subtitle: 'Sathy Road / CHIL SEZ, Saravanampatti',
    latitude: 11.0797,
    longitude: 76.9994,
    icon: 'laptop',
  },
  {
    id: 'town_hall',
    name: 'Town Hall / Clock Tower',
    category: 'Heritage',
    subtitle: 'Raja Street, Town Hall',
    latitude: 10.9961,
    longitude: 76.9602,
    icon: 'time',
  },
];

/**
 * Searches places by matching preset catalog or querying expo-location geocoder.
 */
export async function searchPlaces(
  query: string
): Promise<Array<{ id: string; name: string; subtitle: string; latitude: number; longitude: number }>> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return COIMBATORE_PRESETS.map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: p.subtitle,
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  }

  // 1. Filter local presets first (instant results)
  const matchedPresets = COIMBATORE_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(trimmed) ||
      p.subtitle.toLowerCase().includes(trimmed) ||
      p.category.toLowerCase().includes(trimmed)
  ).map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: p.subtitle,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  if (matchedPresets.length >= 3) {
    return matchedPresets;
  }

  // 2. Fallback to geocoding via expo-location if query is long enough
  try {
    const searchQuery = trimmed.includes('coimbatore') ? trimmed : `${trimmed}, Coimbatore`;
    const geoResults = await Location.geocodeAsync(searchQuery);

    if (geoResults && geoResults.length > 0) {
      const geoPlaces = geoResults.slice(0, 3).map((res, index) => ({
        id: `geo-${index}-${res.latitude.toFixed(4)}`,
        name: query.trim(),
        subtitle: `Lat: ${res.latitude.toFixed(4)}, Lng: ${res.longitude.toFixed(4)}`,
        latitude: res.latitude,
        longitude: res.longitude,
      }));

      // Combine preset matches and geocoded results without duplicates
      const combined = [...matchedPresets];
      for (const gp of geoPlaces) {
        if (!combined.some((c) => Math.abs(c.latitude - gp.latitude) < 0.001 && Math.abs(c.longitude - gp.longitude) < 0.001)) {
          combined.push(gp);
        }
      }
      return combined;
    }
  } catch {
    // If geocoding fails (e.g. offline/network), return whatever preset matched
  }

  return matchedPresets;
}
