import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients, Ping, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline';
type Size = 'md' | 'lg' | 'sm';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconRight?: React.ComponentProps<typeof Ionicons>['name'];
  /** Use brand gradient for primary (auth-style CTAs) */
  gradient?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const HEIGHT: Record<Size, number> = { sm: 40, md: 48, lg: 54 };

/**
 * Canonical app button — use everywhere instead of one-off TouchableOpacity CTAs.
 */
export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  gradient = false,
  fullWidth = true,
  style,
  textStyle,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';
  const blocked = disabled || loading;
  const h = HEIGHT[size];

  const labelColor =
    variant === 'primary' || variant === 'danger'
      ? '#FFF'
      : variant === 'dangerOutline'
      ? Ping.red
      : c.text;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={labelColor} /> : null}
          <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: labelColor }, textStyle]}>
            {label}
          </Text>
          {iconRight ? (
            <Ionicons name={iconRight} size={size === 'sm' ? 16 : 18} color={labelColor} />
          ) : null}
        </>
      )}
    </>
  );

  if (variant === 'primary' && gradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={blocked}
        activeOpacity={0.88}
        style={[fullWidth && styles.full, { opacity: blocked ? 0.5 : 1 }, style]}
      >
        <LinearGradient
          colors={[...Gradients.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, { height: h, borderRadius: Radius.full }]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const bg =
    variant === 'primary'
      ? c.primary
      : variant === 'danger'
      ? Ping.red
      : variant === 'secondary'
      ? isDark
        ? 'rgba(255,255,255,0.06)'
        : c.soft
      : variant === 'dangerOutline'
      ? 'rgba(239,68,68,0.06)'
      : 'transparent';

  const borderColor =
    variant === 'secondary' || variant === 'ghost'
      ? c.border
      : variant === 'dangerOutline'
      ? 'rgba(239,68,68,0.4)'
      : 'transparent';

  const borderWidth = variant === 'ghost' || variant === 'secondary' || variant === 'dangerOutline' ? StyleSheet.hairlineWidth : 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={blocked}
      activeOpacity={0.85}
      style={[
        styles.base,
        fullWidth && styles.full,
        {
          height: h,
          backgroundColor: bg,
          borderColor,
          borderWidth,
          borderRadius: Radius.full,
          opacity: blocked ? 0.5 : 1,
        },
        style,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  full: { width: '100%' },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  label: { ...Typography.bodyMed, fontWeight: '700', fontSize: 15 },
  labelSm: { fontSize: 13 },
});
