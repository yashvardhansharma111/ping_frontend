import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ping } from '@/constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  /** Photo URI — shown first if present */
  uri?: string | null;
  /** Name used to derive initials — shown if no URI */
  name?: string | null;
  /** Fallback icon if neither uri nor name */
  icon?: IoniconsName;
  /** Size in pixels (diameter). Default 44 */
  size?: number;
  /** Background colour of the fallback circle. Defaults to purple tint */
  bg?: string;
  /** Icon / text tint colour. Defaults to Ping.purpleLight */
  tint?: string;
  /** Optional border width */
  borderWidth?: number;
  /** Optional border colour */
  borderColor?: string;
}

/**
 * Single source of truth for circular user avatars across the app.
 * Priority: photo URI → initials from name → icon fallback.
 */
export default function AppAvatar({
  uri,
  name,
  icon = 'person',
  size = 44,
  bg,
  tint,
  borderWidth,
  borderColor,
}: Props) {
  const resolvedBg = bg ?? `${Ping.purple}33`;
  const resolvedTint = tint ?? Ping.purpleLight;
  const r = size / 2;
  const fontSize = Math.round(size * 0.36);

  const circleStyle = {
    width: size,
    height: size,
    borderRadius: r,
    backgroundColor: resolvedBg,
    ...(borderWidth ? { borderWidth, borderColor: borderColor ?? resolvedTint } : {}),
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.img, circleStyle]}
      />
    );
  }

  const initial = name?.trim()
    ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : null;

  return (
    <View style={[styles.fallback, circleStyle]}>
      {initial ? (
        <Text style={[styles.initial, { color: resolvedTint, fontSize }]}>{initial}</Text>
      ) : (
        <Ionicons name={icon} size={Math.round(size * 0.46)} color={resolvedTint} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  img: { flexShrink: 0 },
  fallback: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initial: { fontWeight: '700' },
});
