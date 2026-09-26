import { useEffect, useRef } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ToastChip } from './ToastConfig';

interface Props {
  visible: boolean;
  message: string;
  subMessage?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  color?: string;
  onDone?: () => void;
}

// Locally-controlled toast (for flows that own their own visibility state).
// Renders the same ToastChip as the global toast so every notification in
// the app looks identical and follows the theme.
export default function SuccessToast({
  visible,
  message,
  subMessage,
  icon = 'checkmark',
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
      <ToastChip accent={color} icon={icon} text1={message} text2={subMessage} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});
