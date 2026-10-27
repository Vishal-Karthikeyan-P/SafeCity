/**
 * ExploreScreen — Complete redesign of the Explore (Map + Incidents) tab.
 *
 * Features:
 * ─ Map/List toggle with synchronized state
 * ─ Full-text search bar
 * ─ Comprehensive filters: severity, category, verification status, date range
 * ─ "Show unverified" toggle
 * ─ Backend safety score shown for any tapped map location
 * ─ Heatmap layer toggle with legend
 * ─ Incident markers linked to IncidentDetailsScreen
 * ─ All filter/map/list states kept in sync
 * ─ Loading, empty, and error states
 * ─ Safe-area & keyboard aware
 *
 * All safety calculations are backend-computed — never duplicated on mobile.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { IncidentsApi, HeatmapPoint } from '../../api/incidents';
import { SafetyApi } from '../../api/safety';
import { MainStackParamList } from '../../types/navigation';
import { Incident, IncidentCategory, SeverityLevel, IncidentStatus, AreaSafetyScore } from '../../types';
import { useTheme } from '../../store/themeStore';
import { DEFAULT_COORDS } from '../../config/env';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_OPTIONS: { value: SeverityLevel | null; label: string; color: string }[] = [
  { value: null,       label: 'All',      color: '#94a3b8' },
  { value: 'critical', label: 'Critical', color: '#ef4444' },
  { value: 'high',     label: 'High',     color: '#f97316' },
  { value: 'medium',   label: 'Medium',   color: '#f59e0b' },
  { value: 'low',      label: 'Low',      color: '#22c55e' },
];

const STATUS_OPTIONS: { value: IncidentStatus | null; label: string }[] = [
  { value: null,                label: 'Verified' },
  { value: 'approved',          label: 'Verified' },
  { value: 'pending',           label: 'Pending' },
  { value: 'under_review',      label: 'Under Review' },
  { value: 'resolved',          label: 'Resolved' },
  { value: 'resolved_unverified', label: 'Resolved (Unverified)' },
  { value: 'rejected',          label: 'Rejected' },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`;
}

// ─── Safety Score Overlay Card ────────────────────────────────────────────────

interface SafetyScoreCardProps {
  score: AreaSafetyScore | null | undefined;
  isLoading: boolean;
  lat: number;
  lng: number;
  onClose: () => void;
}

const SafetyScoreCard: React.FC<SafetyScoreCardProps> = ({ score, isLoading, lat, lng, onClose }) => {
  const { colors } = useTheme();
  if (!score && !isLoading) return null;

  const riskColor = score?.risk_level === 'safe' ? '#22c55e' : score?.risk_level === 'moderate' ? '#f59e0b' : '#ef4444';
  const riskLabel = score?.risk_level === 'safe' ? 'Safe Area' : score?.risk_level === 'moderate' ? 'Moderate Risk' : 'High Risk';

  return (
    <View style={[ssStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={ssStyles.header}>
        <View style={ssStyles.titleCol}>
          <Text style={[ssStyles.title, { color: colors.textPrimary }]}>Area Safety (1 km radius)</Text>
          <Text style={[ssStyles.coords, { color: colors.textMuted }]}>{lat.toFixed(4)}, {lng.toFixed(4)}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
      ) : score ? (
        <>
          <View style={ssStyles.scoreRow}>
            <Text style={[ssStyles.scoreNum, { color: riskColor }]}>{Math.round(score.score)}</Text>
            <Text style={[ssStyles.scoreLabel, { color: colors.textMuted }]}>/100</Text>
            <View style={[ssStyles.riskBadge, { backgroundColor: riskColor + '22' }]}>
              <Text style={[ssStyles.riskText, { color: riskColor }]}>{riskLabel.toUpperCase()}</Text>
            </View>
          </View>
          <View style={ssStyles.statsRow}>
            <View style={ssStyles.stat}>
              <Text style={[ssStyles.statVal, { color: colors.textPrimary }]}>{score.incident_count}</Text>
              <Text style={[ssStyles.statLbl, { color: colors.textMuted }]}>Within 1 km</Text>
            </View>
            <View style={ssStyles.stat}>
              <Text style={[ssStyles.statVal, { color: colors.textPrimary }]}>{score.density_per_km2 ?? (score.incident_count / 3.14).toFixed(1)}</Text>
              <Text style={[ssStyles.statLbl, { color: colors.textMuted }]}>Density/km²</Text>
            </View>
            <View style={ssStyles.stat}>
              <Text style={[ssStyles.statVal, { color: colors.textPrimary }]}>{score.recent_7d}</Text>
              <Text style={[ssStyles.statLbl, { color: colors.textMuted }]}>Last 7d</Text>
            </View>
            <View style={ssStyles.stat}>
              <Text style={[ssStyles.statVal, { color: colors.textPrimary }]}>{score.recent_30d}</Text>
              <Text style={[ssStyles.statLbl, { color: colors.textMuted }]}>Last 30d</Text>
            </View>
          </View>
          {score.top_categories.length > 0 ? (
            <View style={ssStyles.topCats}>
              {score.top_categories.slice(0, 3).map((c) => (
                <View key={c.name} style={[ssStyles.topCat, { backgroundColor: colors.background }]}>
                  <Text>{c.icon}</Text>
                  <Text style={[ssStyles.topCatName, { color: colors.textSecondary }]}>{c.name}</Text>
                  <Text style={[ssStyles.topCatCount, { color: colors.textMuted }]}>×{c.count}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[ssStyles.clearMsg, { color: '#22c55e' }]}>✓ No incidents reported in this 1 km area</Text>
          )}
        </>
      ) : null}
    </View>
  );
};

const ssStyles = StyleSheet.create({
  card: { position: 'absolute', bottom: 80, left: 12, right: 12, borderRadius: 16, borderWidth: 1, padding: 14, zIndex: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  titleCol: { gap: 2 },
  title: { fontSize: 14, fontWeight: '700' },
  coords: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 10 },
  scoreNum: { fontSize: 36, fontWeight: '900' },
  scoreLabel: { fontSize: 16, fontWeight: '600' },
  riskBadge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  riskText: { fontSize: 11, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLbl: { fontSize: 10, fontWeight: '600' },
  topCats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  topCat: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  topCatName: { fontSize: 11, fontWeight: '600' },
  topCatCount: { fontSize: 10 },
  clearMsg: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});

// ─── Filter Drawer ─────────────────────────────────────────────────────────────

interface FilterState {
  severity: SeverityLevel | null;
  categoryId: string | null;
  showUnverified: boolean;
  dateFrom: string;
  dateTo: string;
}

interface FilterDrawerProps {
  visible: boolean;
  filters: FilterState;
  categories: IncidentCategory[];
  onApply: (f: FilterState) => void;
  onClose: () => void;
}

const FilterDrawer: React.FC<FilterDrawerProps> = ({ visible, filters, categories, onApply, onClose }) => {
  const { colors } = useTheme();
  const [local, setLocal] = useState<FilterState>(filters);

  useEffect(() => { if (visible) setLocal(filters); }, [visible, filters]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={fdStyles.overlay} onPress={onClose} />
      <View style={[fdStyles.sheet, { backgroundColor: colors.surface }]}>
        <View style={fdStyles.handle} />
        <Text style={[fdStyles.title, { color: colors.textPrimary }]}>Filters</Text>

        {/* Severity */}
        <Text style={[fdStyles.label, { color: colors.textMuted }]}>SEVERITY</Text>
        <View style={fdStyles.chips}>
          {SEVERITY_OPTIONS.map((s) => {
            const active = local.severity === s.value;
            return (
              <TouchableOpacity
                key={String(s.value)}
                style={[fdStyles.chip, active && { backgroundColor: s.color, borderColor: s.color }]}
                onPress={() => setLocal((p) => ({ ...p, severity: s.value }))}
              >
                {s.value && <View style={[fdStyles.dot, { backgroundColor: active ? '#fff' : s.color }]} />}
                <Text style={[fdStyles.chipText, active && { color: '#fff' }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category */}
        <Text style={[fdStyles.label, { color: colors.textMuted }]}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <TouchableOpacity
            style={[fdStyles.chip, local.categoryId === null && fdStyles.chipActiveBlue]}
            onPress={() => setLocal((p) => ({ ...p, categoryId: null }))}
          >
            <Text style={[fdStyles.chipText, local.categoryId === null && { color: '#fff' }]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat) => {
            const active = local.categoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[fdStyles.chip, active && fdStyles.chipActiveBlue]}
                onPress={() => setLocal((p) => ({ ...p, categoryId: active ? null : cat.id }))}
              >
                <Text>{cat.icon}</Text>
                <Text style={[fdStyles.chipText, active && { color: '#fff' }]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Show unverified */}
        <TouchableOpacity
          style={[fdStyles.toggleRow, { borderColor: colors.border }]}
          onPress={() => setLocal((p) => ({ ...p, showUnverified: !p.showUnverified }))}
        >
          <View>
            <Text style={[fdStyles.toggleTitle, { color: colors.textPrimary }]}>Include Unverified</Text>
            <Text style={[fdStyles.toggleSub, { color: colors.textMuted }]}>Show pending/under-review incidents</Text>
          </View>
          <View style={[fdStyles.toggle, local.showUnverified && fdStyles.toggleOn]}>
            <View style={[fdStyles.toggleThumb, local.showUnverified && fdStyles.toggleThumbOn]} />
          </View>
        </TouchableOpacity>

        {/* Action buttons */}
        <View style={fdStyles.actions}>
          <TouchableOpacity
            style={[fdStyles.resetBtn, { borderColor: colors.border }]}
            onPress={() => setLocal({ severity: null, categoryId: null, showUnverified: false, dateFrom: '', dateTo: '' })}
          >
            <Text style={[fdStyles.resetText, { color: colors.textSecondary }]}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={fdStyles.applyBtn} onPress={() => { onApply(local); onClose(); }}>
            <Text style={fdStyles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const fdStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#cbd5e1', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActiveBlue: { backgroundColor: '#1d7eeb', borderColor: '#1d7eeb' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, padding: 14, borderRadius: 12, marginBottom: 20 },
  toggleTitle: { fontSize: 14, fontWeight: '700' },
  toggleSub: { fontSize: 12, marginTop: 2 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#e2e8f0', justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: '#1d7eeb' },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  actions: { flexDirection: 'row', gap: 10 },
  resetBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  resetText: { fontSize: 14, fontWeight: '600' },
  applyBtn: { flex: 2, alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: '#1d7eeb' },
  applyText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ─── Incident List Card ────────────────────────────────────────────────────────

interface IncidentCardProps {
  incident: Incident;
  userLat: number;
  userLng: number;
  onPress: () => void;
}

const IncidentCard: React.FC<IncidentCardProps> = ({ incident, userLat, userLng, onPress }) => {
  const { colors } = useTheme();
  const dist = haversineKm(userLat, userLng, incident.location_lat, incident.location_lng);
  const sev = incident.severity;
  const sevColor = sev === 'critical' ? '#ef4444' : sev === 'high' ? '#f97316' : sev === 'medium' ? '#f59e0b' : '#22c55e';
  const isVerified = incident.status === 'approved' || incident.status === 'resolved';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[icStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={icStyles.left}>
        <View style={[icStyles.iconWrap, { backgroundColor: colors.background }]}>
          <Text style={icStyles.icon}>{incident.category?.icon ?? '📍'}</Text>
        </View>
      </View>
      <View style={icStyles.body}>
        <View style={icStyles.titleRow}>
          <Text style={[icStyles.title, { color: colors.textPrimary }]} numberOfLines={1}>{incident.title}</Text>
          {isVerified && <Ionicons name="checkmark-circle" size={14} color="#22c55e" />}
        </View>
        <Text style={[icStyles.catName, { color: colors.textMuted }]}>{incident.category?.name ?? 'General'}</Text>
        <Text style={[icStyles.desc, { color: colors.textSecondary }]} numberOfLines={2}>{incident.description}</Text>
        <View style={icStyles.footer}>
          <View style={[icStyles.sevBadge, { backgroundColor: sevColor + '22' }]}>
            <View style={[icStyles.sevDot, { backgroundColor: sevColor }]} />
            <Text style={[icStyles.sevText, { color: sevColor }]}>{sev}</Text>
          </View>
          <Text style={[icStyles.meta, { color: colors.textMuted }]}>{dist.toFixed(1)} km • {formatAgo(incident.created_at)}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
};

const icStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginVertical: 5, borderRadius: 14, borderWidth: 1, padding: 12, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  left: {},
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { fontSize: 14, fontWeight: '700', flex: 1 },
  catName: { fontSize: 11, fontWeight: '600' },
  desc: { fontSize: 12, lineHeight: 17 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sevBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  sevDot: { width: 5, height: 5, borderRadius: 2.5 },
  sevText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  meta: { fontSize: 11 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const ExploreScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    severity: null,
    categoryId: null,
    showUnverified: false,
    dateFrom: '',
    dateTo: '',
  });

  // Safety score overlay state — shown when user taps a location on the map
  const [locationScoreCoords, setLocationScoreCoords] = useState<{ lat: number; lng: number } | null>(null);

  // User location
  const [userCoords, setUserCoords] = useState({ latitude: DEFAULT_COORDS.latitude, longitude: DEFAULT_COORDS.longitude });
  const [hasGps, setHasGps] = useState<boolean | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const webViewRef = useRef<WebView>(null);

  // Acquire GPS
  const acquireGPS = useCallback(async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setHasGps(true);
      } else {
        setHasGps(false);
      }
    } catch { setHasGps(false); }
    finally { setIsLocating(false); }
  }, []);

  useEffect(() => { acquireGPS(); }, [acquireGPS]);

  // Categories
  const { data: categories = [] } = useQuery({ queryKey: ['incident-categories'], queryFn: IncidentsApi.getCategories });

  // Incidents — query backend listFiltered with limit 500, matching web app
  const {
    data: rawIncidentsData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: [
      'explore-incidents',
      filters.severity,
      filters.categoryId,
      filters.showUnverified,
      filters.dateFrom,
      filters.dateTo,
      searchText,
    ],
    queryFn: async () => {
      const res = await IncidentsApi.listFiltered({
        limit: 500,
        status: filters.showUnverified ? undefined : 'approved',
        severity: filters.severity ?? undefined,
        category_id: filters.categoryId ?? undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        search: searchText.trim() || undefined,
      });
      return res.items || [];
    },
  });

  const rawIncidents = rawIncidentsData ?? [];

  // Heatmap data (only fetched when toggled on, matching web filters)
  const { data: heatmapData = [] } = useQuery<HeatmapPoint[]>({
    queryKey: ['heatmap', filters.categoryId, filters.severity, filters.dateFrom, filters.dateTo],
    queryFn: () =>
      IncidentsApi.getHeatmap({
        category_id: filters.categoryId ?? undefined,
        severity: filters.severity ?? undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      }),
    enabled: showHeatmap,
  });

  // Safety score for tapped location
  const { data: locationScore, isLoading: isScoreLoading } = useQuery<AreaSafetyScore>({
    queryKey: ['location-score', locationScoreCoords?.lat, locationScoreCoords?.lng],
    queryFn: () => SafetyApi.getAreaScore(locationScoreCoords!.lat, locationScoreCoords!.lng, 1.0),
    enabled: !!locationScoreCoords,
    staleTime: 60_000,
  });

  // Filtered incidents: respect unverified toggle
  const incidents = useMemo(() => {
    return rawIncidents.filter((inc) => {
      if (!filters.showUnverified && inc.status !== 'approved' && inc.status !== 'resolved') {
        return false;
      }
      return true;
    });
  }, [rawIncidents, filters.showUnverified]);

  // Active filter count for badge
  const activeFilterCount = [filters.severity, filters.categoryId, filters.showUnverified, filters.dateFrom, filters.dateTo].filter(Boolean).length;

  // Build Leaflet HTML
  const leafletHtml = useMemo(() => {
    const lat0 = userCoords.latitude;
    const lng0 = userCoords.longitude;

    const markers = incidents.map((inc) => ({
      id: inc.id,
      lat: inc.location_lat,
      lng: inc.location_lng,
      title: inc.title.replace(/'/g, "\\'"),
      icon: inc.category?.icon ?? '📍',
      cat: (inc.category?.name ?? 'Hazard').replace(/'/g, "\\'"),
      sev: inc.severity,
      status: inc.status,
      verified: inc.status === 'approved' || inc.status === 'resolved',
    }));

    // Heatmap points with normalized weights matching web
    const heatPoints = showHeatmap ? heatmapData.map((p) => [p.lat, p.lng, Math.max(0.5, p.weight || 1)]) : [];
    const heatMax = heatPoints.length > 0 ? heatPoints.reduce((m, p) => Math.max(m, p[2]), 1) : 1;

    const selLat = locationScoreCoords ? locationScoreCoords.lat : null;
    const selLng = locationScoreCoords ? locationScoreCoords.lng : null;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  ${showHeatmap ? '<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>' : ''}
  <style>
    html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#0f172a;}
    .user-marker{width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(59,130,246,.8);}
    .user-pulse{position:absolute;top:-8px;left:-8px;width:32px;height:32px;border-radius:50%;background:rgba(59,130,246,.3);animation:pulse 2s infinite ease-out;}
    @keyframes pulse{0%{transform:scale(.5);opacity:1}100%{transform:scale(1.6);opacity:0}}
    @keyframes ping{0%{transform:scale(1);opacity:.8}75%,100%{transform:scale(2.2);opacity:0}}
    .pin{width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;cursor:pointer;}
    .pin-icon{transform:rotate(45deg);font-size:13px;display:inline-block;}
    .unverified-wrap{position:relative;width:28px;height:34px;}
    .pin-unverified{background:#6b7280!important;border:2px dashed #e2e8f0;opacity:0.9;}
    .unverified-badge{position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:#1f2937;border:1.5px solid #fff;border-radius:50%;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;z-index:10;}
    .leaflet-control-zoom a{background:#fff!important;color:#0f172a!important;border:none!important;width:32px!important;height:32px!important;line-height:32px!important;}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:true,attributionControl:false}).setView([${lat0},${lng0}],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  // User location marker
  var uIcon=L.divIcon({className:'',html:'<div class="user-pulse"></div><div class="user-marker"></div>',iconSize:[16,16],iconAnchor:[8,8]});
  L.marker([${lat0},${lng0}],{icon:uIcon,zIndexOffset:1000}).addTo(map);

  var sevColors={critical:'#ef4444',high:'#f97316',medium:'#f59e0b',low:'#22c55e'};
  var mLayer=L.layerGroup().addTo(map);

  var markersData=${JSON.stringify(markers)};
  markersData.forEach(function(inc){
    var col=inc.verified ? (sevColors[inc.sev]||'#6b7280') : '#6b7280';
    var pinClass='pin' + (inc.verified ? '' : ' pin-unverified');
    var html='';
    if (inc.verified) {
      html = '<div class="'+pinClass+'" style="background:'+col+'"><span class="pin-icon">'+inc.icon+'</span></div>';
    } else {
      html = '<div class="unverified-wrap">' +
             '<div class="'+pinClass+'" style="background:'+col+'"><span class="pin-icon" style="filter:grayscale(100%);">'+inc.icon+'</span></div>' +
             '<div class="unverified-badge">?</div>' +
             '</div>';
    }
    var ico=L.divIcon({className:'',html:html,iconSize:[28,34],iconAnchor:[14,34]});
    var m=L.marker([inc.lat,inc.lng],{icon:ico});
    m.on('click',function(e){
      L.DomEvent.stopPropagation(e);
      if(window.ReactNativeWebView){
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'SELECT_INCIDENT',id:inc.id}));
      }
    });
    mLayer.addLayer(m);
  });

  // Heatmap layer — matching web parameters, intensity, and 5-stop gradient
  ${showHeatmap && heatPoints.length > 0 ? `
  var heatData=${JSON.stringify(heatPoints)};
  L.heatLayer(heatData, {
    radius: 35,
    blur: 20,
    minOpacity: 0.4,
    maxZoom: 18,
    max: ${heatMax},
    gradient: { 0.2: '#3b82f6', 0.4: '#22c55e', 0.6: '#eab308', 0.8: '#f97316', 1.0: '#ef4444' }
  }).addTo(map);
  ` : ''}

  // Selected Area pin & 1 km radius circle
  var selectedPin = null;
  var selectedCircle = null;

  function renderSelectedArea(lat, lng) {
    if (selectedPin) { map.removeLayer(selectedPin); selectedPin = null; }
    if (selectedCircle) { map.removeLayer(selectedCircle); selectedCircle = null; }
    if (lat == null || lng == null) return;

    var pinHtml = '<div style="position:relative;width:32px;height:32px;">' +
      '<div style="position:absolute;width:100%;height:100%;border-radius:50%;background:#ef4444;opacity:0.4;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>' +
      '<div style="position:relative;width:32px;height:32px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;">📍</div>' +
      '</div>';
    var pIco = L.divIcon({ className: '', html: pinHtml, iconSize: [32, 32], iconAnchor: [16, 32] });
    selectedPin = L.marker([lat, lng], { icon: pIco, zIndexOffset: 2000 }).addTo(map);

    selectedCircle = L.circle([lat, lng], {
      radius: 1000,
      color: '#1d4ed8',
      weight: 2,
      opacity: 0.85,
      dashArray: '8 6',
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      interactive: false
    }).addTo(map);
  }

  ${selLat !== null && selLng !== null ? `renderSelectedArea(${selLat}, ${selLng});` : ''}

  window.setSelectedArea = function(lat, lng) {
    renderSelectedArea(lat, lng);
  };

  window.clearSelectedArea = function() {
    renderSelectedArea(null, null);
  };

  // Tap on map → request safety score for that location & render pin/radius
  map.on('click',function(e){
    renderSelectedArea(e.latlng.lat, e.latlng.lng);
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'MAP_TAP',lat:e.latlng.lat,lng:e.latlng.lng}));
    }
  });

  window.centerOnUser=function(lat,lng){map.flyTo([lat,lng],15,{animate:true,duration:1.0});};
</script>
</body>
</html>`;
  }, [userCoords, incidents, showHeatmap, heatmapData, locationScoreCoords]);

  // WebView message handler
  const handleMessage = useCallback((evt: any) => {
    try {
      const msg = JSON.parse(evt.nativeEvent.data);
      if (msg.type === 'SELECT_INCIDENT') {
        const found = incidents.find((i) => i.id === msg.id);
        if (found) navigation.navigate('IncidentDetails', { incident: found });
      } else if (msg.type === 'MAP_TAP') {
        setLocationScoreCoords({ lat: msg.lat, lng: msg.lng });
      }
    } catch {}
  }, [incidents, navigation]);

  const handleCloseScoreCard = useCallback(() => {
    setLocationScoreCoords(null);
    webViewRef.current?.injectJavaScript('if(window.clearSelectedArea){window.clearSelectedArea();}true;');
  }, []);

  const centerOnUser = useCallback(() => {
    webViewRef.current?.injectJavaScript(
      `if(window.centerOnUser){window.centerOnUser(${userCoords.latitude},${userCoords.longitude});}true;`
    );
  }, [userCoords]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Top Search + Controls ─────────────────────────────────────────────── */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        {/* Search bar */}
        <View style={[styles.searchRow]}>
          <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={17} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search incidents..."
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options-outline" size={19} color={activeFilterCount > 0 ? colors.primary : colors.textMuted} />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Map/List toggle */}
          <View style={[styles.togglePill, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.pillBtn, viewMode === 'map' && { backgroundColor: colors.primary }]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons name="map-outline" size={16} color={viewMode === 'map' ? '#fff' : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillBtn, viewMode === 'list' && { backgroundColor: colors.primary }]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list-outline" size={16} color={viewMode === 'list' ? '#fff' : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingBottom: 8 }}>
            {filters.severity && (
              <TouchableOpacity style={[styles.activeChip, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]} onPress={() => setFilters((p) => ({ ...p, severity: null }))}>
                <Text style={[styles.activeChipText, { color: colors.primary }]}>{filters.severity}</Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            )}
            {filters.categoryId && (
              <TouchableOpacity style={[styles.activeChip, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]} onPress={() => setFilters((p) => ({ ...p, categoryId: null }))}>
                <Text style={[styles.activeChipText, { color: colors.primary }]}>{categories.find((c) => c.id === filters.categoryId)?.name ?? 'Category'}</Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </TouchableOpacity>
            )}
            {filters.showUnverified && (
              <TouchableOpacity style={[styles.activeChip, { backgroundColor: colors.warning + '22', borderColor: colors.warning }]} onPress={() => setFilters((p) => ({ ...p, showUnverified: false }))}>
                <Text style={[styles.activeChipText, { color: colors.warning }]}>+Unverified</Text>
                <Ionicons name="close" size={12} color={colors.warning} />
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>

      {/* ── Stats Bar ─────────────────────────────────────────────────────────── */}
      <View style={[styles.statsBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: colors.textPrimary }]}>{incidents.length}</Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>Nearby</Text>
        </View>
        <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: '#ef4444' }]}>{incidents.filter((i) => i.severity === 'critical' || i.severity === 'high').length}</Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>High Risk</Text>
        </View>
        <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: '#22c55e' }]}>{incidents.filter((i) => i.status === 'approved').length}</Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>Verified</Text>
        </View>

        {/* Heatmap toggle */}
        <TouchableOpacity
          style={[styles.heatmapBtn, showHeatmap && { backgroundColor: '#ef444422' }]}
          onPress={() => { setShowHeatmap(!showHeatmap); setShowLegend(!showHeatmap); }}
        >
          <Text style={{ fontSize: 14 }}>🔥</Text>
          <Text style={[styles.heatmapText, { color: showHeatmap ? '#ef4444' : colors.textMuted }]}>
            {showHeatmap ? 'On' : 'Heatmap'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Legend ─────────────────────────────────────────────────────────────── */}
      {showLegend && showHeatmap && (
        <View style={[styles.legend, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.legendBarWrap}>
            <View style={styles.legendGradientBar}>
              <View style={[styles.gradStop, { backgroundColor: '#3b82f6' }]} />
              <View style={[styles.gradStop, { backgroundColor: '#22c55e' }]} />
              <View style={[styles.gradStop, { backgroundColor: '#eab308' }]} />
              <View style={[styles.gradStop, { backgroundColor: '#f97316' }]} />
              <View style={[styles.gradStop, { backgroundColor: '#ef4444' }]} />
            </View>
            <View style={styles.legendLabels}>
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Low</Text>
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Moderate</Text>
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>High Risk</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowLegend(false)} style={styles.legendClose}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading incidents...</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Connection Error</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: leafletHtml }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleMessage}
          />

          {/* FAB — center on user */}
          <TouchableOpacity style={[styles.fab, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={centerOnUser} activeOpacity={0.8}>
            <Ionicons name={isLocating ? 'hourglass-outline' : 'navigate'} size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* Safety score overlay */}
          {locationScoreCoords && (
            <SafetyScoreCard
              score={locationScore}
              isLoading={isScoreLoading}
              lat={locationScoreCoords.lat}
              lng={locationScoreCoords.lng}
              onClose={handleCloseScoreCard}
            />
          )}

          {/* Map summary strip */}
          <View style={[styles.mapStrip, { backgroundColor: colors.surface + 'ee', borderTopColor: colors.border }]}>
            <View style={styles.mapStripLeft}>
              <View style={styles.pulseGreen} />
              <Text style={[styles.mapStripText, { color: colors.textSecondary }]}>
                {incidents.length} active incident{incidents.length !== 1 ? 's' : ''}
                {filters.showUnverified ? ' (incl. unverified)' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => refetch()}>
              <Ionicons name="refresh" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <IncidentCard
              incident={item}
              userLat={userCoords.latitude}
              userLng={userCoords.longitude}
              onPress={() => navigation.navigate('IncidentDetails', { incident: item })}
            />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListHeaderComponent={
            incidents.length > 0 ? (
              <Text style={[styles.listHeader, { color: colors.textMuted }]}>
                {incidents.length} incidents found
                {hasGps === false ? ' (using city center)' : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="shield-checkmark-outline" size={56} color={colors.safe} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {searchText ? 'No Results' : 'All Clear!'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                {searchText
                  ? `No incidents match "${searchText}"`
                  : 'No incidents match your filters in this area.'}
              </Text>
              {searchText || activeFilterCount > 0 ? (
                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
                  onPress={() => { setSearchText(''); setFilters({ severity: null, categoryId: null, showUnverified: false, dateFrom: '', dateTo: '' }); }}
                >
                  <Text style={styles.retryText}>Clear Filters</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {/* GPS denied banner */}
      {hasGps === false && (
        <View style={[styles.gpsBanner, { backgroundColor: '#fef3c7' }]}>
          <Ionicons name="warning-outline" size={15} color="#d97706" />
          <Text style={styles.gpsBannerText}>GPS unavailable — showing city center</Text>
          <TouchableOpacity onPress={acquireGPS}>
            <Text style={styles.gpsBannerBtn}>Enable</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Drawer */}
      <FilterDrawer
        visible={showFilters}
        filters={filters}
        categories={categories}
        onApply={setFilters}
        onClose={() => setShowFilters(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { borderBottomWidth: 1, paddingBottom: 0 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, position: 'relative' },
  filterBadge: { position: 'absolute', top: -3, right: -3, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  togglePill: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  pillBtn: { paddingHorizontal: 10, paddingVertical: 9 },
  chipRow: { marginTop: -2 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  activeChipText: { fontSize: 12, fontWeight: '600' },

  statsBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1, gap: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 17, fontWeight: '800' },
  statLbl: { fontSize: 10, fontWeight: '600' },
  statDiv: { width: 1, height: 28 },
  heatmapBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  heatmapText: { fontSize: 11, fontWeight: '700' },

  legend: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, gap: 10 },
  legendBarWrap: { flex: 1, gap: 4 },
  legendGradientBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  gradStop: { flex: 1, height: '100%' },
  legendLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  legendLabel: { fontSize: 10, fontWeight: '600' },
  legendClose: { padding: 4 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadingText: { fontSize: 14, marginTop: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  mapContainer: { flex: 1, position: 'relative' },
  webview: { flex: 1 },
  fab: { position: 'absolute', bottom: 48, right: 14, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  mapStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1 },
  mapStripLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pulseGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  mapStripText: { fontSize: 12, fontWeight: '500' },

  listContent: { paddingTop: 8 },
  listHeader: { fontSize: 12, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  gpsBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, gap: 8 },
  gpsBannerText: { flex: 1, fontSize: 12, color: '#92400e' },
  gpsBannerBtn: { fontSize: 12, fontWeight: '700', color: '#1d7eeb' },
});
