import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSOSStore } from '../../store/sosStore';
import { EmergencyContactsApi } from '../../api/emergencyContacts';
import { Colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../config/env';
import { MainStackParamList } from '../../types/navigation';
import { EmergencyContact } from '../../types';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const ActiveSOSScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    activeSOS,
    selectedContactIds,
    updateSOSLocation,
    resolveSOS,
    isResolving,
    lastLocation,
    checkActiveSOS,
  } = useSOSStore();

  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [isResolveModalVisible, setIsResolveModalVisible] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const webViewRef = useRef<WebView>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Pulsing animation for the active emergency header
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Fetch emergency contacts to display notified status
  const { data: contacts = [] } = useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: EmergencyContactsApi.listContacts,
  });

  const notifiedContacts = useMemo(() => {
    if (selectedContactIds.length === 0) return contacts;
    return contacts.filter((c) => selectedContactIds.includes(c.id));
  }, [contacts, selectedContactIds]);

  // Initial check on mount
  useEffect(() => {
    checkActiveSOS();
  }, [checkActiveSOS]);

  // ─── Live Foreground Location Tracking (Foreground Only) ───────────────────
  const startForegroundLocationUpdates = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setHasLocationPermission(false);
        setGpsError('Location permission denied. Real-time emergency GPS is disabled.');
        return;
      }

      setHasLocationPermission(true);
      setGpsError(null);

      // Clean up any existing watcher
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,
          distanceInterval: 5,
        },
        async (loc) => {
          const { latitude, longitude } = loc.coords;

          // Update WebView map marker smoothly
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(
              `if (window.updateSOSLocation) { window.updateSOSLocation(${latitude}, ${longitude}); } true;`
            );
          }

          // Throttle network updates to every 6 seconds to save battery and bandwidth
          const now = Date.now();
          if (now - lastUpdateRef.current >= 6000) {
            lastUpdateRef.current = now;
            try {
              await updateSOSLocation(latitude, longitude);
              setLastSyncTime(new Date());
              setNetworkError(null);
            } catch {
              setNetworkError('Network error syncing location to emergency dispatch');
            }
          }
        }
      );

      locationSubRef.current = sub;
    } catch {
      setGpsError('GPS signal unavailable. Using last recorded coordinates.');
    }
  }, [updateSOSLocation]);

  const stopForegroundTracking = useCallback(() => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
  }, []);

  useEffect(() => {
    startForegroundLocationUpdates();
    return () => {
      stopForegroundTracking();
    };
  }, [startForegroundLocationUpdates, stopForegroundTracking]);

  // Format trigger timestamp
  const startTimeText = useMemo(() => {
    if (!activeSOS?.created_at) return 'Just now';
    const date = new Date(activeSOS.created_at);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [activeSOS?.created_at]);

  const currentLat = lastLocation?.latitude ?? activeSOS?.location_lat ?? DEFAULT_COORDS.latitude;
  const currentLng = lastLocation?.longitude ?? activeSOS?.location_lng ?? DEFAULT_COORDS.longitude;

  // ─── Leaflet Mini-Map HTML ────────────────────────────────────────────────
  const leafletHtml = useMemo(() => {
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
    .sos-marker {
      width: 22px;
      height: 22px;
      background: #dc2626;
      border: 3.5px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 16px rgba(220, 38, 38, 0.9);
      position: relative;
    }
    .sos-pulse {
      position: absolute;
      top: -11px;
      left: -11px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(220, 38, 38, 0.4);
      animation: pulse 1.6s infinite ease-out;
    }
    @keyframes pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.8); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: true
    }).setView([${currentLat}, ${currentLng}], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var sosIcon = L.divIcon({
      className: '',
      html: '<div class="sos-pulse"></div><div class="sos-marker"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    var marker = L.marker([${currentLat}, ${currentLng}], { icon: sosIcon }).addTo(map);

    window.updateSOSLocation = function(lat, lng) {
      if (marker) {
        marker.setLatLng([lat, lng]);
        map.panTo([lat, lng], { animate: true, duration: 1.0 });
      }
    };
  </script>
</body>
</html>
    `;
  }, [currentLat, currentLng]);

  // ─── Resolve Actions ───────────────────────────────────────────────────────
  const handleConfirmResolve = async (status: 'resolved' | 'false_alarm') => {
    setIsResolveModalVisible(false);
    stopForegroundTracking();

    try {
      await resolveSOS(status);
      Alert.alert(
        status === 'false_alarm' ? 'SOS Cancelled' : 'Emergency Resolved',
        status === 'false_alarm'
          ? 'The SOS event was cancelled as a false alarm.'
          : 'Your SOS emergency status has been marked as resolved.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('MainTabs');
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update SOS status on server.');
    }
  };

  const handleCallContact = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call on this device.');
    });
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* ── Active Emergency Top Bar ──────────────────────────────────────── */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <Animated.View style={[styles.beaconIcon, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="warning" size={26} color="#ffffff" />
        </Animated.View>
        <View style={styles.topHeaderTextWrap}>
          <Text style={styles.topHeaderTitle}>ACTIVE EMERGENCY SOS</Text>
          <Text style={styles.topHeaderSub}>
            Live broadcast active • Started at {startTimeText}
          </Text>
        </View>
        <View style={styles.activePill}>
          <View style={styles.activePillDot} />
          <Text style={styles.activePillText}>LIVE</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status & Location Sync Banner */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusCol}>
              <Text style={styles.statusColLabel}>CURRENT GPS POSITION</Text>
              <Text style={styles.statusCoordsText}>
                {currentLat.toFixed(5)}° N, {currentLng.toFixed(5)}° E
              </Text>
            </View>

            <View style={styles.syncCol}>
              <View style={styles.syncRow}>
                <Ionicons name="sync" size={14} color={Colors.safe} />
                <Text style={styles.syncStatusText}>Syncing Live</Text>
              </View>
              <Text style={styles.syncTimeSub}>
                Updated {Math.max(1, Math.round((Date.now() - lastSyncTime.getTime()) / 1000))}s ago
              </Text>
            </View>
          </View>

          {/* Warnings if GPS or Network fail */}
          {gpsError && (
            <View style={styles.warningRow}>
              <Ionicons name="location-outline" size={16} color="#b91c1c" />
              <Text style={styles.warningRowText}>{gpsError}</Text>
            </View>
          )}

          {networkError && (
            <View style={styles.warningRow}>
              <Ionicons name="cloud-offline-outline" size={16} color="#b45309" />
              <Text style={styles.warningRowText}>{networkError}</Text>
            </View>
          )}

          {/* Mini Interactive Map */}
          <View style={styles.mapWrap}>
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: leafletHtml }}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </View>
        </View>

        {/* Emergency Contacts Notified Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="people" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>
                Contacts Notified ({notifiedContacts.length})
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('EmergencyContacts')}
              activeOpacity={0.7}
            >
              <Text style={styles.manageLinkText}>Manage</Text>
            </TouchableOpacity>
          </View>

          {notifiedContacts.length > 0 ? (
            <View style={styles.contactsList}>
              {notifiedContacts.map((contact) => (
                <View key={contact.id} style={styles.contactItem}>
                  <View style={styles.contactAvatar}>
                    <Ionicons name="person" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.contactDetails}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactRelation}>
                      {contact.contact_relation || 'Emergency Contact'} • {contact.phone}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.callContactBtn}
                    onPress={() => handleCallContact(contact.phone)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call" size={16} color="#ffffff" />
                    <Text style={styles.callContactText}>Call</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noContactsBox}>
              <Ionicons name="alert-circle-outline" size={24} color={Colors.moderate} />
              <Text style={styles.noContactsText}>
                No emergency contacts selected. Tap Manage to add contacts.
              </Text>
            </View>
          )}
        </View>

        {/* Emergency Dispatch Notice */}
        <View style={styles.dispatchBox}>
          <Ionicons name="shield-checkmark" size={22} color={Colors.safe} />
          <View style={styles.dispatchTextWrap}>
            <Text style={styles.dispatchTitle}>SafeCity Central Dispatch Notified</Text>
            <Text style={styles.dispatchSub}>
              Your live coordinates and incident timestamp are logged on the central safety network.
            </Text>
          </View>
        </View>

        {/* Immediate Resolution / Cancellation Options */}
        <View style={styles.cancelActionsSection}>
          <TouchableOpacity
            style={styles.resolvePrimaryBtn}
            onPress={() => setIsResolveModalVisible(true)}
            activeOpacity={0.85}
            disabled={isResolving}
          >
            {isResolving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                <Text style={styles.resolvePrimaryText}>Resolve Emergency / I'm Safe</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.falseAlarmBtn}
            onPress={() => handleConfirmResolve('false_alarm')}
            activeOpacity={0.8}
            disabled={isResolving}
          >
            <Text style={styles.falseAlarmText}>Cancel as False Alarm</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Resolve Confirmation Modal ────────────────────────────────────── */}
      {isResolveModalVisible && (
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="shield-checkmark" size={36} color={Colors.safe} />
            </View>
            <Text style={styles.confirmTitle}>Resolve SOS Emergency?</Text>
            <Text style={styles.confirmSub}>
              Confirm that you are safe. This will conclude live emergency tracking and notify the SafeCity network.
            </Text>

            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setIsResolveModalVisible(false)}
              >
                <Text style={styles.confirmCancelText}>Keep Active</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmDoneBtn}
                onPress={() => handleConfirmResolve('resolved')}
              >
                <Text style={styles.confirmDoneText}>Yes, I'm Safe</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b91c1c',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  beaconIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTextWrap: {
    flex: 1,
  },
  topHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  topHeaderSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  activePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 16,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusCol: {
    flex: 1,
  },
  statusColLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  statusCoordsText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  syncCol: {
    alignItems: 'flex-end',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.safe,
  },
  syncTimeSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  warningRowText: {
    fontSize: 11,
    color: '#991b1b',
    flex: 1,
  },
  mapWrap: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webview: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  manageLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  contactsList: {
    gap: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  contactRelation: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  callContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.safe,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  callContactText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  noContactsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  noContactsText: {
    fontSize: 12,
    color: '#92400e',
    flex: 1,
  },
  dispatchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  dispatchTextWrap: {
    flex: 1,
  },
  dispatchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
  },
  dispatchSub: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
    lineHeight: 15,
  },
  cancelActionsSection: {
    gap: 10,
    marginTop: 6,
  },
  resolvePrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.safe,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: Colors.safe,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  resolvePrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  falseAlarmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  falseAlarmText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  confirmIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  confirmSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  confirmDoneBtn: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.safe,
    borderRadius: 12,
  },
  confirmDoneText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
