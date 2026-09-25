import { Platform } from 'react-native';

/**
 * Backend API URL resolution.
 * Priority:
 * 1. process.env.EXPO_PUBLIC_API_URL (set via .env or EAS build secrets)
 * 2. If running on Android emulator / localhost
 * 3. Default active machine LAN IP so physical Android devices on the same Wi-Fi can connect
 */
const resolveApiBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    const cleanUrl = envUrl.trim().replace(/\/+$/, '');
    return cleanUrl.endsWith('/api/v1') ? cleanUrl : `${cleanUrl}/api/v1`;
  }

  // Active LAN IP for physical Android testing on current Wi-Fi
  const LAN_HOST = '10.89.126.243';

  // In Android emulator, 10.0.2.2 points to host loopback interface
  // For physical Android devices, LAN IP is used
  return `http://${LAN_HOST}:8000/api/v1`;
};

export const API_BASE_URL = resolveApiBaseUrl();

// Default Coimbatore coordinates (Gandhipuram / Town Hall center)
export const DEFAULT_COORDS = {
  latitude: 11.0168,
  longitude: 76.9558,
  cityName: 'Coimbatore, TN',
};

export const Config = {
  apiBaseUrl: API_BASE_URL,
  timeoutMs: 15000,
  defaultCoords: DEFAULT_COORDS,
};
