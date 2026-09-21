import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Switch,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { MainTabParamList } from '../../types/navigation';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { IncidentsApi, CreateIncidentPayload } from '../../api/incidents';
import { Colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../config/env';
import { SeverityLevel } from '../../types';

type Props = BottomTabScreenProps<MainTabParamList, 'Report'>;

export const ReportScreen: React.FC<Props> = ({ navigation }) => {
  const queryClient = useQueryClient();

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [severity, setSeverity] = useState<SeverityLevel>('medium');
  const [address, setAddress] = useState('Gandhipuram, Coimbatore');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // GPS Location State
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: DEFAULT_COORDS.latitude,
    longitude: DEFAULT_COORDS.longitude,
  });
  const [isGpsLocked, setIsGpsLocked] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<
    'granted' | 'denied' | 'undetermined'
  >('undetermined');

  // Review & Submission State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    category?: string;
  }>({});

  // Fetch real categories from backend
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['incident-categories'],
    queryFn: IncidentsApi.getCategories,
  });

  // Default to first category when loaded
  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Acquire current GPS coordinates
  const acquireLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionStatus('denied');
        setIsGpsLocked(false);
        return;
      }

      setLocationPermissionStatus('granted');
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCoords(newCoords);
      setIsGpsLocked(true);

      // Reverse geocode address
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: newCoords.latitude,
          longitude: newCoords.longitude,
        });
        if (geo) {
          const parts = [
            geo.street || geo.name,
            geo.subregion || geo.district,
            geo.city || 'Coimbatore',
          ].filter(Boolean);
          if (parts.length > 0) {
            setAddress(parts.join(', '));
          }
        }
      } catch {
        // keep existing address
      }
    } catch (err) {
      setIsGpsLocked(false);
      Alert.alert(
        'Location Unavailable',
        'Unable to detect GPS position. Using default Coimbatore coordinates. You can also specify the street address manually.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    acquireLocation();
  }, []);

  // Handle Photo Picker
  const handleSelectPhoto = async () => {
    Alert.alert(
      'Attach Evidence Photo',
      'Take a new photo with camera or choose from gallery:',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.7,
              allowsEditing: true,
              aspect: [4, 3],
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              setPhotoUri(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Photo Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Gallery access is required to choose photos.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.7,
              allowsEditing: true,
              aspect: [4, 3],
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              setPhotoUri(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAddress('Gandhipuram, Coimbatore');
    setIsAnonymous(false);
    setSeverity('medium');
    setPhotoUri(null);
    setErrors({});
  };

  const validate = () => {
    const newErrors: { title?: string; description?: string; category?: string } = {};
    if (!title.trim()) newErrors.title = 'Incident title is required';
    if (!description.trim()) newErrors.description = 'Please provide details of the incident';
    if (!categoryId) newErrors.category = 'Please select a category';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOpenReview = () => {
    if (!validate()) return;
    setShowReviewModal(true);
  };

  // Submission pipeline
  const submitIncidentReport = async () => {
    setIsSubmitting(true);
    try {
      // 1. Create incident in backend
      const payload: CreateIncidentPayload = {
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        severity,
        location_lat: coords.latitude,
        location_lng: coords.longitude,
        location_address: address.trim() || undefined,
        is_anonymous: isAnonymous,
      };

      const created = await IncidentsApi.create(payload);

      // 2. Upload image if attached
      if (photoUri && created.id) {
        try {
          await IncidentsApi.uploadImages(created.id, [photoUri]);
        } catch (imgErr) {
          console.warn('Image upload failed, but incident was saved:', imgErr);
        }
      }

      // 3. Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['map-nearby-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-incidents-home'] });
      queryClient.invalidateQueries({ queryKey: ['area-safety-score'] });

      setShowReviewModal(false);
      resetForm();

      Alert.alert(
        'Incident Report Submitted',
        'Your report has been successfully recorded in the SafeCity database and sent for official verification.',
        [
          {
            text: 'View on Map',
            onPress: () => navigation.navigate('Map'),
          },
          {
            text: 'Done',
            onPress: () => navigation.navigate('Home'),
          },
        ]
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail || err?.message || 'Failed to submit incident report.';
      Alert.alert('Submission Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const severities: { level: SeverityLevel; label: string; color: string }[] = [
    { level: 'low', label: 'Low', color: Colors.safe },
    { level: 'medium', label: 'Medium', color: Colors.moderate },
    { level: 'high', label: 'High', color: Colors.highRisk },
    { level: 'critical', label: 'Critical', color: Colors.critical },
  ];

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title="Report an Incident"
        subtitle="Contribute to a safer Coimbatore community"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* GPS Status Banner */}
        <View style={styles.gpsBanner}>
          <View style={styles.gpsInfo}>
            <View
              style={[
                styles.gpsDot,
                { backgroundColor: isGpsLocked ? Colors.safe : Colors.warning },
              ]}
            />
            <View>
              <Text style={styles.gpsStatusText}>
                {isGpsLocked ? 'GPS Location Locked' : 'Default City Location'}
              </Text>
              <Text style={styles.gpsCoordsText}>
                {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.gpsRefreshBtn}
            onPress={acquireLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View style={styles.gpsRefreshContent}>
                <Ionicons name="locate" size={14} color={Colors.primary} />
                <Text style={styles.gpsRefreshText}>Update GPS</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Title Input */}
        <Input
          label="Incident Title *"
          placeholder="e.g. Broken street light causing dark alley"
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          error={errors.title}
        />

        {/* Detailed Description */}
        <Input
          label="Detailed Description *"
          placeholder="Describe what happened, exact location, surrounding hazards..."
          value={description}
          onChangeText={(t) => {
            setDescription(t);
            if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
          }}
          multiline
          numberOfLines={4}
          style={styles.textArea}
          error={errors.description}
        />

        {/* Category Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Incident Category *</Text>
          {isCategoriesLoading ? (
            <Text style={styles.loadingText}>Loading categories...</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesRow}
            >
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                    ]}
                    onPress={() => setCategoryId(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Severity Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Severity Level</Text>
          <View style={styles.severityRow}>
            {severities.map((item) => {
              const isSelected = severity === item.level;
              return (
                <TouchableOpacity
                  key={item.level}
                  style={[
                    styles.severityBtn,
                    isSelected && {
                      borderColor: item.color,
                      backgroundColor: `${item.color}18`,
                    },
                  ]}
                  onPress={() => setSeverity(item.level)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.severityDot,
                      { backgroundColor: item.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.severityText,
                      isSelected && { color: item.color, fontWeight: '700' },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Photo Attachment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Evidence Photo (Optional)</Text>
          {photoUri ? (
            <View style={styles.photoPreviewCard}>
              <Image source={{ uri: photoUri }} style={styles.photoPreviewImage} />
              <View style={styles.photoPreviewInfo}>
                <Text style={styles.photoPreviewTitle} numberOfLines={1}>
                  Photo Attached
                </Text>
                <Text style={styles.photoPreviewSubtitle}>Ready to upload with report</Text>
                <TouchableOpacity
                  style={styles.photoRemoveBtn}
                  onPress={() => setPhotoUri(null)}
                >
                  <Ionicons name="trash-outline" size={14} color={Colors.error} />
                  <Text style={styles.photoRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoUploadBtn}
              onPress={handleSelectPhoto}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={24} color={Colors.primary} />
              <Text style={styles.photoUploadText}>Take Photo or Choose from Gallery</Text>
              <Text style={styles.photoUploadSubtext}>JPEG, PNG up to 5MB</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Location Address Input */}
        <Input
          label="Location Address"
          placeholder="e.g. Cross Cut Road, Gandhipuram"
          value={address}
          onChangeText={setAddress}
          leftIcon={<Ionicons name="location-outline" size={18} color={Colors.textSecondary} />}
        />

        {/* Anonymous Toggle */}
        <View style={styles.switchRow}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchTitle}>Report Anonymously</Text>
            <Text style={styles.switchSubtitle}>
              Hide your name from public incident feeds
            </Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={isAnonymous ? Colors.primary : '#f4f3f4'}
          />
        </View>

        {/* Review & Submit Button */}
        <Button
          title="Review & Submit Report"
          onPress={handleOpenReview}
          size="lg"
          style={styles.submitBtn}
          icon={<Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />}
        />
      </ScrollView>

      {/* Review Summary Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Incident Report</Text>
              <TouchableOpacity
                onPress={() => setShowReviewModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.reviewCard}>
                <Text style={styles.reviewLabel}>Category & Severity</Text>
                <View style={styles.reviewRow}>
                  <View style={styles.reviewCategoryBadge}>
                    <Text style={styles.reviewCategoryIcon}>
                      {selectedCategoryObj?.icon || '📍'}
                    </Text>
                    <Text style={styles.reviewCategoryName}>
                      {selectedCategoryObj?.name || 'Hazard'}
                    </Text>
                  </View>
                  <Badge label={severity} variant="severity" severity={severity} />
                </View>

                <Text style={styles.reviewLabel}>Title</Text>
                <Text style={styles.reviewValue}>{title}</Text>

                <Text style={styles.reviewLabel}>Description</Text>
                <Text style={styles.reviewDescValue}>{description}</Text>

                <Text style={styles.reviewLabel}>Location & GPS</Text>
                <View style={styles.reviewLocationBox}>
                  <Ionicons name="location" size={16} color={Colors.primary} />
                  <View style={styles.reviewLocationDetails}>
                    <Text style={styles.reviewLocationAddress}>{address}</Text>
                    <Text style={styles.reviewLocationCoords}>
                      GPS: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                    </Text>
                  </View>
                </View>

                {photoUri && (
                  <>
                    <Text style={styles.reviewLabel}>Evidence Photo</Text>
                    <Image source={{ uri: photoUri }} style={styles.reviewPhoto} />
                  </>
                )}

                <Text style={styles.reviewLabel}>Privacy</Text>
                <Text style={styles.reviewValue}>
                  {isAnonymous ? 'Anonymous Submission' : 'Public Profile'}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowReviewModal(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  isSubmitting && styles.modalConfirmBtnDisabled,
                ]}
                onPress={submitIncidentReport}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={16} color="#ffffff" />
                    <Text style={styles.modalConfirmText}>Confirm & Submit</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  gpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  gpsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  gpsDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gpsStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  gpsCoordsText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  gpsRefreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
  },
  gpsRefreshContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsRefreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 6,
  },
  categoryChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  categoryChipIcon: {
    fontSize: 16,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: Colors.primaryDark,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 6,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  photoUploadBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoUploadText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 4,
  },
  photoUploadSubtext: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  photoPreviewCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    alignItems: 'center',
  },
  photoPreviewImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  photoPreviewInfo: {
    flex: 1,
    gap: 2,
  },
  photoPreviewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  photoPreviewSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  photoRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  photoRemoveText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  switchSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  submitBtn: {
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 6,
    backgroundColor: Colors.background,
    borderRadius: 16,
  },
  reviewCard: {
    gap: 8,
  },
  reviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  reviewDescValue: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewCategoryIcon: {
    fontSize: 16,
  },
  reviewCategoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  reviewLocationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 8,
  },
  reviewLocationDetails: {
    flex: 1,
  },
  reviewLocationAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  reviewLocationCoords: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  reviewPhoto: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnDisabled: {
    opacity: 0.6,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
