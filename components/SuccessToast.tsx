import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  message: string;
  subMessage?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  color?: string;
  onDone?: () => void;
}

export default function SuccessToast({
  visible,
  message,
  subMessage,
  icon = 'checkmark-circle',
  color = '#22C55E',
  onDone,
}: Props) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    if (visible) {
      slideY.setValue(-120);
      opacity.setValue(0);
      scale.setValue(0.92);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, damping: 18, stiffness: 280, mass: 0.8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 260, useNativeDriver: true }),
      ]).start();

      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideY, { toValue: -120, duration: 280, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start(() => onDone?.());
      }, 2600);
    } else {
      slideY.setValue(-120);
      opacity.setValue(0);
    }

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        s.wrap,
        { top: insets.top + 10, opacity, transform: [{ translateY: slideY }, { scale }] },
      ]}
      pointerEvents="none"
    >
      <View style={[s.iconWrap, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.message}>{message}</Text>
        {subMessage ? <Text style={s.sub}>{subMessage}</Text> : null}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(20,20,40,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { color: '#F1F0FF', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  sub: { color: 'rgba(241,240,255,0.6)', fontSize: 12, marginTop: 2 },
});
