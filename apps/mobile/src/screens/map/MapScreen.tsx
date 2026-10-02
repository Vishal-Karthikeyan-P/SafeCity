import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../../components/common/Header';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { IncidentsApi } from '../../api/incidents';
import { SafetyApi } from '../../api/safety';
import { Colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../config/env';
import { Incident, SeverityLevel } from '../../types';

// Helper to calculate distance in km between two coordinates
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
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

export const MapScreen: React.FC = () => {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // User location state
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: DEFAULT_COORDS.latitude,
    longitude: DEFAULT_COORDS.longitude,
  });
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const webViewRef = useRef<WebView>(null);

  // Request location permission & get current location
  const requestLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasLocationPermission(true);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserCoords(coords);
      } else {
        setHasLocationPermission(false);
      }
    } catch (err) {
      setHasLocationPermission(false);
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['incident-categories'],
    queryFn: IncidentsApi.getCategories,
  });

  // Fetch nearby approved incidents using existing API
  const {
    data: rawIncidents = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: [
      'map-nearby-incidents',
      userCoords.latitude,
      userCoords.longitude,
      selectedCategoryId,
      selectedSeverity,
    ],
    queryFn: () =>
      IncidentsApi.getNearby(
        userCoords.latitude,
        userCoords.longitude,
        15.0,
        selectedCategoryId,
        selectedSeverity
      ),
  });

  // Fetch safety overview
  const { data: cityOverview } = useQuery({
    queryKey: ['map-city-overview', userCoords.latitude, userCoords.longitude],
    queryFn: () =>
      SafetyApi.getCityOverview(userCoords.latitude, userCoords.longitude, 20.0),
  });

  // Filter incidents locally if needed or use server filtered list
  const incidents = useMemo(() => {
    return rawIncidents.filter((inc) => {
      if (selectedSeverity && inc.severity !== selectedSeverity) return false;
      if (selectedCategoryId && inc.category_id !== selectedCategoryId) return false;
      return true;
    });
  }, [rawIncidents, selectedSeverity, selectedCategoryId]);

  const severities: { level: SeverityLevel; label: string; color: string }[] = [
    { level: 'critical', label: 'Critical', color: Colors.critical },
    { level: 'high', label: 'High', color: Colors.highRisk },
    { level: 'medium', label: 'Medium', color: Colors.moderate },
    { level: 'low', label: 'Low', color: Colors.safe },
  ];

  // Generate HTML for Leaflet Map
  const leafletHtml = useMemo(() => {
    const centerLat = userCoords.latitude;
    const centerLng = userCoords.longitude;

    const markersData = incidents.map((inc) => ({
      id: inc.id,
      title: inc.title.replace(/'/g, "\\'"),
      lat: inc.location_lat,
      lng: inc.location_lng,
      severity: inc.severity,
      categoryIcon: inc.category?.icon || '📍',
      categoryName: (inc.category?.name || 'Hazard').replace(/'/g, "\\'"),
      status: inc.status,
    }));

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
      background: #3b82f6;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.8);
      position: relative;
    }
    .user-pulse {
      position: absolute;
      top: -8px;
      left: -8px;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.35);
      animation: pulse 2s infinite ease-out;
    }
    @keyframes pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .incident-pin {
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2.5px solid white;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .incident-icon {
      transform: rotate(45deg);
      font-size: 14px;
      display: inline-block;
      line-height: 1;
    }
    .leaflet-control-zoom {
      border: none !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    }
    .leaflet-control-zoom a {
      background: #ffffff !important;
      color: #0f172a !important;
      border: none !important;
      width: 36px !important;
      height: 36px !important;
      line-height: 36px !important;
      font-size: 16px !important;
      font-weight: bold !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([${centerLat}, ${centerLng}], 14);

    // OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // User Location Marker
    var userIcon = L.divIcon({
      className: '',
      html: '<div class="user-pulse"></div><div class="user-marker"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    L.marker([${centerLat}, ${centerLng}], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

    // Color map for severity
    var severityColors = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#f59e0b',
      low: '#22c55e'
    };

    var markers = ${JSON.stringify(markersData)};
    var markerLayer = L.layerGroup().addTo(map);

    markers.forEach(function(inc) {
      var color = severityColors[inc.severity] || '#6b7280';
      var pinHtml = '<div class="incident-pin" style="background:' + color + ';">' +
                      '<span class="incident-icon">' + inc.categoryIcon + '</span>' +
                    '</div>';

      var pinIcon = L.divIcon({
        className: '',
        html: pinHtml,
        iconSize: [32, 38],
        iconAnchor: [16, 38]
      });

      var m = L.marker([inc.lat, inc.lng], { icon: pinIcon });
      m.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SELECT_INCIDENT',
            id: inc.id
          }));
        }
      });
      markerLayer.addLayer(m);
    });

    window.centerOnUser = function(lat, lng) {
      map.flyTo([lat, lng], 15, { animate: true, duration: 1.2 });
    };
  </script>
</body>
</html>
    `;
  }, [userCoords, incidents]);

  // Handle messages from Leaflet WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'SELECT_INCIDENT') {
        const found = incidents.find((i) => i.id === msg.id);
        if (found) {
          setSelectedIncident(found);
        }
      }
    } catch {
      // ignore
    }
  };

  const centerMapOnUser = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.centerOnUser) { window.centerOnUser(${userCoords.latitude}, ${userCoords.longitude}); } true;`
      );
    }
  };

  // Render list item
  const renderIncidentItem = ({ item }: { item: Incident }) => {
    const dist = getDistanceFromLatLonInKm(
      userCoords.latitude,
      userCoords.longitude,
      item.location_lat,
      item.location_lng
    );

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setSelectedIncident(item)}
      >
        <Card style={styles.incidentCard}>
          <View style={styles.incidentHeader}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryIcon}>{item.category?.icon || '📍'}</Text>
              <Text style={styles.categoryName}>{item.category?.name || 'General'}</Text>
            </View>
            <Badge label={item.severity ?? 'unknown'} variant="severity" severity={item.severity} />
          </View>

          <Text style={styles.incidentTitle}>{item.title}</Text>
          <Text style={styles.incidentDescription} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.incidentFooter}>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.location_address ||
                  `${item.location_lat.toFixed(4)}, ${item.location_lng.toFixed(4)}`}
              </Text>
            </View>
            <Text style={styles.distanceText}>{dist.toFixed(1)} km away</Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with View Toggle */}
      <Header
        title="Safety Map"
        subtitle={`Coimbatore • ${incidents.length} nearby incidents`}
        rightComponent={
          <View style={styles.viewToggleContainer}>
            <TouchableOpacity
              style={[
                styles.viewToggleBtn,
                viewMode === 'map' && styles.viewToggleBtnActive,
              ]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons
                name="map"
                size={16}
                color={viewMode === 'map' ? '#ffffff' : Colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewToggleBtn,
                viewMode === 'list' && styles.viewToggleBtnActive,
              ]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons
                name="list"
                size={16}
                color={viewMode === 'list' ? '#ffffff' : Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Permission Warning Banner if GPS denied */}
      {hasLocationPermission === false && (
        <View style={styles.permissionBanner}>
          <Ionicons name="warning-outline" size={16} color="#d97706" />
          <Text style={styles.permissionText}>
            GPS permission denied. Showing city center.
          </Text>
          <TouchableOpacity onPress={requestLocation} style={styles.permissionRetryBtn}>
            <Text style={styles.permissionRetryText}>Enable GPS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* City Stats Bar */}
      <View style={styles.cityBanner}>
        <View style={styles.cityStat}>
          <Text style={styles.cityStatValue}>
            {cityOverview?.score ? Math.round(cityOverview.score) : 85}
          </Text>
          <Text style={styles.cityStatLabel}>City Safety</Text>
        </View>
        <View style={styles.cityDivider} />
        <View style={styles.cityStat}>
          <Text style={styles.cityStatValue}>{incidents.length}</Text>
          <Text style={styles.cityStatLabel}>Nearby Reports</Text>
        </View>
        <View style={styles.cityDivider} />
        <View style={styles.cityStat}>
          <Text style={styles.cityStatValue}>
            {cityOverview?.top_category?.name || 'Monitoring'}
          </Text>
          <Text style={styles.cityStatLabel}>Primary Focus</Text>
        </View>
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {/* Severity Filters */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedSeverity === null && styles.filterChipActive,
            ]}
            onPress={() => setSelectedSeverity(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedSeverity === null && styles.filterChipTextActive,
              ]}
            >
              All ({rawIncidents.length})
            </Text>
          </TouchableOpacity>

          {severities.map((sev) => {
            const count = rawIncidents.filter((i) => i.severity === sev.level).length;
            const isSelected = selectedSeverity === sev.level;
            return (
              <TouchableOpacity
                key={sev.level}
                style={[
                  styles.filterChip,
                  isSelected && {
                    backgroundColor: sev.color,
                    borderColor: sev.color,
                  },
                ]}
                onPress={() =>
                  setSelectedSeverity(isSelected ? null : sev.level)
                }
              >
                <View
                  style={[
                    styles.severityDot,
                    { backgroundColor: isSelected ? '#ffffff' : sev.color },
                  ]}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {sev.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.filterSeparator} />

          {/* Category Filters */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategoryId === null && styles.filterChipCategoryActive,
            ]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedCategoryId === null && styles.filterChipTextActive,
              ]}
            >
              All Categories
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipCategoryActive,
                ]}
                onPress={() =>
                  setSelectedCategoryId(isSelected ? null : cat.id)
                }
              >
                <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content: Map or List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading safety map & incidents...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.error} />
          <Text style={styles.errorTitle}>Failed to Connect to Server</Text>
          <Text style={styles.errorSubtitle}>
            Could not reach backend API at {DEFAULT_COORDS.cityName}.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'map' ? (
        <View style={styles.mapWrapper}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: leafletHtml }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={handleWebViewMessage}
          />

          {/* Center on user location button */}
          <TouchableOpacity
            style={styles.fabLocation}
            onPress={centerMapOnUser}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isLocating ? 'hourglass-outline' : 'navigate'}
              size={22}
              color={Colors.primary}
            />
          </TouchableOpacity>

          {/* Quick summary bottom overlay */}
          <View style={styles.mapFooterSummary}>
            <View style={styles.mapSummaryLeft}>
              <View style={styles.pulseIndicator} />
              <Text style={styles.mapSummaryText}>
                {incidents.length} verified hazards within 15km
              </Text>
            </View>
            <TouchableOpacity onPress={() => refetch()} style={styles.refreshIconBtn}>
              <Ionicons
                name="refresh"
                size={16}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item.id}
          renderItem={renderIncidentItem}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="shield-checkmark-outline"
                size={48}
                color={Colors.safe}
              />
              <Text style={styles.emptyTitle}>No Incidents Found</Text>
              <Text style={styles.emptySubtitle}>
                No incidents match your selected filters in this radius.
              </Text>
            </View>
          }
        />
      )}

      {/* Incident Detail Modal */}
      <Modal
        visible={!!selectedIncident}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedIncident(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedIncident && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalCategoryRow}>
                    <Text style={styles.modalCategoryIcon}>
                      {selectedIncident.category?.icon || '📍'}
                    </Text>
                    <Text style={styles.modalCategoryName}>
                      {selectedIncident.category?.name || 'Safety Hazard'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedIncident(null)}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons name="close" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalTitle}>{selectedIncident.title}</Text>

                  <View style={styles.modalBadgesRow}>
                    <Badge
                      label={selectedIncident.severity ?? 'unknown'}
                      variant="severity"
                      severity={selectedIncident.severity}
                    />
                    <Badge
                      label={(selectedIncident.status ?? 'unknown').toUpperCase()}
                      variant="status"
                      status={selectedIncident.status}
                    />
                  </View>

                  <Text style={styles.modalSectionLabel}>Incident Details</Text>
                  <Text style={styles.modalDescription}>
                    {selectedIncident.description}
                  </Text>

                  <Text style={styles.modalSectionLabel}>Location</Text>
                  <View style={styles.modalLocationCard}>
                    <Ionicons
                      name="location"
                      size={18}
                      color={Colors.primary}
                    />
                    <View style={styles.modalLocationInfo}>
                      <Text style={styles.modalLocationAddress}>
                        {selectedIncident.location_address ||
                          'Near reported coordinates'}
                      </Text>
                      <Text style={styles.modalLocationCoords}>
                        {selectedIncident.location_lat.toFixed(5)},{' '}
                        {selectedIncident.location_lng.toFixed(5)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalMetaRow}>
                    <View style={styles.modalMetaItem}>
                      <Text style={styles.modalMetaLabel}>Reported</Text>
                      <Text style={styles.modalMetaValue}>
                        {new Date(selectedIncident.created_at).toLocaleDateString(
                          undefined,
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }
                        )}
                      </Text>
                    </View>
                    <View style={styles.modalMetaItem}>
                      <Text style={styles.modalMetaLabel}>Distance</Text>
                      <Text style={styles.modalMetaValue}>
                        {getDistanceFromLatLonInKm(
                          userCoords.latitude,
                          userCoords.longitude,
                          selectedIncident.location_lat,
                          selectedIncident.location_lng
                        ).toFixed(1)}{' '}
                        km
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalDismissBtn}
                  onPress={() => setSelectedIncident(null)}
                >
                  <Text style={styles.modalDismissText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    padding: 2,
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  permissionText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
  },
  permissionRetryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 6,
  },
  permissionRetryText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
  },
  cityBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.darkHeader,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityStat: {
    alignItems: 'center',
    flex: 1,
  },
  cityStatValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  cityStatLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  cityDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  filterContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipCategoryActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  severityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  categoryChipIcon: {
    fontSize: 12,
  },
  filterSeparator: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  fabLocation: {
    position: 'absolute',
    right: 16,
    bottom: 60,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  mapFooterSummary: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.safe,
  },
  mapSummaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  refreshIconBtn: {
    padding: 4,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  incidentCard: {
    padding: 14,
    gap: 8,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  incidentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  incidentDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  incidentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  locationText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  errorSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalCategoryIcon: {
    fontSize: 18,
  },
  modalCategoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  modalCloseBtn: {
    padding: 6,
    backgroundColor: Colors.background,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  modalBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  modalLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  modalLocationInfo: {
    flex: 1,
  },
  modalLocationAddress: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalLocationCoords: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalMetaItem: {
    alignItems: 'flex-start',
  },
  modalMetaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  modalMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  modalDismissBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  modalDismissText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
