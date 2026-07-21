import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';

import Toast from 'react-native-toast-message';
import { useColorScheme } from '@/hooks/use-color-scheme';
import useAuthStore from '@/lib/stores/authStore';
import useThemeStore from '@/lib/stores/themeStore';
import SplashAnimation from '@/components/SplashAnimation';
import { toastConfig } from '@/components/ToastConfig';
import RatePingModal from '@/components/RatePingModal';
import { activitiesApi, type PendingRating } from '@/lib/api';
import { setupNotifications, addResponseListener, type NotificationPayload } from '@/lib/notifications';

function AuthGuard() {
  const { user, isAdmin, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('onboardingDone').then((v) => setOnboardingDone(!!v));
  }, [segments]);

  useEffect(() => {
    if (isLoading || onboardingDone === null) return;

    const seg0          = segments[0] as string | undefined;
    const seg1          = segments[1] as string | undefined;
    const inOnboarding  = seg0 === 'onboarding';
    const inAuth        = seg0 === '(auth)';
    const inTabs        = seg0 === '(tabs)';
    const inAdmin       = seg0 === '(admin)';
    const inVerification = seg0 === 'verification';

    // Screens inside (auth) where an already-authenticated user is ALLOWED to
    // stay: otp (safety modal still showing) and setup (filling profile).
    const inSetupFlow = inAuth && ['otp', 'setup'].includes(seg1 ?? '');

    // User authenticated but never completed profile setup (no displayName).
    // Use as a safety net: handles the race where AuthGuard fires before OTP
    // routes to setup, AND handles the case where isNewUser=false but setup
    // was never completed (e.g. user existed but app was force-closed mid-setup).
    const needsSetup = !!(user && !isAdmin && !(user as any)?.displayName);

    if (!onboardingDone) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (!user && !inAuth) {
      router.replace('/(auth)/phone');
    } else if (user && inAuth && !inSetupFlow) {
      // Returning user authenticated on a plain auth screen (phone) — send to app.
      router.replace(isAdmin ? '/(admin)' : '/(tabs)');
    } else if (user && needsSetup && !inAuth && !inVerification) {
      // Safety net: incomplete profile ended up outside the auth group — route back to setup.
      router.replace('/(auth)/setup' as any);
    } else if (user && isAdmin && inTabs) {
      router.replace('/(admin)');
    } else if (user && !isAdmin && inAdmin) {
      router.replace('/(tabs)');
    } else if (user && inVerification && isAdmin) {
      router.replace('/(admin)');
    }
  }, [user, isAdmin, isLoading, segments, onboardingDone]);

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

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />

      {/* Stack renders (and AuthGuard fires) beneath the splash */}
      {!isLoading && (
        <>
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="verification" />
            <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true, title: '', animation: 'slide_from_bottom' }} />
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
