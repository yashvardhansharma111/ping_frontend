import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Ping, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AppButton from './AppButton';

interface Props {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

/**
 * Shared empty-list / empty-tab placeholder.
 */
export default function EmptyState({
  icon = 'file-tray-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View style={[styles.root, style]}>
      <View style={[styles.iconWrap, { backgroundColor: `${Ping.purple}18` }]}>
        <Ionicons name={icon} size={36} color={c.tint} />
      </View>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sub, { color: c.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          onPress={onAction}
          size="sm"
          fullWidth={false}
          style={styles.cta}
          icon="add"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: { ...Typography.bodyMed, fontSize: 18, textAlign: 'center' },
  sub: { ...Typography.bodySm, textAlign: 'center', lineHeight: 20 },
  cta: { marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, minWidth: 140 },
});
