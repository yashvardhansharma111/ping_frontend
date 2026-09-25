import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AuthLayout() {
  const isDark = (useColorScheme() ?? 'light') === 'dark';
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: isDark ? '#0F0F12' : '#FFFFFF' },
      }}
    />
  );
}
