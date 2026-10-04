/**
 * Push Notification Utilities
 * - Requests permission from the user
 * - Gets the Expo push token
 * - Registers the token with the SafeCity backend
 * - Sets up notification tap handlers for deep-link navigation
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';
import { Storage, StorageKeys } from './storage';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permission and obtain Expo push token.
 * Returns the token string or null if denied/unavailable.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Notification permission denied.');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'a2745b04-ec25-4a45-ad94-aae417da0902', // from app.json extra.eas.projectId
    });
    const token = tokenData.data;

    // Android: create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('safecity-alerts', {
        name: 'SafeCity Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1d7eeb',
        sound: 'default',
      });
    }

    return token;
  } catch (err) {
    console.warn('[Push] Failed to get push token:', err);
    return null;
  }
}

/**
 * Register the push token with the SafeCity backend.
 * Called after login and on app foreground resume.
 * Silently skips if no token or already registered with the same token.
 */
export async function syncPushToken(token: string): Promise<void> {
  try {
    const lastToken = await Storage.getItem(StorageKeys.PUSH_TOKEN);
    if (lastToken === token) return; // already synced

    await apiClient.post('/contacts/push-token', { push_token: token });
    await Storage.setItem(StorageKeys.PUSH_TOKEN, token);
    console.log('[Push] Token registered with backend.');
  } catch (err) {
    // Non-fatal — token sync will retry next session
    console.warn('[Push] Token registration failed:', err);
  }
}

/**
 * Determine the navigation target from a notification's data payload.
 * Returns { screen, params } or null if no navigation target.
 */
export function getNotificationNavTarget(
  data: Record<string, any>
): { screen: string; params?: Record<string, any> } | null {
  if (!data?.type) return null;

  switch (data.type) {
    case 'emergency_contact_request':
    case 'emergency_contact_accepted':
    case 'emergency_contact_rejected':
      return { screen: 'Profile' };

    case 'sos_alert':
      return {
        screen: 'Profile', // SOS detail shown in profile/contacts section
        params: { sos_id: data.sos_id },
      };

    case 'nearby_incident':
      if (data.incident_id) {
        return {
          screen: 'Map',
          params: { incident_id: data.incident_id },
        };
      }
      return { screen: 'Map' };

    case 'unsafe_area':
      return { screen: 'Map' };

    case 'community_alert':
      return { screen: 'Notifications' };

    case 'incident_update':
    case 'resolution_request':
    case 'resolution_approved':
    case 'resolution_rejected':
      if (data.incident_id) {
        return { screen: 'Notifications', params: { incident_id: data.incident_id } };
      }
      return { screen: 'Notifications' };

    default:
      return { screen: 'Notifications' };
  }
}
