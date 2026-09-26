import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '../../constants/colors';
import { DEFAULT_COORDS } from '../../config/env';
import { useSOSStore } from '../../store/sosStore';
import { SOSRequest } from '../../types';

interface SOSCountdownModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (sos: SOSRequest) => void;
}

const COUNTDOWN_SECONDS = 5;

export const SOSCountdownModal: React.FC<SOSCountdownModalProps> = ({
  visible,
  onCancel,
  onSuccess,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(COUNTDOWN_SECONDS);
  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { triggerSOS, activeSOS } = useSOSStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Pulse animation for emergency beacon
  useEffect(() => {
    if (visible && !isActivating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [visible, isActivating, pulseAnim]);

  // Countdown timer logic
  useEffect(() => {
    if (visible && !isActivating) {
      setSecondsRemaining(COUNTDOWN_SECONDS);
      setErrorMessage(null);

      // Short vibration pattern if supported
      try {
        if (Platform.OS !== 'web') {
          Vibration.vibrate([0, 150, 100, 150]);
        }
      } catch {
        // ignore
      }

      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            activateSOS();
            return 0;
          }
          try {
            if (Platform.OS !== 'web') {
              Vibration.vibrate(100);
            }
          } catch {
            // ignore
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible]);

  const handleCancel = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setErrorMessage(null);
    setIsActivating(false);
    onCancel();
  };

  const activateSOS = async () => {
    if (isActivating) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Check if already active
    if (activeSOS) {
      onSuccess(activeSOS);
      return;
    }

    setIsActivating(true);
    setErrorMessage(null);

    let lat = DEFAULT_COORDS.latitude;
    let lng = DEFAULT_COORDS.longitude;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }).catch(() => null);

        if (loc) {
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      }
    } catch {
      // Continue with default city coordinates if GPS fails
    }

    try {
      const sos = await triggerSOS(lat, lng);
      try {
        if (Platform.OS !== 'web') {
          Vibration.vibrate([0, 400, 200, 400]);
        }
      } catch {
        // ignore
      }
      setIsActivating(false);
      onSuccess(sos);
    } catch (err: any) {
      setIsActivating(false);
      setErrorMessage(
        err?.message || 'Emergency trigger failed. Please check network and retry.'
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Beacon Header */}
          <Animated.View
            style={[
              styles.beaconCircle,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Ionicons name="warning" size={48} color="#ffffff" />
          </Animated.View>

          <Text style={styles.title}>EMERGENCY SOS</Text>
          <Text style={styles.subtitle}>
            Dispatching live coordinates and alerting emergency contacts
          </Text>

          {/* Countdown Display */}
          {!isActivating ? (
            <View style={styles.timerWrap}>
              <Text style={styles.timerNumber}>{secondsRemaining}</Text>
              <Text style={styles.timerSub}>seconds to cancel</Text>
            </View>
          ) : (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.sosRed} />
              <Text style={styles.activatingText}>
                Transmitting emergency event to SafeCity...
              </Text>
            </View>
          )}

          {/* Error Message if any */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.cancelBtnText}>Cancel SOS</Text>
            </TouchableOpacity>

            {!isActivating && (
              <TouchableOpacity
                style={styles.immediateBtn}
                onPress={activateSOS}
                activeOpacity={0.85}
              >
                <Ionicons name="flash" size={18} color="#ffffff" />
                <Text style={styles.immediateBtnText}>Activate Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  beaconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.sosRed,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.sosRed,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  timerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fef2f2',
    borderWidth: 3,
    borderColor: '#fecaca',
  },
  timerNumber: {
    fontSize: 44,
    fontWeight: '900',
    color: Colors.sosRed,
    lineHeight: 48,
  },
  timerSub: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
    gap: 12,
  },
  activatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#991b1b',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  immediateBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sosRed,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
    shadowColor: Colors.sosRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  immediateBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
