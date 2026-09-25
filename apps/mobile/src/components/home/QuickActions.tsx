import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface QuickActionsProps {
  onNavigateReport: () => void;
  onNavigateMap: () => void;
  onNavigateRoutes: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onNavigateReport,
  onNavigateMap,
  onNavigateRoutes,
}) => {
  const handleSosPress = () => {
    Alert.alert(
      'Emergency SOS',
      'Emergency SOS is currently a visual entry point in this phase. Full emergency dispatch services will be activated in the next update.',
      [{ text: 'Understood', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      {/* SOS Button - prominent card */}
      <TouchableOpacity
        style={styles.sosButton}
        onPress={handleSosPress}
        activeOpacity={0.85}
      >
        <View style={styles.sosIconContainer}>
          <Ionicons name="warning" size={24} color="#ffffff" />
        </View>
        <View style={styles.sosTextContainer}>
          <Text style={styles.sosTitle}>EMERGENCY SOS</Text>
          <Text style={styles.sosSubtitle}>Press to trigger emergency response</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Row of Action Buttons */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#eef2ff' }]}
          onPress={onNavigateRoutes}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.primary }]}>
            <Ionicons name="navigate" size={20} color="#ffffff" />
          </View>
          <Text style={styles.actionTitle}>Safe Route</Text>
          <Text style={styles.actionDesc}>Plan risk-free path</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: Colors.primaryLight }]}
          onPress={onNavigateReport}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#4338ca' }]}>
            <Ionicons name="add-circle" size={20} color="#ffffff" />
          </View>
          <Text style={styles.actionTitle}>Report</Text>
          <Text style={styles.actionDesc}>Submit hazard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: '#f0fdf4' }]}
          onPress={onNavigateMap}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: Colors.safe }]}>
            <Ionicons name="map" size={20} color="#ffffff" />
          </View>
          <Text style={styles.actionTitle}>Map</Text>
          <Text style={styles.actionDesc}>Live heatmap</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    gap: 12,
  },
  sosButton: {
    backgroundColor: Colors.sosRed,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.sosRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  sosIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sosTextContainer: {
    flex: 1,
  },
  sosTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  sosSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
});
