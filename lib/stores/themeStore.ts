import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type SchemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  preference: SchemePreference;
  setPreference: (p: SchemePreference) => Promise<void>;
  loadPreference: () => Promise<void>;
}

const useThemeStore = create<ThemeState>((set) => ({
  preference: 'light',

  loadPreference: async () => {
    try {
      const stored = await SecureStore.getItemAsync('themePreference');
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ preference: stored });
      }
    } catch {}
  },

  setPreference: async (preference) => {
    set({ preference });
    SecureStore.setItemAsync('themePreference', preference).catch(() => {});
  },
}));

export default useThemeStore;
