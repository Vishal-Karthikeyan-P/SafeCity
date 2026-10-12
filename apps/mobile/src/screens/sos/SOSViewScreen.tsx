/**
 * SOSView Screen — Read-only emergency location viewer for SOS recipients.
 *
 * When an emergency contact receives an SOS push notification, tapping it
 * navigates here. This screen shows ONLY the SOS SENDER'S location — it
 * never uses the recipient's own coordinates for the map or labels.
 *
 * The sender's coordinates come from:
 *   1. The push notification payload (initial fix).
 *   2. Periodic polling of GET /sos/{sos_id}/location (live updates).
 *
 * The recipient's own location is only shown if they explicitly request
 * navigation directions (separate "Get Directions" button).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types/navigation';
import { apiClient } from '../../api/client';
import { Colors } from '../../constants/colors';

type SOSViewRoute = RouteProp<MainStackParamList, 'SOSView'>;
type NavProp = NativeStackNavigationProp<MainStackParamList>;

/** Backend response shape for GET /sos/{sos_id}/location */
interface SOSLocationResponse {
  sos_id: string;
  sender_name: string;
  /** Sender's latest latitude — authoritative for the map */
  location_lat: number;
  /** Sender's latest longitude — authoritative for the map */
  location_lng: number;
  status: string;
  updated_at: string;
}

const POLL_INTERVAL_MS = 8000; // poll sender location every 8 s

export const SOSViewScreen: React.FC = () => {
  const route = useRoute<SOSViewRoute>();
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();

  // ── Seed from push payload (never the recipient's own coords) ───────────
  const { sos_id, sender_name, sender_lat, sender_lng } = route.params;

  const [senderLat, setSenderLat] = useState(sender_lat);
  const [senderLng, setSenderLng] = useState(sender_lng);
  const [senderDisplayName, setSenderDisplayName] = useState(sender_name);
  const [sosStatus, setSosStatus] = useState<string>('active');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const webViewRef = useRef<WebView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing SOS indicator
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  /**
   * Fetch the sender's latest coordinates from backend.
   * IMPORTANT: We only read `location_lat` / `location_lng` from the
   * server response — which stores the SOS SENDER's coordinates.
   * We never substitute the recipient's device location here.
   */
  const fetchSenderLocation = useCallback(async () => {
    if (!sos_id) return;
    try {
      setIsFetching(true);
      const res = await apiClient.get<SOSLocationResponse>(`/sos/${sos_id}/location`);
      const data = res.data;

      // These are the SENDER's coords from the DB — always use them
      const lat = data.location_lat;
      const lng = data.location_lng;

      setSenderLat(lat);
      setSenderLng(lng);
      setSenderDisplayName(data.sender_name || sender_name);
      setSosStatus(data.status);
      setLastUpdated(new Date());
      setFetchError(null);

      // Update the WebView map to follow sender's position
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `if (window.moveSenderMarker) { window.moveSenderMarker(${lat}, ${lng}); } true;`
        );
      }

      // If SOS is resolved, inform the user
      if (data.status === 'resolved' || data.status === 'false_alarm') {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        Alert.alert(
          'SOS Ended',
          `${data.sender_name || sender_name} has resolved their SOS emergency.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.status === 404) {
        setFetchError('This SOS session is no longer accessible.');
        clearInterval(pollRef.current!);
        pollRef.current = null;
      } else {
        setFetchError('Unable to refresh location — using last known position.');
      }
    } finally {
      setIsFetching(false);
    }
  }, [sos_id, sender_name]);

  // Start polling on mount; clear on unmount
  useEffect(() => {
    fetchSenderLocation(); // immediate first fetch
    pollRef.current = setInterval(fetchSenderLocation, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchSenderLocation]);

  // ── Leaflet map seeded with SENDER coordinates ────────────────────────────
  const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #0f172a; }
    .sos-marker { width: 22px; height: 22px; background: #dc2626; border: 3.5px solid #fff;
      border-radius: 50%; box-shadow: 0 0 16px rgba(220,38,38,0.9); position: relative; }
    .sos-pulse { position: absolute; top: -11px; left: -11px; width: 44px; height: 44px;
      border-radius: 50%; background: rgba(220,38,38,0.4); animation: pulse 1.6s infinite ease-out; }
    @keyframes pulse { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
    .sender-label { background: #dc2626; color: #fff; padding: 3px 7px; border-radius: 6px;
      font-size: 11px; font-weight: 700; white-space: nowrap; border: none; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initial position = SENDER's coordinates (from push payload)
    var initLat = ${senderLat};
    var initLng = ${senderLng};
    var senderName = ${JSON.stringify(senderDisplayName)};

    var map = L.map('map', { zoomControl: true, attributionControl: false })
               .setView([initLat, initLng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var sosIcon = L.divIcon({
      className: '',
      html: '<div class="sos-pulse"></div><div class="sos-marker"></div>',
      iconSize: [22, 22], iconAnchor: [11, 11]
    });

    // This marker ALWAYS represents the SOS sender
    var senderMarker = L.marker([initLat, initLng], { icon: sosIcon }).addTo(map);
    senderMarker.bindTooltip(senderName + ' (SOS)', {
      permanent: true, direction: 'top', className: 'sender-label', offset: [0, -12]
    }).openTooltip();

    /**
     * Called by React Native when a fresh server poll returns the sender's updated position.
     * Only the sender's coordinates are passed here — recipient coords are never injected.
     */
    window.moveSenderMarker = function(lat, lng) {
      senderMarker.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: true, duration: 1.0 });
    };
  </script>
</body>
</html>`;

  const openDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${senderLat},${senderLng}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Unable to open maps application.')
    );
  };

  const secondsAgo = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Animated.View style={[styles.sosBeacon, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="warning" size={18} color="#ffffff" />
          </Animated.View>
          <View>
            <Text style={styles.headerTitle}>🚨 SOS — {senderDisplayName}</Text>
            <Text style={styles.headerSub}>
              {sosStatus === 'active' ? 'Live emergency • tracking sender' : `Status: ${sosStatus}`}
            </Text>
          </View>
        </View>
        {isFetching && <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 4 }} />}
      </View>

      {/* Sender's live map — seeded and updated with SENDER coords only */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>

      {/* Info bar */}
      <View style={styles.infoBar}>
        <View style={styles.coordsBox}>
          <Text style={styles.coordsLabel}>SENDER'S LAST KNOWN POSITION</Text>
          <Text style={styles.coordsValue}>
            {senderLat.toFixed(5)}° N, {senderLng.toFixed(5)}° E
          </Text>
          <Text style={styles.updatedText}>
            {fetchError ? `⚠ ${fetchError}` : `Updated ${secondsAgo}s ago`}
          </Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={fetchSenderLocation} activeOpacity={0.75}>
          <Ionicons name="refresh" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Directions button */}
      <View style={[styles.actionsBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.directionsBtn} onPress={openDirections} activeOpacity={0.85}>
          <Ionicons name="navigate" size={18} color="#ffffff" />
          <Text style={styles.directionsBtnText}>Get Directions to {senderDisplayName}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b91c1c',
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sosBeacon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  mapContainer: { flex: 1 },
  webview: { flex: 1 },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  coordsBox: { flex: 1 },
  coordsLabel: { fontSize: 9, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.5 },
  coordsValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  updatedText: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 12,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  directionsBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
