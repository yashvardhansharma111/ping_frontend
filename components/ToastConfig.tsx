import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToastConfig } from 'react-native-toast-message';

const ICONS = {
  success: { name: 'checkmark-circle' as const, color: '#10B981' },
  error:   { name: 'close-circle'     as const, color: '#EF4444' },
  info:    { name: 'information-circle' as const, color: '#A78BFA' },
};

function PingToast({ type, text1, text2 }: { type: 'success' | 'error' | 'info'; text1?: string; text2?: string }) {
  const cfg = ICONS[type];
  return (
    <View style={[s.wrap, s[type]]}>
      <Ionicons name={cfg.name} size={20} color={cfg.color} style={{ marginTop: 1 }} />
      <View style={s.textWrap}>
        {!!text1 && <Text style={s.title} numberOfLines={1}>{text1}</Text>}
        {!!text2 && <Text style={s.body}  numberOfLines={2}>{text2}</Text>}
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
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
  },
  success: { backgroundColor: '#0D1F18', borderColor: '#10B98140' },
  error:   { backgroundColor: '#1F0D0D', borderColor: '#EF444440' },
  info:    { backgroundColor: '#110D1F', borderColor: '#A78BFA40' },
  textWrap: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#F1F0FF', letterSpacing: -0.2 },
  body:  { fontSize: 12, color: '#9B97C8', marginTop: 2, lineHeight: 17 },
});
