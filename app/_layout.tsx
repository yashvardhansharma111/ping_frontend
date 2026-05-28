import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import useAuthStore from '@/lib/stores/authStore';
import { Ping } from '@/constants/theme';

function AuthGuard() {
  const { user, isAdmin, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    const inAdmin = segments[0] === '(admin)';
    const inTabs = segments[0] === '(tabs)';

    if (!user && !inAuth) {
      router.replace('/(auth)/phone');
    } else if (user && inAuth) {
      router.replace(isAdmin ? '/(admin)' : '/(tabs)');
    } else if (user && isAdmin && inTabs) {
      // Admin accidentally on tabs — redirect to admin
      router.replace('/(admin)');
    }
  }, [user, isAdmin, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { loadFromStorage, isLoading } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={navTheme}>
      <AuthGuard />
      {isLoading ? (
        <View style={styles.splash}>
          <ActivityIndicator size="large" color={Ping.purple} />
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true, title: '' }} />
        </Stack>
      )}
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#080815',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
