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
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { NotificationsApi } from '../../api/notifications';
import { Colors } from '../../constants/colors';
import { NotificationItem } from '../../types';

export const NotificationsScreen: React.FC = () => {
  const queryClient = useQueryClient();

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

  const renderNotification = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      onPress={() => {
        if (!item.is_read) {
          markReadMutation.mutate(item.id);
        }
      }}
      activeOpacity={0.7}
    >
      <Card style={[styles.card, !item.is_read && styles.unreadCard]}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={item.is_read ? 'notifications-outline' : 'notifications'}
            size={20}
            color={item.is_read ? Colors.textMuted : Colors.primary}
          />
        </View>
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.is_read && styles.unreadTitle]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
        rightAction={
          unreadCount > 0
            ? {
                icon: (
                  <View style={styles.markAllBtn}>
                    <Ionicons name="checkmark-done" size={16} color={Colors.primary} />
                    <Text style={styles.markAllText}>Mark all</Text>
                  </View>
                ),
                onPress: () => markAllReadMutation.mutate(),
              }
            : undefined
        }
      />

      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching notifications...</Text>
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
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>
                You will receive alerts here when incident updates or safety advisories are published.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  unreadCard: {
    backgroundColor: '#ffffff',
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
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
    color: Colors.textPrimary,
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 6,
  },
  message: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  date: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 6,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
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
});
