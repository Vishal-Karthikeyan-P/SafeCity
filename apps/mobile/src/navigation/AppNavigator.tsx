import React, { useEffect, forwardRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainStackNavigator } from './MainStackNavigator';
import { useTheme } from '../store/themeStore';

export const AppNavigator = forwardRef<NavigationContainerRef<any>>((_, ref) => {
  const { isAuthenticated, isLoading, restoreAuth } = useAuthStore();
  const theme = useTheme();

  useEffect(() => {
    restoreAuth();
  }, [restoreAuth]);

  if (isLoading) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.logoBadge, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
          <Ionicons name="shield-checkmark" size={48} color="#ffffff" />
        </View>
        <Text style={[styles.splashTitle, { color: theme.textPrimary }]}>SafeCity</Text>
        <Text style={[styles.splashSubtitle, { color: theme.textSecondary }]}>Connecting Smart Cities</Text>
        <ActivityIndicator size="small" color={theme.primary} style={styles.spinner} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={ref}>
      {isAuthenticated ? <MainStackNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
});

AppNavigator.displayName = 'AppNavigator';

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  splashTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  spinner: {
    marginTop: 32,
  },
});
