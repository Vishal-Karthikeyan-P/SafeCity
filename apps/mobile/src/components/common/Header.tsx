import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: {
    icon: React.ReactNode;
    onPress: () => void;
  };
  style?: StyleProp<ViewStyle>;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, rightAction, style }) => {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {rightAction && (
        <TouchableOpacity
          onPress={rightAction.onPress}
          style={styles.actionButton}
          activeOpacity={0.7}
        >
          {rightAction.icon}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionButton: {
    padding: 6,
  },
});
