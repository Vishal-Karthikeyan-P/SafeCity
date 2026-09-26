import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { EmergencyContactsApi } from '../../api/emergencyContacts';
import { EmergencyContact, EmergencyContactCreate, EmergencyContactUpdate } from '../../types';
import { useSOSStore } from '../../store/sosStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Colors } from '../../constants/colors';

const RELATION_CHIPS = ['Family', 'Parent', 'Spouse', 'Sibling', 'Friend', 'Doctor', 'Colleague', 'Other'];

export const EmergencyContactsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedContactIds, toggleContactSelection, loadSelectedContactIds } = useSOSStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRelation, setFormRelation] = useState('Family');
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string }>({});

  useEffect(() => {
    loadSelectedContactIds();
  }, [loadSelectedContactIds]);

  // Fetch contacts from backend
  const {
    data: contacts = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: EmergencyContactsApi.listContacts,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: EmergencyContactCreate) => EmergencyContactsApi.addContact(data),
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts'] });
      // Automatically select newly created contact for SOS notifications
      toggleContactSelection(newContact.id);
      closeModal();
      Alert.alert('Contact Added', `${newContact.name} was added to your emergency contacts.`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to add contact';
      Alert.alert('Error', msg);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EmergencyContactUpdate }) =>
      EmergencyContactsApi.updateContact(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts'] });
      closeModal();
      Alert.alert('Contact Updated', `${updated.name}'s contact info was updated.`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to update contact';
      Alert.alert('Error', msg);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => EmergencyContactsApi.deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to delete contact';
      Alert.alert('Error', msg);
    },
  });

  const openAddModal = () => {
    if (contacts.length >= 5) {
      Alert.alert(
        'Limit Reached',
        'You can have a maximum of 5 emergency contacts. Please delete or edit an existing contact.'
      );
      return;
    }
    setEditingContact(null);
    setFormName('');
    setFormPhone('');
    setFormRelation('Family');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormPhone(contact.phone);
    setFormRelation(contact.contact_relation || 'Family');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingContact(null);
    setFormName('');
    setFormPhone('');
    setFormRelation('Family');
    setFormErrors({});
  };

  // Validate phone number and name
  const validateForm = (): boolean => {
    const errors: { name?: string; phone?: string } = {};

    if (!formName.trim()) {
      errors.name = 'Full name is required';
    } else if (formName.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    // Phone validation: allow optional +, digits, spaces, hyphens, min 10 digits
    const cleanDigits = formPhone.replace(/\D/g, '');
    if (!formPhone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (cleanDigits.length < 10 || cleanDigits.length > 15) {
      errors.phone = 'Enter a valid phone number (10-15 digits)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveContact = () => {
    if (!validateForm()) return;

    if (editingContact) {
      updateMutation.mutate({
        id: editingContact.id,
        data: {
          name: formName.trim(),
          phone: formPhone.trim(),
          contact_relation: formRelation,
        },
      });
    } else {
      createMutation.mutate({
        name: formName.trim(),
        phone: formPhone.trim(),
        contact_relation: formRelation,
      });
    }
  };

  const handleDeleteContact = (contact: EmergencyContact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to remove ${contact.name} from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(contact.id),
        },
      ]
    );
  };

  const handleCallContact = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call on this device.');
    });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Emergency Contacts"
        subtitle={`Registered with SafeCity • ${contacts.length}/5`}
        rightAction={{
          icon: <Ionicons name="add" size={24} color={Colors.primary} />,
          onPress: openAddModal,
        }}
      />

      {/* Info / Selection Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
        <Text style={styles.infoText}>
          Select which contacts receive instant location alerts when you trigger Emergency SOS.
        </Text>
      </View>

      {/* Contacts List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading contacts from SafeCity database...</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.critical} />
          <Text style={styles.errorTitle}>Failed to load contacts</Text>
          <Text style={styles.errorSub}>
            {(error as any)?.response?.data?.detail || (error as any)?.message || 'Network error'}
          </Text>
          <Button title="Retry" onPress={() => refetch()} style={{ marginTop: 12 }} />
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => {
            // By default, if user hasn't explicitly unselected, all are selected, or check selectedContactIds
            const isSelected =
              selectedContactIds.length === 0 || selectedContactIds.includes(item.id);

            return (
              <Card style={styles.contactCard}>
                <View style={styles.cardHeader}>
                  {/* Avatar / Relation Icon */}
                  <View style={styles.avatarWrap}>
                    <Ionicons name="person" size={20} color={Colors.primary} />
                  </View>

                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    <View style={styles.relationRow}>
                      <View style={styles.relationBadge}>
                        <Text style={styles.relationText}>
                          {item.contact_relation || 'Contact'}
                        </Text>
                      </View>
                      <Text style={styles.contactPhone}>{item.phone}</Text>
                    </View>
                  </View>

                  {/* SOS Notification Toggle Checkbox */}
                  <TouchableOpacity
                    style={[styles.sosToggle, isSelected ? styles.sosToggleActive : null]}
                    onPress={() => toggleContactSelection(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isSelected ? Colors.safe : Colors.textMuted}
                    />
                    <Text style={[styles.sosToggleText, isSelected ? styles.sosToggleTextActive : null]}>
                      {isSelected ? 'SOS Alert ON' : 'Off'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Actions Footer */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleCallContact(item.phone)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call-outline" size={16} color={Colors.safe} />
                    <Text style={[styles.actionBtnText, { color: Colors.safe }]}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openEditModal(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={16} color={Colors.primary} />
                    <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDeleteContact(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.critical} />
                    <Text style={[styles.actionBtnText, { color: Colors.critical }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Emergency Contacts</Text>
              <Text style={styles.emptySub}>
                Add up to 5 family members, friends, or trusted individuals who will receive immediate location alerts when you trigger SOS.
              </Text>
              <Button
                title="Add Emergency Contact"
                onPress={openAddModal}
                style={{ marginTop: 16 }}
              />
            </View>
          }
        />
      )}

      {/* Floating Add Button when list has items but < 5 */}
      {contacts.length > 0 && contacts.length < 5 && (
        <View style={styles.bottomBar}>
          <Button
            title={`Add Contact (${contacts.length}/5)`}
            onPress={openAddModal}
            variant="primary"
          />
        </View>
      )}

      {/* ── Add / Edit Contact Modal ──────────────────────────────────────── */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              {/* Full Name */}
              <Input
                label="Full Name *"
                placeholder="e.g. Priya Sharma"
                value={formName}
                onChangeText={(val) => {
                  setFormName(val);
                  if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                }}
                error={formErrors.name}
                autoCapitalize="words"
              />

              {/* Phone Number */}
              <Input
                label="Phone Number *"
                placeholder="e.g. +91 98765 43210"
                value={formPhone}
                onChangeText={(val) => {
                  setFormPhone(val);
                  if (formErrors.phone) setFormErrors({ ...formErrors, phone: undefined });
                }}
                error={formErrors.phone}
                keyboardType="phone-pad"
              />

              {/* Relationship Chips */}
              <View style={styles.relationSection}>
                <Text style={styles.relationLabel}>Relationship</Text>
                <View style={styles.chipsWrap}>
                  {RELATION_CHIPS.map((chip) => {
                    const isSelected = formRelation.toLowerCase() === chip.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={chip}
                        style={[styles.chip, isSelected ? styles.chipSelected : null]}
                        onPress={() => setFormRelation(chip)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>
                          {chip}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Actions */}
              <View style={styles.formActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={closeModal}
                  style={{ flex: 1 }}
                />
                <Button
                  title={editingContact ? 'Save Changes' : 'Add Contact'}
                  variant="primary"
                  onPress={handleSaveContact}
                  loading={createMutation.isPending || updateMutation.isPending}
                  style={{ flex: 1.2 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.primaryDark,
    lineHeight: 16,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  contactCard: {
    padding: 14,
    borderRadius: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  relationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  relationBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  relationText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  contactPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sosToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  sosToggleActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  sosToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  sosToggleTextActive: {
    color: '#15803d',
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    justifyContent: 'flex-end',
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.critical,
  },
  errorSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingTop: 60,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
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
  formScroll: {
    gap: 14,
    paddingBottom: 24,
  },
  relationSection: {
    gap: 8,
  },
  relationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
});
