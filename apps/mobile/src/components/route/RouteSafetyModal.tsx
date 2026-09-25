import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteData } from '../../types';
import { Badge } from '../common/Badge';
import { Colors } from '../../constants/colors';
import { formatDistance, formatDuration } from '../../utils/geo';

interface RouteSafetyModalProps {
  visible: boolean;
  route: RouteData | null;
  onClose: () => void;
  avoidanceWarning?: boolean;
}

export const RouteSafetyModal: React.FC<RouteSafetyModalProps> = ({
  visible,
  route,
  onClose,
  avoidanceWarning = false,
}) => {
  if (!route) return null;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'safe':
        return Colors.safe;
      case 'moderate':
        return Colors.moderate;
      default:
        return Colors.critical;
    }
  };

  const getRiskBg = (level: string) => {
    switch (level) {
      case 'safe':
        return '#f0fdf4';
      case 'moderate':
        return '#fefce8';
      default:
        return '#fef2f2';
    }
  };

  const riskColor = getRiskColor(route.route_risk_level);
  const riskBg = getRiskBg(route.route_risk_level);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconWrap, { backgroundColor: riskBg }]}>
                <Ionicons name="shield-checkmark" size={20} color={riskColor} />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {route.label || 'Route Safety Details'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  Verified by SafeCity Safety Engine
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Avoidance Warning Banner if applicable */}
            {avoidanceWarning && (
              <View style={styles.warningBanner}>
                <Ionicons name="warning" size={18} color="#b45309" />
                <Text style={styles.warningText}>
                  All candidate routes pass through or near an incident zone. Proceed with caution.
                </Text>
              </View>
            )}

            {/* Score & Key Metrics Banner */}
            <View style={[styles.scoreCard, { backgroundColor: riskBg, borderColor: `${riskColor}40` }]}>
              <View style={styles.scoreRow}>
                <View style={styles.scoreBlock}>
                  <Text style={styles.scoreLabel}>SAFETY SCORE</Text>
                  <View style={styles.scoreNumberRow}>
                    <Text style={[styles.scoreValue, { color: riskColor }]}>
                      {Math.round(route.safety_score)}
                    </Text>
                    <Text style={styles.scoreTotal}>/100</Text>
                  </View>
                  <View style={[styles.riskPill, { backgroundColor: riskColor }]}>
                    <Text style={styles.riskPillText}>
                      {route.route_risk_level.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsDivider} />

                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Ionicons name="navigate-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.metricSub}>Distance</Text>
                    <Text style={styles.metricVal}>{formatDistance(route.distance_m)}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.metricSub}>ETA</Text>
                    <Text style={styles.metricVal}>{formatDuration(route.duration_s)}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Ionicons name="alert-circle-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.metricSub}>Hazards</Text>
                    <Text style={styles.metricVal}>
                      {route.relevant_incident_count ?? route.incidents?.length ?? 0}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Incident-free tag */}
              {route.incident_free && (
                <View style={styles.cleanBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                  <Text style={styles.cleanBadgeText}>
                    Clean Route: 0 Route-Relevant Incidents in Safety Buffer
                  </Text>
                </View>
              )}

              {/* Explanation from backend */}
              {route.explanation ? (
                <View style={styles.explanationBox}>
                  <Text style={styles.explanationText}>{route.explanation}</Text>
                </View>
              ) : null}
            </View>

            {/* Major Risk Factors */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="flame-outline" size={18} color={Colors.critical} />
                <Text style={styles.sectionTitle}>Major Risk Factors</Text>
              </View>

              {route.risk_factors && route.risk_factors.length > 0 ? (
                <View style={styles.riskFactorsContainer}>
                  {route.risk_factors.map((factor, idx) => (
                    <View key={idx} style={styles.riskFactorRow}>
                      <View style={styles.factorIconWrap}>
                        <Text style={styles.factorIcon}>{factor.icon || '⚠️'}</Text>
                      </View>
                      <View style={styles.factorInfo}>
                        <Text style={styles.factorName}>{factor.name}</Text>
                        <Text style={styles.factorCount}>
                          {factor.count} incident{factor.count === 1 ? '' : 's'} recorded
                        </Text>
                      </View>
                      <View style={styles.penaltyBadge}>
                        <Text style={styles.penaltyText}>
                          -{factor.total_penalty.toFixed(1)} pts
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyFactorsBox}>
                  <Ionicons name="shield-checkmark" size={24} color={Colors.safe} />
                  <Text style={styles.emptyFactorsText}>
                    No elevated category risk factors along this path.
                  </Text>
                </View>
              )}
            </View>

            {/* Relevant Incidents List */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="location-outline" size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>
                  Incidents Near Route ({route.incidents?.length || 0})
                </Text>
              </View>

              {route.incidents && route.incidents.length > 0 ? (
                <View style={styles.incidentsList}>
                  {route.incidents.map((incident) => (
                    <View key={incident.id} style={styles.incidentItem}>
                      <View style={styles.incidentTop}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.catIcon}>
                            {incident.category_icon || '📍'}
                          </Text>
                          <Text style={styles.catName}>
                            {incident.category_name || 'Hazard'}
                          </Text>
                        </View>
                        <Badge
                          label={incident.severity}
                          variant="severity"
                          severity={incident.severity}
                        />
                      </View>

                      <Text style={styles.incidentTitle}>{incident.title}</Text>
                      {incident.description ? (
                        <Text style={styles.incidentDesc} numberOfLines={2}>
                          {incident.description}
                        </Text>
                      ) : null}

                      <View style={styles.incidentMeta}>
                        {incident.distance_meters !== undefined && (
                          <View style={styles.metaChip}>
                            <Ionicons name="compass-outline" size={12} color={Colors.textMuted} />
                            <Text style={styles.metaChipText}>
                              {Math.round(incident.distance_meters)}m from corridor
                            </Text>
                          </View>
                        )}

                        {incident.is_verified && (
                          <View style={[styles.metaChip, { backgroundColor: '#f0fdf4' }]}>
                            <Ionicons name="checkmark-circle" size={12} color={Colors.safe} />
                            <Text style={[styles.metaChipText, { color: '#15803d' }]}>
                              Verified
                            </Text>
                          </View>
                        )}

                        {incident.penalty_impact !== undefined && incident.penalty_impact > 0 && (
                          <Text style={styles.penaltyImpact}>
                            Impact: -{incident.penalty_impact.toFixed(1)} pts
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyIncidentsBox}>
                  <Ionicons name="checkmark-circle-outline" size={32} color={Colors.safe} />
                  <Text style={styles.emptyIncidentsTitle}>Clear Safe Corridor</Text>
                  <Text style={styles.emptyIncidentsSub}>
                    Zero active incidents recorded within the safety scoring buffer for this route.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Close Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.doneBtnText}>Back to Route Selection</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 24,
    gap: 18,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  warningText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  scoreCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBlock: {
    alignItems: 'center',
    minWidth: 100,
    paddingRight: 16,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  scoreNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  scoreTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMuted,
    marginLeft: 2,
  },
  riskPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  riskPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  metricsDivider: {
    width: 1,
    height: '80%',
    backgroundColor: Colors.border,
    marginRight: 16,
  },
  metricsGrid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
    gap: 2,
  },
  metricSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cleanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  cleanBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
    flex: 1,
  },
  explanationBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  explanationText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  riskFactorsContainer: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  riskFactorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  factorIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  factorIcon: {
    fontSize: 16,
  },
  factorInfo: {
    flex: 1,
  },
  factorName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  factorCount: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  penaltyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  penaltyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b91c1c',
  },
  emptyFactorsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  emptyFactorsText: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '600',
    flex: 1,
  },
  incidentsList: {
    gap: 10,
  },
  incidentItem: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  incidentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catIcon: {
    fontSize: 14,
  },
  catName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  incidentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  incidentDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  incidentMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  penaltyImpact: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.critical,
    marginLeft: 'auto',
  },
  emptyIncidentsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 8,
  },
  emptyIncidentsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#15803d',
  },
  emptyIncidentsSub: {
    fontSize: 12,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
