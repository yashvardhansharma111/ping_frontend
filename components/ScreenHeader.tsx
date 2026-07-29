import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Ping, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  title: string;
  onBack?: () => void;
  /** Optional element rendered in the right slot (e.g. a Save button) */
  right?: React.ReactNode;
  /** Add a hairline border at the bottom. Default false for clean layout */
  border?: boolean;
  /** Extra paddingTop — pass insets.top + 8 from the caller */
  paddingTop?: number;
}

/**
 * Standard screen top bar matching Reference Image 2 circular header controls.
 */
export default function ScreenHeader({ title, onBack, right, border = false, paddingTop = 8 }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const c = Colors[scheme];

  const circleBg = scheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#F2F2F5';

  return (
    <View
      style={[
        styles.bar,
        { paddingTop, borderBottomColor: c.border },
        border && styles.bordered,
      ]}
    >
      {/* Left — circular back button or spacer */}
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={[styles.circleBtn, { backgroundColor: circleBg }]}
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.circleSpacer} />
      )}

      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {title}
      </Text>

      {/* Right slot */}
      {right ? (
        <View style={styles.rightWrap}>{right}</View>
      ) : (
        <View style={styles.circleSpacer} />
      )}
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
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSpacer: {
    width: 40,
    height: 40,
  },
  rightWrap: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h3,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
