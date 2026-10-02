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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types/navigation';
import { UsersApi, UpdateProfilePayload } from '../../api/users';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const { user: authUser, logout, updateUser } = useAuthStore();

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
    <View style={styles.container}>
      <Header
        title="My Profile"
        subtitle="Account settings & safety contacts"
        rightAction={{
          icon: <Ionicons name="create-outline" size={22} color={Colors.primary} />,
          onPress: openEditModal,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{getInitials(user?.full_name)}</Text>
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{user?.full_name || 'Citizen'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
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
            <View style={styles.bioBox}>
              <Text style={styles.bioText}>{user.profile.bio}</Text>
            </View>
          ) : null}

          <Button
            title="Edit Profile"
            variant="outline"
            size="sm"
            onPress={openEditModal}
            icon={<Ionicons name="pencil" size={14} color={Colors.textPrimary} />}
            style={styles.editBtn}
          />
        </Card>

        {/* Contact & Location Info */}
        <Card style={styles.infoCard}>
          <Text style={styles.sectionHeading}>Personal Details</Text>

          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Phone Number</Text>
              <Text style={styles.infoValue}>
                {user?.profile?.phone || 'Not provided'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>City / Location</Text>
              <Text style={styles.infoValue}>
                {user?.profile?.city || 'Coimbatore, Tamil Nadu'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
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

        {/* Emergency Contact */}
        <Card style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.sectionHeading}>Emergency Contacts</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('EmergencyContacts')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>Manage</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.safe} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Primary Emergency Contact</Text>
              <Text style={styles.infoValue}>
                {user?.profile?.emergency_contact_name || 'None configured'}
              </Text>
              {user?.profile?.emergency_contact_phone ? (
                <Text style={styles.emergencyPhoneText}>
                  {user.profile.emergency_contact_phone}
                </Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: Colors.primaryLight,
              paddingVertical: 10,
              borderRadius: 10,
              marginTop: 12,
              gap: 6,
            }}
            onPress={() => navigation.navigate('EmergencyContacts')}
          >
            <Ionicons name="people-outline" size={16} color={Colors.primaryDark} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primaryDark }}>
              Manage Up to 5 Contacts & SOS Alerts
            </Text>
          </TouchableOpacity>
        </Card>

        {/* My Reports Quick-Link */}
        <Card style={styles.infoCard}>
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
                  backgroundColor: Colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="document-text-outline" size={18} color={Colors.primaryDark} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>
                  My Reports
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>
                  View your submitted incidents
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
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
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
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

              <Text style={styles.modalSectionLabel}>Emergency Contact</Text>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
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
    color: Colors.textPrimary,
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  bioBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  bioText: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
    marginBottom: 4,
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
    color: Colors.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  emergencyPhoneText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
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
    backgroundColor: '#ffffff',
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
    borderBottomColor: Colors.borderLight,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
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
