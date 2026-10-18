/**
 * SafeCity Theme Store — Fixed system/light/dark theme.
 *
 * Bug fixes vs previous version:
 *   1. ColorScheme now includes 'system' as a valid preference.
 *   2. loadTheme correctly restores 'system' preference and resolves it
 *      using Appearance.getColorScheme() on startup.
 *   3. A React Native Appearance listener is registered so that when the
 *      user picks 'system', the theme updates live as the OS changes.
 *   4. setColorScheme('system') now correctly follows device appearance
 *      instead of falling through to 'light'.
 *   5. useTheme() returns both the user preference ('system'|'light'|'dark')
 *      and the resolved effective scheme ('light'|'dark') so components can
 *      use the right token palette regardless of preference.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';
import { LightTheme, DarkTheme, AppTheme } from '../constants/theme';
import { StorageKeys } from '../utils/storage';

/** What the user has explicitly selected (or 'system' to follow OS) */
export type ThemePreference = 'light' | 'dark' | 'system';

/** The actual resolved color scheme applied to the UI */
export type ResolvedScheme = 'light' | 'dark';

/** Convert OS ColorSchemeName to a safe resolved scheme (default light) */
function resolveSystemScheme(osScheme: ColorSchemeName): ResolvedScheme {
  return osScheme === 'dark' ? 'dark' : 'light';
}

/** Given a user preference and the current OS scheme, return the effective scheme */
function resolveEffective(pref: ThemePreference, osScheme: ColorSchemeName): ResolvedScheme {
  if (pref === 'system') return resolveSystemScheme(osScheme);
  return pref;
}

interface ThemeState {
  /** The user's stored preference ('light' | 'dark' | 'system') */
  preference: ThemePreference;
  /** The effective resolved scheme — always 'light' or 'dark' */
  resolved: ResolvedScheme;
  /** The active design token set (derived from resolved) */
  theme: AppTheme;
  /** True once loadTheme() has finished — used to prevent flash */
  isLoaded: boolean;

  /** Load persisted preference and set up system listener */
  loadTheme: () => Promise<void>;
  /** Persist and apply a new preference */
  setPreference: (pref: ThemePreference) => Promise<void>;
  /** Toggle between light ↔ dark (clears system) */
  toggleTheme: () => Promise<void>;
  /** Called internally by the Appearance listener */
  _handleSystemChange: (osScheme: ColorSchemeName) => void;
}

// Track the Appearance subscription so we can swap it on re-init
let appearanceSubscription: ReturnType<typeof Appearance.addChangeListener> | null = null;

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  resolved: resolveSystemScheme(Appearance.getColorScheme()),
  theme: resolveSystemScheme(Appearance.getColorScheme()) === 'dark' ? DarkTheme : LightTheme,
  isLoaded: false,

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(StorageKeys.THEME_PREFERENCE);
      const pref: ThemePreference =
        stored === 'dark' ? 'dark' : stored === 'system' ? 'system' : stored === 'light' ? 'light' : 'system';

      const osScheme = Appearance.getColorScheme();
      const resolved = resolveEffective(pref, osScheme);

      set({
        preference: pref,
        resolved,
        theme: resolved === 'dark' ? DarkTheme : LightTheme,
        isLoaded: true,
      });
    } catch {
      // Fallback: follow system with light default
      const osScheme = Appearance.getColorScheme();
      const resolved = resolveSystemScheme(osScheme);
      set({ preference: 'system', resolved, theme: resolved === 'dark' ? DarkTheme : LightTheme, isLoaded: true });
    }

    // Register Appearance listener — updates theme when OS changes
    // and user preference is 'system'
    appearanceSubscription?.remove();
    appearanceSubscription = Appearance.addChangeListener(({ colorScheme }) => {
      get()._handleSystemChange(colorScheme);
    });
  },

  setPreference: async (pref: ThemePreference) => {
    try {
      await AsyncStorage.setItem(StorageKeys.THEME_PREFERENCE, pref);
    } catch {
      // non-fatal
    }
    const osScheme = Appearance.getColorScheme();
    const resolved = resolveEffective(pref, osScheme);
    set({
      preference: pref,
      resolved,
      theme: resolved === 'dark' ? DarkTheme : LightTheme,
    });
  },

  toggleTheme: async () => {
    const next: ThemePreference = get().resolved === 'dark' ? 'light' : 'dark';
    await get().setPreference(next);
  },

  _handleSystemChange: (osScheme: ColorSchemeName) => {
    // Only apply when preference is 'system'
    if (get().preference !== 'system') return;
    const resolved = resolveSystemScheme(osScheme);
    set({ resolved, theme: resolved === 'dark' ? DarkTheme : LightTheme });
  },
}));

/**
 * useTheme — Convenience hook used by all screens and components.
 *
 * Returns:
 *   colors     — token palette (same interface as AppTheme)
 *   isDark     — true when dark theme is active
 *   theme      — user preference: 'light' | 'dark' | 'system'
 *   resolved   — effective scheme: 'light' | 'dark'
 *   setTheme   — accepts 'light' | 'dark' | 'system'
 *   toggleTheme — flips between light and dark
 */
export const useTheme = () => {
  const store = useThemeStore();
  const tokens = store.theme;
  return {
    ...tokens,
    colors: tokens,
    /** User preference — 'light' | 'dark' | 'system' */
    theme: store.preference,
    /** Effective resolved scheme — always 'light' | 'dark' */
    resolved: store.resolved,
    isDark: store.resolved === 'dark',
    setColorScheme: store.setPreference,
    setTheme: store.setPreference,
    toggleTheme: store.toggleTheme,
  };
};

/** Legacy shim — used by components that import useThemeStore directly */
export { useThemeStore as default };
