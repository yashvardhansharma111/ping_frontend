import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isNewUser: boolean;

  loadFromStorage: () => Promise<void>;
  login: (
    accessToken: string,
    refreshToken: string,
    user: User,
    isNewUser?: boolean,
  ) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
}

// Prevents re-entrant logout calls (e.g. clearPushToken 401 → refresh fail → logout again)
let _logoutInProgress = false;

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isNewUser: false,

  loadFromStorage: async () => {
    try {
      const [accessToken, refreshToken, userStr] = await Promise.all([
        SecureStore.getItemAsync('accessToken'),
        SecureStore.getItemAsync('refreshToken'),
        SecureStore.getItemAsync('user'),
      ]);
      if (accessToken && refreshToken && userStr) {
        const user = JSON.parse(userStr) as User;
        set({ accessToken, refreshToken, user, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (accessToken, refreshToken, user, isNewUser = false) => {
    await Promise.all([
      SecureStore.setItemAsync('accessToken', accessToken),
      SecureStore.setItemAsync('refreshToken', refreshToken),
      SecureStore.setItemAsync('user', JSON.stringify(user)),
    ]);
    set({ accessToken, refreshToken, user, isNewUser, isLoading: false });
  },

  setUser: (user) => {
    set({ user });
    SecureStore.setItemAsync('user', JSON.stringify(user)).catch(() => {});
  },

  logout: async () => {
    if (_logoutInProgress) return;
    _logoutInProgress = true;

    // Wipe in-memory credentials first so any re-entrant API calls see no token
    // and bail out immediately rather than firing another 401 cycle.
    set({ user: null, accessToken: null, refreshToken: null, isNewUser: false });

    // Best-effort: tell server to drop the push token (fire-and-forget, won't loop)
    try {
      const { clearPushToken } = require('../notifications');
      await clearPushToken();
    } catch {}

    await Promise.all([
      SecureStore.deleteItemAsync('accessToken'),
      SecureStore.deleteItemAsync('refreshToken'),
      SecureStore.deleteItemAsync('user'),
    ]);

    _logoutInProgress = false;
  },
}));

export default useAuthStore;
