import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import useAuthStore from '@/lib/stores/authStore';
import SplashAnimation from '@/components/SplashAnimation';

function AuthGuard() {
  const { user, isAdmin, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      console.log('[AuthGuard] loading — skip');
      return;
    }
    const seg0    = segments[0] as string | undefined;
    const inAuth  = seg0 === '(auth)';
    const inTabs  = seg0 === '(tabs)';
    const inAdmin = seg0 === '(admin)';

    console.log(`[AuthGuard] user=${!!user} isAdmin=${isAdmin} seg0="${seg0}" inAuth=${inAuth} inTabs=${inTabs} inAdmin=${inAdmin}`);

    if (!user && !inAuth) {
      console.log('[AuthGuard] → /(auth)/phone — no session');
      router.replace('/(auth)/phone');
    } else if (user && inAuth) {
      const dest = isAdmin ? '/(admin)' : '/(tabs)';
      console.log(`[AuthGuard] → ${dest} — leaving auth screen`);
      router.replace(dest);
    } else if (user && isAdmin && inTabs) {
      // Admin landed on tabs (default route on cold start) — push to admin panel
      console.log('[AuthGuard] → /(admin) — admin in tabs, redirecting');
      router.replace('/(admin)');
    } else if (user && !isAdmin && inAdmin) {
      // Non-admin somehow in admin panel — eject them
      console.log('[AuthGuard] → /(tabs) — non-admin in admin panel, ejecting');
      router.replace('/(tabs)');
    }
  }, [user, isAdmin, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { loadFromStorage, isLoading } = useAuthStore();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // Start loading stored auth in parallel with the splash animation
    loadFromStorage();
  }, []);

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />

      {/* Stack renders (and AuthGuard fires) beneath the splash */}
      {!isLoading && (
        <>
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true, title: '' }} />
          </Stack>
        </>
      )}

      {/* Splash sits on top as an absolute overlay; fades out when animation ends */}
      {!splashDone && (
        <SplashAnimation onDone={() => setSplashDone(true)} />
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({});
