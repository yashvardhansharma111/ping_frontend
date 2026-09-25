import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToastConfig } from 'react-native-toast-message';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ToastType = 'success' | 'error' | 'info';

type Palette = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bubbleBg: string;
  chipBg: string;
  chipBorder: string;
  textColor: string;
  subColor: string;
};

// Opaque chips in both themes so the toast reads on any screen behind it.
const DARK: Record<ToastType, Palette> = {
  success: { icon: 'checkmark', iconColor: '#10B981', bubbleBg: 'rgba(16,185,129,0.18)', chipBg: '#0F1F19', chipBorder: 'rgba(16,185,129,0.35)', textColor: '#D1FAE5', subColor: '#6EE7B7' },
  error:   { icon: 'close',     iconColor: '#F87171', bubbleBg: 'rgba(239,68,68,0.18)',  chipBg: '#221010', chipBorder: 'rgba(239,68,68,0.35)',  textColor: '#FEE2E2', subColor: '#FCA5A5' },
  info:    { icon: 'location',  iconColor: '#C4B5FD', bubbleBg: 'rgba(167,139,250,0.20)', chipBg: '#171026', chipBorder: 'rgba(167,139,250,0.40)', textColor: '#EDE9FE', subColor: '#A78BFA' },
};

const LIGHT: Record<ToastType, Palette> = {
  success: { icon: 'checkmark', iconColor: '#059669', bubbleBg: 'rgba(16,185,129,0.14)', chipBg: '#FFFFFF', chipBorder: 'rgba(5,150,105,0.30)',  textColor: '#064E3B', subColor: '#047857' },
  error:   { icon: 'close',     iconColor: '#DC2626', bubbleBg: 'rgba(239,68,68,0.14)',  chipBg: '#FFFFFF', chipBorder: 'rgba(220,38,38,0.30)',  textColor: '#7F1D1D', subColor: '#B91C1C' },
  info:    { icon: 'location',  iconColor: '#7C3AED', bubbleBg: 'rgba(139,92,246,0.14)', chipBg: '#FFFFFF', chipBorder: 'rgba(124,58,237,0.30)', textColor: '#3B1D8F', subColor: '#6D28D9' },
};

function PingToast({ type, text1, text2 }: { type: ToastType; text1?: string; text2?: string }) {
  const isDark = (useColorScheme() ?? 'light') === 'dark';
  const c = (isDark ? DARK : LIGHT)[type];
  return (
    <View style={[s.chip, { backgroundColor: c.chipBg, borderColor: c.chipBorder }]}>
      <View style={[s.bubble, { backgroundColor: c.bubbleBg }]}>
        <Ionicons name={c.icon} size={16} color={c.iconColor} />
      </View>
      <View style={s.textWrap}>
        {!!text1 && <Text style={[s.title, { color: c.textColor }]} numberOfLines={1}>{text1}</Text>}
        {!!text2 && <Text style={[s.body, { color: c.subColor }]} numberOfLines={2}>{text2}</Text>}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => <PingToast type="success" text1={text1} text2={text2} />,
  error:   ({ text1, text2 }) => <PingToast type="error"   text1={text1} text2={text2} />,
  info:    ({ text1, text2 }) => <PingToast type="info"    text1={text1} text2={text2} />,
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
    shadowColor: '#000',
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
  textWrap: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  body:  { fontSize: 12, marginTop: 1, lineHeight: 16 },
});
