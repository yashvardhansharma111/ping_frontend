import { Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Ping, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Override accent when selected (defaults to brand purple) */
  color?: string;
  style?: ViewStyle;
}

/**
 * Selectable filter / tag chip used on explore, events, friends filters, forms.
 */
export default function AppChip({
  label,
  selected = false,
  onPress,
  icon,
  color,
  style,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const accent = color ?? c.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected
            ? isDark
              ? `${accent}33`
              : `${accent}18`
            : isDark
            ? 'rgba(255,255,255,0.06)'
            : c.surface,
          borderColor: selected ? accent : c.border,
        },
        style,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={selected ? accent : c.icon} />
      ) : null}
      <Text
        style={[
          styles.label,
          { color: selected ? accent : c.textSecondary, fontWeight: selected ? '700' : '600' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { ...Typography.caption, fontSize: 12.5 },
});
