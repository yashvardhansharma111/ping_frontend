import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

import Toast from 'react-native-toast-message';
import { useColorScheme } from '@/hooks/use-color-scheme';
import useAuthStore from '@/lib/stores/authStore';
import useThemeStore from '@/lib/stores/themeStore';
import SplashAnimation from '@/components/SplashAnimation';
import { toastConfig } from '@/components/ToastConfig';
import RatePingModal from '@/components/RatePingModal';
import { activitiesApi, type PendingRating } from '@/lib/api';
import { setupNotifications, addResponseListener, type NotificationPayload } from '@/lib/notifications';
import { Colors, Ping } from '@/constants/theme';

function AuthGuard() {
  const { user, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('onboardingDone').then((v) => setOnboardingDone(!!v));
  }, [segments]);

  useEffect(() => {
    if (isLoading || onboardingDone === null) return;

    const seg0           = segments[0] as string | undefined;
    const seg1           = segments[1] as string | undefined;
    const inOnboarding   = seg0 === 'onboarding';
    const inAuth         = seg0 === '(auth)';
    const inVerification = seg0 === 'verification';

    const inSetupFlow = inAuth && ['otp', 'setup'].includes(seg1 ?? '');
    const needsSetup  = !!(user && !(user as any)?.displayName);

    if (!onboardingDone) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (!user && !inAuth) {
      router.replace('/(auth)/phone');
    } else if (user && inAuth && !inSetupFlow) {
      router.replace('/(tabs)');
    } else if (user && needsSetup && !inAuth && !inVerification) {
      router.replace('/(auth)/setup' as any);
    }
  }, [user, isLoading, segments, onboardingDone]);

  // Handle notification taps — must live inside the navigator so router works
  useEffect(() => {
    const sub = addResponseListener((payload: NotificationPayload) => {
      if (!user) return;
      switch (payload.type) {
        case 'ping_join':
        case 'ping_cancel':
        case 'ping_starting':
          router.push('/(tabs)/');
          break;
        case 'friend_accept':
        case 'friend_reject':
          router.push('/(tabs)/friends');
          break;
        case 'participant_nearby':
          if (payload.userId) router.push(`/user/${payload.userId}`);
          else router.push('/(tabs)/');
          break;
      }
    });
    return () => sub.remove();
  }, [user]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { loadFromStorage, isLoading, user } = useAuthStore();
  const [splashDone, setSplashDone] = useState(false);
  const [ratingItem, setRatingItem] = useState<PendingRating | null>(null);
  const ratingChecked = useRef(false);
  const notifSetupDone = useRef(false);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    loadFromStorage();
    useThemeStore.getState().loadPreference();
  }, []);

  // Register push token once per login session
  useEffect(() => {
    if (isLoading || !user || notifSetupDone.current) return;
    notifSetupDone.current = true;
    setupNotifications();
  }, [isLoading, user]);

  // Reset flag on logout so token gets re-registered on next login
  useEffect(() => {
    if (!user) notifSetupDone.current = false;
  }, [user]);

  // Once the user session is loaded, check for any un-rated ping participants once per session
  useEffect(() => {
    if (isLoading || !user || ratingChecked.current) return;
    ratingChecked.current = true;
    activitiesApi.pendingRatings()
      .then((r) => { if (r.pending.length > 0) setRatingItem(r.pending[0]); })
      .catch(() => {});
  }, [isLoading, user]);

  const c = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const navTheme = {
    ...(colorScheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(colorScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: c.primary,
      background: c.background,
      card: c.surface,
      text: c.text,
      border: c.border,
      notification: Ping.purpleLight,
    },
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0F0F12' }} />;
  }

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      {/* Stack renders (and AuthGuard fires) beneath the splash */}
      {!isLoading && (
        <>
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="verification" />
          </Stack>
        </>
      )}

      {/* Splash sits on top as an absolute overlay; fades out when animation ends */}
      {!splashDone && (
        <SplashAnimation onDone={() => setSplashDone(true)} />
      )}

      {/* Post-ping rating prompt — appears once per session after splash is done */}
      {splashDone && ratingItem && (
        <RatePingModal
          pending={ratingItem}
          onDone={() => setRatingItem(null)}
        />
      )}
      <Toast config={toastConfig} position="top" topOffset={56} visibilityTime={3500} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({});
