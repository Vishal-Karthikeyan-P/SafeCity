import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Colors } from '../../constants/colors';
import { CommunityAlert } from '../../types';

interface RecentAlertsCardProps {
  alerts: CommunityAlert[];
  isLoading?: boolean;
}

export const RecentAlertsCard: React.FC<RecentAlertsCardProps> = ({
  alerts,
  isLoading = false,
}) => {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="megaphone" size={18} color={Colors.primary} />
          <Text style={styles.title}>Community Alerts</Text>
        </View>
        <Badge label={`${alerts.length} Active`} variant="neutral" />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching active alerts...</Text>
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={24} color={Colors.safe} />
          <Text style={styles.emptyText}>No critical alerts in your area</Text>
        </View>
      ) : (
        <View style={styles.alertsList}>
          {alerts.slice(0, 3).map((alert) => (
            <View key={alert.id} style={styles.alertItem}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertTitle} numberOfLines={1}>
                  {alert.title}
                </Text>
                <Badge
                  label={alert.severity}
                  variant="severity"
                  severity={alert.severity}
                />
              </View>
              <Text style={styles.alertMessage} numberOfLines={2}>
                {alert.message}
              </Text>
              <Text style={styles.alertDate}>
                {new Date(alert.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  alertsList: {
    gap: 10,
  },
  alertItem: {
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderLeftWidth: 3.5,
    borderLeftColor: Colors.primary,
    gap: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  alertMessage: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  alertDate: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
