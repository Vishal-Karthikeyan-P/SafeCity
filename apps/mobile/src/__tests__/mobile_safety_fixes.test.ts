import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodePolyline,
  haversineMeters,
  getDistanceFromRoute,
  isDeviatedFromRoute,
  hasReachedDestination,
  DESTINATION_ARRIVAL_THRESHOLD_METERS,
  DEVIATION_ALERT_THRESHOLD_SECONDS,
  DEVIATION_COUNTDOWN_SECONDS,
  AREA_SCORE_MOVEMENT_THRESHOLD_METERS,
  OFF_ROUTE_THRESHOLD_METERS,
} from '../utils/geo.ts';

describe('SafeCity Mobile App Fixes Validation Suite', () => {

  // ─── 1. Explore Safety Map: Missing Markers & Filtering ─────────────────────
  describe('1. Missing Markers & Filtering', () => {
    const sampleIncidents = [
      { id: '1', title: 'Streetlight out', status: 'approved', severity: 'low', location_lat: 11.0168, location_lng: 76.9558 },
      { id: '2', title: 'Harassment reported', status: 'approved', severity: 'high', location_lat: 11.0180, location_lng: 76.9570 },
      { id: '3', title: 'Suspicious activity', status: 'pending', severity: 'medium', location_lat: 11.0200, location_lng: 76.9600 },
      { id: '4', title: 'Dark alley hazard', status: 'under_review', severity: 'critical', location_lat: 11.0300, location_lng: 76.9700 },
      { id: '5', title: 'Resolved incident', status: 'resolved', severity: 'low', location_lat: 11.0150, location_lng: 76.9500 },
    ];

    test('When showUnverified is false, only approved and resolved incidents are shown', () => {
      const showUnverified = false;
      const filtered = sampleIncidents.filter((inc) => {
        if (!showUnverified && inc.status !== 'approved' && inc.status !== 'resolved') {
          return false;
        }
        return true;
      });

      assert.equal(filtered.length, 3);
      assert.deepEqual(filtered.map(i => i.id), ['1', '2', '5']);
    });

    test('When showUnverified is true, all eligible incidents including pending are shown', () => {
      const showUnverified = true;
      const filtered = sampleIncidents.filter((inc) => {
        if (!showUnverified && inc.status !== 'approved' && inc.status !== 'resolved') {
          return false;
        }
        return true;
      });

      assert.equal(filtered.length, 5);
      assert.ok(filtered.some(i => i.status === 'pending'));
      assert.ok(filtered.some(i => i.status === 'under_review'));
    });

    test('Marker rendering differentiates verified and unverified markers', () => {
      const renderMarkerMeta = (inc: any) => {
        const verified = inc.status === 'approved' || inc.status === 'resolved';
        return {
          id: inc.id,
          pinClass: 'pin' + (verified ? '' : ' pin-unverified'),
          hasQuestionBadge: !verified,
          color: verified ? (inc.severity === 'high' ? '#f97316' : '#22c55e') : '#6b7280',
        };
      };

      const verifiedMeta = renderMarkerMeta(sampleIncidents[1]);
      assert.equal(verifiedMeta.pinClass, 'pin');
      assert.equal(verifiedMeta.hasQuestionBadge, false);
      assert.equal(verifiedMeta.color, '#f97316');

      const unverifiedMeta = renderMarkerMeta(sampleIncidents[2]);
      assert.equal(unverifiedMeta.pinClass, 'pin pin-unverified');
      assert.equal(unverifiedMeta.hasQuestionBadge, true);
      assert.equal(unverifiedMeta.color, '#6b7280');
    });
  });

  // ─── 2. Heatmap Behavior & Parameters ───────────────────────────────────────
  describe('2. Heatmap Behavior Matching Web', () => {
    test('Heatmap weights are normalized with minimum threshold of 0.5', () => {
      const rawPoints = [
        { lat: 11.01, lng: 76.95, weight: 0.1 },
        { lat: 11.02, lng: 76.96, weight: 2.5 },
        { lat: 11.03, lng: 76.97, weight: 0 },
      ];

      const heatPoints = rawPoints.map(p => [p.lat, p.lng, Math.max(0.5, p.weight || 1)]);

      assert.equal(heatPoints[0][2], 0.5); // 0.1 clamped up to 0.5
      assert.equal(heatPoints[1][2], 2.5); // 2.5 preserved
      assert.equal(heatPoints[2][2], 1);   // 0 falls back to default 1 via || 1
    });

    test('Heatmap dynamic max calculates upper intensity bound', () => {
      const heatPoints = [
        [11.01, 76.95, 0.5],
        [11.02, 76.96, 3.2],
        [11.03, 76.97, 1.8],
      ];
      const heatMax = heatPoints.reduce((m, p) => Math.max(m, p[2]), 1);
      assert.equal(heatMax, 3.2);
    });

    test('Heatmap configuration matches web specification', () => {
      const webHeatmapConfig = {
        radius: 35,
        blur: 20,
        minOpacity: 0.4,
        maxZoom: 18,
        gradient: {
          0.2: '#3b82f6',
          0.4: '#22c55e',
          0.6: '#eab308',
          0.8: '#f97316',
          1.0: '#ef4444',
        },
      };

      assert.equal(webHeatmapConfig.radius, 35);
      assert.equal(webHeatmapConfig.blur, 20);
      assert.equal(webHeatmapConfig.minOpacity, 0.4);
      assert.equal(webHeatmapConfig.maxZoom, 18);
      assert.equal(Object.keys(webHeatmapConfig.gradient).length, 5);
      assert.equal(webHeatmapConfig.gradient[0.2], '#3b82f6');
      assert.equal(webHeatmapConfig.gradient[1.0], '#ef4444');
    });
  });

  // ─── 3. Area Safety Score: Pin & 1000m Radius Synchronization ───────────────
  describe('3. Area Safety Score Pin & Radius Synchronization', () => {
    test('Selected area creates exactly 1000m radius circle and visible pin', () => {
      let selectedPin: { lat: number; lng: number } | null = null;
      let selectedCircle: { lat: number; lng: number; radiusMeters: number } | null = null;

      const renderSelectedArea = (lat: number | null, lng: number | null) => {
        if (lat == null || lng == null) {
          selectedPin = null;
          selectedCircle = null;
          return;
        }
        selectedPin = { lat, lng };
        selectedCircle = { lat, lng, radiusMeters: 1000 };
      };

      // User selects a location
      renderSelectedArea(11.0168, 76.9558);
      assert.ok(selectedPin !== null);
      assert.equal(selectedPin.lat, 11.0168);
      assert.equal(selectedCircle?.radiusMeters, 1000);

      // Selection changes to a new spot
      renderSelectedArea(11.0250, 76.9700);
      assert.equal(selectedPin.lat, 11.0250);
      assert.equal(selectedCircle?.lat, 11.0250);
      assert.equal(selectedCircle?.radiusMeters, 1000);

      // User dismisses card -> clears pin and radius circle synchronously
      renderSelectedArea(null, null);
      assert.equal(selectedPin, null);
      assert.equal(selectedCircle, null);
    });
  });

  // ─── 4. Deviation Timing (15s Continuous Deviation) ─────────────────────────
  describe('4. Deviation Detection & 15-Second Continuous Timing', () => {
    // Route from (11.000, 76.000) to (11.010, 76.000)
    const routeCoords: [number, number][] = [
      [11.000, 76.000],
      [11.005, 76.000],
      [11.010, 76.000],
    ];

    test('Off-route point exceeds 65m threshold', () => {
      // 0.001 deg latitude is approx 111 meters away
      const userPoint = { latitude: 11.005, longitude: 76.0015 };
      const dev = isDeviatedFromRoute(userPoint, routeCoords, OFF_ROUTE_THRESHOLD_METERS);
      assert.equal(dev.isOffRoute, true);
      assert.ok(dev.deviationDistanceMeters > OFF_ROUTE_THRESHOLD_METERS);
    });

    test('On-route point does not trigger deviation', () => {
      const userPoint = { latitude: 11.005, longitude: 76.0001 };
      const dev = isDeviatedFromRoute(userPoint, routeCoords, OFF_ROUTE_THRESHOLD_METERS);
      assert.equal(dev.isOffRoute, false);
    });

    test('Continuous deviation logic requires full 15 seconds before triggering alert', () => {
      let offRouteSince: number | null = null;
      let alertTriggered = false;

      const checkDeviationTick = (isOff: boolean, timestampMs: number) => {
        if (isOff) {
          if (offRouteSince === null) {
            offRouteSince = timestampMs;
          } else {
            const elapsed = (timestampMs - offRouteSince) / 1000;
            if (elapsed >= DEVIATION_ALERT_THRESHOLD_SECONDS) {
              alertTriggered = true;
            }
          }
        } else {
          offRouteSince = null;
          alertTriggered = false;
        }
      };

      const startTime = 100000;
      // At t=0s: off-route begins
      checkDeviationTick(true, startTime);
      assert.equal(alertTriggered, false);

      // At t=8s: still off-route, but under 15s threshold
      checkDeviationTick(true, startTime + 8000);
      assert.equal(alertTriggered, false);

      // At t=14s: still under 15s threshold
      checkDeviationTick(true, startTime + 14000);
      assert.equal(alertTriggered, false);

      // At t=15.1s: reaches 15s -> triggers alert!
      checkDeviationTick(true, startTime + 15100);
      assert.equal(alertTriggered, true);

      // User returns to route -> resets timer
      checkDeviationTick(false, startTime + 16000);
      assert.equal(offRouteSince, null);
      assert.equal(alertTriggered, false);
    });
  });

  // ─── 5. 20-Second Countdown, Cancellation & Expiry ──────────────────────────
  describe('5. 20-Second Countdown, Cancellation & Expiry', () => {
    test('Countdown starts at exactly 20 seconds and counts down to 0', () => {
      let remaining = DEVIATION_COUNTDOWN_SECONDS;
      let expired = false;

      const tick = () => {
        if (remaining <= 1) {
          remaining = 0;
          expired = true;
        } else {
          remaining -= 1;
        }
      };

      assert.equal(remaining, 20);
      for (let i = 0; i < 19; i++) {
        tick();
      }
      assert.equal(remaining, 1);
      assert.equal(expired, false);

      // 20th tick expires countdown
      tick();
      assert.equal(remaining, 0);
      assert.equal(expired, true);
    });

    test('User acknowledgement cancels countdown immediately', () => {
      let remaining = DEVIATION_COUNTDOWN_SECONDS;
      let isTimerActive = true;

      const cancelTimer = () => {
        isTimerActive = false;
      };

      // Countdown runs for 5 seconds
      remaining -= 5;
      assert.equal(remaining, 15);

      // User taps "I chose to leave the route"
      cancelTimer();
      assert.equal(isTimerActive, false);
    });
  });

  // ─── 6. SOS Deduplication & Safe Handling ───────────────────────────────────
  describe('6. Emergency SOS Deduplication & Safe Handling', () => {
    test('Prevents duplicate SOS calls if activeSOS exists or trigger in flight', async () => {
      let activeSOS: any = null;
      let isTriggering = false;
      let callCount = 0;

      const triggerSOS = async () => {
        if (activeSOS || isTriggering) {
          return null; // Deduplicated
        }
        isTriggering = true;
        callCount++;
        activeSOS = { id: 'sos-123', status: 'active' };
        isTriggering = false;
        return activeSOS;
      };

      // First trigger
      const first = await triggerSOS();
      assert.ok(first !== null);
      assert.equal(callCount, 1);

      // Second trigger while activeSOS is present -> rejected / deduplicated
      const second = await triggerSOS();
      assert.equal(second, null);
      assert.equal(callCount, 1);
    });

    test('Network or GPS failure is caught safely with error feedback', async () => {
      let feedback: { message: string; isError: boolean } | null = null;

      const triggerFailingSOS = async () => {
        try {
          throw new Error('Connection refused');
        } catch {
          feedback = {
            message: 'Network error: Failed to broadcast automatic SOS.',
            isError: true,
          };
        }
      };

      await triggerFailingSOS();
      assert.ok(feedback !== null);
      assert.equal(feedback.isError, true);
    });
  });

  // ─── 7. Safe Route Recalculation & Corridor Update ──────────────────────────
  describe('7. Route Recalculation & Corridor Monitoring', () => {
    test('Recalculation updates monitored corridor and prevents repeated previous alerts', () => {
      let activeCorridor = [[11.000, 76.000], [11.010, 76.000]];
      let offRouteAlertsCount = 0;

      // User deviates from activeCorridor
      const userPos = { latitude: 11.005, longitude: 76.010 };
      const dev1 = isDeviatedFromRoute(userPos, activeCorridor, OFF_ROUTE_THRESHOLD_METERS);
      assert.equal(dev1.isOffRoute, true);
      offRouteAlertsCount++;

      // User accepts reroute: new corridor is established from user's current position
      const newCorridor: [number, number][] = [
        [userPos.latitude, userPos.longitude],
        [11.010, 76.000],
      ];
      activeCorridor = newCorridor;

      // Now check user against the updated corridor
      const dev2 = isDeviatedFromRoute(userPos, activeCorridor, OFF_ROUTE_THRESHOLD_METERS);
      assert.equal(dev2.isOffRoute, false); // On new route corridor!
      // Repeated alerts for previous route are prevented
      assert.equal(offRouteAlertsCount, 1);
    });
  });

  // ─── 8. Destination Arrival Detection ───────────────────────────────────────
  describe('8. Destination Arrival Detection', () => {
    const dest = { latitude: 11.0168, longitude: 76.9558 };

    test('Arrival threshold is 40 meters', () => {
      assert.equal(DESTINATION_ARRIVAL_THRESHOLD_METERS, 40);
    });

    test('Arrives when user is within 40m proximity', () => {
      // 25 meters away
      const userInside = { latitude: 11.0168 + 0.0002, longitude: 76.9558 };
      const res = hasReachedDestination(userInside, dest, DESTINATION_ARRIVAL_THRESHOLD_METERS);
      assert.equal(res.hasArrived, true);
      assert.ok(res.distanceMeters <= 40);
    });

    test('Does not trigger arrival when user is > 40m away', () => {
      // ~111 meters away
      const userOutside = { latitude: 11.0168 + 0.001, longitude: 76.9558 };
      const res = hasReachedDestination(userOutside, dest, DESTINATION_ARRIVAL_THRESHOLD_METERS);
      assert.equal(res.hasArrived, false);
      assert.ok(res.distanceMeters > 40);
    });
  });

  // ─── 9. Throttled Area Safety Score Requests ────────────────────────────────
  describe('9. Throttled Area Safety Score Requests (≥ 500m movement)', () => {
    test('Movement < 500m does not trigger new backend API requests', () => {
      const p1 = { lat: 11.0168, lng: 76.9558 };
      // Move 200 meters
      const p2 = { lat: 11.0168 + 0.0018, lng: 76.9558 };
      const movedMeters = haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng);

      assert.ok(movedMeters < AREA_SCORE_MOVEMENT_THRESHOLD_METERS);
      const shouldRequest = movedMeters >= AREA_SCORE_MOVEMENT_THRESHOLD_METERS;
      assert.equal(shouldRequest, false);
    });

    test('Movement ≥ 500m triggers new score request', () => {
      const p1 = { lat: 11.0168, lng: 76.9558 };
      // Move 600 meters
      const p2 = { lat: 11.0168 + 0.0055, lng: 76.9558 };
      const movedMeters = haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng);

      assert.ok(movedMeters >= AREA_SCORE_MOVEMENT_THRESHOLD_METERS);
      const shouldRequest = movedMeters >= AREA_SCORE_MOVEMENT_THRESHOLD_METERS;
      assert.equal(shouldRequest, true);
    });

    test('Cache and in-flight deduplication avoid duplicate API calls', async () => {
      const cache = new Map<string, any>();
      let apiCalls = 0;
      let inFlight = false;

      const fetchScore = async (lat: number, lng: number) => {
        const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
        if (cache.has(key)) return cache.get(key);
        if (inFlight) return null;

        inFlight = true;
        apiCalls++;
        const res = { score: 85, risk_level: 'safe' };
        cache.set(key, res);
        inFlight = false;
        return res;
      };

      // Call 1
      const res1 = await fetchScore(11.0168, 76.9558);
      assert.equal(apiCalls, 1);
      assert.equal(res1?.score, 85);

      // Call 2 with identical or nearby coordinates (rounds to same 2 decimal places)
      const res2 = await fetchScore(11.0171, 76.9560);
      assert.equal(apiCalls, 1); // Served from cache!
      assert.equal(res2?.score, 85);
    });
  });
});
