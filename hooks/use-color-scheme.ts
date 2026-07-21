import { useColorScheme as useSystemColorScheme } from 'react-native';
import useThemeStore from '@/lib/stores/themeStore';

export function useColorScheme(): 'light' | 'dark' {
  const { preference } = useThemeStore();
  const system = useSystemColorScheme();
  if (preference !== 'system') return preference;
  return system ?? 'dark';
}
