import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types/navigation';
import { IncidentsApi } from '../../api/incidents';
import { Incident, SeverityLevel, IncidentStatus } from '../../types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { SafeScreen } from '../../components/common/SafeScreen';
import { useTheme } from '../../store/themeStore';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<IncidentStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  under_review: 'Under Review',
  rejected: 'Rejected',
  resolved_unverified: 'Resolved (Unverified)',
  resolved: 'Resolved',
};

function getSeverityColors(severity: SeverityLevel, colors: ReturnType<typeof useTheme>['colors']) {
  switch (severity) {
    case 'low':      return { bg: colors.safeLight,    text: colors.safe };
    case 'medium':   return { bg: colors.warningLight,  text: colors.warning };
    case 'high':     return { bg: colors.alertLight,    text: colors.alert };
    case 'critical': return { bg: '#ff00001a',           text: '#cc0000' };
    default:         return { bg: colors.warningLight,  text: colors.warning };
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}

// ── Incident Card ──────────────────────────────────────────────────────────────

function IncidentItem({ incident }: { incident: Incident }) {
  const { colors } = useTheme();
  const sev = getSeverityColors(incident.severity, colors);
  const statusLabel = STATUS_LABELS[incident.status] ?? incident.status;

  return (
    <Card style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header row */}
      <View style={styles.itemHeader}>
        <Text style={styles.itemIcon}>{incident.category?.icon || '📋'}</Text>
        <View style={styles.itemHeaderText}>
          <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {incident.title}
          </Text>
          <Text style={[styles.itemCategory, { color: colors.textMuted }]} numberOfLines={1}>
            {incident.category?.name || 'Uncategorized'} · {timeAgo(incident.created_at)}
          </Text>
        </View>
      </View>

      {/* Description */}
      {incident.description ? (
        <Text style={[styles.itemDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {incident.description}
        </Text>
      ) : null}

      {/* Footer row */}
      <View style={styles.itemFooter}>
        {/* Severity chip */}
        <View style={[styles.severityChip, { backgroundColor: sev.bg }]}>
          <Text style={[styles.severityText, { color: sev.text }]}>
            {incident.severity.toUpperCase()}
          </Text>
        </View>

        {/* Status badge */}
        <Badge
          label={statusLabel}
          variant="status"
          status={incident.status}
          style={styles.statusBadge}
        />

        {/* Image count */}
        {incident.images && incident.images.length > 0 && (
          <View style={styles.imageCount}>
            <Ionicons name="image-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.imageCountText, { color: colors.textMuted }]}>{incident.images.length}</Text>
          </View>
        )}
      </View>

      {/* Admin note */}
      {incident.admin_note ? (
        <View style={[styles.adminNoteBox, { backgroundColor: `${colors.primary}12` }]}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.primary} />
          <Text style={[styles.adminNoteText, { color: colors.primary }]} numberOfLines={2}>
            Admin: {incident.admin_note}
          </Text>
        </View>
      ) : null}

      {/* Location */}
      {incident.location_address ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
            {incident.location_address}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export const MyIncidentsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const [page, setPage] = useState(1);
  const LIMIT = 15;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['my-incidents', page],
    queryFn: () => IncidentsApi.getMyIncidents(page, LIMIT),
    placeholderData: (prev) => prev,
  });

  const incidents = data?.items ?? [];
  const totalPages = data?.pages ?? 1;
  const total = data?.total ?? 0;

  const onRefresh = useCallback(() => {
    setPage(1);
    refetch();
  }, [refetch]);

  const goToReport = () => {
    navigation.goBack();
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
        {total} report{total !== 1 ? 's' : ''} submitted by you
      </Text>
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={56} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No reports yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          You haven't submitted any incident reports.{'\n'}
          Help keep your community safe by reporting hazards.
        </Text>
        <Button
          title="Report an Incident"
          onPress={goToReport}
          icon={<Ionicons name="add-circle-outline" size={18} color="#fff" />}
          style={styles.emptyBtn}
        />
      </View>
    );
  };

  const renderFooter = () => {
    if (totalPages <= 1) return null;
    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[
            styles.pageBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
            page === 1 && styles.pageBtnDisabled,
          ]}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={page === 1 ? colors.textMuted : colors.primary}
          />
          <Text style={[styles.pageBtnText, { color: page === 1 ? colors.textMuted : colors.primary }]}>
            Prev
          </Text>
        </TouchableOpacity>

        <Text style={[styles.pageLabel, { color: colors.textSecondary }]}>
          Page {page} of {totalPages}
        </Text>

        <TouchableOpacity
          style={[
            styles.pageBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
            page === totalPages && styles.pageBtnDisabled,
          ]}
          onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          <Text style={[styles.pageBtnText, { color: page === totalPages ? colors.textMuted : colors.primary }]}>
            Next
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={page === totalPages ? colors.textMuted : colors.primary}
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeScreen backgroundColor={colors.background}>
      {/* Back bar / Header */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Reports</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Your submitted incident reports
          </Text>
        </View>
        {incidents.length > 0 && (
          <TouchableOpacity onPress={goToReport} style={styles.addBtn}>
            <Ionicons name="add" size={26} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading your reports...</Text>
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <IncidentItem incident={item} />}
          ListHeaderComponent={incidents.length > 0 ? renderHeader : null}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={[
            styles.listContent,
            incidents.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </SafeScreen>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  addBtn: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  listHeader: {
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  // ── Incident card ──────────────────────────────────────────────
  itemCard: {
    padding: 14,
    gap: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemIcon: {
    fontSize: 24,
    lineHeight: 30,
  },
  itemHeaderText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  itemCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  itemDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  severityChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusBadge: {
    // inherits from Badge
  },
  imageCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  imageCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  adminNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 8,
    padding: 8,
  },
  adminNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 11,
  },
  // ── Empty state ──────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 8,
    minWidth: 200,
  },
  // ── Pagination ───────────────────────────────────────────────
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 4,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pageLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
