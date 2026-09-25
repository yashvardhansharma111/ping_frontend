import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Radius, Spacing, Colors, Ping, Gradients } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  ctaLabel?: string;
}

export default function ComingSoonSheet({
  visible, onClose, title, subtitle, icon = 'sparkles', ctaLabel = 'Got it',
}: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';

  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) { scale.setValue(0.92); opacity.setValue(0); return; }
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 16, stiffness: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(17,17,17,0.28)' }]}
          onPress={onClose}
        />

        <Animated.View
          style={[
            s.card,
            { backgroundColor: c.surface, borderColor: c.border, opacity, transform: [{ scale }] },
          ]}
        >
          <View style={[s.pill, { backgroundColor: `${Ping.purple}1F`, borderColor: `${Ping.purple}40` }]}>
            <View style={[s.pillDot, { backgroundColor: Ping.purpleLight }]} />
            <Text style={[s.pillText, { color: Ping.purpleLight }]}>COMING SOON</Text>
          </View>

          <View style={[s.iconWrap, { backgroundColor: `${Ping.purple}1A` }]}>
            <View style={[s.iconRing, { borderColor: `${Ping.purple}33` }]} />
            <Ionicons name={icon} size={28} color={isDark ? Ping.purpleLight : Ping.purple} />
          </View>

          <Text style={[s.title, { color: c.text }]}>{title}</Text>
          {subtitle ? <Text style={[s.subtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}

          <TouchableOpacity onPress={onClose} activeOpacity={0.88} style={s.btnWrap}>
            <LinearGradient
              colors={[...Gradients.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.btn}
            >
              <Text style={s.btnText}>{ctaLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    shadowColor: Ping.purpleDim,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  iconRing: { position: 'absolute', width: 88, height: 88, borderRadius: 44, borderWidth: 1.5 },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3, marginTop: 6 },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 260 },
  btnWrap: { width: '100%', marginTop: Spacing.sm, borderRadius: Radius.full, overflow: 'hidden' },
  btn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
