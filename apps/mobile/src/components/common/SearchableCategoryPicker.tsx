import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { IncidentsApi } from '../../api/incidents';
import { Colors } from '../../constants/colors';
import { IncidentCategory } from '../../types';

export interface SearchableCategoryPickerProps {
  label?: string;
  selectedCategoryId?: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  clearable?: boolean;
  error?: string;
  disabled?: boolean;
}

export const SearchableCategoryPicker: React.FC<SearchableCategoryPickerProps> = ({
  label,
  selectedCategoryId,
  onSelectCategory,
  placeholder = 'Select a category',
  allowAll = false,
  allLabel = 'All Categories',
  clearable = true,
  error,
  disabled = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real categories from backend (shared configuration)
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['incident-categories'],
    queryFn: IncidentsApi.getCategories,
    staleTime: 1000 * 60 * 15,
  });

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  // Filter categories as user types
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleOpen = () => {
    if (disabled) return;
    setSearchQuery('');
    setModalVisible(true);
  };

  const handleSelect = (catId: string | null) => {
    onSelectCategory(catId);
    setModalVisible(false);
  };

  const handleClear = () => {
    onSelectCategory(null);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Dropdown Trigger */}
      <TouchableOpacity
        style={[
          styles.trigger,
          error ? styles.triggerError : null,
          disabled ? styles.triggerDisabled : null,
        ]}
        onPress={handleOpen}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.triggerContent}>
          {selectedCategory ? (
            <View style={styles.selectedRow}>
              <Text style={styles.categoryIcon}>{selectedCategory.icon || '📍'}</Text>
              <Text style={styles.selectedText} numberOfLines={1}>
                {selectedCategory.name}
              </Text>
            </View>
          ) : allowAll && (selectedCategoryId === null || selectedCategoryId === undefined) ? (
            <Text style={styles.selectedText}>{allLabel}</Text>
          ) : (
            <Text style={styles.placeholderText}>{placeholder}</Text>
          )}
        </View>

        <View style={styles.triggerRight}>
          {clearable && selectedCategory && !disabled && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Search & Select Modal */}
      <Modal
        visible={modalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Incident Category</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search Input Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search categories..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={Platform.OS !== 'web'}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Categories List */}
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredCategories}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                allowAll && !searchQuery ? (
                  <TouchableOpacity
                    style={[
                      styles.categoryItem,
                      selectedCategoryId === null && styles.categoryItemSelected,
                    ]}
                    onPress={() => handleSelect(null)}
                  >
                    <View style={styles.categoryItemLeft}>
                      <Text style={styles.categoryItemIcon}>🌐</Text>
                      <Text
                        style={[
                          styles.categoryItemName,
                          selectedCategoryId === null && styles.categoryItemNameSelected,
                        ]}
                      >
                        {allLabel}
                      </Text>
                    </View>
                    {selectedCategoryId === null && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item }) => {
                const isSelected = selectedCategoryId === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.categoryItem,
                      isSelected && styles.categoryItemSelected,
                    ]}
                    onPress={() => handleSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.categoryItemLeft}>
                      <Text style={styles.categoryItemIcon}>{item.icon || '📍'}</Text>
                      <View>
                        <Text
                          style={[
                            styles.categoryItemName,
                            isSelected && styles.categoryItemNameSelected,
                          ]}
                        >
                          {item.name}
                        </Text>
                        {item.description && (
                          <Text style={styles.categoryItemDesc} numberOfLines={1}>
                            {item.description}
                          </Text>
                        )}
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No categories matching "{searchQuery}"</Text>
                </View>
              }
              contentContainerStyle={styles.listContent}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  triggerError: {
    borderColor: Colors.error,
  },
  triggerDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.border,
  },
  triggerContent: {
    flex: 1,
    marginRight: 8,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    fontSize: 18,
  },
  selectedText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  placeholderText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  triggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtn: {
    padding: 2,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    height: '100%',
  },
  clearSearchBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  categoryItemSelected: {
    backgroundColor: `${Colors.primary}12`,
  },
  categoryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    gap: 12,
  },
  categoryItemIcon: {
    fontSize: 22,
  },
  categoryItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  categoryItemNameSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  categoryItemDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
