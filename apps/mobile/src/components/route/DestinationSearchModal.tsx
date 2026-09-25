import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { COIMBATORE_PRESETS, searchPlaces } from '../../utils/places';

interface PlaceItem {
  id: string;
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
}

interface DestinationSearchModalProps {
  visible: boolean;
  mode: 'start' | 'dest';
  onClose: () => void;
  onSelectPlace: (place: { name: string; latitude: number; longitude: number }) => void;
  onSelectOnMap: () => void;
}

export const DestinationSearchModal: React.FC<DestinationSearchModalProps> = ({
  visible,
  mode,
  onClose,
  onSelectPlace,
  onSelectOnMap,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults(
        COIMBATORE_PRESETS.map((p) => ({
          id: p.id,
          name: p.name,
          subtitle: p.subtitle,
          latitude: p.latitude,
          longitude: p.longitude,
        }))
      );
    }
  }, [visible]);

  useEffect(() => {
    let isCancelled = false;
    const handler = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchPlaces(query);
        if (!isCancelled) {
          setResults(res);
        }
      } catch {
        // ignore
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(handler);
    };
  }, [query]);

  const titleText = mode === 'start' ? 'Select Starting Point' : 'Select Destination';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerDot,
                  { backgroundColor: mode === 'start' ? Colors.safe : Colors.primary },
                ]}
              />
              <Text style={styles.headerTitle}>{titleText}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchBoxWrap}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search landmark, street, or hub..."
                placeholderTextColor={Colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus={true}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Map Pin Selector Action */}
          <TouchableOpacity
            style={styles.mapPinAction}
            onPress={() => {
              onClose();
              onSelectOnMap();
            }}
            activeOpacity={0.75}
          >
            <View style={styles.mapPinIconWrap}>
              <Ionicons name="map-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.mapPinTextWrap}>
              <Text style={styles.mapPinTitle}>Choose location on Map</Text>
              <Text style={styles.mapPinSubtitle}>Tap anywhere on the interactive map</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Results List */}
          <View style={styles.listContainer}>
            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderTitle}>
                {query.trim().length === 0 ? 'POPULAR HUBS & LANDMARKS' : 'SEARCH RESULTS'}
              </Text>
              {isSearching && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>

            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.placeItem}
                  onPress={() => {
                    onSelectPlace({
                      name: item.name,
                      latitude: item.latitude,
                      longitude: item.longitude,
                    });
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.placeIconWrap}>
                    <Ionicons
                      name={mode === 'start' ? 'pin' : 'location'}
                      size={18}
                      color={mode === 'start' ? Colors.safe : Colors.primary}
                    />
                  </View>
                  <View style={styles.placeInfo}>
                    <Text style={styles.placeName}>{item.name}</Text>
                    <Text style={styles.placeSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={32} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No locations found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try searching another street name or pick directly on the map.
                  </Text>
                </View>
              }
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBoxWrap: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  clearBtn: {
    padding: 4,
  },
  mapPinAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  mapPinIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinTextWrap: {
    flex: 1,
  },
  mapPinTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  mapPinSubtitle: {
    fontSize: 11,
    color: Colors.primaryDark,
    opacity: 0.8,
    marginTop: 1,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  listHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 30,
    gap: 8,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  placeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  placeSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 16,
  },
});
