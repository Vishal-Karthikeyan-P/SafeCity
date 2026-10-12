import { create } from 'zustand';
import { User } from '../types';
import { AuthApi, LoginPayload, RegisterPayload } from '../api/auth';
import { Storage, StorageKeys } from '../utils/storage';
import { clearPushTokenCache } from '../utils/pushNotifications';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;

  restoreAuth: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  isAuthenticating: false,
  error: null,

  clearError: () => set({ error: null }),

  restoreAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const accessToken = await Storage.getItem(StorageKeys.ACCESS_TOKEN);
      if (!accessToken) {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // Try cached user first for instant load
      const cachedUserStr = await Storage.getItem(StorageKeys.USER_DATA);
      let cachedUser: User | null = null;
      if (cachedUserStr) {
        try {
          cachedUser = JSON.parse(cachedUserStr);
        } catch {
          // ignore
        }
      }

      set({ token: accessToken, user: cachedUser, isAuthenticated: true });

      // Fetch fresh user from backend
      try {
        const freshUser = await AuthApi.getMe();
        await Storage.setItem(StorageKeys.USER_DATA, JSON.stringify(freshUser));
        set({ user: freshUser, isAuthenticated: true, isLoading: false });
      } catch (err: any) {
        // If 401, token is invalid/expired and refresh failed
        if (err?.response?.status === 401) {
          await Storage.removeItem(StorageKeys.ACCESS_TOKEN);
          await Storage.removeItem(StorageKeys.REFRESH_TOKEN);
          await Storage.removeItem(StorageKeys.USER_DATA);
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        } else {
          // Network issue: continue with cached user if available
          set({ isLoading: false });
        }
      }
    } catch {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (payload: LoginPayload) => {
    set({ isAuthenticating: true, error: null });
    try {
      const tokens = await AuthApi.login(payload);
      await Storage.setItem(StorageKeys.ACCESS_TOKEN, tokens.access_token);
      await Storage.setItem(StorageKeys.REFRESH_TOKEN, tokens.refresh_token);

      const user = await AuthApi.getMe();
      await Storage.setItem(StorageKeys.USER_DATA, JSON.stringify(user));

      set({
        user,
        token: tokens.access_token,
        isAuthenticated: true,
        isAuthenticating: false,
        error: null,
      });
      // Clear push token cache so syncPushToken re-registers after login
      await clearPushTokenCache();
    } catch (err: any) {
      let message = 'Failed to sign in. Please check your credentials.';
      if (err?.response?.data?.detail) {
        message = err.response.data.detail;
      } else if (err?.message) {
        message = err.message;
      }
      set({ isAuthenticating: false, error: message });
      throw new Error(message);
    }
  },

  register: async (payload: RegisterPayload) => {
    set({ isAuthenticating: true, error: null });
    try {
      const tokens = await AuthApi.register(payload);
      await Storage.setItem(StorageKeys.ACCESS_TOKEN, tokens.access_token);
      await Storage.setItem(StorageKeys.REFRESH_TOKEN, tokens.refresh_token);

      const user = await AuthApi.getMe();
      await Storage.setItem(StorageKeys.USER_DATA, JSON.stringify(user));

      set({
        user,
        token: tokens.access_token,
        isAuthenticated: true,
        isAuthenticating: false,
        error: null,
      });
      // Clear push token cache so syncPushToken re-registers after register
      await clearPushTokenCache();
    } catch (err: any) {
      let message = 'Failed to register. Please try again.';
      if (err?.response?.data?.detail) {
        message = err.response.data.detail;
      } else if (err?.message) {
        message = err.message;
      }
      set({ isAuthenticating: false, error: message });
      throw new Error(message);
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      // Clear push token sync cache so next login re-registers with backend
      await clearPushTokenCache();
      await Storage.removeItem(StorageKeys.ACCESS_TOKEN);
      await Storage.removeItem(StorageKeys.REFRESH_TOKEN);
      await Storage.removeItem(StorageKeys.USER_DATA);
    } finally {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  updateUser: (user: User) => {
    Storage.setItem(StorageKeys.USER_DATA, JSON.stringify(user)).catch(() => {});
    set({ user });
  },
}));
