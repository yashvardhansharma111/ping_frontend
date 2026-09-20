import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToastConfig } from 'react-native-toast-message';

type ToastType = 'success' | 'error' | 'info';

const CFG: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; iconColor: string; bubbleBg: string; chipBg: string; textColor: string; subColor: string }> = {
  success: {
    icon: 'checkmark',
    iconColor: '#10B981',
    bubbleBg: '#0D2018',
    chipBg: 'rgba(16,185,129,0.13)',
    textColor: '#D1FAE5',
    subColor: '#6EE7B7',
  },
  error: {
    icon: 'close',
    iconColor: '#F87171',
    bubbleBg: '#200D0D',
    chipBg: 'rgba(239,68,68,0.13)',
    textColor: '#FEE2E2',
    subColor: '#FCA5A5',
  },
  info: {
    icon: 'location',
    iconColor: '#C4B5FD',
    bubbleBg: '#160D22',
    chipBg: 'rgba(167,139,250,0.15)',
    textColor: '#EDE9FE',
    subColor: '#A78BFA',
  },
};

function PingToast({ type, text1, text2 }: { type: ToastType; text1?: string; text2?: string }) {
  const c = CFG[type];
  return (
    <View style={[s.chip, { backgroundColor: c.chipBg }]}>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 10,
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
