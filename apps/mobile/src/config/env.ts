import { Platform } from 'react-native';

export const API_BASE_URL = 'http://10.200.50.243:8000/api/v1';

// Default Coimbatore coordinates
export const DEFAULT_COORDS = {
  latitude: 11.0168,
  longitude: 76.9558,
  cityName: 'Coimbatore, TN',
};

// Backend API URL
// In Android emulator, 10.0.2.2 maps to host machine localhost:8000
// For physical devices on the same Wi-Fi, replace with machine IP (e.g. 10.200.50.243)
const getApiBaseUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      // 10.0.2.2 is the special alias to host loopback interface in Android emulator
      return 'http://10.0.2.2:8000/api/v1';
    }
    return 'http://127.0.0.1:8000/api/v1';
  }
  return 'http://10.0.2.2:8000/api/v1';
};

//export const API_BASE_URL = getApiBaseUrl();

export const Config = {
  apiBaseUrl: API_BASE_URL,
  timeoutMs: 15000,
  defaultCoords: DEFAULT_COORDS,
};
