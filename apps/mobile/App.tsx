import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useThemeStore } from './src/store/themeStore';
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
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { theme, loadTheme, isLoaded } = useThemeStore();
  const navigationRef = useRef<any>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Load persisted theme on startup
  useEffect(() => {
    loadTheme();
  }, []);

  // Register push notifications after theme loads
  useEffect(() => {
    if (!isLoaded) return;

    (async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await syncPushToken(token);
      }
    })();

    // Foreground notification listener (show alert but don't navigate)
    notificationListener.current =
      Notifications.addNotificationReceivedListener((_notification: any) => {
        // Expo handler config already shows the notification in foreground
      });

    // Tap listener — navigate to the relevant screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = (response?.notification?.request?.content?.data ?? {}) as Record<string, any>;
        const target = getNotificationNavTarget(data);
        if (target && navigationRef.current) {
          // Small delay to let the app fully resume from background
          setTimeout(() => {
            try {
              navigationRef.current.navigate(target.screen, target.params);
            } catch {
              // Navigation target may not be available if user is not logged in
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

  // Don't render until theme is loaded (prevents flash of wrong colors)
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
