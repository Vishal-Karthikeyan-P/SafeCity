import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { RoutesApi } from '../../api/routes';
import { Colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../config/env';
import { RouteData, RoutePlanResponse } from '../../types';
import { useTheme } from '../../store/themeStore';
import {
  decodePolyline,
  formatDistance,
  formatDuration,
  isDeviatedFromRoute,
  OFF_ROUTE_THRESHOLD_METERS,
} from '../../utils/geo';
import { RouteSafetyModal } from '../../components/route/RouteSafetyModal';
import { DestinationSearchModal } from '../../components/route/DestinationSearchModal';

interface LocationPoint {
  name: string;
  latitude: number;
  longitude: number;
  isCurrentGps?: boolean;
}

const ROUTE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const SafeRouteScreen: React.FC = () => {
  // ─── 1. Route Points State ──────────────────────────────────────────────────
  const { colors } = useTheme();
  const [startLocation, setStartLocation] = useState<LocationPoint>({
    name: 'Current Location',
    latitude: DEFAULT_COORDS.latitude,
    longitude: DEFAULT_COORDS.longitude,
    isCurrentGps: true,
  });

  const [destLocation, setDestLocation] = useState<LocationPoint | null>(null);

  // Modals & pin-drop mode
  const [searchModalMode, setSearchModalMode] = useState<'start' | 'dest' | null>(null);
  const [pinDropMode, setPinDropMode] = useState<'start' | 'dest' | null>(null);
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);

  // Active route index
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number>(0);

  // ─── 2. Live Foreground Location & Navigation State ─────────────────────────
  const [isNavigating, setIsNavigating] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // ─── 3. Route Deviation & Recalculation State ───────────────────────────────
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [deviationMeters, setDeviationMeters] = useState(0);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcNotice, setRecalcNotice] = useState<string | null>(null);

  const webViewRef = useRef<WebView>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  // ─── Initial GPS Location Fetch ─────────────────────────────────────────────
  const obtainInitialGps = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasLocationPermission(true);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const currentPt = {
          name: 'Current Location',
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          isCurrentGps: true,
        };
        setStartLocation(currentPt);
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          heading: loc.coords.heading || 0,
        });
      } else {
        setHasLocationPermission(false);
        setLocationError('Location permission denied. You can select locations manually.');
      }
    } catch {
      setHasLocationPermission(false);
      setLocationError('Unable to acquire GPS signal. Using city coordinates.');
    }
  }, []);

  useEffect(() => {
    obtainInitialGps();
  }, [obtainInitialGps]);

  // ─── 4. Call Existing SafeCity Route API ────────────────────────────────────
  const {
    data: routeResponse,
    isLoading: isRoutesLoading,
    isError: isRoutesError,
    error: routesError,
    refetch: refetchRoutes,
  } = useQuery({
    queryKey: [
      'safe-routes-plan',
      startLocation.latitude,
      startLocation.longitude,
      destLocation?.latitude,
      destLocation?.longitude,
    ],
    queryFn: async (): Promise<RoutePlanResponse> => {
      if (!destLocation) {
        throw new Error('Destination not specified');
      }
      return RoutesApi.planSafeRoute(
        startLocation.latitude,
        startLocation.longitude,
        destLocation.latitude,
        destLocation.longitude
      );
    },
    enabled: !!destLocation,
    staleTime: 30000,
  });

  const routes: RouteData[] = routeResponse?.routes ?? [];

  // Reset selected route index when response arrives
  useEffect(() => {
    if (routeResponse && routeResponse.routes.length > 0) {
      const recIdx = routeResponse.recommended_route_idx ?? 0;
      setSelectedRouteIdx(recIdx);
      setIsOffRoute(false);
    }
  }, [routeResponse]);

  const selectedRoute: RouteData | null = routes[selectedRouteIdx] ?? null;

  // Decoded polyline coordinates for the selected route
  const selectedRouteCoords = useMemo(() => {
    if (!selectedRoute?.geometry) return [];
    return decodePolyline(selectedRoute.geometry);
  }, [selectedRoute?.geometry]);

  // Decoded coordinates for all routes to pass to Leaflet
  const allRoutesData = useMemo(() => {
    return routes.map((r, i) => ({
      index: i,
      label: r.label || `Route ${i + 1}`,
      riskLevel: r.route_risk_level,
      color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      coordinates: decodePolyline(r.geometry),
    }));
  }, [routes]);

  // ─── 5. Live Foreground GPS Tracking ───────────────────────────────────────
  const startForegroundTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setHasLocationPermission(false);
        setLocationError('Location permission is required for live route guidance.');
        return;
      }
      setHasLocationPermission(true);
      setLocationError(null);

      // Clean up any existing subscription
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (loc) => {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          const heading = loc.coords.heading ?? 0;

          setUserLocation({ latitude: lat, longitude: lng, heading });

          // Update map marker in Leaflet without reloading WebView
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(
              `if (window.updateUserLocation) { window.updateUserLocation(${lat}, ${lng}, ${heading}); } true;`
            );
          }

          // ── 6. Route Deviation Check ──────────────────────────────────────
          if (selectedRouteCoords.length > 1) {
            const deviationResult = isDeviatedFromRoute(
              { latitude: lat, longitude: lng },
              selectedRouteCoords,
              OFF_ROUTE_THRESHOLD_METERS
            );

            setIsOffRoute(deviationResult.isOffRoute);
            setDeviationMeters(deviationResult.deviationDistanceMeters);
          }
        }
      );

      locationSubRef.current = sub;
    } catch {
      setLocationError('GPS is unavailable or location services are disabled.');
    }
  }, [selectedRouteCoords]);

  const stopForegroundTracking = useCallback(() => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    setIsNavigating(false);
    setIsOffRoute(false);
  }, []);

  // Clean up tracking on unmount
  useEffect(() => {
    return () => {
      if (locationSubRef.current) {
        locationSubRef.current.remove();
      }
    };
  }, []);

  const handleToggleNavigation = async () => {
    if (!isNavigating) {
      if (!destLocation || routes.length === 0) {
        Alert.alert('Route Required', 'Please calculate and select a route before starting navigation.');
        return;
      }
      setIsNavigating(true);
      await startForegroundTracking();
    } else {
      stopForegroundTracking();
    }
  };

  // ─── 7. Route Recalculation via Backend API ────────────────────────────────
  const handleRecalculateRoute = async () => {
    if (!userLocation || !destLocation) {
      Alert.alert('Notice', 'Cannot recalculate without current GPS position and destination.');
      return;
    }

    setIsRecalculating(true);
    setRecalcNotice('Recalculating safe route from current GPS position...');

    try {
      // Set start location to latest GPS position
      const newStart: LocationPoint = {
        name: 'Current Location',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        isCurrentGps: true,
      };
      setStartLocation(newStart);

      // Trigger re-fetch
      await refetchRoutes();
      setIsOffRoute(false);
      setRecalcNotice('Route updated successfully!');
      setTimeout(() => setRecalcNotice(null), 3000);
    } catch {
      setRecalcNotice('Network error: Unable to recalculate route. Retrying...');
    } finally {
      setIsRecalculating(false);
    }
  };

  // ─── 8. Handle Leaflet Map Events ──────────────────────────────────────────
  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'MAP_CLICK') {
        const { lat, lng } = msg;
        if (pinDropMode === 'start') {
          setStartLocation({
            name: `Pin: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            latitude: lat,
            longitude: lng,
            isCurrentGps: false,
          });
          setPinDropMode(null);
        } else if (pinDropMode === 'dest') {
          setDestLocation({
            name: `Pin: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            latitude: lat,
            longitude: lng,
          });
          setPinDropMode(null);
        } else {
          // If no specific mode, set destination by default
          setDestLocation({
            name: `Destination (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            latitude: lat,
            longitude: lng,
          });
        }
      } else if (msg.type === 'SELECT_ROUTE') {
        if (typeof msg.index === 'number' && msg.index >= 0 && msg.index < routes.length) {
          setSelectedRouteIdx(msg.index);
        }
      }
    } catch {
      // ignore
    }
  };

  // Center on user position
  const handleCenterOnUser = () => {
    if (userLocation && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.centerOnCoords) { window.centerOnCoords(${userLocation.latitude}, ${userLocation.longitude}); } true;`
      );
    }
  };

  // ─── 9. Generate Leaflet HTML for WebView ──────────────────────────────────
  const leafletHtml = useMemo(() => {
    const startLat = startLocation.latitude;
    const startLng = startLocation.longitude;
    const destLat = destLocation?.latitude ?? null;
    const destLng = destLocation?.longitude ?? null;

    const routesJson = JSON.stringify(allRoutesData);
    const incidentsData = (selectedRoute?.incidents || []).map((inc) => ({
      id: inc.id,
      title: inc.title.replace(/'/g, "\\'"),
      lat: inc.lat,
      lng: inc.lng,
      severity: inc.severity,
      categoryIcon: inc.category_icon || '📍',
      distanceMeters: inc.distance_meters,
    }));
    const incidentsJson = JSON.stringify(incidentsData);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background: #0f172a;
    }
    .user-marker {
      width: 18px;
      height: 18px;
      background: #2563eb;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 14px rgba(37, 99, 235, 0.8);
      position: relative;
    }
    .user-pulse {
      position: absolute;
      top: -8px;
      left: -8px;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.35);
      animation: pulse 2s infinite ease-out;
    }
    @keyframes pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .endpoint-pin {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2.5px solid #ffffff;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
      color: #ffffff;
    }
    .start-pin { background: #16a34a; }
    .dest-pin { background: #2563eb; }
    .incident-marker {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    .incident-critical { background: #ef4444; }
    .incident-high { background: #f97316; }
    .incident-medium { background: #f59e0b; }
    .incident-low { background: #22c55e; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: true
    }).setView([${startLat}, ${startLng}], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Click handler for selecting points
    map.on('click', function(e) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'MAP_CLICK',
          lat: e.latlng.lat,
          lng: e.latlng.lng
        }));
      }
    });

    // Start Marker
    var startIcon = L.divIcon({
      className: '',
      html: '<div class="endpoint-pin start-pin">S</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    L.marker([${startLat}, ${startLng}], { icon: startIcon, zIndexOffset: 800 }).addTo(map);

    // Destination Marker
    ${destLat !== null && destLng !== null ? `
    var destIcon = L.divIcon({
      className: '',
      html: '<div class="endpoint-pin dest-pin">D</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    L.marker([${destLat}, ${destLng}], { icon: destIcon, zIndexOffset: 800 }).addTo(map);
    ` : ''}

    // User Location Marker
    var userMarker = null;
    window.updateUserLocation = function(lat, lng, heading) {
      if (!userMarker) {
        var userIcon = L.divIcon({
          className: '',
          html: '<div class="user-pulse"></div><div class="user-marker"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1200 }).addTo(map);
      } else {
        userMarker.setLatLng([lat, lng]);
      }
    };

    window.centerOnCoords = function(lat, lng) {
      map.flyTo([lat, lng], 16, { animate: true, duration: 1.0 });
    };

    // Render Routes
    var routes = ${routesJson};
    var selectedIdx = ${selectedRouteIdx};
    var routeLayerGroup = L.layerGroup().addTo(map);
    var boundsPoints = [[${startLat}, ${startLng}]];

    ${destLat !== null && destLng !== null ? `boundsPoints.push([${destLat}, ${destLng}]);` : ''}

    routes.forEach(function(r) {
      if (!r.coordinates || r.coordinates.length < 2) return;

      var isSelected = (r.index === selectedIdx);

      // Selected route: thick, bright, higher z-index
      // Unselected routes: thinner, dimmed
      var strokeColor = isSelected ? (r.riskLevel === 'safe' ? '#16a34a' : (r.riskLevel === 'moderate' ? '#d97706' : '#dc2626')) : r.color;
      var strokeWidth = isSelected ? 6 : 3.5;
      var strokeOpacity = isSelected ? 0.95 : 0.45;

      // Draw casing for selected route
      if (isSelected) {
        L.polyline(r.coordinates, {
          color: '#ffffff',
          weight: strokeWidth + 3,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(routeLayerGroup);
      }

      var line = L.polyline(r.coordinates, {
        color: strokeColor,
        weight: strokeWidth,
        opacity: strokeOpacity,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(routeLayerGroup);

      line.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SELECT_ROUTE',
            index: r.index
          }));
        }
      });

      if (isSelected) {
        r.coordinates.forEach(function(c) { boundsPoints.push(c); });
      }
    });

    // Render Incidents for Selected Route
    var incidents = ${incidentsJson};
    var incidentLayerGroup = L.layerGroup().addTo(map);

    incidents.forEach(function(inc) {
      var sevClass = 'incident-' + (inc.severity || 'medium');
      var incIcon = L.divIcon({
        className: '',
        html: '<div class="incident-marker ' + sevClass + '">' + inc.categoryIcon + '</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker([inc.lat, inc.lng], { icon: incIcon, zIndexOffset: 900 }).addTo(incidentLayerGroup);
    });

    // Fit Bounds
    if (boundsPoints.length > 1) {
      map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 16 });
    }
  </script>
</body>
</html>
    `;
  }, [
    startLocation.latitude,
    startLocation.longitude,
    destLocation?.latitude,
    destLocation?.longitude,
    allRoutesData,
    selectedRouteIdx,
    selectedRoute?.incidents,
  ]);

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Top Floating Location Card ────────────────────────────────────── */}
      <View style={[styles.topCard, { paddingTop: Math.max(insets.top, 12) }]}>
        {/* Start Point Row */}
        <View style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: Colors.safe }]} />
          <TouchableOpacity
            style={styles.locationSelector}
            onPress={() => setSearchModalMode('start')}
            activeOpacity={0.7}
          >
            <Text style={styles.locationLabel}>STARTING FROM</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {startLocation.name}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.miniBtn, startLocation.isCurrentGps ? styles.miniBtnActive : null]}
            onPress={obtainInitialGps}
            activeOpacity={0.7}
          >
            <Ionicons
              name="navigate"
              size={16}
              color={startLocation.isCurrentGps ? '#ffffff' : Colors.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.cardDivider} />

        {/* Destination Row */}
        <View style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
          <TouchableOpacity
            style={styles.locationSelector}
            onPress={() => setSearchModalMode('dest')}
            activeOpacity={0.7}
          >
            <Text style={styles.locationLabel}>DESTINATION</Text>
            <Text
              style={[
                styles.locationValue,
                !destLocation ? { color: Colors.textMuted, fontStyle: 'italic' } : null,
              ]}
              numberOfLines={1}
            >
              {destLocation ? destLocation.name : 'Tap to search or select destination...'}
            </Text>
          </TouchableOpacity>
          {destLocation && (
            <TouchableOpacity
              style={styles.miniBtn}
              onPress={() => {
                setDestLocation(null);
                stopForegroundTracking();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Pin Drop Mode Banner */}
        {pinDropMode && (
          <View style={styles.pinDropBanner}>
            <Ionicons name="location" size={16} color="#ffffff" />
            <Text style={styles.pinDropText}>
              Tap anywhere on the map to set {pinDropMode === 'start' ? 'Start' : 'Destination'}
            </Text>
            <TouchableOpacity onPress={() => setPinDropMode(null)}>
              <Ionicons name="close" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Interactive Leaflet Map (WebView) ─────────────────────────────── */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
        />

        {/* Floating Map Controls */}
        <View style={styles.floatingControls}>
          <TouchableOpacity
            style={styles.fabBtn}
            onPress={handleCenterOnUser}
            activeOpacity={0.8}
          >
            <Ionicons name="locate" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Off-Route Alert Banner */}
        {isNavigating && isOffRoute && (
          <View style={styles.offRouteBanner}>
            <View style={styles.offRouteIconWrap}>
              <Ionicons name="warning" size={20} color="#ffffff" />
            </View>
            <View style={styles.offRouteTextWrap}>
              <Text style={styles.offRouteTitle}>OFF ROUTE DETECTED</Text>
              <Text style={styles.offRouteSubtitle}>
                You are {deviationMeters}m away from the safe path corridor.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.recalcBtn}
              onPress={handleRecalculateRoute}
              disabled={isRecalculating}
              activeOpacity={0.8}
            >
              {isRecalculating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.recalcBtnText}>Recalculate</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Recalculation Notice Toast */}
        {recalcNotice && (
          <View style={styles.toastNotice}>
            <Ionicons name="information-circle" size={16} color="#ffffff" />
            <Text style={styles.toastText}>{recalcNotice}</Text>
          </View>
        )}

        {/* Location Error / Denied Banner */}
        {locationError && (
          <View style={styles.permErrorBanner}>
            <Ionicons name="alert-circle" size={16} color="#b91c1c" />
            <Text style={styles.permErrorText}>{locationError}</Text>
            <TouchableOpacity onPress={obtainInitialGps} style={styles.permRetryBtn}>
              <Text style={styles.permRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Bottom Section: Loading, Error, or Route Carousel ──────────────── */}
      <View style={styles.bottomSection}>
        {/* Loading State */}
        {isRoutesLoading && (
          <View style={styles.statusBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.statusTitle}>Analyzing Safe Routes...</Text>
            <Text style={styles.statusSub}>
              Checking OSRM corridors and database safety incidents
            </Text>
          </View>
        )}

        {/* Error State */}
        {isRoutesError && !isRoutesLoading && (
          <View style={styles.statusBox}>
            <Ionicons name="alert-circle-outline" size={32} color={Colors.critical} />
            <Text style={styles.errorTitle}>Unable to plan safe route</Text>
            <Text style={styles.errorSub}>
              {(routesError as any)?.response?.data?.detail ||
                (routesError as any)?.message ||
                'Please verify coordinates and network connectivity.'}
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => refetchRoutes()}
              activeOpacity={0.8}
            >
              <Text style={styles.retryBtnText}>Retry Route Search</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State: Prompt to select destination */}
        {!destLocation && !isRoutesLoading && (
          <View style={styles.emptyPromptCard}>
            <View style={styles.emptyPromptIconWrap}>
              <Ionicons name="navigate-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.emptyPromptTextWrap}>
              <Text style={styles.emptyPromptTitle}>Safe City Route Planner</Text>
              <Text style={styles.emptyPromptSub}>
                Select a destination to evaluate 3-5 distinct safe corridors avoiding high-risk areas.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.searchDestBtn}
              onPress={() => setSearchModalMode('dest')}
              activeOpacity={0.8}
            >
              <Text style={styles.searchDestBtnText}>Choose</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Routes Available: Carousel & Navigation Controls */}
        {routes.length > 0 && !isRoutesLoading && (
          <View style={styles.routesContainer}>
            <View style={styles.routesHeaderRow}>
              <Text style={styles.routesHeaderTitle}>
                {routes.length} ROUTE ALTERNATIVES FOUND
              </Text>
              {routeResponse?.avoidance_warning && (
                <View style={styles.avoidWarningPill}>
                  <Ionicons name="warning" size={12} color="#b45309" />
                  <Text style={styles.avoidWarningText}>Zone Alert</Text>
                </View>
              )}
            </View>

            {/* Horizontal Route Cards List */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.routeCardsScroll}
            >
              {routes.map((routeItem, idx) => {
                const isSelected = idx === selectedRouteIdx;
                const isRecommended = idx === routeResponse?.recommended_route_idx;
                const isSafest = idx === routeResponse?.safest_route_idx;
                const isClean = routeItem.incident_free;

                const scoreColor =
                  routeItem.route_risk_level === 'safe'
                    ? Colors.safe
                    : routeItem.route_risk_level === 'moderate'
                      ? Colors.moderate
                      : Colors.critical;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.routeCard,
                      isSelected ? styles.routeCardSelected : null,
                    ]}
                    onPress={() => setSelectedRouteIdx(idx)}
                    activeOpacity={0.85}
                  >
                    {/* Badges Row */}
                    <View style={styles.cardBadgeRow}>
                      {isRecommended && (
                        <View style={[styles.badgePill, { backgroundColor: '#e0e7ff' }]}>
                          <Text style={[styles.badgeText, { color: '#4338ca' }]}>
                            Recommended
                          </Text>
                        </View>
                      )}
                      {isSafest && !isRecommended && (
                        <View style={[styles.badgePill, { backgroundColor: '#dcfce7' }]}>
                          <Text style={[styles.badgeText, { color: '#15803d' }]}>Safest</Text>
                        </View>
                      )}
                      {isClean && (
                        <View style={[styles.badgePill, { backgroundColor: '#dcfce7' }]}>
                          <Text style={[styles.badgeText, { color: '#15803d' }]}>Clean</Text>
                        </View>
                      )}
                      <Text style={styles.routeIndexLabel}>
                        {routeItem.label || `Route ${idx + 1}`}
                      </Text>
                    </View>

                    {/* Score & ETA Row */}
                    <View style={styles.cardMainRow}>
                      <View style={styles.cardScoreWrap}>
                        <Text style={[styles.cardScoreVal, { color: scoreColor }]}>
                          {Math.round(routeItem.safety_score)}
                        </Text>
                        <Text style={styles.cardScoreMax}>/100</Text>
                      </View>

                      <View style={styles.cardStatsWrap}>
                        <View style={styles.statLine}>
                          <Ionicons name="navigate-outline" size={13} color={Colors.textMuted} />
                          <Text style={styles.statLineText}>
                            {formatDistance(routeItem.distance_m)}
                          </Text>
                        </View>
                        <View style={styles.statLine}>
                          <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                          <Text style={styles.statLineText}>
                            {formatDuration(routeItem.duration_s)}
                          </Text>
                        </View>
                        <View style={styles.statLine}>
                          <Ionicons name="alert-circle-outline" size={13} color={Colors.textMuted} />
                          <Text style={styles.statLineText}>
                            {routeItem.relevant_incident_count ?? routeItem.incidents?.length ?? 0}{' '}
                            hazards
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Selection Indicator */}
                    <View
                      style={[
                        styles.selectIndicator,
                        isSelected ? { backgroundColor: Colors.primary } : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectIndicatorText,
                          isSelected ? { color: '#ffffff' } : null,
                        ]}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Action Bar: Safety Details + Navigation Toggle */}
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.detailsBtn}
                onPress={() => setSafetyModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
                <Text style={styles.detailsBtnText}>Safety Breakdown</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navBtn,
                  isNavigating ? styles.navBtnActive : null,
                ]}
                onPress={handleToggleNavigation}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={isNavigating ? 'stop-circle' : 'navigate'}
                  size={18}
                  color="#ffffff"
                />
                <Text style={styles.navBtnText}>
                  {isNavigating ? 'Stop Navigation' : 'Start Guidance'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── 10. Modals ──────────────────────────────────────────────────────── */}
      <DestinationSearchModal
        visible={searchModalMode !== null}
        mode={searchModalMode || 'dest'}
        onClose={() => setSearchModalMode(null)}
        onSelectPlace={(place) => {
          if (searchModalMode === 'start') {
            setStartLocation({
              name: place.name,
              latitude: place.latitude,
              longitude: place.longitude,
              isCurrentGps: false,
            });
          } else {
            setDestLocation({
              name: place.name,
              latitude: place.latitude,
              longitude: place.longitude,
            });
          }
        }}
        onSelectOnMap={() => {
          setPinDropMode(searchModalMode);
        }}
      />

      <RouteSafetyModal
        visible={safetyModalVisible}
        route={selectedRoute}
        onClose={() => setSafetyModalVisible(false)}
        avoidanceWarning={routeResponse?.avoidance_warning}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topCard: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationSelector: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  locationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  miniBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
    marginLeft: 22,
  },
  pinDropBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  pinDropText: {
    flex: 1,
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    top: 16,
    gap: 10,
  },
  fabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  offRouteBanner: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    backgroundColor: '#dc2626',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  offRouteIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offRouteTextWrap: {
    flex: 1,
  },
  offRouteTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  offRouteSubtitle: {
    fontSize: 11,
    color: '#ffffff',
    opacity: 0.9,
    marginTop: 1,
  },
  recalcBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recalcBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  toastNotice: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  toastText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  permErrorBanner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permErrorText: {
    flex: 1,
    fontSize: 11,
    color: '#991b1b',
    fontWeight: '500',
  },
  permRetryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ffffff',
    borderRadius: 6,
  },
  permRetryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991b1b',
  },
  bottomSection: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  statusBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.critical,
  },
  errorSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  emptyPromptIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPromptTextWrap: {
    flex: 1,
  },
  emptyPromptTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyPromptSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  searchDestBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  searchDestBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  routesContainer: {
    paddingTop: 10,
    gap: 10,
  },
  routesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  routesHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  avoidWarningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  avoidWarningText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },
  routeCardsScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  routeCard: {
    width: 190,
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 12,
    gap: 8,
  },
  routeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  routeIndexLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginLeft: 'auto',
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardScoreWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cardScoreVal: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
  },
  cardScoreMax: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  cardStatsWrap: {
    flex: 1,
    gap: 2,
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLineText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  selectIndicator: {
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  selectIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 2,
  },
  detailsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  navBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  navBtnActive: {
    backgroundColor: '#dc2626',
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
