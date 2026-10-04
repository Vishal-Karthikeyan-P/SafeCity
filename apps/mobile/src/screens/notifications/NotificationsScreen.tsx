import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { SafeScreen } from '../../components/common/SafeScreen';
import { NotificationsApi } from '../../api/notifications';
import { useTheme } from '../../store/themeStore';
import { NotificationItem } from '../../types';

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: NotificationsApi.list,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => NotificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: NotificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const notifications = data?.items || [];
  const unreadCount = data?.unread_count || 0;

  const handleNotificationPress = (item: NotificationItem) => {
    if (!item.is_read) {
      markReadMutation.mutate(item.id);
    }

    // Direct navigation based on notification type and payload
    switch (item.type) {
      case 'emergency_contact_request':
      case 'emergency_contact_accepted':
      case 'emergency_contact_rejected':
        navigation.navigate('SafeCityContacts');
        break;

      case 'sos_alert':
      case 'sos_resolved':
        navigation.navigate('ActiveSOS');
        break;

      case 'nearby_incident':
      case 'unsafe_area':
      case 'incident_update':
      case 'community_alert':
        // Navigate to Map to view the area/incident
        navigation.navigate('MainTabs', { screen: 'Map' });
        break;

      case 'resolution_request':
      case 'resolution_approved':
      case 'resolution_rejected':
        navigation.navigate('MyIncidents');
        break;

      default:
        if (item.incident_id) {
          navigation.navigate('MainTabs', { screen: 'Map' });
        }
        break;
    }
  };

  const getNotificationIconInfo = (type: string) => {
    switch (type) {
      case 'emergency_contact_request':
        return { name: 'person-add' as const, color: colors.primary, bg: colors.primaryLight };
      case 'emergency_contact_accepted':
        return { name: 'people' as const, color: colors.safe, bg: colors.safeLight };
      case 'emergency_contact_rejected':
        return { name: 'person-remove' as const, color: colors.textMuted, bg: colors.background };
      case 'sos_alert':
        return { name: 'warning' as const, color: '#ffffff', bg: colors.alert };
      case 'sos_resolved':
        return { name: 'shield-checkmark' as const, color: colors.safe, bg: colors.safeLight };
      case 'nearby_incident':
        return { name: 'location' as const, color: colors.warning, bg: colors.warningLight };
      case 'unsafe_area':
        return { name: 'alert-circle' as const, color: colors.alert, bg: colors.alertLight };
      case 'community_alert':
        return { name: 'megaphone' as const, color: colors.secondary, bg: colors.primaryLight };
      default:
        return { name: 'notifications' as const, color: colors.primary, bg: colors.primaryLight };
    }
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const iconInfo = getNotificationIconInfo(item.type);

    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <Card
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: item.is_read ? colors.border : colors.primary },
            !item.is_read && { borderWidth: 1.5 },
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: iconInfo.bg }]}>
            <Ionicons
              name={iconInfo.name}
              size={18}
              color={iconInfo.color}
            />
          </View>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  { color: colors.textPrimary },
                  !item.is_read && styles.unreadTitle,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {!item.is_read && (
                <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
              )}
            </View>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{item.message}</Text>
            <View style={styles.footerRow}>
              <Text style={[styles.date, { color: colors.textMuted }]}>
                {new Date(item.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeScreen backgroundColor={colors.background}>
      <Header
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`
            : 'All caught up'
        }
        rightAction={
          unreadCount > 0
            ? {
                icon: (
                  <View style={styles.markAllBtn}>
                    <Ionicons name="checkmark-done" size={16} color={colors.primary} />
                    <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all</Text>
                  </View>
                ),
                onPress: () => markAllReadMutation.mutate(),
              }
            : undefined
        }
      />

      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Fetching notifications...
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Notifications</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                You will receive alerts here when safety advisories, SOS alerts, or contact requests arrive.
              </Text>
            </View>
          }
        />
      )}
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  date: {
    fontSize: 10,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
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
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
});
