import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Ping, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppButton } from '@/components/ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  /** Suggested upgrade tier */
  upgradeTo?: 'pro' | 'premium';
}

/**
 * Shown when a freemium quota / Pro-only / Premium-only gate blocks an action.
 */
export default function PaywallModal({
  visible,
  onClose,
  title = 'Upgrade to continue',
  message = 'This feature needs a paid plan.',
  upgradeTo = 'pro',
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const router = useRouter();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.root}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(17,17,17,0.3)' },
          ]}
          onPress={onClose}
        />
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[s.title, { color: c.text }]}>{title}</Text>
          <Text style={[s.sub, { color: c.textSecondary }]}>{message}</Text>
          <AppButton
            label={upgradeTo === 'premium' ? 'See Premium plans' : 'See Pro plans'}
            gradient={upgradeTo === 'premium'}
            onPress={() => {
              onClose();
              router.push('/subscription' as any);
            }}
          />
          <AppButton label="Not now" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: 12,
    zIndex: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
  },
});
