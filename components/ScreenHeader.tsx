import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Ping, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  title: string;
  onBack?: () => void;
  /** Optional element rendered in the right slot (e.g. a Save button) */
  right?: React.ReactNode;
  /** Add a hairline border at the bottom. Default true */
  border?: boolean;
  /** Extra paddingTop — pass insets.top + 8 from the caller */
  paddingTop?: number;
}

/**
 * Standard screen top bar used across all full-screen routes.
 * Keeps icon size, spacing and title style consistent everywhere.
 */
export default function ScreenHeader({ title, onBack, right, border = true, paddingTop = 8 }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];

  return (
    <View
      style={[
        styles.bar,
        { paddingTop, borderBottomColor: c.border },
        border && styles.bordered,
      ]}
    >
      {/* Left — back button or spacer */}
      {onBack ? (
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.side}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.side} />
      )}

      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {title}
      </Text>

      {/* Right slot */}
      <View style={styles.side}>{right ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
  },
  bordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.h3, flex: 1, textAlign: 'center' },
});
