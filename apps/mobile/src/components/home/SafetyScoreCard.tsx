import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Colors } from '../../constants/colors';
import { AreaSafetyScore } from '../../types';

interface SafetyScoreCardProps {
  safetyScore?: AreaSafetyScore | null;
  isLoading?: boolean;
  locationName?: string;
  onRefresh?: () => void;
}

export const SafetyScoreCard: React.FC<SafetyScoreCardProps> = ({
  safetyScore,
  isLoading = false,
  locationName = 'Coimbatore Area',
}) => {
  const score = safetyScore?.score ?? 85;
  const riskLevel = safetyScore?.risk_level ?? 'safe';
  const incidentCount = safetyScore?.incident_count ?? 0;

  const getScoreColor = () => {
    if (riskLevel === 'safe') return Colors.safe;
    if (riskLevel === 'moderate') return Colors.moderate;
    return Colors.critical;
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={16} color={Colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {locationName}
          </Text>
        </View>
        <Badge
          label={riskLevel}
          variant="risk"
          riskLevel={riskLevel}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Calculating area safety score...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.scoreSection}>
            <View style={[styles.scoreCircle, { borderColor: getScoreColor() }]}>
              <Text style={[styles.scoreValue, { color: getScoreColor() }]}>
                {Math.round(score)}
              </Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
            <View style={styles.scoreDetails}>
              <Text style={styles.scoreTitle}>Area Safety Score</Text>
              <Text style={styles.scoreSubtitle}>
                {riskLevel === 'safe'
                  ? 'Area conditions are currently normal and secure'
                  : riskLevel === 'moderate'
                  ? 'Moderate caution advised in this vicinity'
                  : 'High caution advised, multiple incidents reported'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{incidentCount}</Text>
              <Text style={styles.statLabel}>Nearby Incidents</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {safetyScore?.density_per_km2 ?? '0.0'}/km²
              </Text>
              <Text style={styles.statLabel}>Incident Density</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{safetyScore?.recent_7d ?? 0}</Text>
              <Text style={styles.statLabel}>Last 7 Days</Text>
            </View>
          </View>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 18,
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 10,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  content: {
    gap: 14,
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  scoreMax: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  scoreDetails: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  scoreSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.borderLight,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
