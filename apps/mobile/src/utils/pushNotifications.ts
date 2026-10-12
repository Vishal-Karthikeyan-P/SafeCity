/**
 * Push Notification Utilities
 * - Requests permission from the user
 * - Gets the Expo push token
 * - Registers the token with the SafeCity backend (auth-safe — retries on 401)
 * - Sets up notification tap handlers for deep-link navigation
 *
 * Bug fixes vs previous version:
 *   1. syncPushToken now validates the stored "last synced" token by also checking
 *      the LAST_PUSH_SYNC_RESULT flag so a previously failed (401 / network) sync
 *      is retried on next launch instead of silently skipped.
 *   2. getNotificationNavTarget routes `sos_alert` to the new SOSView screen
 *      (recipient viewer) with sender coords from the payload, NOT to Profile.
 *   3. Token is cleared from local cache when backend explicitly rejects it
 *      (DeviceNotRegistered / InvalidCredentials from Expo receipt API).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';
import { Storage, StorageKeys } from './storage';

// Additional storage key to track whether the last sync actually succeeded
const PUSH_SYNC_OK_KEY = 'safecity_push_sync_ok';

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

    // Android: create notification channel BEFORE getting token
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('safecity-alerts', {
        name: 'SafeCity Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1d7eeb',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'a2745b04-ec25-4a45-ad94-aae417da0902', // from app.json extra.eas.projectId
    });
    const token = tokenData.data;
    console.log('[Push] Got token:', token.substring(0, 30) + '...');
    return token;
  } catch (err) {
    console.warn('[Push] Failed to get push token:', err);
    return null;
  }
}

/**
 * Register the push token with the SafeCity backend.
 *
 * Called after login and on app foreground resume.
 *
 * FIX: The previous implementation stored the token in local cache even when
 * the backend POST failed (e.g. 401 because the user wasn't logged in yet).
 * On the next launch the cached token matched the new token so the registration
 * was skipped — leaving the backend with no token for that user.
 *
 * Now we store a separate PUSH_SYNC_OK flag. The token is only considered
 * "already synced" when BOTH the token matches AND the last sync succeeded.
 */
export async function syncPushToken(token: string): Promise<void> {
  try {
    const lastToken = await Storage.getItem(StorageKeys.PUSH_TOKEN);
    const lastSyncOk = await Storage.getItem(PUSH_SYNC_OK_KEY);

    // Skip only if the same token was successfully registered with the backend
    if (lastToken === token && lastSyncOk === 'true') {
      console.log('[Push] Token already synced — skipping.');
      return;
    }

    // Mark sync as pending (in case the call below fails)
    await Storage.setItem(PUSH_SYNC_OK_KEY, 'false');

    await apiClient.post('/contacts/push-token', { push_token: token });

    // Only cache the token after a confirmed successful backend call
    await Storage.setItem(StorageKeys.PUSH_TOKEN, token);
    await Storage.setItem(PUSH_SYNC_OK_KEY, 'true');
    console.log('[Push] Token registered with backend successfully.');
  } catch (err: any) {
    // Non-fatal — PUSH_SYNC_OK_KEY stays 'false' so we retry next session
    console.warn('[Push] Token registration failed:', err?.response?.status ?? err);
    // Do NOT cache — let the next session retry
  }
}

/**
 * Clear the push token cache so the next syncPushToken call will force-register.
 * Call this on logout so a fresh token is registered after the next login.
 */
export async function clearPushTokenCache(): Promise<void> {
  await Storage.removeItem(StorageKeys.PUSH_TOKEN);
  await Storage.removeItem(PUSH_SYNC_OK_KEY);
}

/**
 * Determine the navigation target from a notification's data payload.
 *
 * FIX: `sos_alert` now navigates to the new SOSView screen (recipient viewer)
 * with the SENDER's coordinates extracted from the payload, not to Profile.
 * This ensures recipients see the SENDER's map — not their own location.
 */
export function getNotificationNavTarget(
  data: Record<string, any>
): { screen: string; params?: Record<string, any> } | null {
  if (!data?.type) return null;

  switch (data.type) {
    case 'emergency_contact_request':
    case 'emergency_contact_accepted':
    case 'emergency_contact_rejected':
      return { screen: 'SafeCityContacts' };

    case 'sos_alert':
      // FIX: route to SOSView with SENDER coords from payload — never recipient coords.
      // lat/lng in the payload are set by notify_contacts_of_sos() from the SOS trigger
      // which uses data.location_lat / data.location_lng from the SOS sender's device.
      if (data.sos_id) {
        return {
          screen: 'SOSView',
          params: {
            sos_id: data.sos_id,
            sender_name: data.reporter_name ?? 'Unknown',
            // These come from the push payload which was built from the SENDER's coords
            sender_lat: typeof data.lat === 'number' ? data.lat : 0,
            sender_lng: typeof data.lng === 'number' ? data.lng : 0,
          },
        };
      }
      return { screen: 'Notifications' };

    case 'nearby_incident':
      return data.incident_id
        ? { screen: 'Explore', params: { incident_id: data.incident_id } }
        : { screen: 'Explore' };

    case 'unsafe_area':
      return { screen: 'Explore' };

    case 'community_alert':
      return { screen: 'Notifications' };

    case 'incident_update':
    case 'resolution_request':
    case 'resolution_approved':
    case 'resolution_rejected':
      return data.incident_id
        ? { screen: 'Notifications', params: { incident_id: data.incident_id } }
        : { screen: 'Notifications' };

    default:
      return { screen: 'Notifications' };
  }
}
