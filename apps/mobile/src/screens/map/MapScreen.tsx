import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../../components/common/Header';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { IncidentsApi } from '../../api/incidents';
import { SafetyApi } from '../../api/safety';
import { Colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../config/env';
import { Incident } from '../../types';

export const MapScreen: React.FC = () => {
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);

  // Fetch nearby incidents
  const {
    data: incidents = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['map-nearby-incidents'],
    queryFn: () => IncidentsApi.getNearby(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude, 10.0),
  });

  // Fetch city safety stats
  const { data: cityOverview } = useQuery({
    queryKey: ['map-city-overview'],
    queryFn: () => SafetyApi.getCityOverview(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude, 20.0),
  });

  const filteredIncidents = selectedSeverity
    ? incidents.filter((inc) => inc.severity === selectedSeverity)
    : incidents;

  const severities = ['critical', 'high', 'medium', 'low'] as const;

  const renderIncidentItem = ({ item }: { item: Incident }) => (
    <Card style={styles.incidentCard}>
      <View style={styles.incidentHeader}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryIcon}>{item.category?.icon || '📍'}</Text>
          <Text style={styles.categoryName}>{item.category?.name || 'General'}</Text>
        </View>
        <Badge label={item.severity} variant="severity" severity={item.severity} />
      </View>

      <Text style={styles.incidentTitle}>{item.title}</Text>
      <Text style={styles.incidentDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.incidentFooter}>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.location_address || `${item.location_lat.toFixed(4)}, ${item.location_lng.toFixed(4)}`}
          </Text>
        </View>
        <Text style={styles.dateText}>
          {new Date(item.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Safety Map & Incidents"
        subtitle={`Coimbatore Region • ${incidents.length} active records`}
      />

      {/* City Stats Banner */}
      <View style={styles.cityBanner}>
        <View style={styles.cityStat}>
          <Text style={styles.cityStatValue}>
            {cityOverview?.score ? Math.round(cityOverview.score) : 85}
          </Text>
          <Text style={styles.cityStatLabel}>City Safety Index</Text>
        </View>
        <View style={styles.cityDivider} />
        <View style={styles.cityStat}>
          <Text style={styles.cityStatValue}>{incidents.length}</Text>
          <Text style={styles.cityStatLabel}>Nearby Reports</Text>
        </View>
        <View style={styles.cityDivider} />
        <View style={styles.cityStat}>
          <Text style={styles.cityStatValue}>
            {cityOverview?.top_category?.name || 'Vigilant'}
          </Text>
          <Text style={styles.cityStatLabel}>Primary Focus</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, selectedSeverity === null && styles.filterChipActive]}
          onPress={() => setSelectedSeverity(null)}
        >
          <Text
            style={[styles.filterChipText, selectedSeverity === null && styles.filterChipTextActive]}
          >
            All ({incidents.length})
          </Text>
        </TouchableOpacity>

        {severities.map((sev) => {
          const count = incidents.filter((i) => i.severity === sev).length;
          return (
            <TouchableOpacity
              key={sev}
              style={[styles.filterChip, selectedSeverity === sev && styles.filterChipActive]}
              onPress={() => setSelectedSeverity(selectedSeverity === sev ? null : sev)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedSeverity === sev && styles.filterChipTextActive,
                ]}
              >
                {sev.charAt(0).toUpperCase() + sev.slice(1)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List of Incidents */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching incidents from database...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredIncidents}
          keyExtractor={(item) => item.id}
          renderItem={renderIncidentItem}
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
              <Ionicons name="shield-checkmark-outline" size={48} color={Colors.safe} />
              <Text style={styles.emptyTitle}>No Incidents Found</Text>
              <Text style={styles.emptySubtitle}>
                No incidents match the selected filter in this area.
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
  cityBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.darkHeader,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityStat: {
    alignItems: 'center',
    flex: 1,
  },
  cityStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  cityStatLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  cityDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  incidentCard: {
    padding: 14,
    gap: 8,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  incidentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  incidentDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  incidentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  locationText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  dateText: {
    fontSize: 11,
    color: Colors.textMuted,
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
