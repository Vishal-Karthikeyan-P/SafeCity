import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { SeverityLevel, IncidentStatus } from '../../types';

interface BadgeProps {
  label: string;
  variant?: 'severity' | 'status' | 'risk' | 'neutral';
  severity?: SeverityLevel;
  status?: IncidentStatus;
  riskLevel?: 'safe' | 'moderate' | 'unsafe';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  severity,
  status,
  riskLevel,
  style,
  textStyle,
}) => {
  const getBadgeColors = () => {
    if (variant === 'severity' && severity) {
      switch (severity) {
        case 'critical':
          return { bg: Colors.criticalBg, text: Colors.criticalText };
        case 'high':
          return { bg: Colors.highRiskBg, text: Colors.highRiskText };
        case 'medium':
          return { bg: Colors.moderateBg, text: Colors.moderateText };
        case 'low':
        default:
          return { bg: Colors.safeBg, text: Colors.safeText };
      }
    }

    if (variant === 'risk' && riskLevel) {
      switch (riskLevel) {
        case 'unsafe':
          return { bg: Colors.criticalBg, text: Colors.criticalText };
        case 'moderate':
          return { bg: Colors.moderateBg, text: Colors.moderateText };
        case 'safe':
        default:
          return { bg: Colors.safeBg, text: Colors.safeText };
      }
    }

    if (variant === 'status' && status) {
      switch (status) {
        case 'approved':
          return { bg: Colors.safeBg, text: Colors.safeText };
        case 'under_review':
          return { bg: '#e0f2fe', text: '#0369a1' };
        case 'rejected':
          return { bg: Colors.criticalBg, text: Colors.criticalText };
        case 'resolved':
          return { bg: '#f3e8ff', text: '#7e22ce' };
        case 'pending':
        default:
          return { bg: '#f1f5f9', text: '#475569' };
      }
    }

    return { bg: '#f1f5f9', text: '#475569' };
  };

  const { bg, text } = getBadgeColors();

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }, textStyle]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
