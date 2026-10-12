import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useThemeStore } from './src/store/themeStore';
import { useAuthStore } from './src/store/authStore';
import {
  registerForPushNotifications,
  syncPushToken,
  getNotificationNavTarget,
} from './src/utils/pushNotifications';

// Configure TanStack React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { theme, loadTheme, isLoaded } = useThemeStore();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();
  const navigationRef = useRef<any>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Load persisted theme on startup
  useEffect(() => {
    loadTheme();
  }, []);

  /**
   * Register and sync push token ONLY when the user is authenticated.
   *
   * BUG FIX: Previously, syncPushToken ran unconditionally on app load before
   * the JWT was confirmed. The POST /contacts/push-token call landed with a 401,
   * but the token was still cached as "synced" — preventing any future retry.
   *
   * Now we gate on `isAuthenticated && !isAuthLoading` so the backend call
   * is always made with a valid Authorization header.
   */
  useEffect(() => {
    if (!isLoaded || isAuthLoading || !isAuthenticated) return;

    const doSync = async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await syncPushToken(token);
      }
    };

    doSync();
  }, [isLoaded, isAuthenticated, isAuthLoading]);

  // Re-sync token when app returns from background (handles OS token rotation)
  useEffect(() => {
    if (!isLoaded) return;

    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (isAuthenticated) {
          const token = await registerForPushNotifications();
          if (token) {
            await syncPushToken(token);
          }
        }
      }
      appState.current = nextState;
    });

    return () => sub.remove();
  }, [isLoaded, isAuthenticated]);

  // Notification listeners
  useEffect(() => {
    if (!isLoaded) return;

    // Foreground notification: Expo handler config shows the alert automatically
    notificationListener.current =
      Notifications.addNotificationReceivedListener((_notification: any) => {
        // intentionally empty — handler config in pushNotifications.ts does the work
      });

    // Tap listener: navigate to the relevant screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = (response?.notification?.request?.content?.data ?? {}) as Record<string, any>;
        const target = getNotificationNavTarget(data);
        if (target && navigationRef.current) {
          setTimeout(() => {
            try {
              navigationRef.current.navigate(target.screen, target.params);
            } catch {
              // Navigation target unavailable (e.g. user not logged in yet)
            }
          }, 500);
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isLoaded]);

  if (!isLoaded) return null;

  return (
    <>
      <StatusBar
        style={theme.statusBarStyle}
        backgroundColor={theme.statusBarBg}
      />
      <AppNavigator ref={navigationRef} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
