import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isSecureStoreAvailable = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

export const Storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (await isSecureStoreAvailable()) {
        const value = await SecureStore.getItemAsync(key);
        if (value !== null) return value;
      }
      return await AsyncStorage.getItem(key);
    } catch {
      return await AsyncStorage.getItem(key).catch(() => null);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch {
      await AsyncStorage.setItem(key, value).catch(() => {});
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.deleteItemAsync(key);
      }
      await AsyncStorage.removeItem(key);
    } catch {
      await AsyncStorage.removeItem(key).catch(() => {});
    }
  },
};

export const StorageKeys = {
  ACCESS_TOKEN: 'safecity_access_token',
  REFRESH_TOKEN: 'safecity_refresh_token',
  USER_DATA: 'safecity_user_data',
  SELECTED_SOS_CONTACTS: 'safecity_selected_sos_contacts',
};

