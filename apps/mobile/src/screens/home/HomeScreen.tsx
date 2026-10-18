import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MainTabParamList, MainStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import { useSOSStore } from '../../store/sosStore';
import { useTheme } from '../../store/themeStore';
import { SafeScreen } from '../../components/common/SafeScreen';
import { SafetyScoreCard } from '../../components/home/SafetyScoreCard';
import { QuickActions } from '../../components/home/QuickActions';
import { RecentAlertsCard } from '../../components/home/RecentAlertsCard';
import { SOSCountdownModal } from '../../components/sos/SOSCountdownModal';
import { SafetyApi } from '../../api/safety';
import { AlertsApi } from '../../api/alerts';
import { IncidentsApi } from '../../api/incidents';
import { NotificationsApi } from '../../api/notifications';
import { ContactRequestsApi } from '../../api/contactRequests';
import { DEFAULT_COORDS } from '../../config/env';
import { SOSRequest } from '../../types';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;
type StackNav = NativeStackNavigationProp<MainStackParamList>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const rootNavigation = useNavigation<StackNav>();
  const { user } = useAuthStore();
  const { activeSOS, checkActiveSOS } = useSOSStore();
  const { colors, isDark } = useTheme();

  // GPS location state — start with default, upgrade to real GPS
  const [coords, setCoords] = useState({
    latitude: DEFAULT_COORDS.latitude,
    longitude: DEFAULT_COORDS.longitude,
  });
  const [locationName, setLocationName] = useState(DEFAULT_COORDS.cityName);
  const [isUsingGPS, setIsUsingGPS] = useState(false);
  const [isCountdownOpen, setIsCountdownOpen] = useState(false);

  // Check active SOS and acquire GPS on mount
  useEffect(() => {
    checkActiveSOS();
    acquireGPS();
  }, [checkActiveSOS]);

  const acquireGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const newCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCoords(newCoords);
      setIsUsingGPS(true);

      // Trigger server-side location safety check (unsafe area & nearby incident alerts)
      ContactRequestsApi.checkLocation(newCoords.latitude, newCoords.longitude).catch(() => {});

      // Reverse geocode to get a readable location name
      try {
        const [geo] = await Location.reverseGeocodeAsync(newCoords);
        if (geo) {
          const parts = [
            geo.district || geo.subregion || geo.name,
            geo.city || geo.region,
          ].filter(Boolean);
          if (parts.length > 0) setLocationName(parts.join(', '));
        }
      } catch {
        // keep default name
      }
    } catch {
      // GPS failed — stay with DEFAULT_COORDS silently
    }
  };

  // 1. Fetch Area Safety Score
  const {
    data: safetyScore,
    isLoading: isSafetyLoading,
    refetch: refetchSafety,
    isRefetching: isRefetchingSafety,
  } = useQuery({
    queryKey: ['area-safety-score', coords.latitude, coords.longitude],
    queryFn: () => SafetyApi.getAreaScore(coords.latitude, coords.longitude, 2.0),
    staleTime: 60000,
  });

  // 2. Fetch Nearby Incidents
  const {
    data: nearbyIncidents = [],
    isLoading: isNearbyLoading,
    refetch: refetchNearby,
  } = useQuery({
    queryKey: ['nearby-incidents-home', coords.latitude, coords.longitude],
    queryFn: () => IncidentsApi.getNearby(coords.latitude, coords.longitude, 5.0),
    staleTime: 60000,
  });

  // 3. Fetch Active Alerts
  const {
    data: alertsData,
    isLoading: isAlertsLoading,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['active-alerts-home'],
    queryFn: () => AlertsApi.listActive(1, 5),
    staleTime: 60000,
  });

  // 4. Fetch notification count for top bell badge
  const { data: notifData } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: NotificationsApi.list,
    staleTime: 15000,
  });

  const activeAlerts = alertsData?.items ?? [];
  const unreadCount = notifData?.unread_count || 0;

  const handleRefresh = async () => {
    await Promise.all([
      refetchSafety(),
      refetchNearby(),
      refetchAlerts(),
      checkActiveSOS(),
      acquireGPS(),
    ]);
  };

  const isRefreshing = isRefetchingSafety;

  const handleTriggerSOS = () => {
    if (activeSOS) {
      rootNavigation.navigate('ActiveSOS');
    } else {
      setIsCountdownOpen(true);
    }
  };

  const handleSOSSuccess = (sos: SOSRequest) => {
    setIsCountdownOpen(false);
    rootNavigation.navigate('ActiveSOS');
  };

  return (
    <SafeScreen backgroundColor={colors.background}>
      {/* Top Bar / Header */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.userGreeting}>
          <Text style={[styles.greetingPrefix, { color: colors.textSecondary }]}>Hello,</Text>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.full_name || 'Citizen'}</Text>
        </View>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={[styles.notificationBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => rootNavigation.navigate('Chat')}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={19} color={colors.primary} />
            <View style={[styles.aiDot, { backgroundColor: '#10b981' }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.notificationBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => rootNavigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.alert }]}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Active Emergency Floating Banner if SOS is Active */}
        {activeSOS && (
          <TouchableOpacity
            style={styles.activeSosBanner}
            onPress={() => rootNavigation.navigate('ActiveSOS')}
            activeOpacity={0.85}
          >
            <View style={styles.activeSosIconWrap}>
              <Ionicons name="warning" size={22} color="#ffffff" />
            </View>
            <View style={styles.activeSosTextWrap}>
              <Text style={styles.activeSosTitle}>EMERGENCY SOS IS ACTIVE</Text>
              <Text style={styles.activeSosSub}>
                Live GPS updates transmitting • Tap to view status
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ffffff" />
          </TouchableOpacity>
        )}

        {/* Safety Score Widget */}
        <SafetyScoreCard
          safetyScore={safetyScore}
          isLoading={isSafetyLoading}
          locationName={isUsingGPS ? locationName : `${locationName} (default)`}
        />

        {/* Quick Actions (Safe Route, Report, Map, SOS) */}
        <QuickActions
          onNavigateRoutes={() => navigation.navigate('SafeRoute')}
          onNavigateReport={() => navigation.navigate('Report')}
          onNavigateMap={() => navigation.navigate('Explore')}
          onTriggerSOS={handleTriggerSOS}
        />

        {/* Community Alerts Section */}
        <RecentAlertsCard
          alerts={activeAlerts}
          isLoading={isAlertsLoading}
        />

        {/* Learning Hub & Safety Guides Shortcuts */}
        <View style={[styles.learningCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.learningHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="book-outline" size={20} color={colors.primary} />
              <Text style={[styles.learningTitle, { color: colors.textPrimary }]}>
                Safety Guides & Learning
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => rootNavigation.navigate('LearningHub')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>View all</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.learningSub, { color: colors.textSecondary }]}>
            Official advice, emergency steps, and national helpline directories.
          </Text>

          <View style={styles.learningShortcutsGrid}>
            {[
              { title: "Women's Safety", icon: '👩‍🦰' },
              { title: 'Night Travel', icon: '🌙' },
              { title: 'Helplines', icon: '📞' },
              { title: 'Legal Rights', icon: '⚖️' },
            ].map((item) => (
              <TouchableOpacity
                key={item.title}
                style={[styles.learningShortcutItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => rootNavigation.navigate('LearningHub')}
                activeOpacity={0.75}
              >
                <Text style={styles.learningShortcutIcon}>{item.icon}</Text>
                <Text style={[styles.learningShortcutTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nearby Incidents Summary Banner */}
        <View
          style={[
            styles.nearbyBanner,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.nearbyIconWrap, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="shield-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.nearbyTextWrap}>
            <Text style={[styles.nearbyTitle, { color: colors.textPrimary }]}>
              {nearbyIncidents.length} Incident{nearbyIncidents.length === 1 ? '' : 's'} Reported in 5km
            </Text>
            <Text style={[styles.nearbySub, { color: colors.textMuted }]}>
              Data synchronized with City Safety Database
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.viewMapLink, { backgroundColor: colors.primaryLight }]}
            onPress={() => navigation.navigate('Explore')}
          >
            <Text style={[styles.viewMapText, { color: colors.primaryDark }]}>View Map</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* SOS Countdown & Activation Modal */}
      <SOSCountdownModal
        visible={isCountdownOpen}
        onCancel={() => setIsCountdownOpen(false)}
        onSuccess={handleSOSSuccess}
      />
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  activeSosBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  activeSosIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSosTextWrap: {
    flex: 1,
  },
  activeSosTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  activeSosSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  userGreeting: {
    flex: 1,
  },
  greetingPrefix: {
    fontSize: 13,
    fontWeight: '500',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  notificationBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  learningCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  learningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  learningTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  learningSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  learningShortcutsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  learningShortcutItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  learningShortcutIcon: {
    fontSize: 20,
  },
  learningShortcutTitle: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  nearbyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  nearbyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyTextWrap: {
    flex: 1,
  },
  nearbyTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  nearbySub: {
    fontSize: 11,
    marginTop: 2,
  },
  viewMapLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  viewMapText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
