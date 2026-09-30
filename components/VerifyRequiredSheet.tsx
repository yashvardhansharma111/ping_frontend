import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Ping, Radius, Gradients } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** What the user was trying to do — shapes the copy */
  action?: 'create' | 'join' | 'chat';
}

// Compact, on-brand gate shown when an unverified member tries to create or
// join a ping. Sends them to the verification flow.
export default function VerifyRequiredSheet({ visible, onClose, action = 'join' }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const router = useRouter();

  const verb = action === 'create' ? 'create a ping' : action === 'chat' ? 'open ping chats' : 'join a ping';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(17,17,17,0.3)' }]} onPress={onClose} />
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[s.iconWrap, { backgroundColor: `${Ping.purple}1A` }]}>
            <Ionicons name="shield-checkmark" size={26} color={isDark ? Ping.purpleLight : Ping.purple} />
          </View>
          <Text style={[s.title, { color: c.text }]}>Verification required</Text>
          <Text style={[s.body, { color: c.textSecondary }]}>
            Identity verification is mandatory to {verb}. It takes under a minute and keeps every ping safe for the people who show up.
          </Text>

          <TouchableOpacity
            onPress={() => { onClose(); router.push('/verification' as any); }}
            activeOpacity={0.88}
            style={s.ctaWrap}
          >
            <LinearGradient colors={[...Gradients.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
              <Text style={s.ctaText}>Verify now</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={s.later}>
            <Text style={[s.laterText, { color: c.textSecondary }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  card: {
    width: '100%', maxWidth: 320, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 14, alignItems: 'center', gap: 8,
  },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2, textAlign: 'center' },
  body: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  ctaWrap: { width: '100%', marginTop: 10, borderRadius: Radius.full, overflow: 'hidden' },
  cta: { height: 46, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  later: { paddingVertical: 8 },
  laterText: { fontSize: 13, fontWeight: '600' },
});
