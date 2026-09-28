import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList, MainStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import { useSOSStore } from '../../store/sosStore';
import { SafetyScoreCard } from '../../components/home/SafetyScoreCard';
import { QuickActions } from '../../components/home/QuickActions';
import { RecentAlertsCard } from '../../components/home/RecentAlertsCard';
import { SOSCountdownModal } from '../../components/sos/SOSCountdownModal';
import { SafetyApi } from '../../api/safety';
import { AlertsApi } from '../../api/alerts';
import { IncidentsApi } from '../../api/incidents';
import { Colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../config/env';
import { SOSRequest } from '../../types';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const rootNavigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuthStore();
  const { activeSOS, checkActiveSOS } = useSOSStore();
  const [coords] = useState(DEFAULT_COORDS);
  const [isCountdownOpen, setIsCountdownOpen] = useState(false);

  // Check active SOS on mount
  React.useEffect(() => {
    checkActiveSOS();
  }, [checkActiveSOS]);

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

  const activeAlerts = alertsData?.items ?? [];

  const handleRefresh = async () => {
    await Promise.all([refetchSafety(), refetchNearby(), refetchAlerts(), checkActiveSOS()]);
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

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Top Bar / Header */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.userGreeting}>
          <Text style={styles.greetingPrefix}>Hello,</Text>
          <Text style={styles.userName}>{user?.full_name || 'Citizen'}</Text>
        </View>

        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
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
          locationName={coords.cityName}
        />

        {/* Quick Actions (Safe Route, Report, Map, SOS) */}
        <QuickActions
          onNavigateRoutes={() => navigation.navigate('Routes')}
          onNavigateReport={() => navigation.navigate('Report')}
          onNavigateMap={() => navigation.navigate('Map')}
          onTriggerSOS={handleTriggerSOS}
        />


        {/* Community Alerts Section */}
        <RecentAlertsCard
          alerts={activeAlerts}
          isLoading={isAlertsLoading}
        />

        {/* Nearby Incidents Summary Banner */}
        <View style={styles.nearbyBanner}>
          <View style={styles.nearbyIconWrap}>
            <Ionicons name="shield-outline" size={20} color={Colors.primary} />
          </View>
          <View style={styles.nearbyTextWrap}>
            <Text style={styles.nearbyTitle}>
              {nearbyIncidents.length} Incident{nearbyIncidents.length === 1 ? '' : 's'} Reported in 5km
            </Text>
            <Text style={styles.nearbySub}>
              Data synchronized with City Safety Database
            </Text>
          </View>
          <TouchableOpacity
            style={styles.viewMapLink}
            onPress={() => navigation.navigate('Map')}
          >
            <Text style={styles.viewMapText}>View Map</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* SOS Countdown & Activation Modal */}
      <SOSCountdownModal
        visible={isCountdownOpen}
        onCancel={() => setIsCountdownOpen(false)}
        onSuccess={handleSOSSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  userGreeting: {
    flex: 1,
  },
  greetingPrefix: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  notificationBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  nearbyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  nearbyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyTextWrap: {
    flex: 1,
  },
  nearbyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  nearbySub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  viewMapLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
  },
  viewMapText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
});

