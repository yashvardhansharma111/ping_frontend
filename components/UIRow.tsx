import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Ping, Spacing, Radius, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IoniconsName;
  label: string;
  onPress?: () => void;
  /** Accent colour for the icon and its background tint */
  iconColor?: string;
  /** Small badge text shown before the trailing chevron (e.g. "!" ) */
  badge?: string | number;
  /** Swap chevron for an external-link icon */
  external?: boolean;
  /** Red-tint the icon and label (for destructive rows like Log out) */
  danger?: boolean;
  /** Draw a hairline separator below this row */
  separator?: boolean;
  /** Disable tap */
  disabled?: boolean;
}

/**
 * Single reusable row used in Settings cards, Safety, and any
 * menu-style list. Icon background is automatically tinted.
 */
export default function UIRow({
  icon,
  label,
  onPress,
  iconColor,
  badge,
  external,
  danger,
  separator,
  disabled,
}: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];

  const resolvedIconColor = danger ? '#EF4444' : (iconColor ?? c.textSecondary);
  const resolvedIconBg = danger
    ? 'rgba(239,68,68,0.1)'
    : iconColor
    ? `${iconColor}18`
    : `${Ping.purple}12`;

  const content = (
    <View
      style={[
        styles.row,
        separator && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: resolvedIconBg }]}>
        <Ionicons name={icon} size={18} color={resolvedIconColor} />
      </View>

      <Text style={[styles.label, { color: danger ? '#EF4444' : c.text }]} numberOfLines={1}>
        {label}
      </Text>

      {badge !== undefined ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}

      <Ionicons
        name={external ? 'open-outline' : 'chevron-forward'}
        size={14}
        color={c.icon}
      />
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={disabled}>
      {content}
    </TouchableOpacity>
  );
}

/** Wrap a list of <UIRow> items in a consistent card container */
export function UICard({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: `${Ping.purple}33`,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: { ...Typography.bodyMed, flex: 1, fontSize: 15 },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Ping.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
});
