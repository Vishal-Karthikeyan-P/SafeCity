import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../store/themeStore';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: {
    icon: React.ReactNode;
    onPress: () => void;
  };
  rightComponent?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightAction,
  rightComponent,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingTop: Math.max(insets.top, 16),
        },
        style,
      ]}
    >
      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      {rightComponent ? (
        rightComponent
      ) : rightAction ? (
        <TouchableOpacity
          onPress={rightAction.onPress}
          style={styles.actionButton}
          activeOpacity={0.7}
        >
          {rightAction.icon}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  actionButton: {
    padding: 6,
  },
});
