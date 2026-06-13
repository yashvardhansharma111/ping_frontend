import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

function SkeletonBlock({
  width,
  height,
  borderRadius = 8,
  shimmer,
}: {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  shimmer: Animated.AnimatedInterpolation<string | number>;
}) {
  const scheme = useColorScheme() ?? 'dark';
  const baseBg = scheme === 'dark' ? '#1E1E38' : '#E5E7EB';
  const shimmerBg = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [baseBg, scheme === 'dark' ? '#2D2D50' : '#F3F4F6', baseBg],
  });
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: shimmerBg }]}
    />
  );
}

export function SkeletonRow({ shimmer }: { shimmer: Animated.AnimatedInterpolation<string | number> }) {
  return (
    <View style={s.row}>
      <SkeletonBlock width={50} height={50} borderRadius={25} shimmer={shimmer} />
      <View style={s.lines}>
        <SkeletonBlock width="65%" height={14} shimmer={shimmer} />
        <SkeletonBlock width="45%" height={11} borderRadius={6} shimmer={shimmer} />
      </View>
    </View>
  );
}

export function SkeletonChatRow({ shimmer }: { shimmer: Animated.AnimatedInterpolation<string | number> }) {
  return (
    <View style={s.row}>
      <SkeletonBlock width={50} height={50} borderRadius={25} shimmer={shimmer} />
      <View style={s.lines}>
        <View style={s.topLine}>
          <SkeletonBlock width="50%" height={14} shimmer={shimmer} />
          <SkeletonBlock width={30} height={11} borderRadius={6} shimmer={shimmer} />
        </View>
        <SkeletonBlock width="70%" height={11} borderRadius={6} shimmer={shimmer} />
      </View>
    </View>
  );
}

export default function SkeletonList({
  count = 6,
  variant = 'friends',
}: {
  count?: number;
  variant?: 'friends' | 'chat';
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: false })
    ).start();
  }, []);

  return (
    <View style={s.container}>
      {Array.from({ length: count }).map((_, i) =>
        variant === 'chat' ? (
          <SkeletonChatRow key={i} shimmer={anim as any} />
        ) : (
          <SkeletonRow key={i} shimmer={anim as any} />
        )
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  lines: { flex: 1, gap: 8 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
