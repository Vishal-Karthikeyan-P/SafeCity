/**
 * SafeScreen — Global safe-area + keyboard-avoiding wrapper.
 *
 * Replaces scattered SafeAreaView + KeyboardAvoidingView usage across screens.
 * Handles:
 *   - Status bar visibility (content not hidden behind system notification bar)
 *   - Bottom navigation bar insets (buttons/forms not blocked)
 *   - Keyboard pushing content up (KeyboardAvoidingView)
 *   - ScrollView with bottom padding for keyboard
 *   - Dark/light StatusBar style following the active theme
 */
import React from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
  StatusBar,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '../../store/themeStore';

interface SafeScreenProps {
  children: React.ReactNode;
  /** Which edges to apply safe-area insets. Default: all edges. */
  edges?: Edge[];
  /** Extra style applied to the outer SafeAreaView */
  style?: ViewStyle;
  /** Extra style applied to the inner content wrapper */
  contentStyle?: ViewStyle;
  /** Set false to disable KeyboardAvoidingView (e.g. for map screens). Default true */
  avoidKeyboard?: boolean;
  /** Background colour override. Defaults to theme.background */
  backgroundColor?: string;
}

export const SafeScreen: React.FC<SafeScreenProps> = ({
  children,
  edges = ['top', 'left', 'right', 'bottom'],
  style,
  contentStyle,
  avoidKeyboard = true,
  backgroundColor,
}) => {
  const theme = useTheme();
  const bg = backgroundColor ?? theme.background;

  const content = avoidKeyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.flex, contentStyle]}>{children}</View>
    </KeyboardAvoidingView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: bg }, style]} edges={edges}>
      <StatusBar
        backgroundColor={bg}
        barStyle={theme.statusBarStyle === 'dark' ? 'dark-content' : 'light-content'}
        translucent={false}
      />
      {content}
    </SafeAreaView>
  );
};

/**
 * SafeScreenNoTop — for screens that have a custom header overlapping the status bar.
 * Applies safe areas to left, right, bottom only.
 */
export const SafeScreenNoTop: React.FC<SafeScreenProps> = (props) => (
  <SafeScreen {...props} edges={['left', 'right', 'bottom']} avoidKeyboard={props.avoidKeyboard ?? false} />
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
