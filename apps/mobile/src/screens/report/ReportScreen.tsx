import React, { useState } from 'react';
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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList } from '../../types/navigation';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { IncidentsApi, CreateIncidentPayload } from '../../api/incidents';
import { Colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../config/env';
import { SeverityLevel } from '../../types';

type Props = BottomTabScreenProps<MainTabParamList, 'Report'>;

export const ReportScreen: React.FC<Props> = ({ navigation }) => {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [severity, setSeverity] = useState<SeverityLevel>('medium');
  const [address, setAddress] = useState('Gandhipuram, Coimbatore');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string; category?: string }>({});

  // Fetch categories from backend
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['incident-categories'],
    queryFn: IncidentsApi.getCategories,
  });

  // Default to first category when loaded
  React.useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Mutation to create incident
  const createMutation = useMutation({
    mutationFn: (payload: CreateIncidentPayload) => IncidentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nearby-incidents-home'] });
      queryClient.invalidateQueries({ queryKey: ['map-nearby-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['area-safety-score'] });

      Alert.alert(
        'Report Submitted',
        'Your incident report has been submitted to SafeCity authorities for verification. Thank you for keeping the city safe.',
        [
          {
            text: 'View on Map',
            onPress: () => {
              resetForm();
              navigation.navigate('Map');
            },
          },
          {
            text: 'Done',
            onPress: () => {
              resetForm();
              navigation.navigate('Home');
            },
          },
        ]
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to submit incident report';
      Alert.alert('Submission Error', msg);
    },
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAddress('Gandhipuram, Coimbatore');
    setIsAnonymous(false);
    setSeverity('medium');
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

  const handleSubmit = () => {
    if (!validate()) return;

    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId,
      severity,
      location_lat: DEFAULT_COORDS.latitude,
      location_lng: DEFAULT_COORDS.longitude,
      location_address: address.trim() || undefined,
      is_anonymous: isAnonymous,
    });
  };

  const severities: { level: SeverityLevel; label: string; color: string }[] = [
    { level: 'low', label: 'Low', color: Colors.safe },
    { level: 'medium', label: 'Medium', color: Colors.moderate },
    { level: 'high', label: 'High', color: Colors.highRisk },
    { level: 'critical', label: 'Critical', color: Colors.critical },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title="Report an Incident"
        subtitle="Submit a hazard or public safety concern"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

        <Input
          label="Detailed Description *"
          placeholder="Describe what happened, exact location details, hazards..."
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
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    categoryId === cat.id && styles.categoryChipSelected,
                  ]}
                  onPress={() => setCategoryId(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryChipText,
                      categoryId === cat.id && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Severity Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Severity Level</Text>
          <View style={styles.severityRow}>
            {severities.map((item) => (
              <TouchableOpacity
                key={item.level}
                style={[
                  styles.severityBtn,
                  severity === item.level && {
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
                    severity === item.level && { color: item.color, fontWeight: '700' },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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
              Hide your name from public incident records
            </Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={isAnonymous ? Colors.primary : '#f4f3f4'}
          />
        </View>

        {/* Submit Button */}
        <Button
          title="Submit Incident Report"
          onPress={handleSubmit}
          loading={createMutation.isPending}
          size="lg"
          style={styles.submitBtn}
          icon={<Ionicons name="cloud-upload-outline" size={20} color="#ffffff" />}
        />
      </ScrollView>
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
  textArea: {
    minHeight: 100,
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
});
