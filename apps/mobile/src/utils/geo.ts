/**
 * Geographic and Route Geometry Utilities
 * 
 * Provides:
 * - Polyline decoding (OSRM 5-decimal precision)
 * - Haversine distance calculations
 * - Accurate point-to-polyline cross-track distance for route deviation detection
 * - Distance and duration formatting
 */

/**
 * Decodes an encoded polyline string into an array of [latitude, longitude] coordinates.
 */
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded || typeof encoded !== 'string') return [];
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * Haversine formula to calculate the great-circle distance between two GPS coordinates in meters.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates the shortest distance in meters from a point P to a line segment AB.
 */
export function pointToSegmentDistanceMeters(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  // Convert lat/lon deltas to planar coordinates around the mean latitude
  const meanLatRad = (((aLat + bLat) / 2) * Math.PI) / 180;
  const cosMean = Math.cos(meanLatRad);

  // dx, dy in degrees scaled by longitude compression
  const segDx = (bLon - aLon) * cosMean;
  const segDy = bLat - aLat;
  const segLenSq = segDx * segDx + segDy * segDy;

  if (segLenSq === 0) {
    // A and B are the same point
    return haversineMeters(pLat, pLon, aLat, aLon);
  }

  // Vector AP
  const apDx = (pLon - aLon) * cosMean;
  const apDy = pLat - aLat;

  // Project AP onto AB: t in [0, 1]
  const t = Math.max(0, Math.min(1, (apDx * segDx + apDy * segDy) / segLenSq));

  // Closest point coordinates on segment AB
  const closestLat = aLat + t * (bLat - aLat);
  const closestLon = aLon + t * (bLon - aLon);

  return haversineMeters(pLat, pLon, closestLat, closestLon);
}

/**
 * Calculates the minimum distance in meters between a user's location and any segment of a route.
 */
export function getDistanceFromRoute(
  userPoint: { latitude: number; longitude: number },
  routePoints: [number, number][]
): number {
  if (!routePoints || routePoints.length === 0) return Infinity;
  if (routePoints.length === 1) {
    return haversineMeters(
      userPoint.latitude,
      userPoint.longitude,
      routePoints[0][0],
      routePoints[0][1]
    );
  }

  let minDistance = Infinity;

  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i];
    const p2 = routePoints[i + 1];
    const dist = pointToSegmentDistanceMeters(
      userPoint.latitude,
      userPoint.longitude,
      p1[0],
      p1[1],
      p2[0],
      p2[1]
    );

    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

/**
 * Threshold in meters beyond which a user is considered significantly off-route.
 * 65 meters accommodates typical mobile GPS accuracy variance (10-25m in urban areas)
 * while promptly detecting true deviations from the selected corridor.
 */
export const OFF_ROUTE_THRESHOLD_METERS = 65;

/**
 * Checks if the user has deviated significantly from the active route.
 */
export function isDeviatedFromRoute(
  userPoint: { latitude: number; longitude: number },
  routePoints: [number, number][],
  thresholdMeters: number = OFF_ROUTE_THRESHOLD_METERS
): { isOffRoute: boolean; deviationDistanceMeters: number } {
  const dist = getDistanceFromRoute(userPoint, routePoints);
  return {
    isOffRoute: dist > thresholdMeters,
    deviationDistanceMeters: Math.round(dist),
  };
}

/**
 * Formats distance in meters to a readable string (e.g., "650 m", "4.2 km").
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Formats duration in seconds to a human-readable ETA (e.g., "8 min", "1h 15m").
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${Math.max(1, totalMinutes)} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}
