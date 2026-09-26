import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToastConfig } from 'react-native-toast-message';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Accent = string | { dark: string; light: string };

// Single visual for every in-app toast: compact centred pill, opaque surface,
// accent-tinted icon bubble + border, theme-aware text. Used by the
// react-native-toast-message config below and by <SuccessToast/>.
export function ToastChip({
  accent, icon, text1, text2,
}: { accent: Accent; icon: IoniconName; text1?: string; text2?: string }) {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const a = typeof accent === 'string' ? accent : (isDark ? accent.dark : accent.light);

  return (
    <View
      style={[
        s.chip,
        {
          backgroundColor: isDark ? '#16131F' : '#FFFFFF',
          borderColor: `${a}${isDark ? '59' : '4D'}`,
          shadowColor: isDark ? '#000' : a,
        },
      ]}
    >
      <View style={[s.bubble, { backgroundColor: `${a}${isDark ? '2E' : '24'}` }]}>
        <Ionicons name={icon} size={16} color={a} />
      </View>
      <View style={s.textWrap}>
        {!!text1 && (
          <Text style={[s.title, { color: isDark ? '#F1F0FF' : '#111111' }]} numberOfLines={1}>{text1}</Text>
        )}
        {!!text2 && (
          <Text style={[s.body, { color: a }]} numberOfLines={2}>{text2}</Text>
        )}
      </View>
    </View>
  );
}

const ACCENTS = {
  success: { dark: '#34D399', light: '#059669' },
  error:   { dark: '#F87171', light: '#DC2626' },
  info:    { dark: '#C4B5FD', light: '#7C3AED' },
} as const;

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => <ToastChip accent={ACCENTS.success} icon="checkmark" text1={text1} text2={text2} />,
  error:   ({ text1, text2 }) => <ToastChip accent={ACCENTS.error}   icon="close"     text1={text1} text2={text2} />,
  info:    ({ text1, text2 }) => <ToastChip accent={ACCENTS.info}    icon="sparkles"  text1={text1} text2={text2} />,
};

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 40,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: 340,
  },
  bubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: { flexShrink: 1 },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  body:  { fontSize: 12, marginTop: 1, lineHeight: 16 },
});
