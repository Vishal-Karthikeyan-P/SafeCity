/**
 * IncidentDetailsScreen — Full incident details for mobile.
 *
 * Accessible from:
 *   • Explore (tapping map marker or list item)
 *   • Profile → My Reports
 *   • Push notification deep link (via incidentId)
 *
 * Shows: category, severity, status, description, location, images,
 * timestamps, reporter info, admin notes, resolution requests, and
 * status history. Reporter can submit a resolution request from here.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../types/navigation';
import { IncidentsApi } from '../../api/incidents';
import { Incident, IncidentStatus, SeverityLevel, ResolutionRequest } from '../../types';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';

type RouteProps = RouteProp<MainStackParamList, 'IncidentDetails'>;
type NavProps = NativeStackNavigationProp<MainStackParamList>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<SeverityLevel, { color: string; bg: string; label: string }> = {
  low:      { color: '#15803d', bg: '#dcfce7', label: 'Low' },
  medium:   { color: '#b45309', bg: '#fef3c7', label: 'Medium' },
  high:     { color: '#c2410c', bg: '#ffedd5', label: 'High' },
  critical: { color: '#b91c1c', bg: '#fee2e2', label: 'Critical' },
};

const STATUS_CONFIG: Record<IncidentStatus, { color: string; bg: string; label: string; icon: string }> = {
  pending:              { color: '#b45309', bg: '#fef3c7', label: 'Pending Review', icon: 'time-outline' },
  under_review:         { color: '#1d7eeb', bg: '#e3f2fd', label: 'Under Review',  icon: 'search-outline' },
  approved:             { color: '#15803d', bg: '#dcfce7', label: 'Verified',       icon: 'checkmark-circle-outline' },
  rejected:             { color: '#b91c1c', bg: '#fee2e2', label: 'Rejected',       icon: 'close-circle-outline' },
  resolved_unverified:  { color: '#6366f1', bg: '#ede9fe', label: 'Resolved (Unverified)', icon: 'checkmark-done-outline' },
  resolved:             { color: '#15803d', bg: '#dcfce7', label: 'Resolved',       icon: 'shield-checkmark-outline' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ─── Resolution Request Modal ─────────────────────────────────────────────────

interface ResolutionModalProps {
  visible: boolean;
  incidentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ResolutionModal: React.FC<ResolutionModalProps> = ({ visible, incidentId, onClose, onSuccess }) => {
  const { colors } = useTheme();
  const [explanation, setExplanation] = useState('');
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const qc = useQueryClient();

  const handlePickGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access media library is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setEvidenceUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image from gallery.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setEvidenceUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo.');
    }
  };

  const handleSubmit = async () => {
    if (explanation.trim().length < 10) {
      Alert.alert('Validation', 'Please provide a detailed explanation (at least 10 characters).');
      return;
    }
    setIsSubmitting(true);
    try {
      let evidenceUrl: string | undefined = undefined;
      if (evidenceUri) {
        const uploadRes = await IncidentsApi.uploadEvidence(evidenceUri);
        evidenceUrl = uploadRes.url;
      }
      await IncidentsApi.createResolutionRequest(incidentId, explanation, evidenceUrl);
      qc.invalidateQueries({ queryKey: ['incident', incidentId] });
      qc.invalidateQueries({ queryKey: ['resolution-requests', incidentId] });
      setExplanation('');
      setEvidenceUri(null);
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to submit resolution request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={resStyles.overlay}>
          <View style={[resStyles.sheet, { backgroundColor: colors.surface }]}>
            <View style={resStyles.header}>
              <Text style={[resStyles.title, { color: colors.textPrimary }]}>Request Resolution</Text>
              <TouchableOpacity onPress={onClose} style={resStyles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[resStyles.helperText, { color: colors.textSecondary }]}>
              Explain why this incident should be marked as resolved. Attach photo evidence if available.
            </Text>

            <TextInput
              style={[resStyles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Describe the resolution (e.g. hazard removed, road fixed, situation resolved)..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={explanation}
              onChangeText={setExplanation}
              maxLength={1000}
            />
            <Text style={[resStyles.charCount, { color: colors.textMuted }]}>{explanation.length}/1000</Text>

            {/* Optional Evidence Section */}
            <Text style={[resStyles.evidenceLabel, { color: colors.textPrimary }]}>Optional Evidence Photo</Text>
            {evidenceUri ? (
              <View style={resStyles.evidencePreviewWrap}>
                <Image source={{ uri: evidenceUri }} style={resStyles.evidencePreview} />
                <TouchableOpacity
                  style={resStyles.removeEvidenceBtn}
                  onPress={() => setEvidenceUri(null)}
                >
                  <Ionicons name="close-circle" size={22} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={resStyles.evidenceActionRow}>
                <TouchableOpacity
                  style={[resStyles.pickerBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={handleTakePhoto}
                >
                  <Ionicons name="camera-outline" size={18} color={colors.primary} />
                  <Text style={[resStyles.pickerBtnText, { color: colors.textPrimary }]}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[resStyles.pickerBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={handlePickGallery}
                >
                  <Ionicons name="images-outline" size={18} color={colors.primary} />
                  <Text style={[resStyles.pickerBtnText, { color: colors.textPrimary }]}>Choose Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[resStyles.submitBtn, { opacity: isSubmitting ? 0.7 : 1 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                  <Text style={resStyles.submitBtnText}>Submit Resolution Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const resStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 4 },
  helperText: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, minHeight: 90, marginBottom: 4 },
  charCount: { fontSize: 11, textAlign: 'right', marginBottom: 12 },
  evidenceLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  evidenceActionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  pickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 6 },
  pickerBtnText: { fontSize: 13, fontWeight: '600' },
  evidencePreviewWrap: { position: 'relative', alignSelf: 'flex-start', marginBottom: 16 },
  evidencePreview: { width: 100, height: 75, borderRadius: 10 },
  removeEvidenceBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#dc2626', borderRadius: 11 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1d7eeb', paddingVertical: 14, borderRadius: 12, gap: 8 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const IncidentDetailsScreen: React.FC = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavProps>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { incident: initialIncident, incidentId: paramId } = route.params ?? {};
  const resolvedId = paramId ?? initialIncident?.id;

  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);

  // Fetch fresh incident data (uses cached initial if already available)
  const { data: incident, isLoading, isError, refetch } = useQuery<Incident>({
    queryKey: ['incident', resolvedId],
    queryFn: () => IncidentsApi.getById(resolvedId!),
    enabled: !!resolvedId,
    initialData: initialIncident,
    staleTime: 30_000,
  });

  // Fetch resolution requests for this incident
  const { data: resolutionRequests = [] } = useQuery<ResolutionRequest[]>({
    queryKey: ['resolution-requests', resolvedId],
    queryFn: () => IncidentsApi.getResolutionRequests(resolvedId!),
    enabled: !!resolvedId,
  });

  const isOwner = incident?.reporter_id === user?.id;
  const canRequestResolution = isOwner && incident?.status === 'approved';
  const hasActiveResolutionRequest = resolutionRequests.some((r) => r.status === 'pending');

  const openMaps = useCallback(() => {
    if (!incident) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${incident.location_lat},${incident.location_lng}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open maps.'));
  }, [incident]);

  if (isLoading && !incident) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading incident details...</Text>
      </View>
    );
  }

  if (isError || !incident) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Failed to load incident</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sevConfig = SEVERITY_CONFIG[incident.severity] ?? SEVERITY_CONFIG.medium;
  const statConfig = STATUS_CONFIG[incident.status] ?? STATUS_CONFIG.pending;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerCategory, { color: colors.textMuted }]}>
            {incident.category?.icon} {incident.category?.name ?? 'Incident'}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{incident.title}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status + Severity Badges */}
        <View style={styles.badgesRow}>
          <View style={[styles.badge, { backgroundColor: sevConfig.bg }]}>
            <View style={[styles.badgeDot, { backgroundColor: sevConfig.color }]} />
            <Text style={[styles.badgeText, { color: sevConfig.color }]}>{sevConfig.label}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statConfig.bg }]}>
            <Ionicons name={statConfig.icon as any} size={13} color={statConfig.color} />
            <Text style={[styles.badgeText, { color: statConfig.color }]}>{statConfig.label}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Description</Text>
          <Text style={[styles.description, { color: colors.textPrimary }]}>{incident.description}</Text>
        </View>

        {/* Admin Note */}
        {incident.admin_note ? (
          <View style={[styles.card, styles.adminNoteCard, { borderColor: colors.primary }]}>
            <View style={styles.adminNoteHeader}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
              <Text style={[styles.adminNoteTitle, { color: colors.primary }]}>Moderator Note</Text>
            </View>
            <Text style={[styles.adminNoteText, { color: colors.textSecondary }]}>{incident.admin_note}</Text>
          </View>
        ) : null}

        {/* Location */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Location</Text>
          <TouchableOpacity style={styles.locationRow} onPress={openMaps} activeOpacity={0.75}>
            <View style={[styles.locationIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="location" size={18} color={colors.primary} />
            </View>
            <View style={styles.locationText}>
              <Text style={[styles.locationAddress, { color: colors.textPrimary }]}>
                {incident.location_address ?? 'Reported coordinates'}
              </Text>
              <Text style={[styles.locationCoords, { color: colors.textMuted }]}>
                {incident.location_lat.toFixed(5)}, {incident.location_lng.toFixed(5)}
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Evidence Images */}
        {incident.images && incident.images.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Evidence ({incident.images.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {incident.images.map((img) => (
                <TouchableOpacity key={img.id} onPress={() => Linking.openURL(img.url).catch(() => {})} activeOpacity={0.85}>
                  <Image source={{ uri: img.url }} style={styles.evidenceImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Metadata Grid */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Details</Text>
          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Reported</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{formatDateShort(incident.created_at)}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Last Updated</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{formatDateShort(incident.updated_at)}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Reporter</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                {incident.is_anonymous ? 'Anonymous' : (incident.reporter?.full_name ?? 'Unknown')}
              </Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Verified</Text>
              <Text style={[styles.metaValue, { color: incident.status === 'approved' || incident.status === 'resolved' ? colors.safe : colors.textMuted }]}>
                {incident.status === 'approved' || incident.status === 'resolved' ? 'Yes ✓' : 'No'}
              </Text>
            </View>
          </View>
        </View>

        {/* Resolution Requests */}
        {resolutionRequests.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Resolution Requests</Text>
            {resolutionRequests.map((req) => {
              const rColor = req.status === 'approved' ? colors.safe : req.status === 'rejected' ? colors.error : colors.warning;
              const rBg = req.status === 'approved' ? colors.safeBg : req.status === 'rejected' ? colors.criticalBg : colors.moderateBg;
              return (
                <View key={req.id} style={[styles.resolutionItem, { borderColor: colors.border }]}>
                  <View style={[styles.resolutionStatus, { backgroundColor: rBg }]}>
                    <Text style={[styles.resolutionStatusText, { color: rColor }]}>
                      {req.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.resolutionExplanation, { color: colors.textPrimary }]}>{req.explanation}</Text>
                  {req.evidence_url ? (
                    <TouchableOpacity
                      style={styles.resolutionEvidenceWrap}
                      onPress={() => Linking.openURL(req.evidence_url!).catch(() => {})}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: req.evidence_url }} style={styles.resolutionEvidenceImg} resizeMode="cover" />
                      <View style={styles.resolutionEvidenceOverlay}>
                        <Ionicons name="image-outline" size={13} color="#ffffff" />
                        <Text style={styles.resolutionEvidenceText}>Attached Evidence</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                  {req.rejection_reason ? (
                    <Text style={[styles.rejectionReason, { color: colors.error }]}>
                      Reason: {req.rejection_reason}
                    </Text>
                  ) : null}
                  <Text style={[styles.resolutionDate, { color: colors.textMuted }]}>{formatDate(req.created_at)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Resolution Request Action */}
        {canRequestResolution ? (
          <TouchableOpacity
            style={[styles.actionBtn, { opacity: hasActiveResolutionRequest ? 0.5 : 1 }]}
            onPress={() => {
              if (hasActiveResolutionRequest) {
                Alert.alert('Request Pending', 'You already have a pending resolution request for this incident.');
              } else {
                setIsResolutionModalOpen(true);
              }
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
            <Text style={styles.actionBtnText}>
              {hasActiveResolutionRequest ? 'Resolution Request Pending' : 'Request Resolution'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Resolution Modal */}
      <ResolutionModal
        visible={isResolutionModalOpen}
        incidentId={incident.id}
        onClose={() => setIsResolutionModalOpen(false)}
        onSuccess={() => {
          setIsResolutionModalOpen(false);
          Alert.alert('Submitted', 'Your resolution request has been submitted for review.');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadingText: { fontSize: 14, marginTop: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700' },
  retryBtn: { backgroundColor: '#1d7eeb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  retryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerCategory: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },

  scroll: { padding: 16, gap: 12 },
  badgesRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10, marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  description: { fontSize: 14, lineHeight: 21 },

  adminNoteCard: { borderLeftWidth: 3 },
  adminNoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  adminNoteTitle: { fontSize: 13, fontWeight: '700' },
  adminNoteText: { fontSize: 13, lineHeight: 19 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  locationText: { flex: 1 },
  locationAddress: { fontSize: 14, fontWeight: '600' },
  locationCoords: { fontSize: 11, marginTop: 2 },

  evidenceImage: { width: 160, height: 110, borderRadius: 10, marginRight: 10 },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaCell: { width: '45%' },
  metaLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 3 },
  metaValue: { fontSize: 13, fontWeight: '700' },

  resolutionItem: { borderTopWidth: 1, paddingTop: 12, gap: 6 },
  resolutionStatus: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  resolutionStatusText: { fontSize: 11, fontWeight: '800' },
  resolutionExplanation: { fontSize: 13, lineHeight: 19 },
  rejectionReason: { fontSize: 12, fontStyle: 'italic' },
  resolutionDate: { fontSize: 11 },
  resolutionEvidenceWrap: { position: 'relative', width: 140, height: 95, borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  resolutionEvidenceImg: { width: '100%', height: '100%' },
  resolutionEvidenceOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  resolutionEvidenceText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },

  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1d7eeb', paddingVertical: 14, borderRadius: 14, gap: 8, marginTop: 8 },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});
