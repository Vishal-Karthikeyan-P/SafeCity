/**
 * Theme Store — persists light/dark mode preference across app restarts.
 * Uses AsyncStorage (plain, not SecureStore) since theme preference is not sensitive.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightTheme, DarkTheme, AppTheme, ColorScheme } from '../constants/theme';
import { StorageKeys } from '../utils/storage';

interface ThemeState {
  colorScheme: ColorScheme;
  theme: AppTheme;
  isLoaded: boolean;
  setColorScheme: (scheme: ColorScheme) => Promise<void>;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  colorScheme: 'light',
  theme: LightTheme,
  isLoaded: false,

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(StorageKeys.THEME_PREFERENCE);
      const scheme: ColorScheme = stored === 'dark' ? 'dark' : 'light';
      set({
        colorScheme: scheme,
        theme: scheme === 'dark' ? DarkTheme : LightTheme,
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true }); // default to light on error
    }
  },

  setColorScheme: async (scheme: ColorScheme) => {
    try {
      await AsyncStorage.setItem(StorageKeys.THEME_PREFERENCE, scheme);
    } catch {
      // non-fatal
    }
    set({
      colorScheme: scheme,
      theme: scheme === 'dark' ? DarkTheme : LightTheme,
    });
  },

  toggleTheme: async () => {
    const next: ColorScheme = get().colorScheme === 'dark' ? 'light' : 'dark';
    await get().setColorScheme(next);
  },
}));

/** Convenience hook — returns current theme tokens with convenience accessors */
export const useTheme = () => {
  const store = useThemeStore();
  const tokens = store.theme;
  return {
    ...tokens,
    colors: tokens,
    theme: store.colorScheme,
    isDark: store.colorScheme === 'dark',
    setColorScheme: store.setColorScheme,
    setTheme: (scheme: 'light' | 'dark' | 'system') =>
      store.setColorScheme(scheme === 'dark' ? 'dark' : 'light'),
    toggleTheme: store.toggleTheme,
  };
};
