import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  adminToken: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  isNewUser: boolean;

  loadFromStorage: () => Promise<void>;
  login: (
    accessToken: string,
    refreshToken: string,
    user: User,
    isNewUser?: boolean,
    isAdmin?: boolean,
    adminToken?: string,
  ) => Promise<void>;
  setUser: (user: User) => void;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

export const MOCK_GUEST_USER: User = {
  _id: 'guest_user_999',
  phone: '+919876543210',
  displayName: 'Alex Rivers',
  username: 'alex_rivers',
  bio: 'Specialist in coffee tasting, tech meetups & weekend roadtrips ☕️🚀✨',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500',
  photos: [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=500',
  ],
  gender: 'other',
  occupation: 'freelancer',
  hobbies: ['#bookworm', '#coffeelover', '#tech', '#hiking', '#photography'],
  verificationStatus: 'verified',
  trustRate: 98,
  city: 'Bengaluru',
  privacy: {
    ghostMode: false,
    locationSharing: true,
    autoShutoffAt: null,
  },
  status: 'active',
  strikeCount: 0,
  createdAt: new Date().toISOString(),
};

// Prevents re-entrant logout calls (e.g. clearPushToken 401 → refresh fail → logout again)
let _logoutInProgress = false;
let _isStorageLoaded = false;
let _loadStoragePromise: Promise<void> | null = null;

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  adminToken: null,
  isAdmin: false,
  isLoading: true,
  isNewUser: false,

  loadFromStorage: async () => {
    if (_isStorageLoaded && !get().isLoading) return;
    if (_loadStoragePromise) return _loadStoragePromise;

    _loadStoragePromise = (async () => {
      try {
        const [accessToken, refreshToken, userStr, adminToken] = await Promise.all([
          SecureStore.getItemAsync('accessToken'),
          SecureStore.getItemAsync('refreshToken'),
          SecureStore.getItemAsync('user'),
          SecureStore.getItemAsync('adminToken'),
        ]);
        if (accessToken && refreshToken && userStr) {
          const user = JSON.parse(userStr) as User;
          const isAdmin = !!adminToken;
          console.log(`[AuthStore] loadFromStorage — phone=${user.phone} isAdmin=${isAdmin}`);
          set({
            accessToken,
            refreshToken,
            user,
            adminToken: adminToken ?? null,
            isAdmin,
            isLoading: false,
          });
        } else {
          set({ isLoading: false });
        }
        _isStorageLoaded = true;
      } catch {
        set({ isLoading: false });
      } finally {
        _loadStoragePromise = null;
      }
    })();

    return _loadStoragePromise;
  },

  login: async (accessToken, refreshToken, user, isNewUser = false, isAdmin = false, adminToken) => {
    _isStorageLoaded = true;
    const ops: Promise<void>[] = [
      SecureStore.setItemAsync('accessToken', accessToken),
      SecureStore.setItemAsync('refreshToken', refreshToken),
      SecureStore.setItemAsync('user', JSON.stringify(user)),
    ];
    if (adminToken) ops.push(SecureStore.setItemAsync('adminToken', adminToken));
    else ops.push(SecureStore.deleteItemAsync('adminToken'));
    await Promise.all(ops);
    set({ accessToken, refreshToken, user, isNewUser, isAdmin, adminToken: adminToken ?? null, isLoading: false });
  },

  loginAsGuest: async () => {
    await get().login('guest_access_token_mock', 'guest_refresh_token_mock', MOCK_GUEST_USER, false, false);
  },

  setUser: (user) => {
    set({ user });
    SecureStore.setItemAsync('user', JSON.stringify(user)).catch(() => {});
  },

  logout: async () => {
    if (_logoutInProgress) return;
    _logoutInProgress = true;
    _isStorageLoaded = false;

    // Wipe in-memory credentials first so any re-entrant API calls see no token
    // and bail out immediately rather than firing another 401 cycle.
    set({ user: null, accessToken: null, refreshToken: null, adminToken: null, isAdmin: false, isNewUser: false });

    // Best-effort: tell server to drop the push token (fire-and-forget, won't loop)
    try {
      const { clearPushToken } = require('../notifications');
      await clearPushToken();
    } catch {}

    await Promise.all([
      SecureStore.deleteItemAsync('accessToken'),
      SecureStore.deleteItemAsync('refreshToken'),
      SecureStore.deleteItemAsync('user'),
      SecureStore.deleteItemAsync('adminToken'),
    ]);

    _logoutInProgress = false;
  },
}));

export default useAuthStore;
