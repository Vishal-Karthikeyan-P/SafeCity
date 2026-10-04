import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { SafeScreen } from '../../components/common/SafeScreen';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types/navigation';
import { UsersApi, UpdateProfilePayload } from '../../api/users';
import { contactRequestsApi } from '../../api/contactRequests';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../store/themeStore';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const { user: authUser, logout, updateUser } = useAuthStore();
  const { theme, isDark, setTheme, colors } = useTheme();

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Fetch full current user profile from backend
  const {
    data: user = authUser,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['my-profile'],
    queryFn: UsersApi.getMyProfile,
    initialData: authUser || undefined,
  });

  // Fetch SafeCity accepted emergency contacts count
  const { data: acceptedContacts = [] } = useQuery({
    queryKey: ['accepted-contacts'],
    queryFn: contactRequestsApi.getAcceptedContacts,
  });

  // Fetch pending incoming contact requests count
  const { data: incomingRequests = [] } = useQuery({
    queryKey: ['incoming-contact-requests'],
    queryFn: contactRequestsApi.getIncomingRequests,
  });

  const openEditModal = () => {
    setFullName(user?.full_name || '');
    setPhone(user?.profile?.phone || '');
    setCity(user?.profile?.city || '');
    setBio(user?.profile?.bio || '');
    setEmergencyName(user?.profile?.emergency_contact_name || '');
    setEmergencyPhone(user?.profile?.emergency_contact_phone || '');
    setIsEditModalVisible(true);
  };

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => UsersApi.updateProfile(payload),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      setIsEditModalVisible(false);
      Alert.alert('Profile Updated', 'Your profile details have been successfully saved.');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to update profile';
      Alert.alert('Update Failed', msg);
    },
  });

  const handleSaveProfile = () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full Name cannot be empty');
      return;
    }

    updateMutation.mutate({
      full_name: fullName.trim(),
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
      bio: bio.trim() || undefined,
      emergency_contact_name: emergencyName.trim() || undefined,
      emergency_contact_phone: emergencyPhone.trim() || undefined,
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of SafeCity?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return 'SC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <SafeScreen backgroundColor={colors.background}>
      <Header
        title="My Profile"
        subtitle="Account settings & safety contacts"
        rightAction={{
          icon: <Ionicons name="create-outline" size={22} color={colors.primary} />,
          onPress: openEditModal,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Card style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
              <Text style={styles.avatarInitials}>{getInitials(user?.full_name)}</Text>
            </View>
            <View style={styles.profileDetails}>
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>{user?.full_name || 'Citizen'}</Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
              <View style={styles.badgeRow}>
                <Badge
                  label={user?.role === 'admin' ? 'Admin' : 'Verified Citizen'}
                  variant="status"
                  status="approved"
                />
              </View>
            </View>
          </View>

          {user?.profile?.bio ? (
            <View style={[styles.bioBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.bioText, { color: colors.textSecondary }]}>{user.profile.bio}</Text>
            </View>
          ) : null}

          <Button
            title="Edit Profile"
            variant="outline"
            size="sm"
            onPress={openEditModal}
            icon={<Ionicons name="pencil" size={14} color={colors.textPrimary} />}
            style={styles.editBtn}
          />
        </Card>

        {/* Theme Settings Card (Dark Mode) */}
        <Card style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Appearance & Theme</Text>
          <View style={styles.themeRow}>
            <View style={styles.themeInfo}>
              <Ionicons
                name={isDark ? 'moon' : 'sunny'}
                size={22}
                color={isDark ? '#f59e0b' : colors.primary}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.themeLabel, { color: colors.textPrimary }]}>
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </Text>
                <Text style={[styles.themeSubLabel, { color: colors.textMuted }]}>
                  {isDark ? 'Sleek, low-light viewing' : 'High clarity bright theme'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? (isDark ? colors.surface : '#ffffff') : undefined}
            />
          </View>

          <View style={[styles.themePillsRow, { borderTopColor: colors.borderLight }]}>
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setTheme(mode)}
                style={[
                  styles.themePill,
                  {
                    backgroundColor: theme === mode ? colors.primaryLight : colors.background,
                    borderColor: theme === mode ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.themePillText,
                    {
                      color: theme === mode ? colors.primaryDark : colors.textSecondary,
                      fontWeight: theme === mode ? '700' : '500',
                    },
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* SafeCity User Emergency Contacts (User-to-User Feature) */}
        <Card style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="people" size={20} color={colors.primary} />
              <Text style={[styles.sectionHeading, { color: colors.textPrimary, marginBottom: 0 }]}>
                SafeCity Contacts
              </Text>
            </View>
            {incomingRequests.length > 0 && (
              <View style={[styles.notifBadge, { backgroundColor: colors.alert }]}>
                <Text style={styles.notifBadgeText}>{incomingRequests.length} pending</Text>
              </View>
            )}
          </View>
          <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
            Verified SafeCity citizens who automatically receive your real-time GPS location and SOS alerts.
          </Text>

          <View style={[styles.contactStatsRow, { backgroundColor: colors.background }]}>
            <View style={styles.contactStatItem}>
              <Text style={[styles.contactStatNumber, { color: colors.primary }]}>
                {acceptedContacts.length}
              </Text>
              <Text style={[styles.contactStatLabel, { color: colors.textMuted }]}>Connected</Text>
            </View>
            <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
            <View style={styles.contactStatItem}>
              <Text style={[styles.contactStatNumber, { color: incomingRequests.length > 0 ? colors.alert : colors.textPrimary }]}>
                {incomingRequests.length}
              </Text>
              <Text style={[styles.contactStatLabel, { color: colors.textMuted }]}>Requests</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.manageContactsBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('SafeCityContacts')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={17} color="#ffffff" />
            <Text style={styles.manageContactsBtnText}>Find & Manage Emergency Contacts</Text>
          </TouchableOpacity>
        </Card>

        {/* Contact & Location Info */}
        <Card style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Personal Details</Text>

          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
            <View style={styles.infoTextContainer}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Phone Number</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                {user?.profile?.phone || 'Not provided'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
            <View style={styles.infoTextContainer}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>City / Location</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                {user?.profile?.city || 'Coimbatore, Tamil Nadu'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <View style={styles.infoTextContainer}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Member Since</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Active'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Legacy SOS Phonebook Contacts */}
        <Card style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Phonebook SOS Contacts</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('EmergencyContacts')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Manage</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.safe} />
            <View style={styles.infoTextContainer}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Primary Phone Contact</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                {user?.profile?.emergency_contact_name || 'None configured'}
              </Text>
              {user?.profile?.emergency_contact_phone ? (
                <Text style={[styles.emergencyPhoneText, { color: colors.primary }]}>
                  {user.profile.emergency_contact_phone}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* My Reports Quick-Link */}
        <Card style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 4,
            }}
            onPress={() => navigation.navigate('MyIncidents')}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.primaryDark} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                  My Reports
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>
                  View your submitted incidents
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Sign Out Button */}
        <Button
          title="Sign Out"
          variant="danger"
          size="lg"
          onPress={handleLogout}
          icon={<Ionicons name="log-out-outline" size={20} color="#ffffff" />}
          style={styles.logoutBtn}
        />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Input
                label="Full Name *"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter full name"
              />

              <Input
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. +91 9876543210"
                keyboardType="phone-pad"
              />

              <Input
                label="City / Region"
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Coimbatore, TN"
              />

              <Input
                label="Bio / Notes"
                value={bio}
                onChangeText={setBio}
                placeholder="Short bio or community safety notes"
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>Emergency Contact</Text>

              <Input
                label="Contact Name"
                value={emergencyName}
                onChangeText={setEmergencyName}
                placeholder="e.g. Jane Doe (Spouse / Parent)"
              />

              <Input
                label="Contact Phone"
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                placeholder="e.g. +91 9876543210"
                keyboardType="phone-pad"
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setIsEditModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Save Changes"
                  onPress={handleSaveProfile}
                  loading={updateMutation.isPending}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  profileCard: {
    padding: 18,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  bioBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
  },
  bioText: {
    fontSize: 13,
    lineHeight: 18,
  },
  editBtn: {
    marginTop: 14,
  },
  infoCard: {
    padding: 18,
    gap: 12,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  themeSubLabel: {
    fontSize: 12,
    marginTop: 1,
  },
  themePillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  themePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themePillText: {
    fontSize: 12,
  },
  featureDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  notifBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  contactStatsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  contactStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  contactStatNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  contactStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    height: '100%',
  },
  manageContactsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 6,
  },
  manageContactsBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  emergencyPhoneText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
  },
  logoutBtn: {
    marginTop: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    padding: 4,
  },
  modalScroll: {
    maxHeight: 450,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 24,
  },
});
